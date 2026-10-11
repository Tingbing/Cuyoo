export const SUITS = ['clubs','diamonds','hearts','spades'];
export const RANKS = ['9','10','J','Q','K','A'];
export const POINTS = {9:0,10:0,J:1,Q:2,K:3,A:4};
// These are house-rule defaults, not confirmed extra rules.
export const DEFAULTS = {sixAllPass:'redeal-same-dealer', repeatedTies:'retain-one'};
export class GameError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const need = (condition,message,status=400) => {if(!condition) throw new GameError(message,status);};
export const card = id => {const [suit,rank]=id.split(':');return {id,suit,rank};};
export const deck = () => SUITS.flatMap(s=>RANKS.map(r=>`${s}:${r}`));
export function randomInt(n){const a=new Uint32Array(1), limit=4294967296-(4294967296%n);do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;}
export function shuffle(cards=deck(), rng=randomInt){const d=[...cards];for(let i=d.length-1;i>0;i--){const j=rng(i+1);[d[i],d[j]]=[d[j],d[i]];}return d;}
export function cut(d,k){need(Number.isInteger(k)&&k>=1&&k<=23,'Choose a whole cut gap from 1 to 23.');return [...d.slice(k),...d.slice(0,k)];}
export function deal(d,n,dealer){const hands=Array.from({length:n},()=>[]);let pos=0;for(let packet=0;packet<2;packet++)for(let step=1;step<=n;step++){const seat=(dealer+step)%n;hands[seat].push(d[pos++],d[pos++]);}return {hands,remaining:d.slice(pos),proposed:n===4?d[pos]:hands[dealer][3]};}
export function legalCards(hand,trick,trump){if(!trick.length)return [...hand];const led=card(trick[0].card).suit;const choices=hand.filter(id=>[led,trump].includes(card(id).suit));return choices.length?choices:[...hand];}
export function trickWinner(trick,trump){const led=card(trick[0].card).suit;const strength=id=>{const c=card(id);return (c.suit===trump?100:c.suit===led?50:0)+RANKS.indexOf(c.rank);};return trick.reduce((a,b)=>strength(b.card)>strength(a.card)?b:a).seat;}
export function tally(tricks){const totals=[0,0];for(const t of tricks)for(const p of t.cards)totals[t.winner%2]+=POINTS[card(p.card).rank];return totals;}
export function score(scores,totals,caller,bonus){if(totals[0]===totals[1])return {scores:[...scores],bonus:1,winner:null,delta:[0,0]};const winner=totals[0]>totals[1]?0:1, delta=[0,0];delta[winner]=1+bonus;if(caller!==null&&caller%2!==winner)delta[caller%2]=-1;return {scores:scores.map((s,i)=>s+delta[i]),bonus:0,winner,delta};}
export function room(id,name,n,session,username,now){return {id,name,n,host:session,seats:[{id:session,name:username}],phase:'waiting',version:0,matchId:null,handId:null,scores:[0,0],bonus:0,history:[],events:[],deadline:null,actor:null,dealer:null,hands:[],deck:[],trick:[],tricks:[],trump:null,caller:null,proposed:null,fallback:null,cutIndex:null,created:now};}
function event(g,type,now,details={}){g.events.push({id:crypto.randomUUID(),type,at:now,matchId:g.matchId,handId:g.handId,...details});g.events=g.events.slice(-32);}
function phase(g,p,now,delay=0,details={}){g.phase=p;g.deadline=delay?now+delay:null;event(g,p,now,details);}
export function nextHand(g,now){g.handId=crypto.randomUUID();g.deck=shuffle();g.hands=Array.from({length:g.n},()=>[]);g.trick=[];g.tricks=[];g.trump=null;g.caller=null;g.proposed=null;g.fallback=null;g.cutIndex=null;g.passes=0;g.actor=(g.dealer-1+g.n)%g.n;phase(g,'shuffle',now,650);}
export function advance(g,now){if(!g.deadline||now<g.deadline)return false;
 if(g.phase==='shuffle')phase(g,'cut',now);
 else if(g.phase==='deal'){g.actor=(g.dealer+1)%g.n;phase(g,'trump1',now);}
 else if(g.phase==='collect'){g.trick=[];if(g.tricks.length===4){g.count=tally(g.tricks);const result=score(g.scores,g.count,g.caller,g.bonus);g.delta=result.delta;g.scores=result.scores;g.bonus=result.bonus;g.handWinner=result.winner;g.history.push({handId:g.handId,dealer:g.dealer,trump:g.trump,caller:g.caller,totals:g.count,delta:g.delta,scores:[...g.scores],tricks:structuredClone(g.tricks)});g.history=g.history.slice(-80);g.matchWinner=g.scores.findIndex(s=>s>=7);phase(g,'count',now,2400);}else phase(g,'play',now);}
 else if(g.phase==='count'){if(g.matchWinner>=0){g.actor=null;phase(g,'complete',now);}else{g.dealer=(g.dealer+1)%g.n;nextHand(g,now);}}
 else return false;return true;
}
export function action(g,session,a,now,connected=()=>true){
 const seat=g.seats.findIndex(s=>s.id===session);need(seat>=0&&!g.seats[seat].left,'You are not seated at this table.',403);
 need(a.matchId===g.matchId&&a.handId===g.handId,'This hand changed. Resync and try again.',409);
 if(a.type==='start'){need(g.phase==='waiting','This match has already started.',409);need(g.host===session,'Only the host can start.',403);need(g.seats.length===g.n&&g.seats.every(s=>connected(s.id)),'Wait for every seat to connect.');g.matchId=crypto.randomUUID();g.dealer=randomInt(g.n);nextHand(g,now);return;}
 if(a.type==='rematch'){need(g.phase==='complete','Finish this match first.');need(g.host===session,'Only the host can offer a rematch.',403);need(g.seats.length===g.n&&g.seats.every(s=>!s.left&&connected(s.id)),'A rematch needs every original player. Create a new table if someone left.');g.matchId=crypto.randomUUID();g.scores=[0,0];g.bonus=0;g.history=[];g.matchWinner=-1;g.dealer=randomInt(g.n);nextHand(g,now);return;}
 if(a.type==='leave'){need(g.phase==='waiting'||g.phase==='complete','Your seat stays reserved during play. Reconnect on this device.');const departed=g.seats[seat].name;if(g.phase==='waiting')g.seats.splice(seat,1);else g.seats[seat].left=true;if(g.host===session)g.host=g.seats.find(s=>!s.left)?.id??null;event(g,'left',now,{name:departed,hostName:g.seats.find(s=>s.id===g.host)?.name??null});return;}
 need(seat===g.actor,'It is another player’s turn.',403);
 if(a.type==='cut'||a.type==='uncut'){need(g.phase==='cut','The deck is already finalized.',409);if(a.type==='cut')g.deck=cut(g.deck,a.gap);g.cutIndex=a.type==='cut'?a.gap:null;const d=deal(g.deck,g.n,g.dealer);g.hands=d.hands;g.deck=d.remaining;g.proposed=d.proposed;g.fallback=g.n===4?d.remaining.at(-1):null;phase(g,'deal',now,1000);return;}
 if(a.type==='pass'||a.type==='trump'){need(['trump1','trump2'].includes(g.phase),'Trump decisions have ended.',409);
 if(a.type==='trump'){const proposed=card(g.proposed).suit;need(SUITS.includes(a.suit)&&(g.phase==='trump1'?a.suit===proposed:a.suit!==proposed),'Choose a permitted trump suit.');g.trump=a.suit;g.caller=seat;g.actor=(g.dealer+1)%g.n;phase(g,'play',now);}
 else{g.passes++;g.actor=(g.actor+1)%g.n;event(g,'pass',now,{seat});if(g.passes===g.n){g.passes=0;g.actor=(g.dealer+1)%g.n;if(g.n===4){g.proposed=g.fallback;g.trump=card(g.fallback).suit;g.caller=null;phase(g,'play',now);}else if(g.phase==='trump1')phase(g,'trump2',now);else nextHand(g,now);}}return;}
 if(a.type==='play'){need(g.phase==='play','Wait for the next turn.',409);need(typeof a.card==='string'&&g.hands[seat].includes(a.card),'That card is not in your hand.');need(legalCards(g.hands[seat],g.trick,g.trump).includes(a.card),'Follow the led suit or play trump.');g.hands[seat]=g.hands[seat].filter(c=>c!==a.card);g.trick.push({seat,card:a.card});event(g,'card',now,{seat,card:a.card});if(g.trick.length===g.n){const winner=trickWinner(g.trick,g.trump);g.tricks.push({winner,cards:[...g.trick]});g.actor=winner;phase(g,'collect',now,900,{trickIndex:g.tricks.length-1,winner});}else g.actor=(seat+1)%g.n;return;}
 throw new GameError('Unknown action.');
}
// Whitelist projection. Raw durable game records NEVER leave the Worker.
export function view(g,session,online=()=>false){const seat=g.seats.findIndex(s=>s.id===session);need(seat>=0,'This room is private to its players.',403);const {id,name,n,version,phase,matchId,handId,scores,bonus,actor,dealer,deadline,trump,caller,proposed,cutIndex,count,delta,handWinner,matchWinner,trick,tricks,history,events}=g;return {id,name,n,version,phase,matchId,handId,scores,bonus,actor,dealer,deadline,trump,caller,proposed,cutIndex,count,delta,handWinner,matchWinner,trick,tricks,history,events,mySeat:seat,isHost:g.host===session,seats:g.seats.map((s,i)=>({seat:i,name:s.name,team:i%2,connected:online(s.id),cards:g.hands[i]?.length??0,host:s.id===g.host})),hand:phase==='deal'?[]:[...(g.hands[seat]??[])],legal:phase==='play'&&actor===seat?legalCards(g.hands[seat],trick,trump):[]};}
