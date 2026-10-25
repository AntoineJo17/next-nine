// Audit mouvement · balayage déterministe de matchs réels (game.js dans le harnais vm, simulation tactique -> occasion -> passe d'ouverture réelles).
// Invariants vérifiés à chaque sous-pas de 1/120 s, pour des images de 1/30, 1/60 et 1/144 s : pas de NaN, pas de téléportation, pas de sortie de terrain,
// pas de vitesse irréaliste, pas de demi-tour instantané pendant la course (dribble, passe d'ouverture), pas d'empilement.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {sweep,SNAP} from './sim.mjs';
import {moveToward} from '../../dist/movement.js';

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

function audit({seed,matches,frameDt}){
 let prev=null;const bad={nan:0,teleport:0,speed:0,out:0,stack:0,turnRun:0};const ex=[];let steps=0;
 const st=sweep({seed,matches,frameDt,onStep(run,d){
  const s=JSON.parse(run(SNAP));if(!s)return;steps++;
  if(prev&&prev.id===s.id&&!prev.frozen&&!s.frozen){
   for(const a of s.actors){const p=prev.actors.find(q=>q.n===a.n);if(!p)continue;
    if(![a.x,a.z,a.y,a.ang,a.sp].every(Number.isFinite)){bad.nan++;ex.push(['nan',a.n,s.ph]);}
    const dist=Math.hypot(a.x-p.x,a.z-p.z);
    // la réception de volée/tête (phase « aerial ») replace volontairement le joueur sous le ballon : le moteur de rendu l'affiche en pas rapide (engine.js, Lot 4)
    if(dist>.12&&s.ph!=='aerial'&&prev.ph!=='aerial'){bad.teleport++;ex.push(['teleport',a.n,s.ph,+dist.toFixed(2)]);}
    if(dist/d>9.5&&s.ph!=='aerial'&&prev.ph!=='aerial'){bad.speed++;ex.push(['vitesse',a.n,s.ph]);}
    if(Math.abs(a.x)>34.2||a.z>85.2||a.z<-20.3){bad.out++;ex.push(['hors',a.n,a.x,a.z]);}
    // pendant la course (conduite, passe d'ouverture) le corps tourne à vitesse limitée : jamais plus de 20° par pas de 1/120 s
    if((s.ph==='dribble'||s.ph==='incoming')&&a.n!=='gk'&&!a.ch&&Math.abs(wrap(a.ang-p.ang))>.35){bad.turnRun++;ex.push(['rotation',a.n,s.ph,Math.round(Math.abs(wrap(a.ang-p.ang))*57.3)]);}
   }
   for(let i=0;i<s.actors.length;i++)for(let j=i+1;j<s.actors.length;j++){const A=s.actors[i],B=s.actors[j];if(A.n==='gk'||B.n==='gk')continue;if(Math.hypot(A.x-B.x,A.z-B.z)<.3){bad.stack++;ex.push(['empilés',A.n,B.n,s.ph]);}}
  }
  prev=s;
 }});
 return {st,bad,ex:ex.slice(0,6),steps};
}

for(const [fps,seed] of [[60,31],[30,32],[144,33]]){
 test(`balayage de matchs réels à ${fps} images/s : aucune anomalie de déplacement`,()=>{
  const r=audit({seed,matches:fps===144?3:6,frameDt:1/fps});
  assert.ok(r.st.actions>=3&&r.steps>1000,'le balayage doit couvrir de vraies actions : '+JSON.stringify(r.st));
  assert.deepEqual(r.bad,{nan:0,teleport:0,speed:0,out:0,stack:0,turnRun:0},JSON.stringify(r.ex));
 });
}

test('moveToward : même distance parcourue de 20 à 144 images/s (à 3 % près), jamais de dépassement de la cible',()=>{
 const reach=(dt,speed,acc)=>{const a={x:0,z:0,vx:0,vz:0};for(let t=0;t<2-1e-9;t+=dt)moveToward(a,{x:0,z:-60},speed,dt,acc,false);return -a.z;};
 for(const [speed,acc] of [[4.5,12],[2.7,8],[3.9,9],[5.2,14]]){const ref=reach(1/120,speed,acc);for(const fps of [20,30,60,90,144])assert.ok(Math.abs(reach(1/fps,speed,acc)/ref-1)<.03,`v=${speed} à ${fps} fps : ${reach(1/fps,speed,acc).toFixed(2)} m contre ${ref.toFixed(2)} m`);}
 for(const fps of [20,30,60,144]){const a={x:0,z:0,vx:0,vz:0};let max=0;for(let t=0;t<8;t+=1/fps){moveToward(a,{x:0,z:-10},4.5,1/fps,9,true);max=Math.max(max,-a.z);}assert.ok(max<=10+1e-9,'dépassement à '+fps+' fps : '+max);assert.ok(Math.abs(a.z+10)<.04,'arrêt à moins de 4 cm de la cible');}
});
