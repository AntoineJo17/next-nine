// Balayage déterministe du gameplay RÉEL (game.js dans le harnais vm) : des matchs entiers joués au hasard (graine fixe),
// avec enregistrement de la position/de l'angle de chaque acteur à chaque sous-pas de 1/120 s, comme le fait loop().
import {boot} from './harness-reel.mjs';

export function rngOf(seed){let r=seed>>>0||1;return()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}

/**
 * Joue `matches` matchs. `frameDt` = durée d'une image (comme requestAnimationFrame) ; loop() la découpe en pas de 1/120 s (plafond .04).
 * `onStep(info)` est appelé après chaque sous-pas. Retourne des compteurs.
 */
export function sweep({seed=1,matches=1,frameDt=1/60,maxSteps=200000,onStep=()=>{},onAction=()=>{},play=true}={}){
 const {run}=boot();const rnd=rngOf(seed*7919+3);
 // Le Math.random du jeu vit dans le contexte vm : on le remplace par une suite déterministe.
 run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
 const stats={frames:0,substeps:0,actions:0,matches:0};
 for(let m=0;m<matches;m++){
  run("$('play').onclick();");
  let guard=0;
  while(run('!!match')&&guard++<maxSteps){
   if(run('action.ready&&!action.ended')){stats.actions++;if(!run('action.__id')){run(`action.__id=${stats.actions}`);onAction(run,stats.actions);}
    if(play)run(`{const rr=${rnd()};const k=${rnd()};const hero=action.hero;if(rr<.45)windUp(hero,{x:(${rnd()}-.5)*6,z:-21},'normal','hero',0,.4+${rnd()}*.6);else if(rr<.85)beginDribble({x:hero.x+(${rnd()}-.5)*5,z:hero.z-1-${rnd()}*4});else{const t=action.teammates[Math.floor(${rnd()}*action.teammates.length)];windUp(hero,{x:t.x,z:t.z},'low','hero');}}`);}
   if(run('action.ended&&action.after>1.2')){run("$('continue').onclick()");continue;}
   if(run('action.phase')==='interval'){run('action.interval.fast=true;tick(.04)');stats.intervalTicks=(stats.intervalTicks||0)+1;continue;}
   // une « image » = plusieurs sous-pas, exactement comme loop()
   let remaining=Math.min(frameDt,.04);stats.frames++;
   while(remaining>1e-9){const d=Math.min(remaining,1/120);run(`tick(${d})`);remaining-=d;stats.substeps++;onStep(run,d);}
   run('recordFrame(action,'+Math.min(frameDt,.04)+')');
  }
  stats.matches++;
 }
 return stats;
}

/** Instantané compact de tous les acteurs (JSON via le vm). */
export const SNAP=`(()=>{const a=action;if(!a)return null;if(!a.__id)a.__id=(globalThis.__n=(globalThis.__n||1000)+1);const f=(n,p)=>p&&({n,x:p.x,z:p.z,y:p.y||0,ang:p.angle,sp:p.speed||0,vx:p.vx||0,vz:p.vz||0,ch:p.challenge?p.challenge.kind:null,ct:p.challenge?p.challenge.time:0,kt:p.kickTimer,cel:p.celebrate,st:p.state||null,tilt:p.tilt||0});
 return JSON.stringify({id:a.__id,ph:a.phase,fl:!!a.flying,end:!!a.ended,sim:a.sim,frozen:!!a.frozen,ball:{x:a.ball.x,y:a.ball.y,z:a.ball.z},
  actors:[f('hero',a.hero),...(a.teammates||[]).map((p,i)=>f('t'+i,p)),...a.defenders.map((p,i)=>f('d'+i,p)),f('gk',a.keeper)]});})()`;
