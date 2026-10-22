import * as T from './vendor/three.module.js';
import {R,clamp,launch,stepBall,PITCH,GOAL_Z} from './physics.js?v=19-8b';
// Drawn ball: 0.15 m radius (players looked like they kicked a beach ball). The physics keeps R=0.22,
// so goal-line, post and goalkeeper contacts are exactly as before.
export const BALL_VISUAL=.15;
export function shirtInk(color){const c=new T.Color(color);return .2126*c.r+.7152*c.g+.0722*c.b>.35?'#10232b':'#ffffff';}
export class Pitch3D{
constructor(canvas,appearance){this.canvas=canvas;this.appearance=appearance;this.scene=new T.Scene();this.scene.background=new T.Color('#91b9c3');this.scene.fog=new T.Fog('#91b9c3',90,220);this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.camera=new T.PerspectiveCamera(48,1,.1,320);this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.scene.add(new T.HemisphereLight(0xe7f4ff,0x466b35,2.4));const sun=new T.DirectionalLight(0xfff1cf,2.7);sun.position.set(-18,35,16);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-40;sun.shadow.camera.right=40;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.normalBias=.04;this.scene.add(sun);this.staticWorld();this.ball=this.mesh(new T.SphereGeometry(BALL_VISUAL,20,12),0xffffff);this.ball.castShadow=true;this.scene.add(this.ball);const seam=new T.Mesh(new T.IcosahedronGeometry(BALL_VISUAL*1.005,0),new T.MeshBasicMaterial({color:0x26302e,wireframe:true}));this.ball.add(seam);this.shadow=new T.Mesh(new T.CircleGeometry(.3,20),new T.MeshBasicMaterial({color:0x10271b,transparent:true,opacity:.36,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=.025;this.scene.add(this.shadow);this.players=[];this.aim=new T.Line(new T.BufferGeometry(),new T.LineDashedMaterial({color:0xd3f96a,dashSize:.35,gapSize:.25}));this.scene.add(this.aim);this.aim.visible=false;this.targetRing=new T.Mesh(new T.RingGeometry(.27,.36,32),new T.MeshBasicMaterial({color:0xd3f96a,side:T.DoubleSide,depthTest:false}));this.targetRing.renderOrder=5;this.scene.add(this.targetRing);this.targetRing.visible=false;this.resize();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);}
mesh(geo,color){return new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.85}));}
box(x,y,z,w,h,d,color){const m=this.mesh(new T.BoxGeometry(w,h,d),color);m.position.set(x,y,z);m.receiveShadow=true;this.scene.add(m);return m;}
line(points,color=0xe2eac9){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const l=new T.Line(g,new T.LineBasicMaterial({color,transparent:true,opacity:.85}));this.scene.add(l);return l;}
// V19 · Full pitch at real size (105 × 68 m): both goals and every line, advertising boards, four stands
// standing outside the field, a roof behind the attacked goal, floodlights and the town around.
staticWorld(){const W=PITCH.W,F=PITCH.far,mid=(F+GOAL_Z)/2,L=F-GOAL_Z,y=.035;
 this.box(0,-.18,mid,W*2+34,.3,L+44,0x3b6236);this.buildGrass();
 const arc=(cx,cz,r,a0,a1,n=64,sz=1)=>{const p=[];for(let i=0;i<=n;i++){const t=a0+(a1-a0)*i/n;p.push([cx+Math.cos(t)*r,y,cz+sz*Math.sin(t)*r]);}this.line(p);};
 this.line([[-W,y,GOAL_Z],[W,y,GOAL_Z],[W,y,F],[-W,y,F],[-W,y,GOAL_Z]]);this.line([[-W,y,mid],[W,y,mid]]);arc(0,mid,9.15,0,Math.PI*2,96);arc(0,mid,.16,0,Math.PI*2,12);
 for(const g of [GOAL_Z,F]){const s=g<mid?1:-1;
  this.line([[-20.16,y,g],[-20.16,y,g+s*16.5],[20.16,y,g+s*16.5],[20.16,y,g]]);this.line([[-9.16,y,g],[-9.16,y,g+s*5.5],[9.16,y,g+s*5.5],[9.16,y,g]]);
  arc(0,g+s*11,.16,0,Math.PI*2,12);const a=Math.asin(5.5/9.15);arc(0,g+s*11,9.15,a,Math.PI-a,40,s);
  for(const x of [-W,W])arc(x,g,1,x<0?(s>0?0:-Math.PI/2):(s>0?Math.PI/2:Math.PI),x<0?(s>0?Math.PI/2:0):(s>0?Math.PI:Math.PI*1.5),10);
  this.goal(g,-s);}
 this.adBoards();this.buildCrowd();this.buildStadium();this.buildCity();}
// A goal frame with its net; dir is the side the net extends to.
goal(z,dir){for(const x of [-3.66,3.66])this.box(x,1.22,z,.12,2.44,.12,0xffffff);this.box(0,2.44,z,7.44,.12,.12,0xffffff);const pts=[],back=z+dir*2;
 for(let x=-3.66;x<=3.7;x+=.3)pts.push(new T.Vector3(x,0,back),new T.Vector3(x,2.44,back),new T.Vector3(x,2.44,back),new T.Vector3(x,2.44,z));
 for(let h=0;h<=2.44;h+=.3){pts.push(new T.Vector3(-3.66,h,back),new T.Vector3(3.66,h,back));for(const x of [-3.66,3.66])pts.push(new T.Vector3(x,h,back),new T.Vector3(x,h,z));}
 this.scene.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0xe9ede6,transparent:true,opacity:.4})));}
// Advertising boards around the field: the ball rebounds on them (physics.stadiumBounds).
adBoards(){const c=document.createElement('canvas');let mat=new T.MeshStandardMaterial({color:0x173a33,roughness:.7});if(c.getContext){c.width=1024;c.height=64;const g=c.getContext('2d');const ads=['AC RIVAGE','NEXT NINE','STADE RIVAGE','LE TERRAIN T’APPARTIENT'];for(let i=0;i<4;i++){g.fillStyle=i%2?'#183f3a':'#d3f96a';g.fillRect?.(i*256,0,256,64);g.fillStyle=i%2?'#d3f96a':'#183f3a';g.font='bold 30px sans-serif';g.textAlign='center';g.fillText(ads[i],i*256+128,43,240);}const t=new T.CanvasTexture(c);t.wrapS=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;mat=new T.MeshStandardMaterial({map:t,roughness:.6});}
 const B=PITCH.board,F=PITCH.far,group=new T.Group();group.name='Panneaux';this.scene.add(group);const board=(x,z,len,alongX)=>{const m=new T.Mesh(new T.BoxGeometry(alongX?len:.18,.9,alongX?.18:len),mat.clone());if(m.material.map){m.material.map=m.material.map.clone();m.material.map.needsUpdate=true;m.material.map.repeat.set(len/16,1);}m.position.set(x,.45,z);m.receiveShadow=true;group.add(m);};
 for(const x of [-B,B])board(x,(GOAL_Z+F)/2,F-GOAL_Z+6,false);for(const z of [GOAL_Z-3.5,F+3.5]){board(-21,z,26,true);board(21,z,26,true);}
 for(const z of [26,39])this.box(-(B+1.8),1,z,1.6,2,9,0x1d3f45);}
// Pitch texture: mowing stripes every 5.25 m, blade noise and worn goalmouths and centre circle.
buildGrass(){const c=document.createElement('canvas');if(!c.getContext)return;c.width=1024;c.height=2048;const g=c.getContext('2d'),W=PITCH.W,F=PITCH.far,L=F-GOAL_Z;
 for(let i=0;i<20;i++){g.fillStyle=i%2?'#3f7d48':'#367041';g.fillRect(0,i*2048/20,1024,2048/20+1);}
 const img=g.getImageData(0,0,1024,2048),d=img.data;let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let k=0;k<d.length;k+=4){const n=(rnd()-.5)*26;d[k]+=n*.6;d[k+1]+=n;d[k+2]+=n*.5;}g.putImageData(img,0,0);
 for(let i=0;i<14000;i++){const x=rnd()*1024,y=rnd()*2048;g.strokeStyle=rnd()<.5?'rgba(120,170,90,.35)':'rgba(20,60,30,.35)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*2,y-2-rnd()*4);g.stroke();}
 for(const [x,v,r] of [[512,6/L,70],[512,1-6/L,70],[512,.5,60]]){const y=v*2048,gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(120,110,60,.14)');gr.addColorStop(1,'rgba(120,110,60,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r);}
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=this.renderer?.capabilities?.getMaxAnisotropy?.()||8;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;
 const pitch=new T.Mesh(new T.PlaneGeometry(W*2+4,L+4),new T.MeshStandardMaterial({map:tex,roughness:.95}));pitch.rotation.x=-Math.PI/2;pitch.position.set(0,-.001,(F+GOAL_Z)/2);pitch.receiveShadow=true;this.scene.add(pitch);}
// Stand geometry shared by the stadium and the crowd: rows rising away from the field.
standRows(){const B=PITCH.board,F=PITCH.far,rows=[];for(let r=0;r<10;r++){const base=.6+r*.55,off=2.4+r*.9;
  rows.push({side:'near',r,base,z:GOAL_Z-3.5-off,x0:-34,x1:34},{side:'far',r,base,z:F+3.5+off,x0:-34,x1:34},{side:'left',r,base,x:-B-off,z0:GOAL_Z-1,z1:F+1},{side:'right',r,base,x:B+off,z0:GOAL_Z-1,z1:F+1});}return rows;}
buildStadium(){const group=new T.Group();group.name='Stade Rivage';this.scene.add(group);const part=(x,y,z,w,h,d,c)=>{const m=this.box(x,y,z,w,h,d,c);this.scene.remove(m);group.add(m);return m;};
 for(const row of this.standRows()){const c=row.r%2?0x3e5159:0x4b6268;if(row.x0!=null)part(0,row.base/2,row.z,row.x1-row.x0,row.base,.92,c);else part(row.x,row.base/2,(row.z0+row.z1)/2,.92,row.base,row.z1-row.z0,c);}
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
 this.stadium=group;}
buildCrowd(){const group=new T.Group();group.name='Public de test';this.scene.add(group);const fans=[],palette=[0x63b9f4,0xe8f3fa,0x2373a4,0x63b9f4,0x183e59];
 for(const row of this.standRows()){if(row.r<1||row.r>8)continue;const spacing=1.3,along=row.x0!=null;const a0=along?row.x0:row.z0,a1=along?row.x1:row.z1;
  for(let u=a0+.6+(row.r%2)*.5;u<a1-.4;u+=spacing){if(along&&Math.abs(u)<.7)continue;const k=fans.length;fans.push({x:along?u:row.x,z:along?row.z:u,base:row.base,phase:(row.r*7+k)*.71,colour:palette[(row.r+k*3)%5]});}}
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
 const towers=[0xb9b0a2,0x9fa7a8,0xc7b79c,0x8e9a9e,0xa69384,0xd0c6b6];for(let k=0;k<44;k++){const a=k/44*Math.PI*2,x=Math.cos(a)*(RX+46+r()*20),z=mid+Math.sin(a)*((RZ1-RZ0)/2+40+r()*20);if(Math.abs(x)<RX+30&&z>RZ0-20&&z<RZ1+20)continue;const w=8+r()*12,h=9+r()*26,d=8+r()*10;let m;if(winMat){const t=winMat.clone();t.needsUpdate=true;t.repeat.set(Math.round(w/3),Math.round(h/3));m=new T.MeshStandardMaterial({map:t,color:towers[k%towers.length],roughness:.85});}add(x,h/2-.2,z,w,h,d,towers[k%towers.length],m).rotation.y=-a;}
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
makePlayer(x,z,color,num,own=false,keeper=false,displayName="Rivage"){
 // V14: more human proportions — tapered torso with shoulders, neck, ears and nose, varied hair and skin,
 // muscular thighs and calves, socks and shaped boots. The bone hierarchy is unchanged.
 const g=new T.Group(),pose=new T.Group();g.position.set(x,0,z);pose.position.y=1;g.add(pose);
 const seed=(num*37+displayName.length*11+(keeper?5:0))%97,skins=['#e8c19f','#c98b62','#a76d48','#7b4a32','#f1d0b4','#b8835c','#5c3a28'],hairs=['#28231e','#111111','#5a3a22','#a8763e','#d1b06a','#2f1d14'];
 const skin=own?this.appearance.skin:skins[seed%skins.length],hair=own?this.appearance.hair:hairs[seed%hairs.length],sock=keeper?0x30383a:color===0x63b9f4?0xeef4f6:0x2b2f33,shorts=keeper?0x30383a:color===0x63b9f4?0x183e59:0x2a2d33;
 const add=(parent,geo,c,px,py,pz)=>{const m=this.mesh(geo,c);m.position.set(px,py-1,pz);m.castShadow=true;parent.add(m);return m;};
 const torso=[[0,.01],[.175,0],[.188,.08],[.205,.28],[.232,.47],[.24,.53],[.2,.585],[.07,.6],[0,.6]].map(([r,y])=>new T.Vector2(r,y));
 const body=this.mesh(new T.LatheGeometry(torso,18),color);body.position.set(0,.955-1,0);body.scale.z=.66;body.castShadow=true;pose.add(body);
 const waist=add(pose,new T.CylinderGeometry(.18,.19,.14,14),shorts,0,.975,0);waist.scale.z=.74;
 add(pose,new T.CylinderGeometry(.058,.068,.12,10),skin,0,1.6,0);
 const head=add(pose,new T.SphereGeometry(.118,18,14),skin,0,1.735,.004);head.scale.set(.92,1.12,1);
 add(pose,new T.SphereGeometry(.07,12,8),skin,0,1.672,-.032).scale.set(1.1,.7,1);
 add(pose,new T.SphereGeometry(.02,8,6),skin,0,1.722,-.118).scale.set(.9,1,1.3);
 for(const side of [-1,1]){add(pose,new T.SphereGeometry(.026,8,6),skin,side*.108,1.73,.004).scale.set(.5,1,.8);add(pose,new T.SphereGeometry(.013,6,6),0x22261f,side*.042,1.75,-.104);}
 const style=seed%4,cap=add(pose,new T.SphereGeometry(.128,16,10,0,Math.PI*2,0,Math.PI*(style===1?.38:.5)),hair,0,1.755+(style===1?.03:0),.012);cap.scale.set(.96,style===2?1.02:1.1,1.04);
 if(style===3)add(pose,new T.SphereGeometry(.07,10,8),hair,0,1.79,.07);
 const legs=[],knees=[],arms=[],elbows=[],hands=[];
 for(const side of [-1,1]){
  const hip=new T.Group();hip.position.set(side*.1,-.04,0);pose.add(hip);legs.push(hip);
  const thigh=this.mesh(new T.CylinderGeometry(.088,.064,.43,12),skin);thigh.position.y=-.215;thigh.scale.z=1.08;hip.add(thigh);thigh.castShadow=true;
  const knee=new T.Group();knee.position.y=-.43;hip.add(knee);knees.push(knee);
  const short=this.mesh(new T.CylinderGeometry(.108,.118,.24,12),shorts);short.name='Jambe du short';short.position.y=-.105;hip.add(short);
  const shin=this.mesh(new T.CylinderGeometry(.064,.04,.4,12),sock);shin.position.y=-.2;knee.add(shin);shin.castShadow=true;
  const boot=new T.Group();boot.position.set(0,-.43,-.03);knee.add(boot);
  const sole=this.mesh(new T.BoxGeometry(.1,.07,.24),0x111414);sole.castShadow=true;boot.add(sole);const toe=this.mesh(new T.SphereGeometry(.052,10,8),0x111414);toe.position.set(0,0,-.11);toe.scale.set(1,.7,1.2);boot.add(toe);
  knee.add(this.mesh(new T.SphereGeometry(.066,10,8),skin));
  const calf=this.mesh(new T.SphereGeometry(.062,10,8),sock);calf.position.set(0,-.13,.025);calf.scale.set(1,1.8,1);knee.add(calf);
  const shoulder=new T.Group();shoulder.position.set(side*.215,.5,0);pose.add(shoulder);arms.push(shoulder);
  const sleeve=this.mesh(new T.CylinderGeometry(.07,.062,.17,12),color);sleeve.position.y=-.065;shoulder.add(sleeve);shoulder.add(this.mesh(new T.SphereGeometry(.074,12,8),color));
  const upper=this.mesh(new T.CylinderGeometry(.052,.046,.15,10),keeper?color:skin);upper.position.y=-.2;shoulder.add(upper);
  const elbow=new T.Group();elbow.position.y=-.27;shoulder.add(elbow);elbows.push(elbow);
  const forearm=this.mesh(new T.CylinderGeometry(.046,.034,.25,10),keeper?color:skin);forearm.position.y=-.125;elbow.add(forearm);elbow.add(this.mesh(new T.SphereGeometry(.047,10,8),keeper?color:skin));
  const hand=this.mesh(new T.SphereGeometry(keeper?.085:.048,8,6),keeper?0xe9eeee:skin);hand.position.y=-.28;hand.scale.set(.85,1.15,.7);elbow.add(hand);hands.push(hand);
 }
 const tex=document.createElement('canvas');tex.width=512;tex.height=512;const c=tex.getContext('2d'),ink=shirtInk(color);c.textAlign='center';c.fillStyle=ink;c.strokeStyle=ink==='#ffffff'?'#10232b':'#ffffff';c.lineWidth=8;c.lineJoin='round';c.textBaseline='middle';c.font='bold 44px sans-serif';c.strokeText?.(displayName.slice(0,14).toUpperCase(),256,77,450);c.fillText(displayName.slice(0,14).toUpperCase(),256,77,450);c.font='900 310px sans-serif';c.strokeText?.(String(num),256,303);c.fillText(String(num),256,303);
 const number=new T.Mesh(new T.PlaneGeometry(.32,.45),new T.MeshBasicMaterial({map:new T.CanvasTexture(tex),transparent:true,alphaTest:.25,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));number.name='Marquage maillot';number.userData={ink,number:num,displayName};number.position.set(0,.255,.162);pose.add(number);const front=number.clone();front.position.z=-.162;front.rotation.y=Math.PI;pose.add(front);
 if(own){const ring=new T.Mesh(new T.RingGeometry(.62,.78,36),new T.MeshBasicMaterial({color:0xd3f96a,side:T.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;g.add(ring);}
 this.scene.add(g);const p={g,pose,body,arms,elbows,legs,knees,hands,keeper,lastAngle:keeper?Math.PI:0,stride:own?0:seed,idle:seed*.37};this.players.push(p);return p;
}
clearPlayers(){for(const p of this.players){this.scene.remove(p.g);p.g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(o.material.map)o.material.map.dispose();o.material.dispose();}});}this.players=[];}
setup(a){this.action=a;this.camPos=null;this.cinePos=null;this.clearPlayers();this.hero=this.makePlayer(a.hero.x,a.hero.z,0x63b9f4,this.appearance.number,true,false,this.appearance.name||'Espoir');this.teammates=(a.teammates||[a.receiver]).filter(Boolean).map((t,i)=>this.makePlayer(t.x,t.z,0x63b9f4,t.number||11+i,false,false,t.name||['Martin','Lopez','Morel','Diallo','Petit','Garcia','Leroy','Roux','Faye','Blanc'][i%10]));this.receiver=this.teammates[0]||null;this.defenders=a.defenders.map((d,i)=>this.makePlayer(d.x,d.z,0xd96955,d.number||4+i,false,false,d.name||['Bernard','Thomas','Robert','Dubois','Laurent','Michel','Simon','Durand','Adam','Henry'][i%10]));this.keeper=this.makePlayer(a.keeper.x,a.keeper.z,0xe5c45c,1,false,true,'Gardien');
 // V19 · Assistant referee on the near touchline, level with the offside line, flag in hand.
 this.linesman=a.defenders.length?this.makePlayer(-PITCH.W-1.1,a.keeper.z,0x1c1f22,'',false,false,'Arbitre'):null;if(this.linesman){const flag=new T.Mesh(new T.PlaneGeometry(.34,.26),new T.MeshBasicMaterial({color:0xf2d23a,side:T.DoubleSide}));flag.position.set(.17,-.08,0);this.linesman.hands[1].add(flag);this.linesman.flag=flag;this.lineZ=null;}this.aim.visible=false;if(this.targetRing)this.targetRing.visible=false;this.ball.position.set(a.ball.x,R,a.ball.z);}
resize(){const w=this.canvas.parentElement.clientWidth,h=this.canvas.parentElement.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);const a=w/h;this.camera.aspect=a;this.camera.position.set(0,a<.85?27:26,a<.85?25:22);this.camera.fov=a<.85?Math.min(92,2*Math.atan(Math.tan(47*Math.PI/360)*.85/a)*180/Math.PI):45;this.camera.lookAt(0,0,-6);this.camera.far=180;if(this.scene.fog){this.scene.fog.near=90;this.scene.fog.far=220;}this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
 if(this.action){this.fitTeamCamera();}
}
fitTeamCamera(){this.followCamera(this.action,0,true);}
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
setRain(on){this.raining=!!on;if(on&&!this.rain){const n=1400,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*44;pos[i*3+1]=Math.random()*20;pos[i*3+2]=(Math.random()-.5)*44;}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));this.rain=new T.Points(g,new T.PointsMaterial({color:0xdbe8f0,size:2.2,sizeAttenuation:false,transparent:true,opacity:.7,depthWrite:false}));this.rain.frustumCulled=false;this.scene.add(this.rain);}if(this.rain)this.rain.visible=!!on;const sky=new T.Color(on?'#7d8f97':'#91b9c3');this.scene.background=sky;if(this.scene.fog)this.scene.fog.color=sky;}
stepRain(dt){if(!this.raining||!this.rain)return;const p=this.rain.geometry.attributes.position,a=p.array,c=this.camLook||{x:0,z:-8};this.rain.position.set(c.x,0,c.z);for(let i=1;i<a.length;i+=3){a[i]-=dt*14;if(a[i]<0)a[i]+=20;}p.needsUpdate=true;}
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
 p.g.position.set(a.x,a.y||0,a.z);if(frozen&&p.posed)return;p.posed=true;let angle=a.angle??0;let difference=Math.atan2(Math.sin(angle-p.lastAngle),Math.cos(angle-p.lastAngle));p.lastAngle+=difference*Math.min(1,dt*(Math.abs(difference)>1.2?24:14));p.g.rotation.y=p.lastAngle;
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
  else if(['robot','floss','disco','salsa','salto','roue','vrille','chut','coeur','salut'].includes(c)){const t=a.celebrateTime||0,A=p.arms,E=p.elbows;
   if(c==='robot'){const s=Math.floor(t*3.5)%2;A[0].rotation.set(0,0,s?-1.6:-.25);A[1].rotation.set(0,0,s?.25:1.6);E.forEach(e=>e.rotation.x=1.57);p.pose.rotation.y=(s?.25:-.25);p.pose.position.y-=.03*s;}
   else if(c==='floss'){const w=Math.sin(t*9);A.forEach((arm,i)=>arm.rotation.set(w*.7,0,(i?1:-1)*.35));E.forEach(e=>e.rotation.x=.05);p.pose.rotation.y=-w*.45;p.pose.rotation.z=w*.08;}
   else if(c==='disco'){const up=Math.sin(t*4.5)>0;A[1].rotation.set(0,0,up?2.8:-.6);E[1].rotation.x=0;A[0].rotation.set(0,0,-.5);E[0].rotation.x=1.3;p.pose.rotation.z=(up?.12:-.12);}
   else if(c==='salsa'){const w=Math.sin(t*6);p.pose.rotation.z=w*.15;p.pose.rotation.y=w*.25;A.forEach((arm,i)=>arm.rotation.set(-.3,0,(i?1:-1)*(.7+.2*w)));E.forEach(e=>e.rotation.x=1.3);p.legs[0].rotation.x=.4*w;p.legs[1].rotation.x=-.4*w;}
   else if(c==='salto'){const u=Math.min(1,t/1.1);p.pose.rotation.x=u<1?Math.PI*2*u:0;const tuck=Math.sin(Math.PI*u);p.legs.forEach(l=>l.rotation.x=1.9*tuck);p.knees.forEach(k=>k.rotation.x=-2*tuck);A.forEach((arm,i)=>arm.rotation.set(-1.2*tuck,0,(i?1:-1)*(u<1?.4:2.7)));}
   else if(c==='roue'){const u=Math.min(1,t/1);p.pose.rotation.z=u<1?Math.PI*2*u:0;p.pose.position.y+=.25*Math.sin(Math.PI*u);A.forEach((arm,i)=>arm.rotation.set(0,0,(i?1:-1)*2.8));E.forEach(e=>e.rotation.x=0);p.legs.forEach((l,i)=>l.rotation.z=(i?1:-1)*.7*Math.sin(Math.PI*u));}
   else if(c==='vrille'){const u=Math.min(1,t/.9);p.g.rotation.y+=u<1?Math.PI*2*u:0;A.forEach((arm,i)=>arm.rotation.set(-.9,0,(i?1:-1)*.3));E.forEach(e=>e.rotation.x=1.8);p.legs.forEach(l=>l.rotation.x=.3*Math.sin(Math.PI*u));}
   else if(c==='chut'){A[1].rotation.set(-1.25,0,.35);E[1].rotation.x=2.3;A[0].rotation.set(0,0,-.25);}
   else if(c==='coeur'){A.forEach((arm,i)=>arm.rotation.set(-1.05,0,(i?1:-1)*.3));E.forEach(e=>e.rotation.x=1.9);p.pose.rotation.x=-.08;}
   else if(c==='salut'){A[1].rotation.set(-1.5,0,.95);E[1].rotation.x=2.25;A[0].rotation.set(0,0,-.15);if(t>1.3)p.pose.rotation.x=-.55*Math.min(1,(t-1.3)/.4);}}
  else if(c!=='run'){p.arms[0].rotation.z=-2.15;p.arms[1].rotation.z=2.15;p.elbows[0].rotation.x=-.2;p.elbows[1].rotation.x=-.2;}}
 if(p.keeper){p.g.rotation.y=Math.PI;p.pose.rotation.set(0,0,a.tilt||0);const dive=a.state==='dive'||a.state==='ground'||a.state==='recover';if(dive){p.arms.forEach((arm,i)=>{arm.rotation.z=(i?1:-1)*2.75;arm.rotation.x=-.25;});p.legs[0].rotation.x=.15;p.legs[1].rotation.x=-.25;}else if(a.holding){p.pose.position.y-=.12;p.legs.forEach(l=>l.rotation.x=.22);p.knees.forEach(k=>k.rotation.x=-.45);p.arms.forEach((arm,i)=>{arm.rotation.x=.85;arm.rotation.z=(i?-1:1)*.5;p.elbows[i].rotation.x=.18;});}
  // V19 · Ready stance: low, feet apart, arms spread at hip height to cover the goal.
  else{const v=Math.hypot(a.x-(p.kx??a.x),a.z-(p.kz??a.z))/Math.max(dt,1e-3);p.kx=a.x;p.kz=a.z;p.shuffle=(p.shuffle||0)+dt*Math.min(v,6)*5;const step=v>.25?Math.sin(p.shuffle):0;
   // Feet apart (never crossed); when he moves he shuffles sideways, one foot after the other, with a small bounce.
   p.pose.position.y-=.17-Math.abs(step)*.04;p.pose.rotation.x=.14;p.legs.forEach((l,i)=>{l.rotation.x=.38;l.rotation.z=(i?1:-1)*(.16+.14*step*(i?1:-1));});p.knees.forEach(k=>k.rotation.x=-.7);p.arms.forEach((arm,i)=>{arm.rotation.x=.3;arm.rotation.z=(i?1:-1)*.85;p.elbows[i].rotation.x=.45;});}}

 const joints=[p.pose,...p.legs,...p.knees,...p.arms,...p.elbows];if(p.previousPose){const blend=1-Math.exp(-dt*22);joints.forEach((j,i)=>{for(const axis of ['x','y','z'])j.rotation[axis]=p.previousPose[i][axis]+(j.rotation[axis]-p.previousPose[i][axis])*blend;});}if(!(a.kickTimer>=0&&a.kickTimer<.65)&&!a.challenge&&!(a.skillTimer>=0&&a.skillTimer<.65))p.knees.forEach((k,i)=>k.children[1].rotation.x=-p.legs[i].rotation.x-k.rotation.x);p.previousPose=joints.map(j=>({x:j.rotation.x,y:j.rotation.y,z:j.rotation.z}));
}
heldBallPosition(){this.keeper.g.updateMatrixWorld(true);const left=this.keeper.hands[0].getWorldPosition(new T.Vector3()),right=this.keeper.hands[1].getWorldPosition(new T.Vector3());return left.add(right).multiplyScalar(.5).add(new T.Vector3(0,0,.12));}
render(a,dt,now){this.stepCity(now,dt);if(a===this.action){if(a.cinematic&&a.celebration?.scorer)this.cineView(a,dt);else this.followCamera(a,dt);}this.stepRain(dt);this.animateCrowd(now,a.outcomeKind==='goal');const ball=a.ball;const turnover=a.ballControl==='defender'&&a.after<1.1;const travelling=a.phase==='interval'||a.phase==='incoming'||a.flying||a.phase==='dribble'||a.phase==='skill'||turnover;this.ball.position.set(ball.x,ball.y-(R-BALL_VISUAL),ball.z);if(travelling){this.ball.rotation.x-=dt*(a.phase==='dribble'||a.phase==='skill'||turnover?10:Math.abs(ball.vz)*1.8);this.ball.rotation.z+=dt*(ball.vx||0);}
 this.shadow.position.set(ball.x,.04,ball.z);this.shadow.scale.setScalar((1+ball.y*.12)*.72);this.shadow.material.opacity=Math.max(.06,.4-ball.y*.04);
 const fz=!!a.frozen;this.posePlayer(this.hero,a.hero,dt,now,fz);(this.teammates||[]).forEach((p,i)=>this.posePlayer(p,(a.teammates||[a.receiver])[i],dt,now,fz));this.defenders.forEach((p,i)=>this.posePlayer(p,a.defenders[i],dt,now,fz));this.posePlayer(this.keeper,a.keeper,dt,now,fz);if(this.linesman&&a.offsideLine!=null){const target=clamp(a.offsideLine,GOAL_Z,(GOAL_Z+PITCH.far)/2),prev=this.lineZ??target;this.lineZ=prev+(target-prev)*Math.min(1,dt*4);const sp=Math.abs(this.lineZ-prev)/Math.max(dt,1e-3);this.posePlayer(this.linesman,{x:-PITCH.W-1.1,z:this.lineZ,angle:-Math.PI/2,speed:fz?0:sp},dt,now,fz);if(a.flag){this.linesman.arms[1].rotation.set(0,0,2.9);this.linesman.elbows[1].rotation.x=0;}}if(a.ballControl==='held'){this.ball.position.copy(this.heldBallPosition());this.shadow.position.set(this.ball.position.x,.04,this.ball.position.z);}this.renderer.render(this.scene,this.camera);
}
}
