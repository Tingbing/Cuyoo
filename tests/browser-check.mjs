/** Real HTTPS/browser QA. Each seat has a fresh cookie-isolated BrowserContext.
 * Install Playwright locally and run: CUYOO_URL=https://your-site node tests/browser-check.mjs
 * Optional: PLAYWRIGHT_MODULE, CUYOO_CHROMIUM, CUYOO_PROXY_INSECURE=1 for managed proxy environments.
 * Never writes cookies, private network snapshots, or hidden card values to reports.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.CUYOO_URL;
assert(url&&new URL(url).protocol==='https:','Set CUYOO_URL to the actual isolated HTTPS test site.');
const out=resolve(process.env.CUYOO_QA_DIR||'docs/browser-evidence');
await mkdir(out,{recursive:true});
const launch={headless:true};
if(process.env.CUYOO_CHROMIUM)launch.executablePath=process.env.CUYOO_CHROMIUM;
if(process.env.HTTPS_PROXY){const u=new URL(process.env.HTTPS_PROXY);launch.proxy={server:u.origin,username:decodeURIComponent(u.username),password:decodeURIComponent(u.password)};}
const browser=await chromium.launch(launch);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reports=[];
async function read(page,id){for(let attempt=0;attempt<3;attempt++){try{return await page.evaluate(async room=>{const r=await fetch(`/api/rooms/${room}`,{headers:{'X-Client-Tab':sessionStorage.getItem('cuyoo-tab')},cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`Read failed: ${r.status}`);return r.json();},id);}catch(e){if(attempt===2||/Read failed: (401|403|404)/.test(e.message))throw e;await sleep(700);}}}
function sameHand(a,b){assert(a.length===b.length&&a.every((c,i)=>c===b[i]),'Private hand changed unexpectedly.');}
function privateView(g,n){for(const key of ['deck','hands','fallback','host','receipts','sessions'])assert(!(key in g),`Private key ${key} leaked`);assert.equal(g.seats.length,n);assert(!g.seats.some(s=>'id'in s));assert(g.hand.length<=4);}
async function noOverflow(p){const dims=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(dims.scroll<=dims.width+1,`Horizontal overflow: ${JSON.stringify(dims)}`);}
async function shot(p,n,phase){await p.screenshot({path:resolve(out,`${n}-${phase}.png`),fullPage:true,animations:phase.includes('count')||phase.includes('trick')?'disabled':'allow'});}
async function click(p,button){await button.waitFor({state:'visible',timeout:45000});await button.click({timeout:45000});}
async function act(p,button){for(let attempt=0;attempt<3;attempt++){const response=p.waitForResponse(r=>r.url().endsWith('/action')&&r.request().method()==='POST',{timeout:60000});response.catch(()=>{});try{await click(p,button);}catch(e){const state=await p.evaluate(()=>({status:document.querySelector('.turn-status')?.textContent,notices:[...document.querySelectorAll('.notice')].map(x=>x.textContent),phase:document.querySelector('.board')?.className,cards:document.querySelectorAll('.hand-card').length,legal:document.querySelectorAll('.hand-card.legal').length,enabled:document.querySelectorAll('.hand-card:enabled').length}));console.error('CONTROL DIAGNOSTIC',JSON.stringify(state));await p.screenshot({path:resolve(out,'control-failure.png'),fullPage:true});throw e;}const r=await response;const data=await r.json();if(r.status()===409&&data.resync){await sleep(1000);continue;}assert(r.ok(),`Browser action rejected: ${r.status()} ${data.error||''}`);return data;}throw new Error('UI did not resynchronize.');}
async function match(n){
 const started=Date.now(),tag=crypto.randomUUID().slice(0,6),title=`QA-Browser-${n}-${tag}`,contexts=[],pages=[],errors=[],phases=new Set(),flags=new Set(),visuals=Array.from({length:n},()=>new Set());
 let roomId,plays=0,moves=0;
 await Promise.all(Array.from({length:n+1},async(_,i)=>{
  const context=await browser.newContext({viewport:i===1?{width:390,height:844}:{width:1280,height:900},hasTouch:true,reducedMotion:i===n-1?'reduce':'no-preference',ignoreHTTPSErrors:process.env.CUYOO_PROXY_INSECURE==='1'});
  const p=await context.newPage();contexts[i]=context;pages[i]=p;
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource')&&!m.text().includes('net::'))errors.push(m.text());});p.on('response',r=>{if(r.request().method()==='POST'&&(!r.url().endsWith('/action')||r.status()!==200))console.log(JSON.stringify({browserMatch:n,seat:i,path:new URL(r.url()).pathname,status:r.status()}));});
  // Capture only public rendered phase names, not card identities.
  await p.addInitScript(()=>{window.__qaPhases=[];new MutationObserver(()=>{const b=document.querySelector('.board');if(b){const phase=[...b.classList].find(c=>c.startsWith('phase-'));if(phase&&!window.__qaPhases.includes(phase))window.__qaPhases.push(phase);}}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});});
  await p.goto(url,{waitUntil:'domcontentloaded'});await p.locator('#username').fill(`Browser${n}-${tag}-${i}`);console.log(JSON.stringify({browserMatch:n,seat:i,status:'lobby-loaded'}));
 }));
 await pages[0].locator('#room-name').fill(title);
 await click(pages[0],pages[0].getByRole('button',{name:new RegExp(`${n} players`)}));
 const created=pages[0].waitForResponse(r=>r.url().endsWith('/api/rooms')&&r.request().method()==='POST');created.catch(()=>{});
 await click(pages[0],pages[0].getByRole('button',{name:/Create game/}));
 roomId=(await (await created).json()).roomId;
 for(let i=1;i<n;i++){
  const row=pages[i].locator('.room-row').filter({hasText:title});await row.waitFor();
  await click(pages[i],row.getByRole('button',{name:/Join/}));
  await pages[i].locator('.game-shell').waitFor();
 }
 await pages[0].getByRole('button',{name:/Start game/}).waitFor();
 let g=await read(pages[0],roomId);assert.equal(g.phase,'waiting');assert.equal(g.seats.length,n);
 const extra=pages[n].locator('.room-row').filter({hasText:title});await extra.getByRole('button',{name:'Full',exact:true}).waitFor();assert(await extra.getByRole('button',{name:'Full',exact:true}).isDisabled());
 const identities=await Promise.all(contexts.slice(0,n).map(async c=>(await c.cookies()).find(x=>x.name==='cuyoo_device')?.value));assert(identities.every(Boolean));assert.equal(new Set(identities).size,n);
 for(let i=0;i<n;i++){const v=await read(pages[i],roomId);privateView(v,n);assert.equal(v.mySeat,i);assert.deepEqual(v.seats.map(s=>[s.name,s.team]),g.seats.map(s=>[s.name,s.team]));await noOverflow(pages[i]);if(i>0)assert.equal(await pages[i].getByRole('button',{name:/Start game/}).count(),0);}
 // Same identity is a viewer, not a second seat.
 const duplicate=await contexts[0].newPage();await duplicate.goto(url);await duplicate.getByText('Another tab controls this device.',{exact:false}).waitFor();assert((await read(duplicate,roomId)).readOnly);await duplicate.close();
 await shot(pages[1],n,'mobile-waiting');await shot(pages[0],n,'desktop-waiting');
 await act(pages[0],pages[0].getByRole('button',{name:/Start game/}));
 const unauthorized=await pages[n].evaluate(async id=>(await fetch(`/api/rooms/${id}`,{headers:{'X-Client-Tab':sessionStorage.getItem('cuyoo-tab')}})).status,roomId);assert.equal(unauthorized,403);
 const firstMatch=(await read(pages[0],roomId)).matchId;
 const firstDealer=(await read(pages[0],roomId)).dealer;
 console.log(JSON.stringify({browserMatch:n,roomId,status:'started',independentContexts:n}));
 const deadline=Date.now()+40*60*1000;
 while(Date.now()<deadline){
  g=await read(pages[0],roomId);privateView(g,n);phases.add(g.phase);
  for(let i=0;i<n;i++)for(const phase of await pages[i].evaluate(()=>window.__qaPhases||[]))visuals[i].add(phase.replace('phase-',''));
  if(g.phase==='complete')break;
  if(process.env.CUYOO_VISUAL_ONLY==='1'&&g.phase==='count'){await pages[1].locator('.board.phase-count').waitFor();await noOverflow(pages[1]);await shot(pages[1],n,'actual-mobile-count');for(let team=0;team<2;team++)assert.equal(await pages[1].locator('.count-row strong').nth(team).textContent(),`${g.count[team]} card points`);const counts=await pages[1].locator('.point-card').count();assert.equal(counts,n*4);const summary={players:n,roomId,visualOnly:true,counts:g.count,delta:g.delta,countCards:counts,verified:true};reports.push(summary);await writeFile(resolve(out,`visual-result-${n}.json`),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));for(const c of contexts)await c.close();return;}
  if(g.phase==='shuffle'||g.phase==='deal'){await sleep(200);continue;}
  if(g.phase==='collect'||g.phase==='count'){
   if(!flags.has(g.phase)){flags.add(g.phase);await pages[1].locator(`.board.phase-${g.phase}`).waitFor();if(g.phase==='count'){await noOverflow(pages[1]);for(let team=0;team<2;team++)assert.equal(await pages[1].locator('.count-row strong').nth(team).textContent(),`${g.count[team]} card points`);assert.equal(await pages[1].locator('.point-card').count(),n*4);}await shot(pages[1],n,`mobile-${g.phase}`);await pages[0].reload();assert.equal((await read(pages[0],roomId)).matchId,firstMatch);if(g.phase==='count'){const after=await read(pages[0],roomId);assert.equal(after.history.filter(h=>h.handId===g.handId).length,1);}}
   await sleep(200);continue;
  }
  const p=pages[g.actor];assert(p,'No acting browser');
  if(g.phase==='play'&&g.trick.length===0){for(let i=0;i<n;i++){const v=await read(pages[i],roomId);privateView(v,n);assert.equal(v.version,g.version);assert.deepEqual(v.trick,g.trick);assert.deepEqual(v.scores,g.scores);assert.equal(v.actor,g.actor);assert.equal(v.trump,g.trump);}}
  if(g.phase==='cut'){
   if(!flags.has('cut')){flags.add('cut');await p.reload();const restored=await read(p,roomId);assert.equal(restored.mySeat,g.actor);assert.equal(restored.handId,g.handId);
    const slider=p.getByRole('slider');await slider.waitFor();await slider.focus();const before=Number(await slider.inputValue());await slider.press('ArrowRight');assert.equal(Number(await slider.inputValue()),Math.min(before+1,23));
    const b=await slider.boundingBox();await p.touchscreen.tap(b.x+b.width*.3,b.y+b.height/2);assert(Number(await slider.inputValue())>=1&&Number(await slider.inputValue())<=23);await shot(p,n,'cut');
    for(let i=0;i<n;i++)if(i!==g.actor)assert.equal(await pages[i].getByRole('slider').count(),0);
   }
   await act(p,p.getByRole('button',{name:g.history.length%2?/Leave deck as-is/:/Confirm cut/}));moves++;
  }else if(g.phase==='trump1'||g.phase==='trump2'){
   if(!flags.has('trump-decision')){flags.add('trump-decision');const prior=await read(p,roomId);await p.reload();sameHand((await read(p,roomId)).hand,prior.hand);}
   // Exercise four-player automatic fallback and six-player second round on hand one.
   const pass=(g.history.length===0&&g.phase==='trump1')||g.actor%2===1;
   await act(p,p.getByRole('button',{name:pass?'Pass':/^.*Play (clubs|diamonds|hearts|spades)$/}).first());moves++;if(!pass&&!flags.has('caller')){flags.add('caller');const before=await read(p,roomId);assert.equal(before.caller,g.actor);await p.reload();sameHand((await read(p,roomId)).hand,before.hand);}
  }else if(g.phase==='play'){
   if(!flags.has('play')&&process.env.CUYOO_VISUAL_ONLY!=='1'){
    flags.add('play');const before=await read(p,roomId);await p.reload();const after=await read(p,roomId);sameHand(after.hand,before.hand);assert.equal(after.mySeat,before.mySeat);
    const other=pages[(g.actor+1)%n];const prior=await read(other,roomId);await other.reload();sameHand((await read(other,roomId)).hand,prior.hand);
    await noOverflow(pages[1]);await pages[1].setViewportSize({width:320,height:700});await noOverflow(pages[1]);await shot(pages[1],n,'mobile-play-320');await pages[1].setViewportSize({width:390,height:844});
    // Offline active actor keeps seat/hand and announces reconnection; no AI move.
    await contexts[g.actor].setOffline(true);await p.getByText('Reconnecting…',{exact:false}).waitFor({timeout:10000});await sleep(1100);await contexts[g.actor].setOffline(false);await p.getByText('Reconnecting…',{exact:false}).waitFor({state:'hidden',timeout:10000});const recovered=await read(p,roomId);sameHand(recovered.hand,before.hand);assert.deepEqual(recovered.scores,before.scores);assert.equal(recovered.actor,g.actor);
    // Explicit host loss is presence-only and cannot appoint a replacement.
    await contexts[0].setOffline(true);await sleep(22000);const hostAway=await read(pages[1],roomId);assert.equal(hostAway.seats[0].connected,false);assert(hostAway.seats[0].host);assert.equal(hostAway.seats.length,n);await contexts[0].setOffline(false);await pages[0].getByText('Reconnecting…',{exact:false}).waitFor({state:'hidden',timeout:10000});assert.equal((await read(pages[0],roomId)).mySeat,0);
    await shot(pages[0],n,'desktop-play');
   }
   if(g.trick.length===n-1&&!flags.has('spacing')){flags.add('spacing');await sleep(350);const phone=pages[1];await phone.setViewportSize({width:320,height:700});await noOverflow(phone);const bounds=await phone.locator('.played').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};}));for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j],dx=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),dy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);assert(!(dx>2&&dy>2),`Played cards/labels overlap on phone: ${dx} by ${dy}`);}await shot(phone,n,'mobile-trick-320');await phone.setViewportSize({width:390,height:844});}
   if(!flags.has('retry')&&process.env.CUYOO_VISUAL_ONLY!=='1'){
    flags.add('retry');let first=true;const actionIds=[];const before=await read(p,roomId);
    await p.route('**/api/rooms/*/action',async route=>{const body=route.request().postDataJSON();actionIds.push(body.actionId);const response=await route.fetch();if(first){first=false;await sleep(12000);}try{await route.fulfill({response});}catch{/* The original timed-out browser request is intentionally gone. */}});
    await act(p,p.locator('.hand-card.legal:enabled').first());await p.unroute('**/api/rooms/*/action');
    const after=await read(p,roomId);assert.equal(after.hand.length,before.hand.length-1);assert.equal(after.trick.length,before.trick.length+1);assert(actionIds.length>=2);assert.equal(new Set(actionIds).size,1,'Lost-response retry must reuse the intention ID');
   }else await act(p,p.locator('.hand-card.legal:enabled').first());plays++;moves++;
  }else throw new Error(`Unexpected phase ${g.phase}`);
  if(moves%40===0)console.log(JSON.stringify({browserMatch:n,plays,hands:g.history.length,scores:g.scores,status:'playing'}));
  // Read-only observation checks after real DOM interactions, avoiding stale UI actions.
  await sleep(100);
 }
 assert.equal(g.phase,'complete','Browser match exceeded time budget');assert(g.scores.some(x=>x>=7));
 for(let i=0;i<n;i++){await pages[i].locator('.board.phase-complete').waitFor();let v=await read(pages[i],roomId);assert.deepEqual(v.scores,g.scores);assert.equal(v.phase,'complete');assert.equal(v.hand.length,0);privateView(v,n);await noOverflow(pages[i]);}
 await shot(pages[0],n,'complete');await act(pages[0],pages[0].getByRole('button',{name:/Deal a rematch/}));
 const rematch=await read(pages[0],roomId);assert.notEqual(rematch.matchId,firstMatch);assert.deepEqual(rematch.scores,[0,0]);assert.equal(rematch.bonus,0);assert.equal(rematch.history.length,0);assert(Number.isInteger(rematch.dealer)&&rematch.dealer>=0&&rematch.dealer<n);
 assert.deepEqual(errors,[],'Uncaught browser application errors');
 const required=['shuffle','cut','deal','trump1','play','collect','count','complete'];
 for(let i=0;i<n;i++){for(const x of await pages[i].evaluate(()=>window.__qaPhases||[]))visuals[i].add(x.replace('phase-',''));for(const phase of required)assert(visuals[i].has(phase),`Seat ${i} missed visual ${phase}`);}
 const report={players:n,roomId,independentContexts:n,plays,hands:g.history.length,scores:g.scores,seconds:Math.round((Date.now()-started)/1000),firstDealer,rematchDealer:rematch.dealer,rematchReset:true,refreshPhases:[...flags],renderedPhases:visuals.map(x=>[...x]),phoneWidths:[320,390],uncaughtErrors:errors.length,reducedMotionSeat:n-1,verified:true};reports.push(report);await writeFile(resolve(out,`result-${n}.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 for(const c of contexts)await c.close();
}
try{await Promise.all([match(4),match(6)]);await writeFile(resolve(out,'results.json'),JSON.stringify({url,at:new Date().toISOString(),browserVersion:browser.version(),reports},null,2)+'\n');}catch(e){console.error('BROWSER QA FAILED:',e.message);throw e;}finally{await browser.close();}
