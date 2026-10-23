// Lot 7 · Heads. Everything about a player's head lives here: the skull (one continuous surface), the ears, the eyes
// with real eyelids that blink, the painted skin, the beard and the hair. Two levels of detail: 'high' for the
// locker room (dense mesh, eyeballs and lids, 1024 px skin) and 'low' for matches (light mesh, painted eyes).
// Everything is expressed in metres in head space: x across, Y up with the eye line at 0, z front = negative.
import * as T from './vendor/three.module.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const gauss=(t,c,s)=>Math.exp(-(((t-c)/s)**2));
// Smooth curve through keys [t, value] that are NOT evenly spaced: cubic Hermite with spacing-aware tangents (C1 in t).
export const catmull=(keys,t)=>{const n=keys.length;if(t<=keys[0][0])return keys[0][1];if(t>=keys[n-1][0])return keys[n-1][1];let i=0;while(i<n-2&&t>keys[i+1][0])i++;
 const sec=k=>(keys[k+1][1]-keys[k][1])/(keys[k+1][0]-keys[k][0]),tan=k=>{if(k===0)return sec(0);if(k===n-1)return sec(n-2);const h0=keys[k][0]-keys[k-1][0],h1=keys[k+1][0]-keys[k][0],d0=sec(k-1),d1=sec(k);return (d0*h1+d1*h0)/(h0+h1);};
 const [t1,v1]=keys[i],[t2,v2]=keys[i+1],h=t2-t1,u=(t-t1)/h,u2=u*u,u3=u2*u;return (2*u3-3*u2+1)*v1+(u3-2*u2+u)*h*tan(i)+(-2*u3+3*u2)*v2+(u3-u2)*h*tan(i+1);};
const G2=(dx,sx,dy,sy)=>Math.exp(-((dx/sx)**2)-((dy/sy)**2));
export const FACE_SHAPES=[{nose:1,jaw:1,brow:1,wide:0},{nose:1.15,jaw:1.1,brow:1.15,wide:.4},{nose:.9,jaw:.92,brow:.9,wide:-.3},{nose:1.05,jaw:1.15,brow:1.05,wide:.7},{nose:.95,jaw:.96,brow:1.2,wide:-.1},{nose:1.2,jaw:1,brow:.95,wide:.2}];
export const HAIR_STYLES=['court','degrade','boucles','afro','plaque','chignon','rase','crane'];
const rngOf=seed=>{let a=(seed*2654435761+1013904223)>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};};
// Welds the normals of coincident vertices (seams and poles) so a lofted surface shows no crease.
export function weldNormals(geo){const pos=geo.attributes.position,nor=geo.attributes.normal,groups=new Map();for(let i=0;i<pos.count;i++){const k=Math.round(pos.getX(i)*1e5)+'|'+Math.round(pos.getY(i)*1e5)+'|'+Math.round(pos.getZ(i)*1e5);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}for(const ids of groups.values()){if(ids.length<2)continue;let x=0,y=0,z=0;for(const i of ids){x+=nor.getX(i);y+=nor.getY(i);z+=nor.getZ(i);}const l=Math.hypot(x,y,z)||1;for(const i of ids)nor.setXYZ(i,x/l,y/l,z/l);}nor.needsUpdate=true;}

// ---- The skull -------------------------------------------------------------------------------------------------
export const HR=.104,HEAD_Y=.737;
// latitude on the painted map → height above the eye line
const YK=[[-1.5708,-.12],[-1.1,-.112],[-.7,-.1],[-.375,-.075],[-.2,-.045],[.095,0],[.26,.028],[.64,.07],[1,.1],[1.5708,.117]];
// half-width, front depth and back depth by height: round cranium (widest above the ears), cheekbones, a jaw that
// narrows to the chin, and a full back of the head that tucks into the nape.
const AK=[[-.12,.012],[-.112,.026],[-.1,.04],[-.088,.049],[-.075,.055],[-.05,.0605],[-.025,.067],[0,.0715],[.02,.0745],[.045,.0765]].map(([y,a])=>[y,a*(y<-.11?1:1.06)]),AMAX=AK[AK.length-1][1];
const FK=[[-.12,.02],[-.112,.04],[-.1,.066],[-.08,.077],[-.05,.0835],[-.03,.0838],[0,.0845],[.03,.0895],[.045,.088]];
const BK=[[-.12,.02],[-.106,.04],[-.09,.058],[-.07,.077],[-.04,.094],[-.01,.1],[.02,.1015],[.045,.1]];
export function headDims(Y,v){const top=Y>=.045,t=top?(Y-.045)/.072:0,dome=top?Math.sqrt(Math.max(0,1-t*t)):1;let a=top?AMAX*dome:catmull(AK,Y);a*=1+(v.jaw-1)*.5*smooth(-.01,-.065,Y);a*=1+.04*v.wide;return {a,bf:top?.088*dome:catmull(FK,Y),bb:top?.1*dome:catmull(BK,Y),e:2/(2.1+.2*smooth(0,-.05,Y))};}
const PHI=l=>l+.55*Math.sin(l)*Math.cos(l);
// Where a point of the face (x, Y in metres) sits on the painted map: (longitude, latitude). The features are drawn
// in real dimensions through this mapping, so an eye is 26 mm wide whatever the stretch of the texture.
export function uvOf(x,Y,v=FACE_SHAPES[0]){let lo=-1.5708,hi=1.5708;for(let i=0;i<28;i++){const m=(lo+hi)/2;if(catmull(YK,m)<Y)lo=m;else hi=m;}const f=(lo+hi)/2,d=headDims(Y,v),s=-Math.sign(x)*Math.min(1,Math.pow(Math.abs(x)/d.a,1/d.e)),phi=Math.asin(s);let l=phi/1.3;for(let i=0;i<8;i++)l-=(PHI(l)-phi)/(1+.55*Math.cos(2*l));return [l,f];}
// Relief of the face in metres (outwards): shallow sockets, a soft brow, a rounded nose, lips blended into the face,
// a gentle groove under the lower lip, cheekbones and chin. All the bumps are wide so the surface stays continuous.
function reliefM(x,Y,z,v){const ax=Math.abs(x),fm=smooth(0,-.05,z),nb=Math.pow(smooth(.01,-.034,Y),1.25);let r=0;
 r+=-.0034*G2(ax-.031,.019,Y-.003,.013)+.003*G2(ax-.031,.013,Y,.008);                                        // shallow socket, eyeball under the lids
 r+=.0055*v.brow*G2(ax-.03,.036,Y-.026,.009);                                                               // soft brow
 r+=(.0015+.0128*nb)*v.nose*Math.exp(-((x/(.0085+.0055*nb))**2))*smooth(-.048,-.036,Y)*smooth(.022,.006,Y);   // bridge widening to the tip
 r+=.0055*v.nose*G2(x,.0085,Y+.0325,.0068);                                                                  // rounded tip
 r+=.0042*v.nose*G2(ax-.0135,.0072,Y+.0335,.0065)-.0022*G2(ax-.0082,.0045,Y+.0405,.0035)-.0018*G2(x,.0045,Y+.055,.011);
 r+=.0058*G2(x,.025,Y+.0708,.0058)+.0072*G2(x,.022,Y+.0825,.0068)-.0024*G2(x,.026,Y+.0755,.0017);           // lips, mouth line
 r+=-.0042*G2(x,.02,Y+.0955,.0036)+.0072*v.jaw*G2(x,.019,Y+.108,.011);                                       // groove under the lip, chin
 r+=.0045*G2(ax-.055,.022,Y+.012,.017)-.003*G2(ax-.052,.021,Y+.05,.019)-.002*G2(ax-.062,.015,Y-.03,.021)+.002*G2(ax-.058,.016,Y+.065,.018); // cheekbone, hollow, temple, jaw muscle
 return r*fm;}
export function headPoint(l,f,v,lift=0){const Y=catmull(YK,f),{a,bf,bb,e}=headDims(Y,v),phi=PHI(l),s=Math.sin(phi),c=Math.cos(phi),x=-Math.sign(s)*Math.pow(Math.abs(s),e)*a,z=c>0?-Math.pow(c,e)*bf:Math.pow(-c,e)*bb;
 const d=new T.Vector3(x,Y*.35,z).normalize(),rel=reliefM(x,Y,z,v)+lift;return new T.Vector3(x+d.x*rel,Y+d.y*rel,z+d.z*rel);}
// The visible opening of an eye (lid margins), in face metres. The eyeball is 23 mm, the opening 26 × 10 mm.
const quadPts=(p0,pc,p1,n)=>{const o=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;o.push([u*u*p0[0]+2*u*t*pc[0]+t*t*p1[0],u*u*p0[1]+2*u*t*pc[1]+t*t*p1[1]]);}return o;};
export function eyeOutline(side,n=14){const X=q=>side*q,inner=[X(.0185),-.0005],outer=[X(.0445),.0013];return {upper:quadPts(inner,[X(.0315),.0102],outer,n),lower:quadPts(outer,[X(.0315),-.0094],inner,n)};}
const EYE_C=[.0316,.0007];
const inPoly=(x,y,poly)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
// The surface: a grid over (longitude, latitude), dense around the face. 'drop' removes triangles (eye openings,
// or the parts of a hair shell that lie inside the head).
export function gridGeometry(v,{nl,nf,dense,lift,drop}){const ls=[],fs=[];for(let i=0;i<=nl;i++){const t=i/nl*2-1;ls.push(Math.PI*(dense?.3*t+.7*t*t*t:t));}for(let j=0;j<=nf;j++){const t=j/nf*2-1;fs.push(Math.PI/2*(dense?.45*t+.55*t*t*t:t));}
 const W=nl+1,pos=new Float32Array(W*(nf+1)*3),uv=new Float32Array(W*(nf+1)*2),th=lift?new Float32Array(W*(nf+1)):null;
 for(let j=0;j<=nf;j++)for(let i=0;i<=nl;i++){const k=j*W+i,lf=lift?lift(ls[i],fs[j]):0,p=headPoint(ls[i],fs[j],v,lf);pos[k*3]=p.x;pos[k*3+1]=p.y;pos[k*3+2]=p.z;uv[k*2]=ls[i]/(2*Math.PI)+.5;uv[k*2+1]=(fs[j]+Math.PI/2)/Math.PI;if(th)th[k]=lf;}
 // orientation: the triangle at the centre of the face must point forwards (-z)
 const c0=(nf/2)*W+nl/2,pa=new T.Vector3(pos[c0*3],pos[c0*3+1],pos[c0*3+2]),pb=new T.Vector3(pos[(c0+1)*3],pos[(c0+1)*3+1],pos[(c0+1)*3+2]),pc=new T.Vector3(pos[(c0+W)*3],pos[(c0+W)*3+1],pos[(c0+W)*3+2]),flip=pb.sub(pa).cross(pc.sub(pa)).z>0;
 const idx=[];const keep=(a,b,c)=>{if(drop&&drop(pos,th,a,b,c))return;idx.push(a,flip?c:b,flip?b:c);};
 for(let j=0;j<nf;j++)for(let i=0;i<nl;i++){const a=j*W+i,b=a+1,c=a+W,d=c+1;keep(a,b,c);keep(b,d,c);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();weldNormals(g);g.computeBoundingSphere();return g;}
export function buildHead(shape,detail='low'){const v=FACE_SHAPES[shape%FACE_SHAPES.length],hi=detail==='high',holes=hi?[eyeOutline(-1),eyeOutline(1)].map(o=>[...o.upper,...o.lower]):null;
 const drop=holes?(pos,th,a,b,c)=>{const x=(pos[a*3]+pos[b*3]+pos[c*3])/3,y=(pos[a*3+1]+pos[b*3+1]+pos[c*3+1])/3,z=(pos[a*3+2]+pos[b*3+2]+pos[c*3+2])/3;return z<-.04&&(inPoly(x,y,holes[0])||inPoly(x,y,holes[1]));}:null;
 return gridGeometry(v,{nl:hi?150:60,nf:hi?130:44,dense:hi,drop});}
// ---- Ears: a helix rim, a bowl, a tragus and a lobe on a slab that sinks into the skull -------------------------
export function buildEar(side,detail='low'){const hi=detail==='high',nu=hi?18:8,nv=hi?24:10,pos=[],idx=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const u=i/nu*2-1,w=j/nv*2-1,a=u*Math.sqrt(1-w*w/2),b=w*Math.sqrt(1-u*u/2),r=Math.hypot(a,b),th=Math.atan2(b,a);
  const rimMask=smooth(.55,.85,r)*(1-smooth(.95,1,r)),ridge=gauss(r,.5,.13)*smooth(-.15,.45,b),bowl=smooth(.5,.15,r)*smooth(.35,-.2,b),tragus=Math.exp(-((((a+.72)/.2)**2)+(((b+.15)/.22)**2))),lobe=b<-.5?.72:1;
  const h=(.0022+.0042*(1-r*r)+.0046*rimMask+.0028*ridge-.0042*bowl+.0042*tragus)*lobe*(1-.85*smooth(.93,1,r));
  const py=b*(b<0?.0335:.0305),pp=a*.0182*(1-.32*Math.max(0,-b));      // up, towards the back
  pos.push(side*(h-.004),py,pp);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;idx.push(a,b,c,b,d,c);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
 // make the outer face point away from the head
 const n=g.attributes.normal,mid=Math.floor((nv/2)*(nu+1)+nu/2);if(n.getX(mid)*side<0){const f=[];for(let i=0;i<idx.length;i+=3)f.push(idx[i],idx[i+2],idx[i+1]);g.setIndex(f);g.computeVertexNormals();}
 return g;}
// Where the ear root sits on the skull and how it flares away from it.
export function earMount(side,v){const p=headPoint(-side*1.58,.0,v);return {x:p.x,y:p.y-.004,z:p.z+.004,ry:side*-.42,rz:side*-.12};}

// ---- Hair: short hair as a thin shell + a painted fade, curls as clusters of soft volumes ------------------------
const HAIRLINE=[[0,.74],[.32,.73],[.58,.65],[.9,.5],[1.12,.2],[1.26,-.08],[1.36,-.06],[1.45,.22],[1.6,.3],[1.8,.18],[2.1,-.24],[2.6,-.48],[3.2,-.58]];
export function hairline(l){const a=Math.abs(l);let f=-.6;for(let i=1;i<HAIRLINE.length;i++){const [a1,f1]=HAIRLINE[i],[a0,f0]=HAIRLINE[i-1];if(a<=a1){f=f0+(f1-f0)*(a-a0)/(a1-a0);break;}}return f+.009*Math.sin(l*13+1.3)+.005*Math.sin(l*29+.4);}
// 0 = bare skin … 1 = full hair. Short hair on the sides and nape fades out gradually (the "fade").
export function fadeDensity(style,l,f){if(style==='crane')return 0;const a=Math.abs(l),hl=hairline(l),above=smooth(hl-.05,hl+.09,f);if(style==='rase')return above*.2;
 const ramp=style==='boucles'||style==='degrade'?.42:style==='court'?.14:.22,side=a>1.0?smooth(hl-.02,hl+ramp,f):1;return above*side;}
export function hairShellThickness(style,l,f){const dd=fadeDensity(style,l,f),top=smooth(.3,1.1,f);
 switch(style){case 'court':return dd*(.006+.004*top);case 'degrade':return dd*(.003+.013*top);case 'boucles':return dd*(.004+.003*top);case 'afro':return dd*(.012+.006*top);case 'plaque':return dd*(.008+.008*gauss(l,0,.9)*top+.003*top);case 'chignon':return dd*(.007+.004*top);case 'rase':return dd*.002;default:return 0;}}
export function buildHairShell(style,shape,seed,detail='low'){if(style==='crane')return null;const v=FACE_SHAPES[shape%FACE_SHAPES.length],hi=detail==='high';
 const drop=(pos,th,a,b,c)=>th[a]<-.0042&&th[b]<-.0042&&th[c]<-.0042;
 return gridGeometry(v,{nl:hi?130:60,nf:hi?100:40,dense:false,lift:(l,f)=>{const t=hairShellThickness(style,l,f);return t+.0006-.0052*(1-smooth(0,.003,t));},drop});}
// Curl clusters: grouped small volumes, volume on top, irregular implantation line, shorter at the sides.
export function buildCurls(style,shape,seed,detail,hairHex){if(style!=='boucles'&&style!=='afro')return null;const v=FACE_SHAPES[shape%FACE_SHAPES.length],hi=detail==='high',rng=rngOf(seed*7+11),afro=style==='afro',n=afro?(hi?230:80):(hi?190:60),per=hi?5:3,pts=[],base=new T.Color(hairHex);
 const ok=(l,f)=>{const a=Math.abs(l),hl=hairline(l);if(a<1.15&&f<hl+.06)return false;if(afro)return f>-.1+.25*smooth(2,3,a);return a<1.15?f>hl+.06:f>.5+.12*smooth(1.1,1.7,a);};
 let tries=0;while(pts.length<n&&tries<n*60){tries++;const l=(rng()*2-1)*Math.PI,f=Math.asin(rng()*.97);if(f<.05||!ok(l,f))continue;const p=headPoint(l,f,v,0);if(pts.some(q=>q.distanceTo(p)<(afro?.022:.0155)))continue;p.userData={l,f};pts.push(p);}
 const sph=new T.SphereGeometry(1,hi?8:6,hi?6:4),sp=sph.attributes.position,sn=sph.attributes.normal,si=sph.index.array,P=[],N=[],C=[],I=[];let vc=0;
 for(const p of pts){const nrm=new T.Vector3(p.x,p.y*.6,p.z).normalize(),t1=new T.Vector3().crossVectors(nrm,new T.Vector3(0,1,0)).normalize();if(t1.lengthSq()<.1)t1.set(1,0,0);const t2=new T.Vector3().crossVectors(nrm,t1).normalize(),k0=.82+.36*rng();
  for(let k=0;k<per;k++){const ang=k*2.3+rng()*.8,rad=k?.0045+.0028*rng():0,rise=.0028*k+.004,off=new T.Vector3().copy(p).addScaledVector(t1,Math.cos(ang)*rad).addScaledVector(t2,Math.sin(ang)*rad).addScaledVector(nrm,rise),r=(afro?.0135:.0088)+.004*rng(),m=new T.Matrix4().makeBasis(t1,nrm,t2),q=new T.Quaternion().setFromRotationMatrix(m),sc=new T.Vector3(r*1.15,r*.85,r*1.1),mat=new T.Matrix4().compose(off,q,sc),col=base.clone().multiplyScalar(k0*(.9+.2*rng()));
   const tmp=new T.Vector3(),sh=rng()*50;for(let i=0;i<sp.count;i++){tmp.fromBufferAttribute(sp,i);const bump=1+.16*Math.sin(tmp.x*5.1+sh)*Math.sin(tmp.y*4.3+sh*1.7)+.1*Math.sin(tmp.z*7+sh*.6);tmp.multiplyScalar(bump).applyMatrix4(mat);P.push(tmp.x,tmp.y,tmp.z);tmp.fromBufferAttribute(sn,i).applyQuaternion(q);N.push(tmp.x,tmp.y,tmp.z);C.push(col.r,col.g,col.b);}for(const i of si)I.push(i+vc);vc+=sp.count;}}
 sph.dispose();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setIndex(I);g.computeBoundingSphere();return g;}
export const buildBun=()=>new T.SphereGeometry(.042,16,10);

// ---- Beard: a continuous density, never a hard mask --------------------------------------------------------------
export function beardDensity(kind,l,f){if(!kind)return 0;const a=Math.abs(l),side=smooth(1.46,1.2,a),mouth=1-.95*Math.exp(-(((a/.2)**2)+(((f+.4)/.075)**2))),neck=smooth(-1.12,-.92,f);let d;
 const stacheB=.85*smooth(.36,.16,a)*smooth(-.1,-.24,f)*smooth(-.38,-.29,f);
 if(kind==='bouc')d=Math.max(smooth(.3,.15,a)*smooth(-.3,-.4,f)*smooth(-.95,-.75,f)*mouth,stacheB*.9);
 else{const cheek=-.07-(1.3-a)*.22,upper=smooth(cheek+.1,cheek-.12,f);d=Math.max(upper*side*neck*mouth,stacheB*(kind==='barbe'?1:.6));if(kind==='barbe3j')d*=.5;}
 const patch=.78+.22*Math.sin(l*9.5+f*7.3)*Math.sin(l*5.1-f*11.7);return clamp(d*patch,0,1);}

// ---- Painted skin, face features in real dimensions ---------------------------------------------------------------
export function paintFace(skin,hair,eye,beard,style,shape=0,detail='low'){
 const hi=detail==='high',FW=hi?1024:512,FH=hi?512:256,K=FW/1024,PXR=FW/(2*Math.PI),V=FACE_SHAPES[shape%FACE_SHAPES.length];
 const make=(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;},cv=make(FW,FH),c=cv.getContext('2d');
 if(typeof c?.fillRect!=='function'||typeof c.arc!=='function'||typeof c.ellipse!=='function'||typeof c.createRadialGradient!=='function')return {map:new T.CanvasTexture(cv)};
 const col=hex=>new T.Color(hex),css=cl=>'#'+cl.getHexString(),tone=(hex,f)=>{const cl=col(hex);cl.lerp(col(f<0?0x1a0d08:0xffffff),Math.abs(f));return css(cl);},rgba=(hex,a)=>{const cl=col(hex);return `rgba(${Math.round(cl.r*255)},${Math.round(cl.g*255)},${Math.round(cl.b*255)},${a})`;};
 const dark=col(skin).getHSL({}).l<.35;let sd=0;for(const ch of [skin,hair,eye,beard,style,shape,detail].join('|'))sd=(sd*31+ch.charCodeAt(0))>>>0;const rnd=rngOf(sd);
 const px=(x,Y)=>{const [l,f]=uvOf(x,Y,V);return [FW/2+l*PXR,FH/2-f*PXR];};
 const poly=(pts,fill)=>{c.beginPath();pts.forEach((p,i)=>{const [X,Yy]=px(p[0],p[1]);if(i)c.lineTo(X,Yy);else c.moveTo(X,Yy);});c.closePath();c.fillStyle=fill;c.fill();};
 const ribbon=(pts,w,fill)=>{const L=[],R=[];pts.forEach((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];let dx=b[0]-a[0],dy=b[1]-a[1];const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;const ww=(typeof w==='function'?w(i/(pts.length-1)):w)/2;L.push([p[0]-dy*ww,p[1]+dx*ww]);R.push([p[0]+dy*ww,p[1]-dx*ww]);});poly([...L,...R.reverse()],fill);};
 const ell=(x,Y,rx,ry,fill,n=18)=>{const o=[];for(let i=0;i<n;i++){const t=i/n*Math.PI*2;o.push([x+Math.cos(t)*rx,Y+Math.sin(t)*ry]);}poly(o,fill);};
 const blob=(x,Y,rx,ry,color,alpha)=>{const [cx,cy]=px(x,Y),dx=Math.abs(px(x+rx,Y)[0]-cx)||1,dy=Math.abs(px(x,Y+ry)[1]-cy)||1,g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,rgba(color,alpha));g.addColorStop(1,rgba(color,0));c.save();c.translate(cx,cy);c.scale(dx,dy);c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();};
 c.fillStyle=skin;c.fillRect(0,0,FW,FH);
 const warm=dark?0x7a2a22:0xc4524a,ink=0x2a1610,yel=0xc9a24a;
 // very soft colour variation: slightly redder cheeks and nose, a lighter forehead, a touch of yellow, no hard shading
 blob(0,.062,.052,.022,0xffffff,.05);for(const s of [-1,1]){blob(s*.052,-.026,.026,.02,warm,dark?.045:.07);blob(s*.0725,-.005,.012,.028,warm,.1);blob(s*.031,-.014,.019,.008,ink,.07);blob(s*.056,-.07,.024,.024,ink,.03);}
 blob(0,-.036,.011,.009,warm,dark?.07:.12);blob(0,-.095,.03,.02,warm,.03);
 for(let i=0;i<(hi?46:20);i++){const x=(rnd()-.5)*.13,Y=-.1+rnd()*.17,k=rnd();blob(x,Y,.012+rnd()*.016,.01+rnd()*.012,k<.4?yel:k<.7?warm:0xffffff,.025+rnd()*.025);}
 {const g=c.createLinearGradient(0,px(0,-.088)[1],0,FH);g.addColorStop(0,rgba(ink,0));g.addColorStop(1,rgba(ink,.3));c.fillStyle=g;c.fillRect(0,px(0,-.088)[1],FW,FH);}
 if(!beard)for(const [x,Y] of [[-.036,-.075],[.036,-.075],[0,-.1]])blob(x,Y,.03,.024,0x2a3540,dark?.03:.05);
 for(let i=0;i<(hi?5200:1800);i++){c.fillStyle=rnd()<.5?'rgba(40,20,12,.028)':'rgba(255,240,225,.03)';c.fillRect(rnd()*FW,rnd()*FH,1.3*K+.4,1.3*K+.4);}   // very fine grain, no obvious pores
 // nose: only a light shading, wing creases and small nostrils
 for(const s of [-1,1]){ribbon([[s*.011,.008],[s*.0125,-.02],[s*.015,-.033]],.0022,rgba(ink,.035));ribbon([[s*.0135,-.031],[s*.0185,-.0365],[s*.0148,-.0435]],.001,rgba(ink,.1));ell(s*.0082,-.0412,.0034,.0017,rgba(0x1a0805,.3));ribbon([[s*.019,-.036],[s*.026,-.056],[s*.0285,-.075]],.0014,rgba(ink,.05));}
 ribbon([[0,.012],[0,-.03]],.004,rgba(0xffffff,.07));
 // eyes
 const outlineOf=s=>eyeOutline(s,12);
 for(const s of [-1,1]){const o=outlineOf(s),up=o.upper,lo=o.lower,X=q=>s*q;
  ribbon(up.map(p=>[p[0],p[1]+.0048]),.0012,rgba(ink,hi?.22:.28));                                              // lid fold
  blob(X(.031),.0095,.021,.0055,ink,.1);blob(X(.031),-.0125,.019,.005,ink,.06);                              // lids, under-eye (soft)
  if(!hi){const lid=[...up,...lo];poly(lid,'#d9d6cf');c.save();c.beginPath();lid.forEach((p,i)=>{const [a,b]=px(p[0],p[1]);if(i)c.lineTo(a,b);else c.moveTo(a,b);});c.closePath();c.clip();
   blob(X(.02),0,.006,.005,0xc08070,.35);blob(X(.043),0,.005,.006,0x706058,.28);
   const [ix,iy]=px(X(.0316),.0007),dx=Math.abs(px(X(.0316)+.0056,.0007)[0]-ix),dy=Math.abs(px(X(.0316),.0007+.0056)[1]-iy),g=c.createRadialGradient(0,0,.1,0,0,1);g.addColorStop(0,tone(eye,.25));g.addColorStop(.72,eye);g.addColorStop(1,tone(eye,-.6));
   c.save();c.translate(ix,iy);c.scale(dx,dy);c.fillStyle=g;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.fillStyle='#070605';c.beginPath();c.arc(0,0,.4,0,Math.PI*2);c.fill();c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.arc(.34,-.36,.14,0,Math.PI*2);c.fill();c.restore();
   blob(X(.0316),.0072,.02,.0048,0x120805,.5);c.restore();ribbon(up,.0015,'#1a0f0a');ribbon(lo,.0006,rgba(ink,.35));}}
 // eyebrows
 for(const s of [-1,1]){const arch=quadPts([s*.011,.0215],[s*.036,.0335],[s*.06,.0165],14);ribbon(arch,t=>.0042*(1-.5*t),rgba(col(hair).lerp(col(0x000000),.2).getHex(),.45));
  for(let i=0;i<(hi?100:50);i++){const t=rnd(),k=Math.min(13,Math.floor(t*14)),p=arch[k],q=arch[Math.min(13,k+1)],ang=Math.atan2(q[1]-p[1],q[0]-p[0]),len=.0045+rnd()*.003,up=t<.22?.9:.18,x0=p[0]+(rnd()-.5)*.002,y0=p[1]+(rnd()-.5)*.004;
   ribbon([[x0,y0],[x0+s*Math.abs(Math.cos(ang))*len*(1-up*.6),y0+len*(up*.9+Math.abs(Math.sin(ang))*.3)]],.0006,rgba(col(hair).lerp(col(0x000000),.15).getHex(),.5+rnd()*.35));}}
 // lips: blended into the skin (soft edges), commissures, a gentle groove under the lower lip
 {const lipCol=col(skin).lerp(col(dark?0x5a2a24:0xa8504a),dark?.28:.34),mouth=[[.026,-.0752],[.013,-.0758],[0,-.0757],[-.013,-.0758],[-.026,-.0752]],upper=[[-.026,-.0752],[-.019,-.0728],[-.011,-.0696],[-.004,-.0703],[0,-.0717],[.004,-.0703],[.011,-.0696],[.019,-.0728],[.026,-.0752],...mouth],lower=[...mouth,[.025,-.0753],[.018,-.083],[.008,-.0877],[0,-.0885],[-.008,-.0877],[-.018,-.083],[-.025,-.0753]];
  poly(upper,css(lipCol.clone().lerp(col(0x1a0d08),.08)));poly(lower,css(lipCol));
  ribbon([...upper.slice(0,9),[-.026,-.0752]],.0018,rgba(skin,.3));ribbon([[.025,-.0753],[.018,-.083],[.008,-.0877],[0,-.0885],[-.008,-.0877],[-.018,-.083],[-.025,-.0753]],.0018,rgba(skin,.3));
  blob(0,-.0825,.009,.0027,0xffffff,.16);ribbon([[-.027,-.0752],[-.013,-.0761],[0,-.076],[.013,-.0761],[.027,-.0752]],.001,css(lipCol.clone().lerp(col(0x100604),.5)));
  for(const s of [-1,1])blob(s*.0268,-.0755,.0055,.0045,ink,.16);blob(0,-.0985,.016,.0045,ink,.1);}
 blob(0,-.108,.014,.008,0xffffff,.05);
 // hair colour on the scalp: the painted fade (full on top, graded to nothing on the sides and the nape)
 if(style!=='crane'){const step=1;for(let y=0;y<FH;y+=step)for(let x=0;x<FW;x+=step){const l=(x-FW/2)/PXR,f=(FH/2-y)/PXR,d=fadeDensity(style,l,f);if(d>.01){c.fillStyle=rgba(col(hair).getHex(),d*.82);c.fillRect(x,y,step,step);}}
  for(let i=0;i<(hi?9000:3500);i++){const l=(rnd()-.5)*2*Math.PI,f=Math.asin((rnd()*2-1)*.98),d=fadeDensity(style,l,f);if(rnd()<d*.5)continue;if(d<.02||d>.97)continue;c.fillStyle=rgba(col(hair).getHex(),.55);c.fillRect(FW/2+l*PXR,FH/2-f*PXR,1.2*K+.4,1.2*K+.4);}}
 // beard: grains whose density follows a continuous field, so the edges fade out
 if(beard){const hc=col(hair).getHex(),N=hi?80000:28000;for(let i=0;i<N;i++){const l=(rnd()-.5)*2.8,f=-.02-rnd()*1.1,d=beardDensity(beard,l,f);if(rnd()>d)continue;c.fillStyle=rgba(hc,(beard==='barbe3j'?.3:.5)+.35*rnd()*d);c.fillRect(FW/2+l*PXR,FH/2-f*PXR,(.9+.8*rnd())*K+.3,(1.1+1.5*rnd())*K+.3);}}
 const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
 // roughness: matte skin (0.67), glossy lips, slightly shiny nose and forehead, rougher hair
 const rw=hi?256:128,rh=rw/2,rv=make(rw,rh),r=rv.getContext('2d'),RP=(x,Y)=>{const [X,Yy]=px(x,Y);return [X*rw/FW,Yy*rh/FH];};r.fillStyle='rgb(172,172,172)';r.fillRect(0,0,rw,rh);
 const spot=(x,Y,rx,ry,vv)=>{const [X,Yy]=RP(x,Y),[X2]=RP(x+rx,Y),[,Y2]=RP(x,Y+ry);r.fillStyle=`rgb(${vv},${vv},${vv})`;r.beginPath();r.ellipse(X,Yy,Math.abs(X2-X)||1,Math.abs(Y2-Yy)||1,0,0,Math.PI*2);r.fill();};
 spot(0,-.08,.02,.007,120);spot(0,-.034,.007,.01,140);spot(0,.062,.04,.012,150);
 if(style!=='crane'){r.fillStyle='rgb(225,225,225)';for(let x=0;x<rw;x++){const l=(x-rw/2)*2*Math.PI/rw,y=rh/2-hairline(l)*(rw/(2*Math.PI));r.fillRect(x,0,1,Math.max(0,y));}}
 const bw=hi?512:256,bv=make(bw,bw/2),b=bv.getContext('2d');b.fillStyle='rgb(128,128,128)';b.fillRect(0,0,bw,bw/2);for(let i=0;i<(hi?9000:2500);i++){const vv=116+Math.floor(rnd()*24);b.fillStyle=`rgb(${vv},${vv},${vv})`;b.fillRect(rnd()*bw,rnd()*bw/2,1,1);}
 return {map,roughnessMap:new T.CanvasTexture(rv),bumpMap:new T.CanvasTexture(bv)};}
export function paintHair(hair,style){const W=512,H=256,cv=document.createElement('canvas');cv.width=W;cv.height=H;const c=cv.getContext('2d');if(typeof c?.fillRect!=='function')return {map:new T.CanvasTexture(cv)};
 const base=new T.Color(hair),shade=(k,a)=>{const cl=base.clone().lerp(new T.Color(k>0?0xffffff:0x000000),Math.abs(k));return `rgba(${Math.round(cl.r*255)},${Math.round(cl.g*255)},${Math.round(cl.b*255)},${a})`;};const rnd=rngOf(hair.length*97+style.length*13);
 c.fillStyle='#'+base.getHexString();c.fillRect(0,0,W,H);
 for(let i=0;i<22000;i++){c.fillStyle=shade((rnd()-.5)*.2,.3);c.fillRect(rnd()*W,rnd()*H,1,1+rnd()*.6);}   // fine grain, no repeated grooves or blotches
 const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;map.wrapS=T.RepeatWrapping;return {map,bumpMap:map};}

// ---- Eyes: an eyeball under real lids (the upper lid is a shell that closes), a gaze and a blink -----------------
export function eyeBallTexture(eyeHex){const cv=document.createElement('canvas');cv.width=256;cv.height=128;const c=cv.getContext('2d');if(typeof c?.fillRect!=='function'||typeof c.createLinearGradient!=='function')return new T.CanvasTexture(cv);
 // the sphere's pole faces forwards: the iris is a band along the top rows, around the pole
 const g=c.createLinearGradient(0,0,0,128);g.addColorStop(0,'#e4e1da');g.addColorStop(.5,'#d5d2ca');g.addColorStop(1,'#a9a49c');c.fillStyle=g;c.fillRect(0,0,256,128);
 const rnd=rngOf(eyeHex.length*31+7);for(let i=0;i<14;i++){c.strokeStyle='rgba(170,70,60,.12)';c.lineWidth=.8;c.beginPath();const x=rnd()*256,y=30+rnd()*70;c.moveTo(x,y);c.lineTo(x+(rnd()-.5)*18,y+(rnd()-.5)*20);c.stroke();}
 const iris=21,col=new T.Color(eyeHex);for(let y=0;y<iris;y++){const t=y/iris,cl=col.clone().lerp(new T.Color(0x000000),t>.82?(t-.82)*3.4:0).lerp(new T.Color(0xffffff),(1-t)*.12);c.fillStyle='#'+cl.getHexString();c.fillRect(0,y,256,1);}
 for(let i=0;i<150;i++){const x=rnd()*256,cl=col.clone().multiplyScalar(.75+rnd()*.55);c.strokeStyle='#'+cl.getHexString();c.globalAlpha=.55;c.lineWidth=1;c.beginPath();c.moveTo(x,4+rnd()*3);c.lineTo(x+(rnd()-.5)*2,iris-2);c.stroke();}c.globalAlpha=1;
 c.fillStyle='#050403';c.fillRect(0,0,256,8);return Object.assign(new T.CanvasTexture(cv),{colorSpace:T.SRGBColorSpace});}
// parts of one eye in head space; returns {pivot, ball, lid} with the rim ring added by the caller
export function buildEye(side,v,eyeHex,skinMat){const [ex,ey]=EYE_C,X=side*ex,[l,f]=uvOf(X,ey,v),zs=headPoint(l,f,v).z,center=new T.Vector3(X,ey,zs+.0112);
 const pivot=new T.Group();pivot.position.copy(center);const ballGeo=new T.SphereGeometry(.0117,28,18);ballGeo.rotateX(-Math.PI/2);
 const ball=new T.Mesh(ballGeo,new T.MeshPhysicalMaterial({map:eyeBallTexture(eyeHex),roughness:.28,clearcoat:1,clearcoatRoughness:.06}));ball.name='Globe';pivot.add(ball);
 const lidGeo=new T.SphereGeometry(.0128,24,12,Math.PI-.4,Math.PI+.8,0,1.19);const lid=new T.Mesh(lidGeo,skinMat);lid.name='Paupière';lid.rotation.x=LID_OPEN;pivot.add(lid);
 // lash line along the upper margin, carried by the lid
 const o=eyeOutline(side,14),pts=o.upper.map(p=>new T.Vector3(p[0]-center.x,p[1]-center.y,0)),
  rr=.0128;for(const p of pts){const yy=clamp(p.y,-.0125,.0125),xx=clamp(p.x,-.0125,.0125);p.set(xx,yy,-Math.sqrt(Math.max(1e-9,rr*rr-xx*xx-yy*yy)));}
 const lashGeo=new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.0007,5,false),lash=new T.Mesh(lashGeo,new T.MeshStandardMaterial({color:0x140c08,roughness:.6}));lash.name='Cils';lash.visible=false;lid.add(lash);
 return {pivot,ball,lid,lash,center};}
// Rim of the opening (lid thickness) around the hole in the skin
export function buildEyeRim(side,v,skinColor){const o=eyeOutline(side,14),at=p=>{const [l,f]=uvOf(p[0],p[1],v),q=headPoint(l,f,v);return new T.Vector3(q.x,q.y,q.z);},loop=[...o.upper,...o.lower.slice(1,-1)].map(p=>{const q=at(p);q.z+=.0003;return q;}),g=new T.Group();g.name='Bord des paupières';
 g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(loop,true),60,.0018,6,true),new T.MeshStandardMaterial({color:new T.Color(skinColor).multiplyScalar(.93),roughness:.55})));
 const lashPts=o.upper.map(p=>{const q=at(p);q.y-=.0004;q.z-=.0009;return q;});g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(lashPts),24,.00085,5,false),new T.MeshStandardMaterial({color:0x140c08,roughness:.6})));return g;}
// Relaxed face: a blink every few seconds (closing in 0.07 s, opening in 0.11 s) and tiny gaze drifts.
// Rotation of the upper lid: relaxed (it hoods the top of the iris slightly) and fully closed.
export const LID_OPEN=.3;
export function animateEyes(face,dt,now){if(!face||!face.eyes)return;const s=face.state||(face.state={next:now+2+Math.random()*3,t:-1,gx:0,gy:0,tx:0,ty:0,nextGaze:now+1});
 if(now>=s.nextGaze){s.tx=(Math.random()-.5)*.2;s.ty=(Math.random()-.5)*.12;s.nextGaze=now+1+Math.random()*2.5;}const k=1-Math.exp(-dt*9);s.gx+=(s.tx-s.gx)*k;s.gy+=(s.ty-s.gy)*k;
 if(s.t<0&&now>=s.next){s.t=0;}let close=0;if(s.t>=0){s.t+=dt;const t=s.t;close=t<.07?t/.07:t<.09?1:t<.2?1-(t-.09)/.11:0;if(t>=.2){s.t=-1;s.next=now+2.5+Math.random()*3.5;if(Math.random()<.15)s.next=now+.35;}}
 for(const e of face.eyes){e.ball.rotation.set(s.gy,s.gx,0);e.lid.rotation.x=LID_OPEN-(LID_OPEN+.55)*close;e.lash.visible=close>.3;}}
