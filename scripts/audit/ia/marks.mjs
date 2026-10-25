// Série temporelle du marquage : node marks.mjs <run.json> <ep>
import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const E=r.episodes.find(e=>e.ep===+process.argv[3]);
const nD=E.nD;
for(let j=0;j<nD;j++){let line='D'+j+': ',last=-9,lastT=0;const ch=[];for(const f of E.frames){const m=f.D[j][4];if(m!==last){ch.push(`${f.t}:${m}${f.D[j][3]?'C':''}${f.pi===j?'*':''}`);last=m;}}console.log(line+ch.join(' '));}
