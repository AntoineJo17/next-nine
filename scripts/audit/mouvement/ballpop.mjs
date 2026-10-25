// Le ballon change-t-il de côté d'un pas à l'autre quand le joueur démarre un dribble dans une autre direction ? (usage : node scripts/audit/mouvement/ballpop.mjs)
import {boot} from '../../../tests/gameplay-mouvement/harness-reel.mjs';
const {run}=boot();
const toReady=()=>{if(!run('!!match'))run("$('play').onclick();");for(let k=0;k<20000&&!run('!!action&&action.ready&&!action.ended&&action.phase!=="aerial"');k++){run('action?(action.phase==="interval"?(action.interval.fast=true,tick(.04)):action.ended?(action.after>1.2?$("continue").onclick():tick(1/60)):tick(1/60)):0');}};
for(const deg of [0,45,90,135,180]){
 toReady();
 // le joueur regarde vers le but (angle 0) ; il dribble dans une direction faisant `deg` degrés par rapport à cette direction
 run(`{const a=action,h=a.hero;h.angle=0;h.vx=0;h.vz=0;h.x=0;h.z=5;a.defenders.forEach(d=>{d.x=30;d.z=40;});attachBall(h);const r=${deg}*Math.PI/180;beginDribble({x:h.x+Math.sin(r)*-4*-1,z:h.z-Math.cos(r)*4});}`);
 let maxJump=0,maxAng=0,prevB=JSON.parse(run('JSON.stringify(action.ball)')),prevA=run('action.hero.angle');
 for(let i=0;i<60;i++){run('tick(1/120)');const b=JSON.parse(run('JSON.stringify(action.ball)')),ang=run('action.hero.angle');maxJump=Math.max(maxJump,Math.hypot(b.x-prevB.x,b.z-prevB.z));maxAng=Math.max(maxAng,Math.abs(Math.atan2(Math.sin(ang-prevA),Math.cos(ang-prevA))));prevB=b;prevA=ang;}
 console.log(`dribble à ${deg}° du regard : plus grand saut du ballon en 1/120 s = ${maxJump.toFixed(2)} m, plus grand saut d'angle du joueur = ${(maxAng*57.3).toFixed(0)}°`);
 run("{action.ended=true;action.after=2;}");
}
