// Simulation massive déterministe de la simulation tactique (22 joueurs).
// usage: node scripts/audit/ia/sim-mass.mjs [nbMatchs] [fps]
import {createTactical,stepTactical,resumeTactical,TACTICS} from '../../../dist/tactical.js';
const N=+process.argv[2]||200, DT=1/(+process.argv[3]||60);
export function playMatch(seed,{levels=[60,60],tactics=['equilibre','equilibre'],allowChances=false,dt=DT,position='BU',onTick}={}){
 const s=createTactical(seed,{levels,tactic:tactics[0],opponentTactic:tactics[1],allowChances,position});
 const st={goals:[0,0],shots:[0,0],ev:{},viol:{},maxStuckPoss:0,ticks:0,chances:0};
 let lastOwner=null,ownerSince=0;
 const bad=(k)=>{st.viol[k]=(st.viol[k]||0)+1;};
 for(let k=0;k<400000;k++){
  const e=stepTactical(s,dt);st.ticks++;
  if(e){st.ev[e.type]=(st.ev[e.type]||0)+1;if(e.type==='finish')break;
   if(e.type==='chance'){st.chances++;resumeTactical(s,[],s.random()<.3?'goal':'save',s.ball,s.owner.id);}}
  for(const p of s.players){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))bad('nan');else if(p.x<0||p.x>1||p.y<0||p.y>1)bad('outside');}
  if(!Number.isFinite(s.ball.x)||!Number.isFinite(s.ball.y))bad('ballnan');
  if(s.ball.x<0||s.ball.x>1||s.ball.y<0||s.ball.y>1)bad('ballout');
  if(s.owner!==lastOwner){lastOwner=s.owner;ownerSince=s.elapsed;}
  st.maxStuckPoss=Math.max(st.maxStuckPoss,s.elapsed-ownerSince);
  if(onTick)onTick(s,st);
 }
 st.s=s;st.goals=[...s.score];st.shots=[...s.shots];return st;
}
if(process.argv[1].endsWith('sim-mass.mjs')){
 const agg=(label,opts)=>{let g=[0,0],sh=[0,0],po=[0,0],pa=[0,0],off=[0,0],won=[0,0],ch=0,v={},stuck=0,zero=0,big=0;
  for(let i=1;i<=N;i++){const r=playMatch(i*7+1,opts);const s=r.s;for(const t of[0,1]){g[t]+=s.score[t];sh[t]+=s.shots[t];po[t]+=s.possession[t];pa[t]+=s.passes[t];off[t]+=s.offsides[t];won[t]+=s.won[t];}
   ch+=r.chances;for(const k in r.viol)v[k]=(v[k]||0)+r.viol[k];stuck=Math.max(stuck,r.maxStuckPoss);if(s.shots[0]+s.shots[1]===0)zero++;if(s.score[0]+s.score[1]>=8)big++;}
  const f=x=>(x/N).toFixed(2);
  console.log(label.padEnd(26),'buts',f(g[0]),f(g[1]),'tirs',f(sh[0]),f(sh[1]),'poss%',(100*po[0]/(po[0]+po[1])).toFixed(1),'passes',f(pa[0]),f(pa[1]),'hj',f(off[0]),f(off[1]),'won',f(won[0]),f(won[1]),'ch',f(ch),'0tir',zero,'>=8buts',big,'maxPoss(s)',stuck.toFixed(1),JSON.stringify(v));};
 agg('60 v 60',{});
 agg('80 v 40',{levels:[80,40]});agg('40 v 80',{levels:[40,80]});
 for(const a of Object.keys(TACTICS))for(const b of Object.keys(TACTICS))agg(`${a} vs ${b}`,{tactics:[a,b]});
 agg('chances ON',{allowChances:true});
}
