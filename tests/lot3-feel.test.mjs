import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('./career.test.mjs',import.meta.url),'utf8');
fs.writeFileSync(new URL('./_boot-lot3.mjs',import.meta.url),src.slice(0,src.indexOf('function boot'))+'export '+src.slice(src.indexOf('function boot'),src.indexOf('\ntest(')));
const {boot}=await import('./_boot-lot3.mjs');

test('Lot 3 · a touch anywhere along a run arrow picks that run, and open space far ahead finds a runner',()=>{const {run}=boot();run(`$('play').onclick();action.started=true;const h=action.hero;h.x=0;h.z=4;attachBall(h);action.keeper.z=-19.25;action.defenders.forEach((d,i)=>{d.x=[-30,-22,-14,-7,14,22,30][i%7];d.z=-9;});const w=action.teammates[0];w.tacticalId=8;w.x=16;w.z=-5;action.teammates.slice(1).forEach((t,i)=>{t.x=-30+i*2;t.z=20;t.tacticalId=1;});globalThis.W=w;planRuns(action);globalThis.R=action.runs[0];`);
 assert.ok(run('!!R'));const mid=run('JSON.stringify({x:(W.x+R.point.x)/2+1,z:(W.z+R.point.z)/2})');assert.equal(run(`runAt(${mid})===R`),true,'middle of the arrow');
 assert.equal(run('runAt({x:-20,z:15})'),null);assert.equal(run('runnerFor({x:12,z:-6})===W'),true,'a ball into space near a partner');assert.equal(run('runnerFor({x:1,z:1})'),null,'a short touch stays a dribble');});

test('Lot 3 · a slide from behind that takes the player is a foul, never a clean tackle through him',()=>{let fouls=0;for(let n=0;n<4;n++){const {run}=boot();run(`$('play').onclick();action.started=true;Math.random=()=>.5;action.defenders=action.defenders.slice(0,2);const h=action.hero;h.x=0;h.z=4;action.defenders[1].x=-1;action.defenders[1].z=-17;attachBall(h);beginDribble({x:0,z:-2});`);
 for(let i=0;i<24;i++)run('tick(1/120)');run(`{const d=action.defenders[0],hh=action.hero;d.x=hh.x+.1;d.z=hh.z+${1.2+n*.25};d.challenge=null;d.challengeCooldown=0;beginChallenge(d,{x:hh.x+(hh.vx||0)*.3,z:hh.z+(hh.vz||0)*.3-.6},'slide');}`);
 for(let i=0;i<120&&!run("action.ended||action.phase==='card'||action.setPiece");i++)run('tick(1/120)');
 if(run("action.phase==='card'||action.setPiece==='freekick'||action.setPiece==='penalty'"))fouls++;else assert.notEqual(run('action.outcomeKind'),'tackle','never a clean tackle from behind');}
 assert.ok(fouls>=3,'fouls when the slide reaches him (1.2–1.95 m behind): '+fouls);/* from further back a running player gets away */});
