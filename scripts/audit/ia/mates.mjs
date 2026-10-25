// Mouvement des partenaires et défenseurs par épisode : node mates.mjs <run.json> <ep>
import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const E=r.episodes.find(e=>e.ep===+process.argv[3]);
const fr=E.frames;console.log('kind',E.kind,'dur',E.endedAt,'out',E.outcome);
const idle=(key,n)=>{for(let j=0;j<n;j++){let still=0,live=0,path=0;for(let i=1;i<fr.length;i++){if(fr[i].t<=fr[i-1].t)continue;live++;const a=fr[i-1][key][j],b=fr[i][key][j];if(b[2]<.05)still++;path+=Math.hypot(a[0]-b[0],a[1]-b[1]);}
 const f=fr[0][key][j],l=fr.at(-1)[key][j];console.log(key,j,'still%',(100*still/live).toFixed(0),'path m',path.toFixed(1),'start',f[0],f[1],'end',l[0],l[1]);}};
idle('T',E.nT);idle('D',E.nD);
