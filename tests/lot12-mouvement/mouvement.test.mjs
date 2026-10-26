// Lot 12 · mouvement : vitesse du héros plafonnée comme celle d'un défenseur, accélérations cohérentes, plus de freinage instantané en fin de conduite,
// et corps dessiné qui suit la position logique à vitesse bornée (plus de saut de 1,2 à 1,7 m à la réception aérienne, plus de retard de 0,9 m derrière un coureur).
// Le test de la conduite réelle applique en mémoire le remplacement de docs/audit-gameplay2/mouvement-patch.py si dist/game.js ne l'a pas encore reçu.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as T from '../../dist/vendor/three.module.js';import {Pitch3D} from '../../dist/engine.js';
import {moveToward,PACE} from '../../dist/movement.js';
import {boot} from '../gameplay-mouvement/harness-reel.mjs';

const mk=(extra={})=>({x:0,z:0,vx:0,vz:0,speed:0,angle:0,...extra});
function run(actor,target,speed,acc,brake,seconds,dt=1/120){const out=[];for(let t=0;t<seconds;t+=dt){const done=moveToward(actor,target,speed,dt,acc,brake);out.push(Math.hypot(actor.vx,actor.vz));if(done)break;}return out;}

test('le héros est plafonné à la vitesse de pointe d\'un défenseur qui presse (4,5 x PACE), même au niveau 39 (vitesse de carrière 5,2)',()=>{
 const hero=mk({isHero:true}),other=mk();
 const vh=run(hero,{x:0,z:-80},5.2,12,false,4),vo=run(other,{x:0,z:-80},5.2,12,false,4);
 assert.ok(Math.max(...vh)<=4.5*PACE+1e-6,'héros '+Math.max(...vh).toFixed(2)+' m/s');
 assert.ok(Math.max(...vo)>5.2*PACE-.05,'un autre joueur garde sa vitesse : '+Math.max(...vo).toFixed(2));
 assert.ok(Math.max(...vh)<=6.2,'le héros ne dépasse pas 6,2 m/s');
});

test('le héros ne démarre pas plus vite qu\'un défenseur (accélération plafonnée à 11 x PACE)',()=>{
 const hero=mk({isHero:true}),def=mk();
 const vh=run(hero,{x:0,z:-80},4.4,14,false,.3),vd=run(def,{x:0,z:-80},4.4,12,false,.3);
 assert.ok(vh.at(-1)<=vd.at(-1)+1e-6,`héros ${vh.at(-1).toFixed(2)} m/s après 0,3 s contre défenseur ${vd.at(-1).toFixed(2)}`);
});

test('freinage numérique : le porteur arrive en ralentissant (au plus 1,5 m/s au dernier pas) ; sans freinage (false) l\'ancien arrêt net est conservé',()=>{
 const a=mk({isHero:true}),v=run(a,{x:0,z:-9},4.4,14,14,4);
 assert.ok(v.at(-2)<1.8,'vitesse juste avant l\'arrivée '+v.at(-2).toFixed(2));
 let worst=0;for(let i=1;i<v.length-1;i++)worst=Math.max(worst,v[i-1]-v[i]);/* le dernier pas (arrivée sur la cible) est exclu : il pose le joueur à < 1,8 m/s */assert.ok(worst<=14*PACE/120+.05,'plus forte baisse en un pas : '+worst.toFixed(2));
 const b=mk({isHero:true}),w=run(b,{x:0,z:-9},4.4,14,false,4);assert.ok(w.at(-2)>5,'ancien comportement (brake=false) : '+w.at(-2).toFixed(2));
 const c=mk(),u=run(c,{x:0,z:-9},4.4,14,true,6);assert.ok(u.length>0&&Math.abs(c.z+9)<.05,'brake=true inchangé : arrive à la cible');
});

// --- conduite réelle ---
const OLD0="a.hero=make(hero);a.teammates=",NEW0="a.hero=make(hero);a.hero.controlled=true;a.teammates=";
const OLD1="*(held?.86:1),dt,14,false);attachBall(a.hero,true);",NEW1="*(held?.86:1),dt,14,24);attachBall(a.hero,true);";
const OLD2="if(!a.ended&&(reached||a.dribbleElapsed>1.7))controlAgain(",NEW2="if(!a.ended&&(reached||a.dribbleElapsed>2.3))controlAgain(";
const src=fs.readFileSync(new URL('../../dist/game.js',import.meta.url),'utf8');
const already=src.includes(NEW1)&&src.includes(NEW0);
test('les remplacements de game.js s\'appliquent exactement une fois (ou sont déjà appliqués)',()=>{
 assert.ok(already||(src.split(OLD0).length===2&&src.split(OLD1).length===2&&src.split(OLD2).length===2));
 if(process.env.STRICT_GAME_PATCHES)assert.ok(already&&src.includes(NEW2));
});

test('conduite réelle : le héros ne passe jamais de la course à l\'arrêt en un pas, et ne dépasse pas 6,2 m/s',()=>{
 const {run:r}=boot(undefined,{transform:s=>already?s:s.replace(OLD0,NEW0).replace(OLD1,NEW1).replace(OLD2,NEW2)});r("{let q=777;Math.random=()=>{q=(Math.imul(q,1103515245)+12345)>>>0;return (q%2147483648)/2147483648;};}");/* graine fixe (sinon une perte de balle aléatoire pouvait interrompre la conduite) */r("$('play').onclick();");r('career.baseLevel=39');/* niveau maximal : vitesse de carrière 5,2 au lieu de 4,4 */
 for(let k=0;k<20000&&!r('!!action&&action.ready&&!action.ended');k++)r('action.phase==="interval"?(action.interval.fast=true,tick(.04)):tick(1/60)');
 for(const [dx,dz] of [[0,-6],[3,-5],[-4,-3]]){
  r(`{const a=action,h=a.hero;h.x=0;h.z=10;h.vx=h.vz=0;h.speed=0;a.defenders.forEach((d,i)=>{d.x=-30+i;d.z=60;d.home={x:d.x,z:d.z};});beginDribble({x:${dx},z:${10+dz}});}`);
  let prev=0,worstDrop=0,vmax=0,endSpeed=null,steps=0;for(let k=0;k<400&&r("action.phase==='dribble'");k++){r('tick(1/120)');if(r("action.phase!=='dribble'")){endSpeed=prev;break;}const v=r('Math.hypot(action.hero.vx||0,action.hero.vz||0)');worstDrop=Math.max(worstDrop,prev-v);vmax=Math.max(vmax,v);prev=v;steps++;}
  assert.ok(worstDrop<=.2,`(${dx},${dz}) : plus forte baisse de vitesse en un pas 1/120 s = ${worstDrop.toFixed(2)} m/s`);
  assert.ok(vmax<=4.5*PACE+1e-6,'vitesse max '+vmax.toFixed(2));
  assert.ok(steps>20&&endSpeed!==null&&endSpeed<4.2,'vitesse juste avant la fin de la conduite '+endSpeed);
  r("if(action.phase!=='ready')controlAgain('x')");
 }
});

// --- rendu ---
function rig(){globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};const e=Object.create(Pitch3D.prototype);e.scene=new T.Scene();e.appearance={skin:'#c98b62',hair:'#28231e',number:9};e.players=[];return e;}

test('rendu : un décalage de 1,7 m (réception sous le ballon) est parcouru à moins de 0,25 m par image à 60 i/s et en moins de 0,3 s, avec les jambes qui marchent',()=>{
 const e=rig(),p=e.makePlayer(0,0,0x63b9f4,9,true);e.hero=p;const dt=1/60;
 e.posePlayer(p,{x:0,z:0,speed:0,angle:0,kickTimer:-1},dt,0);
 let prev=0,max=0,t=0,gait=0;for(;t<1;t+=dt){e.posePlayer(p,{x:1.7,z:0,speed:0,angle:0,kickTimer:-1},dt,t);max=Math.max(max,p.sx-prev);prev=p.sx;gait=Math.max(gait,p.gaitSpeed);if(Math.abs(p.sx-1.7)<1e-6)break;}
 assert.ok(max<=.25,'pas max '+max.toFixed(3));assert.ok(t<.3,'durée '+t.toFixed(2));assert.ok(gait>.8,'les jambes bougent : '+gait.toFixed(2));
});

test('rendu : un coureur à 6 m/s est dessiné à moins de 0,12 m de sa position logique (il était en retard de 0,5 à 0,9 m) ; une vraie coupure (> 2,2 m) reste instantanée',()=>{
 for(const fps of [30,60,144]){const e=rig(),p=e.makePlayer(0,0,0x63b9f4,9,true);e.hero=p;const dt=1/fps;let x=0,lag=0;
  e.posePlayer(p,{x,z:0,speed:0,angle:0,kickTimer:-1},dt,0);
  for(let t=0;t<2;t+=dt){x+=6*dt;e.posePlayer(p,{x,z:0,speed:6,angle:-Math.PI/2,kickTimer:-1},dt,t);lag=Math.max(lag,x-p.sx);}
  assert.ok(lag<=6*dt+1e-6,`${fps} i/s : retard ${lag.toFixed(3)} m`);
  e.posePlayer(p,{x:x+10,z:0,speed:0,angle:0,kickTimer:-1},dt,3);assert.equal(p.sx,x+10);}
});

test('rendu : une montée de tête de 0,65 m est répartie sur plusieurs images (9 m/s au plus) ; le gardien garde sa courbe',()=>{
 const e=rig(),p=e.makePlayer(0,0,0x63b9f4,9,true),k=e.makePlayer(0,0,0xffd23a,1,false);e.hero=p;e.keeper=k;const dt=1/60;
 e.posePlayer(p,{x:0,z:0,y:0,speed:0,angle:0,kickTimer:-1},dt,0);e.posePlayer(k,{x:0,z:0,y:0,speed:0,angle:0,kickTimer:-1},dt,0);
 e.posePlayer(p,{x:0,z:0,y:.65,speed:0,angle:0,kickTimer:-1},dt,dt);e.posePlayer(k,{x:0,z:0,y:.65,speed:0,angle:0,kickTimer:-1},dt,dt);
 assert.ok(p.g.position.y<=9*dt+1e-9,'héros y='+p.g.position.y.toFixed(3));assert.equal(k.g.position.y,.65);
 for(let i=0;i<10;i++)e.posePlayer(p,{x:0,z:0,y:.65,speed:0,angle:0,kickTimer:-1},dt,i);assert.equal(p.g.position.y,.65);
});
