// AUDIT-4 · Gestes : doigts multiples, annulations, quitter/aide pendant un geste, retour d'onglet, relances.
// Exécution : node --test tests/gameplay-controles/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {boot,toChance} from './harness.mjs';

const ballXY=g=>g.run('engine.ballScreen()');
/** Place une occasion « à la main » : le héros en ready, balle collée. */
function ready(seed){const g=boot({seed});toChance(g);g.run("controlAgain('test');");return g;}
const phase=g=>g.run('action?action.phase:null');

test('un second doigt posé pendant un geste est ignoré : une seule frappe au relâchement du premier',()=>{
 const g=ready(11);const b=ballXY(g);
 g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x,b.y+60,1);
 assert.equal(g.run('!!drag'),true);
 g.pointer('pointerdown',b.x+80,b.y-50,2);g.pointer('pointerup',b.x+80,b.y-50,2);
 assert.equal(phase(g),'ready','le doigt 2 ne déclenche rien');
 assert.equal(g.run('drag.id'),1,'le geste du doigt 1 reste actif');
 g.pointer('pointerup',b.x,b.y+60,1);
 assert.equal(phase(g),'windup');assert.equal(g.run('!!drag'),false);
 g.pointer('pointerup',b.x,b.y+60,1);g.pointer('lostpointercapture',b.x,b.y+60,1);
 assert.equal(phase(g),'windup','un pointerup tardif ne redéclenche pas');
 assert.deepEqual(g.errors,[]);
});

test('pointercancel / lostpointercapture annulent le geste sans action ni visée résiduelle',()=>{
 for(const type of ['pointercancel','lostpointercapture']){
  const g=ready(12);const b=ballXY(g);
  g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x,b.y+70,1);
  g.engine.aim.visible=true;
  g.pointer(type,b.x,b.y+70,1);
  assert.equal(g.run('!!drag'),false,type);assert.equal(g.engine.aim.visible,false,type);
  g.pointer('pointerup',b.x,b.y+70,1);
  assert.equal(phase(g),'ready','après '+type+' un pointerup tardif est sans effet');
 }
});

test('quitter pendant un geste : plus de geste, de match ni de visée ; un pointerup tardif ne lève rien',()=>{
 const g=ready(13);const b=ballXY(g);
 g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x,b.y+70,1);
 g.run("$('leave').onclick()");
 assert.equal(g.run('!!drag||!!action||!!match'),false);
 g.pointer('pointermove',b.x,b.y+80,1);g.pointer('pointerup',b.x,b.y+80,1);g.pointer('lostpointercapture',b.x,b.y+80,1);
 g.frame();
 assert.deepEqual(g.errors,[]);
});

test('ouvrir l’aide pendant un geste annule le geste ; l’action est figée tant que l’aide est ouverte',()=>{
 const g=ready(14);const b=ballXY(g);
 g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x,b.y+50,1);
 g.run("$('gestureHelp').onclick()");
 assert.equal(g.run('!!drag'),false);assert.equal(g.run('guideOpen'),true);
 g.pointer('pointerdown',b.x,b.y,1);assert.equal(g.run('!!drag'),false,'aucun geste sous l’aide');
 const sim=g.run('action.sim');for(let i=0;i<30;i++)g.frame();
 assert.equal(g.run('action.sim'),sim);
 g.run("$('guideClose').onclick()");assert.equal(g.run('guideOpen'),false);
});

test('onglet masqué : rien n’avance ; au retour un énorme écart d’horloge ne fait avancer que 40 ms',()=>{
 const g=boot({seed:15});g.run("$('play').onclick()");for(let i=0;i<20;i++)g.frame();
 const m0=g.run('match.minute');
 g.run('document.hidden=true');for(let i=0;i<120;i++)g.frame(16.7);
 assert.equal(g.run('match.minute'),m0,'masqué : minute figée');
 g.run('document.hidden=false');
 g.frame(16.7);const m1=g.run('match.minute');g.frame(600000);const m2=g.run('match.minute');
 assert.ok(m2-m1<0.2,'un saut de 10 minutes d’horloge est borné par le dt maximal (écart '+(m2-m1)+')');
 assert.deepEqual(g.errors,[]);
});

test('quitter puis relancer 25 fois : aucun XP, aucune partie comptée, aucun état résiduel',()=>{
 const g=boot({seed:16});const c0=g.run('({xp:career.xp,games:career.games,goals:career.goals})');
 for(let i=0;i<25;i++){
  g.run("$('play').onclick()");for(let k=0;k<40+i*7;k++)g.frame();
  const b=g.run('action&&action.ready?engine.ballScreen():null');
  if(b){g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x,b.y+60,1);}
  g.run("$('leave').onclick()");
  assert.equal(g.run('!!action||!!match||!!drag||guideOpen||!!replay'),false);
  assert.equal(g.run("document.getElementById('home').hidden"),false);
  const e=g.run('career.energy');assert.ok(e>=0&&e<=100&&Number.isFinite(e));
 }
 assert.deepEqual(g.run('({xp:career.xp,games:career.games,goals:career.goals})'),c0);
 assert.deepEqual(g.errors,[]);
});

test('fin de match : XP et parties comptés une seule fois, score = événements',()=>{
 const g=boot({seed:17});g.run("$('play').onclick()");
 let guard=0;while(g.run('!!match')&&guard++<400000){g.run("action&&action.interval&&(action.interval.speed=2)");g.frame();
  if(g.run('!!action&&action.ready&&action.phase!=="interval"'))g.run("windUp(action.hero,{x:0,z:-21},'normal','hero',0,.8)");}
 assert.equal(g.run('!!match'),false);
 assert.equal(g.run('career.games'),1);
 const [us,them]=g.run('career.last').match(/(\d+) – (\d+)/).slice(1).map(Number);
 const ev=g.run("document.getElementById('resultEvents').textContent");
 assert.equal((ev.match(/AC Rivage/g)||[]).length,us);assert.equal((ev.match(/Adversaire/g)||[]).length,them);
 const xp=g.run('career.xp');g.frame();g.frame();assert.equal(g.run('career.xp'),xp,'pas de second finish');
 assert.deepEqual(g.errors,[]);
});

// C1 · Geste commencé pendant un dribble (kind « skill ») et relâché après la fin du dribble : il ne doit PAS devenir
// une passe/lob involontaire vers le doigt (avant correction : windUp 'lob' vers l'arrière au relâchement).
function dribbleThenHoldFinger(seed,{lateral=false}={}){
 const g=boot({seed});toChance(g);
 g.run("controlAgain('t');for(const d of action.defenders){d.x=40;d.z=30;d.home={x:40,z:30};}");
 const h=g.run('engine.actorScreen(action.hero)');
 g.pointer('pointerdown',h.x+30,h.y-60,1);g.pointer('pointerup',h.x+30,h.y-60,1);
 assert.equal(phase(g),'dribble');
 const b=g.run('engine.ballScreen()');
 g.pointer('pointerdown',b.x,b.y,1);assert.equal(g.run('drag.kind'),'skill');
 g.pointer('pointermove',b.x,b.y+40,1);g.pointer('pointermove',b.x,b.y+90,1);
 for(let i=0;i<400&&phase(g)==='dribble';i++)g.frame();
 assert.equal(phase(g),'ready','le dribble est terminé, le doigt est encore posé');
 return {g,b};
}
test('C1 · geste de dribble relâché après la fin du dribble : aucune frappe ni passe involontaire',()=>{
 const {g,b}=dribbleThenHoldFinger(31);
 g.pointer('pointerup',b.x,b.y+90,1);
 assert.equal(phase(g),'ready','pas de windup involontaire');assert.equal(g.run('action.windup===undefined||action.windup===null'),true);
 assert.equal(g.run('!!drag'),false);assert.equal(g.engine.aim.visible,false);
 // et le joueur peut ensuite jouer normalement : tirer vers soi depuis la balle déclenche bien une frappe
 const b2=g.run('engine.ballScreen()');
 g.pointer('pointerdown',b2.x,b2.y,1);g.pointer('pointermove',b2.x,b2.y+70,1);g.pointer('pointerup',b2.x,b2.y+70,1);
 assert.equal(phase(g),'windup');assert.equal(g.run('action.windup.mode'),'normal');
 assert.deepEqual(g.errors,[]);
});
