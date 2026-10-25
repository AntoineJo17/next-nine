// Position du gardien allié (partenaire 0) et des défenseurs au début de chaque type d'occasion.
import fs from 'node:fs';import path from 'node:path';
const dir=process.argv[2];const files=fs.readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join(dir,d.name,'run.json')).filter(f=>fs.existsSync(f));
const by={};
for(const f of files){const r=JSON.parse(fs.readFileSync(f,'utf8'));for(const E of r.episodes){const k=E.kind;const T0=E.initial.T[0];(by[k]=by[k]||[]).push({run:path.basename(path.dirname(f)),keeperAllie:T0,nT:E.nT,nD:E.nD,hero:E.initial.h,
  defMinZ:Math.min(...E.initial.D.map(d=>d[1])),defMaxZ:Math.max(...E.initial.D.map(d=>d[1]))});}}
for(const k in by){console.log(k,by[k].length);by[k].slice(0,4).forEach(x=>console.log('  ',JSON.stringify(x)));}
