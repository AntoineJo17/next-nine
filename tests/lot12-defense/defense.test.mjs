// Lot 12 · defense : une séquence qui commence avec le ballon chez l'adversaire (pressing) est une vraie situation défensive.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
import {pressing} from './_press.mjs';

test('pressing : UN seul toucher sur le porteur suffit pour le suivre jusqu\'au contact (porteur à 12 m)',()=>{
 let reached=0;for(let seed=1;seed<=12;seed++){const r=pressing(seed,12);if(r.minDist<1.3)reached++;}
 assert.ok(reached>=11,'le joueur rejoint le porteur après un seul toucher : '+reached+'/12');
});

test('pressing : après un seul toucher, la récupération du ballon est réaliste (ni jamais, ni toujours)',()=>{
 let won=0,n=0;for(let seed=1;seed<=40;seed++){const r=pressing(seed,5);n++;if(r.won)won++;}
 assert.ok(won/n>=.35,'récupérations après 1 toucher : '+won+'/'+n+' (avant correctif : 0)');
 assert.ok(won/n<=.8,'pas artificiellement facile : '+won+'/'+n);
});

test('pressing : le ballon ne se téléporte jamais (déplacement max par 1/120 s)',()=>{
 let max=0,wins=0;for(let seed=1;seed<=40;seed++){const r=pressing(seed,5,{tapEvery:20});max=Math.max(max,r.maxBallStep);if(r.won)wins++;}
 assert.ok(wins>=10,'assez de récupérations observées pour juger : '+wins);
 assert.ok(max<.3,'déplacement maximal du ballon en 1/120 s : '+max.toFixed(3)+' m (une passe à 25 m/s fait 0,21 m)');
});

test('pressing : le joueur n\'est jamais immobile loin du porteur après son toucher',()=>{
 let idle=0;for(let seed=1;seed<=20;seed++)idle=Math.max(idle,pressing(seed,10).idle);
 assert.ok(idle<.35,'temps maximal d\'attente passive : '+idle.toFixed(2)+' s');
});

test('pressing : sans geste, rien ne se passe (la scène attend le premier toucher) et la séquence ne reste jamais bloquée',()=>{
 const {run}=boot();run("$('play').onclick();action.started=true;");run("{const c=action.defenders[1];c.x=action.hero.x+1;c.z=action.hero.z-6;c.tacticalId=99;setupPress({carrierId:99});}");
 for(let i=0;i<300;i++)run('tick(1/120)');assert.equal(run('action.ended'),false);assert.equal(run('action.ready'),true);
 run('action.ready=false');for(let i=0;i<1000&&run("action.phase==='press'&&!action.ended");i++)run('tick(1/120)');assert.ok(run("action.phase!=='press'||action.ended"),'la séquence ne reste jamais bloquée');
});

test('pressing : un toucher loin du porteur coupe la passe (pas de poursuite automatique), et la passe lance le joueur sur sa trajectoire',()=>{
 const {run}=boot();run("$('play').onclick();action.started=true;");run("{const c=action.defenders[1];c.x=action.hero.x+1;c.z=action.hero.z-9;c.tacticalId=99;setupPress({carrierId:99});}");
 run('startGesture({clientX:200+(action.pressCarrier.x+9)*12,clientY:200+action.pressCarrier.z*8,preventDefault(){}})');
 assert.equal(run('!!action.pressChase'),false);
 run("action.pressCarrier.x=action.hero.x+2;action.pressCarrier.z=action.hero.z-2;action.pressure=1;action.pressChase=false;");
 for(let i=0;i<30&&!run('!!action.pressPass');i++)run('tick(1/120)');
 assert.equal(run('!!action.pressPass'),true,'le porteur a lâché la passe');assert.equal(run('action.pressChase'),false);
 assert.ok(run('!!action.runTarget'),'le joueur part sur la trajectoire de la passe');
});
