// Lot 12 · ia : tests de non-régression (point 4 du retour de test : partenaires cantonnés, passes insuffisantes, passes en profondeur lentes, défenseur qui ne récupère pas).
// Ils échouent sur l'ancien code (voir docs/audit-gameplay2/ia.md) et passent avec les correctifs de football-ai.js, tactical.js et docs/audit-gameplay2/ia-patch.py.
import {test} from 'node:test';import assert from 'node:assert/strict';
import * as ai from '../../dist/football-ai.js';
import {createTactical,stepTactical} from '../../dist/tactical.js';
import {scenario} from './scenario.mjs';
import {profondeur} from './profondeur.mjs';
import {boot} from '../gameplay-mouvement/harness-reel.mjs';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const partner=(id,x,z)=>({tacticalId:id,x,z,home:{x,z}});

test('supportSpot existe et ne déplace jamais le gardien',()=>{
 assert.equal(typeof ai.supportSpot,'function');
 assert.equal(ai.supportSpot(partner(0,0,60),{x:0,z:10},[]),null);
 assert.equal(ai.roleOf(9),'fwd');assert.equal(ai.roleOf(5),'mid');assert.equal(ai.roleOf(2),'def');assert.equal(ai.roleOf(22+9),'fwd');
});

test('un attaquant masqué se démarque : sa ligne de passe est ouverte, il reste en jeu et près de son poste',()=>{
 const carrier={x:0,z:10},t=partner(9,6,-2),defs=[{x:3,z:4},{x:8,z:1},{x:-6,z:-3},{x:2,z:-6}];
 const before=ai.laneClearance(carrier,t,defs);
 const s=ai.supportSpot(t,carrier,defs,{anchor:{x:6,z:-2},line:-8,mates:[],tactic:'equilibre'});
 assert.ok(s);
 assert.ok(before<1,'point de départ : ligne bloquée '+before);
 assert.ok(ai.laneClearance(carrier,s,defs)>=1.5,'ligne ouverte : '+ai.laneClearance(carrier,s,defs));
 assert.ok(s.z>=-8+.3,'jamais hors-jeu (ligne à -8) : z='+s.z);
 assert.ok(dist(s,{x:6,z:-2})<=12.5*1.45+1e-9,'reste dans son rayon de poste');
});

test('un attaquant se place entre les lignes : au niveau de la ligne de hors-jeu, dans un trou entre deux défenseurs',()=>{
 const carrier={x:0,z:20},t=partner(10,10,0),defs=[{x:-10,z:-6},{x:-3,z:-6},{x:4,z:-6},{x:11,z:-6}];
 const s=ai.supportSpot(t,carrier,defs,{anchor:{x:10,z:0},line:-6,mates:[]});
 assert.ok(s.z>=-6+.3,'en jeu');
 assert.ok(Math.min(...defs.map(d=>dist(d,s)))>=3,'dans un espace libre : '+Math.min(...defs.map(d=>dist(d,s))));
 assert.ok(ai.laneClearance(carrier,s,defs)>=1.5);
});

test('un défenseur reste derrière le ballon, un partenaire ne se colle pas à un autre',()=>{
 const carrier={x:0,z:10},d=partner(2,-8,22);
 const s=ai.supportSpot(d,carrier,[{x:0,z:-4}],{anchor:{x:-8,z:22},line:-9,mates:[]});
 assert.ok(s.z>=carrier.z+1.5,'défenseur derrière le porteur : z='+s.z);
 const m=partner(6,0,2),mate={x:-1,z:1};
 const s2=ai.supportSpot(m,carrier,[{x:10,z:-8}],{anchor:{x:0,z:2},line:-9,mates:[mate]});
 assert.ok(dist(s2,mate)>=3,'espacé du coéquipier : '+dist(s2,mate));
 assert.ok(dist(s2,carrier)>=4.5,'pas collé au porteur : '+dist(s2,carrier));
});

test('le choix est déterministe et stable (aucun tremblement) tant qu’il n’y a pas mieux',()=>{
 const carrier={x:0,z:10},t=partner(8,-7,0),defs=[{x:-4,z:5},{x:5,z:0}];
 const o={anchor:{x:-7,z:0},line:-7,mates:[]};
 const a=ai.supportSpot(t,carrier,defs,o),b=ai.supportSpot(t,carrier,defs,o);
 assert.deepEqual(a,b);
 const moved=[{x:-4.2,z:5},{x:5,z:0.2}];
 const c=ai.supportSpot(t,carrier,moved,{...o,previous:a});
 assert.ok(dist(c,a)<1e-9,'un détail ne change pas le point visé');
});

test('dédoublement : un latéral du côté du porteur peut passer à l’extérieur',()=>{
 const carrier={x:20,z:5},t=partner(4,17,12),defs=[{x:19,z:-1},{x:12,z:2}];
 let overlap=false;
 const s=ai.supportSpot(t,carrier,defs,{anchor:{x:17,z:12},line:-9,mates:[]});
 overlap=s.x>carrier.x-.01||s.z<carrier.z+1;
 assert.ok(overlap,'le latéral monte : '+JSON.stringify(s));
});

test('passe en profondeur : le ballon a du rythme (≥ 11 m/s au départ) et arrive jusqu’au point dans l’énorme majorité des cas',()=>{
 const o=profondeur({matches:24,seed:3});
 assert.ok(o.length>=5,'assez de passes jouées : '+o.length);
 const slow=o.filter(x=>x.v0<11);
 assert.equal(slow.length,0,'passes trop lentes : '+JSON.stringify(slow.map(x=>x.v0)));
 const reached=o.filter(x=>x.reach!=null).length;
 assert.ok(reached/o.length>=.6,`le ballon arrive au point : ${reached}/${o.length}`);
});

test('un partenaire masqué se démarque en jeu réel pendant une conduite : il vise un espace ouvert, en jeu, et s’y déplace',()=>{
 const rs=[1,3,4].map(seed=>scenario({seed}));
 for(const r of rs){
  assert.ok(r.spot,'un point de soutien est calculé');
  assert.ok(r.laneSpot>=1.2,'la ligne de passe vers ce point est ouverte (ancienne ligne '+r.lane0.toFixed(2)+') : '+r.laneSpot.toFixed(2));
  assert.ok(r.spot.z>=r.line+.3-1e-9,'jamais hors-jeu : '+r.spot.z+' vs '+r.line);
  assert.ok(r.moved>2,'il se déplace vraiment : '+r.moved.toFixed(1)+' m');
 }
});

test('protection du ballon : un défenseur proche vient au contact (< 1,1 m) au lieu de flotter à 1,4 m, et récupère parfois le ballon',()=>{
 const {run}=boot();run(`{let r=77;Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
 let n=0;const near=[];
 for(let m=0;m<40&&n<60;m++){
  run("$('play').onclick();");let g=0;
  while(run('!!match')&&g++<20000&&n<60){
   if(run("action.ready&&action.phase==='aerial'"))run('controlAgain("x")');
   if(run('action.ended&&action.after>1.2')){run("$('continue').onclick()");continue;}
   if(run('action.phase')==='interval'){run('action.interval.fast=true;tick(.04)');continue;}
   if(run("action&&action.ready&&action.phase==='ready'&&!action.ended&&!action.setPiece")){
    n++;if(n%3===0){run('beginDribble({x:0,z:-30})');for(let i=0;i<800&&run("!!action&&!action.ended&&action.phase==='dribble'");i++)run('tick(1/120)');continue;}
    run('beginShield()');const pd=()=>run('Math.hypot(action.defenders[action.pressIndex].x-action.hero.x,action.defenders[action.pressIndex].z-action.hero.z)');const d0=pd();let md=d0;
    for(let i=0;i<300&&run("!!action&&!action.ended&&action.phase==='shield'");i++){run('tick(1/120)');md=Math.min(md,pd());}
    if(d0<3)near.push({md,lost:!!run('!!action&&action.ended')});continue;}
   run('tick(1/120)');
  }
 }
 assert.ok(near.length>=8,'assez de protections avec un défenseur proche : '+near.length);
 const contact=near.filter(x=>x.md<1.1).length;
 assert.ok(contact/near.length>=.8,`le défenseur proche vient au contact : ${contact}/${near.length}`);
 const lost=near.filter(x=>x.lost).length;
 assert.ok(lost>=1&&lost/near.length<.6,`le ballon est parfois perdu, pas toujours : ${lost}/${near.length}`);
});

test('simulation 2D (non modifiée) : garde-fou d’équilibre (buts, tirs et passes par match restent dans la fourchette d’avant)',()=>{
 let goals=0,shots=0,passes=0;const n=24;
 for(let m=0;m<n;m++){const s=createTactical(2000+m,{allowChances:false});for(let i=0;i<90*60*20&&s.minute<90;i++){const ev=stepTactical(s,1/20);if(ev?.type==='goal')goals++;if(ev?.type==='shot')shots++;}passes+=s.passes[0]+s.passes[1];}
 assert.ok(goals/n>.45&&goals/n<1.15,'buts/match '+(goals/n).toFixed(2));
 assert.ok(shots/n>2.8&&shots/n<5,'tirs/match '+(shots/n).toFixed(2));
 assert.ok(passes/n>60&&passes/n<100,'passes/match '+(passes/n).toFixed(1));
});
