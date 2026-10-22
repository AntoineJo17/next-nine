import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from '../dist/vendor/three.module.js';
import {Pitch3D} from '../dist/engine.js';import {PITCH,stepBall,launch,GOAL_Z} from '../dist/physics.js';import {tacticalToWorld,worldToTactical} from '../dist/tactical.js';
function rig(){const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:()=>({addColorStop(){},data:new Uint8ClampedArray(8)})});globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};const e=Object.create(Pitch3D.prototype);e.scene=new T.Scene();e.scene.fog=new T.Fog('#91b9c3',65,130);e.appearance={skin:'#c98b62',hair:'#28231e',number:9};e.players=[];e.canvas={parentElement:{clientWidth:390,clientHeight:844}};e.renderer={setSize(){}};e.camera=new T.PerspectiveCamera();return e;}

test('V19 · the simulated match maps onto a real 105 × 68 m pitch',()=>{assert.deepEqual(tacticalToWorld({x:.5,y:1}),{x:0,z:GOAL_Z});assert.deepEqual(tacticalToWorld({x:0,y:0}),{x:-34,z:85});const mid=tacticalToWorld({x:1,y:.5});assert.equal(mid.x,34);assert.equal(mid.z,32.5);
 const back=worldToTactical({x:12.3,z:40.1});assert.ok(Math.abs(tacticalToWorld(back).x-12.3)<1e-9&&Math.abs(tacticalToWorld(back).z-40.1)<1e-9);});

test('V19 · the ball rebounds on the boards and stops in the stands instead of flying through',()=>{
 const roll=launch({x:30,z:10},{x:60,z:10},'low');for(let i=0;i<600;i++)stepBall(roll,1/60);assert.ok(Math.abs(roll.x)<=PITCH.board+.01,'a rolling ball comes back off the boards: '+roll.x.toFixed(2));
 const high={x:0,y:3,z:-15,vx:0,vy:6,vz:-30,bounces:0,age:0};for(let i=0;i<600;i++)stepBall(high,1/60);assert.ok(high.z>=GOAL_Z-PITCH.boardEnd-2.41,'a shot over the bar dies in the stand: '+high.z.toFixed(2));
 const wide={x:0,y:3,z:20,vx:40,vy:8,vz:0,bounces:0,age:0};for(let i=0;i<600;i++)stepBall(wide,1/60);assert.ok(Math.abs(wide.x)<=PITCH.board+2.41);});

test('V19 · full stadium: two goals, every line, and stands standing outside the field',()=>{const e=rig();e.staticWorld();
 const goals=e.scene.children.filter(o=>o.type==='LineSegments');assert.equal(goals.length,2,'one net at each end');
 for(const o of e.stadium.children){if(o.name==='Tribune d’angle')continue;const b=new T.Box3().setFromObject(o);const inside=b.max.x>-PITCH.W&&b.min.x<PITCH.W&&b.max.z>GOAL_Z&&b.min.z<PITCH.far&&b.min.y<3;assert.ok(!inside,'nothing of the stadium stands on the pitch');}
 assert.ok(e.crowd.fans.every(f=>Math.abs(f.x)>PITCH.board||f.z<GOAL_Z-PITCH.boardEnd||f.z>PITCH.far+PITCH.boardEnd),'fans sit behind the boards');assert.ok(e.crowd.fans.some(f=>f.z>PITCH.far),'there is a crowd at the far end too');
 // The follow camera does not chase a ball that went into the stands.
 e.action={hero:{x:0,z:-8},ball:{x:0,y:14,z:-40},teammates:[]};e.resize();const far=e.camera.position.distanceTo(new T.Vector3(0,0,-8));e.action.ball={x:0,y:.22,z:-8};e.resize();assert.ok(far<e.camera.position.distanceTo(new T.Vector3(0,0,-8))*2.2,'the camera stays close');});

test('V19 · the keeper waits low with his arms spread, not with his hands on his belly',()=>{const e=rig(),k=e.makePlayer(0,-19.3,0xe5c45c,1,false,true,'Gardien');for(let i=0;i<20;i++)e.posePlayer(k,{x:0,z:-19.3,state:'set'},1/60,i/60);k.g.updateMatrixWorld(true);
 const l=k.hands[0].getWorldPosition(new T.Vector3()),r=k.hands[1].getWorldPosition(new T.Vector3());assert.ok(Math.abs(l.x-r.x)>.85,'hands at least 85 cm apart: '+Math.abs(l.x-r.x).toFixed(2));assert.ok(l.y<1.25&&r.y<1.25,'hands at hip height');
 // The keeper faces the pitch (rotated half a turn): his left foot is at +x. Feet must stay apart, never crossed, standing or shuffling.
 const feet=()=>{k.g.updateMatrixWorld(true);return k.knees.map(n=>n.children.at(-1).getWorldPosition(new T.Vector3()).x);};
 let [f0,f1]=feet();assert.ok(f0-f1>.2,'feet apart: '+(f0-f1).toFixed(2));
 const hip=k.legs[0].rotation.z;for(let i=0;i<20;i++){e.posePlayer(k,{x:i*.04,z:-19.3,state:'set'},1/60,1+i/60);[f0,f1]=feet();assert.ok(f0-f1>.05,'shuffling feet never cross');}assert.notEqual(k.legs[0].rotation.z,hip,'he steps when he moves');});

test('V19 · real running pace and freeze frame during decisions',async()=>{const {moveToward,PACE}=await import('../dist/movement.js');const a={x:0,z:0,vx:0,vz:0};for(let i=0;i<120;i++)moveToward(a,{x:100,z:0},4,1/60);assert.ok(Math.abs(a.speed-4*PACE)<.05,'top speed '+a.speed.toFixed(2));assert.ok(PACE>1.3);
 const e=rig(),p=e.makePlayer(0,-10,0x63b9f4,9,true);for(let i=0;i<30;i++)e.posePlayer(p,{x:0,z:-10,speed:5,angle:0,kickTimer:-1},1/60,i/60);const hip=p.legs[0].rotation.x;for(let i=0;i<30;i++)e.posePlayer(p,{x:0,z:-10,speed:0,angle:0,kickTimer:-1},1/60,1+i/60,true);assert.equal(p.legs[0].rotation.x,hip,'a frozen player keeps his stride');});

test('V19 · a dribble looks like running: long touches and a full running stride from 4 m/s',async()=>{const {dribbleTarget}=await import('../dist/movement.js');const t=dribbleTarget({x:0,z:0},{x:0,z:-20});assert.ok(Math.abs(t.z+5)<1e-9,'touches up to 5 m');
 const e=rig(),p=e.makePlayer(0,-10,0x63b9f4,9,true);let lean=0,lift=0;for(let i=0;i<60;i++){e.posePlayer(p,{x:0,z:-10,speed:4,angle:0,kickTimer:-1},1/60,i/60);lean=Math.min(lean,p.pose.rotation.x);lift=Math.max(lift,p.knees[0].rotation.x<0?-p.knees[0].rotation.x:0);}assert.ok(lean<-.15,'trunk leans like a runner: '+lean.toFixed(2));assert.ok(lift>.9,'knees lift: '+lift.toFixed(2));});
