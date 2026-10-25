// Lot 12 · ia : mesures du jeu RÉEL (game.js dans le harnais vm, balayage déterministe de tests/gameplay-mouvement/sim.mjs).
// Usage : node tests/lot12-ia/mesure.mjs [matchs=6] [graine=5]
import {sweep} from '../gameplay-mouvement/sim.mjs';
import {laneClearance,offsidePosition} from '../../dist/football-ai.js';
const PROBE=`(()=>{const a=action;if(!a||a.ended)return null;const b=a.ball;return JSON.stringify({id:a.__id,ph:a.phase,fl:!!a.flying,loose:!!a.loose,sp:a.setPiece||null,mode:a.flightMode||null,by:a.shotBy||null,ft:a.flightTarget||null,inc:!!a.incomingPass,nruns:(a.runs||[]).length,tr:!!a.throughRun,
 ball:{x:b.x,y:b.y,z:b.z,v:Math.hypot(b.vx,b.vz)},hero:{x:a.hero.x,z:a.hero.z},
 tm:(a.teammates||[]).map(t=>({x:t.x,z:t.z,hx:t.home?t.home.x:null,hz:t.home?t.home.z:null,sup:!!t.support,id:t.tacticalId,gk:t.tacticalId%11===0,sp:t.speed||0})),
 df:a.defenders.map(d=>({x:d.x,z:d.z,ch:d.challenge?d.challenge.kind:null,sp:d.speed||0})),gk:{x:a.keeper.x,z:a.keeper.z}});})()`;
export function mesure({matches=6,seed=5}={}){
 const R={homeDist:[],passable:[],flights:[],close:[],moves:[],runs:[],closeBy:{}};
 let fl=null,closeT=0,t=0,closePh='';
 sweep({seed,matches,frameDt:1/60,onStep(run,d){
  const s=JSON.parse(run(PROBE)||'null');if(!s){closeT=0;fl=null;return;}
  t+=d;
  if(!s.sp){let sum=0,n=0;for(const m of s.tm)if(!m.gk&&m.hx!=null){sum+=Math.hypot(m.x-m.hx,m.z-m.hz);n++;}if(n)R.homeDist.push(sum/n);}
  if(s.ph==='ready'&&!s.sp&&!s.loose){
   const H=s.hero,def=s.df;let n=0;
   for(const m of s.tm.filter(m=>!m.gk)){const dist=Math.hypot(m.x-H.x,m.z-H.z);if(dist<4||dist>35)continue;
    const lane=laneClearance(H,m,def),space=Math.min(20,...def.map(q=>Math.hypot(q.x-m.x,q.z-m.z)));
    if(lane>1.2&&space>2.2&&!offsidePosition(m,H,def,s.gk))n++;}
   R.passable.push(n);R.runs.push(s.nruns);
  }
  if(s.fl&&!s.loose&&(s.mode==='low'||s.mode==='lob')&&!s.sp){
   if(!fl){fl={tr:s.tr,tgt:s.ft,tReach:null,mode:s.mode,by:s.by,t0:t,v0:s.ball.v,p0:{x:s.ball.x,z:s.ball.z},inc:s.inc};}
   if(!fl.moved&&Math.hypot(s.ball.x-fl.p0.x,s.ball.z-fl.p0.z)>.15){fl.moved=true;fl.t0=t-d;}fl.p1={x:s.ball.x,z:s.ball.z};fl.t1=t;if(fl.moved&&fl.tReach==null&&fl.tgt&&Math.hypot(s.ball.x-fl.tgt.x,s.ball.z-fl.tgt.z)<1.5)fl.tReach=t-fl.t0;
  }else if(fl){if(fl.t1-fl.t0>.1&&fl.tReach!=null){const dist=Math.hypot(fl.tgt.x-fl.p0.x,fl.tgt.z-fl.p0.z);R.flights.push({mode:fl.mode,by:fl.by,inc:fl.inc,tr:fl.tr,dist,time:fl.tReach,v0:fl.v0,avg:dist/Math.max(.1,fl.tReach)});}fl=null;}
  const near=s.df.some(q=>Math.hypot(q.x-s.ball.x,q.z-s.ball.z)<2&&!q.ch),act=s.df.some(q=>q.ch);
  const carried=!s.fl&&!s.loose&&!['ready','choice','incoming','interval','aerial'].includes(s.ph)&&!s.sp;
  if(carried&&near&&!act){closeT+=d;closePh=s.ph;}else{if(closeT>0){R.close.push(closeT);(R.closeBy[closePh]=R.closeBy[closePh]||[]).push(closeT);}closeT=0;}
 }});
 return R;
}
export const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
export const pct=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[Math.min(b.length-1,Math.floor(p*b.length))]:0;};
if(process.argv[1].endsWith('mesure.mjs')){
 const R=mesure({matches:+process.argv[2]||6,seed:+process.argv[3]||5});
 console.log('distance moyenne partenaires -> poste (m):',avg(R.homeDist).toFixed(2),'p90',pct(R.homeDist,.9).toFixed(2),'max',R.homeDist.reduce((a,b)=>Math.max(a,b),0).toFixed(2));
 console.log('partenaires passables au repos: moyenne',avg(R.passable).toFixed(2),'min',R.passable.reduce((a,b)=>Math.min(a,b),99),'part avec <=1:',(R.passable.filter(x=>x<=1).length/R.passable.length*100).toFixed(0)+'%','n',R.passable.length);
 const by={};for(const f of R.flights){const k=f.mode+'/'+(f.inc?'inc':f.by)+(f.tr?'/profondeur':'')+(f.dist>25?'/long':f.dist>12?'/moy':'/court');(by[k]=by[k]||[]).push(f);}
 for(const k of Object.keys(by).sort())console.log('vol',k.padEnd(22),'n',by[k].length,'dist',avg(by[k].map(f=>f.dist)).toFixed(1),'v0',avg(by[k].map(f=>f.v0)).toFixed(1),'vmoy',avg(by[k].map(f=>f.avg)).toFixed(1),'temps',avg(by[k].map(f=>f.time)).toFixed(2));
 console.log('appels proposés (flèches de course) par décision: moyenne',avg(R.runs).toFixed(2),'| aucune:',(R.runs.filter(x=>x===0).length/R.runs.length*100).toFixed(0)+' %','| options totales (passes libres + appels): ',avg(R.passable.map((x,i)=>x+R.runs[i])).toFixed(2));
 for(const k of Object.keys(R.closeBy))console.log('  phase',k,'épisodes',R.closeBy[k].length,'moy',avg(R.closeBy[k]).toFixed(2),'max',Math.max(...R.closeBy[k]).toFixed(2));
 console.log('adversaire <2 m du ballon sans action: épisodes',R.close.length,'moyenne',avg(R.close).toFixed(2),'s','p90',pct(R.close,.9).toFixed(2),'max',Math.max(0,...R.close).toFixed(2),'total',R.close.reduce((a,b)=>a+b,0).toFixed(1));
}
