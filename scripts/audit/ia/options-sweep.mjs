// Balayage des options (cartons rouges, entrée en cours de match, remontada, pluie, postes) : invariants uniquement.
import {createTactical,stepTactical,resumeTactical,heroOff,setTactic,TACTICS} from '../../../dist/tactical.js';
const bad={};const b=(k,x)=>{bad[k]=(bad[k]||[]);if(bad[k].length<3)bad[k].push(x);};
let reds=0,subs=0,changes=0,matches=0,heroChances=0,resumes=0;
for(let seed=1;seed<=120;seed++){
 const opts={redCards:true,rain:seed%5===0,position:['BU','AIL','MOC'][seed%3],entryMinute:seed%4===0?30+seed%40:0,startMinute:seed%7===0?55:0,startScore:seed%7===0?[0,1]:undefined,tactic:Object.keys(TACTICS)[seed%4],opponentTactic:Object.keys(TACTICS)[(seed>>2)%4],levels:[50+seed%40,50+(seed*7)%40],energy:30+seed%70};
 const s=createTactical(seed,opts);matches++;
 for(let k=0;k<400000;k++){
  if(k%900===0)setTactic(s,Object.keys(TACTICS)[(k/900+seed)%4|0]);
  const e=stepTactical(s,1/60);
  if(e){if(e.type==='finish')break;if(e.type==='red')reds++;if(e.type==='change')changes++;if(e.type==='sub')subs++;
   if(e.type==='chance'){heroChances++;const p=s.players;const out=['goal','save','miss','tackle'][(k+seed)%4];
     // reprise avec acteurs recopiés (positions inchangées), comme game.js
     const actors=p.filter(q=>!q.out).map(q=>({tacticalId:q.id,x:(q.x-.5)*68,z:85-q.y*105}));
     const oid=out==='tackle'?p.find(q=>q.team===1&&q.i>0&&!q.out).id:undefined;
     resumeTactical(s,actors,out,{x:s.ball.x*68-34,z:85-s.ball.y*105,y:.2},oid);resumes++;}}
  for(const p of s.players){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))b('nan',{seed,k,id:p.id});else if(p.x<0||p.x>1||p.y<0||p.y>1)b('out',{seed,k,id:p.id,x:p.x,y:p.y});}
  if(s.owner.out)b('ownerOut',{seed,k,name:s.owner.name});
  if(s.owner&&Math.hypot(s.owner.x-s.ball.x,s.owner.y-s.ball.y)>.12&&!s.pass&&!s.shot&&s.goalHold<=0)b('ballFarFromOwner',{seed,k,d:Math.hypot(s.owner.x-s.ball.x,s.owner.y-s.ball.y)});
 }
 if(s.score[0]+s.score[1]>9)b('manyGoals',{seed,score:s.score});
}
console.log({matches,reds,subs,changes,heroChances,resumes,bad:JSON.stringify(bad)});
