// AUDIT-1 · P1 : le ballon rasant traverse le corps d'un gardien en plongeon (keeperTouches ne teste que la main).
// Ces tests sont marqués « todo » : ils échouent aujourd'hui (bug confirmé) et passeront dès que le correctif de
// docs/audit-gameplay/physique-patches-game.md sera appliqué à dist/movement.js. Ils n'empêchent pas la suite de passer.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {keeperTouches,sweptKeeperTouch,KEEPER_BODY_BLOCK} from '../../dist/movement.js';
import {newGame} from './_game.mjs';

const diver=()=>({x:-.68,z:-19.25,y:-.22,state:'dive',dir:-1,reach:.35,tilt:-.6,diveDX:-.68,elapsed:.35});
const TODO='correctif movement.js à appliquer (docs/audit-gameplay/physique-patches-game.md, P1)';

test('P1 · une balle rasante à hauteur des jambes/du torse d’un gardien en plongeon le touche',{todo:KEEPER_BODY_BLOCK?false:'KEEPER_BODY_BLOCK désactivé (équilibrage à valider, −54 % de buts)'},()=>{
 const k=diver();
 assert.equal(keeperTouches({x:-.5,y:.22,z:-19.25},k),true,'au sol, à l’aplomb du gardien');
 assert.equal(keeperTouches({x:-.9,y:.55,z:-19.25},k),true,'à hauteur du torse couché');
 const path=sweptKeeperTouch({x:-.5,y:.22,z:-18.4},{x:-.5,y:.22,z:-20.3},k);
 assert.ok(path,'balayage : la balle qui file au ras du sol traverse le gardien');
});

test('P1 · le but n’est pas accordé à une balle qui traverse un gardien en plongeon (jeu réel)',{todo:KEEPER_BODY_BLOCK?false:'KEEPER_BODY_BLOCK désactivé (équilibrage à valider, −54 % de buts)'},()=>{
 const g=newGame(1);
 g.run(`const a=action;a.started=true;a.ready=false;a.defenders.forEach(d=>{d.x=30;d.z=40});a.teammates.forEach(d=>{d.x=-30;d.z=30});a.hero.x=0;a.hero.z=-6;
  const k=a.keeper;k.state='dive';k.elapsed=.3;k.dir=-1;k.diveStartX=0;k.diveDX=-.68;k.diveT=.3;k.jump=.2;k.noReact=true;
  a.ball={x:-.5,y:.22,z:-17.8,vx:0,vy:0,vz:-6,age:0,bounces:0,spin:0};a.phase='flight';a.flying=true;a.shotBy='hero';a.kicker=a.hero;a.loose=false;a.flightTime=0;a.contactIgnore=null;`);
 const o=g.drive({dts:1/120,maxT:3,afterT:.1,holdKeeper:.35});
 assert.notEqual(o.kind,'goal','la balle est passée à travers le corps du gardien : '+JSON.stringify({fc:o.firstCross,k:o.keeperAt}));
});

test('P1 (état actuel documenté) · un tir en pleine lucarne ne dépend pas du correctif : le gardien debout arrête toujours une balle de face',()=>{
 const k={x:0,z:-19.25,y:0,state:'set',dir:0,reach:0,tilt:0};
 assert.equal(keeperTouches({x:.2,y:1,z:-19.25},k),true);
 assert.equal(keeperTouches({x:2,y:1,z:-19.25},k),false);
});
