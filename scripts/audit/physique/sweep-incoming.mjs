// Passes entrantes (coéquipier -> héros), sol et lob, avec défenseurs aléatoires : issue, durée, sauts, vitesses.
import {newGame,rng} from '../../../tests/gameplay-physique/_game.mjs';
const N=+process.argv[2]||200,seed=+process.argv[3]||9;const r=rng(seed);
const sum={n:0,kinds:{},bad:[],stuck:[],durations:[]};
for(let i=0;i<N;i++){
 const g=newGame(i+1);const mode=i%2?'lob':'pass',hx=(r()-.5)*30,hz=-10+r()*40,mx=hx+(r()-.5)*40,mz=hz+5+r()*25;
 g.setRandom(2000+i);
 g.run(`const h=action.hero;h.x=${hx};h.z=${hz};action.defenders.forEach((d,k)=>{d.x=${hx}+(k-3)*${r()<.5?6:2.5};d.z=${hz}-${r()*12};});action.teammates.forEach((t,k)=>{t.x=-30;t.z=40;});const m=action.teammates[0];m.x=${mx};m.z=${mz};beginIncomingFrom(m,'${mode}');`);
 const o=g.drive({dts:r()<.5?1/120:[1/120,1/90,1/200],maxT:12,afterT:.2});sum.n++;
 const key=(o.ended?o.kind:o.ready?'ready':'running:'+o.phase);sum.kinds[key]=(sum.kinds[key]||0)+1;
 if(o.nan||o.minY<.22-1e-6)sum.bad.push({i,mode,why:'nan/underground'});
 if(!o.ended&&!o.ready)sum.stuck.push({i,mode,hx,hz,mx,mz,phase:o.phase,fin:o.finalBall,msg:o.msg});
 sum.durations.push(+o.t.toFixed(1));
 if(o.maxSpeed>40)sum.bad.push({i,mode,why:'speed '+o.maxSpeed.toFixed(1),d:Math.hypot(mx-hx,mz-hz).toFixed(0)});
}
sum.durations=sum.durations.sort((a,b)=>a-b).filter((_,k)=>k%20===0);
console.log(JSON.stringify(sum,null,1));
