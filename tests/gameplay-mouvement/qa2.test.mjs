// Audit QA2 · deux anomalies d'animation relevées par la seconde équipe QA, reproduites puis corrigées.
//  1. Coup franc : le mur est placé épaule contre épaule (.62 m) mais la séparation des corps exige .82 m : au premier pas, deux défenseurs
//     étaient poussés de ~0,3 m en une image (17 m/s). Le mur est maintenant espacé de .84 m.
//  2. Rendu : le personnage du joueur tournait sans limite (jusqu'à ~70 rad/s en un demi-tour) ; il est désormais plafonné à 30 rad/s.
import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from '../../dist/vendor/three.module.js';import {Pitch3D} from '../../dist/engine.js';
import {boot} from './harness-reel.mjs';

test('coup franc : les joueurs du mur ne sont pas poussés au premier pas (aucun saut > 5 cm)',()=>{
 for(const [bx,bz] of [[-6,-2],[0,0],[7,-3],[10,1]]){
  const {run}=boot();run("$('play').onclick();");
  run(`match.index=1;setup();action.hero.x=${bx};action.hero.z=${bz};action.ball.x=${bx};action.ball.z=${bz};setupFreeKick();windUp(action.hero,{x:0,z:-21},'normal','hero');`);
  const before=JSON.parse(run("JSON.stringify([...action.defenders,...action.teammates].map(p=>[p.x,p.z]))"));
  run('tick(1/120)');
  const after=JSON.parse(run("JSON.stringify([...action.defenders,...action.teammates].map(p=>[p.x,p.z]))"));
  const worst=Math.max(...after.map((c,i)=>Math.hypot(c[0]-before[i][0],c[1]-before[i][1])));
  assert.ok(worst<.05,`balle (${bx},${bz}) : saut de ${(worst*100).toFixed(0)} cm en un pas de 1/120 s`);
 }
});

test('le personnage du joueur tourne au plus à 30 rad/s à l’écran, à toutes les cadences',()=>{
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 for(const fps of [30,60,144]){
  const dt=1/fps,e=Object.create(Pitch3D.prototype);e.scene=new T.Scene();e.appearance={skin:'#c98b62',hair:'#28231e',number:9};e.players=[];
  const p=e.makePlayer(0,0,0x63b9f4,9,true);e.hero=p;p.lastAngle=0;let prev=0,max=0,t=0;
  while(Math.abs(wrap(Math.PI-p.lastAngle))>.05&&t<2){e.posePlayer(p,{x:0,z:0,speed:0,angle:Math.PI,kickTimer:-1},dt,t);max=Math.max(max,Math.abs(p.lastAngle-prev));prev=p.lastAngle;t+=dt;}
  assert.ok(max<=30*dt+1e-9,`${fps} i/s : ${(max/dt).toFixed(1)} rad/s`);
  assert.ok(t<.4,`le demi-tour du joueur reste vif : ${t.toFixed(2)} s`);
 }
});
