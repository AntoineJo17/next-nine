import * as T from './vendor/three.module.js';
import {mhHeadGroup,mhShapeParams} from './mh.js?v=20-9n';
import {R,clamp,launch,stepBall,PITCH,GOAL_Z} from './physics.js?v=20-9n';
import {catmull,smooth,gauss,weldNormals,FACE_SHAPES,HAIR_STYLES,HEAD_Y,headPoint,uvOf,buildHead,buildEar,earMount,buildHairShell,buildCurls,buildBun,paintFace,paintHair,buildEye,buildEyeRim,animateEyes} from './heads.js?v=20-9n';
export {FACE_SHAPES,HAIR_STYLES,headPoint,uvOf};
// Drawn ball: 0.15 m radius (players looked like they kicked a beach ball). The physics keeps R=0.22,
// so goal-line, post and goalkeeper contacts are exactly as before.
export const BALL_VISUAL=.15;
export function shirtInk(color){const c=new T.Color(color);return .2126*c.r+.7152*c.g+.0722*c.b>.35?'#10232b':'#ffffff';}
// Lot 5 · A real football: 12 pentagons and 20 hexagons (Voronoi cells of the icosahedron's vertices and faces)
// with dark stitched seams, painted on an equirectangular map.
function ballTexture(){const c=document.createElement('canvas');if(!c.getContext||typeof c.getContext('2d')?.createImageData!=='function')return null;c.width=512;c.height=256;const g=c.getContext('2d'),img=g.createImageData(512,256),d=img.data,ph=(1+Math.sqrt(5))/2,V=[];
 for(const a of [-1,1])for(const b of [-1,1])V.push([0,a,b*ph],[a,b*ph,0],[b*ph,0,a]);const n=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);},sites=V.map(v=>({p:n(v),pent:true}));
 for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)for(let k=j+1;k<12;k++){const e=(a,b)=>Math.hypot(V[a][0]-V[b][0],V[a][1]-V[b][1],V[a][2]-V[b][2]);if(Math.abs(e(i,j)-2)<.01&&Math.abs(e(j,k)-2)<.01&&Math.abs(e(i,k)-2)<.01)sites.push({p:n([0,1,2].map(q=>V[i][q]+V[j][q]+V[k][q])),pent:false});}
 for(let y=0;y<256;y++)for(let x=0;x<512;x++){const th=y/256*Math.PI,phi=x/512*Math.PI*2,v=[-Math.cos(phi)*Math.sin(th),Math.cos(th),Math.sin(phi)*Math.sin(th)];let b1=-2,b2=-2,s1=null;for(const s of sites){const dot=s.p[0]*v[0]+s.p[1]*v[1]+s.p[2]*v[2];if(dot>b1){b2=b1;b1=dot;s1=s;}else if(dot>b2)b2=dot;}
  const seam=b1-b2<.012,col=seam?[60,64,70]:s1.pent?[24,30,44]:[246,247,244],k=(y*512+x)*4;d[k]=col[0];d[k+1]=col[1];d[k+2]=col[2];d[k+3]=255;}
 g.putImageData(img,0,0);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
// Lot 5 · Athletic bodies. Every limb is a tube whose width and depth follow a smooth profile (Catmull-Rom through
// a few keys) with a superellipse cross-section, plus muscle bulges at the front or back: V-shaped torso, chest and
// shoulder blades, quads, calves, biceps and forearms. Geometries are shared between players.
// ===== Lot 6 · One continuous skinned body =====
// Skin, shirt, shorts, socks and gloves are lofted surfaces (superellipse sections along a spine) merged into ONE
// SkinnedMesh and bound to nine bones, so shoulders, elbows, hips and knees bend smoothly with no seams or stubs.
// Coordinates are in the player's rest pose (metres, y up, front = -z). Bone order:
// 0 spine · 1-2 hips (L,R) · 3-4 knees · 5-6 shoulders · 7-8 elbows. Side -1 = x < 0 = index 0.
const top4=w=>{const s=w.filter(q=>q[1]>1e-4).sort((p,q)=>q[1]-p[1]).slice(0,4);let t=0;for(const q of s)t+=q[1];const o=[[0,0],[0,0],[0,0],[0,0]];s.forEach((q,i)=>{o[i]=[q[0],q[1]/t];});return o;};
const SHX=.19,SHY=.5,HIPX=.094,HIPY=-.04;
const spineW=()=>[[0,1]];
const legW=side=>{const k=side>0?1:0;return (x,y)=>{const wk=smooth(.4,.54,-y);return [[1+k,1-wk],[3+k,wk]];};};
const shortW=side=>{const k=side>0?1:0;return (x,y)=>{const ws=1-smooth(0,.1,HIPY-y);return [[0,ws],[1+k,1-ws]];};};
const armW=side=>{const k=side>0?1:0;return (x,y)=>{const we=1-smooth(.12,.28,y);return [[5+k,1-we],[7+k,we]];};};
const shoW=side=>()=>[[5+(side>0?1:0),1]];
const elbW=side=>()=>[[7+(side>0?1:0),1]];
const kneeW=side=>()=>[[3+(side>0?1:0),1]];
function loft(o){const seg=o.seg||24,e=2/(o.n||2.2),sub=o.sub||3,kA=o.A,kB=o.B||o.A.map(([y,a])=>[y,a*1.04]),cx=o.cx||0,ys=[];
 for(let i=0;i<kA.length-1;i++)for(let k=0;k<sub;k++)ys.push(kA[i][0]+(kA[i+1][0]-kA[i][0])*k/sub);ys.push(kA[kA.length-1][0]);
 const y0=ys[0],y1=ys[ys.length-1],pos=[],uv=[],si=[],sw=[],idx=[];
 for(let r=0;r<ys.length;r++){const y=ys[r],a=catmull(kA,y),b=catmull(kB,y),zc=o.Z?catmull(o.Z,y):0;
  for(let j=0;j<=seg;j++){const th=j/seg*Math.PI*2,sx=Math.sin(th),cz=Math.cos(th),fr=cz<0&&o.front?o.front(y,sx)*Math.pow(-cz,1.5):0,bk=cz>0&&o.back?o.back(y,sx)*Math.pow(cz,1.5):0;
   const x=cx+Math.sign(sx)*Math.pow(Math.abs(sx),e)*a,z=zc+Math.sign(cz)*Math.pow(Math.abs(cz),e)*(b+fr+bk);pos.push(x,y,z);
   const t=(y-y0)/(y1-y0),[u,v]=o.uv?o.uv(j/seg,t,y):[j/seg,t];uv.push(u,v);
   if(o.weights){const w=top4(o.weights(x,y,z));for(const q of w){si.push(q[0]);sw.push(q[1]);}}}}
 for(let r=0;r<ys.length-1;r++)for(let j=0;j<seg;j++){const a=r*(seg+1)+j,b=a+1,c=a+seg+1,d=c+1;idx.push(a,b,c,b,d,c);}
 return {pos,uv,si,sw,idx,mat:o.mat};}
// A tube following a polyline (fingers, thumb): parallel-transport frames, radius per point, closed at the tip.
function pathTube(points,radii,mat,weights,seg=7){const pos=[],idx=[],si=[],sw=[],uv=[],n=points.length,sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],nrm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const Tn=points.map((p,i)=>nrm(sub(points[Math.min(n-1,i+1)],points[Math.max(0,i-1)])));let N=nrm(cross(Tn[0],Math.abs(Tn[0][2])<.9?[0,0,1]:[1,0,0]));N=nrm(cross(N,Tn[0]));
 for(let i=0;i<n;i++){const T3=Tn[i];N=nrm(sub(N,T3.map(x=>x*dot(N,T3))));const B=cross(T3,N);for(let j=0;j<=seg;j++){const ph=j/seg*Math.PI*2,c=Math.cos(ph),s=Math.sin(ph),r=radii[i];const x=points[i][0]+(N[0]*c+B[0]*s)*r,y=points[i][1]+(N[1]*c+B[1]*s)*r,z=points[i][2]+(N[2]*c+B[2]*s)*r;pos.push(x,y,z);uv.push(.12,.5);const w=top4(weights(x,y,z));for(const q of w){si.push(q[0]);sw.push(q[1]);}}}
 for(let i=0;i<n-1;i++)for(let j=0;j<seg;j++){const a=i*(seg+1)+j,b=a+1,c=a+seg+1,d=c+1;idx.push(a,b,c,b,d,c);}
 return {pos,uv,si,sw,idx,mat};}
function mergeParts(parts,skinned){const order=parts.slice().sort((a,b)=>a.mat-b.mat),pos=[],nor=[],uv=[],si=[],sw=[],idx=[],groups=[];let base=0,gStart=0,gMat=order[0].mat;
 for(const p of order){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.pos,3));g.setIndex(p.idx);g.computeVertexNormals();weldNormals(g);const nn=g.attributes.normal.array;
  if(p.mat!==gMat){groups.push([gStart,idx.length-gStart,gMat]);gStart=idx.length;gMat=p.mat;}
  for(let i=0;i<p.pos.length;i++){pos.push(p.pos[i]);nor.push(nn[i]);}for(const v of p.uv)uv.push(v);if(skinned){for(const v of p.si)si.push(v);for(const v of p.sw)sw.push(v);}
  for(const i of p.idx)idx.push(i+base);base+=p.pos.length/3;g.dispose();}
 groups.push([gStart,idx.length-gStart,gMat]);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(nor,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 if(skinned){geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));}
 geo.setIndex(base>65535?new T.Uint32BufferAttribute(idx,1):new T.Uint16BufferAttribute(idx,1));for(const [s,c,m] of groups)geo.addGroup(s,c,m);geo.computeBoundingSphere();geo.computeBoundingBox();return geo;}
// Materials: 0 skin · 1 shirt · 2 shorts · 3 socks · 4 trim · 5 gloves
function buildBody(keeper){const P=[],ser=(arr,f)=>arr.map(([y,a])=>[y,a*f]);
 // Torso (shirt): V-shaped, squared shoulders, chest and shoulder blades. Texture u=.5 is the front.
 const torsoA=[[-.1,.2],[-.03,.19],[.05,.178],[.14,.172],[.27,.18],[.38,.19],[.45,.2],[.5,.214],[.52,.21],[.535,.202],[.55,.188],[.565,.148],[.577,.105],[.588,.07]],torsoB=[[-.1,.13],[0,.116],[.1,.104],[.27,.108],[.38,.116],[.45,.112],[.5,.104],[.54,.092],[.565,.08],[.58,.068],[.588,.06]];
 P.push(loft({A:torsoA,B:torsoB,seg:32,sub:3,n:2.2,mat:1,weights:spineW,front:(y,sx)=>.012*gauss(y,.38,.07)*(1-.5*gauss(sx,0,.25)),back:(y,sx)=>.008*gauss(y,.43,.07)+.028*smooth(.47,.585,y)}));
 // Neck and collar
 P.push(loft({A:[[.5,.056],[.6,.052],[.7,.048]],B:[[.5,.062],[.6,.054],[.7,.046]],Z:[[.5,.036],[.7,-.004]],seg:20,mat:0,weights:spineW}));
 P.push(loft({A:[[.565,.06],[.575,.064],[.59,.064],[.605,.058],[.612,.054]],B:[[.565,.058],[.575,.062],[.59,.062],[.605,.056],[.612,.052]],Z:[[.56,.028],[.61,.025]],seg:24,sub:2,mat:4,weights:spineW}));
 // Pelvis and shorts
 P.push(loft({A:[[-.16,.165],[-.08,.172],[0,.16],[.03,.148]],B:[[-.16,.098],[-.08,.108],[0,.1],[.03,.092]],seg:28,sub:2,mat:2,weights:spineW}));
 for(const side of [-1,1]){const k=side>0?1:0,cx=side*HIPX,u=side>0?0:.5;
  // shorts leg (hem 22 cm below the hip) and the bare leg inside it
  P.push(loft({A:[[-.26,.103],[-.15,.098],[-.1,.094],[-.05,.088],[.02,.078]],B:[[-.26,.106],[-.15,.102],[-.1,.1],[-.05,.096],[.02,.09]],cx,seg:24,sub:3,mat:2,weights:shortW(side),uv:(uu,t)=>[(uu+u)%1,t]}));
  const legA=[[-.9,.032],[-.82,.036],[-.72,.047],[-.62,.057],[-.55,.056],[-.47,.052],[-.38,.062],[-.25,.078],[-.1,.086],[.02,.082]];
  P.push(loft({A:legA,B:legA.map(([y,a])=>[y,a*1.04]),cx,seg:22,sub:3,mat:0,weights:legW(side),back:y=>.012*gauss(y,-.62,.08),front:y=>.006*gauss(y,-.3,.1)}));
  // sock up to just below the knee, with a trim band at the top
  const sockA=[[-.93,.037],[-.85,.04],[-.72,.051],[-.62,.061],[-.55,.06],[-.5,.057]];
  P.push(loft({A:sockA,B:sockA.map(([y,a])=>[y,a*1.03]),cx,seg:22,sub:3,mat:3,weights:kneeW(side),back:y=>.012*gauss(y,-.62,.08)}));
  P.push(loft({A:[[-.52,.0585],[-.495,.0585]],B:[[-.52,.0605],[-.495,.0605]],cx,seg:22,sub:1,mat:4,weights:kneeW(side)}));
  // Arm: shoulder → elbow → wrist, skin; sleeve over it (short, or long for the keeper).
  const armA=[[-.075,.025],[-.0,.03],[.06,.036],[.14,.04],[.2,.036],[.3,.043],[.4,.047],[.47,.047]],armB=[[-.075,.027],[0,.031],[.06,.037],[.14,.041],[.2,.038],[.3,.046],[.4,.05],[.47,.05]],ax=side*SHX;
  P.push(loft({A:armA,B:armB,cx:ax,seg:20,sub:3,mat:0,weights:armW(side),front:y=>.007*gauss(y,.36,.07)}));
  if(keeper){const sA=[[-.07,.036],[0,.038],[.1,.044],[.2,.046],[.3,.052],[.4,.058],[.5,.06],[.53,.045],[.545,.02],[.55,.004]];P.push(loft({A:sA,B:sA.map(([y,a])=>[y,a*.97]),cx:ax,seg:22,sub:3,mat:1,weights:armW(side),uv:(uu,t)=>[.12,.5]}));}
  else{const sA=[[.335,.059],[.34,.059],[.4,.062],[.45,.065],[.5,.067],[.52,.063],[.535,.054],[.547,.036],[.555,.016],[.559,.004]];P.push(loft({A:sA,B:sA.map(([y,a])=>[y,a*(y<.4?1:1+.3*Math.min(1,(y-.4)/.1))]),cx:ax,seg:22,sub:3,n:2.4,mat:1,weights:shoW(side),uv:()=>[.12,.5]}));
   P.push(loft({A:[[.31,.0605],[.337,.0605]],B:[[.31,.0585],[.337,.0585]],cx:ax,seg:22,sub:1,mat:4,weights:shoW(side)}));}
  // Hand: flat palm facing the thigh, four curled fingers and a thumb. Gloves for the keeper are bigger.
  const m=keeper?5:0,sc=keeper?1.3:1,dx=-side;
  P.push(loft({A:[[-.19,.011*sc],[-.18,.014*sc],[-.15,.016*sc],[-.1,.019*sc],[-.07,.025]],B:[[-.19,.022*sc],[-.18,.036*sc],[-.15,.04*sc],[-.1,.034*sc],[-.07,.027]],cx:ax,seg:18,sub:3,mat:m,weights:elbW(side),uv:()=>[.12,.5]}));
  const fz=[-.027,-.009,.009,.027],fl=[.07,.079,.075,.06],fr=[.0092,.0095,.009,.0078];
  for(let i=0;i<4;i++){const L=fl[i]*sc,p0=[ax+dx*.003,-.183,fz[i]*sc];const pts=[p0],ang=[.22,.62,1.05],len=[.4,.35,.25];let q=p0;for(let s=0;s<3;s++){q=[q[0]+dx*Math.sin(ang[s])*L*len[s],q[1]-Math.cos(ang[s])*L*len[s],q[2]];pts.push(q);}
   P.push(pathTube(pts,[fr[i]*sc,fr[i]*.92*sc,fr[i]*.85*sc,fr[i]*.6*sc],m,elbW(side)));}
  P.push(pathTube([[ax+dx*.004,-.1,-.036*sc],[ax+dx*.012,-.128,-.047*sc],[ax+dx*.017,-.15,-.047*sc],[ax+dx*.019,-.167,-.042*sc]],[.0115*sc,.01*sc,.0088*sc,.0065*sc],m,elbW(side)));
 }
 return mergeParts(P,true);}
// Football boot: sculpted upper, sole plate flush underneath, six studs. Origin at the ankle; the sole bottom is
// 10 cm below it, which is exactly the foot height the walk cycle plants on the grass. Materials: 0 upper · 1 sole · 2 studs.
function buildBoot(){const P=[],M=16,ST=[[-.23,0,.004],[-.21,.026,.026],[-.17,.041,.036],[-.11,.049,.04],[-.06,.047,.052],[-.02,.042,.06],[.01,.04,.066],[.035,.035,.066],[.055,.026,.05],[.062,0,0]];
 const ring=(rows,f,mat)=>{const pos=[],uv=[],idx=[];rows.forEach(([z,w,h],r)=>{for(let j=0;j<=M;j++){const th=j/M*Math.PI*2,[x,y]=f(th,w,h);pos.push(x,y,z);uv.push(j/M,r/(rows.length-1));}});for(let r=0;r<rows.length-1;r++)for(let j=0;j<M;j++){const a=r*(M+1)+j,b=a+1,c=a+M+1,d=c+1;idx.push(a,b,c,b,d,c);}return {pos,uv,idx,mat};};
 P.push(ring(ST,(th,w,h)=>{const s=Math.sin(th);return [Math.cos(th)*w,-.07+(s>0?Math.pow(s,.8)*h:s*.006)];},0));
 P.push(ring([[-.236,.005],[-.215,.026],[-.17,.044],[-.11,.053],[-.06,.051],[-.02,.046],[.01,.043],[.035,.039],[.055,.03],[.068,.005]].map(([z,w])=>[z,w,0]),(th,w)=>{const c=Math.cos(th),s=Math.sin(th);return [Math.sign(c)*Math.pow(Math.abs(c),.4)*w,-.079+Math.sign(s)*Math.pow(Math.abs(s),.4)*.009];},1));
 for(const [x,z] of [[-.025,-.18],[.025,-.18],[-.027,-.1],[.027,-.1],[-.02,.04],[.02,.04]]){const c=new T.CylinderGeometry(.006,.009,.014,6),pa=c.attributes.position,pos=[],uv=[];for(let i=0;i<pa.count;i++)pos.push(pa.getX(i)+x,pa.getY(i)-.095,pa.getZ(i)+z),uv.push(0,0);P.push({pos,uv,idx:Array.from(c.index.array),mat:2});c.dispose();}
 return mergeParts(P,false);}
export class Pitch3D{
constructor(canvas,appearance){this.canvas=canvas;this.appearance=appearance;this.scene=new T.Scene();this.scene.background=new T.Color('#7fb6e6');this.scene.fog=new T.Fog('#a9cbe6',120,300);this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;/* Lot 5 · DLS-like look: filmic tone mapping, bright sun, soft shadows */this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.92;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.camera=new T.PerspectiveCamera(48,1,.1,320);this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.scene.add(new T.HemisphereLight(0xdcefff,0x3f6b2e,1.75));const sun=new T.DirectionalLight(0xfff0d6,3.1);sun.position.set(-22,40,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.radius=3;this.sun=sun;sun.shadow.camera.left=-40;sun.shadow.camera.right=40;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.normalBias=.04;this.scene.add(sun);this.staticWorld();this.ball=new T.Mesh(new T.SphereGeometry(BALL_VISUAL,32,20),new T.MeshStandardMaterial({map:ballTexture(),color:0xffffff,roughness:.35}));this.ball.castShadow=true;this.scene.add(this.ball);this.shadow=new T.Mesh(new T.CircleGeometry(.3,20),new T.MeshBasicMaterial({color:0x10271b,transparent:true,opacity:.36,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=.025;this.scene.add(this.shadow);this.players=[];this.aim=new T.Line(new T.BufferGeometry(),new T.LineDashedMaterial({color:0xd3f96a,dashSize:.35,gapSize:.25}));this.scene.add(this.aim);this.aim.visible=false;this.targetRing=new T.Mesh(new T.RingGeometry(.27,.36,32),new T.MeshBasicMaterial({color:0xd3f96a,side:T.DoubleSide,depthTest:false}));this.targetRing.renderOrder=5;this.scene.add(this.targetRing);this.targetRing.visible=false;this.resize();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);}
mesh(geo,color){return new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.85}));}
box(x,y,z,w,h,d,color){const m=this.mesh(new T.BoxGeometry(w,h,d),color);m.position.set(x,y,z);m.receiveShadow=true;this.scene.add(m);return m;}
line(points,color=0xe2eac9){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const l=new T.Line(g,new T.LineBasicMaterial({color,transparent:true,opacity:.85}));this.scene.add(l);return l;}
// V19 · Full pitch at real size (105 × 68 m): both goals and every line, advertising boards, four stands
// standing outside the field, a roof behind the attacked goal, floodlights and the town around.
staticWorld(){const W=PITCH.W,F=PITCH.far,mid=(F+GOAL_Z)/2,L=F-GOAL_Z,y=.035;
 this.box(0,-.18,mid,W*2+34,.3,L+44,0x3b6236);this.buildSky();this.buildGrass();this.paintStrokes=[];const line0=this.line;this.line=pts=>this.paintStrokes.push(pts);
 const arc=(cx,cz,r,a0,a1,n=64,sz=1)=>{const p=[];for(let i=0;i<=n;i++){const t=a0+(a1-a0)*i/n;p.push([cx+Math.cos(t)*r,y,cz+sz*Math.sin(t)*r]);}this.line(p);};
 this.line([[-W,y,GOAL_Z],[W,y,GOAL_Z],[W,y,F],[-W,y,F],[-W,y,GOAL_Z]]);this.line([[-W,y,mid],[W,y,mid]]);arc(0,mid,9.15,0,Math.PI*2,96);arc(0,mid,.16,0,Math.PI*2,12);
 for(const g of [GOAL_Z,F]){const s=g<mid?1:-1;
  this.line([[-20.16,y,g],[-20.16,y,g+s*16.5],[20.16,y,g+s*16.5],[20.16,y,g]]);this.line([[-9.16,y,g],[-9.16,y,g+s*5.5],[9.16,y,g+s*5.5],[9.16,y,g]]);
  arc(0,g+s*11,.16,0,Math.PI*2,12);const a=Math.asin(5.5/9.15);arc(0,g+s*11,9.15,a,Math.PI-a,40,s);
  for(const x of [-W,W])arc(x,g,1,x<0?(s>0?0:-Math.PI/2):(s>0?Math.PI/2:Math.PI),x<0?(s>0?Math.PI/2:0):(s>0?Math.PI:Math.PI*1.5),10);
  this.goal(g,-s);}
 this.line=line0;this.paintLines();this.adBoards();this.buildCrowd();this.buildStadium();this.buildCity();}
// Lot 5 · Sky dome: deep blue overhead fading to a pale haze on the horizon (unaffected by fog).
buildSky(){const c=document.createElement('canvas');let mat;if(c.getContext&&c.getContext('2d')?.createLinearGradient){c.width=4;c.height=256;const g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,'#2f6fc4');gr.addColorStop(.38,'#6aa8e6');gr.addColorStop(.5,'#cfe4f2');gr.addColorStop(1,'#cfe4f2');g.fillStyle=gr;g.fillRect(0,0,4,256);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;mat=new T.MeshBasicMaterial({map:t,side:T.BackSide,fog:false,depthWrite:false,toneMapped:false});}else mat=new T.MeshBasicMaterial({color:0x7fb6e6,side:T.BackSide,fog:false});this.sky=new T.Mesh(new T.SphereGeometry(290,24,16),mat);this.sky.position.z=(GOAL_Z+PITCH.far)/2;this.sky.renderOrder=-1;this.scene.add(this.sky);}
// Lot 5 · Pitch markings as painted 12 cm ribbons (one mesh), not hairline 1-pixel lines.
paintLines(){const pos=[],w=.06;for(const pts of this.paintStrokes){for(let i=0;i<pts.length-1;i++){const [x0,,z0]=pts[i],[x1,,z1]=pts[i+1],dx=x1-x0,dz=z1-z0,l=Math.hypot(dx,dz)||1,nx=-dz/l*w,nz=dx/l*w,ex=dx/l*w*.5,ez=dz/l*w*.5,a=[x0-nx-ex,z0-nz-ez],b=[x0+nx-ex,z0+nz-ez],c2=[x1+nx+ex,z1+nz+ez],d=[x1-nx+ex,z1-nz+ez];for(const [px,pz] of [a,c2,b,a,d,c2])pos.push(px,.012,pz);}}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.computeVertexNormals();const m=new T.Mesh(geo,new T.MeshStandardMaterial({color:0xf4f7f0,roughness:.8,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide}));m.receiveShadow=true;m.name='Lignes';this.scene.add(m);this.paintStrokes=null;}
// A goal frame with its net; dir is the side the net extends to.
goal(z,dir){/* Lot 5 · round white posts and a real net (see-through mesh) */const post=new T.MeshStandardMaterial({color:0xffffff,roughness:.35,metalness:.1});for(const x of [-3.66,3.66]){const m=new T.Mesh(new T.CylinderGeometry(.06,.06,2.44,16),post);m.position.set(x,1.22,z);m.castShadow=true;this.scene.add(m);}{const bar=new T.Mesh(new T.CylinderGeometry(.06,.06,7.44,16),post);bar.rotation.z=Math.PI/2;bar.position.set(0,2.44,z);bar.castShadow=true;this.scene.add(bar);}this.goalNet(z,dir);const pts=[],back=z+dir*2;
 for(let x=-3.66;x<=3.7;x+=.3)pts.push(new T.Vector3(x,0,back),new T.Vector3(x,2.44,back),new T.Vector3(x,2.44,back),new T.Vector3(x,2.44,z));
 for(let h=0;h<=2.44;h+=.3){pts.push(new T.Vector3(-3.66,h,back),new T.Vector3(3.66,h,back));for(const x of [-3.66,3.66])pts.push(new T.Vector3(x,h,back),new T.Vector3(x,h,z));}
}
goalNet(z,dir){/* Lot 5 · Dynamic net: a grid of nodes joined by springs. The ball pushes it out of its way and the ripple spreads. */
 const nodes=[],edges=[],tris=[],step=.24,panels=[];const add=(x,y,zz)=>{nodes.push({bx:x,by:y,bz:zz,ox:0,oy:0,oz:0,vx:0,vy:0,vz:0,nb:[]});return nodes.length-1;};
 const panel=(w,h,pos)=>{const nx=Math.max(1,Math.round(w/step)),ny=Math.max(1,Math.round(h/step)),id=[];for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const [x,y,zz]=pos(i/nx,j/ny);id.push(add(x,y,zz));}
  const at=(i,j)=>id[j*(nx+1)+i];for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const n=nodes[at(i,j)];if(i<nx){edges.push(at(i,j),at(i+1,j));n.nb.push(at(i+1,j));nodes[at(i+1,j)].nb.push(at(i,j));}if(j<ny){edges.push(at(i,j),at(i,j+1));n.nb.push(at(i,j+1));nodes[at(i,j+1)].nb.push(at(i,j));}if(i<nx&&j<ny)tris.push(at(i,j),at(i+1,j),at(i,j+1),at(i+1,j),at(i+1,j+1),at(i,j+1));}};
 const back=z+dir*2,front=z;
 panel(7.32,2.44,(u,v)=>[-3.66+u*7.32,v*2.44,back]);
 panel(7.32,2,(u,v)=>[-3.66+u*7.32,2.44,front+dir*2*v]);
 for(const x of [-3.66,3.66])panel(2,2.44,(u,v)=>[x,v*2.44,front+dir*2*u]);
 const pos=new Float32Array(nodes.length*3);nodes.forEach((n,i)=>{pos[i*3]=n.bx;pos[i*3+1]=n.by;pos[i*3+2]=n.bz;});const attr=new T.BufferAttribute(pos,3);
 const lg=new T.BufferGeometry();lg.setAttribute('position',attr);lg.setIndex(edges);const mg=new T.BufferGeometry();mg.setAttribute('position',attr);mg.setIndex(tris);
 const group=new T.Group();group.name='Filet';group.add(new T.LineSegments(lg,new T.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.8})));const sheet=new T.Mesh(mg,new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.1,side:T.DoubleSide,depthWrite:false}));sheet.frustumCulled=false;group.add(sheet);group.children[0].frustumCulled=false;this.scene.add(group);
 (this.nets=this.nets||[]).push({nodes,attr,z,dir,hot:0});}
// Called every frame: pushes the net nodes out of the ball, then springs and ripples bring them back.
updateNets(dt){if(!this.nets||!this.ball)return;dt=Math.min(dt||.016,.033);const b=this.ball.position;for(const net of this.nets){const {nodes,attr,z,dir}=net,pv=net.prev,vx=pv?(b.x-pv.x)/dt:0,vy=pv?(b.y-pv.y)/dt:0,vz=pv?(b.z-pv.z)/dt:0,sp=Math.hypot(vx,vy,vz);net.prev={x:b.x,y:b.y,z:b.z};const inside=Math.abs(b.x)<4.1&&b.y<2.8&&(b.z-z)*dir>-.4&&(b.z-z)*dir<2.6;if(!inside&&net.hot<=0)continue;let energy=0;
  for(const n of nodes){if(inside){const px=n.bx+n.ox-b.x,py=n.by+n.oy-b.y,pz=n.bz+n.oz-b.z,d=Math.hypot(px,py,pz)||1e-6,r=.3;if(d<r){const k=(r-d)/d;n.ox+=px*k;n.oy+=py*k;n.oz+=pz*k;n.vx=n.vy=n.vz=0;}else if(d<1&&sp>2&&sp<60){const f=(1-d)*.12;n.vx+=vx*f;n.vy+=vy*f;n.vz+=vz*f;}}
   n.ax=-60*n.ox;n.ay=-60*n.oy;n.az=-60*n.oz;for(const j of n.nb){const m=nodes[j];n.ax+=40*(m.ox-n.ox);n.ay+=40*(m.oy-n.oy);n.az+=40*(m.oz-n.oz);}}
  for(const n of nodes){n.vx=(n.vx+n.ax*dt)*.965;n.vy=(n.vy+n.ay*dt)*.965;n.vz=(n.vz+n.az*dt)*.965;n.ox+=n.vx*dt;n.oy+=n.vy*dt;n.oz+=n.vz*dt;energy+=Math.abs(n.ox)+Math.abs(n.oy)+Math.abs(n.oz)+Math.abs(n.vx)*.02+Math.abs(n.vy)*.02+Math.abs(n.vz)*.02;}
  nodes.forEach((n,i)=>attr.setXYZ(i,n.bx+n.ox,n.by+n.oy,n.bz+n.oz));attr.needsUpdate=true;net.hot=energy>.05?1:0;}}
// Advertising boards around the field: the ball rebounds on them (physics.stadiumBounds).
adBoards(){const c=document.createElement('canvas');let mat=new T.MeshStandardMaterial({color:0x173a33,roughness:.7});if(c.getContext){c.width=1024;c.height=64;const g=c.getContext('2d');const ads=['AC RIVAGE','NEXT NINE','STADE RIVAGE','LE TERRAIN T’APPARTIENT'];for(let i=0;i<4;i++){g.fillStyle=i%2?'#183f3a':'#d3f96a';g.fillRect?.(i*256,0,256,64);g.fillStyle=i%2?'#d3f96a':'#183f3a';g.font='bold 30px sans-serif';g.textAlign='center';g.fillText(ads[i],i*256+128,43,240);}const t=new T.CanvasTexture(c);t.wrapS=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;mat=new T.MeshStandardMaterial({map:t,roughness:.6});}
 const B=PITCH.board,F=PITCH.far,group=new T.Group();group.name='Panneaux';this.scene.add(group);const board=(x,z,len,alongX)=>{const m=new T.Mesh(new T.BoxGeometry(alongX?len:.18,.9,alongX?.18:len),mat.clone());if(m.material.map){m.material.map=m.material.map.clone();m.material.map.needsUpdate=true;m.material.map.repeat.set(len/16,1);}m.position.set(x,.45,z);m.receiveShadow=true;group.add(m);};
 for(const x of [-B,B])board(x,(GOAL_Z+F)/2,F-GOAL_Z+6,false);for(const z of [GOAL_Z-3.5,F+3.5]){board(-21,z,26,true);board(21,z,26,true);}
 for(const z of [26,39])this.box(-(B+1.8),1,z,1.6,2,9,0x1d3f45);}
// Pitch texture: mowing stripes every 5.25 m, blade noise and worn goalmouths and centre circle.
buildGrass(){const c=document.createElement('canvas');if(!c.getContext)return;c.width=1024;c.height=2048;const g=c.getContext('2d'),W=PITCH.W,F=PITCH.far,L=F-GOAL_Z;
 for(let i=0;i<20;i++){const gr=g.createLinearGradient?.(0,0,1024,0);if(gr?.addColorStop){gr.addColorStop(0,i%2?'#3d7a33':'#33702d');gr.addColorStop(.5,i%2?'#45853a':'#3a7933');gr.addColorStop(1,i%2?'#3d7a33':'#33702d');g.fillStyle=gr;}else g.fillStyle=i%2?'#45853a':'#3a7933';g.fillRect(0,i*2048/20,1024,2048/20+1);}/* Lot 5 · vivid, sunlit mowing stripes */
 const img=g.getImageData(0,0,1024,2048),d=img.data;let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let k=0;k<d.length;k+=4){const n=(rnd()-.5)*18;d[k]+=n*.5;d[k+1]+=n;d[k+2]+=n*.4;}g.putImageData(img,0,0);
 for(let i=0;i<14000;i++){const x=rnd()*1024,y=rnd()*2048;g.strokeStyle=rnd()<.5?'rgba(150,200,100,.3)':'rgba(30,80,30,.3)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*2,y-2-rnd()*4);g.stroke();}
 for(const [x,v,r] of [[512,6/L,70],[512,1-6/L,70],[512,.5,60]]){const y=v*2048,gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(120,110,60,.14)');gr.addColorStop(1,'rgba(120,110,60,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r);}
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=this.renderer?.capabilities?.getMaxAnisotropy?.()||8;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;
 const pitch=new T.Mesh(new T.PlaneGeometry(W*2+4,L+4),new T.MeshStandardMaterial({map:tex,roughness:.88}));pitch.rotation.x=-Math.PI/2;pitch.position.set(0,-.001,(F+GOAL_Z)/2);pitch.receiveShadow=true;this.scene.add(pitch);}
// Stand geometry shared by the stadium and the crowd: rows rising away from the field.
standRows(){const B=PITCH.board,F=PITCH.far,rows=[];for(let r=0;r<10;r++){const base=.6+r*.55,off=2.4+r*.9;
  rows.push({side:'near',r,base,z:GOAL_Z-3.5-off,x0:-34,x1:34},{side:'far',r,base,z:F+3.5+off,x0:-34,x1:34},{side:'left',r,base,x:-B-off,z0:GOAL_Z-1,z1:F+1},{side:'right',r,base,x:B+off,z0:GOAL_Z-1,z1:F+1});}return rows;}
buildStadium(){const group=new T.Group();group.name='Stade Rivage';this.scene.add(group);const part=(x,y,z,w,h,d,c)=>{const m=this.box(x,y,z,w,h,d,c);this.scene.remove(m);group.add(m);return m;};
 for(const row of this.standRows()){/* Lot 5 · club-blue seats, with an away section in one corner */const c=row.side==='left'&&row.r>2&&row.r<7?(row.r%2?0xb8443a:0xc9554a):row.r%2?0x1f6aa0:0x2a7dba;if(row.x0!=null)part(0,row.base/2,row.z,row.x1-row.x0,row.base,.92,c);else part(row.x,row.base/2,(row.z0+row.z1)/2,.92,row.base,row.z1-row.z0,c);}
 const B=PITCH.board,F=PITCH.far,back=GOAL_Z-3.5-2.4-9.4;
 // Back walls close each stand so the ball and the camera never see through.
 part(0,4,back,72,8,.4,0x2d4048);part(0,4,F+3.5+2.4+9.4,72,8,.4,0x2d4048);for(const x of [-1,1])part(x*(B+2.4+9.4),4,(GOAL_Z+F)/2,.4,8,F-GOAL_Z+2,0x2d4048);
 // Corner stands join the four sides.
 for(const sx of [-1,1])for(const end of [-1,1]){const z=end<0?GOAL_Z-7:F+7;for(let row=0;row<4;row++){const m=part(sx*(B+3.5+row*1.6),1+row*1.1,z+end*row*1.6,9,2+row*2.2,1.6,row%2?0x536773:0x354d59);m.rotation.y=sx*end*Math.PI/4;m.name='Tribune d’angle';}}
 // Covered home stand behind the attacked goal, with the club sign under the roof.
 part(0,9,back+4.6,74,.3,10,0x173f40);for(const x of [-30,-10,10,30])part(x,4.5,back+.6,.3,9,.3,0x263f42);
 const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#153f40';ctx.fillRect?.(0,0,1024,128);ctx.fillStyle='#d3f96a';ctx.font='bold 62px sans-serif';ctx.textAlign='center';ctx.fillText('AC RIVAGE • LE TERRAIN T’APPARTIENT',512,85);const sign=new T.Mesh(new T.PlaneGeometry(40,2),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),side:T.DoubleSide}));sign.position.set(0,8,back+9.4);group.add(sign);
 // Floodlights at the four corners.
 for(const [x,z] of [[-B-14,GOAL_Z-18],[B+14,GOAL_Z-18],[-B-14,F+18],[B+14,F+18]]){part(x,14,z,.6,28,.6,0x55646a);part(x,28.4,z,4.4,2,.5,0xf3f0dc).rotation.y=Math.atan2(-x,-(z-(GOAL_Z+F)/2));}
 // Lot 5 · cantilever roofs over the four stands: a sloping deck on slim supports, lit underneath.
 const roof=new T.MeshStandardMaterial({color:0xe6ebee,roughness:.55,metalness:.2,side:T.DoubleSide}),steel=new T.MeshStandardMaterial({color:0x8b979c,roughness:.5,metalness:.4});
 const deck=(x,z,w,d,ry)=>{const m=new T.Mesh(new T.BoxGeometry(w,.25,d),roof);m.position.set(x,11.2,z);m.rotation.set(ry===0?.12*Math.sign(z-(GOAL_Z+F)/2):0,0,ry===0?0:-.12*Math.sign(x));m.castShadow=false;group.add(m);};
 deck(0,F+3.5+2.4+6,72,9,0);deck(0,back+5.5,74,9,0);for(const x of [-1,1]){deck(x*(B+2.4+6),(GOAL_Z+F)/2,9,F-GOAL_Z+2,1);for(let z=GOAL_Z+4;z<F;z+=14){const st=new T.Mesh(new T.CylinderGeometry(.18,.18,11,8),steel);st.position.set(x*(B+2.4+9.6),5.5,z);group.add(st);}}
 for(const x of [-30,-10,10,30]){const st=new T.Mesh(new T.CylinderGeometry(.18,.18,11,8),steel);st.position.set(x,5.5,F+3.5+2.4+9.6);group.add(st);}
 group.traverse(o=>{if(o.isMesh&&o.material?.color?.getHex?.()===0xf3f0dc){o.material=new T.MeshStandardMaterial({color:0xffffff,emissive:0xfff6d8,emissiveIntensity:1.6});}});
 this.stadium=group;}
buildCrowd(){const group=new T.Group();group.name='Public de test';this.scene.add(group);const fans=[],palette=[0x63b9f4,0xe8f3fa,0x2373a4,0x63b9f4,0x183e59,0xd3f96a,0x63b9f4,0xffffff];
 for(const row of this.standRows()){if(row.r<1||row.r>8)continue;const spacing=1.05,along=row.x0!=null;const a0=along?row.x0:row.z0,a1=along?row.x1:row.z1;
  for(let u=a0+.6+(row.r%2)*.5;u<a1-.4;u+=spacing){if(along&&Math.abs(u)<.7)continue;const k=fans.length;fans.push({x:along?u:row.x,z:along?row.z:u,base:row.base,phase:(row.r*7+k)*.71,colour:row.side==='left'&&row.r>2&&row.r<7?[0xd96955,0x2a2d33,0xffffff][k%3]:palette[(row.r*3+k*5)%8]});}}
 const inst=(geo,count)=>{const m=new T.InstancedMesh(geo,new T.MeshStandardMaterial({color:0xffffff,roughness:.9}),count);m.frustumCulled=false;group.add(m);return m;};
 const bodies=inst(new T.CylinderGeometry(.22,.18,.53,6),fans.length),heads=inst(new T.SphereGeometry(.17,8,6),fans.length),arms=inst(new T.CylinderGeometry(.055,.055,.42,5),fans.length*2),legs=inst(new T.CylinderGeometry(.075,.065,.5,5),fans.length*2);
 const dummy=new T.Object3D();
 fans.forEach((f,i)=>{bodies.setColorAt(i,new T.Color(f.colour));heads.setColorAt(i,new T.Color([0xe2b387,0xa77350,0x614837][i%3]));for(let side=0;side<2;side++){legs.setColorAt(i*2+side,new T.Color(0x22352e));arms.setColorAt(i*2+side,new T.Color(f.colour));}});
 const flags=[];for(const side of [-1,1]){const pole=this.box(side*24,2.6,GOAL_Z-5.4,.06,5.2,.06,0xdce4d0);this.scene.remove(pole);group.add(pole);const flag=new T.Mesh(new T.PlaneGeometry(1.6,.9),new T.MeshStandardMaterial({color:side<0?0x63b9f4:0xd3f96a,side:T.DoubleSide}));flag.position.set(side*23.2,4.7,GOAL_Z-5.4);group.add(flag);flags.push(flag);}
 this.crowd={group,fans,bodies,heads,arms,legs,dummy,flags};this.animateCrowd(0,false,true);}
// The crowd animates at 20 Hz: thousands of fans, kept light for phones.
animateCrowd(time,goal,force=false){const c=this.crowd;if(!c||!c.group.visible)return;if(!force&&Math.abs(time-(c.at??-9))<.05)return;c.at=time;const d=c.dummy;
 c.fans.forEach((f,i)=>{const excitement=goal?.6:.16,bob=Math.max(0,Math.sin(time*(goal?6:2)+f.phase))*(goal?.14:.025);d.position.set(f.x,f.base+.87+bob,f.z);d.rotation.set(0,0,0);d.updateMatrix();c.bodies.setMatrixAt(i,d.matrix);d.position.y=f.base+1.32+bob;d.updateMatrix();c.heads.setMatrixAt(i,d.matrix);
  for(let side=0;side<2;side++){const sign=side?1:-1;d.position.set(f.x+sign*.11,f.base+.3+bob,f.z);d.rotation.set(0,0,0);d.updateMatrix();c.legs.setMatrixAt(i*2+side,d.matrix);d.position.set(f.x+sign*.28,f.base+.96+bob,f.z);d.rotation.set(Math.sin(time*2+f.phase)*.18,0,sign*(i%4===0||goal?2.6+Math.sin(time*4+f.phase)*excitement:.2));d.updateMatrix();c.arms.setMatrixAt(i*2+side,d.matrix);}
 });c.heads.instanceMatrix.needsUpdate=true;c.bodies.instanceMatrix.needsUpdate=true;c.legs.instanceMatrix.needsUpdate=true;c.arms.instanceMatrix.needsUpdate=true;c.flags.forEach((f,i)=>f.rotation.y=Math.sin(time*2+i)*.25);}
// V19 · Neighbourhood around the ground: a two-way ring road with traffic lights and moving cars that stop on red,
// pavements and street lamps, a row of shops with awnings and signs, a car park, a playground, trees, and the town beyond.
buildCity(){const group=new T.Group();group.name='Ville autour du stade';this.scene.add(group);const mid=(GOAL_Z+PITCH.far)/2,RX=64,RZ0=GOAL_Z-34,RZ1=PITCH.far+34,W=9;
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.9}),add=(x,y,z,w,h,d,c,m)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m||mat(c));o.position.set(x,y,z);group.add(o);return o;};
 // Ground under the whole town: grass inside the ring, paved streets beyond.
 {const g=new T.Mesh(new T.PlaneGeometry(700,700),mat(0x7d8278));g.rotation.x=-Math.PI/2;g.position.set(0,-.06,mid);g.receiveShadow=true;g.name='Sol';group.add(g);const lawn=new T.Mesh(new T.PlaneGeometry(RX*2-W,RZ1-RZ0-W),mat(0x5f8a4f));lawn.rotation.x=-Math.PI/2;lawn.position.set(0,-.04,mid);group.add(lawn);}
 const label=(text,bg,fg,w=256,h=64)=>{const c=document.createElement('canvas');if(!c.getContext)return mat(bg);c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect?.(0,0,w,h);g.fillStyle=fg;g.font='bold 30px sans-serif';g.textAlign='center';g.fillText(text,w/2,h*.66,w-16);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return new T.MeshBasicMaterial({map:t});};
 // Ring road: asphalt, dashed centre line, pavements.
 const roadMat=mat(0x3a3f44),lineMat=new T.MeshBasicMaterial({color:0xe8e4d0}),walk=mat(0x9b9a92);
 for(const x of [-RX,RX]){add(x,.02,mid,W,.04,RZ1-RZ0+W,0,roadMat).name='Route';add(x+(x<0?-1:1)*(W/2+1.2),.08,mid,2.4,.16,RZ1-RZ0+W+4.8,0,walk);add(x-(x<0?-1:1)*(W/2+1.2),.08,mid,2.4,.16,RZ1-RZ0-W,0,walk);for(let z=RZ0+4;z<RZ1-4;z+=6)add(x,.05,z,.25,.02,3,0,lineMat);}
 for(const z of [RZ0,RZ1]){add(0,.02,z,RX*2-W,.04,W,0,roadMat).name='Route';add(0,.08,z+(z<mid?-1:1)*(W/2+1.2),RX*2+W+4.8,.16,2.4,0,walk);add(0,.08,z-(z<mid?-1:1)*(W/2+1.2),RX*2-W,.16,2.4,0,walk);for(let x=-RX+8;x<RX-8;x+=6)add(x,.05,z,3,.02,.25,0,lineMat);}
 // Street lamps along the inner pavement.
 for(let k=0;k<16;k++){const side=k%4,u=(Math.floor(k/4)+.5)/4,x=side<2?(side?RX:-RX)-(side?1:-1)*(W/2+1.4):-RX+u*RX*2,z=side<2?RZ0+u*(RZ1-RZ0):(side===2?RZ0:RZ1)-(side===2?-1:1)*(W/2+1.4);add(x,3,z,.18,6,.18,0x50585c);add(x,6,z,.9,.18,.4,0xf3efd8);}
 // Traffic lights at the four corners; their phase decides when the cars stop.
 this.lights=[];for(const [x,z] of [[-RX,RZ0],[RX,RZ0],[RX,RZ1],[-RX,RZ1]]){const px=x+(x<0?1:-1)*(W/2+1.2),pz=z+(z<mid?1:-1)*(W/2+1.2);add(px,1.8,pz,.16,3.6,.16,0x2c3135);const box=add(px,3.9,pz,.5,1.3,.45,0x1c1f22);box.name='Feu tricolore';const bulbs=['#d6342c','#f0a22a','#3cc35a'].map((c,i)=>{const m=new T.Mesh(new T.SphereGeometry(.14,10,8),new T.MeshBasicMaterial({color:0x222222}));m.position.set(px+(x<0?.24:-.24),4.3-i*.4,pz);m.userData.on=new T.Color(c);group.add(m);return m;});this.lights.push({bulbs,state:'',offset:this.lights.length*7});}
 // Cars: a loop of 14 vehicles, two lanes, different colours and speeds.
 const perim=2*(RX*2)+2*(RZ1-RZ0),palette=[0xc0392b,0x2e86c1,0xf1c40f,0xecf0f1,0x27ae60,0x34495e,0xe67e22,0x8e44ad];this.cars=[];this.cityLoop={RX,RZ0,RZ1,perim};
 for(let k=0;k<14;k++){const car=new T.Group(),body=new T.Mesh(new T.BoxGeometry(1.8,.7,4.1),mat(palette[k%palette.length]));body.position.y=.55;const cab=new T.Mesh(new T.BoxGeometry(1.6,.6,2.1),new T.MeshStandardMaterial({color:0x22313a,roughness:.3}));cab.position.set(0,1.15,-.2);car.add(body,cab);for(const wx of [-.85,.85])for(const wz of [-1.3,1.3]){const w=new T.Mesh(new T.CylinderGeometry(.33,.33,.25,10),mat(0x111111));w.rotation.z=Math.PI/2;w.position.set(wx,.33,wz);car.add(w);}car.name='Voiture';group.add(car);this.cars.push({g:car,s:k/14*perim,lane:k%2,speed:8+(k*3%5),v:0});}
 // Shops along the outer side of the long road, with awnings and signs.
 const shops=[['BOULANGERIE',0xd9b98a,0xc0392b],['CAFÉ DU STADE',0xb9d2c0,0x1d6f5a],['PHARMACIE',0xe6ecea,0x27ae60],['BOUTIQUE RIVAGE',0x2a4a62,0xd3f96a],['PIZZERIA',0xead2b2,0xe67e22],['TABAC PRESSE',0xc9c2b4,0x2e86c1]];
 shops.forEach(([name,wall,accent],k)=>{const x=-RX-W/2-2.4-6,z=GOAL_Z-10+k*14;add(x,3,z,10,6,12,wall).name='Commerce';add(x+5.2,2.6,z,.6,.2,11,accent);const sign=new T.Mesh(new T.PlaneGeometry(9,1.4),label(name,'#'+accent.toString(16).padStart(6,'0'),'#ffffff'));sign.position.set(x+5.06,4.6,z);sign.rotation.y=Math.PI/2;group.add(sign);add(x+5.05,1.3,z-2.5,.08,2.4,2.6,0x22313a);add(x+5.05,1.4,z+2.5,.08,1.8,3.4,0x9fc3d6);});
 // Car park opposite, with parked cars in two rows.
 const px0=RX+W/2+2.4+14;add(px0,.03,mid,22,.06,60,0x4a4f53).name='Parking';for(let r=0;r<2;r++)for(let k=0;k<9;k++){add(px0-5+r*10,.05,mid-26+k*6.5,.12,.02,5,0,lineMat);if((k*7+r*3)%4){const c=new T.Group(),b=new T.Mesh(new T.BoxGeometry(4.1,.7,1.8),mat(palette[(k+r*3)%palette.length]));b.position.y=.55;const cab=new T.Mesh(new T.BoxGeometry(2.1,.6,1.6),new T.MeshStandardMaterial({color:0x22313a,roughness:.3}));cab.position.set(.2,1.15,0);c.add(b,cab);c.position.set(px0-8+r*16,0,mid-23+k*6.5);group.add(c);}}
 // Playground behind the far end: slide, swings, sandbox, roundabout, fence.
 const pz0=RZ1+W/2+2.4+12,pg=new T.Group();pg.name='Aire de jeux';group.add(pg);const put=(o,x,y,z)=>{o.position.set(x,y,z);pg.add(o);return o;};
 put(new T.Mesh(new T.BoxGeometry(18,.05,12),mat(0x6d9b57)),0,.03,pz0);put(new T.Mesh(new T.BoxGeometry(4,.12,4),mat(0xe1c98b)),-5,.08,pz0+2);
 const slide=put(new T.Mesh(new T.BoxGeometry(1,.1,4.2),mat(0xe74c3c)),2,1.1,pz0-2);slide.rotation.x=.5;put(new T.Mesh(new T.BoxGeometry(1.4,2.2,1.4),mat(0x2e86c1)),2,1.1,pz0-4.4);
 for(const x of [-7,-3.6])put(new T.Mesh(new T.CylinderGeometry(.08,.08,2.6,6),mat(0x555555)),x,1.3,pz0-3);put(new T.Mesh(new T.CylinderGeometry(.08,.08,3.6,6),mat(0x555555)),-5.3,2.6,pz0-3).rotation.z=Math.PI/2;
 this.swings=[-6.2,-4.4].map(x=>{const s=new T.Group();s.position.set(x,2.6,pz0-3);const seat=new T.Mesh(new T.BoxGeometry(.5,.06,.25),mat(0xf1c40f));seat.position.y=-1.9;s.add(seat);for(const dx of [-.22,.22]){const r=new T.Mesh(new T.CylinderGeometry(.015,.015,1.9,4),mat(0x333333));r.position.set(dx,-.95,0);s.add(r);}pg.add(s);return s;});
 this.roundabout=put(new T.Mesh(new T.CylinderGeometry(1.2,1.2,.15,16),mat(0x27ae60)),6,.4,pz0+2);
 for(let k=0;k<4;k++){const f=put(new T.Mesh(new T.BoxGeometry(k%2?.08:18,.9,k%2?12:.08),mat(0x8e9a9e)),k===1?9:k===3?-9:0,.45,pz0+(k===0?-6:k===2?6:0));}
 // Trees on the pavements and the town beyond the road.
 let seed=3;const r=()=>(seed=(seed*48271)%2147483647)/2147483647;
 for(let k=0;k<40;k++){const side=k%4,u=r(),x=side<2?(side?1:-1)*(RX-W/2-4):-RX+8+u*(RX*2-16),z=side<2?RZ0+8+u*(RZ1-RZ0-16):(side===2?RZ0+W/2+4:RZ1-W/2-4);if(Math.abs(x)<PITCH.board+14&&z>GOAL_Z-17&&z<PITCH.far+17)continue;const h=3+r()*2.5;add(x,h*.3,z,.3,h*.6,.3,0x5b4632);const top=new T.Mesh(new T.SphereGeometry(1.4+r(),8,6),mat(r()<.5?0x2f5a34:0x3b6b3a));top.position.set(x,h*.78,z);group.add(top);}
 const win=document.createElement('canvas');let winMat=null;if(win.getContext){win.width=64;win.height=128;const g=win.getContext('2d');g.fillStyle='#8c9aa0';g.fillRect(0,0,64,128);for(let y=6;y<128;y+=14)for(let x=5;x<64;x+=15){g.fillStyle=Math.random()<.25?'#f2e3a6':'#3c4e57';g.fillRect(x,y,9,8);}const t=new T.CanvasTexture(win);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;winMat=t;}
 const towers=[0xb9b0a2,0x9fa7a8,0xc7b79c,0x8e9a9e,0xa69384,0xd0c6b6];for(let k=0;k<44;k++){const a=k/44*Math.PI*2,x=Math.cos(a)*(RX+46+r()*20),z=mid+Math.sin(a)*((RZ1-RZ0)/2+40+r()*20);if(Math.abs(x)<RX+30&&z>RZ0-20&&z<RZ1+20)continue;const w=8+r()*12,h=6+r()*10,d=8+r()*10;let m;if(winMat){const t=winMat.clone();t.needsUpdate=true;t.repeat.set(Math.round(w/3),Math.round(h/3));m=new T.MeshStandardMaterial({map:t,color:towers[k%towers.length],roughness:.85});}add(x,h/2-.2,z,w,h,d,towers[k%towers.length],m).rotation.y=-a;}
 this.stepCity(0,0);}
// Lights cycle green 9 s, orange 2 s, red 9 s (each corner offset); cars brake before a red corner and drive on.
stepCity(now,dt){if(!this.cars)return;for(const l of this.lights){const t=((now+l.offset)%20+20)%20,state=t<9?'green':t<11?'orange':'red';if(state!==l.state){l.state=state;l.bulbs.forEach((b,i)=>b.material.color.copy(['red','orange','green'][i]===state?b.userData.on:new T.Color(0x222222)));}}
 const {RX,RZ0,RZ1,perim}=this.cityLoop,L=[RX*2,RZ1-RZ0,RX*2,RZ1-RZ0],corners=[0,L[0],L[0]+L[1],L[0]+L[1]+L[2]];
 for(const c of this.cars){const dir=c.lane?1:-1;let ahead=Infinity;for(let k=0;k<4;k++){const cs=corners[k],d=dir>0?((cs-c.s)%perim+perim)%perim:((c.s-cs)%perim+perim)%perim;if(d<ahead&&this.lights[k].state!=='green')ahead=d;}
  const want=ahead>3&&ahead<14?0:c.speed;c.v+=(want-c.v)*Math.min(1,dt*1.5);c.s=((c.s+dir*c.v*dt)%perim+perim)%perim;
  let s=c.s,x,z,ang;const off=c.lane?2.2:-2.2;if(s<L[0]){x=-RX+s;z=RZ0+off;ang=Math.PI/2;}else if((s-=L[0])<L[1]){x=RX-off;z=RZ0+s;ang=0;}else if((s-=L[1])<L[2]){x=RX-s;z=RZ1-off;ang=-Math.PI/2;}else{s-=L[2];x=-RX+off;z=RZ1-s;ang=Math.PI;}
  c.g.position.set(x,0,z);c.g.rotation.y=ang+(dir<0?Math.PI:0);}
 for(const [i,s] of (this.swings||[]).entries())s.rotation.x=Math.sin(now*1.6+i*1.3)*.5;if(this.roundabout)this.roundabout.rotation.y=now*.8;}

setCrowdVisible(show){if(this.crowd)this.crowd.group.visible=!!show;}
animateCrowd(time,goal){const c=this.crowd;if(!c||!c.group.visible)return;const d=c.dummy;
 c.fans.forEach((f,i)=>{const excitement=goal?.6:.16,bob=Math.max(0,Math.sin(time*(goal?6:2)+f.phase))*(goal?.14:.025);d.position.set(f.x,f.base+.87+bob,f.z);d.rotation.set(0,0,0);d.updateMatrix();c.bodies.setMatrixAt(i,d.matrix);d.position.y=f.base+1.32+bob;d.updateMatrix();c.heads.setMatrixAt(i,d.matrix);
  for(let side=0;side<2;side++){const sign=side?1:-1;d.position.set(f.x+sign*.11,f.base+.3+bob,f.z);d.rotation.set(0,0,0);d.updateMatrix();c.legs.setMatrixAt(i*2+side,d.matrix);d.position.set(f.x+sign*.28,f.base+.96+bob,f.z);d.rotation.set(Math.sin(time*2+f.phase)*.18,0,sign*(i%4===0||goal?2.6+Math.sin(time*4+f.phase)*excitement:.2));d.updateMatrix();c.arms.setMatrixAt(i*2+side,d.matrix);}
 });c.heads.instanceMatrix.needsUpdate=true;c.bodies.instanceMatrix.needsUpdate=true;c.legs.instanceMatrix.needsUpdate=true;c.arms.instanceMatrix.needsUpdate=true;c.flags.forEach((f,i)=>f.rotation.y=Math.sin(time*2+i)*.25);
}
// Lot 2 · Painted face on the head (eyes with iris and highlight, brows, nose shading, lips, optional beard), cached per look.
headGeometry(shape,detail='low'){return this.shared('head|'+shape+'|'+detail,()=>buildHead(shape,detail));}
earGeometry(side,detail='low'){return this.shared('ear|'+side+'|'+detail,()=>buildEar(side,detail));}
hairShell(style,shape,seed,detail){return this.shared(['shell',style,shape,seed%3,detail].join('|'),()=>buildHairShell(style,shape,seed,detail));}
curls(style,shape,seed,detail,hex){return this.shared(['curls',style,shape,seed%3,detail,hex].join('|'),()=>buildCurls(style,shape,seed,detail,hex));}
faceTexture(skin,hair,eye,beard,style,shape=0,detail='low'){const key=['face',skin,hair,eye,beard,style,shape,detail].join('|');this.faces=this.faces||new Map();if(!this.faces.has(key))this.faces.set(key,paintFace(skin,hair,eye,beard,style,shape,detail));return this.faces.get(key);}
hairTexture(hair,style){const key='hair|'+hair+'|'+style;this.faces=this.faces||new Map();if(!this.faces.has(key))this.faces.set(key,paintHair(hair,style));return this.faces.get(key);}
// Blink and gaze of the detailed faces (locker room only).
updateFace(p,dt,now){if(p?.face?.mh)p.face.mh.userData.tick?.(dt,now);else if(p?.face)animateEyes(p.face,dt,now);}
shared(key,make){this.geoCache=this.geoCache||new Map();if(!this.geoCache.has(key)){const g=make();g.userData.shared=true;this.geoCache.set(key,g);}return this.geoCache.get(key);}
// Lot 5 · Kit fabric: the team colour with a soft sheen gradient, darker side panels, a subtle sublimated
// diagonal pattern, fine fabric grain and trim on the shoulders. Painted on the torso tube (u = 0 at the back,
// 0.5 at the front, v = 1 at the collar).
kitTexture(color,trim,kind='shirt',marks=null){const key=['kit',color,trim,kind,marks?marks.num+marks.name:''].join('|');this.faces=this.faces||new Map();if(this.faces.has(key))return this.faces.get(key);const cv=document.createElement('canvas');cv.width=512;cv.height=256;const c=cv.getContext('2d');
 if(typeof c?.fillRect!=='function'||typeof c.createLinearGradient!=='function'){this.faces.set(key,null);return null;}
 const base=new T.Color(color),hex=(k)=>{const cl=base.clone();cl.lerp(new T.Color(k>0?0xffffff:0x000000),Math.abs(k));return '#'+cl.getHexString();},tc='#'+new T.Color(trim).getHexString();
 c.fillStyle=hex(0);c.fillRect(0,0,512,256);
 const v=c.createLinearGradient(0,0,0,256);v.addColorStop(0,'rgba(255,255,255,.06)');v.addColorStop(.6,'rgba(255,255,255,0)');v.addColorStop(1,'rgba(0,0,0,.1)');c.fillStyle=v;c.fillRect(0,0,512,256);
 if(kind==='shirt'){c.save();c.globalAlpha=.07;c.strokeStyle=hex(.5);c.lineWidth=10;for(let x=-256;x<768;x+=34){c.beginPath();c.moveTo(x,0);c.lineTo(x+180,256);c.stroke();}c.restore();
  for(const u of [.25,.75]){const g=c.createLinearGradient(u*512-26,0,u*512+26,0);g.addColorStop(0,hex(0));g.addColorStop(.3,hex(-.22));g.addColorStop(.7,hex(-.22));g.addColorStop(1,hex(0));c.fillStyle=g;c.fillRect(u*512-26,0,52,256);
   c.fillStyle=tc;c.fillRect(u*512-3,0,6,256);c.fillRect(u*512-40,0,80,7);}}
 else{for(const u of [.25,.75]){c.fillStyle=tc;c.fillRect(u*512-5,0,10,256);}}
 for(let i=0;i<9000;i++){c.fillStyle=Math.random()<.5?'rgba(0,0,0,.05)':'rgba(255,255,255,.05)';c.fillRect(Math.random()*512,Math.random()*256,1,1);}
 // Lot 5 · Markings are printed on the fabric itself (u = 0.5 front, u = 0 and 1 back, about 406 px per metre).
 if(marks&&typeof c.fillText==='function'){c.textAlign='center';c.textBaseline='middle';c.fillStyle=marks.ink;
  const back=fn=>{fn(0);fn(512);},name=String(marks.name||'').slice(0,14).toUpperCase(),num=String(marks.num);
  back(x=>{c.font='700 17px "Barlow Condensed",Impact,sans-serif';c.fillText(name,x,40,150);c.font='900 118px Impact,"Barlow Condensed",sans-serif';c.fillText(num,x,116,150);});
  c.font='900 38px Impact,"Barlow Condensed",sans-serif';c.fillText(num,256,150);
  if(typeof c.beginPath==='function'){c.save();c.translate(292,66);c.fillStyle=tc;c.beginPath();c.moveTo(-13,-14);c.lineTo(13,-14);c.lineTo(13,5);c.quadraticCurveTo(13,15,0,20);c.quadraticCurveTo(-13,15,-13,5);c.closePath();c.fill();c.lineWidth=2;c.strokeStyle=marks.ink;c.stroke();c.fillStyle=marks.ink;c.font='900 18px Impact,sans-serif';c.fillText('R',0,2);c.restore();}}
 const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;this.faces.set(key,t);return t;}
kitMaterial(color,trim,kind,marks=null){const map=this.kitTexture(color,trim,kind,marks);return new T.MeshStandardMaterial(map?{map,roughness:kind==='shorts'?.55:.68}:{color,roughness:.7});}
makePlayer(x,z,color,num,own=false,keeper=false,displayName="Rivage"){
 // Lot 2: painted faces, six haircuts and beards, collar and cuffs, sock bands, coloured boots, fuller chest and shoulders.
 // The bone hierarchy is unchanged (knee children: shin, boot, kneecap, calf).
 const g=new T.Group(),pose=new T.Group();g.position.set(x,0,z);pose.position.y=1;g.add(pose);
 const seed=(num*37+displayName.length*11+(keeper?5:0))%97,skins=['#e8c19f','#c98b62','#a76d48','#7b4a32','#f1d0b4','#b8835c','#5c3a28'],hairs=['#28231e','#111111','#5a3a22','#a8763e','#d1b06a','#2f1d14'],eyes=['#4a2f1d','#2a1a10','#3d5a7a','#5b6b3a','#3a2a1c'];
 const skin=own?this.appearance.skin:skins[seed%skins.length],hair=own?this.appearance.hair:hairs[seed%hairs.length],sock=keeper?0x30383a:color===0x63b9f4?0xeef4f6:0x2b2f33,shorts=keeper?0x30383a:color===0x63b9f4?0x183e59:0x2a2d33;
 const trim=color===0x63b9f4?0xffffff:color===0xd96955?0x2a2d33:0x15181b,boots=[0x111414,0xf2f2f2,0xff7a1a,0x1d6fe0,0xe9e23a,0xd8264b][seed%6],beard=own?(this.appearance.beard||''):seed%5===0?'barbe':seed%5===2?'barbe3j':seed%7===3?'bouc':'';
 const add=(parent,geo,c,px,py,pz)=>{const m=this.mesh(geo,c);m.position.set(px,py-1,pz);m.castShadow=true;parent.add(m);return m;};
  // Lot 6 · one continuous skinned body (see buildBody): skin, shirt, shorts, socks and gloves share nine bones.
  const marks={num,name:displayName,ink:shirtInk(color)};
  const mats=[new T.MeshStandardMaterial({color:skin,roughness:.55}),this.kitMaterial(color,trim,'shirt',marks),this.kitMaterial(shorts,trim,'shorts'),new T.MeshStandardMaterial({color:sock,roughness:.78}),new T.MeshStandardMaterial({color:trim,roughness:.6}),this.gloveMat||(this.gloveMat=new T.MeshStandardMaterial({color:0xe9eeee,roughness:.6}))];
  // Lot 7 · head (see heads.js): continuous skull, detailed ears, eyes with real lids in the locker room, soft skin, curls and fades.
 const detail=this.detail==='high'?'high':'low',hi=detail==='high',eyeHex=eyes[seed%eyes.length];
 const shape=seed%FACE_SHAPES.length,style=own?(HAIR_STYLES.includes(this.appearance.hairStyle)?this.appearance.hairStyle:'degrade'):HAIR_STYLES[(seed*7+3)%HAIR_STYLES.length],hv=FACE_SHAPES[shape];
 const headG=new T.Group();headG.position.set(0,HEAD_Y,.006);headG.name='Tête';pose.add(headG);
 let faceRig=null;if(this.mh&&(hi||own)){// the head brings its own neck: the body's skin is not drawn above the collar (tested in the body's own space, whatever the pose)
  mats[0].onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying float vBodyY;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBodyY=position.y;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vBodyY;').replace('void main() {','void main() {\nif(vBodyY>.585)discard;');};mats[0].customProgramCacheKey=()=>'neckHidden';
  const mhG=mhHeadGroup(this.mh,mhShapeParams(shape,own?this.appearance.face:null),{skin,hair,style,beard,seed,lipRed:own?this.appearance.face?.lipRed:0},hi?1024:512);headG.add(mhG);faceRig={mh:mhG};}else{
 const face=this.faceTexture(skin,hair,eyeHex,beard,style,shape,detail),skinProps={map:face.map,roughnessMap:face.roughnessMap||null,bumpMap:face.bumpMap||null,bumpScale:.14,roughness:face.roughnessMap?1:.66,metalness:0};
 const faceMat=hi?new T.MeshPhysicalMaterial({...skinProps,sheen:.22,sheenRoughness:.7,sheenColor:new T.Color(0xff9a80)}):new T.MeshStandardMaterial(skinProps);
 const head=new T.Mesh(this.headGeometry(shape,detail),faceMat);head.castShadow=true;head.name='Visage';headG.add(head);
 const plainSkin=new T.MeshStandardMaterial({color:skin,roughness:.62,metalness:0});
 for(const side of [-1,1]){const m=earMount(side,hv),ear=new T.Mesh(this.earGeometry(side,detail),plainSkin);ear.position.set(m.x,m.y,m.z);ear.rotation.set(0,m.ry,m.rz);ear.castShadow=true;ear.name='Oreille';headG.add(ear);}
 if(hi){const pairs=[];for(const side of [-1,1]){const e=buildEye(side,hv,eyeHex,plainSkin);headG.add(e.pivot);headG.add(buildEyeRim(side,hv,skin));pairs.push(e);}faceRig={eyes:pairs};}
 if(style!=='crane'){const ht=this.hairTexture(hair,style),hm=new T.MeshStandardMaterial({map:ht.map,bumpMap:ht.bumpMap||null,bumpScale:.4,roughness:.9,metalness:0,vertexColors:true,alphaHash:hi});
  const shell=new T.Mesh(this.hairShell(style,shape,seed,detail),hm);shell.castShadow=true;shell.name='Cheveux';headG.add(shell);
  if(style==='boucles'||style==='afro'){const cm=new T.Mesh(this.curls(style,shape,seed,detail,hair),new T.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0}));cm.castShadow=true;cm.name='Boucles';headG.add(cm);}
  if(style==='chignon'){const p=headPoint(Math.PI,.66,hv,.016),bun=new T.Mesh(buildBun(),hm);bun.position.set(p.x,p.y,p.z);bun.scale.set(1,.9,.9);headG.add(bun);}}
}
  const spine=new T.Bone();pose.add(spine);const legs=[],knees=[],arms=[],elbows=[],bootRig=[],hands=[],bones=[spine,0,0,0,0,0,0,0,0];
  const soleMat=this.soleMat||(this.soleMat=new T.MeshStandardMaterial({color:0x1b1d1d,roughness:.8})),studMat=this.studMat||(this.studMat=new T.MeshStandardMaterial({color:0xb9bec2,roughness:.5})),bootMat=new T.MeshStandardMaterial({color:boots,roughness:.38});
  for(const side of [-1,1]){const k=side>0?1:0;
   const hip=new T.Bone();hip.position.set(side*.094,-.04,0);pose.add(hip);legs.push(hip);bones[1+k]=hip;
   const knee=new T.Bone();knee.position.y=-.43;hip.add(knee);knees.push(knee);bones[3+k]=knee;
   const boot=new T.Group();boot.position.set(0,-.43,0);knee.add(boot);bootRig.push(boot);const bm=new T.Mesh(this.shared('boot2',buildBoot),[bootMat,soleMat,studMat]);bm.castShadow=true;boot.add(bm);
   const shoulder=new T.Bone();shoulder.position.set(side*.19,.5,0);pose.add(shoulder);arms.push(shoulder);bones[5+k]=shoulder;
   const elbow=new T.Bone();elbow.position.y=-.3;shoulder.add(elbow);elbows.push(elbow);bones[7+k]=elbow;
   const hand=new T.Object3D();hand.position.y=-.31;elbow.add(hand);hands.push(hand);}
  const body=new T.SkinnedMesh(this.shared(keeper?'bodyK':'bodyO',()=>buildBody(keeper)),mats);body.castShadow=true;body.frustumCulled=false;pose.add(body);g.updateMatrixWorld(true);body.bind(new T.Skeleton(bones));
 body.userData.marking={ink:shirtInk(color),number:num,displayName};/* printed on the shirt fabric (see kitTexture) */
 if(own){const ring=new T.Mesh(new T.RingGeometry(.62,.78,36),new T.MeshBasicMaterial({color:0xd3f96a,side:T.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;g.add(ring);}
 this.scene.add(g);const p={g,pose,body,arms,elbows,legs,knees,boots:bootRig,hands,face:faceRig,keeper,lastAngle:keeper?Math.PI:0,stride:own?0:seed,idle:seed*.37};this.players.push(p);return p;
}
clearPlayers(){for(const p of this.players){this.scene.remove(p.g);p.g.traverse(o=>{if(o.skeleton)o.skeleton.dispose();if(o.geometry&&!o.geometry.userData?.shared)o.geometry.dispose();if(o.material){for(const m of [].concat(o.material)){if(m.map)m.map.dispose();m.dispose();}}});}this.players=[];}
setup(a){this.renderer.localClippingEnabled=true;this.action=a;this.camPos=null;this.cinePos=null;this.clearPlayers();this.referee=null;this.hero=this.makePlayer(a.hero.x,a.hero.z,0x63b9f4,this.appearance.number,true,false,this.appearance.name||'Espoir');this.teammates=(a.teammates||[a.receiver]).filter(Boolean).map((t,i)=>this.makePlayer(t.x,t.z,0x63b9f4,t.number||11+i,false,false,t.name||['Martin','Lopez','Morel','Diallo','Petit','Garcia','Leroy','Roux','Faye','Blanc'][i%10]));this.receiver=this.teammates[0]||null;this.defenders=a.defenders.map((d,i)=>this.makePlayer(d.x,d.z,0xd96955,d.number||4+i,false,false,d.name||['Bernard','Thomas','Robert','Dubois','Laurent','Michel','Simon','Durand','Adam','Henry'][i%10]));this.keeper=this.makePlayer(a.keeper.x,a.keeper.z,0xe5c45c,1,false,true,'Gardien');
 // V19 · Assistant referee on the near touchline, level with the offside line, flag in hand.
 this.linesman=a.defenders.length?this.makePlayer(-PITCH.W-1.1,a.keeper.z,0x1c1f22,'',false,false,'Arbitre'):null;if(this.linesman){const flag=new T.Mesh(new T.PlaneGeometry(.34,.26),new T.MeshBasicMaterial({color:0xf2d23a,side:T.DoubleSide}));flag.position.set(.17,-.08,0);this.linesman.hands[1].add(flag);this.linesman.flag=flag;this.lineZ=null;}this.aim.visible=false;if(this.targetRing)this.targetRing.visible=false;this.ball.position.set(a.ball.x,R,a.ball.z);}
resize(){const w=this.canvas.parentElement.clientWidth,h=this.canvas.parentElement.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);const a=w/h;this.camera.aspect=a;this.camera.position.set(0,a<.85?27:26,a<.85?25:22);this.camera.fov=a<.85?Math.min(92,2*Math.atan(Math.tan(47*Math.PI/360)*.85/a)*180/Math.PI):45;this.camera.lookAt(0,0,-6);this.camera.far=180;if(this.scene.fog){this.scene.fog.near=90;this.scene.fog.far=220;}this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
 if(this.action){this.fitTeamCamera();}
}
fitTeamCamera(){this.followCamera(this.action,0,true);}
// Lot 2 · Referee for bookings: runs to the culprit, then raises the card above his head.
drawReferee(a,dt,now){const c=a.cardShow;if(!c){if(this.referee)this.referee.g.visible=false;return;}
 if(!this.referee){this.referee=this.makePlayer(c.rx,c.rz,0x15181b,'',false,false,'Arbitre');const card=new T.Mesh(new T.BoxGeometry(.12,.17,.01),new T.MeshBasicMaterial({color:0xf2d23a}));card.position.set(0,-.1,-.03);card.name='Carton';this.referee.hands[1].add(card);this.referee.card=card;}
 const r=this.referee;r.g.visible=true;r.card.material.color.set(c.card==='red'?0xe0272e:0xf2d23a);this.posePlayer(r,{x:c.rx,z:c.rz,angle:c.rangle,speed:c.rspeed},dt,now,false);r.card.visible=c.raised;
 if(c.raised){const u=Math.min(1,(c.t-1.9)/.25);r.arms[1].rotation.set(-.2*u,0,2.95*u);r.elbows[1].rotation.x=0;r.arms[0].rotation.set(0,0,-.2);}}
cardView(a,dt){const c=a.cardShow,cam=this.camera,mid={x:(c.rx+c.d.x)/2,z:(c.rz+c.d.z)/2},look=new T.Vector3(mid.x,1.55,mid.z),side=c.rx<c.d.x?1:-1,pos=new T.Vector3(mid.x+side*1.6,2.3,mid.z+4.2);
 if(!this.cinePos){this.cinePos=pos;this.cineLook=look;}else{const k=1-Math.exp(-dt*2.6);this.cinePos.lerp(pos,k);this.cineLook.lerp(look,k);}cam.fov=cam.aspect>1.2?38:52;cam.position.copy(this.cinePos);cam.lookAt(this.cineLook);cam.updateProjectionMatrix();cam.updateMatrixWorld();}
// Lot 2 · Off-ball runs: a flat arrow on the grass from each partner to where he is about to run.
drawRuns(a){const runs=a.ready&&!a.ended&&a.runs||[];this.runArrows=this.runArrows||[];
 while(this.runArrows.length<runs.length){const m=new T.MeshBasicMaterial({color:0xbff0ff,transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide}),g=new T.Group(),shaft=new T.Mesh(new T.PlaneGeometry(1,.34),m),head=new T.Mesh(new T.CircleGeometry(.62,3),m);shaft.rotation.x=-Math.PI/2;head.rotation.x=-Math.PI/2;g.add(shaft,head);g.userData={shaft,head};g.name='Appel de balle';this.scene.add(g);this.runArrows.push(g);}
 this.runArrows.forEach((g,i)=>{const r=runs[i];g.visible=!!r;if(!r)return;const m=r.mate,dx=r.point.x-m.x,dz=r.point.z-m.z,len=Math.max(.5,Math.hypot(dx,dz)),pulse=.55+.25*Math.sin(performance.now?.()/180||0);
  g.position.set(m.x,.05,m.z);g.rotation.y=Math.atan2(-dz,dx);const {shaft,head}=g.userData;shaft.scale.x=len-1;shaft.position.set((len-1)/2+.4,0,0);head.position.set(len,0,0);head.rotation.z=0;shaft.material.opacity=pulse;});}
// V13.2: close camera behind the career player. It frames the player, the ball, the goal and
// partners close by, then follows the action smoothly (passes, runs, rebounds).
setWideView(on){this.wideView=!!on;}
// V19 · Celebration cinematic: a slow orbit close to the scorer, from the pitch side so the fans fill the background.
cineView(a,dt){const s=a.celebration.scorer,c=a.celebration,cam=this.camera,ang=.9*Math.sin((c.time||0)*.35),r=5.8,look=new T.Vector3(s.x,1.15+(s.y||0)*.5,s.z),pos=new T.Vector3(s.x+Math.sin(ang)*r,2,s.z+Math.cos(ang)*r);
 if(!this.cinePos){this.cinePos=pos;this.cineLook=look;}else{const k=1-Math.exp(-dt*2.2);this.cinePos.lerp(pos,k);this.cineLook.lerp(look,k);}cam.fov=cam.aspect>1.2?40:55;cam.far=320;cam.position.copy(this.cinePos);cam.lookAt(this.cineLook);cam.updateProjectionMatrix();cam.updateMatrixWorld();if(this.scene.fog){this.scene.fog.near=70;this.scene.fog.far=220;}}
// 30 · Replay camera: just behind the net, under the stand roof, following the ball smoothly.
replayView(a,dt,view='goal'){const cam=this.camera,b=a.ball,h=a.hero||b;let look=new T.Vector3(clamp(b.x,-13,13)*.8,.6,clamp(b.z,-19,24)+1.5),pos=new T.Vector3(look.x*.45,7,-23.3);
 // V19 · four replay cameras: behind the goal, main stand, behind the player, overhead.
 if(view==='side'){look=new T.Vector3(b.x*.6,.5,b.z);pos=new T.Vector3(PITCH.board+10,15,b.z+4);}else if(view==='hero'){const gx=-h.x,gz=GOAL_Z-h.z,gl=Math.hypot(gx,gz)||1;look=new T.Vector3(h.x+gx/gl*7,1,h.z+gz/gl*7);pos=new T.Vector3(h.x-gx/gl*5.5,2.6,h.z-gz/gl*5.5);}else if(view==='air'){look=new T.Vector3(b.x*.8,0,b.z-2);pos=new T.Vector3(b.x*.8,30,b.z+12);}
 if(this.replayView_!==view){this.replayView_=view;this.replayPos=null;}if(!this.replayPos){this.replayPos=pos;this.replayLook=look;}else{const k=1-Math.exp(-dt*3);this.replayPos.lerp(pos,k);this.replayLook.lerp(look,k);}cam.fov=cam.aspect>1.2?40:64;cam.far=260;cam.position.copy(this.replayPos);cam.lookAt(this.replayLook);cam.updateProjectionMatrix();cam.updateMatrixWorld();if(this.scene.fog){this.scene.fog.near=60;this.scene.fog.far=170;}}
// 26 · Rain: falling streaks around the action and a greyer sky.
setRain(on){this.raining=!!on;if(on&&!this.rain){const n=2200,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*44;pos[i*3+1]=Math.random()*20;pos[i*3+2]=(Math.random()-.5)*44;}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));this.rain=new T.Points(g,new T.PointsMaterial({color:0xdbe8f0,size:2.2,sizeAttenuation:false,transparent:true,opacity:.7,depthWrite:false}));this.rain.frustumCulled=false;this.scene.add(this.rain);}if(this.rain)this.rain.visible=!!on;const sky=new T.Color(on?'#7d8f97':'#a9cbe6');this.scene.background=sky;if(this.scene.fog)this.scene.fog.color=sky;if(this.sky)this.sky.material.color.set(on?0x8d969b:0xffffff);}
stepRain(dt){if(!this.raining||!this.rain)return;const p=this.rain.geometry.attributes.position,a=p.array,c=this.camLook||{x:0,z:-8},cam=this.camera.position;this.rain.position.set(c.x,0,c.z);/* Lot 3 · the rain box grows with the camera distance, so a wide view is covered too */const k=clamp(Math.hypot(cam.x-c.x,cam.y,cam.z-c.z)/24,1,3.2);this.rain.scale.set(k,Math.max(1,k*.8),k);for(let i=1;i<a.length;i+=3){a[i]-=dt*14;if(a[i]<0)a[i]+=20;}p.needsUpdate=true;}
setLookYaw(v){this.lookYaw=v;}
// Run cursor: where the player is heading after a pass (pulses while the game waits for the call).
setRunCursor(p,waiting=false){if(!this.runRing){this.runRing=new T.Group();const ring=new T.Mesh(new T.RingGeometry(.45,.6,40),new T.MeshBasicMaterial({color:0x63b9f4,side:T.DoubleSide,transparent:true,opacity:.9,depthTest:false}));ring.rotation.x=-Math.PI/2;const dot=new T.Mesh(new T.CircleGeometry(.14,20),new T.MeshBasicMaterial({color:0x63b9f4,side:T.DoubleSide,depthTest:false}));dot.rotation.x=-Math.PI/2;this.runRing.add(ring,dot);this.runRing.renderOrder=6;this.scene.add(this.runRing);}
 this.runRing.visible=!!p;if(p){this.runRing.position.set(p.x,.05,p.z);this.runRing.scale.setScalar(1+(waiting?.15*Math.sin(performance.now()/160):0));}}
actorNDC(actor){const v=new T.Vector3(actor.x,1,actor.z).project(this.camera);return {x:v.x,y:v.y,behind:v.z>1};}
followCamera(a,dt,snap=false){
 if(!a?.hero)return;const cam=this.camera,h=a.hero,raw=a.ball||h,pts=[];
 // The camera never follows a ball into the stands: it stays inside the boards and below 9 m.
 const ball={x:clamp(raw.x,-PITCH.board,PITCH.board),y:Math.min(raw.y||0,9),z:clamp(raw.z,GOAL_Z-PITCH.boardEnd,PITCH.far+PITCH.boardEnd)};
 const add=(x,y,z)=>pts.push(new T.Vector3(x,y,z));
 for(const x of [-3.66,3.66]){add(x,0,-20.6);add(x,2.44,-20);}
 for(const dx of [-1,1])for(const dz of [-1,1])add(h.x+dx,dz<0?1.9:0,h.z+dz);
 add(ball.x,(ball.y||0)+.3,ball.z);add(ball.x,0,ball.z);
 // Partners up to 12 m ahead or alongside stay in view (a ball out to the wing); the wide view shows the whole attacking half.
 for(const t of a.teammates||[])if(t&&(this.wideView?t.z<h.z+6&&Math.abs(t.x)<30:Math.hypot(t.x-h.x,t.z-h.z)<16&&t.z<h.z+3))add(t.x,1.8,t.z);
 if(this.wideView)for(const x of [-26,26])for(const z of [-20,h.z+4])add(x,0,z);
 const near=(h.x+ball.x)/2,nz=Math.max(h.z,ball.z);add(near-6,0,nz);add(near+6,0,nz);
 let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const p of pts){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);}
 const cx=clamp((x0+x1)/2,-20,20),cz=(z0+z1)/2,elev=.66,wide=cam.aspect>1.2,top=wide?.5:.5,bottom=wide?-.9:-.66;
 cam.fov=wide?42:50;const place=d=>{cam.position.set(cx*.85,Math.sin(elev)*d,cz+Math.cos(elev)*d);cam.lookAt(cx,0,cz);cam.far=d+200;cam.updateMatrixWorld();cam.updateProjectionMatrix();};
 const fits=()=>pts.every(p=>{const v=p.clone().project(cam);return Math.abs(v.x)<.9&&v.y<top&&v.y>bottom&&v.z<1;});
 let lo=6,hi=160;for(let i=0;i<26;i++){const d=(lo+hi)/2;place(d);if(fits())hi=d;else lo=d;}
 const pos=new T.Vector3(cx*.85,Math.sin(elev)*hi,cz+Math.cos(elev)*hi),look=new T.Vector3(cx,0,cz);
 // Head turn: the camera swings around the player to look towards a wing.
 this.camYaw=(this.camYaw||0)+((this.lookYaw||0)-(this.camYaw||0))*(snap?1:1-Math.exp(-dt*7));if(Math.abs(this.camYaw)>.001){const c=Math.cos(this.camYaw),s=Math.sin(this.camYaw);for(const v of [pos,look]){const x=v.x-h.x,z=v.z-h.z;v.x=h.x+x*c-z*s;v.z=h.z+x*s+z*c;}}
 if(snap||!this.camPos){this.camPos=pos.clone();this.camLook=look.clone();}else{const k=1-Math.exp(-dt*2.6);this.camPos.lerp(pos,k);this.camLook.lerp(look,k);}
 cam.position.copy(this.camPos);cam.lookAt(this.camLook);cam.far=hi+200;cam.updateMatrixWorld();cam.updateProjectionMatrix();
 if(this.scene.fog){this.scene.fog.near=hi+45;this.scene.fog.far=hi+170;}
}

groundAtScreen(x,y){const r=this.canvas.getBoundingClientRect();const v=new T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);this.ray.setFromCamera(v,this.camera);const p=new T.Vector3();if(!this.ray.ray.intersectPlane(this.plane,p))return null;return{x:clamp(p.x,-PITCH.W-2,PITCH.W+2),z:clamp(p.z,GOAL_Z-6,PITCH.far+2)};}
actorScreen(actor){const p=new T.Vector3(actor.x,1.15,actor.z).project(this.camera),r=this.canvas.getBoundingClientRect();return{x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};}
ballScreen(){const p=this.ball.position.clone().project(this.camera),r=this.canvas.getBoundingClientRect();return{x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};}
preview(start,end,mode,spin=0,power=null,ability=1){if(this.targetRing)this.targetRing.visible=false;if(!end){this.aim.visible=false;return;}const pts=[];
 if(mode==='dribble'){for(let i=0;i<=24;i++){const t=i/24;pts.push(new T.Vector3(start.x+(end.x-start.x)*t,.1,start.z+(end.z-start.z)*t));}}
 else{const b=launch(start,end,mode,spin,power,ability);pts.push(new T.Vector3(b.x,b.y,b.z));const d=Math.hypot(end.x-start.x,end.z-start.z);for(let i=0;i<160;i++){stepBall(b,1/90);pts.push(new T.Vector3(b.x,b.y,b.z));if(Math.hypot(b.x-start.x,b.z-start.z)>=(Math.abs(spin)>.05?Math.max(2.5,d*.4):2.5)||b.bounces>0||b.z<-19)break;}}
 this.aim.material.color.set(Math.abs(spin)>.1?0x8cdbff:0xd3f96a);this.aim.geometry.dispose();this.aim.geometry=new T.BufferGeometry().setFromPoints(pts);this.aim.computeLineDistances();this.aim.visible=true;
}
posePlayer(p,a,dt,now,frozen=false){
 /* Lot 4 · a small jump in position (a control, a header set-up) is shown as a quick step, never a teleport */{const jx=a.x-(p.sx??a.x),jz=a.z-(p.sz??a.z),j=Math.hypot(jx,jz);if((j>.22||p.glide&&j>.03)&&j<2.2&&dt>0){const k=Math.min(1,dt*13);p.sx+=jx*k;p.sz+=jz*k;p.glide=true;}else{p.sx=a.x;p.sz=a.z;p.glide=false;}}p.g.position.set(p.sx,a.y||0,p.sz);if(frozen&&p.posed&&!p.glide)return;p.posed=true;let angle=a.angle??0;let difference=Math.atan2(Math.sin(angle-p.lastAngle),Math.cos(angle-p.lastAngle));p.lastAngle+=difference*Math.min(1,dt*(Math.abs(difference)>1.2?24:14));p.g.rotation.y=p.lastAngle;
 const targetSpeed=a.speed||0;p.gaitSpeed=(p.gaitSpeed||0)+(targetSpeed-(p.gaitSpeed||0))*Math.min(1,dt*11);const speed=p.gaitSpeed,running=clamp((speed-.9)/2.6,0,1),moving=clamp(speed/1.1,0,1);
 // V14 gait: stride length grows with speed, so feet stay planted instead of pedalling; flight phase when running,
 // pelvis dips twice per cycle, trunk leans with speed and acceleration, arms swing opposite with bent elbows.
 const cycleLen=1.15+.34*speed;p.stride+=dt*speed/cycleLen*Math.PI*2;const cycle=p.stride,stanceFrac=.62-.24*running,step=Math.min(stanceFrac*cycleLen/2,.46)*moving;
 const accel=clamp((targetSpeed-speed)*.06,-.08,.1),breathe=Math.sin(now*1.9+p.idle)*.006*(1-moving);
 p.pose.position.y=1-.045*running+(moving>.05?(.012+.03*running)*Math.cos(2*cycle):breathe);p.pose.position.x=(1-moving)*Math.sin(now*.55+p.idle)*.018;
 p.pose.rotation.set(-(.04*moving+.15*running)-accel,0,Math.sin(cycle)*.03*moving+clamp(difference,-.4,.4)*running*.22+(1-moving)*Math.sin(now*.55+p.idle)*.02);p.body.rotation.y=0;
 for(let i=0;i<2;i++){const phase=((cycle/(Math.PI*2)+i*.5)%1+1)%1,swing=Math.sin(cycle+i*Math.PI);
  // The planted foot sweeps under the pelvis; the returning foot lifts at the knee, more when running.
  const stance=phase<stanceFrac,u=stance?phase/stanceFrac:(phase-stanceFrac)/(1-stanceFrac),ease=u*u*(3-2*u);
  const footZ=moving<.02?(i?.04:-.04)*(1-moving):stance?-step+2*step*u:step-2*step*ease,footY=.1+(stance?0:Math.sin(u*Math.PI)*(.07+.24*running)*moving);
  const vertical=p.pose.position.y-.04-footY,len=clamp(Math.hypot(footZ,vertical),.05,.859),aim=Math.atan2(-footZ,vertical);
  const hip=aim+Math.acos(clamp(len/.86,-1,1)),knee=-2*Math.acos(clamp(len/.86,-1,1))-(stance?0:Math.sin(u*Math.PI)*.35*running);
  p.legs[i].rotation.set(hip,0,0);p.knees[i].rotation.x=clamp(knee,-2,0);p.boots[i].rotation.x=-hip-p.knees[i].rotation.x;
  p.arms[i].rotation.set(-swing*(.22*moving+.62*running)-.05,0,(i?1:-1)*(.07+.06*running));p.elbows[i].rotation.x=.18+.35*moving+.85*running+Math.max(0,swing)*.25*running;
 }

 if(a.kickTimer>=0&&a.kickTimer<.65&&!a.heading&&!a.bicycle){const t=a.kickTimer;const swing=t<.16?-.65*(t/.16):t<.32?-.65+(t-.16)/.16*1.9:1.25*(1-(t-.32)/.33);p.legs[1].rotation.x=swing;p.knees[1].rotation.x=t<.16?-.55:-.12;p.pose.rotation.y=-swing*.14;p.arms[0].rotation.z=-.7;}
 if(a.skillTimer>=0&&a.skillTimer<.65){const t=Math.min(a.skillTimer/.62,1),wave=Math.sin(t*Math.PI),side=a.skillSide||1,leg=side<0?0:1;p.legs[leg].rotation.x=.75*wave;p.legs[leg].rotation.z=-side*.55*wave;p.knees[leg].rotation.x=-.3*wave;p.pose.rotation.y=side*.4*wave;p.pose.rotation.z=-side*.16*wave;p.arms[1-leg].rotation.z=-side*.6;}
 // V19 · Slide tackle: low on one hip, leading leg straight along the ground; then lying, then back on his feet.
 if(a.challenge?.kind==='slide'){const t=a.challenge.time,up=t>1.35?Math.min(1,(t-1.35)/.25):0,k=1-up;p.pose.position.y=1-(.62*k);p.pose.rotation.x=(t<.55?.95:1.25)*k;p.pose.rotation.z=.25*k;p.legs[1].rotation.x=(t<.55?.62:.3)*k;p.knees[1].rotation.x=-.05;p.legs[0].rotation.x=.05*k;p.knees[0].rotation.x=-1.5*k;p.arms[0].rotation.set(-.6*k,0,-.9*k);p.arms[1].rotation.set(.4*k,0,.5*k);}
 // Shoulder duel: both bodies lean into each other.
 if(a.lean)p.pose.rotation.z+=a.lean;
 if(a.challenge&&a.challenge.kind!=='slide'){const c=a.challenge,t=c.time,extend=t<.12?0:t<.32?(t-.12)/.2:t<.55?1-(t-.32)/.23:0;p.pose.rotation.x=-.35*extend;p.pose.position.y-=.12*extend;p.legs[1].rotation.x=(c.kind==='block'?1.4:.95)*extend;p.knees[1].rotation.x=-.08;p.legs[0].rotation.x=-.18*extend;p.knees[0].rotation.x=-.35*extend;p.arms[0].rotation.z=-.7*extend;p.arms[1].rotation.z=.7*extend;}
 // 29 · Celebration poses: arms up (default), aeroplane, knee slide, fist, pointing to the sky, three fingers, hands to the ears.
 // V19 · Header: arched back with the arms out for balance, then a sharp nod through the ball.
 if(a.heading&&(a.kickTimer<0||a.kickTimer<.45)){const t=a.kickTimer<0?0:Math.min(1,a.kickTimer/.12);p.pose.rotation.x=.3-.75*t;p.arms[0].rotation.set(-.4,0,-1.25);p.arms[1].rotation.set(-.4,0,1.25);p.elbows.forEach(e=>e.rotation.x=.6);p.legs[0].rotation.x=.35;p.knees[0].rotation.x=-1;p.legs[1].rotation.x=-.15;p.knees[1].rotation.x=-.5;}
 // Bicycle kick: the body tips back, the kicking leg swings over the head, then he lands on his back.
 if(a.bicycle){const t=a.kickTimer<0?0:a.kickTimer;if(t<.65){const u=Math.min(1,t/.3);p.pose.rotation.x=.2+1.2*u;p.legs[1].rotation.x=-.3+2.3*u;p.knees[1].rotation.x=-.2;p.legs[0].rotation.x=.9-1.3*u;p.knees[0].rotation.x=-.9;p.arms[0].rotation.set(0,0,-1.6);p.arms[1].rotation.set(0,0,1.6);}else{p.pose.rotation.x=1.45;p.pose.position.y=.28;p.legs.forEach(l=>l.rotation.x=1.3);p.knees.forEach(k=>k.rotation.x=-.4);p.arms[0].rotation.set(0,0,-1.2);p.arms[1].rotation.set(0,0,1.2);}}
 if(a.celebrate){const c=a.celebrate;if(c==='plane'){p.arms[0].rotation.set(0,0,-1.45);p.arms[1].rotation.set(0,0,1.45);p.elbows.forEach(e=>e.rotation.x=0);p.pose.rotation.z=Math.sin(now*3)*.25;}
  else if(c==='slide'){p.pose.position.y=.42;p.pose.rotation.x=.38;p.legs.forEach(l=>l.rotation.x=1.25);p.knees.forEach(k=>{k.rotation.x=-2;p.boots[p.knees.indexOf(k)].rotation.x=.75;});p.arms[0].rotation.set(-.3,0,-1.9);p.arms[1].rotation.set(-.3,0,1.9);p.elbows.forEach(e=>e.rotation.x=0);}
  else if(c==='fist'||c==='hat'){p.arms[1].rotation.set(0,0,2.75);p.elbows[1].rotation.x=c==='hat'?0:-.5;p.arms[0].rotation.set(-.4,0,-.5);p.elbows[0].rotation.x=1.2;}
  else if(c==='point'){p.arms[0].rotation.set(-.25,0,-2.85);p.arms[1].rotation.set(-.25,0,2.85);p.elbows.forEach(e=>e.rotation.x=0);p.pose.rotation.x=.12;}
  else if(c==='ears'){p.arms[0].rotation.set(0,0,-2.3);p.arms[1].rotation.set(0,0,2.3);p.elbows.forEach(e=>e.rotation.x=-2.1);}
  // V19 · dances and figures, timed by celebrateTime.
  // Lot 2 · Modern celebrations, timed by celebrateTime.
  else if(['siu','salto','vrille','griddy','croises','meditation','ouverts','tempe','calma','pouce','nom','ecusson','chut','coeur'].includes(c)){const t=a.celebrateTime||0,A=p.arms,E=p.elbows,L=p.legs,K=p.knees;
   if(c==='siu'){if(t<.62){const u=t/.62;p.g.rotation.y+=Math.PI*u;A.forEach((arm,i)=>arm.rotation.set(0,0,(i?1:-1)*2.6));E.forEach(e=>e.rotation.x=.1);L.forEach(l=>l.rotation.x=.35*Math.sin(Math.PI*u));}else{p.g.rotation.y+=Math.PI;const k=Math.min(1,(t-.62)/.15);L.forEach((l,i)=>l.rotation.set(0,0,(i?1:-1)*.32*k));K.forEach(q=>q.rotation.x=-.25*k);p.pose.position.y-=.08*k;A.forEach((arm,i)=>arm.rotation.set(-.35*k,0,(i?1:-1)*.95*k));E.forEach(e=>e.rotation.x=.05);p.pose.rotation.x=-.22*k;}}
   else if(c==='salto'){const u=Math.min(1,t/1.1);p.pose.rotation.x=u<1?Math.PI*2*u:0;const tuck=Math.sin(Math.PI*u);L.forEach(l=>l.rotation.x=1.9*tuck);K.forEach(k=>k.rotation.x=-2*tuck);A.forEach((arm,i)=>arm.rotation.set(1.2*tuck,0,(i?1:-1)*(u<1?.4:2.7)));}
   else if(c==='vrille'){const u=Math.min(1,t/.9);p.g.rotation.y+=u<1?Math.PI*2*u:0;A.forEach((arm,i)=>arm.rotation.set(.9,0,(i?1:-1)*.3));E.forEach(e=>e.rotation.x=1.8);L.forEach(l=>l.rotation.x=.3*Math.sin(Math.PI*u));}
   else if(c==='griddy'){for(let i=0;i<2;i++){const w=Math.max(0,Math.sin(t*8+i*Math.PI));L[i].rotation.x=-.25*w;K[i].rotation.x=-1.4*w;A[i].rotation.set(Math.sin(t*8+i*Math.PI)*1.1,0,(i?1:-1)*.35);E[i].rotation.x=.4;}p.pose.rotation.x=.15;p.pose.rotation.y=Math.sin(t*4)*.2;}
   else if(c==='croises'){A[0].rotation.set(.42,.5,.62);A[1].rotation.set(.42,-.5,-.62);E.forEach(e=>e.rotation.x=1.7);p.pose.rotation.x=-.1;}
   else if(c==='meditation'){p.pose.position.y=.4;L.forEach((l,i)=>l.rotation.set(1.45,0,(i?1:-1)*.75));K.forEach(k=>{k.rotation.x=-2.35;p.boots[p.knees.indexOf(k)].rotation.x=.6;});A.forEach((arm,i)=>arm.rotation.set(.55,0,(i?1:-1)*.38));E.forEach(e=>e.rotation.x=.6);p.pose.rotation.x=-.05;}
   else if(c==='ouverts'){A.forEach((arm,i)=>arm.rotation.set(-.25,0,(i?1:-1)*1.3));E.forEach(e=>e.rotation.x=.12);p.pose.rotation.x=-.2;}
   else if(c==='tempe'){A[1].rotation.set(.35,0,1.15);E[1].rotation.x=2.5;A[0].rotation.set(0,0,-.15);E[0].rotation.x=.2;p.pose.rotation.x=-.06;}
   else if(c==='calma'){const w=Math.sin(t*5)*.14;A.forEach((arm,i)=>arm.rotation.set(.75+w,0,(i?1:-1)*.42));E.forEach(e=>e.rotation.x=.35);}
   else if(c==='pouce'){A[1].rotation.set(.75,0,.12);E[1].rotation.x=2.35;A[0].rotation.set(0,0,-.2);E[0].rotation.x=.3;}
   else if(c==='nom'){p.g.rotation.y+=Math.PI;A.forEach((arm,i)=>arm.rotation.set(.45,0,(i?1:-1)*2.05));E.forEach(e=>e.rotation.x=-2.5);p.pose.rotation.x=-.08;}
   else if(c==='ecusson'){if(t<1.1){A[1].rotation.set(.4,0,-.5);E[1].rotation.x=1.65;}else if(t<2){A[1].rotation.set(.75,0,.1);E[1].rotation.x=2.4;}else{A[1].rotation.set(-.2,0,2.85);E[1].rotation.x=0;}A[0].rotation.set(0,0,-.2);}
   else if(c==='chut'){A[1].rotation.set(.75,0,.1);E[1].rotation.x=2.4;A[0].rotation.set(0,0,-.25);}
   else if(c==='coeur'){A.forEach((arm,i)=>arm.rotation.set(.95,0,(i?1:-1)*-.25));E.forEach(e=>e.rotation.x=1.75);p.pose.rotation.x=-.08;}}
  else if(c!=='run'){p.arms[0].rotation.z=-2.15;p.arms[1].rotation.z=2.15;p.elbows[0].rotation.x=-.2;p.elbows[1].rotation.x=-.2;}}
 if(p.keeper){p.g.rotation.y=Math.PI;p.pose.rotation.set(0,0,a.tilt||0);const dive=a.state==='dive'||a.state==='ground'||a.state==='recover';if(dive){p.arms.forEach((arm,i)=>{arm.rotation.z=(i?1:-1)*2.75;arm.rotation.x=-.25;});p.legs[0].rotation.x=.15;p.legs[1].rotation.x=-.25;}else if(a.holding){p.pose.position.y-=.12;p.legs.forEach(l=>l.rotation.x=.22);p.knees.forEach(k=>k.rotation.x=-.45);p.arms.forEach((arm,i)=>{arm.rotation.x=.85;arm.rotation.z=(i?-1:1)*.5;p.elbows[i].rotation.x=.18;});}
  // V19 · Ready stance: low, feet apart, arms spread at hip height to cover the goal.
  else if(!a.rush){const v=Math.hypot(a.x-(p.kx??a.x),a.z-(p.kz??a.z))/Math.max(dt,1e-3);p.kx=a.x;p.kz=a.z;p.shuffle=(p.shuffle||0)+dt*Math.min(v,6)*5;const step=v>.25?Math.sin(p.shuffle):0;
   // Feet apart (never crossed); when he moves he shuffles sideways, one foot after the other, with a small bounce.
   p.pose.position.y-=.17-Math.abs(step)*.04;p.pose.rotation.x=.14;p.legs.forEach((l,i)=>{l.rotation.x=.38;l.rotation.z=(i?1:-1)*(.16+.14*step*(i?1:-1));});p.knees.forEach(k=>k.rotation.x=-.7);p.arms.forEach((arm,i)=>{arm.rotation.x=.3;arm.rotation.z=(i?1:-1)*.85;p.elbows[i].rotation.x=.45;});}}

 const joints=[p.pose,...p.legs,...p.knees,...p.arms,...p.elbows];if(p.previousPose){const blend=1-Math.exp(-dt*22);joints.forEach((j,i)=>{for(const axis of ['x','y','z'])j.rotation[axis]=p.previousPose[i][axis]+(j.rotation[axis]-p.previousPose[i][axis])*blend;});}if(!(a.kickTimer>=0&&a.kickTimer<.65)&&!a.challenge&&!(a.skillTimer>=0&&a.skillTimer<.65))p.knees.forEach((k,i)=>p.boots[p.knees.indexOf(k)].rotation.x=-p.legs[i].rotation.x-k.rotation.x);p.previousPose=joints.map(j=>({x:j.rotation.x,y:j.rotation.y,z:j.rotation.z}));
}
heldBallPosition(){this.keeper.g.updateMatrixWorld(true);const left=this.keeper.hands[0].getWorldPosition(new T.Vector3()),right=this.keeper.hands[1].getWorldPosition(new T.Vector3());return left.add(right).multiplyScalar(.5).add(new T.Vector3(0,0,.12));}
render(a,dt,now){this.stepCity(now,dt);this.updateNets(dt);if(a===this.action){if(a.cardShow)this.cardView(a,dt);else if(a.cinematic&&a.celebration?.scorer)this.cineView(a,dt);else this.followCamera(a,dt);}this.stepRain(dt);this.animateCrowd(now,a.outcomeKind==='goal');const ball=a.ball;const turnover=a.ballControl==='defender'&&a.after<1.1;const travelling=a.phase==='interval'||a.phase==='incoming'||a.flying||a.phase==='dribble'||a.phase==='skill'||turnover;this.ball.position.set(ball.x,ball.y-(R-BALL_VISUAL),ball.z);if(travelling){this.ball.rotation.x-=dt*(a.phase==='dribble'||a.phase==='skill'||turnover?10:Math.abs(ball.vz)*1.8);this.ball.rotation.z+=dt*(ball.vx||0);}
 this.shadow.position.set(ball.x,.04,ball.z);this.shadow.scale.setScalar((1+ball.y*.12)*.72);this.shadow.material.opacity=Math.max(.06,.4-ball.y*.04);
 const fz=!!a.frozen;this.posePlayer(this.hero,a.hero,dt,now,fz);this.updateFace(this.hero,dt,now);(this.teammates||[]).forEach((p,i)=>this.posePlayer(p,(a.teammates||[a.receiver])[i],dt,now,fz));this.defenders.forEach((p,i)=>this.posePlayer(p,a.defenders[i],dt,now,fz));this.posePlayer(this.keeper,a.keeper,dt,now,fz);if(this.linesman&&a.offsideLine!=null){const target=clamp(a.offsideLine,GOAL_Z,(GOAL_Z+PITCH.far)/2),prev=this.lineZ??target;this.lineZ=prev+(target-prev)*Math.min(1,dt*4);const sp=Math.abs(this.lineZ-prev)/Math.max(dt,1e-3);this.posePlayer(this.linesman,{x:-PITCH.W-1.1,z:this.lineZ,angle:-Math.PI/2,speed:fz?0:sp},dt,now,fz);if(a.flag){this.linesman.arms[1].rotation.set(0,0,2.9);this.linesman.elbows[1].rotation.x=0;}}this.drawRuns(a);this.drawReferee(a,dt,now);if(a.ballControl==='held'){this.ball.position.copy(this.heldBallPosition());this.shadow.position.set(this.ball.position.x,.04,this.ball.position.z);}this.renderer.render(this.scene,this.camera);
}
}
// Lot 5 · "Mon joueur" studio: the player alone on a lit turntable. Drag to turn him; the camera frames the whole
// body or moves in on the face. Thumbnails of every haircut and beard are rendered with the same lights.
export class Locker{
constructor(canvas){this.canvas=canvas;const r=this.r=new T.WebGLRenderer({canvas,antialias:true});r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.05;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;r.localClippingEnabled=true;
 const e=this.e=Object.create(Pitch3D.prototype);e.scene=new T.Scene();e.players=[];e.appearance={};e.detail='high';const s=this.scene=e.scene;s.background=new T.Color('#101b16');s.fog=new T.Fog('#101b16',7,16);
 // Soft studio light: a wide, gentle key from the front left, a light fill from the right, a cool rim from behind; moderate shadows.
 s.add(new T.HemisphereLight(0xeaf2ff,0x2a4030,1.15));const key=new T.DirectionalLight(0xfff3e4,2.1);key.position.set(-2.4,2.8,-3.4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=key.shadow.camera.bottom=-2;key.shadow.camera.right=key.shadow.camera.top=2;key.shadow.bias=-.0004;key.shadow.normalBias=.015;s.add(key);
 const fill=new T.DirectionalLight(0xdce8ff,.9);fill.position.set(2.6,1.4,-3);s.add(fill);const rim=new T.DirectionalLight(0x9fd8ff,1.2);rim.position.set(2,3,4);s.add(rim);
 const c=document.createElement('canvas');let floorMat=new T.MeshStandardMaterial({color:0x1d3a2a,roughness:.9});if(c.getContext?.('2d')?.createRadialGradient){c.width=c.height=256;const g=c.getContext('2d'),gr=g.createRadialGradient(128,128,10,128,128,128);gr.addColorStop(0,'#3d7a45');gr.addColorStop(.62,'#25502f');gr.addColorStop(.7,'#d3f96a');gr.addColorStop(.72,'#1c3a26');gr.addColorStop(1,'#101b16');g.fillStyle=gr;g.fillRect(0,0,256,256);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;floorMat=new T.MeshStandardMaterial({map:t,roughness:.85});}
 const floor=new T.Mesh(new T.CircleGeometry(1.6,48),floorMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;s.add(floor);
 this.cam=new T.PerspectiveCamera(30,1,.05,40);this.yaw=.35;this.view='body';this.camT={y:1,d:4.4,look:1,fov:30};this.camNow={...this.camT};
 const at=e=>e.touches?e.touches[0]:e;canvas.addEventListener('pointerdown',ev=>{this.dragX=ev.clientX;this.touched=performance.now();canvas.setPointerCapture?.(ev.pointerId);});canvas.addEventListener('pointermove',ev=>{if(this.dragX==null)return;this.yaw-=(ev.clientX-this.dragX)*.012;this.dragX=ev.clientX;this.touched=performance.now();});const up=()=>{this.dragX=null;};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.style.touchAction='none';}
setAppearance(app){const e=this.e;if(this.p){e.scene.remove(this.p.g);this.p.g.traverse(o=>{if(o.geometry&&!o.geometry.userData?.shared)o.geometry.dispose();});e.players=[];}e.appearance=app;const p=this.p=e.makePlayer(0,0,0x63b9f4,app.number||9,true,false,(app.name||'Joueur').slice(0,14));p.g.children.filter(o=>o.geometry?.type==='RingGeometry').forEach(o=>o.visible=false);p.g.traverse(o=>{if(o.isMesh)o.castShadow=true;});}
setView(v,yaw){this.view=v;if(yaw!=null){this.yaw=yaw;this.touched=performance.now()+8000;}   // the turntable pauses a few seconds on the chosen angle; dragging still turns the player freely
 this.camT=v==='face'?{y:1.735,d:2.4,look:1.712,fov:14}:{y:1.05,d:4.5,look:.96,fov:30};}   // the face is seen through a longer lens: no distortion of the nose and chin
resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;if(this.w!==w||this.h!==h){this.w=w;this.h=h;this.r.setSize(w,h,false);this.cam.aspect=w/h;this.cam.updateProjectionMatrix();}}
frame(now){if(!this.running)return;const dt=Math.min(.05,(now-(this.last||now))/1000);this.last=now;this.resize();
 for(const k of ['y','d','look','fov'])this.camNow[k]+=(this.camT[k]-this.camNow[k])*Math.min(1,dt*5);const c=this.camNow;if(Math.abs(this.cam.fov-c.fov)>.01){this.cam.fov=c.fov;this.cam.updateProjectionMatrix();}this.cam.position.set(0,c.y,-c.d);this.cam.lookAt(0,c.look,0);
 if(this.p){this.e.posePlayer(this.p,{x:0,z:0,angle:this.yaw,speed:0,kickTimer:-1},dt,now/1000);this.e.updateFace(this.p,dt,now/1000);}this.r.render(this.scene,this.cam);requestAnimationFrame(t=>this.frame(t));}
start(){if(this.running)return;this.running=true;this.last=null;requestAnimationFrame(t=>this.frame(t));}
stop(){this.running=false;}
// Head-and-shoulders portraits for the option cards, rendered off screen with the studio lights.
portraits(list){const cv=document.createElement('canvas');cv.width=cv.height=192;const r=new T.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;r.setSize(192,192,false);const cam=new T.PerspectiveCamera(26,1,.05,20),out=[],keep=this.p,saved=this.e.appearance,detail0=this.e.detail;this.e.detail='low';
 for(const app of list){this.setAppearance(app);this.e.posePlayer(this.p,{x:0,z:0,angle:.45,speed:0,kickTimer:-1},.016,0);this.p.g.rotation.y=.45;this.p.lastAngle=.45;this.p.g.updateMatrixWorld(true);cam.position.set(0,1.76,-1.0);cam.lookAt(0,1.72,0);r.render(this.scene,cam);out.push(cv.toDataURL('image/png'));}
 r.dispose();r.forceContextLoss?.();this.e.detail=detail0;this.setAppearance(saved);return out;}
}
