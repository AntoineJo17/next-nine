// Fuzzer déterministe d'évènements utilisateur (gestes, boutons, visibilité, dt énormes) sur le vrai game.js.
import {boot,rng} from './harness.mjs';

export const INVARIANTS=g=>{
 const bad=[];
 const s=g.run(`(()=>{const o={};o.hasA=!!action;o.hasM=!!match;o.phase=action&&action.phase;o.drag=!!drag;
  o.energy=career.energy;o.menergy=match?match.energy:null;o.us=match?match.us:null;o.them=match?match.them:null;o.career={games:career.games,goals:career.goals,assists:career.assists,xp:career.xp,energy:career.energy};
  o.ballFinite=action&&action.ball?[action.ball.x,action.ball.y,action.ball.z].every(Number.isFinite):true;
  o.heroFinite=action&&action.hero?[action.hero.x,action.hero.z].every(Number.isFinite):true;
  o.evUs=match?match.events.filter(e=>e.side==='us').length:null;o.evThem=match?match.events.filter(e=>e.side==='them').length:null;
  o.mgoals=match?match.goals:null;o.training=match?match.training:null;o.tscore=match&&match.tactical?match.tactical.score.slice():null;o.tpaused=match&&match.tactical?match.tactical.paused:null;o.mcount=match?match.goals+match.assists:null;o.minute=match?match.minute:null;return JSON.stringify(o);})()`);
 const o=JSON.parse(s);
 if(o.hasA!==o.hasM)bad.push('action/match désynchronisés '+s);
 if(!o.hasM&&o.drag)bad.push('drag résiduel hors partie');
 if(o.energy<0||o.energy>100||(o.menergy!=null&&(o.menergy<0||o.menergy>100||!Number.isFinite(o.menergy))))bad.push('énergie hors bornes '+o.energy+'/'+o.menergy);
 if(!o.ballFinite||!o.heroFinite)bad.push('NaN position');
 if(o.hasM&&!o.training){if(o.evUs!==o.us||o.evThem!==o.them)bad.push('événements de but != score '+o.evUs+'-'+o.evThem+' vs '+o.us+'-'+o.them);if(o.phase==='interval'&&o.tscore&&(o.tscore[0]!==o.us||o.tscore[1]!==o.them))bad.push('score tactique != score match '+o.tscore+' vs '+o.us+'-'+o.them);if(o.mgoals>o.us)bad.push('buts du joueur > buts équipe');}
 for(const k of Object.keys(o.career))if(!Number.isFinite(o.career[k]))bad.push('carrière NaN '+k);
 return {bad,o};
};

/** Joue une graine : renvoie {errors,bad,stats}. */
export function fuzz(seed,{steps=6000,speedUp=true,verbose=false,calm=false,forced=true}={}){
 const g=boot({seed});const R=g.R;const pick=a=>a[Math.floor(R()*a.length)];
 const phases={};const log=[];const bad=[];const stats={starts:0,leaves:0,finishes:0,gestures:0,frames:0,chances:0};
 const careerBefore=()=>g.run('JSON.stringify({games:career.games,goals:career.goals,assists:career.assists,xp:career.xp})');
 let prev=JSON.parse(careerBefore()),down=null;
 const click=id=>{const e=g.el(id);try{if(e.onclick)e.onclick({});else for(const f of e.handlers.click||[])f({});}catch(err){throw err;}};
 const ev=(name,fn)=>{try{fn();}catch(err){g.errors.push(`[seed ${seed}] ${name}: ${err&&err.stack?(err.name+': '+err.message+' @ '+(err.stack.split('\n').filter(l=>/^\s+at /.test(l)).slice(0,3).join(' | '))):err}`);}};
 const inMatch=()=>g.run('!!match');
 const ptrs=new Map();
 const rndPoint=()=>{const k=R();const h=g.run('action&&action.hero?engine.actorScreen(action.hero):null'),b=g.run('action&&action.ball?engine.ballScreen():null');
  if(k<.25&&b)return {x:b.x+(R()-.5)*20,y:b.y+(R()-.5)*20};if(k<.4&&h)return {x:h.x+(R()-.5)*30,y:h.y+(R()-.5)*30};
  if(k<.5)return {x:-50+R()*500,y:-50+R()*950};return {x:R()*g.w,y:R()*g.h};};
 for(let i=0;i<steps;i++){
  const r=R();const ph=g.run('action?action.phase:null');
  if(r<.55){ // frames
   const k=R();const dt=k<.8?16.7:k<.9?33:k<.95?120:k<.98?1500:(k<.99?60000:0);
   ev('frame',()=>{ // visibilité
    g.frame(dt||16.7);stats.frames++;});
  }else if(r<.62){ev('hidden',()=>{g.run(`document.hidden=${R()<.5}`);});}
  else if(r<.67){ // start/leave/continue
   const b=pick(calm?['continue','continue','skipPlayback','tacticBtn','gestureHelp','guideClose','menuToggle','replayBtn','replaySkip','rpPlay','rpRestart','rpBack','rpFwd','rpCamGoal','rpCamSide','lessonRetry','curveLeft','curveRight','curveNone','oneTwo']:['play','play','practice','leave','continue','skipPlayback','back','tacticBtn','gestureHelp','guideClose','menuToggle','replayBtn','replaySkip','rpPlay','rpRestart','rpBack','rpFwd','rpCamGoal','rpCamSide','rpCamHero','rpCamAir','lessonNext','lessonRetry','teammateShot','fullscreen','oneTwo','curveLeft','curveRight','curveNone','soundToggle','rest']);
   if(b==='play'||b==='practice')stats.starts++;if(b==='leave')stats.leaves++;
   ev('click '+b,()=>{if(b==='fullscreen'||b==='soundToggle')return;click(b);});
  }else if(r<.72){ev('mode',()=>g.run(`setMode(${JSON.stringify(pick(['dribble','low','normal','lob']))})`));}
  else if(r<.74){ev('curve',()=>g.run(`setShotCurve(${(R()-.5)*.8})`));}
  else if(r<.78){ev('visibility',()=>{g.run('document.hidden=true');for(let j=0;j<3;j++)g.frame(16.7);g.run('document.hidden=false');g.frame(R()<.5?200000:16.7);});}
  else if(r<.80){ev('resize',()=>{g.engine.resize();});}
  else if(r<.81&&forced){const k=pick(['foul','foulbox','offside','goal','save','tackle','miss']);
   ev('forced '+k,()=>g.run(`(()=>{if(!action||action.ended||action.phase==='interval')return;const h=action.hero;
    if('${k}'==='foul'&&action.defenders.length)commitFoul(action.defenders[0]);
    else if('${k}'==='foulbox'&&action.defenders.length){h.x=0;h.z=-12;commitFoul(action.defenders[0]);}
    else if('${k}'==='offside')callOffside(h);
    else if('${k}'==='goal')resolve(true,'but','hero');
    else if('${k}'==='save')resolve(false,'arrêt','hero','save');
    else if('${k}'==='tackle'&&action.defenders.length)winBall(action.defenders[0],'tacle');
    else resolve(false,'raté','hero','miss');})()`));}
  else { // pointeurs : séquences
   const id=R()<.85?1:pick([2,3]);
   const k=R();
   if(k<.4||!ptrs.has(id)){const p=rndPoint();ptrs.set(id,p);ev('down',()=>g.pointer('pointerdown',p.x,p.y,id));stats.gestures++;}
   else if(k<.75){const p=ptrs.get(id);const q={x:p.x+(R()-.5)*120,y:p.y+(R()-.2)*160};ptrs.set(id,q);ev('move',()=>g.pointer('pointermove',q.x,q.y,id));}
   else if(k<.92){const p=ptrs.get(id);ptrs.delete(id);const out=R()<.2;ev('up',()=>g.pointer('pointerup',out?-100:p.x,out?-100:p.y+R()*80,id));if(R()<.7)ev('lost',()=>g.pointer('lostpointercapture',p.x,p.y,id));}
   else {const p=ptrs.get(id);ptrs.delete(id);ev(R()<.5?'cancel':'lost',()=>g.pointer(R()<.5?'pointercancel':'lostpointercapture',p.x,p.y,id));}
  }
  // invariants à chaque pas
  const {bad:b,o}=INVARIANTS(g);phases[o.phase||'-']=(phases[o.phase||'-']||0)+1;
  if(calm&&!inMatch()&&R()<.5)ev('autoplay',()=>click('play'));
  if(b.length){bad.push(`[seed ${seed} step ${i}] `+b.join('; '));break;}
  if(g.errors.length)break;
  if(speedUp&&ph==='interval'&&R()<.3)g.run("if(action&&action.interval)action.interval.speed=2");
 }
 stats.phases=phases;stats.games=JSON.parse(careerBefore()).games;return {errors:g.errors.slice(),bad,stats,g};
}
