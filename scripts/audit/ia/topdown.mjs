// Vue de dessus : node topdown.mjs <run.json> <ep> <t1,t2,..> <sortie.svg>  (puis svg2png.py)
import fs from 'node:fs';
const r=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const E=r.episodes.find(e=>e.ep===+process.argv[3]);const ts=process.argv[4].split(',').map(Number);
const W=300,H=560,sx=x=>(x+36)/72*W,sz=z=>(z+23)/83*H;let svg='';
ts.forEach((t,k)=>{const f=E.frames.reduce((b,f)=>Math.abs(f.t-t)<Math.abs(b.t-t)?f:b);const ox=k*(W+10);let g=`<g transform="translate(${ox},20)"><rect width="${W}" height="${H}" fill="#2d6a3a"/>`;
 g+=`<rect x="${sx(-20.16)}" y="${sz(-20)}" width="${sx(20.16)-sx(-20.16)}" height="${sz(-3.5)-sz(-20)}" fill="none" stroke="#cfe"/><line x1="0" x2="${W}" y1="${sz(32.5)}" y2="${sz(32.5)}" stroke="#9c9" stroke-width=".7"/>`;
 g+=`<line x1="${sx(-3.66)}" x2="${sx(3.66)}" y1="${sz(-20)}" y2="${sz(-20)}" stroke="#fff" stroke-width="4"/>`;
 if(f.off!=null)g+=`<line x1="0" x2="${W}" y1="${sz(f.off)}" y2="${sz(f.off)}" stroke="#c6f" stroke-dasharray="4 3"/>`;
 f.D.forEach((d,i)=>{if(d[4]>=0&&f.T[d[4]])g+=`<line x1="${sx(d[0])}" y1="${sz(d[1])}" x2="${sx(f.T[d[4]][0])}" y2="${sz(f.T[d[4]][1])}" stroke="orange" stroke-width=".6"/>`;
  g+=`<circle cx="${sx(d[0])}" cy="${sz(d[1])}" r="${i===f.pi?7:5}" fill="#e33"/><text x="${sx(d[0])+7}" y="${sz(d[1])+3}" font-size="9" fill="#fdd">${i}${d[3]?'C':''}</text>`;});
 f.T.forEach((d,i)=>{g+=`<rect x="${sx(d[0])-4}" y="${sz(d[1])-4}" width="8" height="8" fill="#39f"/><text x="${sx(d[0])+7}" y="${sz(d[1])+3}" font-size="9" fill="#cdf">${i}</text>`;});
 g+=`<circle cx="${sx(f.k[0])}" cy="${sz(f.k[1])}" r="5" fill="gold"/><text x="${sx(f.h[0])-6}" y="${sz(f.h[1])+5}" font-size="16" fill="#cf0">★</text><circle cx="${sx(f.b[0])}" cy="${sz(f.b[1])}" r="3" fill="#fff"/>`;
 g+=`<text x="4" y="-6" font-size="11" fill="#000">t=${f.t} ${f.ph}</text></g>`;svg+=g;});
fs.writeFileSync(process.argv[5],`<svg xmlns="http://www.w3.org/2000/svg" width="${ts.length*(W+10)}" height="${H+30}" style="background:#fff">${svg}</svg>`);
