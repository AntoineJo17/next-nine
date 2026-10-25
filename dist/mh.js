// Lot 8 · head based on the MakeHuman base mesh (CC0, see dist/mh/LICENSE-MAKEHUMAN.md).
// The data file holds the head part of the base mesh, its UVs, the eye meshes (fitted from reference vertices) and
// morph targets (sparse offsets). A face is the base mesh plus weighted targets: race blend and gender first, then the
// fine adjustments (jaw, nose, lips, ears...). Units in the file are decimetres, front = +z; the game wants metres, front = -z.
import * as T from './vendor/three.module.js';
import {weldNormals,latOfY,fadeDensity,hairShellThickness,smooth,clamp} from './heads.js?v=20-12';
export const MH_EYE_Y=7.28,MH_S=.1,MH_ZC=.65;
let cache=null;
export async function loadMH(url='./mh/head.json'){if(!cache)cache=fetch(url).then(r=>r.json()).then(async D=>{   // the hand-painted red of the lips: only fetched when head.json says the picture exists ("paintedLips":true), so no 404 otherwise
  if(D.paintedLips&&typeof document!=='undefined')try{const im=await new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=ko;i.src=url.replace('head.json','levres.png');}),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);D.levres={w:c.width,h:c.height,data:x.getImageData(0,0,c.width,c.height).data};}catch(e){}
  return D;});const D=await cache;if(typeof document!=='undefined'){if(!eyeTex)eyeTex=calmEyeTexture();await eyeTex.userData.ready;}return D;}   // the eye texture is ready before the first head (thumbnails included)
const RACES=['african','asian','caucasian'];
// params: {race:[african,asian,caucasian] (sum 1), gender:0..1 (1 = male), mods:{target-name: weight}}
// A name ending in ! is an exact target ("mouth-lowerlip-middle-up!"). A modifier "nose-width" with weight +w uses "nose-width-incr", with −w uses "nose-width-decr".
export function morphWeights(p){const w={},g=p.gender??.9,race=p.race||[.34,.33,.33];RACES.forEach((r,i)=>{w[r+'-male-young']=race[i]*g;w[r+'-female-young']=race[i]*(1-g);});
 for(const [k,v] of Object.entries(p.mods||{})){if(!v)continue;if(k.endsWith('!'))w[k.slice(0,-1)]=v;else w[k+(v>0?'-incr':'-decr')]=Math.abs(v);}return w;}
export function morphHead(D,p){const n=D.pos.length/3,P=Float32Array.from(D.pos),ref=Float32Array.from(D.ref),W=morphWeights(p);
 for(const [name,w] of Object.entries(W)){const t=D.targets[name];if(!t||!w)continue;for(let k=0;k<t.i.length;k++){const i=t.i[k];P[i*3]+=t.d[k*3]*w;P[i*3+1]+=t.d[k*3+1]*w;P[i*3+2]+=t.d[k*3+2]*w;}
  for(let k=0;k<t.ri.length;k++){const i=t.ri[k];ref[i*3]+=t.rd[k*3]*w;ref[i*3+1]+=t.rd[k*3+1]*w;ref[i*3+2]+=t.rd[k*3+2]*w;}}
 // eyes: each vertex is a weighted point of three reference vertices plus an offset
 const E=D.eyes,m=E.vert.length,EP=new Float32Array(m*3);
 for(let i=0;i<m;i++){const f=E.fit[E.vert[i]];for(let c=0;c<3;c++)EP[i*3+c]=f[3]*ref[f[0]*3+c]+f[4]*ref[f[1]*3+c]+f[5]*ref[f[2]*3+c]+f[6+c];}
 return {P,EP};}
// The eye centre (average of the eyeball vertices) becomes the origin, so every face is expressed the same way whatever its shape.
const toGame=(a,c)=>{const n=a.length/3,o=new Float32Array(n*3);for(let i=0;i<n;i++){o[i*3]=-(a[i*3]-c[0])*MH_S;o[i*3+1]=(a[i*3+1]-c[1])*MH_S;o[i*3+2]=-(a[i*3+2]-c[2])*MH_S-.0721;}return o;};
const centreOf=a=>{let x=0,y=0,z=0;const n=a.length/3;for(let i=0;i<n;i++){x+=a[i*3];y+=a[i*3+1];z+=a[i*3+2];}return [0,y/n,z/n];};
function geometry(pos,uv,idx,c){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(toGame(pos,c),3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();weldNormals(g);return g;}
export const MH_NECK_CUT=-.16;
export function buildMHHead(D,p){const {P,EP}=morphHead(D,p),c=centreOf(EP),cut=c[1]+MH_NECK_CUT/MH_S,idx=[];for(let t=0;t<D.idx.length;t+=3){const a=D.idx[t],b=D.idx[t+1],d=D.idx[t+2];if(P[a*3+1]>cut&&P[b*3+1]>cut&&P[d*3+1]>cut)idx.push(a,b,d);}
 const head=geometry(P,D.uv,idx,c);tubeNeck(head);return {head,eyes:geometry(EP,D.eyes.uv,D.eyes.idx,c)};}
// Below the jaw the base mesh flares into the trapezius; squeeze that part into a round tube so it slides into the shirt collar.
export const NECK_R=.05;
function tubeNeck(g){const pos=g.attributes.position,n=pos.count;let zmin=1e9,zmax=-1e9;for(let i=0;i<n;i++){const y=pos.getY(i);if(y<-.085&&y>-.105&&Math.abs(pos.getX(i))<.06){zmin=Math.min(zmin,pos.getZ(i));zmax=Math.max(zmax,pos.getZ(i));}}
 let zc=.004;   // placed below, from the nape
 // the nape: keep the natural dip under the skull, then let it swell gently towards the shoulders (no vertical wall)
 let zb=-1e9;for(let i=0;i<n;i++){const y=pos.getY(i);if(y<-.062&&y>-.082&&Math.abs(pos.getX(i))<.03)zb=Math.max(zb,pos.getZ(i));}
 const lim=y=>zb+Math.min(.016,Math.max(0,(-.07-y)*.2));   // ceiling on how far back the neck may go
 zc=lim(-.12)-NECK_R;
 for(let i=0;i<n;i++){const y=pos.getY(i),z=pos.getZ(i);if(y<-.07&&z>lim(y)){const w=smooth(-.07,-.09,y);pos.setZ(i,z+(lim(y)-z)*w);}}
 for(let i=0;i<n;i++){const y=pos.getY(i),w=smooth(-.09,-.13,y)*smooth(-.04,-.01,pos.getZ(i));if(w<=0)continue;   // neck only: the chin and jaw keep their shape
 const x=pos.getX(i),z=pos.getZ(i)-zc,r=Math.hypot(x,z);if(r>NECK_R){const k=(r+(NECK_R-r)*w)/r;pos.setX(i,x*k);pos.setZ(i,zc+z*k);}}
 for(let i=0;i<n;i++){const y=pos.getY(i);pos.setY(i,y-.034*smooth(-.1,-.158,y));}   // and lengthen it so its end sits inside the collar
 pos.needsUpdate=true;g.computeVertexNormals();weldNormals(g);}

// ---- Dressing the head: skin texture baked in UV space, eyes, short-hair shell --------------------------------------
const hash3=(x,y,z)=>{let h=Math.imul(Math.round(x*1e4)^0x9e3779b9,0x85ebca6b)^Math.imul(Math.round(y*1e4)^0x7f4a7c15,0xc2b2ae35)^Math.imul(Math.round(z*1e4)^0x165667b1,0x27d4eb2f);h^=h>>>15;h=Math.imul(h,0x2c1b3c6d);h^=h>>>12;return ((h>>>0)%65536)/65536;};
// One cut = one rule: hair starts at a height that depends on the angle round the head (high at the temples and above the ears,
// low at the nape) and fades in over a short distance at the front, a longer one on the sides and the back (the fade).
// Each style only changes a few numbers: s = shift of the hairline, w = width of the fade, t/tt = thickness at the sides / on top,
// dm = maximum density (a shaved head only shows a shadow).
const HS=[[0,.064],[.45,.062],[.9,.052],[1.3,.040],[1.7,.034],[2.2,.005],[2.7,-.03],[3.2,-.045]];
export const MH_HAIR={degrade:{s:.006,w:1.5,t:.0014,tt:.0135,dm:1,front:.55,rough:.62},court:{s:-.004,w:.35,t:.0052,tt:.0012,dm:1,rough:.7},plaque:{s:-.002,w:.5,t:.0042,tt:.0155,dm:1,back:.9,front:-.45,rough:.34},rase:{s:-.004,w:.9,t:.0007,tt:.0004,dm:.5,rough:.9},boucles:{s:0,w:1,t:.0032,tt:.0065,dm:1,rough:.8},afro:{s:-.012,w:.6,t:.006,tt:.01,dm:1,rough:.85},chignon:{s:.004,w:.4,t:.0045,tt:.0035,dm:1,back:.5,rough:.5}};
export function mhHair(style,x,y,z){const P=MH_HAIR[style]||MH_HAIR.degrade,phi=Math.atan2(Math.abs(x),-(z-.008));let hs=HS[HS.length-1][1];for(let i=1;i<HS.length;i++)if(phi<=HS[i][0]){const [a0,b0]=HS[i-1],[a1,b1]=HS[i];hs=b0+(b1-b0)*(phi-a0)/(a1-a0);break;}
 hs+=.0012*Math.sin(phi*21)+P.s;const w=(.010+.026*smooth(.5,1.3,phi)+.012*smooth(1.9,2.6,phi))*P.w,d=smooth(hs,hs+w,y)*P.dm;
 return {d,dm:P.dm,t:d*(P.t+P.tt*smooth(.04,.1,y))*(1+(P.back||0)*smooth(.4,2.2,phi)*smooth(.05,.1,y)+(P.front||0)*smooth(.8,.1,phi)*smooth(.05,.095,y))};}
// Beards in metres on the face. lm = landmarks of this face: ym mouth line, yn base of the nose, yc bottom of the chin.
// moustache + chin patch for the goatee, plus a stubble body along the cheeks, the jaw and under the chin for the other two.
export function mhBeard(kind,x,y,z,lm){const ax=Math.abs(x);if(z>.03)return 0;
 const my0=lm.ym+.0085,my1=lm.yn-.0015,cy=(my0+my1)/2,hy=Math.max(.003,(my1-my0)/2)+.0025,mo=smooth(1.15,.35,Math.hypot((ax-.011)/.019,(y-cy)/hy))*(1-.45*Math.exp(-((ax/.004)**2)));
 const c0=lm.yc+.003,c1=lm.ym-.0105,ccy=(c0+c1)/2,chy=Math.max(.004,(c1-c0)/2)+.002,ch=smooth(1.2,.35,Math.hypot(ax/.0205,(y-ccy)/chy));
 const yl=lm.ym+.008+.03*smooth(.035,.068,ax),body=smooth(yl+.012,yl-.012,y)*smooth(lm.yc-.032,lm.yc+.004,y)*smooth(.03,.012,z)*smooth(.071,.06,ax+.0*z);
 const edge=.85+.15*Math.sin(x*400+y*300);
 if(kind==='bouc')return Math.max(.9*mo,.95*ch)*edge;
 if(kind==='barbe3j')return Math.max(.5*body,.45*mo,.5*ch)*edge;
 return Math.max(.92*body,.9*mo,.95*ch)*edge;}
const angles=(x,y,z)=>({l:Math.atan2(Math.abs(x),-(z-.008)),f:latOfY(y)+.06});
// Bake the face into a texture: for every texel, find the point of the head it covers and decide its colour there.
// Concavity per vertex (positive in a hollow: nostrils, mouth line, eye sockets, creases), from the neighbours' average position.
// Average a per-vertex value with its neighbours (seam duplicates treated as one vertex), `passes` times.
export function smoothField(geo,arr,passes=2){const pos=geo.attributes.position,idx=geo.index.array,n=pos.count,key=new Map(),canon=new Int32Array(n);
 for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*2e4)+'|'+Math.round(pos.getY(i)*2e4)+'|'+Math.round(pos.getZ(i)*2e4);if(!key.has(k))key.set(k,i);canon[i]=key.get(k);}
 let cur=Float32Array.from(arr);for(let it=0;it<passes;it++){const acc=new Float32Array(n),cnt=new Float32Array(n),add=(a,b)=>{acc[canon[a]]+=cur[canon[b]];cnt[canon[a]]++;acc[canon[b]]+=cur[canon[a]];cnt[canon[b]]++;};
  for(let t=0;t<idx.length;t+=3){add(idx[t],idx[t+1]);add(idx[t+1],idx[t+2]);add(idx[t+2],idx[t]);}
  const nx=new Float32Array(n);for(let i=0;i<n;i++){const c=canon[i];nx[i]=cnt[c]?(cur[c]*.45+.55*acc[c]/cnt[c]):cur[i];}cur=nx;}
 return cur;}
export function cavity(geo){const pos=geo.attributes.position,nor=geo.attributes.normal,idx=geo.index.array,n=pos.count,key=new Map(),canon=new Int32Array(n);
 for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*2e4)+'|'+Math.round(pos.getY(i)*2e4)+'|'+Math.round(pos.getZ(i)*2e4);if(!key.has(k))key.set(k,i);canon[i]=key.get(k);}
 const sx=new Float32Array(n),sy=new Float32Array(n),sz=new Float32Array(n),cn=new Float32Array(n),add=(a,b)=>{const ca=canon[a],cb=canon[b];sx[ca]+=pos.getX(b);sy[ca]+=pos.getY(b);sz[ca]+=pos.getZ(b);cn[ca]++;sx[cb]+=pos.getX(a);sy[cb]+=pos.getY(a);sz[cb]+=pos.getZ(a);cn[cb]++;};
 for(let t=0;t<idx.length;t+=3){add(idx[t],idx[t+1]);add(idx[t+1],idx[t+2]);add(idx[t+2],idx[t]);}
 const raw=new Float32Array(n);for(let i=0;i<n;i++){const c=canon[i];if(!cn[c])continue;const dx=sx[c]/cn[c]-pos.getX(i),dy=sy[c]/cn[c]-pos.getY(i),dz=sz[c]/cn[c]-pos.getZ(i);raw[i]=clamp(-(dx*nor.getX(i)+dy*nor.getY(i)+dz*nor.getZ(i))/.0022,-1,1)*smooth(-.115,-.075,pos.getY(i));}
 // two smoothing passes so the shading follows forms, not single vertices
 let cur=raw;for(let it=0;it<2;it++){const acc=new Float32Array(n),cnt=new Float32Array(n),addv=(a,b)=>{acc[canon[a]]+=cur[b];cnt[canon[a]]++;acc[canon[b]]+=cur[a];cnt[canon[b]]++;};for(let t=0;t<idx.length;t+=3){addv(idx[t],idx[t+1]);addv(idx[t+1],idx[t+2]);addv(idx[t+2],idx[t]);}const nx=new Float32Array(n);for(let i=0;i<n;i++){const c=canon[i];nx[i]=cnt[c]?(cur[i]*.5+.5*acc[c]/cnt[c]):cur[i];}cur=nx;}
 return cur;}
// Height of the contact line between the lips at distance ax from the middle: nearly level, the corners a hair lower.
export const mouthLine=(lm,ax)=>lm.ym-.0008*Math.pow(Math.min(1,ax/lm.xc),2)+.00035*Math.exp(-((ax/.004)**2));
const vnoise=(x,y,z)=>{const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),fx=x-xi,fy=y-yi,fz=z-zi,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),sz=fz*fz*(3-2*fz),h=(i,j,k)=>hash3(xi+i,yi+j,zi+k),l=(a,b,t)=>a+(b-a)*t;return l(l(l(h(0,0,0),h(1,0,0),sx),l(h(0,1,0),h(1,1,0),sx),sy),l(l(h(0,0,1),h(1,0,1),sx),l(h(0,1,1),h(1,1,1),sx),sy),sz);};
// Shine of the skin: a little oilier on the forehead, nose and chin, drier on the cheeks, moist on the lips.
const skinRough=(x,y,z,L)=>{const ax=Math.abs(x),front=smooth(-.04,-.075,z);let r=.66+.05*(vnoise(x*120,y*120,z*120)-.5);r-=front*(.1*smooth(.034,.012,ax)*smooth(.022,.045,y)+.12*Math.exp(-((ax/.012)**2)-(((y+.03)/.016)**2))+.07*Math.exp(-((ax/.018)**2)-(((y+.108)/.012)**2)));r+=front*.05*Math.exp(-(((ax-.05)/.022)**2)-(((y+.02)/.025)**2));r=r*(1-L)+.6*L;return Math.min(.95,Math.max(.3,r));};
export function bakeSkin(geo,lip,{skin,hair,style,beard='',lm,W=1024,cav,eyeC,lipRed=0,paint=null,brow='',beardColor=''}){
 const pos=geo.attributes.position,uv=geo.attributes.uv,idx=geo.index.array,cv=document.createElement('canvas');cv.width=cv.height=W;const c=cv.getContext('2d');
 const base=new T.Color(skin),hc=new T.Color(hair),bc=new T.Color(brow||hair),ec=new T.Color(beardColor||hair),dark=base.getHSL({}).l<.35,lipC=base.clone().lerp(new T.Color(dark?0x5a2a24:0xa8504a),Math.max(0,Math.min(.9,.42+.4*lipRed))),warm=new T.Color(dark?0x7a2a22:0xc4524a);
 c.fillStyle='#'+base.getHexString();c.fillRect(0,0,W,W);const img=c.getImageData(0,0,W,W),D=img.data,cov=new Uint8Array(W*W),R=new Uint8ClampedArray(W*W*4);
 const col=new T.Color(),pc=new T.Color(),mix=(a,b,t)=>a.clone().lerp(b,t);
 const shade=(x,y,z,L,C)=>{col.copy(base);
  const ax=Math.abs(x),front=smooth(-.04,-.075,z);
  col.lerp(warm,front*(dark?.05:.09)*Math.exp(-(((ax-.052)/.02)**2)-(((y+.02)/.022)**2)));           // cheeks
  col.lerp(warm,front*(dark?.06:.12)*Math.exp(-((ax/.012)**2)-(((y+.036)/.01)**2)));                  // nose tip
  col.multiplyScalar(1-.05*front*Math.exp(-(((ax-.031)/.02)**2)-(((y-.003)/.014)**2)));               // soft shadow around the eyes
  if(front>0){const nz=vnoise(x*70,y*70,z*70)-.5,rd=Math.max(0,vnoise(x*55+9,y*55+3,z*55)-.5);col.multiplyScalar(1+.04*nz*front);col.lerp(warm,.07*rd*front);   // slow, faint variations of tone and redness (no grain)
   col.multiplyScalar(1-.05*front*Math.exp(-(((ax-.03)/.016)**2)-(((y+.011)/.0065)**2)));col.lerp(warm,front*(dark?.04:.07)*Math.exp(-(((ax-.013)/.006)**2)-(((y+.046)/.006)**2)));}   // under the eyes a little darker, the wings of the nose a little redder
  if(paint&&lm&&front>0){const u=(.03-x)/.06,v=(lm.ym+.012-y)/.024;if(u>=0&&u<1&&v>=0&&v<1){const k=(Math.floor(v*paint.h)*paint.w+Math.floor(u*paint.w))*4,a=paint.data[k+3]/255;if(a>0)col.lerp(pc.setRGB(paint.data[k]/255,paint.data[k+1]/255,paint.data[k+2]/255,T.SRGBColorSpace),Math.min(1,a*Math.max(.15,1+.6*lipRed)));}}   // the red drawn by hand replaces the generated one
  if(L>0&&!paint){col.lerp(globalThis.MH_DEBUG_LIP?new T.Color(0xff00aa):lipC,L);const ol=4*L*(1-L);if(ol>0)col.multiplyScalar(1-.06*ol);}   // a barely darker border   // the vermilion border is a little darker
  if(lm&&front>0)C*=1-.8*Math.exp(-(((y-mouthLine(lm,ax))/.0022)**2))*smooth(lm.xc+.002,lm.xc-.003,ax);   // the crease between the lips is drawn by the closing line, not by a black cavity
  col.multiplyScalar(1-.26*Math.max(0,C)*(1-.5*L)+.03*Math.max(0,-C));
  if(lm&&front>0&&ax<lm.xc){const u=ax/lm.xc,dl=y-mouthLine(lm,ax),th=.00085*(.45+.55*smooth(1,.45,u)),k=.2*smooth(.93,.68,u)*(.55+.45*smooth(.9,.3,u));col.lerp(lipC.clone().multiplyScalar(.6),k*Math.exp(-((dl/th)**2)));col.multiplyScalar(1-.2*smooth(.93,.7,u)*Math.exp(-(((dl+.0007)/.0007)**2)));}   // the fine closing line: a very slight curve that ends at the corners of the mouth
  // eyebrows: an arch above the eye, made of many strands
  if(front>0){const t=(ax-.010)/.050;if(t>-.02&&t<1.02){const sg=Math.sign(x)||1,yc=.0203+.0042*Math.sin(Math.PI*Math.min(1,Math.max(0,t)*1.05))-.0035*t*t+.002*t,
     th=.0049*(.4+.6*smooth(0,.22,t))*(1-.62*smooth(.45,1,t))+.0005,en=.16*(hash3(ax*380,y*380,sg)-.5),d=Math.abs(y-yc)/th+en;if(d<1.2){
    const ur=ax*1150+y*650,vr=y*1700-ax*400,cell=.75*hash3(Math.floor(ur)*.37,.5,sg)+.25*hash3(Math.floor(ur)*.37,Math.floor(vr/5),sg),strand=smooth(.3,.7,cell);
    const e=smooth(1.2,.4,d)*(.8+.2*strand)*smooth(-.02,.14,t)*smooth(1.02,.78,t);col.lerp(bc.clone().lerp(new T.Color(0x000000),.2),clamp(e*1.05,0,1));}}}
  // lid line: a soft, thin shade along the upper lid edge, a little stronger at the outer corner; no hard stroke
  if(front>0&&eyeC)for(const e of eyeC){const dx=x-e.x,dy=y-e.y,w=Math.abs(dx);if(w<.0165){const k=Math.sqrt(Math.max(0,1-(w/.0138)**2)),yu=.0043*k+.0003,yl=-.0041*k-.0002,outer=smooth(-.012,.012,(Math.abs(x)-Math.abs(e.x))),up=Math.exp(-(((dy-yu)/.00085)**2)),sh=smooth(yu+.0034,yu,dy)*smooth(yu-.0008,yu+.0004,dy),lo=Math.exp(-(((dy-yl)/.0007)**2));
    col.lerp(new T.Color(0x140c09),clamp((.38+.3*outer)*up*k+.12*sh*k+.1*lo*k,0,.7));}}
  // short hair painted on the scalp: one cut, a single smooth density (see mhHair)
  if(style==='rase'){const dd=mhHair(style,x,y,z).d/MH_HAIR.rase.dm;if(dd>.01){   // shaved: the scalp darkens with the roots, then single hairs appear, more and more of them
    const gr=hash3(x*3300,y*3300,z*3300),cover=clamp((dd*1.2-gr)*4.5,0,1);col.multiplyScalar(1-.3*smooth(.1,.85,dd));col.lerp(hc.clone().multiplyScalar(.55+.7*hash3(x*1400,y*1400,z*1400)),cover*.9);}}
  else if(style!=='crane'){const hh=mhHair(style,x,y,z);if(hh.d>.01){const g=.5+.5*hash3(x*2.3,y*2.1,z*2.2);col.lerp(hc.clone().multiplyScalar(.82+.36*g),clamp(smooth(.04,.55,hh.d/hh.dm)*hh.dm,0,1));}}
  // beard: stubble grains whose density follows mhBeard (the grain is decided per texel, so the edges fade out)
  if(beard&&lm){const bd=mhBeard(beard,x,y,z,lm)*(1-L);if(bd>.02){   // fine strands: each grain is a short stroke along the direction the hair grows (down and a little towards the chin on the cheeks, outwards under the nose, straight down on the neck)
    const sx=Math.sign(x)||1,mu=smooth(lm.ym+.003,lm.ym+.011,y)*smooth(.03,.018,ax),nk=smooth(lm.yc-.004,lm.yc-.022,y);let dx=(-sx*.3*(1-nk))*(1-mu)+sx*.85*mu,dy=-1*(1-mu)-.45*mu;const dl=Math.hypot(dx,dy);dx/=dl;dy/=dl;
    const al=x*dx+y*dy,ac=-x*dy+y*dx,hl=ec.r*.3+ec.g*.59+ec.b*.11,g=vnoise(ac*3600,al*1100,sx*7.3),a=clamp((bd-(g-.2)*1.1)*2.2,0,1)*.62*(1-.6*Math.min(1,hl*1.6));col.multiplyScalar(1-.05*bd);col.lerp(ec.clone().multiplyScalar(.66-.14*Math.min(1,hl*1.6)+.3*vnoise(ac*600,al*200,sx*3.1)),a);}}
  const n=(hash3(x*3,y*3,z*3)-.5)*.02;col.r=clamp(col.r+n,0,1);col.g=clamp(col.g+n,0,1);col.b=clamp(col.b+n,0,1);return col;};
 const put=(px,py,x,y,z,L,C)=>{if(px<0||py<0||px>=W||py>=W)return;const k=(py*W+px)*4,cl=shade(x,y,z,L,C);cl.convertLinearToSRGB();D[k]=cl.r*255;D[k+1]=cl.g*255;D[k+2]=cl.b*255;D[k+3]=255;cov[py*W+px]=1;const rv=skinRough(x,y,z,L)*255;R[k]=R[k+1]=R[k+2]=rv;R[k+3]=255;};
 for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],d=idx[t+2],U=[uv.getX(a),uv.getX(b),uv.getX(d)].map(v=>v*W),Vv=[uv.getY(a),uv.getY(b),uv.getY(d)].map(v=>(1-v)*W),
   x0=Math.floor(Math.min(...U))-1,x1=Math.ceil(Math.max(...U))+1,y0=Math.floor(Math.min(...Vv))-1,y1=Math.ceil(Math.max(...Vv))+1,den=(Vv[1]-Vv[2])*(U[0]-U[2])+(U[2]-U[1])*(Vv[0]-Vv[2]);if(Math.abs(den)<1e-9)continue;
  for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){const X=px+.5,Y=py+.5,w0=((Vv[1]-Vv[2])*(X-U[2])+(U[2]-U[1])*(Y-Vv[2]))/den,w1=((Vv[2]-Vv[0])*(X-U[2])+(U[0]-U[2])*(Y-Vv[2]))/den,w2=1-w0-w1,e=-.06;if(w0<e||w1<e||w2<e)continue;
   const ids=[a,b,d],ws=[w0,w1,w2];let x=0,y=0,z=0,L=0,C=0;for(let k=0;k<3;k++){x+=ws[k]*pos.getX(ids[k]);y+=ws[k]*pos.getY(ids[k]);z+=ws[k]*pos.getZ(ids[k]);L+=ws[k]*lip[ids[k]];C+=ws[k]*cav[ids[k]];}put(px,py,x,y,z,clamp(L,0,1),C);}}
 // bleed the painted colours a few texels beyond each UV island, so no seam of bare skin shows through the hair along the island edges
 for(let it=0;it<4;it++){const add=[];for(let y=1;y<W-1;y++)for(let x=1;x<W-1;x++){const p=y*W+x;if(cov[p])continue;let r=0,g=0,b=0,s=0,n=0;for(const q of [p-1,p+1,p-W,p+W,p-W-1,p-W+1,p+W-1,p+W+1])if(cov[q]){r+=D[q*4];g+=D[q*4+1];b+=D[q*4+2];s+=R[q*4];n++;}if(n)add.push(p,r/n,g/n,b/n,s/n);}
  for(let i=0;i<add.length;i+=5){const p=add[i];D[p*4]=add[i+1];D[p*4+1]=add[i+2];D[p*4+2]=add[i+3];D[p*4+3]=255;R[p*4]=R[p*4+1]=R[p*4+2]=add[i+4];R[p*4+3]=255;cov[p]=1;}}
 c.putImageData(img,0,0);const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
 const cr=document.createElement('canvas');cr.width=cr.height=W;cr.getContext('2d').putImageData(new ImageData(R,W,W),0,0);map.userData.rough=new T.CanvasTexture(cr);map.userData.rough.anisotropy=4;return map;}
// A short-hair shell hugging the scalp: thickness and opacity follow the same fade function as the painted scalp.
export function hairShell(geo,style,hairHex='#28231e'){if(style==='crane'||style==='rase')return null;   // a shaved cut has no volume: it is painted grain by grain, so no cap and no rim
 const pos=geo.attributes.position,nor=geo.attributes.normal,n=pos.count,P=new Float32Array(n*3),A=new Float32Array(n*4),keepV=new Uint8Array(n),base=new T.Color(hairHex);
 for(let i=0;i<n;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),{d,t}=mhHair(style,x,y,z),tt=t+(d>.02?.0006:0),sh=.9+.2*hash3(x*5,y*5,z*5);
  P[i*3]=x+nor.getX(i)*tt;P[i*3+1]=y+nor.getY(i)*tt;P[i*3+2]=z+nor.getZ(i)*tt;A[i*4]=sh;A[i*4+1]=sh;A[i*4+2]=sh;A[i*4+3]=1;if(d>.12)keepV[i]=1;}
 const I=[],src=geo.index.array;for(let t=0;t<src.length;t+=3)if(keepV[src[t]]||keepV[src[t+1]]||keepV[src[t+2]])I.push(src[t],src[t+1],src[t+2]);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(P,3));g.setAttribute('uv',geo.attributes.uv);g.setAttribute('color',new T.BufferAttribute(A,4));g.setIndex(I);g.setAttribute('normal',geo.attributes.normal.clone());return g;}   // same normals as the skin underneath, so no shading band at the edge
// Where the red of the lips goes: the vermilion only. The vertex sets of the lip targets also cover the philtrum and the chin
// groove, so they are cut at the mouth line (found from the sets themselves) and at the real height of each lip.
export function commissure(head,D){const pos=head.attributes.position;let up=1e9,lo=-1e9;for(const i of D.lipU)if(Math.abs(pos.getX(i))<.02)up=Math.min(up,pos.getY(i));for(const i of D.lipL)if(Math.abs(pos.getX(i))<.02)lo=Math.max(lo,pos.getY(i));const ym=(up+lo)/2;let m=0;for(const i of D.lipU)for(const j of D.lipL){const xi=Math.abs(pos.getX(i)),xj=Math.abs(pos.getX(j));if(Math.abs(xi-xj)<.0012&&Math.abs(pos.getY(i)-pos.getY(j))<.0016&&Math.abs(pos.getY(i)-ym)<.004)m=Math.max(m,xi);}return m;}   // where the upper and the lower lip meet: the real corner of the mouth
export function lipMask(head,D,cx=.0205){const n=head.attributes.position.count,w=new Float32Array(n);
 // the lip-volume targets move each vertex in proportion to how much it belongs to the lip: use that as the weight
 for(const name of ['mouth-upperlip-volume-incr','mouth-lowerlip-volume-incr']){const t=D.targets[name];if(!t)continue;let mx=0;const m=[];for(let k=0;k<t.i.length;k++){const v=Math.hypot(t.d[k*3],t.d[k*3+1],t.d[k*3+2]);m.push(v);if(v>mx)mx=v;}
  for(let k=0;k<t.i.length;k++){const v=m[k]/mx;if(v>w[t.i[k]])w[t.i[k]]=v;}}
 // the corners of the mouth: the volume weights fade towards them, so add the vertices of the lip sets that lie on the mouth line
 {const pos=head.attributes.position;let up=1e9,lo=-1e9;for(const i of D.lipU)if(Math.abs(pos.getX(i))<.02)up=Math.min(up,pos.getY(i));for(const i of D.lipL)if(Math.abs(pos.getX(i))<.02)lo=Math.max(lo,pos.getY(i));const ym=(up+lo)/2;
  for(const i of [...D.lipU,...D.lipL]){const x=Math.abs(pos.getX(i)),dy=Math.abs(pos.getY(i)-ym),c=.95*smooth(.011,.016,x)*smooth(.0042,.0013,dy)*smooth(cx,cx-.004,x);if(c>w[i])w[i]=c;}}
 // vertices duplicated along a UV seam (the centre line of the face) must carry the same weight, or a wedge of bare skin shows in the middle of the upper lip
 const unify=a=>{const pos=head.attributes.position,key=new Map();for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*2e4)+'|'+Math.round(pos.getY(i)*2e4)+'|'+Math.round(pos.getZ(i)*2e4);key.set(k,Math.max(key.get(k)||0,a[i]));}for(let i=0;i<n;i++)a[i]=key.get(Math.round(pos.getX(i)*2e4)+'|'+Math.round(pos.getY(i)*2e4)+'|'+Math.round(pos.getZ(i)*2e4));return a;};
 unify(w);const f=unify(smoothField(head,w,1));
 // nothing below the real lower edge of the lower lip (two faint spikes used to show up there)
 {const pos=head.attributes.position;let up=1e9,lo=-1e9;for(const i of D.lipU)if(Math.abs(pos.getX(i))<.02)up=Math.min(up,pos.getY(i));for(const i of D.lipL)if(Math.abs(pos.getX(i))<.02)lo=Math.max(lo,pos.getY(i));const ym=(up+lo)/2;
  for(let i=0;i<n;i++){const y=pos.getY(i);if(y>=ym)continue;const x=Math.abs(pos.getX(i)),lim=.0085*Math.pow(Math.max(0,1-(x/.026)**2),.5)+.0012;f[i]*=smooth(lim+.0016,lim,ym-y);}}
 for(let i=0;i<n;i++)f[i]=smooth(.22,.8,f[i]);
 // the colour must reach the real corner of the mouth (where the lips meet), tapering to a point, as the geometry and the closing line do
 {const pos=head.attributes.position;let up=1e9,lo=-1e9;for(const i of D.lipU)if(Math.abs(pos.getX(i))<.02)up=Math.min(up,pos.getY(i));for(const i of D.lipL)if(Math.abs(pos.getX(i))<.02)lo=Math.max(lo,pos.getY(i));const ym=(up+lo)/2;
  for(const i of D.lipU){const x=Math.abs(pos.getX(i)),dy=pos.getY(i)-ym;if(x<.0031&&dy>.0042&&dy<.0061&&f[i]<.6)f[i]=.6;}   // the dip of the cupid's bow stays a shallow notch: the red reaches up to about the height of the two peaks
  for(const i of [...D.lipU,...D.lipL]){const x=Math.abs(pos.getX(i)),dy=Math.abs(pos.getY(i)-ym),c=.8*smooth(.012,.017,x)*smooth(.0036,.0014,dy)*smooth(cx+.0006,cx-.0035,x);if(c>f[i])f[i]=c;}}
 return f;}
// Curls and afro: many fine coils (small spiral tubes, darker at the root) planted on the scalp of this head.
const rngOf=seed=>{let a=(seed*2654435761+1013904223)>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
export function mhCurls(head,style,hairHex,hi,seed=1){if(style!=='boucles'&&style!=='afro')return null;
 const pos=head.attributes.position,nor=head.attributes.normal,idx=head.index.array,afro=style==='afro',rng=rngOf(seed*7+11),base=new T.Color(hairHex),
  n=afro?(hi?420:130):(hi?560:170),per=afro?(hi?4:2):(hi?3:2),gap=afro?.0125:.0083,SEG=hi?9:5,RAD=hi?5:4,pts=[];
 const okAt=(x,y,z)=>{const d=mhHair(style,x,y,z).d;return afro?d>.55&&y>-.01:d>.92&&y>.052;};
 const tris=[];for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2],cx=(pos.getX(a)+pos.getX(b)+pos.getX(c))/3,cy=(pos.getY(a)+pos.getY(b)+pos.getY(c))/3,cz=(pos.getZ(a)+pos.getZ(b)+pos.getZ(c))/3;if(okAt(cx,cy,cz))tris.push(t);}
 if(!tris.length)return null;const grid=new Map(),cell=gap,key=(x,y,z)=>Math.floor(x/cell)+'|'+Math.floor(y/cell)+'|'+Math.floor(z/cell);
 let tries=0;while(pts.length<n&&tries<n*80){tries++;const t=tris[Math.floor(rng()*tris.length)],a=idx[t],b=idx[t+1],c=idx[t+2];let u=rng(),v=rng();if(u+v>1){u=1-u;v=1-v;}const w=1-u-v,
   P=new T.Vector3(w*pos.getX(a)+u*pos.getX(b)+v*pos.getX(c),w*pos.getY(a)+u*pos.getY(b)+v*pos.getY(c),w*pos.getZ(a)+u*pos.getZ(b)+v*pos.getZ(c)),N=new T.Vector3(w*nor.getX(a)+u*nor.getX(b)+v*nor.getX(c),w*nor.getY(a)+u*nor.getY(b)+v*nor.getY(c),w*nor.getZ(a)+u*nor.getZ(b)+v*nor.getZ(c)).normalize();
  const kx=Math.floor(P.x/cell),ky=Math.floor(P.y/cell),kz=Math.floor(P.z/cell);let bad=false;for(let i=-1;i<=1&&!bad;i++)for(let j=-1;j<=1&&!bad;j++)for(let k=-1;k<=1&&!bad;k++){const q=grid.get((kx+i)+'|'+(ky+j)+'|'+(kz+k));if(q&&q.some(o=>o.p.distanceTo(P)<gap)){bad=true;}}
  if(bad)continue;const e={p:P,n:N};pts.push(e);const kk=key(P.x,P.y,P.z);if(!grid.has(kk))grid.set(kk,[]);grid.get(kk).push(e);}
 const Pp=[],C=[],I=[];let vc=0;const tg=new T.Vector3(),n1=new T.Vector3(),n2=new T.Vector3(),cc=new T.Color();
 for(const {p,n:nrm} of pts){const t1=new T.Vector3().crossVectors(nrm,new T.Vector3(0,1,0)).normalize();if(t1.lengthSq()<.1)t1.set(1,0,0);const t2=new T.Vector3().crossVectors(nrm,t1).normalize(),k0=.8+.4*rng();
  for(let k=0;k<per;k++){const phase=rng()*6.28,turns=1.15+.9*rng(),h=(afro?.027:.015)+(afro?.009:.007)*rng(),rho=(afro?.0092:.0052)*(.8+.4*rng()),r0=(afro?.0043:.0032)*(.9+.2*rng()),dr=k?.0042*rng()+.002:0,da=rng()*6.28,drift=rng()*6.28,dl=h*.3*rng();
   const path=[];for(let i=0;i<=SEG;i++){const u=i/SEG,ang=phase+u*turns*6.2832,rr=rho*(.5+.5*Math.sin(Math.min(1,u*1.5)*1.5708));path.push(new T.Vector3().copy(p).addScaledVector(nrm,-.0012+h*u).addScaledVector(t1,Math.cos(ang)*rr+Math.cos(da)*dr+Math.cos(drift)*dl*u).addScaledVector(t2,Math.sin(ang)*rr+Math.sin(da)*dr+Math.sin(drift)*dl*u));}
   for(let i=0;i<=SEG;i++){const u=i/SEG;tg.subVectors(path[Math.min(SEG,i+1)],path[Math.max(0,i-1)]).normalize();n1.crossVectors(tg,nrm);if(n1.lengthSq()<1e-6)n1.copy(t1);n1.normalize();n2.crossVectors(tg,n1).normalize();const r=r0*(1-.55*u*u);cc.copy(base).multiplyScalar(k0*(.42+.58*Math.pow(u,.7)));
    for(let j=0;j<RAD;j++){const th=j/RAD*6.2832,cs=Math.cos(th)*r,sn=Math.sin(th)*r;Pp.push(path[i].x+n1.x*cs+n2.x*sn,path[i].y+n1.y*cs+n2.y*sn,path[i].z+n1.z*cs+n2.z*sn);C.push(cc.r,cc.g,cc.b);}}
   for(let i=0;i<SEG;i++)for(let j=0;j<RAD;j++){const a=vc+i*RAD+j,b=vc+i*RAD+(j+1)%RAD,d=vc+(i+1)*RAD+j,e=vc+(i+1)*RAD+(j+1)%RAD;I.push(a,d,b,b,d,e);}vc+=(SEG+1)*RAD;}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setIndex(I);g.computeVertexNormals();return g;}
let eyeTex=null;
// The eye texture of MakeHuman has a very red iris and a stark white: desaturate the iris towards brown, warm and soften the white.
function calmEyeTexture(){const cv=document.createElement('canvas');cv.width=cv.height=1024;const c=cv.getContext('2d');c.fillStyle='#bdb7ab';c.fillRect(0,0,1024,1024);const tex=new T.CanvasTexture(cv);tex.colorSpace=T.SRGBColorSpace;
 tex.userData.ready=new Promise(res=>{const im=new Image();im.onerror=()=>res();im.onload=()=>{c.drawImage(im,0,0,1024,1024);const d=c.getImageData(0,0,1024,1024),px=d.data;for(let i=0;i<px.length;i+=4){const r=px[i],g=px[i+1],b=px[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx?(mx-mn)/mx:0,lum=.3*r+.59*g+.11*b;
   if(sat>.35){const k=.52;px[i]=lum+(r-lum)*k;px[i+1]=lum+(g-lum)*k*1.05;px[i+2]=lum+(b-lum)*k;px[i]*=.92;px[i+1]*=.9;px[i+2]*=.88;}      // iris: less red, a little darker
   else if(lum>150){const f=.9;px[i]=Math.min(255,px[i]*f+8);px[i+1]=Math.min(255,px[i+1]*f+5);px[i+2]=Math.min(255,px[i+2]*f);}                // white: softer, slightly warm
  }c.putImageData(d,0,0);tex.needsUpdate=true;res();};im.src='./mh/eye.png';});return tex;}
// Everything the locker needs for one head: skin, eyes, hair. `p` as in buildMHHead; `look` = {skin,hair,style}.
// The lips meet the skin gradually: positions in a ring around the mouth (outside the lips themselves) are blended with their
// neighbours, and the two lips are brought together along the mouth line so that only a fine closing line remains.
export function integrateMouth(head,D,lipW,lm){const pos=head.attributes.position,idx=head.index.array,n=pos.count,key=new Map(),canon=new Int32Array(n);
 for(let i=0;i<n;i++){const k=Math.round(pos.getX(i)*2e4)+'|'+Math.round(pos.getY(i)*2e4)+'|'+Math.round(pos.getZ(i)*2e4);if(!key.has(k))key.set(k,i);canon[i]=key.get(k);}
 const nb=Array.from({length:n},()=>new Set());for(let t=0;t<idx.length;t+=3)for(let k=0;k<3;k++){const a=canon[idx[t+k]],b=canon[idx[t+(k+1)%3]];nb[a].add(b);nb[b].add(a);}
  // measured against a young-adult profile photograph, the base lips stand about 2 mm too far forward of the line from the nose base to the chin: ease them back, with a wide fall-off so no step appears
 {const bw=smoothField(head,Float32Array.from(lipW),5);for(let i=0;i<n;i++)pos.setZ(i,pos.getZ(i)+(pos.getY(i)>=lm.ym?MH_LIP_BACK*4:0)*Math.min(1,bw[canon[i]]*2.2));}   // the upper lip stays full, the lower one comes back a little
 const ring=new Float32Array(n);for(let i=0;i<n;i++){const x=Math.abs(pos.getX(i)),dy=pos.getY(i)-lm.ym;ring[i]=smooth(.3,.0,lipW[i])*smooth(.03,.016,Math.hypot(x*.8,dy*1.25))*smooth(.03,-.01,pos.getZ(i));}
 for(let it=0;it<3;it++){const nx=new Float32Array(n*3);for(let i=0;i<n;i++){const c=canon[i];let ax=0,ay=0,az=0,m=0;for(const j of nb[c]){ax+=pos.getX(j);ay+=pos.getY(j);az+=pos.getZ(j);m++;}const w=ring[i]*.55;nx[i*3]=m&&w>0?pos.getX(i)+(ax/m-pos.getX(i))*w:pos.getX(i);nx[i*3+1]=m&&w>0?pos.getY(i)+(ay/m-pos.getY(i))*w:pos.getY(i);nx[i*3+2]=m&&w>0?pos.getZ(i)+(az/m-pos.getZ(i))*w:pos.getZ(i);}
  for(let i=0;i<n;i++){const c=canon[i];pos.setXYZ(i,nx[c*3],nx[c*3+1],nx[c*3+2]);}}   // seam duplicates move together
 {const inSet=new Uint8Array(n),lk=new Set();for(const i of [...D.lipU,...D.lipL])lk.add(canon[i]);for(let i=0;i<n;i++)if(lk.has(canon[i]))inSet[i]=1;for(let i=0;i<n;i++){const x=Math.abs(pos.getX(i)),y=pos.getY(i);if(x<lm.xc+.0012&&(inSet[i]||x>lm.xc-.003)){const yl=mouthLine(lm,Math.min(x,lm.xc)),k=.35*smooth(lm.xc+.002,lm.xc-.004,x),wt=smooth(.0065,.0022,Math.abs(y-lm.ym))*smooth(lm.xc+.0012,lm.xc-.0008,x);pos.setY(i,y+(yl+(y-lm.ym)*k-y)*wt);}}}
 // beyond the commissure the base mesh keeps a fold running out onto the cheek: replace the depth of that strip by the depth of the skin around it
 {const lipSet=new Uint8Array(n);for(const i of [...D.lipU,...D.lipL])lipSet[canon[i]]=1;const R=[];for(let i=0;i<n;i++){const x=Math.abs(pos.getX(i)),dy=Math.abs(pos.getY(i)-lm.ym);if(x>lm.xc-.002&&x<lm.xc+.016&&dy<.011&&pos.getZ(i)<-.04&&!lipSet[canon[i]])R.push(i);}
  const nz=new Map();for(let i=0;i<n;i++){const x=Math.abs(pos.getX(i)),dy=Math.abs(pos.getY(i)-lm.ym),w=.5*smooth(lm.xc+.0006,lm.xc+.0034,x)*smooth(lm.xc+.0095,lm.xc+.0055,x)*smooth(.0055,.0022,dy)*smooth(-.03,-.05,pos.getZ(i));if(w<.01)continue;
   let sw=0,sz=0;for(const j of R){const ddx=Math.abs(pos.getX(j))-x,ddy=pos.getY(j)-pos.getY(i);if(Math.abs(ddy)<.0016)continue;const g=Math.exp(-((ddx*ddx+ddy*ddy)/(.0045*.0045)));sw+=g;sz+=g*pos.getZ(j);}   // only the skin above and below the strip counts
   if(sw>1e-6)nz.set(i,pos.getZ(i)+(sz/sw-pos.getZ(i))*w);}
  for(const [i,z] of nz)pos.setZ(i,z);}
 pos.needsUpdate=true;head.computeVertexNormals();weldNormals(head);}
export function landmarks(head,D){const pos=head.attributes.position;let up=1e9,lo=-1e9;for(const i of D.lipU)if(Math.abs(pos.getX(i))<.02)up=Math.min(up,pos.getY(i));for(const i of D.lipL)if(Math.abs(pos.getX(i))<.02)lo=Math.max(lo,pos.getY(i));const ym=(up+lo)/2;
 let tz=1e9,ty=0,yc=1e9;for(let i=0;i<pos.count;i++){const x=Math.abs(pos.getX(i)),y=pos.getY(i),z=pos.getZ(i);if(x<.015&&y>ym&&y<ym+.05&&z<tz){tz=z;ty=y;}if(x<.02&&z<-.04&&y>ym-.075&&y<yc)yc=y;}
 return {ym,yn:ty-.011,yc};}
export function mhHeadGroup(D,p,look,W=1024){const {head,eyes}=buildMHHead(D,p);const cx=commissure(head,D),lipW=lipMask(head,D,cx),lm=landmarks(head,D);lm.xc=cx;if(!look.original)integrateMouth(head,D,lipW,lm);   // look.original: the base MakeHuman mouth, for comparisons
 const eyeC=[-1,1].map(sd=>{const pe=eyes.attributes.position;let sx=0,sy=0,sz=0,n=0;for(let i=0;i<pe.count;i++)if(Math.sign(pe.getX(i))===sd){sx+=pe.getX(i);sy+=pe.getY(i);sz+=pe.getZ(i);n++;}return {x:sx/n,y:sy/n,z:sz/n};});
 const map=bakeSkin(head,lipW,{skin:look.skin,hair:look.hair,style:look.style,beard:look.beard||'',lm:look.original?undefined:lm,lipRed:+look.lipRed||0,brow:look.brow||'',beardColor:look.beardColor||'',paint:look.original?null:(D.levres||null),cav:cavity(head),W,eyeC}),g=new T.Group();
 const skinMat=new T.MeshStandardMaterial({map,roughness:1,roughnessMap:map.userData.rough,metalness:0}),m=new T.Mesh(head,skinMat);m.name='Visage';m.castShadow=true;g.add(m);
 {const mo=new T.Mesh(new T.PlaneGeometry(2*lm.xc,.0045),new T.MeshBasicMaterial({color:0x2b1411,side:T.DoubleSide}));mo.position.set(0,lm.ym,-.079);mo.name='Bouche';g.add(mo);}   // the dark inside of the mouth, seen only through the fine slit between the lips
 if(!eyeTex)eyeTex=calmEyeTexture();
 const em=new T.Mesh(eyes,new T.MeshStandardMaterial({map:eyeTex,color:0xfff4ea,emissive:0xffffff,emissiveMap:eyeTex,emissiveIntensity:.16,roughness:.2,metalness:0,transparent:true,alphaTest:.2}));em.name='Yeux';g.add(em);
 const hs=hairShell(head,look.style,look.hair);if(hs){const hm=new T.Mesh(hs,new T.MeshStandardMaterial({map,roughness:Math.min(.95,Math.max(.72,(MH_HAIR[look.style]||MH_HAIR.degrade).rough)+.12*new T.Color(look.hair).getHSL({}).l),metalness:0}));hm.name='Cheveux';g.add(hm);}
 {const cg=mhCurls(head,look.style,look.hair,W>=1024,look.seed||1);if(cg){const cm=new T.Mesh(cg,new T.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0}));cm.name='Boucles';cm.castShadow=true;g.add(cm);}
  if(look.style==='chignon'){const bun=new T.Mesh(new T.SphereGeometry(.05,18,12),new T.MeshStandardMaterial({color:look.hair,roughness:.55}));bun.position.set(0,.082,.112);bun.scale.set(1,.9,.9);bun.name='Chignon';g.add(bun);}}
 // Blink: the skin of the eyelids slides over the eyeball (the lash line painted in the texture travels with it).
 {const hp=head.attributes.position,P0=Float32Array.from(hp.array),lid=[];
  for(const e of eyeC)for(let i=0;i<hp.count;i++){const dx=hp.getX(i)-e.x,dy=hp.getY(i)-e.y;if(Math.abs(dx)>.0175||hp.getZ(i)>e.z+.002||dy>.016||dy<-.011)continue;const k=Math.sqrt(Math.max(0,1-(Math.abs(dx)/.0165)**2)),wu=dy>-.002?smooth(.016,.0045,dy)*k:0,wl=dy<.001?smooth(-.011,-.0035,dy)*k:0;if(wu>.001||wl>.001)lid.push([i,wu,wl]);}
  const st={next:1.5+Math.random()*2.5,t:-1,b:0},DU=.0088,DL=.0032;
  g.userData.tick=(dt,now)=>{if(st.hold!=null){apply(st.hold);return;}if(st.t<0&&now>=st.next){st.t=0;}let b=0;if(st.t>=0){st.t+=dt;const T1=.07,T2=.04,T3=.12;b=st.t<T1?st.t/T1:st.t<T1+T2?1:st.t<T1+T2+T3?1-(st.t-T1-T2)/T3:0;if(st.t>=T1+T2+T3){st.t=-1;st.next=now+2.2+Math.random()*4.5;if(Math.random()<.18)st.next=now+.35;}}
   apply(b);};
  const apply=b=>{if(Math.abs(b-st.b)<1e-4)return;st.b=b;const ar=hp.array;for(const [i,wu,wl] of lid){ar[i*3+1]=P0[i*3+1]-b*DU*wu+b*DL*wl;ar[i*3+2]=P0[i*3+2]-b*.0008*wu;}hp.needsUpdate=true;};g.userData.setBlink=b=>{st.hold=b;apply(b);};g.userData.releaseBlink=()=>{st.hold=null;};
  g.userData.blinkNow=()=>{st.next=0;};}
 return g;}

// The faces share these closed-mouth settings (the base mesh rests with the lips slightly parted).
const SYMN=(name,v)=>({['l-'+name+'!']:v,['r-'+name+'!']:v});
// Young adult, athletic, neutral: lips drawn back and slimmer, closed at rest, a clear cupid's bow and corners; cheeks less round (also
// beside the mouth), cheekbones a little forward; a more defined jaw and chin; adult proportions instead of a child's.
export const MH_LIP_BACK=.0006;
export const MH_NEUTRAL_MODS={'mouth-upperlip-middle-down!':.75,'mouth-lowerlip-middle-up!':.45,'mouth-lowerlip-volume-incr!':.85,'mouth-upperlip-volume-incr!':.5,'mouth-lowerlip-height-decr!':.65,'mouth-upperlip-height-decr!':.35,'mouth-scale-vert-decr!':.25,'mouth-cupidsbow-incr!':1,'mouth-scale-horiz-incr!':.5,'mouth-angles-up!':.2,'mouth-scale-depth-decr!':.2,'mouth-trans-backward!':.1,'mouth-philtrum-volume-decr!':.35,
 'head-fat-decr!':.25,...SYMN('cheek-inner-decr',.4),...SYMN('cheek-bones-incr',.3),'chin-prominent-incr!':.32,'chin-bones-incr!':.1,'chin-height-decr!':.5,'head-age-incr!':.15,...SYMN('eye-height1-incr',.45),...SYMN('eye-height2-incr',.3)};

// Six face shapes, independent of the skin colour: a mix of the three base types (race blend and gender of MakeHuman only change
// the shape of the bones) plus a few fine adjustments. Names ending in * are applied to both sides (l-/r- targets).
const SYM=(name,v)=>({['l-'+name+'!']:v,['r-'+name+'!']:v});
export const MH_SHAPES=[
 {race:[.34,.33,.33],gender:.9,mods:{}},                                                                                                                       // 0 balanced
 {race:[.1,.1,.8],gender:1,mods:{'head-square!':.5,'chin-width-incr!':.35,'chin-prominent-incr!':.28,...SYM('cheek-bones-incr',.35),'forehead-temple-incr!':.3,'neck-scale-horiz-incr!':.25}},         // 1 firm jaw
 {race:[0,.8,.2],gender:.75,mods:{'head-oval!':.8,'chin-width-decr!':.08,'chin-prominent-incr!':.32,'chin-bones-incr!':.3,'chin-height-incr!':.2,...SYM('cheek-volume-decr',.5),'nose-scale-horiz-decr!':.5,'nose-width1-decr!':.4}}, // 2 slim oval with a defined jaw
 {race:[.8,0,.2],gender:.9,mods:{'head-round!':.9,...SYM('cheek-volume-incr',.7),'nose-scale-horiz-incr!':.5,'nose-flaring-incr!':.5,'chin-prominent-decr!':.3}},                                   // 3 full round
 {race:[.25,0,.75],gender:1,mods:{'head-rectangular!':.45,'chin-prominent-incr!':.35,...SYM('cheek-bones-incr',.55),'nose-hump-incr!':.45,'forehead-nubian-incr!':.4,'chin-height-incr!':.1}},        // 4 angular
 {race:[.1,.7,.2],gender:.65,mods:{'head-invertedtriangular!':.45,'chin-prominent-incr!':.3,'chin-bones-incr!':.28,'nose-point-up!':.5,...SYM('eye-scale-incr',.25),...SYM('cheek-volume-incr',.3),'nose-width1-decr!':.3}} // 5 soft with a defined jaw
];
// The player's own face settings (each −1..1, 0 = the default face): they move a few base targets up or down from where the shape put them.
export const FACE_SLIDERS=[['lipFull','Volume des lèvres',['mouth-upperlip-volume','mouth-lowerlip-volume'],.6],['lipHeight','Hauteur des lèvres',['mouth-upperlip-height','mouth-lowerlip-height'],.6],['chin','Menton avancé',['chin-prominent'],.7],['eyes','Ouverture des yeux',['l-eye-height1','r-eye-height1','l-eye-height2','r-eye-height2'],.6],['lipRed','Rouge des lèvres',[],0],
 ['lipWidth','Largeur de la bouche',['mouth-scale-horiz'],.5],['noseWidth','Largeur du nez',['nose-scale-horiz'],.6],['noseLength','Longueur du nez',['nose-scale-vert'],.6],['noseOut','Avancée du nez',['nose-scale-depth'],.6],
 ['jaw','Largeur du menton',['chin-width'],.6],['cheekBones','Pommettes',['l-cheek-bones','r-cheek-bones'],.6],['cheekFull','Joues pleines',['l-cheek-volume','r-cheek-volume'],.6],
 ['faceWidth','Largeur du visage',['head-scale-horiz'],.5],['faceLength','Longueur du visage',['head-scale-vert'],.5],['forehead','Hauteur du front',['forehead-scale-vert'],.6],['eyeSize','Taille des yeux',['l-eye-scale','r-eye-scale'],.5],['neck','Épaisseur du cou',['neck-scale-horiz'],.5],['age','Âge du visage',['head-age'],.6]];   // lipRed is painted, not a target: it changes how strongly the lips are coloured
export function applyFace(mods,face){const m={...mods};if(!face)return m;for(const [k,,names,gain] of FACE_SLIDERS){const v=Math.max(-1,Math.min(1,+face[k]||0));if(!v)continue;for(const n of names){const base=(m[n+'-incr!']||0)-(m[n+'-decr!']||0),t=Math.max(-1,Math.min(1,base+v*gain));delete m[n+'-incr!'];delete m[n+'-decr!'];if(t>0)m[n+'-incr!']=t;else if(t<0)m[n+'-decr!']=-t;}}return m;}
export function mhShapeParams(i,face){const sh=MH_SHAPES[((i%MH_SHAPES.length)+MH_SHAPES.length)%MH_SHAPES.length];return {race:sh.race.map((v,i)=>.25*v+.75*[.04,.04,.92][i]),gender:sh.gender,mods:applyFace({...MH_NEUTRAL_MODS,...sh.mods},face)};}
