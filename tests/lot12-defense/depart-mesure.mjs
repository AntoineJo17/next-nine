// À l'instant où une occasion devient jouable (premier tick), qui a le ballon ? Pour chaque type d'occasion.
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
export function departs({seeds=[1,2,3,4,5,6,7,8],matches=3,frameDt=1/60}={}){
 const res={};
 for(const seed of seeds){
  const {run}=boot();
  run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
  for(let m=0;m<matches;m++){
   run("$('play').onclick();");let guard=0;
   while(run('!!match')&&guard++<200000){
    if(run('action.ready&&!action.ended')){
     if(!run('action.__id')){run('action.__id=1');
      const s=JSON.parse(run(`JSON.stringify({k:action.chanceKind||'scenario',ph:action.phase,dBallHero:Math.hypot(action.ball.x-action.hero.x,action.ball.z-action.hero.z),dBallDef:Math.min(...action.defenders.map(d=>Math.hypot(action.ball.x-d.x,action.ball.z-d.z))),hasBall:action.defenders.some(d=>d.hasBall),inc:!!action.incomingPlayer,oppOwns:action.defenders.some(d=>d.hasBall)||action.phase==='press'})`));
      const r=res[s.k]=res[s.k]||{n:0,oppOwns:0,ballFarFromHero:0,ballCloserToDef:0};r.n++;if(s.oppOwns)r.oppOwns++;if(s.dBallHero>1.5)r.ballFarFromHero++;if(s.dBallDef<s.dBallHero)r.ballCloserToDef++;}
     if(run("action.phase==='press'"))run('startGesture({clientX:200+action.pressCarrier.x*12,clientY:200+action.pressCarrier.z*8,preventDefault(){}})');
     else run(`windUp(action.hero,{x:0,z:-21},'normal','hero',0,.7)`);}
    if(run('action.ended&&action.after>1.2')){run("$('continue').onclick()");continue;}
    if(run('action.phase')==='interval'){run('action.interval.fast=true;tick(.04)');continue;}
    let rem=frameDt;while(rem>1e-9){const d=Math.min(rem,1/120);run(`tick(${d})`);rem-=d;}
    run('recordFrame(action,'+frameDt+')');
   }
  }
 }
 return res;
}
if(process.argv[1].endsWith('depart-mesure.mjs'))console.log(JSON.stringify(departs(),null,1));
