// Mesure : pour chaque type d'occasion (chanceKind), temps pendant lequel l'entrée du joueur est sans effet.
// Boucle de jeu réelle (harnais vm) ; le « joueur » est un bot : en pressing il touche l'herbe sous le porteur, sinon il joue au hasard.
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
import {rngOf} from '../gameplay-mouvement/sim.mjs';
export function mesure({seeds=[1,2,3,4,5,6],matches=3,presser=true,frameDt=1/60}={}){
 const res={};
 const get=k=>res[k]=res[k]||{n:0,total:0,attente:0,pressPasse:0,pressCourse:0,phases:{},fins:{},recup:0};
 for(const seed of seeds){
  const {run}=boot();const rnd=rngOf(seed*7919+3);
  run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
  for(let m=0;m<matches;m++){
   run("$('play').onclick();");let guard=0;
   while(run('!!match')&&guard++<200000){
    if(run('action.ready&&!action.ended')){
     const k=run('action.chanceKind||"scenario"');
     if(!run('action.__id')){run(`action.__id=1`);get(k).n++;}
     if(run("action.phase==='press'")){if(presser)run('startGesture({clientX:200+action.pressCarrier.x*12,clientY:200+action.pressCarrier.z*8,preventDefault(){}})');else{get(k).attente+=frameDt;run('tick(1/60)');continue;}}
     else run(`{const rr=${rnd()};const hero=action.hero;if(rr<.45)windUp(hero,{x:(${rnd()}-.5)*6,z:-21},'normal','hero',0,.4+${rnd()}*.6);else if(rr<.85)beginDribble({x:hero.x+(${rnd()}-.5)*5,z:hero.z-1-${rnd()}*4});else{const t=action.teammates[Math.floor(${rnd()}*action.teammates.length)];windUp(hero,{x:t.x,z:t.z},'low','hero');}}`);}
    if(run('action.ended&&action.after>1.2')){const s=JSON.parse(run('JSON.stringify({k:action.chanceKind||"scenario",o:action.outcomeKind})'));const r=get(s.k);r.fins[s.o]=(r.fins[s.o]||0)+1;run("$('continue').onclick()");continue;}
    if(run('action.phase')==='interval'){run('action.interval.fast=true;tick(.04)');continue;}
    let rem=frameDt;while(rem>1e-9){const d=Math.min(rem,1/120);
     const s=JSON.parse(run('JSON.stringify({k:action.chanceKind||"scenario",ph:action.phase,en:!!action.ended,pp:!!action.pressPass,hb:action.defenders.some(d=>d.hasBall)})'));
     const r=get(s.k);if(!s.en){r.total+=d;r.phases[s.ph]=(r.phases[s.ph]||0)+d;if(s.ph==='press'){if(s.pp)r.pressPasse+=d;else r.pressCourse+=d;}}
     run(`tick(${d})`);rem-=d;}
    run('recordFrame(action,'+frameDt+')');
   }
  }
 }
 return res;
}
if(process.argv[1].endsWith('mesure.mjs'))console.log(JSON.stringify({presseur:mesure(),passif:mesure({presser:false,seeds:[1,2],matches:2})},null,1));
