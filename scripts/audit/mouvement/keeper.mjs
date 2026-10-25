// Continuité du plongeon du gardien : trace y, tilt, reach pour plusieurs tirs (usage : node scripts/audit/mouvement/keeper.mjs)
import {createKeeper,updateKeeper} from '../../../dist/movement.js';
const rnd=Math.random;
function trace(shot,label){
 Math.random=()=>.5;const k=createKeeper(),b={...shot};const dt=1/120;let prev=null,worst={y:0,tilt:0,reach:0,at:''};const rows=[];
 for(let i=0;i<600;i++){b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vy-=9.81*dt;updateKeeper(k,b,dt,true);
  const row={t:i*dt,state:k.state,y:k.y,tilt:k.tilt,reach:k.reach};
  if(prev&&prev.state!=='set'||k.state!=='set'){if(prev){const dy=Math.abs(row.y-prev.y),dtl=Math.abs(row.tilt-prev.tilt),dr=Math.abs(row.reach-prev.reach);if(dy>worst.y){worst.y=dy;worst.at=prev.state+'->'+row.state;}worst.tilt=Math.max(worst.tilt,dtl);worst.reach=Math.max(worst.reach,dr);}}
  if(row.state!=='set')rows.push(row);prev=row;}
 const ground=rows.filter(r=>r.state==='ground');
 console.log(label.padEnd(34),'diveDX',(k.diveDX??NaN).toFixed(2),'diveT',(k.diveT??NaN).toFixed(2),'| saut max par pas : y',worst.y.toFixed(3),'(',worst.at,') tilt',worst.tilt.toFixed(3),'reach',worst.reach.toFixed(3),'| y pendant "ground" min/max',ground.length?Math.min(...ground.map(r=>r.y)).toFixed(2)+'/'+Math.max(...ground.map(r=>r.y)).toFixed(2):'-');
 Math.random=rnd;
}
// tirs au sol / mi-hauteur, lents et rapides, proches et loin du gardien
trace({x:3,y:.4,z:-3,vx:-.5,vy:1,vz:-14},'tir lent coin');
trace({x:1,y:.4,z:-6,vx:.1,vy:1.5,vz:-12},'tir lent centre-gauche');
trace({x:2,y:.4,z:-8,vx:-.8,vy:2.5,vz:-10},'tir lent lobé');
trace({x:2,y:.4,z:-12,vx:-.2,vy:3,vz:-14},'tir lent lointain');
trace({x:.5,y:.3,z:-2,vx:0,vy:.2,vz:-22},'tir puissant proche');
trace({x:4,y:.4,z:-5,vx:-.3,vy:3.5,vz:-12},'tir lent haut');
