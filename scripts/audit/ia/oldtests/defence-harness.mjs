// Banc d'essai de la défense 3D, sans navigateur : reprend la boucle des défenseurs de game.js (updateActors) avec les vraies fonctions
// de dist/football-ai.js et dist/movement.js, sur des dispositions réalistes d'occasion (quatre défenseurs sur la ligne du héros,
// milieux et attaquants adverses revenant de 15 à 45 m, dix partenaires dont le gardien à 83 m) relevées en navigateur.
import {refreshDefence,assignMarkers,defensiveTarget,distance} from '../old/football-ai.js';
import {moveToward} from '../../../../dist/movement.js';
export function rng(seed){let n=seed>>>0;return ()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};}
export function layout(seed){
 const r=rng(seed),U=(a,b)=>a+r()*(b-a);
 const hero={x:U(-14,14),z:U(-3,6),vx:0,vz:0,isHero:true,style:'hero'};
 const defenders=[];
 for(let i=0;i<4;i++)defenders.push({x:-14+i*9.5+U(-2,2),z:hero.z+U(-3,2)});
 for(let i=0;i<6;i++)defenders.push({x:-25+i*10+U(-3,3),z:U(14,46)});
 defenders.forEach(d=>{d.home={x:d.x,z:d.z};d.vx=0;d.vz=0;});
 const mates=[{x:U(-3,3),z:83,style:'gardien',tacticalId:0}];
 for(let i=1;i<=3;i++)mates.push({x:-18+i*12+U(-4,4),z:U(45,62),style:'défenseur',tacticalId:i});
 for(let i=0;i<6;i++)mates.push({x:-22+i*9+U(-3,3),z:U(8,50),style:i%2?'relayeur':'ailier',tacticalId:5+i});
 return {hero,defenders,mates};
}
/** Joue `seconds` secondes : le héros court vers le but (zigzag léger), les défenseurs appliquent refreshDefence + defensiveTarget. */
export function run({hero,defenders,mates},{seconds=6,dt=1/60,zigzag=true,refresh=refreshDefence}={}){
 const partners=[hero,...mates];let press=-1,clock=0,t=0;const stats={markFlips:0,pressFlips:0,markDistSum:0,markDistN:0,reversals:0,keeperMarked:0,frames:0,maxMarkDist:0};
 const lastMark=defenders.map(()=>undefined),lastAng=defenders.map(()=>undefined);
 while(t<seconds){
  // héros : cap vers le but, dévié de ±35° toutes les 1,2 s
  const ang=Math.atan2(-hero.x,-20-hero.z)+(zigzag?Math.sin(t*2.6)*.6:0),sp=5.5;hero.vx=Math.sin(ang)*sp;hero.vz=Math.cos(ang)*sp;
  hero.x=Math.max(-32,Math.min(32,hero.x+hero.vx*dt));hero.z=Math.max(-17,hero.z+hero.vz*dt);if(hero.z<=-17)hero.vz=0;
  clock-=dt;if(clock<=0){const before=press;press=refresh(defenders,hero,partners,press);if(before>=0&&before!==press&&t>.3)stats.pressFlips++;clock=.18;}
  const ball={x:hero.x,z:hero.z-.5,vx:hero.vx,vz:hero.vz};
  for(let i=0;i<defenders.length;i++){const d=defenders[i];
   const beaten=d.z>hero.z+.5&&distance(d,hero)<9?1.2:1;
   const target=defensiveTarget(d,hero,ball,i===press,false,{x:hero.x+hero.vx*.5,z:hero.z+hero.vz*.5});
   const px=d.vx,pz=d.vz;moveToward(d,target,(i===press?4.35:3.8)*beaten,dt,9);
   const a=Math.atan2(d.vz,d.vx);if(Math.hypot(d.vx,d.vz)>1&&lastAng[i]!==undefined){let da=Math.abs(a-lastAng[i]);if(da>Math.PI)da=2*Math.PI-da;if(da>2.1)stats.reversals++;}if(Math.hypot(d.vx,d.vz)>1)lastAng[i]=a;
   if(t>.3&&lastMark[i]!==undefined&&lastMark[i]!==d.mark){stats.markFlips++;if(lastMark[i]&&d.mark)stats.swaps=(stats.swaps||0)+1;}lastMark[i]=d.mark;
   if(d.mark){const dm=distance(d,d.mark);stats.markDistSum+=dm;stats.markDistN++;stats.maxMarkDist=Math.max(stats.maxMarkDist,dm);if(d.mark.style==='gardien')stats.keeperMarked++;}
  }
  stats.frames++;t+=dt;
 }
 return stats;
}
export function batch(n,opts){const tot={markFlips:0,pressFlips:0,reversals:0,keeperMarked:0,markDist:0,N:n};let md=0,mn=0;
 for(let s=1;s<=n;s++){const st=run(layout(s*17+3),opts);tot.markFlips+=st.markFlips;tot.swaps=(tot.swaps||0)+(st.swaps||0);tot.pressFlips+=st.pressFlips;tot.reversals+=st.reversals;tot.keeperMarked+=st.keeperMarked;md+=st.markDistSum;mn+=st.markDistN;}
 tot.markDist=mn?md/mn:0;tot.markFlipsPerEpisode=tot.markFlips/n;tot.swapsPerEpisode=(tot.swaps||0)/n;tot.pressFlipsPerEpisode=tot.pressFlips/n;tot.reversalsPerEpisode=tot.reversals/n;return tot;}
