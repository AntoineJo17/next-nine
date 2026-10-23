import * as T from './vendor/three.module.js';
import {R,clamp,launch,stepBall,PITCH,GOAL_Z} from './physics.js?v=20-5b';
// Drawn ball: 0.15 m radius (players looked like they kicked a beach ball). The physics keeps R=0.22,
// so goal-line, post and goalkeeper contacts are exactly as before.
export const BALL_VISUAL=.15;
export function shirtInk(color){const c=new T.Color(color);return .2126*c.r+.7152*c.g+.0722*c.b>.35?'#10232b':'#ffffff';}
// Lot 4 · Sculpted heads. A sphere is reshaped into a skull with brow ridge, eye sockets, cheekbones, nose, lips,
// chin and jaw. Every feature sits at a longitude/latitude (0,0 = straight ahead, + = towards the player's right
// as seen from in front) shared with the painted face map, so the paint always lands on its relief.
const FACE_W=1024,FACE_H=512,PXR=FACE_W/(2*Math.PI);
const bump=(l,f,cl,cf,sl,sf)=>{const a=(l-cl)/sl,b=(f-cf)/sf;return Math.exp(-a*a-b*b);};
const ease=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);};
export const FACE_SHAPES=[{nose:1,jaw:1,brow:1,wide:0},{nose:1.15,jaw:1.1,brow:1.15,wide:.4},{nose:.9,jaw:.92,brow:.9,wide:-.3},{nose:1.05,jaw:1.15,brow:1.05,wide:.7},{nose:.95,jaw:.96,brow:1.2,wide:-.1},{nose:1.2,jaw:1,brow:.95,wide:.2}];
export const HAIR_STYLES=['court','degrade','boucles','afro','plaque','chignon','rase','crane'];
export function headRelief(l,f,v){const nose=v.nose,jaw=v.jaw;let r=0;
 for(const s of [-1,1]){
  r-=.06*bump(l,f,s*.3,.1,.15,.09);              // eye socket
  r+=.034*bump(l,f,s*.3,.095,.08,.045);          // eyeball under the lids
  r+=.02*bump(l,f,s*.52,.0,.16,.09);             // cheekbone
  r-=.034*bump(l,f,s*.58,-.36,.2,.15);           // hollow under the cheekbone
  r-=.035*bump(l,f,s*1.05,.3,.28,.17);           // temple
  r+=.055*nose*bump(l,f,s*.085,-.16,.045,.035);  // nostril wing
  r+=.018*jaw*bump(l,f,s*1.0,-.66,.22,.12);      // angle of the jaw
  r+=.012*bump(l,f,s*.21,-.4,.06,.05);           // cheeks at the corners of the mouth
 }
 r+=.042*v.brow*bump(l,f,0,.26,.5,.065);         // brow ridge
 r-=.014*bump(l,f,0,.17,.07,.035);               // root of the nose
 const prof=f>.18?0:f>-.15?Math.pow((.18-f)/.33,1.3):Math.exp(-(((f+.15)/.035)**2));
 r+=.21*nose*prof*Math.exp(-((l/(.05+.035*prof))**2)); // nose: a bridge widening to the tip
 r+=.036*bump(l,f,0,-.3,.17,.06);                // upper lip and philtrum
 r+=.034*bump(l,f,0,-.44,.14,.045);              // lower lip
 r-=.02*bump(l,f,0,-.375,.17,.013);              // mouth line
 r-=.016*bump(l,f,0,-.53,.14,.04);               // groove under the lip
 r+=.07*jaw*bump(l,f,0,-.7,.15,.09);             // chin
 return r;}
// Skull proportions: narrower jaw than cranium, a fuller back of the head, the nape tucked into the neck.
export function headPoint(l,f,v,lift=0){const cf=Math.cos(f),x=-Math.sin(l)*cf,y=Math.sin(f),z=-Math.cos(l)*cf,r=(1+headRelief(l,f,v)+lift)*.104,low=ease(-.1,-1.05,f),sx=(.76+.03*v.wide)*(1-low*(.52-.12*v.jaw)),sz=z>0?1.02+.06*ease(-.3,.6,f)-.38*ease(-.25,-1.05,f):.97;return new T.Vector3(x*r*sx,y*r*1.22,z*r*sz);}
// Where the hair grows: high on the forehead, a little higher at the temples, sideburns in front of the ears,
// above the ears, down to the nape.
const HAIRLINE=[[0,.64],[.32,.63],[.58,.55],[.9,.43],[1.12,.18],[1.26,-.08],[1.36,-.06],[1.45,.22],[1.6,.3],[1.8,.18],[2.1,-.24],[2.6,-.48],[3.2,-.58]];
export function hairline(l){const a=Math.abs(l);for(let i=1;i<HAIRLINE.length;i++){const [a1,f1]=HAIRLINE[i],[a0,f0]=HAIRLINE[i-1];if(a<=a1)return f0+(f1-f0)*(a-a0)/(a1-a0);}return -.6;}
function hairThickness(style,l,f,seed){const top=ease(.3,.95,f),curl=.5+.5*Math.sin(l*23+seed)*Math.sin(f*27+seed*.7);
 switch(style){case 'court':return .007+.005*top;case 'degrade':return .003+.018*top+.008*bump(l,f,0,.62,.45,.18);case 'boucles':return .005+(.024+.01*curl)*top;case 'afro':return .014+(.04+.008*curl)*ease(-.25,.6,f);case 'plaque':return .01+.012*bump(l,f,0,.68,.55,.24)+.004*top;case 'chignon':return .008+.003*top;case 'rase':return .0022;default:return 0;}}
// Welds the normals of coincident vertices (sphere seam and poles) so the sculpted head shows no crease.
function weldNormals(geo){const pos=geo.attributes.position,nor=geo.attributes.normal,groups=new Map();for(let i=0;i<pos.count;i++){const k=Math.round(pos.getX(i)*1e5)+'|'+Math.round(pos.getY(i)*1e5)+'|'+Math.round(pos.getZ(i)*1e5);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}for(const ids of groups.values()){if(ids.length<2)continue;let x=0,y=0,z=0;for(const i of ids){x+=nor.getX(i);y+=nor.getY(i);z+=nor.getZ(i);}const l=Math.hypot(x,y,z)||1;for(const i of ids)nor.setXYZ(i,x/l,y/l,z/l);}nor.needsUpdate=true;}
function sculpt(v,lift,w=72,h=54){const geo=new T.SphereGeometry(1,w,h,Math.PI/2),pos=geo.attributes.position,p=new T.Vector3();for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).normalize();const l=Math.atan2(-p.x,-p.z),f=Math.asin(clamp(p.y,-1,1));pos.setXYZ(i,...headPoint(l,f,v,lift?lift(l,f):0).toArray());}geo.computeVertexNormals();weldNormals(geo);return geo;}
export function beardMask(kind,l,f){const a=Math.abs(l);if(kind==='bouc')return a<.26&&f<-.27&&f>-.82&&!(a<.2&&f<-.33&&f>-.47)||a<.22&&f>-.33&&f<-.24;if(f>-.05||a>1.32||f<-1.05)return false;if(a<.2&&f<-.335&&f>-.465)return false;const cheek=-.06-(1.3-a)*.22;return f<cheek||a<.24&&f<-.24;}
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
const catmull=(keys,t)=>{if(t<=keys[0][0])return keys[0][1];for(let i=0;i<keys.length-1;i++){const [t1,v1]=keys[i],[t2,v2]=keys[i+1];if(t<=t2){const v0=(keys[i-1]||keys[i])[1],v3=(keys[i+2]||keys[i+1])[1],u=(t-t1)/(t2-t1),u2=u*u,u3=u2*u;return .5*(2*v1+(-v0+v2)*u+(2*v0-5*v1+4*v2-v3)*u2+(-v0+3*v1-3*v2+v3)*u3);}}return keys[keys.length-1][1];};
// spec: {len, W:[[t,half-width]], D:[[t,half-depth]], n (cross-section squareness), front(t), back(t), zoff:[[t,dz]], seg:[radial,height]}
// t = 0 at the bottom of the tube, 1 at the top; the tube's bottom sits at y = base. Front is -z.
function tube(spec,base=0){const [rs,hs]=spec.seg||[20,12],geo=new T.CylinderGeometry(1,1,1,rs,hs,true),pos=geo.attributes.position,n=spec.n||2.2,e=2/n;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),t=pos.getY(i)+.5,th=Math.atan2(x,z),sx=Math.sin(th),cz=Math.cos(th);let w=catmull(spec.W,t),d=catmull(spec.D||spec.W,t);
  const fr=cz<0?(spec.front?spec.front(t,sx):0)*Math.pow(-cz,1.5):0,bk=cz>0?(spec.back?spec.back(t,sx):0)*Math.pow(cz,1.5):0;
  const px=Math.sign(sx)*Math.pow(Math.abs(sx),e)*w,pz=Math.sign(cz)*Math.pow(Math.abs(cz),e)*(d+fr+bk)+(spec.zoff?catmull(spec.zoff,t):0);pos.setXYZ(i,px,base+t*spec.len,pz);}
 geo.computeVertexNormals();return geo;}
const gauss=(t,c,s)=>Math.exp(-(((t-c)/s)**2));
const BODY={
 torso:{len:.67,seg:[32,22],n:2.2,W:[[0,.2],[.1,.19],[.2,.178],[.35,.168],[.55,.186],[.72,.2],[.82,.212],[.9,.218],[.945,.21],[.972,.17],[.99,.115],[1,.07]],D:[[0,.132],[.1,.12],[.3,.104],[.55,.108],[.7,.114],[.82,.112],[.9,.104],[.96,.086],[1,.066]],zoff:[[0,0],[.6,-.006],[.9,0],[1,.012]],front:(t,sx)=>.014*gauss(t,.7,.1)*(1-.5*gauss(sx,0,.25)),back:(t,sx)=>.008*gauss(t,.74,.12)},
 pelvis:{len:.16,seg:[28,6],n:2.4,W:[[0,.178],[.5,.17],[1,.148]],D:[[0,.12],[.5,.112],[1,.095]],back:t=>.012*gauss(t,.25,.4)},
 shortLeg:{len:.27,seg:[20,6],n:2.1,W:[[0,.09],[.5,.088],[1,.09]],D:[[0,.1],[1,.098]]},
 thigh:{len:.45,seg:[18,12],n:2.1,W:[[0,.052],[.25,.062],[.6,.078],[1,.085]],D:[[0,.054],[.3,.063],[.6,.076],[1,.082]],front:t=>.012*gauss(t,.55,.22)},
 sock:{len:.41,seg:[18,12],n:2.05,W:[[0,.032],[.15,.036],[.45,.049],[.7,.055],[.9,.052],[1,.054]],D:[[0,.034],[.2,.039],[.5,.048],[.8,.05],[1,.054]],back:t=>.018*gauss(t,.66,.15),front:t=>.005*gauss(t,.55,.25)},
 sleeve:{len:.19,seg:[20,4],n:2.1,W:[[0,.055],[1,.062]],D:[[0,.053],[1,.06]]},
 upperArm:{len:.27,seg:[16,10],n:2.05,W:[[0,.037],[.4,.045],[.75,.05],[1,.051]],D:[[0,.038],[.5,.048],[1,.05]],},
 forearm:{len:.26,seg:[16,10],n:2.1,W:[[0,.026],[.3,.031],[.75,.042],[1,.039]],D:[[0,.022],[.3,.026],[.75,.035],[1,.037]]},
 keeperArm:{len:.27,seg:[16,6],n:2.05,W:[[0,.05],[1,.062]],D:[[0,.05],[1,.06]]},
 keeperFore:{len:.26,seg:[16,6],n:2.05,W:[[0,.04],[1,.05]],D:[[0,.036],[1,.046]]}};
// Boot: a sculpted shoe (narrow heel, wide forefoot, rounded toe) on a thin sole.
function bootGeometry(){const geo=new T.SphereGeometry(1,20,14),pos=geo.attributes.position;for(let i=0;i<pos.count;i++){let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const fwd=(-z+1)/2;x*=.042+.014*Math.sin(Math.min(1,fwd*1.3)*Math.PI*.9);y=y<-.35?-.35:y;y*=.042*(1.05-fwd*.4);z*=.135;pos.setXYZ(i,x,y+.012,z-.035);}geo.computeVertexNormals();return geo;}
// Hand: a relaxed half-closed hand rather than a ball.
function handGeometry(){const geo=new T.SphereGeometry(1,16,12),pos=geo.attributes.position;for(let i=0;i<pos.count;i++){let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);const down=(1-y)/2;pos.setXYZ(i,x*(.034-.006*down),y*.052,z*(.018+.006*(1-down))-.004*down);}geo.computeVertexNormals();return geo;}
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
headGeometry(shape){this.headGeos=this.headGeos||new Map();const k='h'+shape;if(!this.headGeos.has(k))this.headGeos.set(k,sculpt(FACE_SHAPES[shape],null));return this.headGeos.get(k);}
hairGeometry(shape,style,seed){this.headGeos=this.headGeos||new Map();const k=['hair',shape,style,seed%3].join('|');if(!this.headGeos.has(k))this.headGeos.set(k,sculpt(FACE_SHAPES[shape],(l,f)=>{const w=ease(-.035,.03,f-hairline(l));return w*hairThickness(style,l,f,seed%3)*(.35+.65*ease(0,.16,f-hairline(l)))/.104-(1-w)*.05;},64,48));return this.headGeos.get(k);}
// The face map: skin tones (warmer cheeks, nose and ears, shade under the jaw), pores, almond eyes with iris and
// lids, eyebrows drawn hair by hair, a shaded nose with nostrils, nasolabial folds, shaped lips, stubble or beard,
// and the hair colour painted under the hairline so short cuts read as hair. A matching roughness map makes the
// eyes and lips glossy and the skin matte; a bump map carries pores and stubble.
faceTexture(skin,hair,eye,beard,style){const key=[skin,hair,eye,beard,style].join('|');this.faces=this.faces||new Map();if(this.faces.has(key))return this.faces.get(key);
 const make=(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;};const cv=make(FACE_W,FACE_H),c=cv.getContext('2d');
 if(typeof c?.fillRect!=='function'||typeof c.arc!=='function'||typeof c.ellipse!=='function'){const t={map:new T.CanvasTexture(cv)};this.faces.set(key,t);return t;}
 const col=hex=>new T.Color(hex),css=cl=>'#'+cl.getHexString(),tone=(hex,f)=>{const cl=col(hex);cl.lerp(col(f<0?0x1a0d08:0xffffff),Math.abs(f));return css(cl);},rgba=(hex,a)=>{const cl=col(hex);return `rgba(${Math.round(cl.r*255)},${Math.round(cl.g*255)},${Math.round(cl.b*255)},${a})`;};
 const P=(l,f)=>[FACE_W/2+l*PXR,FACE_H/2-f*PXR],dark=col(skin).getHSL({}).l<.35;let seed=0;for(const ch of key)seed=(seed*31+ch.charCodeAt(0))>>>0;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const blob=(l,f,rx,ry,color,a)=>{const [x,y]=P(l,f),g=c.createRadialGradient(x,y,0,x,y,Math.max(rx,ry));g.addColorStop(0,rgba(color,a));g.addColorStop(1,rgba(color,0));c.save();c.translate(x,y);c.scale(rx/Math.max(rx,ry),ry/Math.max(rx,ry));c.translate(-x,-y);c.fillStyle=g;c.fillRect(x-Math.max(rx,ry),y-Math.max(rx,ry),Math.max(rx,ry)*2,Math.max(rx,ry)*2);c.restore();};
 const curve=(pts,width,color)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach(([l,f],i)=>{const [x,y]=P(l,f);if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();};
 c.fillStyle=skin;c.fillRect(0,0,FACE_W,FACE_H);
 const warm=dark?0x7a2a22:0xc4524a;
 blob(0,.48,170,70,0xffffff,.06);                                  // forehead catches the light
 for(const s of [-1,1]){blob(s*.56,-.16,70,52,warm,dark?.1:.16);   // cheeks
  blob(s*1.57,.02,40,60,warm,.14);                                 // ears
  blob(s*.3,.02,34,13,0x3a1f18,.16);                               // under the eyes
  blob(s*.3,.13,42,22,0x2a1610,.14);}                              // eye sockets
 blob(0,-.12,22,18,warm,dark?.12:.2);                              // tip of the nose
 {const g=c.createLinearGradient(0,P(0,-.7)[1],0,FACE_H);g.addColorStop(0,rgba(0x1a0d08,0));g.addColorStop(1,rgba(0x1a0d08,.35));c.fillStyle=g;c.fillRect(0,P(0,-.7)[1],FACE_W,FACE_H);} // shade under the jaw
 if(!beard)for(const s of [-1,1,0])blob(s*.32,s?-.55:-.6,s?60:50,s?60:45,0x2a3540,dark?.05:.08); // shaved beard shadow
 for(let i=0;i<9000;i++){const x=rnd()*FACE_W,y=rnd()*FACE_H;c.fillStyle=rnd()<.5?'rgba(40,20,12,.05)':'rgba(255,240,225,.045)';c.fillRect(x,y,1.4,1.4);} // pores
 // nose: shaded sides, lit bridge, nostrils, the crease round each wing
 for(const s of [-1,1]){curve([[s*.055,.14],[s*.065,0],[s*.08,-.1]],7,rgba(0x2a1610,.13));curve([[s*.12,-.13],[s*.1,-.185],[s*.04,-.2]],2.4,rgba(0x2a1610,.32));
  c.fillStyle=rgba(0x1a0805,.75);c.beginPath();const [nx,ny]=P(s*.042,-.178);c.ellipse(nx,ny,6.5,3,s*.35,0,Math.PI*2);c.fill();
  curve([[s*.12,-.13],[s*.17,-.25],[s*.22,-.39]],4,rgba(0x2a1610,.16));}  // nasolabial folds
 curve([[0,.15],[0,-.08]],5,rgba(0xffffff,.12));
 // eyes
 for(const s of [-1,1]){const cl=s*.3,cf=.095,inner=[s*.195,cf-.006],outer=[s*.41,cf+.014],up=[cl+s*.01,cf+.075],down=[cl,cf-.04];
  const shape=()=>{c.beginPath();c.moveTo(...P(...inner));c.quadraticCurveTo(...P(...up),...P(...outer));c.quadraticCurveTo(...P(...down),...P(...inner));c.closePath();};
  curve([[s*.22,cf+.055],[cl,cf+.075],[s*.4,cf+.045]],2.6,rgba(0x2a1610,.32)); // lid crease
  shape();c.fillStyle='#ece5da';c.fill();c.save();shape();c.clip();
  blob(s*.225,cf,10,8,0xd07a70,.55);blob(s*.38,cf,8,8,0x806050,.25);  // tear duct, shade at the corner
  const [ix,iy]=P(cl+s*.005,cf+.004),ig=c.createRadialGradient(ix,iy,1,ix,iy,13.5);ig.addColorStop(0,tone(eye,.25));ig.addColorStop(.75,eye);ig.addColorStop(1,tone(eye,-.6));c.fillStyle=ig;c.beginPath();c.arc(ix,iy,13.5,0,Math.PI*2);c.fill();
  c.fillStyle='#070605';c.beginPath();c.arc(ix,iy,5,0,Math.PI*2);c.fill();
  const lid=c.createLinearGradient(0,iy-12,0,iy+2);lid.addColorStop(0,'rgba(20,10,6,.55)');lid.addColorStop(1,'rgba(20,10,6,0)');c.fillStyle=lid;c.fillRect(ix-40,iy-14,80,16); // the upper lid shades the eyeball
  c.fillStyle='rgba(255,255,255,.95)';c.beginPath();c.arc(ix+3,iy-3.5,2.3,0,Math.PI*2);c.fill();c.restore();
  c.strokeStyle='#160c08';c.lineWidth=3.4;c.lineCap='round';c.beginPath();c.moveTo(...P(...inner));c.quadraticCurveTo(...P(...up),...P(outer[0]+s*.012,outer[1]+.006));c.stroke(); // lashes on the upper lid
  c.strokeStyle=rgba(0x2a1610,.45);c.lineWidth=1.4;c.beginPath();c.moveTo(...P(...inner));c.quadraticCurveTo(...P(...down),...P(...outer));c.stroke();}
 // eyebrows, hair by hair: upright at the inner end, combed outwards along the arch
 for(const s of [-1,1])for(let i=0;i<120;i++){const t=rnd(),l=s*(.12+t*.34),f=.2+Math.sin(Math.min(1,t*1.4)*Math.PI*.62)*.05-(t>.7?(t-.7)*.08:0)+(rnd()-.5)*.03*(1-t*.6),[x,y]=P(l,f),ang=t<.2?-1.35:-.35+t*.2,len=7+rnd()*5;
  c.strokeStyle=rgba(col(hair).lerp(col(0x000000),.15).getHex(),.55+rnd()*.35);c.lineWidth=1.3+rnd()*1.1;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(ang)*len*s,y+Math.sin(ang)*len*.6);c.stroke();}
 // lips: a cupid's bow upper lip, a fuller lower lip with a highlight, a dark mouth line
 {const lipCol=col(skin).lerp(col(dark?0x5a2a24:0xa8504a),dark?.35:.42),[mx,my]=P(0,-.375),w=.23*PXR;
  c.fillStyle=css(lipCol.clone().lerp(col(0x1a0d08),.12));c.beginPath();c.moveTo(mx-w,my);c.quadraticCurveTo(mx-w*.5,my-10,mx-w*.17,my-11);c.quadraticCurveTo(mx,my-7,mx+w*.17,my-11);c.quadraticCurveTo(mx+w*.5,my-10,mx+w,my);c.closePath();c.fill();
  c.fillStyle=css(lipCol);c.beginPath();c.moveTo(mx-w*.92,my);c.quadraticCurveTo(mx,my+20,mx+w*.92,my);c.closePath();c.fill();
  blob(0,-.42,16,4,0xffffff,.22);c.strokeStyle=css(lipCol.clone().lerp(col(0x100604),.6));c.lineWidth=2.2;c.beginPath();c.moveTo(mx-w,my);c.quadraticCurveTo(mx,my+3,mx+w,my);c.stroke();
  for(const s of [-1,1])blob(s*.23,-.375,5,5,0x1a0d08,.35);}
 curve([[0,-.18],[0,-.29]],5,rgba(0x2a1610,.07)); // philtrum
 // hair colour under the hairline (soft edge)
 if(style!=='crane'){c.fillStyle=hair;for(let x=0;x<FACE_W;x+=2){const l=(x-FACE_W/2)/PXR,y=P(0,hairline(l))[1];c.globalAlpha=.9;c.fillRect(x,0,2,y-5);for(let k=0;k<6;k++){c.globalAlpha=.9*(1-k/6);c.fillRect(x,y-5+k*2,2,2);}}c.globalAlpha=1;
  for(let i=0;i<3500;i++){const l=(rnd()-.5)*2*Math.PI,f=hairline(l)-rnd()*.04,[x,y]=P(l,f);c.fillStyle=rgba(col(hair).getHex(),.5);c.fillRect(x,y,1.3,1.3);}}
 else blob(0,.95,300,60,0xffffff,.08);
 // stubble, beard or goatee
 if(beard){const mask=(l,f)=>beardMask(beard,l,f);if(beard==='barbe')for(let i=0;i<9000;i++){const l=(rnd()-.5)*2.8,f=-.02-rnd()*1.05;if(mask(l,f)){const [x,y]=P(l,f);c.fillStyle=rgba(col(hair).getHex(),.35);c.fillRect(x-2,y-2,5,5);}}
  const dense=beard==='barbe'?1:beard==='bouc'?.9:.45,hc=col(hair).getHex();
  for(let i=0;i<26000*dense;i++){const l=(rnd()-.5)*2.8,f=-.02-rnd()*1.05;if(!mask(l,f))continue;const [x,y]=P(l,f);c.fillStyle=rgba(hc,beard==='barbe3j'?.42:.75);c.fillRect(x,y,beard==='barbe3j'?1.2:1.8,beard==='barbe3j'?1.2:2.6);}}
 const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
 // roughness: matte skin, glossy eyes and lips, a little shine on the nose and forehead
 const rv=make(256,128),r=rv.getContext('2d'),RP=(l,f)=>[128+l*256/(2*Math.PI),64-f*256/(2*Math.PI)];r.fillStyle='rgb(170,170,170)';r.fillRect(0,0,256,128);
 const spot=(l,f,rx,ry,v)=>{const [x,y]=RP(l,f);r.fillStyle=`rgb(${v},${v},${v})`;r.beginPath();r.ellipse(x,y,rx,ry,0,0,Math.PI*2);r.fill();};
 for(const s of [-1,1])spot(s*.3,.095,3.4,1.6,35);spot(0,-.4,5,2,95);spot(0,-.08,3,4,120);spot(0,.45,18,5,140);if(style!=='crane'){r.fillStyle='rgb(235,235,235)';for(let x=0;x<256;x++){const y=RP(0,hairline((x-128)*2*Math.PI/256))[1];r.fillRect(x,0,1,y);}}
 const roughnessMap=new T.CanvasTexture(rv);
 // bump: pores everywhere, stubble in the beard, lips and eyelids slightly raised
 const bv=make(512,256),b=bv.getContext('2d'),BP=(l,f)=>[256+l*512/(2*Math.PI),128-f*512/(2*Math.PI)];b.fillStyle='rgb(128,128,128)';b.fillRect(0,0,512,256);for(let i=0;i<14000;i++){const v=110+Math.floor(rnd()*36);b.fillStyle=`rgb(${v},${v},${v})`;b.fillRect(rnd()*512,rnd()*256,1,1);}
 const bmap=new T.CanvasTexture(bv);const t={map,roughnessMap,bumpMap:bmap};this.faces.set(key,t);return t;}
hairTexture(hair,style){const key='hair|'+hair+'|'+style;this.faces=this.faces||new Map();if(this.faces.has(key))return this.faces.get(key);
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;const c=cv.getContext('2d');if(typeof c?.fillRect!=='function'||typeof c.arc!=='function'){const t={map:new T.CanvasTexture(cv)};this.faces.set(key,t);return t;}
 const base=new T.Color(hair),shade=(k,a)=>{const cl=base.clone().lerp(new T.Color(k>0?0xffffff:0x000000),Math.abs(k));return `rgba(${Math.round(cl.r*255)},${Math.round(cl.g*255)},${Math.round(cl.b*255)},${a})`;};let seed=hair.length*97+style.length*13;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 c.fillStyle='#'+base.getHexString();c.fillRect(0,0,512,256);
 const curly=style==='boucles'||style==='afro';
 for(let i=0;i<(curly?5200:6500);i++){const x=rnd()*512,y=rnd()*256,k=(rnd()-.55)*.5;c.strokeStyle=shade(k,.5);c.lineWidth=curly?1.6:1.1;c.beginPath();
  if(curly){const r=2+rnd()*3.5;c.arc(x,y,r,rnd()*6,rnd()*6+3.5);}
  else{/* strands flow from the crown down and, at the front, back over the head */const len=8+rnd()*16,sway=(rnd()-.5)*4,dir=style==='plaque'&&y>70?-1:1;c.moveTo(x,y);c.quadraticCurveTo(x+sway,y+len*.5*dir,x+sway*2,y+len*dir);}
  c.stroke();}
 const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;map.wrapS=T.RepeatWrapping;map.anisotropy=4;const t={map,bumpMap:map};this.faces.set(key,t);return t;}
// Shared geometry: built once per shape, reused by every player (and kept when players are cleared).
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
 // Lot 5 · athletic body: sculpted torso in kit fabric, shorts with a waistband, shared geometry.
 const shirtMat=this.kitMaterial(color,trim,'shirt',{num,name:displayName,ink:shirtInk(color)}),sleeveMat=this.kitMaterial(color,trim,'shirt'),shortMat=this.kitMaterial(shorts,trim,'shorts'),skinMat=new T.MeshStandardMaterial({color:skin,roughness:.55}),sockMat=new T.MeshStandardMaterial({color:sock,roughness:.78}),trimMat=new T.MeshStandardMaterial({color:trim,roughness:.6});
 const M=(geo,mat,parent,px=0,py=0,pz=0)=>{const m=new T.Mesh(geo,mat);m.position.set(px,py,pz);m.castShadow=true;parent.add(m);return m;};
 const body=M(this.shared('torso',()=>tube(BODY.torso)),shirtMat,pose,0,.9-1,0);
 const collar=M(this.shared('collar',()=>new T.TorusGeometry(.07,.014,8,24)),trimMat,pose,0,.558,.008);collar.rotation.x=Math.PI/2;collar.scale.y=.85;
 M(this.shared('pelvis',()=>tube(BODY.pelvis)),shortMat,pose,0,.86-1,0);
 {const neck=add(pose,new T.CylinderGeometry(.052,.064,.13,16),skin,0,1.58,.012);neck.scale.z=.92;neck.rotation.x=-.12;}
 // Lot 4 · sculpted head, painted face, ears, sculpted hair (eight cuts) and a beard with volume.
 const shape=seed%FACE_SHAPES.length,style=own?(HAIR_STYLES.includes(this.appearance.hairStyle)?this.appearance.hairStyle:'degrade'):HAIR_STYLES[(seed*7+3)%HAIR_STYLES.length],hv=FACE_SHAPES[shape],HY=.7,HZ=.006;
 const face=this.faceTexture(skin,hair,eyes[seed%eyes.length],beard,style);
 const faceMat=new T.MeshPhysicalMaterial({map:face.map,roughnessMap:face.roughnessMap||null,bumpMap:face.bumpMap||null,bumpScale:.5,roughness:face.roughnessMap?1:.7,sheen:.35,sheenRoughness:.7,sheenColor:new T.Color(0xff9a80)});/* sheen: the warm halo of light through skin at grazing angles */
 const head=new T.Mesh(this.headGeometry(shape),faceMat);head.position.set(0,HY,HZ);head.castShadow=true;head.name='Visage';pose.add(head);
 for(const side of [-1,1]){const p=headPoint(-side*1.6,.02,hv),ear=this.mesh(new T.SphereGeometry(.026,14,10),skin);ear.position.set(p.x-side*.003,HY+p.y,HZ+p.z+.004);ear.scale.set(.26,1,.62);ear.rotation.y=-side*.3;ear.castShadow=true;ear.name='Oreille';pose.add(ear);
  const bowl=this.mesh(new T.SphereGeometry(.017,10,8),new T.Color(skin).multiplyScalar(.72).getHex());bowl.position.set(side*.006,.002,-.002);bowl.scale.set(.5,1,.8);ear.add(bowl);}
 if(style!=='crane'){const ht=this.hairTexture(hair,style),hm=new T.MeshStandardMaterial({map:ht.map,bumpMap:ht.bumpMap||null,bumpScale:1,roughness:.75});const hairMesh=new T.Mesh(this.hairGeometry(shape,style,seed),hm);hairMesh.position.set(0,HY,HZ);hairMesh.castShadow=true;hairMesh.name='Cheveux';pose.add(hairMesh);
  if(style==='chignon'){const p=headPoint(Math.PI,.66,hv,.14),bun=new T.Mesh(new T.SphereGeometry(.043,16,12),hm);bun.position.set(p.x,HY+p.y,HZ+p.z);bun.scale.set(1,.9,.9);pose.add(bun);}}
 const legs=[],knees=[],arms=[],elbows=[],hands=[];
 for(const side of [-1,1]){
  const hip=new T.Group();hip.position.set(side*.094,-.04,0);pose.add(hip);legs.push(hip);
  M(this.shared('thigh',()=>tube(BODY.thigh,-.45)),skinMat,hip);
  const knee=new T.Group();knee.position.y=-.43;hip.add(knee);knees.push(knee);
  const short=M(this.shared('shortLeg',()=>tube(BODY.shortLeg,-.24)),shortMat,hip);short.name='Jambe du short';
  M(this.shared('sock',()=>tube(BODY.sock,-.43)),sockMat,knee);
  const boot=new T.Group();boot.position.set(0,-.43,-.03);knee.add(boot);
  M(this.shared('boot',bootGeometry),new T.MeshStandardMaterial({color:boots,roughness:.38}),boot);M(this.shared('sole',()=>new T.BoxGeometry(.07,.012,.235)),this.soleMat||(this.soleMat=new T.MeshStandardMaterial({color:0x1b1d1d,roughness:.8})),boot,0,-.019,-.035);
  M(this.shared('kneecap',()=>new T.SphereGeometry(.056,14,10)),skinMat,knee).scale.set(1,1.1,1.05);
  M(this.shared('band',()=>new T.CylinderGeometry(.062,.062,.03,16,1,true)),trimMat,knee,0,-.035,0);
  const shoulder=new T.Group();shoulder.position.set(side*.224,.5,0);pose.add(shoulder);arms.push(shoulder);
  M(this.shared('delt',()=>new T.SphereGeometry(.06,18,12)),sleeveMat,shoulder,-side*.012,-.014,0).scale.set(1,.9,1.1);
  M(this.shared('sleeve',()=>tube(BODY.sleeve,-.175)),sleeveMat,shoulder);
  M(this.shared('cuff',()=>new T.CylinderGeometry(.056,.055,.02,18,1,true)),keeper?sleeveMat:trimMat,shoulder,0,-.165,0);
  M(this.shared(keeper?'kArm':'upperArm',()=>tube(keeper?BODY.keeperArm:BODY.upperArm,-.27)),keeper?sleeveMat:skinMat,shoulder);
  const elbow=new T.Group();elbow.position.y=-.27;shoulder.add(elbow);elbows.push(elbow);
  M(this.shared(keeper?'kFore':'forearm',()=>tube(keeper?BODY.keeperFore:BODY.forearm,-.26)),keeper?sleeveMat:skinMat,elbow);M(this.shared('elbowJ',()=>new T.SphereGeometry(.04,12,10)),keeper?sleeveMat:skinMat,elbow);
  const hand=keeper?M(this.shared('glove',()=>new T.SphereGeometry(.085,14,10)),this.gloveMat||(this.gloveMat=new T.MeshStandardMaterial({color:0xe9eeee,roughness:.6})),elbow,0,-.28,0):M(this.shared('hand',handGeometry),skinMat,elbow,0,-.285,0);if(keeper)hand.scale.set(.8,1.2,.62);hands.push(hand);
  if(!keeper){const thumb=M(this.shared('thumb',()=>new T.SphereGeometry(.015,8,6)),skinMat,hand,-side*.026,.012,-.014);thumb.scale.set(1,1.8,1);}
 }
 body.userData.marking={ink:shirtInk(color),number:num,displayName};/* printed on the shirt fabric (see kitTexture) */
 if(own){const ring=new T.Mesh(new T.RingGeometry(.62,.78,36),new T.MeshBasicMaterial({color:0xd3f96a,side:T.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;g.add(ring);}
 this.scene.add(g);const p={g,pose,body,arms,elbows,legs,knees,hands,keeper,lastAngle:keeper?Math.PI:0,stride:own?0:seed,idle:seed*.37};this.players.push(p);return p;
}
clearPlayers(){for(const p of this.players){this.scene.remove(p.g);p.g.traverse(o=>{if(o.geometry&&!o.geometry.userData?.shared)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});}this.players=[];}
setup(a){this.action=a;this.camPos=null;this.cinePos=null;this.clearPlayers();this.referee=null;this.hero=this.makePlayer(a.hero.x,a.hero.z,0x63b9f4,this.appearance.number,true,false,this.appearance.name||'Espoir');this.teammates=(a.teammates||[a.receiver]).filter(Boolean).map((t,i)=>this.makePlayer(t.x,t.z,0x63b9f4,t.number||11+i,false,false,t.name||['Martin','Lopez','Morel','Diallo','Petit','Garcia','Leroy','Roux','Faye','Blanc'][i%10]));this.receiver=this.teammates[0]||null;this.defenders=a.defenders.map((d,i)=>this.makePlayer(d.x,d.z,0xd96955,d.number||4+i,false,false,d.name||['Bernard','Thomas','Robert','Dubois','Laurent','Michel','Simon','Durand','Adam','Henry'][i%10]));this.keeper=this.makePlayer(a.keeper.x,a.keeper.z,0xe5c45c,1,false,true,'Gardien');
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
  p.legs[i].rotation.set(hip,0,0);p.knees[i].rotation.x=clamp(knee,-2,0);p.knees[i].children[1].rotation.x=-hip-p.knees[i].rotation.x;
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
  else if(c==='slide'){p.pose.position.y=.42;p.pose.rotation.x=.38;p.legs.forEach(l=>l.rotation.x=1.25);p.knees.forEach(k=>{k.rotation.x=-2;k.children[1].rotation.x=.75;});p.arms[0].rotation.set(-.3,0,-1.9);p.arms[1].rotation.set(-.3,0,1.9);p.elbows.forEach(e=>e.rotation.x=0);}
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
   else if(c==='meditation'){p.pose.position.y=.4;L.forEach((l,i)=>l.rotation.set(1.45,0,(i?1:-1)*.75));K.forEach(k=>{k.rotation.x=-2.35;k.children[1].rotation.x=.6;});A.forEach((arm,i)=>arm.rotation.set(.55,0,(i?1:-1)*.38));E.forEach(e=>e.rotation.x=.6);p.pose.rotation.x=-.05;}
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

 const joints=[p.pose,...p.legs,...p.knees,...p.arms,...p.elbows];if(p.previousPose){const blend=1-Math.exp(-dt*22);joints.forEach((j,i)=>{for(const axis of ['x','y','z'])j.rotation[axis]=p.previousPose[i][axis]+(j.rotation[axis]-p.previousPose[i][axis])*blend;});}if(!(a.kickTimer>=0&&a.kickTimer<.65)&&!a.challenge&&!(a.skillTimer>=0&&a.skillTimer<.65))p.knees.forEach((k,i)=>k.children[1].rotation.x=-p.legs[i].rotation.x-k.rotation.x);p.previousPose=joints.map(j=>({x:j.rotation.x,y:j.rotation.y,z:j.rotation.z}));
}
heldBallPosition(){this.keeper.g.updateMatrixWorld(true);const left=this.keeper.hands[0].getWorldPosition(new T.Vector3()),right=this.keeper.hands[1].getWorldPosition(new T.Vector3());return left.add(right).multiplyScalar(.5).add(new T.Vector3(0,0,.12));}
render(a,dt,now){this.stepCity(now,dt);this.updateNets(dt);if(a===this.action){if(a.cardShow)this.cardView(a,dt);else if(a.cinematic&&a.celebration?.scorer)this.cineView(a,dt);else this.followCamera(a,dt);}this.stepRain(dt);this.animateCrowd(now,a.outcomeKind==='goal');const ball=a.ball;const turnover=a.ballControl==='defender'&&a.after<1.1;const travelling=a.phase==='interval'||a.phase==='incoming'||a.flying||a.phase==='dribble'||a.phase==='skill'||turnover;this.ball.position.set(ball.x,ball.y-(R-BALL_VISUAL),ball.z);if(travelling){this.ball.rotation.x-=dt*(a.phase==='dribble'||a.phase==='skill'||turnover?10:Math.abs(ball.vz)*1.8);this.ball.rotation.z+=dt*(ball.vx||0);}
 this.shadow.position.set(ball.x,.04,ball.z);this.shadow.scale.setScalar((1+ball.y*.12)*.72);this.shadow.material.opacity=Math.max(.06,.4-ball.y*.04);
 const fz=!!a.frozen;this.posePlayer(this.hero,a.hero,dt,now,fz);(this.teammates||[]).forEach((p,i)=>this.posePlayer(p,(a.teammates||[a.receiver])[i],dt,now,fz));this.defenders.forEach((p,i)=>this.posePlayer(p,a.defenders[i],dt,now,fz));this.posePlayer(this.keeper,a.keeper,dt,now,fz);if(this.linesman&&a.offsideLine!=null){const target=clamp(a.offsideLine,GOAL_Z,(GOAL_Z+PITCH.far)/2),prev=this.lineZ??target;this.lineZ=prev+(target-prev)*Math.min(1,dt*4);const sp=Math.abs(this.lineZ-prev)/Math.max(dt,1e-3);this.posePlayer(this.linesman,{x:-PITCH.W-1.1,z:this.lineZ,angle:-Math.PI/2,speed:fz?0:sp},dt,now,fz);if(a.flag){this.linesman.arms[1].rotation.set(0,0,2.9);this.linesman.elbows[1].rotation.x=0;}}this.drawRuns(a);this.drawReferee(a,dt,now);if(a.ballControl==='held'){this.ball.position.copy(this.heldBallPosition());this.shadow.position.set(this.ball.position.x,.04,this.ball.position.z);}this.renderer.render(this.scene,this.camera);
}
}
// Lot 5 · "Mon joueur" studio: the player alone on a lit turntable. Drag to turn him; the camera frames the whole
// body or moves in on the face. Thumbnails of every haircut and beard are rendered with the same lights.
export class Locker{
constructor(canvas){this.canvas=canvas;const r=this.r=new T.WebGLRenderer({canvas,antialias:true});r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
 const e=this.e=Object.create(Pitch3D.prototype);e.scene=new T.Scene();e.players=[];e.appearance={};const s=this.scene=e.scene;s.background=new T.Color('#101b16');s.fog=new T.Fog('#101b16',7,16);
 s.add(new T.HemisphereLight(0xe8f3ff,0x24402c,1.4));const key=new T.DirectionalLight(0xfff1dc,3.2);key.position.set(-2.5,4,-4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=key.shadow.camera.bottom=-2;key.shadow.camera.right=key.shadow.camera.top=2;s.add(key);
 const rim=new T.DirectionalLight(0x9fd8ff,2.2);rim.position.set(3,3,4);s.add(rim);const fill=new T.DirectionalLight(0xd3f96a,.5);fill.position.set(3,1,-3);s.add(fill);
 const c=document.createElement('canvas');let floorMat=new T.MeshStandardMaterial({color:0x1d3a2a,roughness:.9});if(c.getContext?.('2d')?.createRadialGradient){c.width=c.height=256;const g=c.getContext('2d'),gr=g.createRadialGradient(128,128,10,128,128,128);gr.addColorStop(0,'#3d7a45');gr.addColorStop(.62,'#25502f');gr.addColorStop(.7,'#d3f96a');gr.addColorStop(.72,'#1c3a26');gr.addColorStop(1,'#101b16');g.fillStyle=gr;g.fillRect(0,0,256,256);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;floorMat=new T.MeshStandardMaterial({map:t,roughness:.85});}
 const floor=new T.Mesh(new T.CircleGeometry(1.6,48),floorMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;s.add(floor);
 this.cam=new T.PerspectiveCamera(30,1,.05,40);this.yaw=.35;this.view='body';this.camT={y:1,d:4.4,look:1};this.camNow={...this.camT};
 const at=e=>e.touches?e.touches[0]:e;canvas.addEventListener('pointerdown',ev=>{this.dragX=ev.clientX;this.touched=performance.now();canvas.setPointerCapture?.(ev.pointerId);});canvas.addEventListener('pointermove',ev=>{if(this.dragX==null)return;this.yaw-=(ev.clientX-this.dragX)*.012;this.dragX=ev.clientX;this.touched=performance.now();});const up=()=>{this.dragX=null;};canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.style.touchAction='none';}
setAppearance(app){const e=this.e;if(this.p){e.scene.remove(this.p.g);this.p.g.traverse(o=>{if(o.geometry&&!o.geometry.userData?.shared)o.geometry.dispose();});e.players=[];}e.appearance=app;const p=this.p=e.makePlayer(0,0,0x63b9f4,app.number||9,true,false,(app.name||'Joueur').slice(0,14));p.g.children.filter(o=>o.geometry?.type==='RingGeometry').forEach(o=>o.visible=false);p.g.traverse(o=>{if(o.isMesh)o.castShadow=true;});}
setView(v){this.view=v;this.camT=v==='face'?{y:1.72,d:1.05,look:1.69}:{y:1.05,d:4.4,look:.98};}
resize(){const w=this.canvas.clientWidth,h=this.canvas.clientHeight;if(!w||!h)return;if(this.w!==w||this.h!==h){this.w=w;this.h=h;this.r.setSize(w,h,false);this.cam.aspect=w/h;this.cam.updateProjectionMatrix();}}
frame(now){if(!this.running)return;const dt=Math.min(.05,(now-(this.last||now))/1000);this.last=now;this.resize();if(performance.now()-(this.touched||0)>2500)this.yaw+=dt*.35;
 for(const k of ['y','d','look'])this.camNow[k]+=(this.camT[k]-this.camNow[k])*Math.min(1,dt*5);const c=this.camNow;this.cam.position.set(0,c.y,-c.d);this.cam.lookAt(0,c.look,0);
 if(this.p)this.e.posePlayer(this.p,{x:0,z:0,angle:this.yaw,speed:0,kickTimer:-1},dt,now/1000);this.r.render(this.scene,this.cam);requestAnimationFrame(t=>this.frame(t));}
start(){if(this.running)return;this.running=true;this.last=null;requestAnimationFrame(t=>this.frame(t));}
stop(){this.running=false;}
// Head-and-shoulders portraits for the option cards, rendered off screen with the studio lights.
portraits(list){const cv=document.createElement('canvas');cv.width=cv.height=192;const r=new T.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;r.setSize(192,192,false);const cam=new T.PerspectiveCamera(26,1,.05,20),out=[],keep=this.p,saved=this.e.appearance;
 for(const app of list){this.setAppearance(app);this.e.posePlayer(this.p,{x:0,z:0,angle:.45,speed:0,kickTimer:-1},.016,0);this.p.g.rotation.y=.45;this.p.lastAngle=.45;this.p.g.updateMatrixWorld(true);cam.position.set(0,1.73,-.92);cam.lookAt(0,1.67,0);r.render(this.scene,cam);out.push(cv.toDataURL('image/png'));}
 r.dispose();r.forceContextLoss?.();this.setAppearance(saved);return out;}
}
