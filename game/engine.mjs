export const SUITS=['clubs','diamonds','hearts','spades'];
export const RANKS=['9','10','J','Q','K','A'];
export const POINTS={9:0,10:0,J:1,Q:2,K:3,A:4};
export const PACKET_MS=360, CONNECTION_MS=6000, GRACE_MS=10000;
export class GameError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export const need=(condition,message,status=400)=>{if(!condition)throw new GameError(message,status);};
export const card=id=>{const [suit,rank]=id.split(':');return {id,suit,rank};};
export const deck=()=>SUITS.flatMap(s=>RANKS.map(r=>`${s}:${r}`));
export function randomInt(n){const a=new Uint32Array(1),limit=4294967296-(4294967296%n);do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
export function shuffle(cards=deck(),rng=randomInt){const d=[...cards];for(let i=d.length-1;i>0;i--){const j=rng(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
export function cut(d,k){need(Number.isInteger(k)&&k>=1&&k<=23,'Choose a whole cut gap from 1 to 23.');return [...d.slice(k),...d.slice(0,k)];}
export function deal(d,n,dealer){const hands=Array.from({length:n},()=>[]);let pos=0;for(let packet=0;packet<2;packet++)for(let step=1;step<=n;step++){const seat=(dealer+step)%n;hands[seat].push(d[pos++],d[pos++]);}return {hands,remaining:d.slice(pos),proposed:n===4?d[pos]:hands[dealer][3]};}
export function legalCards(hand,trick,trump){if(!trick.length)return [...hand];const led=card(trick[0].card).suit;if(!hand.some(id=>card(id).suit===led))return [...hand];return hand.filter(id=>[led,trump].includes(card(id).suit));}
export function trickWinner(trick,trump){const led=card(trick[0].card).suit;const strength=id=>{const c=card(id);return (c.suit===trump?100:c.suit===led?50:0)+RANKS.indexOf(c.rank);};return trick.reduce((a,b)=>strength(b.card)>strength(a.card)?b:a).seat;}
export function tally(tricks){const totals=[0,0];for(const t of tricks)for(const p of t.cards)totals[t.winner%2]+=POINTS[card(p.card).rank];return totals;}
export function score(scores,totals,caller,bonus){if(totals[0]===totals[1])return {scores:[...scores],bonus:1,winner:null,delta:[0,0]};const winner=totals[0]>totals[1]?0:1,delta=[0,0];delta[winner]=1+(bonus?1:0);if(caller!==null&&caller%2!==winner)delta[caller%2]=-1;return {scores:scores.map((s,i)=>s+delta[i]),bonus:0,winner,delta};}
export function occupant(id,name,epoch=1){return {id,name,epoch,reconnectAt:null};}
export function room(id,name,n,session,username,now){return {schemaVersion:2,id,name,n,host:session,seats:[occupant(session,username)],phase:'waiting',version:0,matchId:null,handId:null,scores:[0,0],bonus:0,history:[],attempts:[],events:[],deadline:null,actor:null,dealer:null,hands:[],deck:[],trick:[],tricks:[],trump:null,caller:null,proposed:null,cutIndex:null,created:now};}
function event(g,type,now,details={}){g.events.push({id:crypto.randomUUID(),type,at:now,matchId:g.matchId,handId:g.handId,...details});g.events=g.events.slice(-32);}
function phase(g,p,now,delay=0,details={}){g.phase=p;g.deadline=delay?now+delay:null;event(g,p,now,details);}
export function upgrade(g,now){if(g.schemaVersion===2)return false;g.schemaVersion=2;g.seats=g.seats.map(s=>({...s,id:s.left?null:s.id,epoch:s.epoch??1,reconnectAt:null}));g.attempts??=[];
 // Historical scores are immutable. Active hands keep their allocation/actor; new decisions use confirmed rules.
 if(g.phase==='count'){g.reviewId=crypto.randomUUID();g.dismissed=[];g.deadline=null;}
 if(g.phase==='deal'){g.dealId=crypto.randomUUID();g.dealStart=now;g.deadline=now+g.n*2*PACKET_MS;}
 if(g.n===6&&g.phase==='trump2'){g.phase='trump1';g.passes=0;g.actor=(g.dealer+1)%g.n;}
 return true;}
export function ready(g,connected=()=>true){return g.seats.length===g.n&&g.seats.every(s=>s.id&&!s.reconnectAt&&connected(s.id));}
export function release(g,seat,now,connected=()=>true){const s=g.seats[seat],old=s.id;s.id=null;s.epoch=(s.epoch??1)+1;s.reconnectAt=null;s.left=true;if(g.host===old)g.host=g.seats.find(p=>p.id&&connected(p.id))?.id??null;event(g,'left',now,{seat,name:s.name,hostName:g.seats.find(p=>p.id&&p.id===g.host)?.name??null});return old;}
export function reconcilePresence(g,seen,now){let changed=false;const connected=id=>seen.has(id)&&now-seen.get(id)<CONNECTION_MS;
 for(let i=0;i<g.seats.length;i++){const s=g.seats[i];if(!s.id)continue;const last=seen.get(s.id)??g.created;
 if(now-last<CONNECTION_MS){if(s.reconnectAt){s.reconnectAt=null;changed=true;}}
 else{const expires=last+CONNECTION_MS+GRACE_MS;if(now>=expires){release(g,i,now,connected);changed=true;}else if(s.reconnectAt!==expires){s.reconnectAt=expires;changed=true;}}
 }
 if(!g.host){const host=g.seats.find(s=>s.id&&connected(s.id))?.id;if(host){g.host=host;changed=true;event(g,'host',now,{name:g.seats.find(s=>s.id===host).name});}}
 return changed;}
export function claim(g,session,username,now){need(!g.seats.some(s=>s.id&&s.name.toLocaleLowerCase('en-US')===username.toLocaleLowerCase('en-US')),'Choose a different username for this table.',409);let index=g.seats.findIndex(s=>!s.id);if(index<0){need(g.phase==='waiting'&&g.seats.length<g.n,'That table is full.',409);index=g.seats.length;g.seats.push(occupant(session,username));}else{const epoch=(g.seats[index].epoch??1)+1;g.seats[index]=occupant(session,username,epoch);}if(!g.host)g.host=session;event(g,'joined',now,{seat:index,name:username});return index;}
export function nextHand(g,now){g.handId=crypto.randomUUID();g.deck=shuffle();g.hands=Array.from({length:g.n},()=>[]);g.trick=[];g.tricks=[];g.trump=null;g.caller=null;g.proposed=null;g.cutIndex=null;g.passes=0;g.reviewId=null;g.dismissed=[];g.dealId=null;g.dealStart=null;g.actor=(g.dealer-1+g.n)%g.n;phase(g,'shuffle',now,650);}
function passed(g,now){g.attempts.push({handId:g.handId,dealer:g.dealer,status:'passed',at:now});g.attempts=g.attempts.slice(-80);g.bonus=1;event(g,'passed',now,{dealer:g.dealer});g.dealer=(g.dealer+1)%g.n;nextHand(g,now);}
export function delivered(g,seat,now){if(g.phase!=='deal')return g.hands[seat]?.length??0;const step=(seat-g.dealer-1+g.n)%g.n;let count=0;for(let lap=0;lap<2;lap++)if(now>=g.dealStart+(lap*g.n+step+1)*PACKET_MS)count+=2;return count;}
export function advance(g,now,connected=()=>true){if(!g.deadline||now<g.deadline)return false;
 if(g.phase==='shuffle'){if(!ready(g,connected))return false;phase(g,'cut',now);}
 else if(g.phase==='deal'){if(!ready(g,connected))return false;g.actor=(g.dealer+1)%g.n;phase(g,'trump1',now);}
 else if(g.phase==='collect'){g.trick=[];if(g.tricks.length===4){g.count=tally(g.tricks);const result=score(g.scores,g.count,g.caller,g.bonus);g.delta=result.delta;g.scores=result.scores;g.bonus=result.bonus;g.handWinner=result.winner;g.history.push({handId:g.handId,dealer:g.dealer,trump:g.trump,caller:g.caller,totals:g.count,delta:g.delta,scores:[...g.scores],tricks:structuredClone(g.tricks)});g.history=g.history.slice(-80);g.matchWinner=g.scores.findIndex(s=>s>=7);g.reviewId=crypto.randomUUID();g.dismissed=[];phase(g,'count',now);}else phase(g,'play',now);}
 else if(g.phase==='count'){if(g.matchWinner>=0){g.actor=null;phase(g,'complete',now);}else{if(!ready(g,connected))return false;g.dealer=(g.dealer+1)%g.n;nextHand(g,now);}}
 else return false;return true;}
export function action(g,session,a,now,connected=()=>true){const seat=g.seats.findIndex(s=>s.id===session);need(seat>=0,'You are not seated at this table.',403);const s=g.seats[seat];need(a.epoch===undefined||a.epoch===s.epoch,'Your seat occupant changed. Resync.',409);
 need(a.matchId===g.matchId&&a.handId===g.handId,'This hand changed. Resync and try again.',409);
 if(a.type==='leave'){release(g,seat,now,connected);return;}
 if(a.type==='dismiss'){need(g.phase==='count'&&a.reviewId===g.reviewId,'These results changed. Resync.',409);const key=`${seat}:${s.epoch}`;if(!g.dismissed.includes(key))g.dismissed.push(key);if(g.host===session&&g.deadline===null)g.deadline=now+5000;return;}
 need(ready(g,connected),'Waiting for a player to reconnect or a replacement to join.',409);
 if(a.type==='start'||a.type==='rematch'){need(g.phase===(a.type==='start'?'waiting':'complete'),'The match changed.',409);need(g.host===session,'Only the host can start.',403);g.matchId=crypto.randomUUID();g.scores=[0,0];g.bonus=0;g.history=[];g.attempts=[];g.matchWinner=-1;g.dealer=randomInt(g.n);nextHand(g,now);return;}
 need(seat===g.actor,'It is another player’s turn.',403);
 if(a.type==='cut'||a.type==='uncut'){need(g.phase==='cut','The deck is already finalized.',409);if(a.type==='cut')g.deck=cut(g.deck,a.gap);g.cutIndex=a.type==='cut'?a.gap:null;const d=deal(g.deck,g.n,g.dealer);g.hands=d.hands;g.deck=d.remaining;g.proposed=d.proposed;g.dealId=crypto.randomUUID();g.dealStart=now+1200;phase(g,'deal',now,1200+g.n*2*PACKET_MS);return;}
 if(a.type==='pass'||a.type==='trump'){need(['trump1','trump2'].includes(g.phase),'Trump decisions have ended.',409);
 if(a.type==='trump'){need(a.suit===card(g.proposed).suit,'Choose the proposed trump suit.');g.trump=a.suit;g.caller=seat;g.actor=(g.dealer+1)%g.n;phase(g,'play',now);}
 else{g.passes++;g.actor=(g.actor+1)%g.n;event(g,'pass',now,{seat});if(g.passes===g.n){g.passes=0;g.actor=(g.dealer+1)%g.n;if(g.n===4&&g.phase==='trump1'){g.proposed=g.deck[1];phase(g,'trump2',now);}else passed(g,now);}}return;}
 if(a.type==='play'){need(g.phase==='play','Wait for the next turn.',409);need(typeof a.card==='string'&&g.hands[seat].includes(a.card),'That card is not in your hand.');need(legalCards(g.hands[seat],g.trick,g.trump).includes(a.card),'You hold the led suit: follow it or play trump.');g.hands[seat]=g.hands[seat].filter(c=>c!==a.card);g.trick.push({seat,card:a.card,name:s.name});event(g,'card',now,{seat,card:a.card,name:s.name,actionId:a.actionId});if(g.trick.length===g.n){const winner=trickWinner(g.trick,g.trump);g.tricks.push({winner,cards:[...g.trick]});g.actor=winner;phase(g,'collect',now,900,{trickIndex:g.tricks.length-1,winner});}else g.actor=(seat+1)%g.n;return;}
 throw new GameError('Unknown action.');}
// Private projection is re-authorized on every request, never a cached channel grant.
export function view(g,session,online=()=>true,now=Date.now()){const seat=g.seats.findIndex(s=>s.id===session);need(seat>=0,'This room is private to its current occupants.',403);const {id,name,n,version,phase,matchId,handId,scores,bonus,actor,dealer,deadline,trump,caller,cutIndex,count,delta,handWinner,matchWinner,trick,tricks,history,events,attempts,reviewId,dealId,dealStart}=g;const tableReady=ready(g,online),reviewExpired=phase==='count'&&deadline!==null&&now>=deadline;return {id,name,n,version,phase,matchId,handId,scores,bonus,actor,dealer,deadline,trump,caller,proposed:phase==='deal'||phase==='shuffle'||phase==='cut'?null:g.proposed,cutIndex,count,delta,handWinner,matchWinner,trick,tricks,history,events,attempts,reviewId,dealId,dealStart,packetMs:PACKET_MS,reviewExpired,reviewDismissed:(g.dismissed??[]).includes(`${seat}:${g.seats[seat].epoch}`),tableReady,mySeat:seat,epoch:g.seats[seat].epoch,isHost:g.host===session,seats:g.seats.map((s,i)=>({seat:i,name:s.id?s.name:'Open seat',team:i%2,connected:!!s.id&&online(s.id),vacant:!s.id,reconnectAt:s.reconnectAt,cards:delivered(g,i,now),host:!!s.id&&s.id===g.host})),hand:[...(g.hands[seat]??[])].slice(0,delivered(g,seat,now)),legal:phase==='play'&&actor===seat&&tableReady?legalCards(g.hands[seat],trick,trump):[]};}
