// Usage : node scripts/audit/mouvement/analyze.mjs [graine] [matchs] [dtImage]
// Balaie des matchs réels et signale les anomalies de déplacement/animation (compte + premiers exemples).
import {sweep,SNAP} from '../../../tests/gameplay-mouvement/sim.mjs';
const seed=+process.argv[2]||1,matches=+process.argv[3]||3,frameDt=1/(+process.argv[4]||60);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
let prev=null;const ring=[];let dumped=0;const F={};const ex={};const add=(k,info)=>{F[k]=(F[k]||0)+1;(ex[k]||(ex[k]=[])).length<4&&ex[k].push(info);};
const run={};const streak={};
const st=sweep({seed,matches,frameDt,onStep(runFn,d){
 const s=JSON.parse(runFn(SNAP));if(!s)return;
 if(prev&&prev.id===s.id&&!prev.frozen&&!s.frozen){
  const pb=prev.ball,b=s.ball;const bj=Math.hypot(b.x-pb.x,b.z-pb.z,b.y-pb.y);if(s.ph==='dribble'&&bj>.35)add('ball-jump-dribble',{ph:s.ph,jump:+bj.toFixed(2),sim:+s.sim.toFixed(2),pb:[pb.x,pb.z].map(v=>+v.toFixed(2)),b:[b.x,b.z].map(v=>+v.toFixed(2)),heroPrev:[prev.actors[0].x,prev.actors[0].z,prev.actors[0].ang].map(v=>+v.toFixed(2)),hero:[s.actors[0].x,s.actors[0].z,s.actors[0].ang].map(v=>+v.toFixed(2)),defCh:s.actors.filter(q=>q.ch).map(q=>q.n+':'+q.ch)});
  for(const a of s.actors){const p=prev.actors.find(q=>q.n===a.n);if(!p)continue;
   for(const k of ['x','z','y','ang','sp'])if(!Number.isFinite(a[k]))add('NaN',{n:a.n,k,ph:s.ph});
   const dx=a.x-p.x,dz=a.z-p.z,dist=Math.hypot(dx,dz),v=dist/d;
   if(dist>.12)add('teleport>12cm/pas('+(a.ch||s.ph)+')',{n:a.n,ph:s.ph,dist:+dist.toFixed(2),ch:a.ch,sim:+s.sim.toFixed(2)});
   if(v>9.5)add('vitesse>9.5',{n:a.n,v:+v.toFixed(1),ph:s.ph,ch:a.ch});
   const da=Math.abs(wrap(a.ang-p.ang));if(da>1.0&&a.n!=='gk')add('rotation>57deg/pas',{n:a.n,deg:Math.round(da*57.3),ph:s.ph,sp:+a.sp.toFixed(1),ch:a.ch,cel:a.cel});
   if(da>2.6&&a.n!=='gk')add('demi-tour>150deg/pas',{n:a.n,deg:Math.round(da*57.3),ph:s.ph,sp:+a.sp.toFixed(1),ch:a.ch,cel:a.cel});
   if(Math.abs(a.x)>34.2||a.z>85.2||a.z<-20.3)add('hors-terrain',{n:a.n,x:+a.x.toFixed(1),z:+a.z.toFixed(1),ph:s.ph});
   // glissement : se déplace sans déclarer de vitesse ; course sur place : vitesse déclarée sans déplacement
   const key=a.n;const sl=v>1.2&&a.sp<.3&&!a.ch,rp=a.sp>1.5&&v<.3;
   if(sl&&a.n!=='gk'){const k='pas-glisses['+s.ph+']';F[k]=(F[k]||0)+1;const kk='vmax-glisse['+s.ph+']';F[kk]=Math.max(F[kk]||0,+v.toFixed(1));}
   streak[key+'s']=sl?(streak[key+'s']||0)+1:0;streak[key+'r']=rp?(streak[key+'r']||0)+1:0;
   if(streak[key+'s']===12&&a.n!=='gk'&&dumped<3&&process.env.DUMP){dumped++;{const idx=+a.n.slice(1);runFn(`globalThis.__log=[];{const sb=separateBodies,mt=moveToward;separateBodies=(x,y,m,f)=>{const bx=x.x,bz=x.z,cx=y.x,cz=y.z;const r=sb(x,y,m,f);if(Math.hypot(x.x-bx,x.z-bz)>1e-6||Math.hypot(y.x-cx,y.z-cz)>1e-6)__log.push('sep '+(x===action.defenders[${idx}]?'D*':(x===action.hero?'H':'?'))+'/'+(y===action.defenders[${idx}]?'D*':y===action.hero?'H':'?')+' '+(x.x-bx).toFixed(4)+','+(x.z-bz).toFixed(4));return r;};moveToward=(ac,t,sp,dt,ac2,br)=>{const bx=ac.x;const r=mt(ac,t,sp,dt,ac2,br);if(ac===action.defenders[${idx}])__log.push('moveToward '+(ac.x-bx).toFixed(4));return r;};}`);runFn('tick(1/120)');console.log('LOG',runFn('JSON.stringify(__log)'));}
console.log('--- DUMP glisse',a.n,s.ph,'hero',JSON.stringify(s.actors[0]),'actor',JSON.stringify(a),'ring',ring.slice(-12).map(r=>{const q=r.actors.find(z=>z.n===a.n);return [r.ph,+q.x.toFixed(2),+q.z.toFixed(2),+q.sp.toFixed(2),q.ch,+Math.hypot(q.x-r.actors[0].x,q.z-r.actors[0].z).toFixed(2)].join('/')}).join(' | '));}
   if(streak[key+'s']===12)add('glisse(v>1.2 vitesse declaree<.3,>0.1s)',{n:a.n,ph:s.ph,v:+v.toFixed(1),sp:+a.sp.toFixed(2),cel:a.cel,sim:+s.sim.toFixed(2)});
   if(streak[key+'r']===24)add('course-sur-place(sp>1.5, v<.3,>0.2s)',{n:a.n,ph:s.ph,v:+v.toFixed(2),sp:+a.sp.toFixed(2),cel:a.cel,sim:+s.sim.toFixed(2)});
   if(a.ch){const k2='ch'+a.n;streak[k2]=(streak[k2]||0)+d;if(a.ct>2.2)add('tacle-bloqué',{n:a.n,ct:a.ct,ch:a.ch});}else streak['ch'+a.n]=0;
  }
  // empilement : deux acteurs au même point
  for(let i=0;i<s.actors.length;i++)for(let j=i+1;j<s.actors.length;j++){const A=s.actors[i],B=s.actors[j];if(A.n==='gk'||B.n==='gk')continue;const dd=Math.hypot(A.x-B.x,A.z-B.z);if(dd<.4)add('empilés<0.4m',{a:A.n,b:B.n,dd:+dd.toFixed(2),ph:s.ph,sim:+s.sim.toFixed(2)});}
 }
 prev=s;ring.push(s);if(ring.length>40)ring.shift();
}});
console.log(JSON.stringify(st));
for(const k of Object.keys(F).sort())console.log(String(F[k]).padStart(7),k,JSON.stringify(ex[k]));
