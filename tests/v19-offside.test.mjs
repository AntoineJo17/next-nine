import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../dist/vendor/three.module.js';
import {createTactical,stepTactical,resumeTactical} from '../dist/tactical.js';import {Pitch3D} from '../dist/engine.js';import {PITCH} from '../dist/physics.js';
const src=fs.readFileSync(new URL('./career.test.mjs',import.meta.url),'utf8');
fs.writeFileSync(new URL('./_boot-v19o.mjs',import.meta.url),src.slice(0,src.indexOf('function boot'))+'export '+src.slice(src.indexOf('function boot'),src.indexOf('\ntest(')));
const {boot}=await import('./_boot-v19o.mjs');

test('V19 · offside in the simulated match: about three a match, and the defending side gets the ball',()=>{let total=0;for(let seed=1;seed<=30;seed++){const s=createTactical(seed*613+11,{levels:[60,60],energy:90});for(let i=0;i<20000;i++){const e=stepTactical(s,1/60);if(e?.type==='offside'){total++;assert.notEqual(s.owner.team,e.team,'free kick to the defending side');assert.match(s.comment,/Hors-jeu/);}if(e?.type==='chance')resumeTactical(s,[],'miss',s.ball,11);if(e?.type==='finish')break;}}
 assert.ok(total/30>1&&total/30<6,'offsides per match: '+(total/30).toFixed(2));});

// A clear set-up: the hero 25 m out, the line of defenders at z=-8, the keeper on his line.
const scene=(run,mateZ)=>run(`$('play').onclick();action.started=true;const h=action.hero;h.x=0;h.z=5;attachBall(h);action.defenders.forEach((d,i)=>{d.x=-30+i*4;d.z=i<4?-8:20;});action.keeper.z=-19.3;const m=action.teammates[0];m.x=6;m.z=${mateZ};globalThis.M=m;action.receiver=m;`);
const play=run=>{for(let i=0;i<500&&!run('action.ended')&&!run("action.phase==='choice'||action.phase==='teammateRun'||action.shotBy==='teammate'");i++){run('action.callPause=false');run('tick(1/120)');}};

test('V19 · a pass to a team-mate beyond the second-last defender is flagged offside',()=>{const {run}=boot();scene(run,-12);run("windUp(action.hero,{x:M.x,z:M.z},'low','hero');");play(run);
 assert.equal(run('action.outcomeKind'),'offside');assert.equal(run('match.offsides'),1);assert.equal(run('action.flag'),true);assert.match(run("$('feedback').textContent"),/Hors-jeu/);assert.equal(run('match.passes'),0,'no completed pass');});

test('V19 · level with the line or behind it, the pass is fine',()=>{const {run}=boot();scene(run,-7.9);const passes=run('match.passes');run("windUp(action.hero,{x:M.x,z:M.z},'low','hero');");play(run);assert.notEqual(run('action.outcomeKind'),'offside');assert.equal(run('match.passes'),passes+1);});

test('V19 · the player himself is offside when he runs too early for the return pass',()=>{const {run}=boot();scene(run,-6);run("action.hero.x=-4;action.hero.z=-12;action.receiver=M;action.combination=true;action.returnSpot={x:-4,z:-12};windUp(M,{x:-4,z:-12},'low','return');");
 for(let i=0;i<500&&!run('action.ended')&&!run('action.ready');i++)run('tick(1/120)');assert.equal(run('action.outcomeKind'),'offside');assert.match(run("$('feedback').textContent"),/trop tôt/);});

test('V19 · the assistant referee follows the line and raises his flag',()=>{const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:()=>({addColorStop(){},data:new Uint8ClampedArray(8)})});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 const e=Object.create(Pitch3D.prototype);e.scene=new T.Scene();e.appearance={skin:'#c98b62',hair:'#28231e',number:9};e.players=[];e.canvas={parentElement:{clientWidth:390,clientHeight:844}};e.renderer={setSize(){},render(){}};e.camera=new T.PerspectiveCamera();e.ball=new T.Mesh();e.shadow=new T.Mesh(new T.CircleGeometry(.3),new T.MeshBasicMaterial());e.aim={visible:false};
 const a={hero:{x:0,z:5},teammates:[],defenders:[{x:0,z:-8}],keeper:{x:0,z:-19.3,state:'set'},ball:{x:0,y:.22,z:4.4},phase:'ready',offsideLine:-8};e.setup(a);e.action=null;for(let i=0;i<120;i++)e.render(a,1/60,i/60);
 assert.ok(e.linesman);assert.ok(Math.abs(e.linesman.g.position.z+8)<.2,'level with the line');assert.ok(e.linesman.g.position.x<-PITCH.W,'on the touchline');a.flag=true;e.render(a,1/60,3);assert.ok(e.linesman.arms[1].rotation.z>2.5,'flag up');});
