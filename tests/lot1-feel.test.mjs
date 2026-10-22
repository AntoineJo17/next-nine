import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('./career.test.mjs',import.meta.url),'utf8');
fs.writeFileSync(new URL('./_boot-lot1.mjs',import.meta.url),src.slice(0,src.indexOf('function boot'))+'export '+src.slice(src.indexOf('function boot'),src.indexOf('\ntest(')));
const {boot}=await import('./_boot-lot1.mjs');

// The hero 20 m from goal, a team-mate 12 m behind him ready to serve, everyone else far away.
const serve=(run,extra='')=>{run(`$('play').onclick();const h=action.hero;h.x=0;h.z=0;action.defenders.forEach((d,i)=>{d.x=-30+i*3;d.z=30;});action.teammates.forEach((t,i)=>{t.x=25;t.z=-10+i*3;});const m=action.teammates[0];m.x=0;m.z=12;globalThis.M=m;${extra}beginIncomingFrom(m,'pass');`);};
const runUntil=(run,stop,max=900)=>{for(let i=0;i<max&&!run(stop);i++){run('action.callPause=false');run('tick(1/120)');}};

test('Lot 1 · a clean ground pass is really received by the player',()=>{const {run}=boot();serve(run);runUntil(run,'action.ready||action.ended');
 assert.equal(run('action.ready'),true);assert.equal(run('action.ended'),false);assert.match(run("$('feedback').textContent"),/Bien reçu/);assert.ok(run('Math.hypot(action.ball.x-action.hero.x,action.ball.z-action.hero.z)')<1.2);});

test('Lot 1 · a defender standing in the lane cuts the introduction pass out',()=>{const {run}=boot();serve(run,'const d=action.defenders[0];d.x=0;d.z=6;');runUntil(run,'action.ready||action.ended');
 assert.equal(run('action.ended'),true);assert.equal(run('action.outcomeKind'),'tackle');});

test('Lot 1 · no more automatic "Bien reçu": a pass that misses the player is not handed back',()=>{const {run}=boot();serve(run);
 // Take the hero out of the ball's path right after the pass leaves.
 runUntil(run,'action.incomingReleased');run('action.hero.x=12;action.hero.z=-4;');runUntil(run,'action.ready||action.ended||action.loose',700);
 assert.notEqual(run("$('feedback').textContent"),'Bien reçu · à toi de jouer.');assert.ok(run('action.loose||action.ended'),'the ball runs loose or the move ends');});

import {teamDecision,refreshDefence,shotQuality,shotPower} from '../dist/football-ai.js';

test('Lot 1 · a gesture begun on a partner stays a pass: never a rake, never a shot',()=>{const {run}=boot();run(`$('play').onclick();globalThis.M=action.teammates[0];teammateAt=()=>null;`);
 assert.equal(run(`drag={kind:'target',fromMate:M,start:{x:100,y:100},points:[]};rakeAllowed({x:200,y:100})`),false);
 assert.equal(run(`drag={kind:'target',fromMate:null,start:{x:100,y:100},points:[]};rakeAllowed({x:200,y:100})`),true);
 assert.equal(run(`drag={kind:'skill',fromMate:null,start:{x:100,y:100},points:[]};rakeAllowed({x:200,y:100})`),true);run('drag=null');
 const src=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');assert.match(src,/drag\.kind==='target'&&!drag\.fromMate&&current\.y-drag\.start\.y>=18/,'pulling down from a partner does not turn into a shot');});

test('Lot 1 · buttons, slider and label always show the effect really applied',()=>{const {run}=boot();run(`$('play').onclick();`);
 run('setShotCurve(.35)');assert.equal(run("$('curveSlider').value"),'87');assert.match(run("$('curveValue').textContent"),/87 %/);
 run('setup()');assert.equal(run('shotCurve'),0);assert.equal(run("$('curveSlider').value"),'0');assert.equal(run("$('curveValue').textContent"),'Sans effet');});

test('Lot 1 · a call makes the run attractive but does not force the return',()=>{
 const carrier={x:-6,z:-8},hero={x:-9,z:-3},striker={x:1,z:-13};
 // The striker is unmarked in front of goal: the partner finds him even though the player called.
 assert.equal(teamDecision(carrier,[carrier,hero,striker],[{x:-3,z:-2},{x:8,z:-10},{x:12,z:-15}],{x:0},hero).receiver,striker);
 // Same partner, the player has called from a better spot: he gets it.
 const runner={x:-1,z:-12};assert.equal(teamDecision(carrier,[carrier,runner,{x:-12,z:2}],[{x:6,z:-10},{x:12,z:-15}],{x:0},runner).receiver,runner);});

test('Lot 1 · the order of players in the list does not change the decision',()=>{const carrier={x:0,z:5},a={x:-14,z:-12},b={x:14,z:-14},wall=[{x:-7,z:-3},{x:7,z:-4},{x:-3,z:0},{x:3,z:0}];
 const one=teamDecision(carrier,[carrier,a,b],wall,{x:0}),two=teamDecision(carrier,[carrier,b,a],wall,{x:0});assert.equal(one.kind,two.kind);assert.equal(one.receiver,two.receiver);});

test('Lot 1 · shots are judged by angle and distance, and partners strike harder from further out',()=>{
 assert.ok(shotQuality({x:0,z:-9},[])>shotQuality({x:0,z:-3.5},[])||shotQuality({x:0,z:-3.5},[])===0);
 assert.equal(shotQuality({x:16,z:-19},[]),0,'no shot from the corner of the box');assert.ok(shotQuality({x:8,z:-12},[])>.55,'a winger cutting inside can shoot');
 assert.ok(shotPower({x:0,z:-4})>shotPower({x:0,z:-12}));});

test('Lot 1 · markers keep their man instead of swapping every refresh',()=>{const carrier={x:0,z:0},p1={x:-5,z:-8},p2={x:5,z:-8},d1={x:-4,z:-9},d2={x:4,z:-9},press={x:0,z:-1.5},cov={x:0,z:-6};const ds=[press,d1,d2,cov],team=[carrier,p1,p2];
 let sel=refreshDefence(ds,carrier,team);assert.equal(d1.mark,p1);assert.equal(d2.mark,p2);
 // The two attackers cross over; each marker follows his own man rather than swapping on the spot.
 p1.x=1;p2.x=-1;d1.x=-1.5;d2.x=1.5;sel=refreshDefence(ds,carrier,team,sel);assert.equal(d1.mark,p1);assert.equal(d2.mark,p2);
 // Out of reach (more than 9 m): the job changes.
 const p3={x:-1,z:-10};team.push(p3);p1.x=20;p1.z=10;refreshDefence(ds,carrier,team,sel);assert.equal(d1.mark,p3);});
