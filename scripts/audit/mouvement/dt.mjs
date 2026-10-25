// moveToward : même distance parcourue quel que soit dt ? oscillation à l'arrêt ? (usage : node scripts/audit/mouvement/dt.mjs)
import {moveToward} from '../../../dist/movement.js';
const dts=[1/20,1/30,1/60,1/90,1/120,1/144];
for(const [speed,acc] of [[4.5,12],[2.7,8],[3.9,9],[5.2,14]]){
 const row=[];
 for(const dt of dts){const a={x:0,z:0,vx:0,vz:0};let t=0;const at={};while(t<2.0-1e-9){moveToward(a,{x:0,z:-30},speed,dt,acc,false);t+=dt;if(Math.abs(t-1)<dt/2)at.one=-a.z;}row.push(`${dt.toFixed(4)}:${at.one.toFixed(2)}/${(-a.z).toFixed(2)}`);}
 console.log('vitesse',speed,'acc',acc,'dist 1s/2s',row.join('  '));
}
// arrêt : cible à 10 m, avec freinage ; on compte les inversions de vitesse (tremblement) et le dépassement
for(const dt of dts){const a={x:0,z:0,vx:0,vz:0};let t=0,flips=0,lastSign=0,max=0,done=-1;while(t<8){const r=moveToward(a,{x:0,z:-10},4.5,dt,9,true);t+=dt;max=Math.max(max,-a.z);const s=Math.sign(a.vz);if(s&&lastSign&&s!==lastSign)flips++;if(s)lastSign=s;if(r&&done<0)done=t;}console.log('arrêt dt',dt.toFixed(4),'dépassement',(max-10).toFixed(3),'inversions',flips,'arrivée à',done.toFixed(2),'s');}
// grand dt (retour d'onglet) : 0.5 s d'un coup, puis 2 s
for(const big of [.25,.5,2]){const a={x:0,z:0,vx:0,vz:0};moveToward(a,{x:0,z:-30},4.5,big,12,false);console.log('gros dt',big,'-> déplacement',(-a.z).toFixed(2),'vitesse',a.speed.toFixed(2));}
// retournement : cible derrière à pleine vitesse, angle brusque ?
{const a={x:0,z:0,vx:0,vz:-6,angle:0};let prev=a.angle,maxStep=0;for(let i=0;i<120;i++){moveToward(a,{x:0,z:30},4.5,1/120,12,false);const d=Math.abs(Math.atan2(Math.sin(a.angle-prev),Math.cos(a.angle-prev)));maxStep=Math.max(maxStep,d);prev=a.angle;}console.log('demi-tour à 6 m/s : plus grand saut d\'angle par pas',(maxStep*57.3).toFixed(0),'deg');}
