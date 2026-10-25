// Lot 12 · ia : balayage de la simulation tactique 2D (matchs de 90 min, sans occasions jouables) : buts, tirs, passes, possession, durée pendant laquelle un adversaire
// reste collé au porteur (< 3,5 m) sans récupérer, et déplacement moyen des joueurs de champ hors porteur.
// Usage : node tests/lot12-ia/sim2d.mjs [matchs=60]
import {createTactical,stepTactical,tacticalToWorld} from '../../dist/tactical.js';
export function sim2d(n=60,{levels=[60,60]}={}){
 const R={goals:0,shots:0,passes:0,poss0:0,poss1:0,close:[],roam:[],won:0,steps:0,ints:0};
 for(let m=0;m<n;m++){
  const s=createTactical(1000+m,{allowChances:false,levels});let closeT=0,last=null;
  for(let i=0;i<90*60*20&&s.minute<90;i++){
   const owner=s.owner;
   const ev=stepTactical(s,1/20);if(ev?.type==='goal')R.goals++;if(ev?.type==='shot')R.shots++;
   // proximité adversaire/porteur (hors passe en cours)
   if(!s.pass&&!s.shot&&s.owner){const o=s.owner;const near=s.players.some(p=>p.team!==o.team&&p.i!==0&&!p.out&&Math.hypot((p.x-o.x)*68,(p.y-o.y)*105)<3.5);if(near)closeT+=1/20;else{if(closeT>0)R.close.push(closeT);closeT=0;}}
   if(owner&&s.owner!==owner)R.won++;
   if(i%20===0){for(const p of s.players){if(p===s.owner||p.i===0)continue;R.roam.push(Math.hypot((p.x-p.homeX)*68,(p.y-p.homeY)*105));}}
  }
  R.passes+=s.passes[0]+s.passes[1];R.poss0+=s.possession[0]/(s.possession[0]+s.possession[1]);
 }
 return R;
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
if(process.argv[1].endsWith('sim2d.mjs')){
 const n=+process.argv[2]||60,R=sim2d(n);
 console.log('matchs',n,'| buts/match',(R.goals/n).toFixed(2),'| tirs/match',(R.shots/n).toFixed(2),'| passes/match',(R.passes/n).toFixed(1),'| possession Rivage',(R.poss0/n*100).toFixed(1)+' %','| changements de porteur sur balle/match',(R.won/n).toFixed(1));
 console.log('adversaire <3,5 m du porteur: épisodes',R.close.length,'moy',avg(R.close).toFixed(2),'s','max',Math.max(0,...R.close).toFixed(1),'s','; >4 s :',R.close.filter(x=>x>4).length);
 console.log('éloignement moyen des joueurs de champ à leur poste : ',avg(R.roam).toFixed(1),'m');
}
