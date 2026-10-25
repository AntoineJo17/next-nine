// Affiche une fenêtre temporelle d'un épisode : node window.mjs <run.json> <ep> <t0> <t1>
import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const E=r.episodes.find(e=>e.ep===+process.argv[3]);const t0=+process.argv[4],t1=+process.argv[5];
console.log('kind',E.kind,'outcome',E.outcome,'init hero',E.initial.h,'keeper',E.initial.k);
for(const f of E.frames){if(f.t<t0||f.t>t1)continue;
 const ds=f.D.map((d,i)=>({i,dist:Math.hypot(d[0]-f.h[0],d[1]-f.h[1]),d})).sort((a,b)=>a.dist-b.dist).slice(0,4);
 console.log(f.t,f.ph,'pi',f.pi,'hero',f.h.join(','),'ball',f.b.join(','),'|',ds.map(o=>`#${o.i}${o.i===f.pi?'*':''}${o.d[3]?'C':''} d=${o.dist.toFixed(1)} z${o.d[1]}${o.d[1]>f.h[1]+.5?'(behind)':''}`).join(' · '));}
