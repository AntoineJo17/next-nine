// Reproduit le blocage de probe-stall (graine 3, tour 1) puis inspecte l'état.
import {boot,toChance,rng} from '../../../tests/gameplay-controles/harness.mjs';
const seed=+process.argv[2]||3,target=+process.argv[3]||1;
const g=boot({seed});const R=rng(seed*7+1);
toChance(g,200000);
for(let round=0;round<=target;round++){
 if(!g.run('!!action&&action.ready&&action.phase!=="interval"')){
  for(let i=0;i<4000&&g.run('!!match')&&!g.run('!!action&&action.ready&&action.phase!=="interval"');i++){g.run("action&&action.interval&&(action.interval.speed=2)");g.frame();}
 }
 const h=g.run('engine.actorScreen(action.hero)'),b=g.run('engine.ballScreen()'),mates=g.run('(action.teammates||[]).map(t=>engine.actorScreen(t))');
 const k=R();
 if(k<.2){g.pointer('pointerdown',h.x+(R()-.5)*100,h.y-30-R()*120,1);g.pointer('pointerup',h.x,h.y-60,1);}
 else if(k<.4&&mates.length){const m=mates[Math.floor(R()*mates.length)];g.pointer('pointerdown',m.x,m.y,1);g.pointer('pointerup',m.x,m.y,1);}
 else if(k<.6){g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x+(R()-.5)*40,b.y+40,1);g.pointer('pointermove',b.x+(R()-.5)*60,b.y+90,1);g.pointer('pointerup',b.x,b.y+90,1);}
 else if(k<.7){const p={x:h.x+(R()-.5)*100,y:h.y-100};g.pointer('pointerdown',p.x,p.y,1);g.dateState.now+=700;g.pointer('pointermove',p.x,p.y+1,1);g.pointer('pointerup',p.x,p.y+1,1);}
 else if(k<.8){g.pointer('pointerdown',h.x,h.y,1);g.pointer('pointerup',h.x,h.y,1);}
 else if(k<.9){g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x,b.y+50,1);g.pointer('pointermove',b.x,b.y-40,1);g.pointer('pointerup',b.x,b.y-40,1);}
 else {g.pointer('pointerdown',h.x,h.y,1);for(let j=1;j<=6;j++){g.dateState.now+=12;g.pointer('pointermove',h.x+j*25,h.y,1);}g.pointer('pointerup',h.x+150,h.y,1);}
 if(round<target){for(let i=0;i<2400;i++){g.frame();const ph=g.run('action?action.phase:null');if(ph==='interval'||(g.run('!!action&&action.ready')&&i>3))break;}}
}
for(let i=0;i<1200;i++){g.frame();
 if(i%30===0)console.log(i,g.run(`(()=>{const r=action.receiver,w=action.windup;return JSON.stringify({ph:action.phase,by:action.shotBy,rec:r&&[r.number,+r.x.toFixed(1),+r.z.toFixed(1)],hero:[+action.hero.x.toFixed(1),+action.hero.z.toFixed(1)],ball:[+action.ball.x.toFixed(1),+action.ball.z.toFixed(1)],cp:action.callPause,w:w&&[w.by,w.mode,+w.target.x.toFixed(1),+w.target.z.toFixed(1)],ft:+action.flightTime.toFixed(2)})})()`));
 if(false)console.log(i,g.run(`JSON.stringify({phase:action.phase,flying:action.flying,callPause:action.callPause,callWait:action.callWait,sim:action.sim,flightTime:action.flightTime,ball:action.ball,loose:action.loose,ended:action.ended,ready:action.ready,started:action.started,shotBy:action.shotBy,guide:guideOpen,replay:!!replay})`));
}
