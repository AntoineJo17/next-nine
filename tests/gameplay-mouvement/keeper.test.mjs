// Audit mouvement · plongeon du gardien : aucune discontinuité (hauteur, inclinaison, portée des bras) et pas de lévitation au sol.
// Avant correction : au passage « ground » -> « recover », y sautait jusqu'à 0,41 m, l'inclinaison jusqu'à 0,89 rad, la portée jusqu'à 0,49 m en un pas
// (le gardien restait suspendu en l'air pendant 0,7 s quand le ballon arrivait tard, puis chutait d'un mètre d'un coup).
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createKeeper,updateKeeper} from '../../dist/movement.js';

function dive(shot,seed=.5){
 const rnd=Math.random;Math.random=()=>seed;
 try{const k=createKeeper(),b={...shot},dt=1/120,rows=[];
  for(let i=0;i<720;i++){b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vy-=9.81*dt;updateKeeper(k,b,dt,true);rows.push({state:k.state,y:k.y,tilt:k.tilt,reach:k.reach});}
  return {k,rows};
 }finally{Math.random=rnd;}
}
const SHOTS=[
 {x:3,y:.4,z:-3,vx:-.5,vy:1,vz:-14},{x:1,y:.4,z:-6,vx:.1,vy:1.5,vz:-12},{x:2,y:.4,z:-8,vx:-.8,vy:2.5,vz:-10},
 {x:2,y:.4,z:-12,vx:-.2,vy:3,vz:-14},{x:.5,y:.3,z:-2,vx:0,vy:.2,vz:-22},{x:4,y:.4,z:-5,vx:-.3,vy:3.5,vz:-12},
 {x:-3,y:.4,z:-4,vx:.6,vy:1.2,vz:-13},{x:0,y:.3,z:-9,vx:-.1,vy:2,vz:-11},
 // tirs hauts et lents : le saut culmine après la fin du plongeon (avant correction : gardien suspendu à +0,1..+0,6 m pendant 0,7 s)
 {x:1.5,y:.4,z:-8,vx:-.15,vy:5,vz:-16},{x:-2,y:.4,z:-8,vx:.2,vy:5,vz:-16},{x:1.5,y:.4,z:-10,vx:-.15,vy:5,vz:-12},
];

test('le plongeon est continu : pas de saut de hauteur, d\'inclinaison ou de portée entre deux pas de 1/120 s',()=>{
 let dived=0;
 for(const shot of SHOTS)for(const seed of [.1,.5,.9]){
  const {rows}=dive(shot,seed);if(rows.some(r=>r.state==='dive'))dived++;
  for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];
   assert.ok(Math.abs(b.y-a.y)<.06,`saut de hauteur ${Math.abs(b.y-a.y).toFixed(3)} m (${a.state}->${b.state}, tir ${JSON.stringify(shot)})`);
   assert.ok(Math.abs(b.tilt-a.tilt)<.1,`saut d'inclinaison ${Math.abs(b.tilt-a.tilt).toFixed(3)} rad (${a.state}->${b.state})`);
   assert.ok(Math.abs(b.reach-a.reach)<.06,`saut de portée ${Math.abs(b.reach-a.reach).toFixed(3)} m (${a.state}->${b.state})`);}
 }
 assert.ok(dived>=20,'le balayage doit contenir de vrais plongeons : '+dived);
});

test('au sol le gardien ne reste pas suspendu en l\'air',()=>{
 for(const shot of SHOTS){const {rows}=dive(shot);const ground=rows.filter(r=>r.state==='ground');if(!ground.length)continue;
  // après 0,3 s de « ground », il est posé (hauteur <= 0, c.-à-d. au plus au niveau debout) : la chute est de 0,6 m au plus
  const settled=ground.slice(40);assert.ok(settled.every(r=>r.y<=0.001),'gardien en lévitation : y='+Math.max(...settled.map(r=>r.y)).toFixed(2));}
});

test('après la récupération le gardien est revenu exactement en position debout et ses paramètres de plongeon sont remis à zéro',()=>{
 const {k}=dive(SHOTS[2]);assert.equal(k.state,'set');for(const v of [k.tilt,k.y,k.reach])assert.ok(Math.abs(v)<1e-9,'valeur résiduelle '+v);
 assert.equal(k.diveDX,undefined,'un ancien diveDX ne doit pas fausser une sortie/plongeon ultérieur');assert.equal(k.diveT,undefined);
});
