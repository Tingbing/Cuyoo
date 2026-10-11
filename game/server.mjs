import {room,action,advance,view,need,GameError} from './engine.mjs';
const COOKIE='cuyoo_device';
const uuid=()=>crypto.randomUUID();
const validID=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
function name(s,label='Username',max=24){need(typeof s==='string',`${label} is required.`);const v=s.trim().normalize('NFKC');need(v.length>=2&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v),`${label} must be 2–${max} readable characters.`);return v;}
const reply=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
async function online(db,g,now){const rows=await db.prepare('SELECT id,seen FROM sessions WHERE active_room = ?').bind(g.id).all();const ids=new Set(rows.results.filter(s=>now-s.seen<20000).map(s=>s.id));return id=>ids.has(id);}
async function persist(db,g,expected,mutation,now,session=null,mode=null){const query=db.prepare(`UPDATE rooms SET state=?,version=?,status=?,mutation=?,updated=? WHERE id=? AND version=?${mode==='join'?" AND EXISTS (SELECT 1 FROM sessions WHERE id=? AND (active_room IS NULL OR active_room=?))":''}`).bind(JSON.stringify(g),g.version,g.phase,mutation,now,g.id,expected,...(mode==='join'?[session,g.id]:[]));
 if(!mode){const r=await query.run();return r.meta.changes===1;}
 const membership=db.prepare(`UPDATE sessions SET active_room=? WHERE id=? AND EXISTS(SELECT 1 FROM rooms WHERE id=? AND mutation=?)`).bind(mode==='leave'?null:g.id,session,g.id,mutation);
 const r=await db.batch([query,membership]);return r[0].meta.changes===1;
}
async function load(db,id,now){for(let i=0;i<5;i++){const row=await db.prepare('SELECT state,version FROM rooms WHERE id=?').bind(id).first();need(row,'That table is no longer available.',404);const g=JSON.parse(row.state);if(!advance(g,now))return g;g.version=row.version+1;if(await persist(db,g,row.version,uuid(),now))return g;}throw new GameError('Table updated. Try again.',409);}
export async function handle(request,env){let extra={};try{
 need(env.DB,'The dedicated game database is unavailable.',503);const db=env.DB,now=Date.now(),u=new URL(request.url),path=u.pathname;
 need(path.startsWith('/api/'),'Not found.',404);need(['GET','POST'].includes(request.method),'Method not allowed.',405);
 if(request.method==='POST'){need(request.headers.get('origin')===u.origin,'Use this table’s website to submit actions.',403);need((request.headers.get('content-type')??'').startsWith('application/json'),'Send JSON.');}
 let input={};if(request.method==='POST'){const raw=await request.text();need(raw.length<=2048,'Request is too large.',413);try{input=JSON.parse(raw);}catch{throw new GameError('Invalid JSON.');}need(input&&typeof input==='object'&&!Array.isArray(input),'Invalid request.');}
 const token=(request.headers.get('cookie')??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 let session=token&&/^[a-f0-9]{64}$/.test(token)?await db.prepare('SELECT * FROM sessions WHERE id=?').bind(await hash(token)).first():null;
 const tab=request.headers.get('x-client-tab');need(validID(tab),'Open the game in a browser tab.');
 if(path==='/api/session'&&request.method==='POST'){
 if(!session){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);const t=Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('');const id=await hash(t);await db.prepare('INSERT INTO sessions(id,name,seen,created,controller,lease) VALUES(?,?,?,?,?,?)').bind(id,input.name?name(input.name):'',now,now,tab,now).run();session=await db.prepare('SELECT * FROM sessions WHERE id=?').bind(id).first();extra['Set-Cookie']=`${COOKIE}=${t}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`;}
 else if(input.name!==undefined){need(!session.active_room,'Leave your table before changing your username.');const next=name(input.name);await db.prepare('UPDATE sessions SET name=? WHERE id=? AND active_room IS NULL').bind(next,session.id).run();session.name=next;}
 return reply({name:session.name,roomId:session.active_room},200,extra);}
 need(session,'Your device session expired. Reload to reconnect.',401);
 // A short database-backed controller lease makes other tabs read-only.
 await db.prepare('UPDATE sessions SET seen=?,controller=?,lease=? WHERE id=? AND (controller=? OR lease<? OR controller IS NULL)').bind(now,tab,now,session.id,tab,now-15000).run();
 session=await db.prepare('SELECT * FROM sessions WHERE id=?').bind(session.id).first();const readOnly=session.controller!==tab;
 if(request.method==='POST'){
 need(!readOnly,'Another tab controls this device. Close it and wait 15 seconds.',409);
 const rate=await db.prepare('UPDATE sessions SET rate_count=CASE WHEN rate_at<? THEN 1 ELSE rate_count+1 END, rate_at=CASE WHEN rate_at<? THEN ? ELSE rate_at END WHERE id=? RETURNING rate_count').bind(now-60000,now-60000,now,session.id).first();need(rate.rate_count<=180,'Too many requests. Wait a minute.',429);}
 if(path==='/api/lobby'&&request.method==='GET'){
 // 24h unattended waiting rooms; 7d abandoned games. A connected seat keeps its room.
 await db.prepare(`DELETE FROM rooms WHERE ((status='waiting' AND updated<?) OR (status!='waiting' AND updated<?)) AND NOT EXISTS(SELECT 1 FROM sessions WHERE active_room=rooms.id AND seen>?)`).bind(now-86400000,now-604800000,now-120000).run();
 await db.prepare('UPDATE sessions SET active_room=NULL WHERE active_room IS NOT NULL AND NOT EXISTS(SELECT 1 FROM rooms WHERE id=active_room)').run();
 const list=await db.prepare('SELECT id,name,capacity,status,state FROM rooms ORDER BY updated DESC LIMIT 80').all();
 return reply({name:session.name,roomId:session.active_room,readOnly,rooms:list.results.map(r=>{const g=JSON.parse(r.state);return {id:r.id,name:r.name,capacity:r.capacity,status:r.status,count:g.seats.length,host:g.seats.find(s=>s.id===g.host)?.name??'Empty table'};})});}
 if(path==='/api/rooms'&&request.method==='POST'){
 need(!session.active_room,'You already have a seat. Resume or leave it first.',409);need(input.capacity===4||input.capacity===6,'Choose four or six players.');name(session.name);const existing=await db.prepare('SELECT COUNT(*) AS n FROM rooms WHERE updated>?').bind(now-86400000).first();need(existing.n<80,'The table list is full. Try later.',429);
 const recent=await db.prepare("SELECT COUNT(*) AS n FROM rooms WHERE json_extract(state,'$.host')=? AND updated>?").bind(session.id,now-3600000).first();need(recent.n<8,'Please use an existing table for now.',429);
 const id=uuid(),title=name(input.name||`${session.name}’s table`,'Table name',48),g=room(id,title,input.capacity,session.id,session.name,now),mutation=uuid();
 const r=await db.batch([db.prepare('INSERT INTO rooms(id,name,capacity,status,state,version,mutation,updated) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions WHERE id=? AND active_room IS NULL)').bind(id,title,g.n,g.phase,JSON.stringify(g),0,mutation,now,session.id),db.prepare('UPDATE sessions SET active_room=? WHERE id=? AND EXISTS(SELECT 1 FROM rooms WHERE id=? AND mutation=?)').bind(id,session.id,id,mutation)]);need(r[0].meta.changes===1,'Another table already has your seat.',409);return reply({roomId:id});}
 const match=path.match(/^\/api\/rooms\/([a-f0-9-]{36})(?:\/(join|action))?$/);need(match,'Not found.',404);const [,id,operation]=match;let g=await load(db,id,now);
 if(operation==='join'&&request.method==='POST'){
 if(session.active_room===id)return reply({roomId:id});need(!session.active_room,'Leave your current table first.',409);name(session.name);
 for(let i=0;i<5;i++){need(g.phase==='waiting','That match has already started.',409);need(g.seats.length<g.n,'That table is full.',409);need(!g.seats.some(s=>s.name.toLocaleLowerCase('en-US')===session.name.toLocaleLowerCase('en-US')),'Choose a different username for this table.',409);const expected=g.version;g.seats.push({id:session.id,name:session.name});g.version++;if(await persist(db,g,expected,uuid(),now,session.id,'join'))return reply({roomId:id});g=await load(db,id,now);session=await db.prepare('SELECT * FROM sessions WHERE id=?').bind(session.id).first();need(!session.active_room,'You already joined a table.',409);}throw new GameError('Table is busy. Try again.',409);}
 const isOnline=await online(db,g,now);
 if(!operation&&request.method==='GET'){need(session.active_room===id&&g.seats.some(s=>s.id===session.id),'Only seated players can access this table.',403);return reply({...view(g,session.id,isOnline),readOnly,serverTime:now});}
 need(operation==='action'&&request.method==='POST','Not found.',404);need(validID(input.actionId),'A unique action ID is required.');need(Number.isInteger(input.version),'A state version is required.');
 const fingerprint=JSON.stringify([input.type,input.matchId,input.handId,input.card??null,input.suit??null,input.gap??null]);const previous=(g.receipts??[]).find(r=>r.id===input.actionId&&r.session===session.id);
 if(previous){need(previous.fingerprint===fingerprint,'Action ID already used for a different move.',409);return reply({accepted:true,replayed:true,roomId:input.type==='leave'?null:id});}
 need(session.active_room===id&&g.seats.some(s=>s.id===session.id),'Only seated players can access this table.',403);
 need(input.version===g.version,'The table changed. Resync and try again.',409);const expected=g.version;action(g,session.id,input,now,isOnline);g.version++;g.receipts=[...(g.receipts??[]),{id:input.actionId,session:session.id,fingerprint}].slice(-512);
 const saved=await persist(db,g,expected,input.actionId,now,session.id,input.type==='leave'?'leave':null);need(saved,'Another action arrived first. Resync and try again.',409);return reply({accepted:true,roomId:input.type==='leave'?null:id});
 }catch(e){return reply({error:e instanceof GameError?e.message:'The table could not save that request. Please retry.',resync:e.status===409},e instanceof GameError?e.status:500,extra);}}
const worker={fetch:handle};
export default worker;
