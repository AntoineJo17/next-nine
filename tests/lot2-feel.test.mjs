import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {teamDecision,offsidePosition,shotPower} from '../dist/football-ai.js';import {launch,stepBall} from '../dist/physics.js';import {CELEBRATIONS} from '../dist/career.js';
const src=fs.readFileSync(new URL('./career.test.mjs',import.meta.url),'utf8');
fs.writeFileSync(new URL('./_boot-lot2.mjs',import.meta.url),src.slice(0,src.indexOf('function boot'))+'export '+src.slice(src.indexOf('function boot'),src.indexOf('\ntest(')));
const {boot}=await import('./_boot-lot2.mjs');
const ticks=(run,n,stop='false')=>{for(let i=0;i<n&&!run(stop);i++){run('action.callPause=false');run('tick(1/120)');}};

test('Lot 2 · partners never pass to a player standing offside',()=>{const carrier={x:0,z:2},line=[{x:-8,z:-10},{x:8,z:-10},{x:0,z:-6}],off={x:-3,z:-14},on={x:5,z:-8};
 assert.equal(offsidePosition(off,carrier,line,{z:-19.25}),true);assert.equal(offsidePosition(on,carrier,line,{z:-19.25}),false);
 for(let k=0;k<5;k++){const d=teamDecision(carrier,[carrier,off,on],line,{x:0,z:-19.25},off);assert.notEqual(d.receiver,off);}});

test('Lot 2 · a chance starts onside, with nobody on the player’s toes and a clear lane for the serving pass',()=>{const {run}=boot();run(`$('play').onclick();const h=action.hero;h.x=0;h.z=-15;action.keeper.z=-19.25;action.defenders.forEach((d,i)=>{d.x=-20+i*4;d.z=-12;});action.defenders[0].x=.3;action.defenders[0].z=-14.6;safeStart();`);
 assert.ok(run('action.hero.z')>=run('offsideLineZ(action)'),'onside');assert.ok(run('Math.min(...action.defenders.map(d=>Math.hypot(d.x-action.hero.x,d.z-action.hero.z)))')>=2.59);
 run(`const m=action.teammates[0];m.x=0;m.z=0;action.defenders[1].x=0;action.defenders[1].z=-6;globalThis.M=m;`);assert.notEqual(run('servePasser(M)'),run('M'),'a blocked lane is not used');});

test('Lot 2 · before a free kick the ball is dead: no dribble, and the box is full of players',()=>{const {run}=boot();run(`$('play').onclick();action.started=true;action.ball.x=-4;action.ball.z=-1;setupFreeKick();action.ready=true;action.phase='ready';beginDribble({x:-4,z:-5});`);
 assert.equal(run('action.phase'),'ready');assert.match(run("$('feedback').textContent"),/Pas de dribble/);
 assert.ok(run('action.teammates.filter(t=>t.z<-5).length')>=6,'attackers in and around the box');assert.ok(run('action.defenders.filter(d=>d.z<-9).length')>=run('action.defenders.length')-1,'wall and markers');
 run("windUp(action.hero,{x:3.6,z:-21},'normal','hero',0,.62)");ticks(run,40);assert.equal(run('action.released'),true,'everyone moves once the ball is struck');});

test('Lot 2 · one against one: the keeper comes out and can smother the ball at the player’s feet',()=>{const {run}=boot();run(`$('play').onclick();action.started=true;Math.random=()=>.1;const h=action.hero;h.x=0;h.z=-8;action.defenders.forEach((d,i)=>{d.x=-25+i*5;d.z=10;});action.teammates.forEach(t=>{t.x=20;t.z=10;});attachBall(h);beginDribble({x:0,z:-13});`);
 const z0=run('action.keeper.z');ticks(run,240,'action.ended');assert.ok(run('action.keeper.z')>z0+1||run('action.ended'),'the keeper left his line');
 for(let k=0;k<4&&!run('action.ended');k++){run("if(action.ready)beginDribble({x:action.hero.x,z:action.hero.z-4})");ticks(run,240,'action.ended');}
 assert.equal(run('action.outcomeKind'),'save');assert.match(run("$('feedback').textContent"),/gardien/);});

test('Lot 2 · the keeper catches a shot struck at him instead of diving away from it',()=>{let saves=0;for(let n=0;n<6;n++){const {run}=boot();run(`$('play').onclick();action.started=true;const h=action.hero;h.x=0;h.z=-2;attachBall(h);action.defenders.forEach(d=>{d.x=30;});windUp(h,{x:0,z:-21},'normal','hero',0,.6);`);ticks(run,500,'action.ended');if(run('action.outcomeKind')==='save')saves++;}assert.ok(saves>=5,'central shots saved: '+saves);});

test('Lot 2 · partners show their runs and a touch in open space plays the ball into the runner’s stride',()=>{const {run}=boot();run(`$('play').onclick();action.started=true;const h=action.hero;h.x=0;h.z=4;attachBall(h);action.keeper.z=-19.25;action.defenders.forEach((d,i)=>{d.x=[-30,-22,-14,-7,14,22,30][i%7]+(i>6?3:0);d.z=-9;});const w=action.teammates.find(t=>t.tacticalId%11>=5)||action.teammates[0];w.tacticalId=8;w.x=16;w.z=-5;action.teammates.filter(t=>t!==w).forEach((t,i)=>{t.x=-30+i*2;t.z=20;});globalThis.W=w;planRuns(action);`);
 assert.ok(run('action.runs.length')>=1);assert.equal(run('action.runs[0].mate===W'),true);assert.ok(run('Math.abs(action.runs[0].point.x)<Math.abs(W.x)'),'the winger cuts inside');
 assert.equal(run('runAt(action.runs[0].point)===action.runs[0]'),true);assert.equal(run('runnerFor({x:0,z:3})'),null,'a short touch stays a dribble');
 const passes=run('match.passes');run(`const r=action.runs[0];action.receiver=W;lastThrough=true;action.throughRun={mate:W,point:{...r.point}};{const hh=action.hero,dx=r.point.x-hh.x,dz=r.point.z-hh.z,l=Math.hypot(dx,dz);windUp(hh,{x:r.point.x+dx/l*2.5,z:r.point.z+dz/l*2.5},'low','hero');}`);
 for(let i=0;i<600&&!run("action.ended||action.phase==='choice'||action.phase==='teammateRun'||action.shotBy==='teammate'");i++)run('action.callPause=false;tick(1/120)');
 assert.equal(run('match.passes'),passes+1,'the through ball reaches the runner');});

test('Lot 2 · a booking: the referee runs in and shows the card before the free kick',()=>{const {run}=boot();run(`$('play').onclick();action.started=true;Math.random=()=>.01;const h=action.hero;h.x=6;h.z=-2;const d=action.defenders[0];d.x=6.4;d.z=-1.2;d.style='engagé';action.defenders.slice(1).forEach(q=>{q.x=-20;q.z=-15;});globalThis.D=d;commitFoul(d);`);
 assert.equal(run('action.phase'),'card');assert.ok(run('!!action.cardShow'));const r0=run('Math.hypot(action.cardShow.rx-D.x,action.cardShow.rz-D.z)');
 ticks(run,200);assert.ok(run('Math.hypot(action.cardShow.rx-D.x,action.cardShow.rz-D.z)')<r0-3,'the referee comes to the culprit');ticks(run,60);assert.equal(run('action.cardShow.raised'),true);
 ticks(run,300,"action.phase!=='card'");assert.equal(run("action.setPiece"),'freekick');assert.equal(run('action.ready'),true);assert.equal(run('match.reds'),1,'last man: sent off');});

test('Lot 2 · fifteen modern celebrations, not named on screen',()=>{assert.equal(CELEBRATIONS.length,15);for(const id of ['siu','croises','meditation','ouverts','tempe','calma','pouce','nom','griddy','ecusson'])assert.ok(CELEBRATIONS.some(c=>c.id===id),id);
 for(const old of ['robot','floss','disco','salsa','roue','avion'])assert.ok(!CELEBRATIONS.some(c=>c.id===old),old);
 const {run}=boot();run(`$('play').onclick();match.us=1;match.them=0;startCelebration(action,'hero');`);assert.equal(run("$('announceText').textContent"),'1 — 0');});

test('Lot 2 · partners’ shots stay on target from 6 to 17 m',()=>{for(const d of [6,9,12,14,17]){const p={x:0,z:-20+d},b=launch(p,{x:2.4,z:-21},'normal',0,shotPower(p));let y=0;for(let i=0;i<400&&b.z>-20;i++)stepBall(b,1/240);y=b.y;assert.ok(y<2.3&&y>0,'height at the line from '+d+' m: '+y.toFixed(2));}});
