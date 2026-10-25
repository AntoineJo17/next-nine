// Tirs visant poteaux/barre dans le jeu réel : traverse-t-on un poteau ? vitesse après rebond ? issue ?
import {newGame,rng} from '../../../tests/gameplay-physique/_game.mjs';
const N=+process.argv[2]||150,seed=+process.argv[3]||3;const r=rng(seed);
const sum={n:0,frameHits:0,kinds:{},through:[],speedGain:[],weird:[]};
for(let i=0;i<N;i++){
 const g=newGame(i+1);const side=r()<.5?-1:1,tx=side*(3.66+(r()-.5)*1.2),power=.35+r()*.6,hx=(r()-.5)*16,hz=-2+r()*20;
 g.setRandom(500+i);
 g.run(`const h=action.hero;h.x=${hx};h.z=${hz};attachBall(h);action.started=true;action.defenders.forEach((d,k)=>{d.x=30;d.z=40;});action.teammates.forEach((d,k)=>{d.x=-30;d.z=30;});windUp(h,{x:${tx},z:-21},'normal','hero',0,${power});`);
 const o=g.drive({dts:1/120,maxT:10,afterT:.2,trace:true});sum.n++;const tr=o.trace;
 let hit=o.events.find(e=>/Poteau|Barre/.test(e.fb));if(hit){sum.frameHits++;const k=o.trace.findIndex(q=>q[0]>=hit.t);const a=o.trace[k-1],b=o.trace[k+2];if(a&&b){const s0=Math.hypot(a[4],a[5],a[6]),s1=Math.hypot(b[4],b[5],b[6]);hit.s0=s0;hit.s1=s1;if(s1>s0*1.02)sum.speedGain.push({i,hit});}}
 for(let k=1;k<tr.length;k++){const [t,x,y,z,vx,vy,vz]=tr[k],[,x0,y0,z0,vx0,vy0,vz0]=tr[k-1];
  const sp=Math.hypot(vx,vy,vz),sp0=Math.hypot(vx0,vy0,vz0);
  
  // pénétration d'un poteau (axe vertical) ou de la barre (axe horizontal)
  const dPost=Math.min(Math.hypot(x-3.66,z+20),Math.hypot(x+3.66,z+20));const dBar=Math.abs(x)<=3.66?Math.hypot(y-2.44,z+20):9;
  if((dPost<.24&&y<2.5||dBar<.24)&&tr[k][7]==='flight')sum.through.push({i,t,x,y,z,dPost:+dPost.toFixed(3),dBar:+dBar.toFixed(3)});
 }
 sum.kinds[(o.kind||'none')+'/'+(hit?'frame':'noframe')]=(sum.kinds[(o.kind||'none')+'/'+(hit?'frame':'noframe')]||0)+1;if(hit&&(sum.weird.length<6))sum.weird.push({i,tx:+tx.toFixed(2),power:+power.toFixed(2),ev:o.events.slice(0,5),kind:o.kind});
}
sum.through=sum.through.slice(0,10);sum.speedGain=sum.speedGain.slice(0,5);
console.log(JSON.stringify(sum,null,1));
