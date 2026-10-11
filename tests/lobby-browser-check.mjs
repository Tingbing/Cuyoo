import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.CUYOO_URL;assert(url&&new URL(url).protocol==='https:');
const launch={headless:true,...(process.env.CUYOO_CHROMIUM?{executablePath:process.env.CUYOO_CHROMIUM}:{})};
if(process.env.HTTPS_PROXY){const u=new URL(process.env.HTTPS_PROXY);launch.proxy={server:u.origin,username:decodeURIComponent(u.username),password:decodeURIComponent(u.password)};}
const browser=await chromium.launch(launch),contexts=[],pages=[],title=`QA-HostTransfer-${crypto.randomUUID().slice(0,6)}`;
const read=(p,id)=>p.evaluate(async room=>{const r=await fetch(`/api/rooms/${room}`,{headers:{'X-Client-Tab':sessionStorage.getItem('cuyoo-tab')}});return {status:r.status,body:await r.json()};},id);
async function action(p,button,path){for(let attempt=0;attempt<3;attempt++){const response=p.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='POST',{timeout:60000});response.catch(()=>{});await button.click({timeout:45000});const r=await response;const data=await r.json();if(r.status()===409&&data.resync){await p.waitForTimeout(1000);continue;}assert(r.ok(),`UI request ${path} failed: ${r.status()} ${data.error||''}`);return data;}throw new Error('UI did not resynchronize.');}
try{
 await Promise.all([0,1,2].map(async i=>{const c=await browser.newContext({viewport:{width:390,height:844},ignoreHTTPSErrors:process.env.CUYOO_PROXY_INSECURE==='1'});const p=await c.newPage();contexts[i]=c;pages[i]=p;await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('#username').fill(`HostQA-${i}-${title.slice(-6)}`);}));
 await pages[0].locator('#room-name').fill(title);
 const created=await action(pages[0],pages[0].getByRole('button',{name:/Create game/}),'/api/rooms'),id=created.roomId;
 await action(pages[1],pages[1].locator('.room-row').filter({hasText:title}).getByRole('button',{name:/Join/}),`/api/rooms/${id}/join`);
 let g=(await read(pages[0],id)).body;assert.equal(g.phase,'waiting');assert.equal(g.seats.length,2);assert(g.seats[0].host);assert(await pages[0].getByRole('button',{name:/Start game/}).isDisabled());
 await action(pages[0],pages[0].getByRole('button',{name:/Leave table/}),`/api/rooms/${id}/action`);
 assert.equal((await read(pages[0],id)).status,403);g=(await read(pages[1],id)).body;assert(g.isHost);assert.equal(g.seats.length,1);assert.equal(g.mySeat,0);
 await pages[1].getByRole('button',{name:/Start game/}).waitFor();assert(await pages[1].getByRole('button',{name:/Start game/}).isDisabled());
 await mkdir('docs/browser-evidence',{recursive:true});await pages[1].screenshot({path:'docs/browser-evidence/host-transfer.png',fullPage:true});
 await action(pages[1],pages[1].getByRole('button',{name:/Leave table/}),`/api/rooms/${id}/action`);
 await action(pages[2],pages[2].locator('.room-row').filter({hasText:title}).getByRole('button',{name:/Join/}),`/api/rooms/${id}/join`);
 g=(await read(pages[2],id)).body;assert(g.isHost);assert.equal(g.seats.length,1);assert.equal(g.mySeat,0);
 await action(pages[2],pages[2].getByRole('button',{name:/Leave table/}),`/api/rooms/${id}/action`);
 const report={roomId:id,hostTransfer:true,emptyLobbyNextHost:true,departedReadRejected:true,allSyntheticSeatsLeft:true,verified:true};await writeFile('docs/browser-evidence/lobby-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{for(const c of contexts)await c.close();await browser.close();}
