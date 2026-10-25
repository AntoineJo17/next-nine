// Aide de test gameplay-physique : charge dist/game.js (harnais vm de tests/career-qa) et expose un pilote de tir/passe
// qui enregistre la trajectoire et les invariants tick après tick, avec un pas de temps choisi.
import {boot} from '../career-qa/harness.mjs';

/** PRNG déterministe (LCG), graine entière. */
export const rng=seed=>{let s=seed>>>0;return ()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296;};

const DRIVER=`
globalThis.__drive=function(cfg){
 const out={ticks:0,nan:false,minY:9,maxSpeed:0,maxAbsX:0,minZ:99,maxZ:-99,goalFrames:0,insideFrames:0,events:[],usStart:match.us,ended:false};
 let prevB=null;let prevZ=action.ball?action.ball.z:0;let t=0;const seq=cfg.dts;let i=0;let lastFlag=null;
 while(t<cfg.maxT&&!(action.ended&&(action.after||0)>(cfg.afterT??0))){
  const dt=typeof seq==='number'?seq:seq[i++%seq.length];
  if(action.callPause)action.callPause=false;
  if(cfg.holdKeeper!=null&&!action.ended)action.keeper.elapsed=cfg.holdKeeper;
  tick(dt);t+=dt;out.ticks++;
  const b=action.ball;if(!b)continue;
  if(prevB){const dd=Math.hypot(b.x-prevB.x,b.y-prevB.y,b.z-prevB.z),sp=Math.hypot(prevB.vx||0,prevB.vy||0,prevB.vz||0);if(dd>Math.max(.8,sp*dt*2.5+.5)&&(out.jumps??=[]).length<6)out.jumps.push({t:+t.toFixed(3),dd:+dd.toFixed(2),from:[+prevB.x.toFixed(2),+prevB.y.toFixed(2),+prevB.z.toFixed(2)],to:[+b.x.toFixed(2),+b.y.toFixed(2),+b.z.toFixed(2)],phase:action.phase,fb:$('feedback').textContent.slice(0,40)});}
  {const fbk=$('feedback').textContent;if(fbk!==lastFlag){lastFlag=fbk;if(out.events.length<12)out.events.push({t:+t.toFixed(3),fb:fbk.slice(0,60),b:[+b.x.toFixed(2),+b.y.toFixed(2),+b.z.toFixed(2)],v:[+(b.vx||0).toFixed(1),+(b.vy||0).toFixed(1),+(b.vz||0).toFixed(1)]});}}
  prevB={x:b.x,y:b.y,z:b.z,vx:b.vx,vy:b.vy,vz:b.vz};
  if(![b.x,b.y,b.z,b.vx||0,b.vy||0,b.vz||0].every(Number.isFinite))out.nan=true;
  out.minY=Math.min(out.minY,b.y);out.maxSpeed=Math.max(out.maxSpeed,Math.hypot(b.vx||0,b.vy||0,b.vz||0));
  out.maxAbsX=Math.max(out.maxAbsX,Math.abs(b.x));out.minZ=Math.min(out.minZ,b.z);out.maxZ=Math.max(out.maxZ,b.z);
  const inGoal=b.z<-20.22&&Math.abs(b.x)<3.44&&b.y<2.22;if(inGoal)out.insideFrames++;if(b.z<-20.22&&!out.firstCross&&prevZ>=-20.22){out.keeperAt={x:+action.keeper.x.toFixed(2),z:+action.keeper.z.toFixed(2),state:action.keeper.state,dir:action.keeper.dir,reach:+(action.keeper.reach||0).toFixed(2),y:+(action.keeper.y||0).toFixed(2),dx:action.keeper.diveDX};out.firstCross={t:+t.toFixed(3),x:+b.x.toFixed(3),y:+b.y.toFixed(3),z:+b.z.toFixed(3)};}prevZ=b.z;
  if(cfg.trace)(out.trace??=[]).push([+t.toFixed(4),+b.x.toFixed(3),+b.y.toFixed(3),+b.z.toFixed(3),+(b.vx||0).toFixed(2),+(b.vy||0).toFixed(2),+(b.vz||0).toFixed(2),action.phase,action.ended?action.outcomeKind:'']);
  if(action.ended&&!out.ended){out.ended=true;out.endT=t;out.kind=action.outcomeKind;out.endBall={x:b.x,y:b.y,z:b.z};}
  if(cfg.stopOnEnd&&action.ended)break;
 }
 out.t=t;out.us=match.us-out.usStart;out.msg=$('feedback').textContent;out.finalBall={x:action.ball.x,y:action.ball.y,z:action.ball.z};out.ballControl=action.ballControl;out.phase=action.phase;out.ready=action.ready;out.loose=action.loose;
 return JSON.stringify(out);
};`;

/** Démarre un match d'entraînement-type avec un décor déterministe. */
export function newGame(seed=1){
 const g=boot();const rnd=rng(seed);
 g.run('Math.random=()=>1/2;');
 g.run("$('play').onclick();match.index=1;setup();");
 g.run(DRIVER);
 g.rnd=rnd;
 g.setRandom=s=>{const r=rng(s);g.ctx.__rnd=r;g.run('Math.random=()=>__rnd();');};
 g.drive=cfg=>JSON.parse(g.run(`__drive(${JSON.stringify(cfg)})`));
 return g;
}
