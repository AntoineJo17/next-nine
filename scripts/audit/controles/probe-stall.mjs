// Sonde anti-blocage : après chaque geste unique, sans autre entrée, le jeu doit revenir à un état attendant le joueur
// (ready/aerial) ou à la simulation (interval) en moins de 40 s de jeu. Sinon : soft-lock.
import {boot,toChance,rng} from '../../../tests/gameplay-controles/harness.mjs';
const from=+process.argv[2]||1,n=+process.argv[3]||30;
const bad=[];const hist={};
for(let seed=from;seed<from+n;seed++){
 const g=boot({seed});const R=rng(seed*7+1);
 try{toChance(g,200000);}catch(e){continue;}
 for(let round=0;round<6;round++){
  if(!g.run('!!match'))break;
  if(!g.run('!!action&&action.ready&&action.phase!=="interval"')){ // attendre le prochain état jouable
   for(let i=0;i<4000&&g.run('!!match')&&!g.run('!!action&&action.ready&&action.phase!=="interval"');i++){g.run("action&&action.interval&&(action.interval.speed=2)");g.frame();}
   if(!g.run('!!match'))break;
  }
  const h=g.run('engine.actorScreen(action.hero)'),b=g.run('engine.ballScreen()'),mates=g.run('(action.teammates||[]).map(t=>engine.actorScreen(t))').filter(m=>m.x>10&&m.x<g.w-10&&m.y>130&&m.y<g.h-120);
  const startPhase=g.run('action.phase');
  const k=R();let kind;
  if(k<.2){kind='tapGrass';g.pointer('pointerdown',h.x+(R()-.5)*100,h.y-30-R()*120,1);g.pointer('pointerup',h.x,h.y-60,1);}
  else if(k<.3){kind='marker';g.run(`(()=>{const a=action,o=a.teammates.filter(t=>t.tacticalId%11!==0&&Math.hypot(t.x-a.hero.x,t.z-a.hero.z)<45);if(o.length)passToTeammate(o[Math.floor(Math.random()*o.length)]);})()`);}
  else if(k<.4&&mates.length){kind='tapMate';const m=mates[Math.floor(R()*mates.length)];g.pointer('pointerdown',m.x,m.y,1);g.pointer('pointerup',m.x,m.y,1);}
  else if(k<.6){kind='shot';g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x+(R()-.5)*40,b.y+40,1);g.pointer('pointermove',b.x+(R()-.5)*60,b.y+90,1);g.pointer('pointerup',b.x,b.y+90,1);}
  else if(k<.7){kind='lob';const p={x:h.x+(R()-.5)*100,y:h.y-100};g.pointer('pointerdown',p.x,p.y,1);g.dateState.now+=700;g.pointer('pointermove',p.x,p.y+1,1);g.pointer('pointerup',p.x,p.y+1,1);}
  else if(k<.8){kind='shield';g.pointer('pointerdown',h.x,h.y,1);g.pointer('pointerup',h.x,h.y,1);}
  else if(k<.9){kind='feint';g.pointer('pointerdown',b.x,b.y,1);g.pointer('pointermove',b.x,b.y+50,1);g.pointer('pointermove',b.x,b.y-40,1);g.pointer('pointerup',b.x,b.y-40,1);}
  else {kind='rake';g.pointer('pointerdown',h.x,h.y,1);for(let j=1;j<=6;j++){g.dateState.now+=12;g.pointer('pointermove',h.x+j*25,h.y,1);}g.pointer('pointerup',h.x+150,h.y,1);}
  // 40 s sans entrée
  let ok=false,last=null;
  for(let i=0;i<2400;i++){g.frame();last=g.run('action?action.phase:null');
   if(!g.run('!!match')){ok=true;break;}
   if((last==='ready'||last==='aerial')&&g.run('action.ready')&&i>3){ok=true;break;}
   if(last==='interval'){ok=true;break;}}
  hist[kind+'>'+startPhase]=(hist[kind+'>'+startPhase]||0)+1;
  if(!ok)bad.push({seed,round,kind,startPhase,last,feedback:g.run("$('feedback').textContent"),flying:g.run('action.flying'),callPause:g.run('!!action.callPause'),phase:g.run('action.phase')});
 }
 if(g.errors.length)bad.push({seed,errors:g.errors.slice(0,3)});
}
console.log('sondes',JSON.stringify(hist));
console.log('SOFT-LOCKS',JSON.stringify(bad,null,1));
