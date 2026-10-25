// Observation : joue des matchs réels (harnais vm, graine fixe) et consigne chaque changement de possession vers un défenseur.
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
import {rngOf} from '../gameplay-mouvement/sim.mjs';
const HOOK="function winBall(defender,message){try{const a=action,b=a.ball,h=a.hero;(globalThis.__wins=globalThis.__wins||[]).push({msg:message,ph:a.phase,flying:a.flying,sim:a.sim,hero:{x:h.x,z:h.z},ball:{x:b.x,y:b.y,z:b.z,vx:b.vx,vz:b.vz},def:{x:defender.x,z:defender.z,ch:defender.challenge?defender.challenge.kind:null,ct:defender.challenge?defender.challenge.time:null,sp:defender.speed},who:a.phase==='dribble'||a.phase==='skill'||a.phase==='ready'?'hero':'other'});}catch(e){}";
export function observe({seed=1,matches=2,frameDt=1/60,patch=null}={}){
 const {run}=boot(null,{transform:s=>{if(!s.includes('function winBall(defender,message){'))throw Error('winBall introuvable');s=s.replace('function winBall(defender,message){',HOOK);return patch?patch(s):s;}});
 const rnd=rngOf(seed*7919+3);
 run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
 const hostRandom=Math.random;{let h=seed*65537+5;Math.random=()=>{h=(Math.imul(h,1103515245)+12345)>>>0;return (h%2147483648)/2147483648;};}
 const log=[];let actions=0;
 try{for(let m=0;m<matches;m++){run("$('play').onclick();");let guard=0;
  while(run('!!match')&&guard++<200000){
   if(run('action.ready&&!action.ended')){if(!run('action.__id')){actions++;run(`action.__id=${actions}`);
     run(`{const rr=${rnd()};const hero=action.hero;if(rr<.2)windUp(hero,{x:(${rnd()}-.5)*6,z:-21},'normal','hero',0,.4+${rnd()}*.6);else if(rr<.85)beginDribble({x:hero.x+(${rnd()}-.5)*5,z:hero.z-1-${rnd()}*4});else{const t=action.teammates[Math.floor(${rnd()}*action.teammates.length)];windUp(hero,{x:t.x,z:t.z},'low','hero');}}`);}}
   if(run('action.ended&&action.after>1.2')){run("$('continue').onclick()");continue;}
   if(run('action.phase')==='interval'){run('action.interval.fast=true;tick(.04)');continue;}
   let remaining=Math.min(frameDt,.04);
   while(remaining>1e-9){const d=Math.min(remaining,1/120);
    const pre=run('action&&action.ball?JSON.stringify({x:action.ball.x,y:action.ball.y,z:action.ball.z}):null');
    const nw=run('(globalThis.__wins||[]).length');
    run(`tick(${d})`);remaining-=d;
    const nw2=run('(globalThis.__wins||[]).length');
    if(nw2>nw){const w=run(`JSON.stringify(__wins[${nw2-1}])`);const post=run('JSON.stringify({x:action.ball.x,y:action.ball.y,z:action.ball.z})');log.push({w:JSON.parse(w),pre:JSON.parse(pre),post:JSON.parse(post),dt:d,seed,match:m});}
   }
   run('recordFrame(action,'+Math.min(frameDt,.04)+')');}
 }}finally{Math.random=hostRandom;}
 return {log,actions};
}
export function segDist(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz;const t=l?Math.max(0,Math.min(1,((px-ax)*dx+(pz-az)*dz)/l)):0;return Math.hypot(px-(ax+dx*t),pz-(az+dz*t));}
export function summarize(log){return log.map(e=>{const w=e.w,j=Math.hypot(e.post.x-e.pre.x,e.post.z-e.pre.z),hb=Math.hypot(w.hero.x-e.pre.x,w.hero.z-e.pre.z);
 return {msg:w.msg.slice(0,40),ph:w.ph,who:w.who,jump:j,ballDef:Math.hypot(w.def.x-e.pre.x,w.def.z-e.pre.z),heroBall:hb,heroDef:Math.hypot(w.hero.x-w.def.x,w.hero.z-w.def.z),through:segDist(w.hero.x,w.hero.z,e.pre.x,e.pre.z,e.post.x,e.post.z),ch:w.def.ch,ct:w.def.ct};});}
if(process.argv[1]?.endsWith('obs.mjs')){const seeds=+process.argv[2]||3;let all=[];for(let s=1;s<=seeds;s++){const r=observe({seed:s,matches:2});all=all.concat(summarize(r.log));}
 console.log('n',all.length);const by={};for(const e of all){const k=e.msg+'|'+e.ph;(by[k]=by[k]||[]).push(e);}
 for(const [k,v] of Object.entries(by)){const js=v.map(e=>e.jump).sort((a,b)=>a-b);console.log(k,'n='+v.length,'saut médian',js[js.length>>1].toFixed(2),'max',js.at(-1).toFixed(2),'ballDef médian',v.map(e=>e.ballDef).sort((a,b)=>a-b)[v.length>>1].toFixed(2),'traverse(<0.4)',v.filter(e=>e.through<.4).length,'sans tacle',v.filter(e=>!e.ch).length);}}
