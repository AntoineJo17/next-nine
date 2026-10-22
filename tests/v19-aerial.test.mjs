import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createTactical,stepTactical,resumeTactical} from '../dist/tactical.js';import {teamDecision} from '../dist/football-ai.js';
const src=fs.readFileSync(new URL('./career.test.mjs',import.meta.url),'utf8');
fs.writeFileSync(new URL('./_boot-v19a.mjs',import.meta.url),src.slice(0,src.indexOf('function boot'))+'export '+src.slice(src.indexOf('function boot'),src.indexOf('\ntest(')));
const {boot}=await import('./_boot-v19a.mjs');
const aerial=(run,y)=>run(`$('play').onclick();action.started=true;action.defenders=[];action.ball={x:action.hero.x+.9,y:${y},z:action.hero.z-.6,vx:-4,vy:-2,vz:2,age:0,bounces:0};beginAerial();`);

test('V19 · fewer crosses: they are a minority of the striker’s chances',()=>{let cross=0,all=0;for(let seed=1;seed<=40;seed++){const s=createTactical(seed*613+11,{levels:[60,60],energy:90});for(let i=0;i<20000;i++){const e=stepTactical(s,1/60);if(e?.type==='chance'){all++;if(e.kind==='cross')cross++;resumeTactical(s,[],'miss',s.ball,11);}if(e?.type==='finish')break;}}
 assert.ok(cross/all<.22,`crosses ${cross} of ${all}`);assert.ok(cross>0,'crosses still happen');});

test('V19 · a header really meets the ball: the player is under it and jumps to forehead height',()=>{const {run}=boot();aerial(run,2.05);
 assert.equal(run('action.aerial.header'),true);assert.ok(run('Math.hypot(action.hero.x-action.ball.x,action.hero.z-action.ball.z)')<.2,'under the ball');assert.ok(Math.abs(run('action.hero.y+HEAD_H')-2.05)<.02,'forehead at ball height');
 const start=run('JSON.stringify([action.ball.x,action.ball.y,action.ball.z])');run("windUp(action.hero,{x:0,z:-21},'normal','hero',0,.6);");for(let i=0;i<20&&run("action.phase==='windup'");i++)run('tick(1/120)');
 assert.equal(run("action.phase"),'flight');const [x,y,z]=JSON.parse(start);assert.ok(Math.hypot(run('action.ball.x')-x,run('action.ball.z')-z)<.5&&Math.abs(run('action.ball.y')-y)<.2,'the header leaves from the forehead');assert.ok(run('action.ball.vz')<0,'towards goal');
 const v=boot();aerial(v.run,1);assert.equal(v.run('action.aerial.header'),false);assert.ok(Math.abs(v.run('Math.hypot(action.hero.x-action.ball.x,action.hero.z-action.ball.z)')-.62)<.05,'a volley is one stride from the ball');assert.equal(v.run('action.hero.y'),0);});

test('V19 · bicycle kick: an upward swipe on a ball in the air, back to goal, then the player lies on the ground',()=>{const {run}=boot();aerial(run,1.8);const shots=run('match.shots');
 run("canvas.handlers.pointerdown({clientX:150,clientY:300,pointerId:3,preventDefault(){}});canvas.handlers.pointermove({clientX:152,clientY:260,pointerId:3,preventDefault(){}});canvas.handlers.pointermove({clientX:153,clientY:220,pointerId:3,preventDefault(){}});");
 assert.match(run("$('gestureLabel').textContent"),/RETOURNÉE/);run("canvas.handlers.pointerup({clientX:153,clientY:220,pointerId:3,preventDefault(){}});");
 assert.equal(run('action.hero.bicycle'),true);const facing=run('Math.cos(action.hero.angle-Math.atan2(-(0-action.hero.x),-(-20-action.hero.z)))');assert.ok(facing<-.5,'back to goal');
 for(let i=0;i<60&&run("action.phase==='windup'");i++)run('tick(1/120)');assert.equal(run('action.phase'),'flight');assert.equal(run('match.shots'),shots+1,'it counts as a shot');assert.ok(run('action.ball.vz')<-5,'struck towards goal');assert.ok(run('action.hero.grounded')>0,'he ends up on the ground');
 for(let i=0;i<150&&!run('action.ready');i++)run('tick(1/120)');assert.equal(run('action.hero.grounded')||0,0,'and gets up');});

test('V19 · team-mates chip the ball over a blocked lane',()=>{const carrier={x:0,z:0},mate={x:-14,z:-12},defs=[{x:-7,z:-6},{x:1.5,z:-2.5},{x:10,z:-15}];/* V20: a deep defender keeps the mate onside */const d=teamDecision(carrier,[carrier,mate],defs,{x:0,z:-19});assert.equal(d.kind,'pass');assert.equal(d.receiver,mate);assert.equal(d.lob,true);});
