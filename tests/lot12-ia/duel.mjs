// Lot 12 · ia : le joueur enchaîne des conduites droit vers le but ; on relève combien de temps un défenseur reste collé (< 1,6 m du joueur) sans tacler ni récupérer,
// combien de conduites finissent par une perte, et la durée moyenne avant la perte. Usage : node tests/lot12-ia/duel.mjs [matchs=30] [graine=3]
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
export function duel({matches=30,seed=3}={}){
 const {run}=boot();
 run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
 const R={touches:0,lost:0,lostAt:[],stuck:[],shots:0,kept:0,passes:0};
 for(let m=0;m<matches;m++){
  run("$('play').onclick();");
  let g=0,acts=0;
  while(run('!!match')&&g++<60000){
   if(run("action.ready&&action.phase==='aerial'"))run('controlAgain("x")');
   if(run('action.ended&&action.after>1.2')){run("$('continue').onclick()");acts++;continue;}
   if(run('action.phase')==='interval'){run('action.interval.fast=true;tick(.04)');continue;}
   if(run("action&&action.ready&&action.phase==='ready'&&!action.ended&&!action.setPiece")){
    R.touches++;const t0=run('action.sim');
    run(`{const h=action.hero;beginDribble({x:h.x*.6,z:h.z-6});}`);
    let stuck=0,worst=0,time=0;
    for(let i=0;i<400&&run('!!action&&!action.ended&&action.phase===\'dribble\'');i++){
     run('tick(1/120)');time+=1/120;
     const s=JSON.parse(run(`JSON.stringify({d:action.defenders.map(d=>[Math.hypot(d.x-action.hero.x,d.z-action.hero.z),!!d.challenge||d.stun>0]),ph:action.phase})`));
     const near=s.d.some(x=>x[0]<1.6&&!x[1]);if(near){stuck+=1/120;worst=Math.max(worst,stuck);}else stuck=0;
    }
    if(worst>0)R.stuck.push(worst);
    if(run('!!action&&action.ended')){R.lost++;R.lostAt.push(time);} else R.kept++;
    continue;
   }
   run('tick(1/60)');
  }
 }
 return R;
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
if(process.argv[1].endsWith('duel.mjs')){
 const R=duel({matches:+process.argv[2]||30,seed:+process.argv[3]||3});
 console.log('conduites',R.touches,'| perdues',R.lost,'('+(R.lost/R.touches*100).toFixed(0)+' %)','| durée avant perte moy',avg(R.lostAt).toFixed(2),'s');
 console.log('défenseur collé (<1,6 m) sans action : épisodes',R.stuck.length,'moy',avg(R.stuck).toFixed(2),'s','max',Math.max(0,...R.stuck).toFixed(2),'s','; >0,6 s :',R.stuck.filter(x=>x>.6).length);
}
