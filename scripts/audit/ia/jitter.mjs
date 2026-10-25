// Tremblement : inversions de direction par seconde et par poste, et sauts de position hors reprise.
import {createTactical,stepTactical} from '../../../dist/tactical.js';
const N=+process.argv[2]||20;const res={};let jumps=[];
for(let seed=1;seed<=N;seed++){const s=createTactical(seed*5+2,{allowChances:false});
 const prev=s.players.map(p=>({x:p.x,y:p.y,dx:0,dy:0,ch:0}));let t=0;
 for(let k=0;k<400000;k++){const hold=s.goalHold>0;const e=stepTactical(s,1/60);if(e?.type==='finish')break;t+=1/60;
  s.players.forEach((p,j)=>{const q=prev[j];const dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);
   if(d>.006&&!hold&&s.goalHold<=0&&!(s.pass&&s.pass.to===p)&&p!==s.owner)jumps.push({seed,k,id:p.id,d:+d.toFixed(4)});
   // inversion de direction sur 0.25 s glissantes, hors immobilité
   if(d>1e-5){if(q.dx*dx+q.dy*dy<0&&Math.hypot(q.dx,q.dy)>1e-5&&q.dir!==undefined){}
    const ang=Math.atan2(dy,dx);if(q.ang!==undefined){let da=Math.abs(ang-q.ang);if(da>Math.PI)da=2*Math.PI-da;if(da>2.4)q.ch++;}q.ang=ang;}
   q.x=p.x;q.y=p.y;q.dx=dx;q.dy=dy;});}
 s.players.forEach((p,j)=>{const key=(p.team?'adv':'riv')+'_i'+p.i;res[key]=(res[key]||0)+prev[j].ch/t;});}
const out={};for(const k in res)out[k]=+(res[k]/N).toFixed(2);console.log('inversions de direction (>137°) par seconde, moyenne par poste');console.log(out);
console.log('sauts > .006/pas hors goalHold, hors porteur et destinataire de passe:',jumps.length,jumps.slice(0,6));
