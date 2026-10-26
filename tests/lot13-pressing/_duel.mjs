import {boot} from '../gameplay-mouvement/harness-reel.mjs';
// Duel de pressing forcé : le tacle réussit toujours (Math.random() = 0 pendant le duel). Mesure, pas à pas de 1/120 s :
// où est la jambe/le héros quand le ballon commence à rouler, combien de temps après le début du geste, et le plus grand saut du ballon.
export function duel(seed,dist=6){
 const {run}=boot();
 run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};for(let i=0;i<8;i++)Math.random();}`);
 run("$('play').onclick();action.started=true;");
 run(`{const c=action.defenders[1];c.x=action.hero.x+1;c.z=action.hero.z-${dist};c.tacticalId=99;setupPress({carrierId:99});}`);
 run('startGesture({clientX:200+action.pressCarrier.x*12,clientY:200+action.pressCarrier.z*8,preventDefault(){}})');
 const r={released:false,relDist:null,relKick:null,maxStep:0,attachJump:0,done:false,t:0,ballTouched:false};
 let prev=JSON.parse(run('JSON.stringify({x:action.ball.x,z:action.ball.z})'));
 let dueled=false;
 for(let i=0;i<2400;i++){
  // dès que le héros est au contact, le hasard donne toujours la réussite du tacle
  if(!dueled&&run("action.phase==='press'&&!action.pressWon&&Math.hypot(action.hero.x-action.pressCarrier.x,action.hero.z-action.pressCarrier.z)<1.3")){run('Math.random=()=>0');dueled=true;}
  run('tick(1/120)');
  const s=JSON.parse(run('JSON.stringify({ph:action.phase,bx:action.ball.x,bz:action.ball.z,pw:!!action.pressWon,kt:action.hero.kickTimer,d:Math.hypot(action.hero.x-action.ball.x,action.hero.z-action.ball.z),spd:Math.hypot(action.ball.vx||0,action.ball.vz||0),end:action.ended})'));
  const step=Math.hypot(s.bx-prev.x,s.bz-prev.z);prev={x:s.bx,z:s.bz};r.t+=1/120;
  if(s.pw&&s.spd>.3&&!r.released){r.released=true;r.relDist=s.d;r.relKick=s.kt;r.relStep=step;}
  if(r.released)r.maxStep=Math.max(r.maxStep,step);
  if(r.released&&s.ph==='ready'){r.attachJump=step;r.done=true;r.endDist=s.d;break;}
  if(s.end)break;
 }
 return r;
}
