// AUDIT-3 · reprise de la simulation après une occasion 3D : le gardien allié que les mises en place (penalty, coup franc) déplacent
// ne doit pas rester planté dans la surface adverse ou au milieu du terrain.
// Lancer : node --test tests/gameplay-ia/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createTactical,stepTactical,resumeTactical,tacticalToWorld} from '../old/tactical.js';

function toChance(seed){const s=createTactical(seed,{allowChances:true,levels:[70,50]});for(let k=0;k<400000;k++){const e=stepTactical(s,1/60);if(e?.type==='chance')return s;}throw new Error('pas d\'occasion');}
const actorsOf=s=>s.players.filter(p=>!p.out).map(p=>({tacticalId:p.id,...tacticalToWorld(p)}));

test('penalty : le gardien allié, posté au bord de la surface adverse par la mise en place 3D, reste sur sa ligne dans la simulation',()=>{
 const s=toChance(9),home={x:s.players[0].x,y:s.players[0].y},actors=actorsOf(s);
 actors.find(a=>a.tacticalId===0).x=-7.2;actors.find(a=>a.tacticalId===0).z=-2.6;// position réelle observée en navigateur (setupPenalty, i = 0)
 resumeTactical(s,actors,'save',{x:0,z:-19,y:.22},undefined);
 assert.deepEqual({x:s.players[0].x,y:s.players[0].y},home);
});

test('coup franc : le gardien allié posté à (14 ; 18) m par setupFreeKick ne reste pas au milieu du terrain, il ne bouge pas de sa ligne',()=>{
 const s=toChance(21),before=s.players[0].y,actors=actorsOf(s);const k=actors.find(a=>a.tacticalId===0);k.x=14;k.z=18;
 resumeTactical(s,actors,'miss',{x:0,z:-19,y:.22},undefined);
 assert.ok(s.players[0].y<.1,'y du gardien allié : '+s.players[0].y+' (avant '+before+')');
 // et 1 s de simulation plus tard il n'a pas quitté sa zone
 for(let i=0;i<60;i++)stepTactical(s,1/60);assert.ok(s.players[0].y<.1);
});

test('les autres joueurs, eux, reprennent bien leur position 3D (le déplacement du gardien allié est la seule exception)',()=>{
 const s=toChance(9),actors=actorsOf(s);const p=actors.find(a=>a.tacticalId===5);p.x=3;p.z=10;
 resumeTactical(s,actors,'save',{x:0,z:-19,y:.22},undefined);
 const q=s.players.find(x=>x.id===5);assert.ok(Math.abs(q.x-(3/68+.5))<1e-9&&Math.abs(q.y-(85-10)/105)<1e-9);
});
