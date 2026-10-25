// Analyse les enregistrements navigateur : node analyze.mjs <dossier>   (dossier/<run>/run.json avec .episodes[])
import fs from 'node:fs';import path from 'node:path';
const dir=process.argv[2];const verbose=process.argv[3]==='-v';
const files=fs.readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join(dir,d.name,'run.json')).filter(f=>fs.existsSync(f));
const tot={};const add=(k,v=1)=>tot[k]=(tot[k]||0)+v;const rows=[];const events=[];
for(const f of files){const r=JSON.parse(fs.readFileSync(f,'utf8'));const run=path.basename(path.dirname(f));
 for(const E of r.episodes){if(!E.frames.length)continue;const fr=E.frames;
  const m={run,ep:E.ep,kind:E.kind,out:E.outcome,dur:E.endedAt,n:fr.length};
  let piFlips=0,coverFlips=0,markFlips=0,swarm=0,overlap=0,oob=0,kOff=0,markKeeper=0,live=0,stillT=0,totT=0,swarmMax=0;
  for(let i=1;i<fr.length;i++){const a=fr[i-1],b=fr[i];if(b.t<=a.t)continue;live++;
   if(a.pi!==b.pi&&a.ph!=='ended'&&b.ph!=='ended'){piFlips++;events.push({run,ep:E.ep,t:b.t,what:'press '+a.pi+'->'+b.pi,ph:a.ph+'>'+b.ph});}
   b.D.forEach((d,j)=>{if(d[3]!==a.D[j][3])coverFlips++;if(d[4]!==a.D[j][4])markFlips++;if(d[6])markKeeper++;if(Math.abs(d[0])>34.5||d[1]<-20.5||d[1]>86)oob++;});
   const near=b.D.filter(d=>Math.hypot(d[0]-b.h[0],d[1]-b.h[1])<4.5).length;swarmMax=Math.max(swarmMax,near);if(near>=3)swarm++;
   const all=[...b.D,...b.T];for(let p=0;p<all.length;p++)for(let q=p+1;q<all.length;q++)if(Math.hypot(all[p][0]-all[q][0],all[p][1]-all[q][1])<.5)overlap++;
   if(Math.abs(b.k[0])>4.2||b.k[1]<-20.2||b.k[1]>-14)kOff++;
   b.T.forEach((t,j)=>{if(j===0&&false)return;totT++;if(t[2]<.05)stillT++;});
  }
  Object.assign(m,{live,piFlips,coverFlips,markFlips,markKeeper,swarm,swarmMax,overlap,oob,kOff,stillPct:totT?+(100*stillT/totT).toFixed(0):0});rows.push(m);
  for(const k of['live','piFlips','coverFlips','markFlips','markKeeper','swarm','overlap','oob','kOff'])add(k,m[k]);add('episodes');}}
console.table(rows);console.log(tot);if(verbose)console.log(events.slice(0,60));
