// Points superposés dans la simulation 2D : fraction du temps où deux joueurs sont à moins de 0,012 (≈ 1,3 m) l'un de l'autre.
import {createTactical,stepTactical} from '../../../dist/tactical.js';
const N=+process.argv[2]||10;let frames=0,over=0,worst=0;const byPair={};
for(let seed=1;seed<=N;seed++){const s=createTactical(seed*9+4,{allowChances:false});
 for(let k=0;k<400000;k++){const e=stepTactical(s,1/60);if(e?.type==='finish')break;frames++;let f=0;
  for(let i=0;i<22;i++)for(let j=i+1;j<22;j++){const a=s.players[i],b=s.players[j];if(a.out||b.out)continue;const d=Math.hypot(a.x-b.x,a.y-b.y);if(d<.012){f++;const key=`${a.team}:${a.i}/${b.team}:${b.i}`;byPair[key]=(byPair[key]||0)+1;}}
  if(f)over++;worst=Math.max(worst,f);}}
console.log({frames,framesAvecSuperposition:over,pct:+(100*over/frames).toFixed(1),maxPaires:worst});
console.log(Object.entries(byPair).sort((a,b)=>b[1]-a[1]).slice(0,8));
