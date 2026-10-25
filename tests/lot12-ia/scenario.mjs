// Lot 12 · ia : scénario contrôlé dans le vrai game.js (harnais vm) : le joueur conduit le ballon pendant ~2,5 s, un partenaire attaquant est masqué (un défenseur sur la ligne de passe).
// On relève ce que devient la ligne de passe vers ce partenaire et la distance qu'il a parcourue.
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
export function scenario({seed=5,seconds=2.5}={}){
 const {run}=boot();
 run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
 run("$('play').onclick();");
 for(let g=0;g<4000&&!run("action.ready&&action.phase==='ready'");g++){if(run("action.ready&&action.phase==='aerial'"))run('controlAgain("x")');if(run('action.phase')==='interval')run('action.interval.fast=true;tick(.04)');run('tick(1/60)');}
 const r=JSON.parse(run(`(()=>{const a=action,h=a.hero;
  h.x=0;h.z=8;h.angle=0;a.ball={x:0,y:R,z:7.4,vx:0,vy:0,vz:0,age:0,bounces:0};a.start={x:0,z:8};
  a.teammates.forEach((t,i)=>{t.tacticalId=i;});const tm=a.teammates.filter(t=>t.tacticalId%11!==0);
  const fwd=tm[tm.length-1];fwd.tacticalId=9;
  // tout le monde est replacé : partenaires loin, sauf l'attaquant masqué ; défenseurs loin, sauf deux autour de la ligne de passe
  tm.forEach((t,i)=>{t.x=(i%2?1:-1)*(20+i);t.z=40+i*3;t.home={x:t.x,z:t.z};t.spot=null;});
  fwd.x=7;fwd.z=-4;fwd.home={x:7,z:-4};
  a.defenders.forEach((d,i)=>{d.x=(i%2?1:-1)*(15+i);d.z=-10-i*.4;d.home={x:d.x,z:d.z};d.mark=null;d.cover=false;});
  a.defenders[0].x=3.2;a.defenders[0].z=2;a.defenders[1].x=5;a.defenders[1].z=-5.2;
  a.pressIndex=-1;a.offsideLine=-30;a.runs=[];
  return JSON.stringify({id:fwd.tacticalId});})()`));
 const lane=()=>+run(`laneClearance(action.hero,action.teammates.find(t=>t.tacticalId===${r.id}),action.defenders)`);
 const pos=()=>JSON.parse(run(`(()=>{const t=action.teammates.find(t=>t.tacticalId===${r.id});return JSON.stringify({x:t.x,z:t.z});})()`));
 const p0=pos(),l0=lane();
 run('beginDribble({x:0,z:2})');
 for(let i=0;i<6;i++)run('tick(1/120)');
 // la ligne vers l'endroit qu'il vise (sans défenseur qui ait encore eu le temps de se replacer)
 const spot=JSON.parse(run(`JSON.stringify(action.teammates.find(t=>t.tacticalId===${r.id}).spot||null)`));
 const laneSpot=spot?+run(`laneClearance(action.hero,${JSON.stringify(spot)},action.defenders)`):0;
 for(let i=6;i<seconds*120;i++){if(run("action.phase")!=='dribble'&&i>10)break;run('tick(1/120)');}
 const p1=pos(),line=+run('action.offsideLine');
 return {lane0:l0,lane1:lane(),laneSpot,spot,line,moved:Math.hypot(p1.x-p0.x,p1.z-p0.z),p1};
}
if(process.argv[1].endsWith('scenario.mjs')){for(const s of [1,2,3,4])console.log(JSON.stringify(scenario({seed:s})));}
