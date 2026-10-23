import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../dist/vendor/three.module.js';
import {teamDecision} from '../dist/football-ai.js';import {moveToward,beginChallenge,updateChallenge} from '../dist/movement.js';import {Pitch3D,headPoint,FACE_SHAPES,HAIR_STYLES} from '../dist/engine.js';
const src=fs.readFileSync(new URL('./career.test.mjs',import.meta.url),'utf8');
fs.writeFileSync(new URL('./_boot-lot4.mjs',import.meta.url),src.slice(0,src.indexOf('function boot'))+'export '+src.slice(src.indexOf('function boot'),src.indexOf('\ntest(')));
const {boot}=await import('./_boot-lot4.mjs');

test('Lot 4 · a touch into open space stays a dribble; only a run arrow or space right next to a partner far ahead is a through ball',()=>{const {run}=boot();run(`$('play').onclick();action.started=true;{const h=action.hero;h.x=0;h.z=4;attachBall(h);action.defenders.forEach((d,i)=>{d.x=[-30,-22,-14,-7,14,22,30][i%7];d.z=-9;});const w=action.teammates[0];w.tacticalId=8;w.x=8;w.z=-2;action.teammates.slice(1).forEach((t,i)=>{t.x=-30+i*2;t.z=20;t.tacticalId=1;});globalThis.W4=w;action.runs=[];}`);
 assert.equal(run('runnerFor({x:4,z:-4})'),null,'9 m ahead, partner 4 m away: still a dribble');assert.equal(run('runAt({x:4,z:-4})'),null);
 assert.equal(run('runnerFor({x:10,z:-8})===W4'),true,'15 m ahead, at the partner: a ball into his stride');});

test('Lot 4 · partners only find the player when the ball will reach him, and they do find him when he is free',()=>{const carrier={x:0,z:0},other={x:-9,z:-3};
 const marked={x:0,z:-8,isHero:true},d1=[{x:.4,z:-7.2},{x:-12,z:-14}];assert.notEqual(teamDecision(carrier,[marked,other],d1,{x:0}).receiver,marked,'a marked player is not given the ball');
 const free={x:5,z:-7,isHero:true},d2=[{x:-3,z:-6},{x:-12,z:-14}];const pass=teamDecision(carrier,[free,other],d2,{x:0});assert.equal(pass.receiver,free,'a free player in the gap gets it');
 carrier.lastPasser=free;assert.equal(teamDecision(carrier,[free,other],d2,{x:0}).receiver,free,'even straight back to the player who just passed');});

test('Lot 4 · the carrier runs through his touch at full speed and a poking defender keeps his momentum',()=>{const a={x:0,z:0,vx:0,vz:-5},b={...a};let tA=0,tB=0;for(;tA<3&&!moveToward(a,{x:0,z:-5},4.4,1/120,14);tA+=1/120);for(;tB<3&&!moveToward(b,{x:0,z:-5},4.4,1/120,14,false);tB+=1/120);assert.ok(tB<tA-.1,'no braking: '+tB.toFixed(2)+' s vs '+tA.toFixed(2)+' s');
 const d={x:0,z:0,vx:0,vz:-5};beginChallenge(d,{x:0,z:-1},'poke');const z0=d.z;for(let i=0;i<30;i++)updateChallenge(d,1/120);assert.ok(d.z<z0-.5,'the defender keeps running: '+(z0-d.z).toFixed(2));});

test('Lot 4 · the head is sculpted (nose ahead of the eyes, narrower jaw) and every haircut builds',()=>{const v=FACE_SHAPES[0],nose=headPoint(0,-.14,v),eye=headPoint(.3,.095,v),jaw=headPoint(1.2,-.7,v),temple=headPoint(1.2,.2,v);assert.ok(nose.z<eye.z-.015,'the nose stands out');assert.ok(Math.abs(jaw.x)<Math.abs(temple.x),'jaw narrower than the skull');
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillText(){}})})};for(const hs of HAIR_STYLES){const e=Object.create(Pitch3D.prototype);e.scene=new T.Scene();e.appearance={skin:'#c98b62',hair:'#28231e',number:9,hairStyle:hs,beard:'barbe'};e.players=[];const p=e.makePlayer(0,0,0x63b9f4,9,true);const names=[];p.g.traverse(o=>names.push(o.name));assert.ok(names.includes('Visage'));assert.equal(names.includes('Cheveux'),hs!=='crane',hs);}});
