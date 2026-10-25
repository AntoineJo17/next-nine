// Sonde : parcours complet du mode entraînement (6 leçons) avec les vrais gestes.
import {boot} from '../../../tests/gameplay-controles/harness.mjs';
const g=boot({seed:41});
g.run("$('practice').onclick()");
const phase=()=>g.run('action?action.phase:null');
const log=[];
const settle=()=>{for(let i=0;i<900;i++){g.frame();const p=phase();if(p==='ended'||(p==='ready'&&i>5&&g.run('!action.flying')))break;}};
for(let lesson=0;lesson<6;lesson++){
 let tries=0;
 while(!g.run('match.learned')&&tries++<8){
  settle();
  if(g.run('action.ended')){g.run("$('lessonRetry').onclick()");}
  const h=g.run('engine.actorScreen(action.hero)'),b=g.run('engine.ballScreen()'),m=g.run('action.teammates[0]?engine.actorScreen(action.teammates[0]):null');
  if(lesson===0){g.pointer('pointerdown',h.x+20,h.y-50,1);g.pointer('pointerup',h.x+20,h.y-50,1);}
  if(lesson===1){
   g.pointer('pointerdown',h.x+10,h.y-40,1);g.pointer('pointerup',h.x+10,h.y-40,1);
   const hh=g.run('engine.actorScreen(action.hero)');g.pointer('pointerdown',hh.x,hh.y+10,1);
   for(let k=1;k<=6;k++){g.dateState.now+=15;g.pointer('pointermove',hh.x+k*20,hh.y+10,1);}
   g.pointer('pointerup',hh.x+120,hh.y+10,1);}
  if(lesson===2&&m){g.pointer('pointerdown',m.x,m.y,1);g.pointer('pointerup',m.x,m.y,1);}
  if(lesson===3&&m){g.pointer('pointerdown',m.x,m.y,1);g.dateState.now+=700;g.frame(0);g.pointer('pointerup',m.x,m.y,1);}
  if(lesson>=4){if(lesson===5)g.run('setShotCurve(.35)');g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x,b.y+40,1);g.pointer('pointermove',b.x+10,b.y+80,1);g.pointer('pointerup',b.x+10,b.y+80,1);}
  for(let i=0;i<30;i++)g.frame();
 }
 log.push([lesson,g.run('match.learned'),phase(),tries]);
 if(g.run('match.learned')){for(let i=0;i<400&&!g.run('action.ended');i++)g.frame();g.run("$('lessonNext').onclick()");}
}
console.log(JSON.stringify(log),'home?',!g.run("document.getElementById('home').hidden"),'match',g.run('!!match'),'errors',g.errors);
