import {test} from 'node:test';import assert from 'node:assert/strict';import {targetGesture,lateralSkill} from '../dist/gestures.js';import {launch,stepBall} from '../dist/physics.js';
test('applying spin curves the actual airborne ball in the chosen direction',()=>{const straight=launch({x:0,z:-8},{x:0,z:-21},'lob'),left=launch({x:0,z:-8},{x:0,z:-21},'lob',-1),right=launch({x:0,z:-8},{x:0,z:-21},'lob',1);for(let i=0;i<70;i++){stepBall(straight,1/120);stepBall(left,1/120);stepBall(right,1/120);}assert.equal(straight.x,0);assert.ok(left.x<-.8);assert.ok(right.x>.8);});
test('tap actions are selected by destination and hold time',()=>{assert.equal(targetGesture(100,false),'dribble');assert.equal(targetGesture(100,true),'pass');assert.equal(targetGesture(600,false),'lob');assert.equal(targetGesture(600,true),'lob');});

test('lateral flick is a rake but a long hold or backward pull is not',()=>{assert.equal(lateralSkill([{x:0,y:0},{x:-60,y:8}],180).side,-1);assert.equal(lateralSkill([{x:0,y:0},{x:0,y:80}],180),null);assert.equal(lateralSkill([{x:0,y:0},{x:60,y:0}],900),null);});

