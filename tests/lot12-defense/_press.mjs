import {boot} from '../gameplay-mouvement/harness-reel.mjs';
// Pressing forcé : le porteur est le défenseur n°1, placé à `dist` m devant le héros ; hasard déterministe.
export function pressing(seed,dist,{tap=true,tapEvery=null}={}){
 const {run}=boot();
 run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};for(let i=0;i<8;i++)Math.random();}`);
 run("$('play').onclick();action.started=true;");
 run(`{const c=action.defenders[1];c.x=action.hero.x+1;c.z=action.hero.z-${dist};c.tacticalId=99;setupPress({carrierId:99});}`);
 const tapCarrier=()=>run('startGesture({clientX:200+action.pressCarrier.x*12,clientY:200+action.pressCarrier.z*8,preventDefault(){}})');
 if(tap)tapCarrier();
 const r={won:false,ended:false,maxBallStep:0,idle:0,t:0,minDist:99,msg:''};
 let prev=run('JSON.stringify({x:action.ball.x,z:action.ball.z})');prev=JSON.parse(prev);
 for(let i=0;i<1500;i++){
  if(tapEvery&&i%tapEvery===0&&run("action.phase==='press'"))tapCarrier();
  const rec=run('match.recoveries||0');
  run('tick(1/120)');
  const s=JSON.parse(run('JSON.stringify({ph:action.phase,end:action.ended,bx:action.ball.x,bz:action.ball.z,sp:action.hero.speed||0,d:Math.hypot(action.hero.x-action.pressCarrier.x,action.hero.z-action.pressCarrier.z),rec:match.recoveries||0,pw:!!action.pressWon})'));
  r.maxBallStep=Math.max(r.maxBallStep,Math.hypot(s.bx-prev.x,s.bz-prev.z));prev={x:s.bx,z:s.bz};
  r.t+=1/120;r.minDist=Math.min(r.minDist,s.d);
  if(s.ph==='press'&&s.sp<.2&&s.d>1.5&&!run('!!action.pressPass'))r.idle+=1/120;
  if(s.rec>rec)r.won=true;
  if(s.end){r.ended=true;r.msg=run("$('feedback').textContent");break;}
  if(r.won&&s.ph==='ready')break;
 }
 return r;
}

