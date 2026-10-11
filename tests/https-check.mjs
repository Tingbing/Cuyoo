// Live backend verification. Run only against the isolated Cuyoo test deployment.
// No admin endpoints, hidden cards or credentials are written to output.
import assert from 'node:assert/strict';
const origin=process.argv[2]?.replace(/\/$/,'');assert.ok(origin?.startsWith('https://'),'An HTTPS Cuyoo origin is required.');
const results=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function api(c,path,body,expected=200){const res=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{origin,'content-type':'application/json','x-client-tab':c.tab,...(c.cookie?{cookie:c.cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const cookies=res.headers.getSetCookie();if(cookies.length){const jar=new Map(c.cookie.split('; ').filter(Boolean).map(p=>[p.split('=')[0],p]));for(const value of cookies){const part=value.split(';')[0];jar.set(part.split('=')[0],part);}c.cookie=[...jar.values()].join('; ');}const data=await res.json();assert.equal(res.status,expected,JSON.stringify(data));return data;}
async function act(c,id,g,type,payload={},expected=200){const a={type,actionId:crypto.randomUUID(),version:g.version,matchId:g.matchId,handId:g.handId,...payload};return api(c,`rooms/${id}/action`,a,expected);}
for(const n of [4,6]){
 const clients=Array.from({length:n},()=>({tab:crypto.randomUUID(),cookie:''})),prefix='QA-'+crypto.randomUUID().slice(0,6),started=Date.now();
 for(let i=0;i<n;i++)await api(clients[i],'session',{name:`${prefix}-${i}`});
 const {roomId:id}=await api(clients[0],'rooms',{capacity:n,name:`${prefix} synthetic ${n}P`});
 for(const c of clients.slice(1))await api(c,`rooms/${id}/join`,{});
 for(const c of clients){const lobby=await api(c,'lobby');assert.equal(lobby.rooms.find(r=>r.id===id).count,n);}
 let g=await api(clients[0],'rooms/'+id);assert.equal(g.phase,'waiting');await act(clients[1],id,g,'start',{},403);await act(clients[0],id,g,'start');
 let moves=0,checks=0;
 while(Date.now()-started<1200000){
 const views=await Promise.all(clients.map(c=>api(c,'rooms/'+id)));g=views[0];if(g.phase==='complete')break;
 // Requests can span a timestamp transition; compare only snapshots with the same version.
 for(const v of views){assert.ok(!('deck' in v)&&!('hands' in v)&&!('receipts' in v));assert.ok(v.seats.every(s=>!('id' in s)));if(v.version===g.version){assert.deepEqual(v.scores,g.scores);assert.deepEqual(v.trick,g.trick);assert.equal(v.actor,g.actor);}}
 if(['shuffle','deal','collect','count'].includes(g.phase)){await wait(180);continue;}
 const actor=clients[g.actor],v=views[g.actor];if(v.version!==g.version)continue;
 try{if(g.phase==='cut')await act(actor,id,v,'cut',{gap:12});
 else if(['trump1','trump2'].includes(g.phase)){if(g.actor%2===1)await act(actor,id,v,'pass');else await act(actor,id,v,'trump',{suit:g.phase==='trump1'?g.proposed.split(':')[0]:['clubs','diamonds','hearts','spades'].find(s=>s!==g.proposed.split(':')[0])});}
 else if(g.phase==='play'){assert.ok(v.legal.length);if(checks++===0){const other=clients[(g.actor+1)%n];await act(other,id,v,'play',{card:v.legal[0]},403);const alternate={...actor,tab:crypto.randomUUID()};assert.equal((await api(alternate,'rooms/'+id)).readOnly,true);await act(alternate,id,v,'play',{card:v.legal[0]},409);}
 await act(actor,id,v,'play',{card:v.legal[0]});moves++;}else assert.fail('Unknown phase '+g.phase);}catch(e){if(!e.message.includes('409'))throw e;}
 }
 assert.equal(g.phase,'complete','Match exceeded live test time budget.');assert.ok(g.scores.some(s=>s>=7));const completed={mode:n,hands:g.history.length,moves,seconds:Math.round((Date.now()-started)/1000),scores:g.scores};await act(clients[0],id,g,'rematch');const fresh=await api(clients[0],'rooms/'+id);assert.notEqual(fresh.matchId,g.matchId);assert.deepEqual(fresh.scores,[0,0]);
 // Identify and delete only these synthetic records via the dedicated database admin after testing.
 results.push({...completed,syntheticRoom:id});console.log(JSON.stringify({completed:results.at(-1)}));
}
console.log(JSON.stringify({verified:true,results}));
