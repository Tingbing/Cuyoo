/** Isolated HTTPS browser fixture using the actual built Worker and assets.
 * All sessions share real D1. No live database, mocked actions, or clock API.
 * Run after build; never use its synthetic state as a production backup.
 */
import {createRequire} from 'node:module';
import {readFile,readdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
const storage=await mkdtemp(join(tmpdir(),'cuyoo-browser-d1-'));
const modules=[];async function collect(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await collect(path);else if(e.name.endsWith('.js')||e.name.endsWith('.mjs'))modules.push({type:'ESModule',path:resolve(path)});}}await collect('dist/server');modules.sort((a,b)=>a.path.endsWith('/server/index.js')?-1:b.path.endsWith('/server/index.js')?1:0);
const mf=new Miniflare({modules,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'cuyoo-browser-fixture'},d1Persist:storage,assets:{directory:resolve('dist/client'),routerConfig:{has_user_worker:true},binding:'ASSETS'},https:true,host:'127.0.0.1',port:0});
const db=await mf.getD1Database('DB');
for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())await db.exec((await readFile('drizzle/'+file,'utf8')).replaceAll('--> statement-breakpoint','').replaceAll('\n',' '));
const url=await mf.ready;console.log(JSON.stringify({url:url.href,isolatedD1:true}));
process.on('SIGTERM',async()=>{await mf.dispose();await rm(storage,{recursive:true,force:true});process.exit();});
process.on('SIGINT',()=>process.emit('SIGTERM'));
export {mf,url,storage};
