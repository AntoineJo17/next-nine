import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const src=fs.readFileSync(new URL('./career.test.mjs',import.meta.url),'utf8');
const bootSrc=src.slice(src.indexOf('function boot'),src.indexOf('\ntest('));
const imports=src.slice(0,src.indexOf('function boot'));
fs.writeFileSync(new URL('./_boot.mjs',import.meta.url),imports+'export '+bootSrc);
const {boot}=await import('./_boot.mjs');
test('stress: full matches with random play stay consistent',()=>{for(let seed=1;seed<=8;seed++){const {run}=boot();run(`let r=${seed*7919};const rnd=()=>{r=(r*1103515245+12345)%2147483648;return r/2147483648;};$('play').onclick();beginInterval=originalInterval;beginInterval();`);
 let steps=0,chances=0;while(run('!!match')&&steps<400000){steps++;const ph=run('action.phase');
  if(run('action.ready')&&!run('action.ended')){chances++;run(`{const k=rnd();if(k<.5)windUp(action.hero,{x:(rnd()-.5)*6,z:-21},'normal','hero',0,.4+rnd()*.6);else if(k<.8)beginDribble({x:action.hero.x+(rnd()-.5)*4,z:action.hero.z-2});else{const t=action.teammates[Math.floor(rnd()*action.teammates.length)];windUp(action.hero,{x:t.x,z:t.z},'low','hero');}}`);}
  if(run('action.ended&&action.after>1')){run("$('continue').onclick()");continue;}
  run('tick(1/60)');
  assert.ok(run('!match||[action.ball.x,action.ball.y,action.ball.z].every(Number.isFinite)'),'ball finite');
 }
 assert.equal(run('!!match'),false,'match finished seed '+seed);assert.ok(chances>0);
 const last=run('career.last');assert.match(last,/AC Rivage \d+ – \d+/);
 const [us,them]=last.match(/(\d+) – (\d+)/).slice(1).map(Number);const ev=run("$('resultEvents').textContent");
 const usEv=(ev.match(/AC Rivage/g)||[]).length,themEv=(ev.match(/Adversaire/g)||[]).length;assert.equal(usEv,us,ev);assert.equal(themEv,them,ev);
}});
