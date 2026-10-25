// Lot 12 · mouvement : mesure des vitesses réelles (héros / partenaires / défenseurs) et des sauts par sous-pas.
// Usage : node tests/lot12-mouvement/mesure.mjs [graine] [matchs]
import {sweep,SNAP} from '../gameplay-mouvement/sim.mjs';
const seed=+process.argv[2]||1,matches=+process.argv[3]||6;
let prev=null;const S={};const J=[];
const grp=n=>n==='hero'?'hero':n[0]==='t'?'mate':n[0]==='d'?'def':'gk';
const st=sweep({seed,matches,frameDt:1/60,onStep(run,d){
 const s=JSON.parse(run(SNAP));if(!s)return;
 if(prev&&prev.id===s.id&&!prev.frozen&&!s.frozen){
  for(const a of s.actors){const p=prev.actors.find(q=>q.n===a.n);if(!p)continue;const dist=Math.hypot(a.x-p.x,a.z-p.z),v=dist/d,g=grp(a.n);
   const k=g+'/'+s.ph;const o=S[k]||(S[k]={n:0,max:0,sum:0,over7:0});o.n++;o.sum+=v;if(v>o.max)o.max=v;if(v>7)o.over7++;
   const k2=g+'/*';const o2=S[k2]||(S[k2]={n:0,max:0,sum:0,over7:0,vs:[]});o2.n++;o2.sum+=v;if(v>o2.max)o2.max=v;if(v>7)o2.over7++;o2.vs.push(v);
   if(dist>.11&&g!=='gk'&&J.length<400)J.push({n:a.n,ph:s.ph,dist:+dist.toFixed(3),sp:+a.sp.toFixed(2),ch:a.ch,pv:+p.sp.toFixed(1),sim:+s.sim.toFixed(2),id:s.id,fl:s.fl});}
 }
 prev=s;}});
console.log(JSON.stringify(st));
for(const k of Object.keys(S).sort()){const o=S[k];const vs=o.vs;let p99='';if(vs){vs.sort((a,b)=>a-b);p99=' p99='+vs[Math.floor(vs.length*.99)].toFixed(2)+' p999='+vs[Math.floor(vs.length*.999)].toFixed(2);}console.log(k.padEnd(24),'n='+o.n,'moy='+(o.sum/o.n).toFixed(2),'max='+o.max.toFixed(2),'>7='+o.over7,p99);}
const by={};for(const j of J){const k=j.n[0]+'/'+j.ph+'/'+(j.ch||'');by[k]=(by[k]||0)+1;}console.log('sauts>5cm/pas',JSON.stringify(by));
console.log(JSON.stringify(J.slice(0,40)));
