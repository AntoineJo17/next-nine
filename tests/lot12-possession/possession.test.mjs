// Lot 12 · possession : une récupération de balle est un contact visible, pas une téléportation.
// Le test applique lui-même docs/audit-gameplay2/possession-patch.py sur une copie en mémoire de dist/game.js (le script est idempotent :
// une fois rejoué sur le dépôt principal, le test continue de passer).
import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
import {followBall,R} from '../../dist/physics.js';
import {segDist} from './obs.mjs';

const root=new URL('../../',import.meta.url).pathname;
function patchedSource(){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'poss-'));const f=path.join(tmp,'game.js');fs.copyFileSync(path.join(root,'dist/game.js'),f);
 if(fs.readFileSync(f,'utf8').includes('followBall')&&!process.env.LOT12_AVANT){const t=fs.readFileSync(f,'utf8');fs.rmSync(tmp,{recursive:true,force:true});return t;}// correctif déjà intégré à dist/game.js
 if(process.env.LOT12_AVANT){const t=fs.readFileSync(f,'utf8');fs.rmSync(tmp,{recursive:true,force:true});return t;}// LOT12_AVANT=1 : mesure sans le correctif
 const r=spawnSync('python3',['-I',path.join(root,'docs/audit-gameplay2/possession-patch.py'),f],{encoding:'utf8'});assert.equal(r.status,0,r.stderr+r.stdout);
 const s=fs.readFileSync(f,'utf8');fs.rmSync(tmp,{recursive:true,force:true});return s;}
const SRC=patchedSource();
const HOOK="function winBall(defender,message){try{(globalThis.__wins=globalThis.__wins||[]).push({bd:Math.hypot(action.ball.x-defender.x,action.ball.z-defender.z),ch:defender.challenge?defender.challenge.kind:null});}catch(e){}";
function fresh(seed){const {run}=boot(null,{transform:s=>SRC.replace(/^(import .*?;\n)+/,'').replace('});init();','});').replace('function winBall(defender,message){',HOOK)});
 run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);run("$('play').onclick();");
 let g=0;while(!run('action&&action.ready&&!action.ended')&&g++<4000){if(run('action&&action.phase')==='interval')run('action.interval.fast=true;tick(.04)');else run('tick(.04)');if(run('action&&action.ended&&action.after>1.2'))run("$('continue').onclick()");}
 assert.ok(run('action&&action.ready&&!action.ended'),'action prête');return run;}

test('followBall : pas plus de speed*dt par pas, jamais à travers un corps, converge vers le point de contrôle',()=>{
 const b={x:0,y:1,z:0,vx:9,vz:0,vy:0};let moved=0,prev={x:b.x,z:b.z};
 for(let i=0;i<300;i++){followBall(b,{x:2,y:R,z:0},1/120,9,[{x:1,z:0,r:.5}]);moved=Math.max(moved,Math.hypot(b.x-prev.x,b.z-prev.z));prev={x:b.x,z:b.z};assert.ok(Math.hypot(b.x-1,b.z)>=.5-1e-9,'le ballon ne rentre pas dans le corps');}
 assert.ok(moved<=9*1.6/120+1e-9,'déplacement limité par pas : '+moved);
 const c={x:0,y:R,z:0};let done=false;for(let i=0;i<200&&!done;i++)done=followBall(c,{x:1,y:R,z:0},1/120,9);assert.ok(done&&Math.abs(c.x-1)<.02,'arrive au point de contrôle');
});

test('winBall : le ballon reste où il a été touché (pas de téléportation) et garde sa hauteur',()=>{
 const run=fresh(3);
 run("{const a=action,d=a.defenders[0];a.ready=false;a.flying=true;a.phase='flight';a.ball={x:d.x+.4,y:1.1,z:d.z-.2,vx:0,vy:0,vz:-8,age:0,bounces:0};globalThis.__b0={x:a.ball.x,y:a.ball.y,z:a.ball.z};winBall(d,'Intercepté');}");
 const moved=run("Math.hypot(action.ball.x-__b0.x,action.ball.z-__b0.z)"),y=run('action.ball.y');
 assert.ok(moved<1e-9,'le ballon n’a pas bougé au moment du contact : '+moved);assert.ok(y>1,'hauteur conservée (pas écrasée au sol) : '+y);
 // ensuite il roule vers le défenseur, à vitesse physique
 let worst=0;for(let i=0;i<240;i++){const b0=run('({x:action.ball.x,z:action.ball.z})');run('tick(1/120)');const b1=run('({x:action.ball.x,z:action.ball.z})');worst=Math.max(worst,Math.hypot(b1.x-b0.x,b1.z-b0.z));}
 assert.ok(worst<=9*1.6/120+1e-6,'aucun saut du ballon par pas de 1/120 s : '+worst);
 const d=run('Math.hypot(action.ball.x-action.newOwner.x,action.ball.z-action.newOwner.z)');assert.ok(d<.8,'le ballon est ensuite au pied du défenseur : '+d);
});

test('tacle glissé gagné : le défenseur reste au sol jusqu’au bout de son geste (la jambe n’est plus coupée)',()=>{
 const run=fresh(4);
 run("{const a=action,d=a.defenders[0];beginChallenge(d,{x:d.x,y:R,z:d.z-2},'slide');d.challenge.time=.3;a.ready=false;winBall(d,'Tacle');}");
 assert.equal(run("action.newOwner.challenge&&action.newOwner.challenge.kind"),'slide');
});

test('balayage de duels : récupération = contact (pied ou corps), saut du ballon < 0,2 m par pas, jamais à travers le héros',()=>{
 const angles=[-2.6,-1.57,1.57,2.6,3.14,0],dists=[.9,1.3,2];let n=0,wins=0,worstStep=0,worstFirst=0,minHero=9,far=0;
 for(const ang of angles)for(const dist of dists)for(let rep=0;rep<5;rep++){
  const seed=++n,run=fresh(seed);
  run(`__wins=[];attachBall(action.hero);{const a=action,h=a.hero,d=a.defenders[0];h.vx=0;h.vz=0;d.x=h.x+Math.sin(${ang})*${dist};d.z=h.z-Math.cos(${ang})*${dist};d.challenge=null;d.challengeCooldown=0;a.defenders.forEach((q,i)=>{if(q!==d){q.x=h.x+(i%2?14:-14);q.z=h.z-20+i;}});a.pressIndex=0;h.angle=0;attachBall(h);beginDribble({x:h.x+.4,z:h.z-4});}`);
  let t=0,won=false,prev=null;
  while(t<4&&!run('action.ended'))
  {const b0=run('({x:action.ball.x,z:action.ball.z})');run('tick(1/120)');t+=1/120;const b1=run('({x:action.ball.x,z:action.ball.z})');if(run('__wins.length')>0&&!won){won=true;wins++;worstFirst=Math.max(worstFirst,Math.hypot(b1.x-b0.x,b1.z-b0.z));if(run('__wins[0].bd')>1.3)far++;}}
  if(!won)continue;
  for(let i=0;i<180;i++){const b0=run('({x:action.ball.x,z:action.ball.z})');run('tick(1/120)');const q=run('({x:action.ball.x,z:action.ball.z,hx:action.hero.x,hz:action.hero.z})');worstStep=Math.max(worstStep,Math.hypot(q.x-b0.x,q.z-b0.z));minHero=Math.min(minHero,Math.hypot(q.x-q.hx,q.z-q.hz));}
 }
 assert.ok(wins>=20,'assez de récupérations observées : '+wins);
 assert.equal(far,0,'aucune récupération sans contact (ballon à plus de 1,3 m du défenseur)');
 assert.ok(worstFirst<.2,'saut du ballon au moment de la récupération : '+worstFirst);
 assert.ok(worstStep<.13,'saut maximal du ballon par pas de 1/120 s ensuite : '+worstStep);
 assert.ok(minHero>=.35,'le ballon ne traverse pas le héros : '+minHero);
});
