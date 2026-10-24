import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const g=fs.readFileSync('dist/game.js','utf8'),e=fs.readFileSync('dist/engine.js','utf8');
test('Audit QA · after a pressing or intercepted pass the new ball owner has a walk-away target, so the game loop cannot freeze',()=>{assert.ok(g.includes('moveToward(d,a.escapeTarget||{x:d.x,z:d.z+1.5},2.7,dt)'));assert.ok(!g.includes('moveToward(d,a.escapeTarget,2.7,dt)'));});
test('Audit QA · the crowd animation is defined once and throttled (no duplicate unthrottled copy)',()=>{assert.equal((e.match(/^animateCrowd\(/gm)||[]).length,1);assert.ok(/animateCrowd\(time,goal,force=false\)/.test(e));});
