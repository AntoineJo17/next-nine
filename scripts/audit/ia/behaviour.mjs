// Comportements suspects dans les enregistrements navigateur : défenseurs immobiles près du porteur, primaire qui s'éloigne, marquage lointain.
import fs from 'node:fs';import path from 'node:path';
const dir=process.argv[2];const files=fs.readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join(dir,d.name,'run.json')).filter(f=>fs.existsSync(f));
const c={frames:0,defNearStill:0,primaryAway:0,primaryFrames:0,markFar20:0,markFrames:0,coverBehindBall:0,partnerNearStill:0,partnerNear:0,partnersStillAll:0,partnersAll:0,ep:0};const dist=[];
for(const f of files){const r=JSON.parse(fs.readFileSync(f,'utf8'));for(const E of r.episodes){const fr=E.frames;if(!fr.length)continue;if(process.env.SKIP_KIND===E.kind)continue;c.ep++;
 for(let i=1;i<fr.length;i++){const a=fr[i-1],b=fr[i];if(b.t<=a.t||b.ph==='ended'||b.ph==='ready')continue;c.frames++;
  b.D.forEach((d,j)=>{const dh=Math.hypot(d[0]-b.h[0],d[1]-b.h[1]);if(dh<10&&!d[5]&&d[2]<.05)c.defNearStill++;
   if(j===b.pi&&!d[5]){c.primaryFrames++;const da=Math.hypot(a.D[j][0]-a.h[0],a.D[j][1]-a.h[1]);if(dh>da+.02&&dh>2.5&&d[2]>1)c.primaryAway++;}
   if(d[4]>=0&&b.T[d[4]]){c.markFrames++;const m=Math.hypot(d[0]-b.T[d[4]][0],d[1]-b.T[d[4]][1]);if(m>20)c.markFar20++;dist.push(m);}});
  b.T.forEach((t,j)=>{const dh=Math.hypot(t[0]-b.h[0],t[1]-b.h[1]);c.partnersAll++;if(t[2]<.05)c.partnersStillAll++;if(dh<25){c.partnerNear++;if(t[2]<.05)c.partnerNearStill++;}});}}}
dist.sort((a,b)=>a-b);console.log(c,'distance marqueur-marqué médiane',dist[dist.length>>1]?.toFixed(1),'p90',dist[Math.floor(dist.length*.9)]?.toFixed(1));
