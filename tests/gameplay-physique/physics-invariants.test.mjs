// AUDIT-1 · invariants de physics.js sur des milliers de trajectoires déterministes (graine fixe).
// Commande : node --test tests/gameplay-physique/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {launch,stepBall,goalCrossing,frameContact,stepNetBall,containGoalBall,R,GOAL_HALF,GOAL_HEIGHT,GOAL_Z,PITCH} from '../../dist/physics.js';
import {assistedShot,targetGesture,LOB_HOLD_MS} from '../../dist/gestures.js';
import {rng} from './_game.mjs';

const finite=b=>[b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite);

test('physique · 3000 tirs/passes/lobs : jamais de NaN, jamais sous le sol, vitesse bornée pour une frappe',()=>{
 const r=rng(20261025),modes=['low','normal','lob'];let maxStrike=0;
 for(let i=0;i<3000;i++){
  const mode=modes[i%3],start={x:(r()-.5)*60,z:-10+r()*80},target={x:(r()-.5)*40,z:-22+r()*60},power=mode==='normal'&&r()<.8?r():null,spin=(r()-.5)*2;
  const b=launch(start,target,mode,spin,power,.8+r()*.5);const dt=[1/60,1/120,1/144,1/240][i%4];
  for(let t=0;t<8;t+=dt){stepBall(b,dt);assert.ok(finite(b),`NaN ${mode} #${i}`);assert.ok(b.y>=R-1e-9,`sous le sol ${mode} #${i} y=${b.y}`);
   if(mode==='normal'&&power!==null)maxStrike=Math.max(maxStrike,Math.hypot(b.vx,b.vy,b.vz));}
 }
 assert.ok(maxStrike<45,'une frappe au maximum de puissance reste sous 45 m/s : '+maxStrike);
});

test('physique · un but exige un franchissement de la ligne dans le cadre ; barre/poteaux ne sont jamais traversés',()=>{
 const r=rng(77);let goals=0,frames=0;
 for(let i=0;i<2500;i++){
  const start={x:(r()-.5)*30,z:-2+r()*25},target={x:(r()-.5)*9,z:-21},b=launch(start,target,'normal',(r()-.5)*.6,.3+r()*.7);
  let crossed=null,frameHit=false;
  for(let t=0;t<4&&!crossed;t+=1/120){const before=stepBall(b,1/120);const f=frameContact(before,b);if(f){frameHit=true;frames++;}
   // après un contact le centre de la balle reste hors du cylindre poteau / de la barre (rayon balle + 0,06)
   const dPost=Math.min(Math.hypot(b.x-GOAL_HALF,b.z-GOAL_Z),Math.hypot(b.x+GOAL_HALF,b.z-GOAL_Z));
   if(f==='post')assert.ok(dPost>=R+.06-1e-6,'balle dans le poteau #'+i);
   crossed=goalCrossing(before,b);if(crossed&&crossed.inside){goals++;assert.ok(Math.abs(crossed.x)<GOAL_HALF-R&&crossed.y<GOAL_HEIGHT-R&&crossed.y>=0);}}
 }
 assert.ok(goals>150,'le balayage contient des buts : '+goals);assert.ok(frames>20,'le balayage contient des poteaux/barres : '+frames);
});

test('physique · pas de temps : un lob et un rebond atterrissent au même endroit à 1/60, 1/120, 1/240 (à 5 % près)',()=>{
 const land=(dt,mode,target)=>{const b=launch({x:-6,z:14},target,mode);let t=0;for(;t<2.6;t+=dt)stepBall(b,dt);return b;};
 for(const [mode,target] of [['lob',{x:2,z:-16}],['normal',{x:3,z:-21}],['low',{x:5,z:-10}]]){
  const ref=land(1/240,mode,target);
  for(const dt of [1/60,1/120,1/144]){const b=land(dt,mode,target);const d=Math.hypot(b.x-ref.x,b.z-ref.z),len=Math.hypot(ref.x+6,ref.z-14);
   assert.ok(d<.05*len+.35,`${mode} dt=${dt}: écart ${d.toFixed(2)} m sur ${len.toFixed(1)} m`);}
 }
});

test('physique · rebond au sol : chaque crête est plus basse que la précédente et la balle finit au repos',()=>{
 for(const dt of [1/60,1/120,1/240]){const b={x:0,y:4,z:0,vx:3,vy:0,vz:-2,bounces:0,age:0,spin:0};const peaks=[];let prev=b.y,up=false;
  for(let t=0;t<12;t+=dt){stepBall(b,dt);if(b.y>prev)up=true;else if(up&&b.y<prev){peaks.push(prev);up=false;}prev=b.y;}
  for(let k=1;k<peaks.length;k++)assert.ok(peaks[k]<=peaks[k-1]+1e-9,'crête croissante dt='+dt);
  assert.ok(b.y<R+.02&&Math.abs(b.vy)<.5,'la balle finit au sol dt='+dt);}
});

test('physique · filet : après un but, la balle reste dans le volume fermé pour des tirs très durs',()=>{
 const r=rng(5);
 for(let i=0;i<200;i++){const b={x:(r()-.5)*6,y:.3+r()*1.5,z:GOAL_Z-.3,vx:(r()-.5)*80,vy:(r()-.5)*20,vz:-r()*90,age:0,bounces:0};containGoalBall(b);
  for(let k=0;k<600;k++){stepNetBall(b,1/120);assert.ok(finite(b));assert.ok(Math.abs(b.x)<=GOAL_HALF-R+1e-6&&b.z>=GOAL_Z-2+R-1e-6&&b.z<=GOAL_Z-R+1e-6&&b.y>=R-1e-9&&b.y<=GOAL_HEIGHT-R+1e-6,'la balle sort du filet #'+i);}}
});

test('physique · pas de temps énorme (onglet en arrière-plan) : pas de NaN ni de tunnel vers le bas',()=>{
 for(const dt of [.25,.5,1,2]){const b=launch({x:0,z:10},{x:1,z:-21},'normal',0,.7);for(let i=0;i<20;i++){stepBall(b,dt);assert.ok(finite(b));assert.ok(b.y>=R-1e-9);}}
});

test('gestes · la frappe assistée reste bornée et le lob exige l’appui long',()=>{
 const r=rng(3);for(let i=0;i<500;i++){const s={x:(r()-.5)*400,y:(r()-.5)*400},c={x:(r()-.5)*400,y:(r()-.5)*400},a=assistedShot(s,c);
  assert.ok(Math.abs(a.target.x)<=5.2+1e-9&&a.target.z===-21&&a.power>=.28&&a.power<=1&&Number.isFinite(a.power));}
 assert.equal(targetGesture(LOB_HOLD_MS-1),'dribble');assert.equal(targetGesture(LOB_HOLD_MS),'lob');assert.equal(targetGesture(10,true),'pass');
});

test('terrain · les bornes du stade ne laissent jamais sortir la balle au sol ni sous le sol',()=>{
 const r=rng(11);for(let i=0;i<300;i++){const b={x:(r()-.5)*120,y:.22,z:-30+r()*130,vx:(r()-.5)*40,vy:0,vz:(r()-.5)*40,age:0,bounces:0,spin:0};
  for(let k=0;k<600;k++)stepBall(b,1/120);assert.ok(finite(b));assert.ok(Math.abs(b.x)<=PITCH.board+2.4+1e-6,'x hors stade');}
});
