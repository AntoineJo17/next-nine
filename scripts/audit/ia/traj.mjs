// Trajectoire d'un défenseur : node traj.mjs <run.json> <ep> <indice défenseur>
import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const E=r.episodes.find(e=>e.ep===+process.argv[3]);const j=+process.argv[4];
const out=[];let n=0;for(const f of E.frames){if(n++%6===0)out.push(`${f.t}:(${f.D[j][0]},${f.D[j][1]}) mark${f.D[j][4]} v${f.D[j][2]}`);}console.log(out.join('\n'));
