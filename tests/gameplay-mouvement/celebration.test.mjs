// Audit mouvement · célébration d'un but lointain.
// Constat (dist/game.js, celebrate()) : la course du buteur vers les supporters est coupée à 2,6 s quelle que soit la distance ; pour un but marqué à plus de ~17 m
// de la cible il s'arrête net (6,7 m/s -> 0 en une image) au milieu du terrain, à 9-16 m de sa cible, et exécute sa célébration là.
// Dist/game.js est hors du périmètre de cet audit : la correction est décrite dans docs/audit-gameplay/mouvement-patches-game.md et appliquée ICI en mémoire
// (même remplacement exact) pour prouver qu'elle règle le problème. Quand le superviseur l'aura appliquée à dist/game.js, ce test passe sans transformation.
// STRICT_GAME_PATCHES=1 : exige que dist/game.js contienne déjà la correction.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {boot} from './harness-reel.mjs';

export const OLD="if(d<.45||c.time>2.6){c.phase='perform';";
export const NEW="if(c.d0==null){c.d0=d;c.duration+=Math.max(0,d-14)/6;}if(d<.45||c.time>2.6+Math.max(0,c.d0-14)/6){c.phase='perform';";
const src=fs.readFileSync(new URL('../../dist/game.js',import.meta.url),'utf8');
const already=src.includes(NEW),applicable=src.split(OLD).length===2;

test('le correctif de célébration s\'applique exactement une fois (ou est déjà appliqué)',()=>{
 assert.ok(already||applicable,'ni l\'ancien texte unique ni le nouveau texte n\'est présent dans dist/game.js');
 if(process.env.STRICT_GAME_PATCHES)assert.ok(already,'dist/game.js n\'a pas encore reçu le correctif de docs/audit-gameplay/mouvement-patches-game.md');
});

function celebrationStop(startX,startZ){
 const {run}=boot(undefined,{transform:s=>already?s:s.replace(OLD,NEW)});run("$('play').onclick();");
 for(let k=0;k<20000&&!run('!!action&&action.ready&&!action.ended');k++)run('action.phase==="interval"?(action.interval.fast=true,tick(.04)):tick(1/60)');
 run(`{const a=action;a.hero.x=${startX};a.hero.z=${startZ};a.hero.vx=0;a.hero.vz=-5;a.hero.speed=5;a.ready=false;a.started=true;a.phase='flight';a.flying=true;a.shotBy='hero';a.ball={x:0,y:1,z:-19,vx:0,vy:0,vz:-5,age:0,bounces:0};resolve(true,'BUT','hero','goal');}`);
 let t=0;while(t<14&&!run('action.celebration?.phase==="perform"')){run('tick(1/120)');t+=1/120;}
 return JSON.parse(run('JSON.stringify({kind:action.celebration.kind,time:action.celebration.time,duration:action.celebration.duration,d:Math.hypot(action.hero.x-action.celebration.target.x,action.hero.z-action.celebration.target.z),v:Math.hypot(action.hero.vx,action.hero.vz)})'));
}

test('un but lointain : le buteur arrive à sa cible avant de célébrer (jamais d\'arrêt net en pleine course au milieu du terrain)',()=>{
 for(const [x,z] of [[0,-8],[0,8],[-12,15],[10,25]]){
  const r=celebrationStop(x,z);
  if(r.kind==='ball')continue;// « vite le ballon » (équipe menée) : autre course, sans célébration
  assert.ok(r.d<1.2||r.v<1,`départ (${x},${z}) : perform à ${r.d.toFixed(1)} m de la cible à ${r.v.toFixed(1)} m/s après ${r.time.toFixed(2)} s`);
  assert.ok(r.time<=r.duration,'la course ne doit pas dépasser la durée de la célébration');
 }
});
