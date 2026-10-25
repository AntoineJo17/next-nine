// Scénarios ciblés : le héros conduit le ballon vers / à côté d'un défenseur proche ; on échantillonne chaque sous-pas de 1/120 s
// et on mesure, à la perte de balle, le saut du ballon, la distance héros-ballon et le passage du ballon à travers le héros.
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
import {rngOf} from '../gameplay-mouvement/sim.mjs';
import {segDist} from './obs.mjs';
const HOOK="function winBall(defender,message){try{(globalThis.__wins=globalThis.__wins||[]).push({bd:Math.hypot(action.ball.x-defender.x,action.ball.z-defender.z),msg:message,ph:action.phase,ch:defender.challenge?defender.challenge.kind:null,ct:defender.challenge?defender.challenge.time:null});}catch(e){}";

/** Un essai : retourne la trace image par image autour de la perte (ou null si pas de perte). */
export function trial(run,seed,{angle=0,dist=2.2,mode='dribble',frame=1/60,maxT=4}={}){
 run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
 run("$('play').onclick();");
 let g=0;while(!run('action&&action.ready&&!action.ended')&&g++<4000){if(run('action&&action.phase')==='interval')run('action.interval.fast=true;tick(.04)');else run('tick(.04)');if(run('action&&action.ended&&action.after>1.2'))run("$('continue').onclick()");}
 if(!run('action&&action.ready&&!action.ended'))return null;
 run('__wins=[];attachBall(action.hero);');
 // défenseur placé devant le héros, à `dist` m, décalé de `angle` rad
 run(`{const a=action,h=a.hero,d=a.defenders[0];h.vx=0;h.vz=0;d.x=h.x+Math.sin(${angle})*${dist};d.z=h.z-Math.cos(${angle})*${dist};d.challenge=null;d.challengeCooldown=0;a.defenders.forEach((q,i)=>{if(q!==d){q.x=h.x+(i%2?14:-14);q.z=h.z-20+i;}});a.pressIndex=0;h.angle=0;attachBall(h);beginDribble({x:h.x+${-Math.sin(angle)*0.0}+0.4,z:h.z-4});}`);
 const frames=[];let t=0;
 while(t<maxT){
  const pre=JSON.parse(run('JSON.stringify({b:{x:action.ball.x,y:action.ball.y,z:action.ball.z},h:{x:action.hero.x,z:action.hero.z,a:action.hero.angle},d:action.defenders.map(d=>({x:d.x,z:d.z,ch:d.challenge?d.challenge.kind:null,ct:d.challenge?d.challenge.time:0,sp:d.speed,ang:d.angle}))})'));
  let rem=frame;while(rem>1e-9){const d=Math.min(rem,1/120);pre.sub=JSON.parse(run('JSON.stringify({x:action.ball.x,z:action.ball.z})'));run(`tick(${d})`);rem-=d;t+=d;
   if(run('__wins.length')>0)break;}
  const post=JSON.parse(run('JSON.stringify({b:{x:action.ball.x,y:action.ball.y,z:action.ball.z},ph:action.phase,own:action.ballControl||null})'));
  frames.push({pre,post});
  if(run('__wins.length')>0){const w=JSON.parse(run('JSON.stringify(__wins[0])'));
   // suite : 1,5 s au pas de 1/120 s ; saut maximal du ballon (m/pas), distance minimale héros-ballon, ballon à travers un corps
   let maxStep=0,minHero=9,minOwner=9,prev=post.b,tt=0;const after=[];
   while(tt<1.5){run('tick(1/120)');tt+=1/120;const q=JSON.parse(run('JSON.stringify({x:action.ball.x,z:action.ball.z,hx:action.hero.x,hz:action.hero.z,ox:action.newOwner.x,oz:action.newOwner.z})'));maxStep=Math.max(maxStep,Math.hypot(q.x-prev.x,q.z-prev.z));minHero=Math.min(minHero,Math.hypot(q.x-q.hx,q.z-q.hz));minOwner=Math.min(minOwner,Math.hypot(q.x-q.ox,q.z-q.oz));prev={x:q.x,z:q.z};after.push(q);}
   const endBall=after.at(-1),own=Math.hypot(endBall.x-endBall.ox,endBall.z-endBall.oz);
   return {w,pre,post,maxStep,minHero,minOwner,own,jump:Math.hypot(post.b.x-pre.sub.x,post.b.z-pre.sub.z),heroBall:Math.hypot(pre.h.x-pre.b.x,pre.h.z-pre.b.z),through:segDist(pre.h.x,pre.h.z,pre.b.x,pre.b.z,post.b.x,post.b.z),frames};}
  if(false){const w=null;
   // sous-pas suivants : le ballon bouge-t-il physiquement vers le défenseur ?
   return {w,pre,post,jump:Math.hypot(post.b.x-pre.sub.x,post.b.z-pre.sub.z),heroBall:Math.hypot(pre.h.x-pre.b.x,pre.h.z-pre.b.z),through:segDist(pre.h.x,pre.h.z,pre.b.x,pre.b.z,post.b.x,post.b.z),frames};}
  if(run('action.ended'))return {w:null,frames};
  if(run('action.ready&&!action.phase!=="dribble"')&&run('action.phase')==='ready')return {w:null,frames};
 }
 return {w:null,frames};
}
export function sweepScenario({n=60,hook=true,patch=null,angles=[-0.5,0,0.5],dists=[1.6,2.2,3],mode='dribble'}={}){
 const out=[];let k=0;
 for(const ang of angles)for(const dist of dists)for(let i=0;i<Math.ceil(n/(angles.length*dists.length));i++){
  const {run}=boot(null,{transform:s=>{s=s.replace('function winBall(defender,message){',HOOK);return patch?patch(s):s;}});
  const r=trial(run,++k,{angle:ang,dist,mode});if(r)out.push({ang,dist,...r});}
 return out;
}
if(process.argv[1]?.endsWith('scenario.mjs')){
 const res=sweepScenario({n:+process.argv[2]||54});
 const lost=res.filter(r=>r.w);console.log('essais',res.length,'pertes',lost.length);
 const by={};for(const r of lost){(by[r.w.msg.slice(0,30)]=by[r.w.msg.slice(0,30)]||[]).push(r);}
 for(const [k,v] of Object.entries(by)){const j=v.map(r=>r.jump).sort((a,b)=>a-b);console.log(k,'n='+v.length,'saut médian',j[j.length>>1].toFixed(2),'max',j.at(-1).toFixed(2),'héros-ballon méd',v.map(r=>r.heroBall).sort((a,b)=>a-b)[v.length>>1].toFixed(2),'traverse héros (<0.35)',v.filter(r=>r.through<.35).length,'sans contact visible (pas de tacle)',v.filter(r=>!r.w.ch).length);}
}
