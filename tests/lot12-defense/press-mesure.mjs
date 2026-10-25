// Mesure ciblée du pressing : on force la situation (setupPress) sur des départs issus de vrais matchs et on regarde si le joueur peut gagner le ballon.
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
import {rngOf} from '../gameplay-mouvement/sim.mjs';
export function pressMesure({seeds=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],matches=3,frameDt=1/60,tap=true,retap=true}={}){
 const out=[];
 for(const seed of seeds){
  const {run}=boot();
  run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
  const rnd=rngOf(seed*7919+3);
  for(let m=0;m<matches;m++){
   run("$('play').onclick();");let guard=0,cur=null;
   while(run('!!match')&&guard++<200000){
    if(run('action.ready&&!action.ended')){
     if(run("action.phase==='press'")){
      if(!cur){cur=JSON.parse(run('JSON.stringify({d0:Math.hypot(action.hero.x-action.pressCarrier.x,action.hero.z-action.pressCarrier.z),t:0,min:99})'));}
      if(tap)run('startGesture({clientX:200+action.pressCarrier.x*12,clientY:200+action.pressCarrier.z*8,preventDefault(){}})');
      else{run('tick(1/60)');if(++cur.t>600)break;continue;}
     }else run(`{const rr=${rnd()};const hero=action.hero;if(rr<.45)windUp(hero,{x:(${rnd()}-.5)*6,z:-21},'normal','hero',0,.4+${rnd()}*.6);else if(rr<.85)beginDribble({x:hero.x+(${rnd()}-.5)*5,z:hero.z-1-${rnd()}*4});else{const t=action.teammates[Math.floor(${rnd()}*action.teammates.length)];windUp(hero,{x:t.x,z:t.z},'low','hero');}}`);}
    if(run('action.ended&&action.after>1.2')){if(cur){cur.fin=run('action.outcomeKind');cur.msg=run("$('feedback').textContent");out.push(cur);cur=null;}run("$('continue').onclick()");continue;}
    if(run('action.phase')==='interval'){run('action.interval.fast=true;tick(.04)');continue;}
    let rem=frameDt;while(rem>1e-9){const d=Math.min(rem,1/120);
     if(cur&&tap&&retap&&run("action.phase==='press'")&&Math.floor(cur.t*4)!==Math.floor((cur.t+d)*4))run('startGesture({clientX:200+action.pressCarrier.x*12,clientY:200+action.pressCarrier.z*8,preventDefault(){}})');
     if(cur&&run("action.phase==='press'")){cur.t+=d;cur.duels=run('action.pressDuels||0');if(process.env.TRACE&&cur.d0<3.2&&Math.floor(cur.t*10)!==Math.floor((cur.t-d)*10))console.log(cur.t.toFixed(2),run('JSON.stringify({d:+Math.hypot(action.hero.x-action.pressCarrier.x,action.hero.z-action.pressCarrier.z).toFixed(2),pr:+action.pressure.toFixed(2),sp:+action.hero.speed.toFixed(1),ch:action.pressChase,rt:!!action.runTarget,rd:action.ready})'));cur.cool=run('action.pressCool||0');cur.pw=run('!!action.pressWon');cur.pp=run('!!action.pressPass');cur.en=run('match.energy');cur.min=Math.min(cur.min,run('Math.hypot(action.hero.x-action.pressCarrier.x,action.hero.z-action.pressCarrier.z)'));}
     run(`tick(${d})`);if(cur&&run("action.phase!=='press'&&!action.ended")){cur.fin='gagne';cur.msg=run("$('feedback').textContent");out.push(cur);cur=null;}rem-=d;}
    run('recordFrame(action,'+frameDt+')');
   }
  }
 }
 return out;
}
if(process.argv[1].endsWith('press-mesure.mjs')){const retap=process.argv[2]!=='1';const r=pressMesure({retap});const f={};for(const x of r)f[x.fin]=(f[x.fin]||0)+1;if(process.argv[3])console.log(r.map(x=>JSON.stringify(x)).join('\n'));const how={};for(const x of r)if(x.fin==='gagne')how[x.msg]=(how[x.msg]||0)+1;console.log(how);console.log(JSON.stringify({n:r.length,fins:f,moy:{d0:r.reduce((a,x)=>a+x.d0,0)/r.length,t:r.reduce((a,x)=>a+x.t,0)/r.length,min:r.reduce((a,x)=>a+x.min,0)/r.length}},null,1));}
