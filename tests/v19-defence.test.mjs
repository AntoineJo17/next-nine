import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {beginChallenge,updateChallenge,challengeHits,SLIDE} from '../dist/movement.js';
const src=fs.readFileSync(new URL('./career.test.mjs',import.meta.url),'utf8');
fs.writeFileSync(new URL('./_boot-v19d.mjs',import.meta.url),src.slice(0,src.indexOf('function boot'))+'export '+src.slice(src.indexOf('function boot'),src.indexOf('\ntest(')));
const {boot}=await import('./_boot-v19d.mjs');

test('V19 · slide tackle: 2.6 m along the ground, one second down, then back up',()=>{const d={x:0,z:0};assert.ok(beginChallenge(d,{x:0,z:-5},'slide'));let t=0;for(;t<SLIDE.slide;t+=1/60)updateChallenge(d,1/60);assert.ok(Math.abs(d.z+SLIDE.length)<.1,'slides 2.6 m: '+d.z.toFixed(2));
 assert.equal(challengeHits(d,{x:0,y:.22,z:-3.5}),false,'no more contact once he is down');for(;t<SLIDE.down;t+=1/60){updateChallenge(d,1/60);assert.ok(d.challenge,'still on the ground');}for(;t<SLIDE.up+.05;t+=1/60)updateChallenge(d,1/60);assert.equal(d.challenge,null);assert.ok(d.challengeCooldown>1,'he cannot tackle again straight away');
 const e={x:0,z:0};beginChallenge(e,{x:0,z:-5},'slide');for(let i=0;i<12;i++)updateChallenge(e,1/60);assert.equal(challengeHits(e,{x:0,y:.22,z:e.z-.9}),true,'the leading foot reaches the ball ahead of him');});

const dribbling=(run,prep='')=>run(`$('play').onclick();action.started=true;action.defenders=action.defenders.slice(0,2);action.hero.x=0;action.hero.z=${prep.includes('box')?-12:4};action.defenders[0].x=8;action.defenders[0].z=action.hero.z+6;action.defenders[1].x=-1;action.defenders[1].z=-17;attachBall(action.hero);beginDribble({x:0,z:action.hero.z-6});`);

test('V19 · a missed slide leaves the defender on the ground while the player goes on',()=>{const {run}=boot();dribbling(run);run("const d=action.defenders[0];d.x=action.hero.x+2.4;d.z=action.hero.z+1;beginChallenge(d,{x:d.x+1,z:d.z+3},'slide');");
 for(let i=0;i<60;i++)run('tick(1/120)');assert.equal(run('action.ended'),false);assert.ok(run("action.defenders[0].challenge?.kind==='slide'"),'he is down');assert.equal(run("action.phase"),'dribble','the dribble goes on');});

test('V19 · fouls: penalty in the box, free kick where it happened, cards and sending-offs',()=>{
 // V20: a booking first shows the referee with the card (phase 'card'), then the set piece.
 const fin=run=>{for(let i=0;i<700&&run("action.phase==='card'");i++)run('tick(1/120)');};
 const box=boot();dribbling(box.run,'box');box.run('commitFoul(action.defenders[0])');fin(box.run);assert.equal(box.run('action.setPiece'),'penalty');assert.equal(box.run("$('kind').textContent"),'PENALTY');assert.equal(box.run('action.ready'),true);
 const out=boot();dribbling(out.run);out.run("action.defenders[1].z=-17;action.hero.z=4;commitFoul(action.defenders[0]);");fin(out.run);assert.equal(out.run('action.setPiece'),'freekick');assert.ok(out.run('Math.hypot(action.ball.x,action.ball.z+20)')>23,'taken at the foul, not moved closer');
 // Last man: straight red, he leaves the pitch and the simulation plays on with ten.
 const red=boot();dribbling(red.run);red.run("action.defenders[1].z=30;const d=action.defenders[0];globalThis.D=d;d.tacticalId=14;match.tactical=createTactical(3);commitFoul(d);");fin(red.run);assert.equal(red.run('action.defenders.includes(D)'),false);assert.equal(red.run('match.tactical.players[14].out'),true);assert.match(red.run("$('announceTitle').textContent"),/ROUGE/);
 // Two yellows for the same defender make a red.
 const y=boot();dribbling(y.run);y.run("Math.random=()=>.1;const d=action.defenders[0];globalThis.D=d;d.tacticalId=15;commitFoul(d);");fin(y.run);assert.match(y.run("$('announceTitle').textContent"),/JAUNE/);assert.equal(y.run('action.defenders.includes(D)'),true);y.run('commitFoul(D)');fin(y.run);assert.match(y.run("$('announceTitle').textContent"),/ROUGE/);assert.equal(y.run('action.defenders.includes(D)'),false);assert.equal(y.run('match.foulsWon'),2);});

test('V19 · shoulder duel: the chasing defender runs alongside instead of stopping dead, and can win the ball',()=>{const {run}=boot();dribbling(run);run("const d=action.defenders[0];d.x=action.hero.x+.8;d.z=action.hero.z+.4;d.vx=0;d.vz=-5;d.challengeCooldown=9;action.defenders[1].challengeCooldown=9;");
 const gaps=[];let lean=0;for(let i=0;i<70;i++){run('tick(1/120)');if(run('action.ended')||run("action.phase!=='dribble'"))break;gaps.push(run('Math.hypot(action.defenders[0].x-action.hero.x,action.defenders[0].z-action.hero.z)'));lean=Math.max(lean,Math.abs(run('action.hero.lean||0')));}
 assert.ok(gaps.length>30&&gaps.every(g=>g<1.35),'he stays at the shoulder: '+gaps.map(g=>g.toFixed(2)).slice(-5).join(','));assert.ok(run('action.defenders[0].speed')>2,'and keeps running');assert.ok(lean>0,'the bodies lean into each other');
 const lost=boot();dribbling(lost.run);lost.run("Math.random=()=>.001;const d=action.defenders[0];d.x=action.hero.x+.8;d.z=action.hero.z+.4;d.challengeCooldown=9;action.defenders[1].challengeCooldown=9;");for(let i=0;i<30&&!lost.run('action.loose');i++)lost.run('tick(1/120)');assert.equal(lost.run('action.loose'),true);assert.match(lost.run("$('feedback').textContent"),/épaule/);});
