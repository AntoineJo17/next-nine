// Phase « pressing » : déplacement total des défenseurs (hors porteur) et des partenaires entre le début et la fin de l'épisode.
import fs from 'node:fs';import path from 'node:path';
const dir=process.argv[2];const files=fs.readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join(dir,d.name,'run.json')).filter(f=>fs.existsSync(f));
for(const f of files){const r=JSON.parse(fs.readFileSync(f,'utf8'));for(const E of r.episodes){if(E.kind!=='press'||!E.frames.length)continue;
 const a=E.frames[0],b=E.frames.at(-1);let dMove=[],tMove=[];
 b.D.forEach((d,i)=>{if(a.pc&&Math.hypot(a.D[i][0]-a.pc[0],a.D[i][1]-a.pc[1])<.01)return;dMove.push(Math.hypot(d[0]-a.D[i][0],d[1]-a.D[i][1]));});
 b.T.forEach((d,i)=>tMove.push(Math.hypot(d[0]-a.T[i][0],d[1]-a.T[i][1])));
 const mx=x=>Math.max(...x).toFixed(2);
 console.log(path.basename(path.dirname(f)),'ep',E.ep,'durée',E.endedAt,'issue',E.outcome,'| autres défenseurs: max déplacement',mx(dMove),'m (moy',(dMove.reduce((s,x)=>s+x,0)/dMove.length).toFixed(2),') | partenaires: max',mx(tMove),'| porteur',a.pc,'->',b.pc,'| héros',a.h,'->',b.h);}}
