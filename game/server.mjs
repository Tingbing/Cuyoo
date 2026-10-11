import {room,testRoom,action,advance,view,need,GameError,upgrade,reconcilePresence,reconcileBot,claim,CONNECTION_MS} from './engine.mjs';
const COOKIE='cuyoo_device';
const uuid=()=>crypto.randomUUID();
const validID=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function testRoomId(session){const value=await hash(`cuyoo-test-room:${session}`);return `${value.slice(0,8)}-${value.slice(8,12)}-4${value.slice(13,16)}-a${value.slice(17,20)}-${value.slice(20,32)}`;}
function name(s,label='Username',max=24){need(typeof s==='string',`${label} is required.`);const v=s.trim().normalize('NFKC');need(v.length>=2&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v),`${label} must be 2–${max} readable characters.`);return v;}
const reply=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
async function online(db,g,now){const rows=await db.prepare('SELECT id,seen FROM sessions WHERE active_room = ?').bind(g.id).all();const ids=new Set(rows.results.filter(s=>now-s.seen<CONNECTION_MS).map(s=>s.id));return id=>ids.has(id);}
async function persist(db,g,expected,mutation,now,session=null,mode=null){const query=db.prepare(`UPDATE rooms SET state=?,version=?,status=?,mutation=?,updated=? WHERE id=? AND version=?${mode==='join'?" AND EXISTS (SELECT 1 FROM sessions WHERE id=? AND (active_room IS NULL OR active_room=?))":''}`).bind(JSON.stringify(g),g.version,g.phase,mutation,now,g.id,expected,...(mode==='join'?[session,g.id]:[]));
 if(!mode){const r=await query.run();return r.meta.changes===1;}
 const membership=db.prepare(`UPDATE sessions SET active_room=? WHERE id=? AND EXISTS(SELECT 1 FROM rooms WHERE id=? AND mutation=?)`).bind(mode==='leave'?null:g.id,session,g.id,mutation);
 const r=await db.batch([query,membership]);return r[0].meta.changes===1;
}
async function load(db,id,now){for(let i=0;i<8;i++){const row=await db.prepare('SELECT state,version FROM rooms WHERE id=?').bind(id).first();need(row,'That table is no longer available.',404);const g=JSON.parse(row.state);const changed=upgrade(g,now);const rows=await db.prepare('SELECT id,seen FROM sessions WHERE active_room=?').bind(id).all();const seen=new Map(rows.results.map(s=>[s.id,s.seen]));const presence=reconcilePresence(g,seen,now),isOnline=id=>seen.has(id)&&now-seen.get(id)<CONNECTION_MS;const advanced=advance(g,now,isOnline),bot=reconcileBot(g,now,isOnline);if(!changed&&!presence&&!advanced&&!bot)return g;g.version=row.version+1;
 const mutation=uuid();const statements=[db.prepare('UPDATE rooms SET state=?,version=?,status=?,mutation=?,updated=? WHERE id=? AND version=?').bind(JSON.stringify(g),g.version,g.phase,mutation,now,id,row.version),db.prepare("UPDATE sessions SET active_room=NULL WHERE active_room=? AND EXISTS(SELECT 1 FROM rooms WHERE id=? AND mutation=?) AND NOT EXISTS(SELECT 1 FROM json_each((SELECT state FROM rooms WHERE id=?),'$.seats') WHERE json_extract(value,'$.id')=sessions.id)").bind(id,id,mutation,id)];const saved=await db.batch(statements);if(saved[0].meta.changes===1)return g;}throw new GameError('Table updated. Try again.',409);}
// WebSocket acknowledgements renew the durable connection lease. Browser
// message events (unlike interval timers) continue in background tabs. A closed
// socket releases only its connection; absence of pongs detects silent loss.
async function presenceSocket(db,session,tab,request,ctx){need(request.headers.get('Upgrade')?.toLowerCase()==='websocket','A WebSocket connection is required.',426);need(request.headers.get('Origin')===new URL(request.url).origin,'Use this table’s website.',403);
 await db.prepare('DELETE FROM connections WHERE expires<?').bind(Date.now()-60000).run();const count=await db.prepare('SELECT COUNT(*) AS n FROM connections WHERE session=? AND expires>?').bind(session.id,Date.now()).first();need(count.n<8,'Too many active tabs.',429);
 const id=uuid(),pair=new WebSocketPair(),client=pair[0],socket=pair[1];let stopped=false,timer,lastAck=Date.now(),processing=false;
 await db.prepare('INSERT INTO connections(id,session,expires) VALUES(?,?,?)').bind(id,session.id,lastAck+CONNECTION_MS).run();socket.accept();
 const stop=async()=>{if(stopped)return;stopped=true;clearInterval(timer);await db.batch([db.prepare('DELETE FROM connections WHERE id=?').bind(id),db.prepare('UPDATE sessions SET seen=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM connections WHERE session=? AND expires>?)').bind(Date.now()-CONNECTION_MS,session.id,session.id,Date.now())]);};
 const task=p=>{if(ctx?.waitUntil)ctx.waitUntil(p);else p.catch(()=>{});};
 socket.addEventListener('close',()=>task(stop()));socket.addEventListener('error',()=>task(stop()));
 socket.addEventListener('message',e=>{if(e.data!=='pong'||processing||stopped)return;processing=true;task((async()=>{try{const now=Date.now(),current=await db.prepare('SELECT active_room FROM sessions WHERE id=?').bind(session.id).first();if(!current?.active_room){socket.close(1008,'Seat ended');await stop();return;}const g=await load(db,current.active_room,now);if(!g.seats.some(s=>s.id===session.id)){socket.close(1008,'Seat ended');await stop();return;}
 lastAck=now;await db.batch([db.prepare('UPDATE connections SET expires=? WHERE id=?').bind(now+CONNECTION_MS,id),db.prepare('UPDATE sessions SET seen=?,lease=CASE WHEN controller=? THEN ? ELSE lease END WHERE id=? AND active_room=?').bind(now,tab,now,session.id,g.id)]);}catch{socket.close(1011,'Reconnect');await stop();}finally{processing=false;}})());});
 const ping=()=>{if(stopped)return;if(Date.now()-lastAck>CONNECTION_MS){socket.close(1012,'Reconnect');task(stop());return;}try{socket.send('ping');}catch{task(stop());}};ping();timer=setInterval(ping,2000);
 return new Response(null,{status:101,webSocket:client});}
export async function handle(request,env,ctx){let extra={};try{
 need(env.DB,'The dedicated game database is unavailable.',503);const db=env.DB,now=Date.now(),u=new URL(request.url),path=u.pathname;const presence=path==='/api/presence';
 need(path.startsWith('/api/'),'Not found.',404);need(['GET','POST'].includes(request.method),'Method not allowed.',405);
 if(request.method==='POST'){need(request.headers.get('origin')===u.origin,'Use this table’s website to submit actions.',403);need((request.headers.get('content-type')??'').startsWith('application/json'),'Send JSON.');}
 let input={};if(request.method==='POST'){const raw=await request.text();need(raw.length<=2048,'Request is too large.',413);try{input=JSON.parse(raw);}catch{throw new GameError('Invalid JSON.');}need(input&&typeof input==='object'&&!Array.isArray(input),'Invalid request.');}
 const token=(request.headers.get('cookie')??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 let session=token&&/^[a-f0-9]{64}$/.test(token)?await db.prepare('SELECT * FROM sessions WHERE id=?').bind(await hash(token)).first():null;
 const tab=presence?u.searchParams.get('tab'):request.headers.get('x-client-tab');need(validID(tab),'Open the game in a browser tab.');
 if(path==='/api/session'&&request.method==='POST'){
 if(!session){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);const t=Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');const id=await hash(t);await db.prepare('INSERT INTO sessions(id,name,seen,created,controller,lease) VALUES(?,?,?,?,?,?)').bind(id,input.name?name(input.name):'',now,now,tab,now).run();session=await db.prepare('SELECT * FROM sessions WHERE id=?').bind(id).first();extra['Set-Cookie']=`${COOKIE}=${t}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`;}
 else if(input.name!==undefined){need(!session.active_room,'Leave your table before changing your username.');const next=name(input.name);await db.prepare('UPDATE sessions SET name=? WHERE id=? AND active_room IS NULL').bind(next,session.id).run();session.name=next;}
 return reply({name:session.name,roomId:session.active_room},200,extra);}
 need(session,'Your device session expired. Reload to reconnect.',401);
 // Deal snapshots must not wait behind the generic lobby/action bookkeeping.
 // Reconcile and authorize the current occupant before projecting private cards.
 const reading=path.match(/^\/api\/rooms\/([a-f0-9-]{36})$/);
 if(request.method==='GET'&&reading){
 const id=reading[1];need(session.active_room===id,'Only seated players can access this table.',403);
 const g=await load(db,id,now);need(g.seats.some(s=>s.id===session.id),'Only seated players can access this table.',403);
 const renew=[];if(session.seen<now-2000)renew.push(db.prepare('UPDATE sessions SET seen=? WHERE id=? AND active_room=?').bind(now,session.id,id));
 if(session.controller===null||session.controller!==tab||session.lease<now-5000)renew.push(db.prepare('UPDATE sessions SET controller=?,lease=? WHERE id=? AND active_room=? AND (controller=? OR lease<? OR controller IS NULL) RETURNING controller').bind(tab,now,session.id,id,tab,now-15000));
 if(renew.length){const results=await db.batch(renew);const controller=results.flatMap(r=>r.results??[]).find(r=>r.controller);if(controller)session.controller=controller.controller;}
 const currentTime=Date.now(),isOnline=await online(db,g,currentTime);
 return reply({...view(g,session.id,isOnline,currentTime),readOnly:session.controller!==tab,serverTime:currentTime});}
 if(session.active_room)await load(db,session.active_room,now);
 session=await db.prepare('SELECT * FROM sessions WHERE id=?').bind(session.id).first();
 if(presence){need(request.method==='GET'&&session.active_room,'No active seat.',403);return presenceSocket(db,session,tab,request,ctx);}
 await db.prepare('UPDATE sessions SET seen=? WHERE id=? AND seen<?').bind(now,session.id,now-2000).run();
 // A short database-backed controller lease makes other tabs read-only.
 await db.prepare('UPDATE sessions SET seen=?,controller=?,lease=? WHERE id=? AND (controller=? OR lease<? OR controller IS NULL) AND (controller IS NULL OR controller!=? OR lease<?)').bind(now,tab,now,session.id,tab,now-15000,tab,now-5000).run();
 session=await db.prepare('SELECT * FROM sessions WHERE id=?').bind(session.id).first();const readOnly=session.controller!==tab;
 if(request.method==='POST'){
 need(!readOnly,'Another tab controls this device. Close it and wait 15 seconds.',409);
 const rate=await db.prepare('UPDATE sessions SET rate_count=CASE WHEN rate_at<? THEN 1 ELSE rate_count+1 END, rate_at=CASE WHEN rate_at<? THEN ? ELSE rate_at END WHERE id=? RETURNING rate_count').bind(now-60000,now-60000,now,session.id).first();need(rate.rate_count<=180,'Too many requests. Wait a minute.',429);}
 if(path==='/api/lobby'&&request.method==='GET'){
 // 24h unattended waiting rooms; 7d abandoned games. A connected seat keeps its room.
 await db.prepare(`DELETE FROM rooms WHERE ((status='waiting' AND updated<?) OR (status!='waiting' AND updated<?)) AND NOT EXISTS(SELECT 1 FROM sessions WHERE active_room=rooms.id AND seen>?)`).bind(now-86400000,now-604800000,now-120000).run();
 await db.prepare("DELETE FROM rooms WHERE status='abandoned' AND updated<? AND json_extract(state,'$.mode')='test'").bind(now-3600000).run();
 await db.prepare('UPDATE sessions SET active_room=NULL WHERE active_room IS NOT NULL AND NOT EXISTS(SELECT 1 FROM rooms WHERE id=active_room)').run();
 let list=await db.prepare("SELECT id,name,capacity,status,state FROM rooms WHERE coalesce(json_extract(state,'$.mode'),'standard')!='test' ORDER BY updated DESC LIMIT 80").all();
 for(const r of list.results)await load(db,r.id,now);
 session=await db.prepare('SELECT * FROM sessions WHERE id=?').bind(session.id).first();
 list=await db.prepare("SELECT id,name,capacity,status,state FROM rooms WHERE coalesce(json_extract(state,'$.mode'),'standard')!='test' ORDER BY updated DESC LIMIT 80").all();
 return reply({name:session.name,roomId:session.active_room,readOnly,rooms:list.results.map(r=>{const g=JSON.parse(r.state);return {id:r.id,name:r.name,capacity:r.capacity,status:r.status,count:g.seats.filter(s=>s.id).length,host:g.seats.find(s=>s.id===g.host)?.name??'Empty table'};})});}
 if(path==='/api/rooms'&&request.method==='POST'){
 need(!session.active_room,'You already have a seat. Resume or leave it first.',409);need(input.capacity===4||input.capacity===6,'Choose four or six players.');name(session.name);const existing=await db.prepare('SELECT COUNT(*) AS n FROM rooms WHERE updated>?').bind(now-86400000).first();need(existing.n<80,'The table list is full. Try later.',429);
 const recent=await db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE json_extract(state,'$.host')=? AND updated>?").bind(session.id,now-3600000).first();need(recent.n<8,'Please use an existing table for now.',429);
 const id=uuid(),title=name(input.name||`${session.name}’s table`,'Table name',48),g=room(id,title,input.capacity,session.id,session.name,now),mutation=uuid();
 const r=await db.batch([db.prepare('INSERT INTO rooms(id,name,capacity,status,state,version,mutation,updated) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE id=? AND active_room IS NULL)').bind(id,title,g.n,g.phase,JSON.stringify(g),0,mutation,now,session.id),db.prepare('UPDATE sessions SET active_room=? WHERE id=? AND EXISTS(SELECT 1 FROM rooms WHERE id=? AND mutation=?)').bind(id,session.id,id,mutation)]);need(r[0].meta.changes===1,'Another table already has your seat.',409);return reply({roomId:id});}
 if(path==='/api/test-rooms'&&request.method==='POST'){
 need(input.capacity===4||input.capacity===6,'Choose four or six players.');name(session.name);
 if(session.active_room){const current=await load(db,session.active_room,now);need(current.mode==='test'&&current.owner===session.id&&current.phase!=='abandoned','Leave your current table first.',409);return reply({roomId:current.id,replayed:true});}
 const id=await testRoomId(session.id),g=testRoom(id,input.capacity,session.id,session.name,now),mutation=uuid();const existing=await db.prepare('SELECT state FROM rooms WHERE id=?').bind(id).first();
 if(existing){const old=JSON.parse(existing.state);need(old.mode==='test'&&old.owner===session.id,'That test table cannot be reused.',409);if(old.phase!=='abandoned'){await db.prepare('UPDATE sessions SET active_room=? WHERE id=? AND active_room IS NULL').bind(id,session.id).run();return reply({roomId:id,replayed:true});}}
 await db.batch([db.prepare('INSERT OR IGNORE INTO rooms(id,name,capacity,status,state,version,mutation,updated) VALUES(?,?,?,?,?,?,?,?)').bind(id,g.name,g.n,g.phase,JSON.stringify(g),0,mutation,now),db.prepare("UPDATE rooms SET name=?,capacity=?,status=?,state=?,version=0,mutation=?,updated=? WHERE id=? AND status='abandoned'").bind(g.name,g.n,g.phase,JSON.stringify(g),mutation,now,id),db.prepare('UPDATE sessions SET active_room=? WHERE id=? AND active_room IS NULL').bind(id,session.id)]);
 const joined=await db.prepare('SELECT active_room FROM sessions WHERE id=?').bind(session.id).first();need(joined?.active_room===id,'Another table already has your seat.',409);return reply({roomId:id});}
 const match=path.match(/^\/api\/rooms\/([a-f0-9-]{36})(?:\/(join|action))?$/);need(match,'Not found.',404);const [,id,operation]=match;let g=await load(db,id,now);
 if(operation==='join'&&request.method==='POST'){
 if(session.active_room===id)return reply({roomId:id});need(g.mode!=='test','Test games are private to their owner.',403);need(!session.active_room,'Leave your current table first.',409);name(session.name);
 for(let i=0;i<5;i++){const expected=g.version;claim(g,session.id,session.name,now);g.version++;if(await persist(db,g,expected,uuid(),now,session.id,'join'))return reply({roomId:id});g=await load(db,id,now);session=await db.prepare('SELECT * FROM sessions WHERE id=?').bind(session.id).first();need(!session.active_room,'You already joined a table.',409);}throw new GameError('Table is busy. Try again.',409);}
 const isOnline=await online(db,g,now);
 if(!operation&&request.method==='GET'){need(session.active_room===id&&g.seats.some(s=>s.id===session.id),'Only seated players can access this table.',403);return reply({...view(g,session.id,isOnline,now),readOnly,serverTime:now});}
 need(operation==='action'&&request.method==='POST','Not found.',404);need(validID(input.actionId),'A unique action ID is required.');need(Number.isInteger(input.version),'A state version is required.');
 const fingerprint=JSON.stringify([input.type,input.matchId,input.handId,input.card??null,input.suit??null,input.gap??null,input.reviewId??null,input.epoch??null]);const previous=(g.receipts??[]).find(r=>r.id===input.actionId&&r.session===session.id);
 if(previous){need(input.type==='leave'||(session.active_room===id&&g.seats.some(s=>s.id===session.id)),'Your seat access ended.',403);need(previous.fingerprint===fingerprint,'Action ID already used for a different move.',409);return reply({accepted:true,replayed:true,roomId:input.type==='leave'?null:id});}
 need(session.active_room===id&&g.seats.some(s=>s.id===session.id),'Only seated players can access this table.',403);
 need(input.version===g.version,'The table changed. Resync and try again.',409);const expected=g.version;action(g,session.id,input,now,isOnline);g.version++;g.receipts=[...(g.receipts??[]),{id:input.actionId,session:session.id,fingerprint}].slice(-512);
 if(g.mode==='test'&&input.type==='leave'){const closed=await db.batch([db.prepare('DELETE FROM rooms WHERE id=? AND version=?').bind(id,expected),db.prepare('UPDATE sessions SET active_room=NULL WHERE id=? AND active_room=?').bind(session.id,id)]);need(closed[0].meta.changes===1,'Another action arrived first. Resync and try again.',409);return reply({accepted:true,roomId:null});}
 const saved=await persist(db,g,expected,input.actionId,now,session.id,input.type==='leave'?'leave':null);need(saved,'Another action arrived first. Resync and try again.',409);return reply({accepted:true,roomId:input.type==='leave'?null:id});
 }catch(e){return reply({error:e instanceof GameError?e.message:'The table could not save that request. Please retry.',resync:e.status===409},e instanceof GameError?e.status:500,extra);}}
const worker={fetch:handle};
export default worker;
