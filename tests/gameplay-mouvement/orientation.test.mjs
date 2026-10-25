// Audit mouvement · orientation : le corps tourne à vitesse limitée (plus de demi-tour en un pas), le ballon ne change plus de côté d'un coup.
// Avant correction : moveToward fixait l'angle sur la direction de la vitesse à chaque pas ; un dribble à 90° du regard faisait sauter le ballon de 0,84 m
// autour du joueur en 1/120 s, et un défenseur qui démarre en sens inverse faisait demi-tour dans une seule image.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {moveToward,pressDefender,turnToward,TURN_RATE} from '../../dist/movement.js';
import {boot} from './harness-reel.mjs';

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

test('moveToward : l\'angle ne tourne jamais plus vite que TURN_RATE, quelle que soit la direction demandée',()=>{
 for(const dt of [1/144,1/120,1/60,1/30]){
  const a={x:0,z:0,vx:0,vz:0,angle:0};let prev=a.angle,maxStep=0;
  const targets=[{x:0,z:-30},{x:30,z:0},{x:0,z:30},{x:-30,z:0},{x:0,z:-30}];
  for(const t of targets)for(let i=0;i<Math.round(1.2/dt);i++){moveToward(a,t,4.5,dt,12,false);maxStep=Math.max(maxStep,Math.abs(wrap(a.angle-prev)));prev=a.angle;}
  assert.ok(maxStep<=TURN_RATE*dt+1e-9,`dt=${dt.toFixed(4)} : saut d'angle ${(maxStep*57.3).toFixed(1)}° > ${(TURN_RATE*dt*57.3).toFixed(1)}°`);
 }
});

test('moveToward : un demi-tour à l\'arrêt se fait en moins de 0,4 s et suit le chemin le plus court',()=>{
 const a={x:0,z:0,vx:0,vz:0,angle:3};let t=0;
 // vitesse vers -x : angle cible = atan2(+v,0) = +pi/2 ; l'angle de départ 3 rad doit redescendre (chemin court) et non faire le tour par 0
 while(Math.abs(wrap(a.angle-Math.PI/2))>.01&&t<1){const before=a.angle;moveToward(a,{x:-30,z:0},4.5,1/120,12,false);t+=1/120;assert.ok(Math.abs(wrap(a.angle-Math.PI/2))<=Math.abs(wrap(before-Math.PI/2))+1e-9,'l\'angle s\'éloigne de sa cible');}
 assert.ok(t<.4,'demi-tour trop lent : '+t.toFixed(2)+' s');
 const b={x:0,z:0,vx:0,vz:0,angle:0};moveToward(b,{x:0,z:30},4.5,1/120);assert.ok(Math.abs(b.angle)<TURN_RATE/120+1e-9&&Math.abs(b.angle)>0,'le premier pas ne doit pas faire demi-tour d\'un coup');
});

test('turnToward : angle absent ou NaN = orientation immédiate ; grand dt = orientation atteinte',()=>{
 const a={};turnToward(a,1.2,1/120);assert.equal(a.angle,1.2);const b={angle:NaN};turnToward(b,-2,1/120);assert.equal(b.angle,-2);
 const c={angle:0};turnToward(c,3,.5);assert.equal(c.angle,3);
});

test('pressDefender : un défenseur qui démarre dos au porteur se retourne en plusieurs pas',()=>{
 const d={x:0,z:0,vx:0,vz:0,angle:Math.PI,home:{x:0,z:0}},carrier={x:0,z:-10},ball={x:0,z:-9.6};
 let prev=d.angle,maxStep=0;for(let i=0;i<60;i++){pressDefender(d,carrier,ball,{x:0,z:-20},1/120,true,false,null,1);maxStep=Math.max(maxStep,Math.abs(wrap(d.angle-prev)));prev=d.angle;}
 assert.ok(maxStep<=TURN_RATE/120+1e-9,'saut d\'angle '+(maxStep*57.3).toFixed(0)+'°');
});

test('jeu réel : un dribble dans une autre direction que le regard ne fait plus sauter le ballon autour du joueur',()=>{
 for(const deg of [45,90,135,180]){
  const {run}=boot();run("$('play').onclick();");
  for(let k=0;k<20000&&!run('!!action&&action.ready&&!action.ended&&action.phase==="ready"');k++)run('action.phase==="interval"?(action.interval.fast=true,tick(.04)):tick(1/60)');
  run(`{const a=action,h=a.hero;h.angle=0;h.vx=0;h.vz=0;h.x=0;h.z=5;a.defenders.forEach(d=>{d.x=30;d.z=40;});a.teammates.forEach(d=>{d.x=-30;d.z=40;});attachBall(h);const r=${deg}*Math.PI/180;beginDribble({x:Math.sin(r)*4,z:5-Math.cos(r)*4});}`);
  let maxJump=0,prev=JSON.parse(run('JSON.stringify(action.ball)'));
  for(let i=0;i<80;i++){run('tick(1/120)');const b=JSON.parse(run('JSON.stringify(action.ball)'));maxJump=Math.max(maxJump,Math.hypot(b.x-prev.x,b.z-prev.z));prev=b;}
  assert.ok(maxJump<.25,`dribble à ${deg}° : le ballon a sauté de ${maxJump.toFixed(2)} m en 1/120 s`);
 }
});
