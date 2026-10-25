// Audit mouvement · rendu des personnages (scène Three.js réelle, sans contexte WebGL) : vitesse de rotation du corps dessiné.
// Mesuré dans Chromium (Metal) : jusqu'à 75 rad/s (180° en ~4 images) pour un défenseur ou un partenaire réorienté par le jeu ; plafonné à 16 rad/s pour les autres joueurs.
import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from '../../dist/vendor/three.module.js';import {Pitch3D} from '../../dist/engine.js';
function rig(){globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};const e=Object.create(Pitch3D.prototype);e.scene=new T.Scene();e.appearance={skin:'#c98b62',hair:'#28231e',number:9};e.players=[];return e;}
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

test('un joueur adverse ou partenaire tourne au plus à 16 rad/s (un demi-tour dure au moins 0,19 s), à toutes les cadences',()=>{
 for(const fps of [30,60,144]){const dt=1/fps,e=rig(),p=e.makePlayer(0,0,0x63b9f4,9,true);e.hero=null;p.lastAngle=0;
  let prev=0,max=0,t=0;while(Math.abs(wrap(Math.PI-p.lastAngle))>.05&&t<2){e.posePlayer(p,{x:0,z:0,speed:0,angle:Math.PI,kickTimer:-1},dt,t);max=Math.max(max,Math.abs(p.lastAngle-prev));prev=p.lastAngle;t+=dt;}
  assert.ok(max<=16*dt+1e-9,`${fps} i/s : ${(max/dt).toFixed(1)} rad/s`);assert.ok(t>=.19,`${fps} i/s : demi-tour en ${t.toFixed(3)} s`);assert.ok(t<.5,'le demi-tour doit rester vif : '+t.toFixed(2)+' s');}
});

test('le personnage du joueur garde sa réponse immédiate (le ballon est collé à son orientation logique)',()=>{
 const e=rig(),p=e.makePlayer(0,0,0x63b9f4,9,true);e.hero=p;p.lastAngle=0;e.posePlayer(p,{x:0,z:0,speed:0,angle:Math.PI,kickTimer:-1},1/60,0);
 assert.ok(Math.abs(p.lastAngle)>16/60,'le héros ne doit pas être limité : '+p.lastAngle.toFixed(2));
});
