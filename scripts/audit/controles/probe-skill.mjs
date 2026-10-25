// Sonde : geste commencé PENDANT un dribble (kind 'skill') puis dribble terminé avant le relâchement.
import {boot,toChance} from '../../../tests/gameplay-controles/harness.mjs';
const g=boot({seed:31});toChance(g);g.run("controlAgain('t');for(const d of action.defenders){d.x=40;d.z=30;d.home={x:40,z:30};}");
const h=g.run('engine.actorScreen(action.hero)');
// 1) un tap sur l'herbe devant lance un dribble
g.pointer('pointerdown',h.x+30,h.y-60,1);g.pointer('pointerup',h.x+30,h.y-60,1);
console.log('phase après tap herbe',g.run('action.phase'));
// 2) pendant le dribble, doigt posé sur le ballon puis tiré vers soi
const b=g.run('engine.ballScreen()');
g.pointer('pointerdown',b.x,b.y,1);console.log('drag kind',g.run('drag&&drag.kind'));
g.pointer('pointermove',b.x,b.y+40,1);g.pointer('pointermove',b.x,b.y+90,1);
for(let i=0;i<400&&g.run('action.phase')==='dribble';i++)g.frame();
console.log('phase après fin du dribble, doigt toujours posé :',g.run('action.phase'),'drag',g.run('!!drag'),'ready',g.run('action.ready'));
g.pointer('pointerup',b.x,b.y+90,1);
console.log('phase après relâchement :',g.run('action.phase'),'windup',g.run('action.windup&&JSON.stringify({mode:action.windup.mode,target:action.windup.target,power:action.windup.power})'),'feedback',g.run("$('feedback').textContent"));
console.log('erreurs',g.errors);
