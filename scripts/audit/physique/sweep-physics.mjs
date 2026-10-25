// Balayage déterministe de physics.js : invariants + dépendance au pas de temps.
import {launch,stepBall,goalCrossing,frameContact,R} from '../../../dist/physics.js';
let s=12345;const rnd=()=>(s=(s*1664525+1013904223)>>>0)/4294967296;
const modes=['low','normal','lob'];
function fly(start,target,mode,spin,power,dt,T=6){const b=launch(start,target,mode,spin,power);const out={goal:null,frame:null,maxSpeed:0,minY:9,nan:false,end:null,bounces:0};
 for(let t=0;t<T;t+=dt){const before=stepBall(b,dt);const f=frameContact(before,b);if(f&&!out.frame)out.frame={kind:f,t};const c=goalCrossing(before,b);if(c&&!out.goal)out.goal={...c,t};
  const sp=Math.hypot(b.vx,b.vy,b.vz);out.maxSpeed=Math.max(out.maxSpeed,sp);out.minY=Math.min(out.minY,b.y);if(![b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite))out.nan=true;}
 out.end={x:b.x,y:b.y,z:b.z};out.bounces=b.bounces;return out;}
const dts=[1/20,1/30,1/60,1/120,1/144];
const stats={n:0,nan:0,under:0,maxSpeed:0,same:0,diff:0,ex:[]};
for(let i=0;i<4000;i++){const start={x:(rnd()-.5)*60,z:-10+rnd()*80},target={x:(rnd()-.5)*40,z:-22+rnd()*60};const mode=modes[i%3];
 const power=mode==='normal'&&rnd()<.7?rnd():null,spin=(rnd()-.5)*2;
 const r=dts.map(dt=>fly(start,target,mode,spin,power,dt));stats.n++;
 if(r.some(x=>x.nan))stats.nan++;if(r.some(x=>x.minY<R-1e-9))stats.under++;stats.maxSpeed=Math.max(stats.maxSpeed,...r.map(x=>x.maxSpeed));
 const gs=r.map(x=>x.goal?x.goal.inside?'G':'o':'-').join('');if(new Set(gs).size>1){stats.diff++;if(stats.ex.length<8)stats.ex.push({mode,start,target,power,spin,gs,frames:r.map(x=>x.frame?.kind||'')});}else stats.same++;}
console.log(JSON.stringify(stats,null,1));
