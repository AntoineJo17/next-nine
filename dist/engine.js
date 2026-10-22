import * as T from './vendor/three.module.js';
import {R,clamp,launch,stepBall} from './physics.js?v=18-29';
// Drawn ball: 0.15 m radius (players looked like they kicked a beach ball). The physics keeps R=0.22,
// so goal-line, post and goalkeeper contacts are exactly as before.
export const BALL_VISUAL=.15;
export function shirtInk(color){const c=new T.Color(color);return .2126*c.r+.7152*c.g+.0722*c.b>.35?'#10232b':'#ffffff';}
export class Pitch3D{
constructor(canvas,appearance){this.canvas=canvas;this.appearance=appearance;this.scene=new T.Scene();this.scene.background=new T.Color('#91b9c3');this.scene.fog=new T.Fog('#91b9c3',65,130);this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.camera=new T.PerspectiveCamera(48,1,.1,260);this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.scene.add(new T.HemisphereLight(0xe7f4ff,0x466b35,2.4));const sun=new T.DirectionalLight(0xfff1cf,2.7);sun.position.set(-18,35,16);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;sun.shadow.normalBias=.04;this.scene.add(sun);this.staticWorld();this.ball=this.mesh(new T.SphereGeometry(BALL_VISUAL,20,12),0xffffff);this.ball.castShadow=true;this.scene.add(this.ball);const seam=new T.Mesh(new T.IcosahedronGeometry(BALL_VISUAL*1.005,0),new T.MeshBasicMaterial({color:0x26302e,wireframe:true}));this.ball.add(seam);this.shadow=new T.Mesh(new T.CircleGeometry(.3,20),new T.MeshBasicMaterial({color:0x10271b,transparent:true,opacity:.36,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=.025;this.scene.add(this.shadow);this.players=[];this.aim=new T.Line(new T.BufferGeometry(),new T.LineDashedMaterial({color:0xd3f96a,dashSize:.35,gapSize:.25}));this.scene.add(this.aim);this.aim.visible=false;this.targetRing=new T.Mesh(new T.RingGeometry(.27,.36,32),new T.MeshBasicMaterial({color:0xd3f96a,side:T.DoubleSide,depthTest:false}));this.targetRing.renderOrder=5;this.scene.add(this.targetRing);this.targetRing.visible=false;this.resize();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);}
mesh(geo,color){return new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.85}));}
box(x,y,z,w,h,d,color){const m=this.mesh(new T.BoxGeometry(w,h,d),color);m.position.set(x,y,z);m.receiveShadow=true;this.scene.add(m);return m;}
line(points,color=0xe2eac9){const g=new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p)));const l=new T.Line(g,new T.LineBasicMaterial({color,transparent:true,opacity:.85}));this.scene.add(l);return l;}
staticWorld(){this.box(0,-.18,3,68,.3,85,0x476a40);this.buildGrass();const y=.035;this.line([[-16,y,-20],[16,y,-20],[16,y,32],[-16,y,32],[-16,y,-20]]);this.line([[-10,y,-20],[-10,y,-7],[10,y,-7],[10,y,-20]]);this.line([[-5.5,y,-20],[-5.5,y,-15],[5.5,y,-15],[5.5,y,-20]]);this.line([[-16,y,25],[16,y,25]]);for(const [x,z,r] of [[0,25,5],[0,-11,.12]]){const pts=[];for(let i=0;i<=80;i++){const a=i/80*Math.PI*2;pts.push([x+Math.cos(a)*r,y,z+Math.sin(a)*r]);}this.line(pts);}for(const x of [-3.66,3.66])this.box(x,1.22,-20,.12,2.44,.12,0xffffff);this.box(0,2.44,-20,7.44,.12,.12,0xffffff);const netMaterial=new T.LineBasicMaterial({color:0xe9ede6,transparent:true,opacity:.4});const pts=[];for(let x=-3.66;x<=3.7;x+=.3){pts.push(new T.Vector3(x,0,-22),new T.Vector3(x,2.44,-22),new T.Vector3(x,2.44,-22),new T.Vector3(x,2.44,-20));}for(let h=0;h<=2.44;h+=.3){pts.push(new T.Vector3(-3.66,h,-22),new T.Vector3(3.66,h,-22));for(const x of [-3.66,3.66])pts.push(new T.Vector3(x,h,-22),new T.Vector3(x,h,-20));}const net=new T.LineSegments(new T.BufferGeometry().setFromPoints(pts),netMaterial);this.scene.add(net);for(const side of [-1,1])this.box(side*17,.5,-5,.25,1,28,0x172c25);for(let z=-16;z<=12;z+=14){this.box(-17.2,.6,z,.18,1.2,8,0xc9ef68);}this.box(0,.45,-23.4,30,.9,.3,0x1a312b);this.buildCrowd();this.buildStadium();this.buildCity();}
// V16 pitch: one textured surface — mowing stripes, fine blade noise and worn patches, sharp at grazing angles.
buildGrass(){const c=document.createElement('canvas');if(!c.getContext)return;c.width=1024;c.height=2048;const g=c.getContext('2d');
 for(let i=0;i<14;i++){g.fillStyle=i%2?'#3f7d48':'#367041';g.fillRect(0,i*2048/14,1024,2048/14+1);}
 const img=g.getImageData(0,0,1024,2048),d=img.data;let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let k=0;k<d.length;k+=4){const n=(rnd()-.5)*26;d[k]+=n*.6;d[k+1]+=n;d[k+2]+=n*.5;}g.putImageData(img,0,0);
 for(let i=0;i<9000;i++){const x=rnd()*1024,y=rnd()*2048;g.strokeStyle=rnd()<.5?'rgba(120,170,90,.35)':'rgba(20,60,30,.35)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+(rnd()-.5)*2,y-2-rnd()*4);g.stroke();}
 for(const [x,y,r] of [[512,1960,90],[512,330,70],[512,1200,60]]){const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(120,110,60,.14)');gr.addColorStop(1,'rgba(120,110,60,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,2*r,2*r);}
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=this.renderer?.capabilities?.getMaxAnisotropy?.()||8;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;
 const pitch=new T.Mesh(new T.PlaneGeometry(32,56),new T.MeshStandardMaterial({map:tex,roughness:.95}));pitch.rotation.x=-Math.PI/2;pitch.position.set(0,-.001,5);pitch.receiveShadow=true;this.scene.add(pitch);}
// V16 surroundings: a second tier behind the goal, taller side stands, floodlight masts and a town around the ground.
buildCity(){const group=new T.Group();group.name='Ville autour du stade';this.scene.add(group);const add=(x,y,z,w,h,d,c,mat)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat||new T.MeshStandardMaterial({color:c,roughness:.9}));m.position.set(x,y,z);group.add(m);return m;};
 const win=document.createElement('canvas');let winMat=null;if(win.getContext){win.width=64;win.height=128;const g=win.getContext('2d');g.fillStyle='#8c9aa0';g.fillRect(0,0,64,128);for(let y=6;y<128;y+=14)for(let x=5;x<64;x+=15){g.fillStyle=Math.random()<.25?'#f2e3a6':'#3c4e57';g.fillRect(x,y,9,8);}const t=new T.CanvasTexture(win);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;winMat=t;}
 const palette=[0xb9b0a2,0x9fa7a8,0xc7b79c,0x8e9a9e,0xa69384,0xd0c6b6];let seed=3;const r=()=>(seed=(seed*48271)%2147483647)/2147483647;
 for(let i=0;i<46;i++){const a=i/46*Math.PI*2,dist=62+r()*24,x=Math.cos(a)*dist*.85,z=8+Math.sin(a)*dist,w=6+r()*10,h=7+r()*22,d=6+r()*9;let mat;if(winMat){const t=winMat.clone();t.needsUpdate=true;t.repeat.set(Math.round(w/3),Math.round(h/3));mat=new T.MeshStandardMaterial({map:t,color:palette[i%palette.length],roughness:.85});}const b=add(x,h/2-.2,z,w,h,d,palette[i%palette.length],mat);b.rotation.y=-a;}
 for(let i=0;i<70;i++){const a=r()*Math.PI*2,dist=40+r()*16,x=Math.cos(a)*dist*.8,z=6+Math.sin(a)*dist;if(Math.abs(x)<26&&z>-33&&z<40)continue;const h=3+r()*3;const trunk=add(x,h*.3,z,.35,h*.6,.35,0x5b4632);const top=new T.Mesh(new T.SphereGeometry(1.3+r()*.9,8,6),new T.MeshStandardMaterial({color:r()<.5?0x2f5a34:0x3b6b3a,roughness:1}));top.position.set(x,h*.75,z);group.add(top);}
 // Upper tier behind the goal and higher side stands.
 for(let row=0;row<5;row++)add(0,7.2+row*.75,-31.5-row*1.05,34,.75,1.08,row%2?0x3e5159:0x4b6268);add(0,11.6,-34,36,.3,7,0x173f40);
 for(const side of [-1,1]){for(let row=0;row<4;row++)add(side*(21.5+row*1.1),2.6+row*.8,-6,1.1,1+row*.8,40,row%2?0x536773:0x3c525d);add(side*24.5,6.4,-6,3.5,.25,42,0x173f40);}
 for(const [x,z] of [[-22,-26],[22,-26],[-22,28],[22,28]]){add(x,11,z,.5,22,.5,0x55646a);add(x,22.2,z,3.6,1.6,.4,0xf3f0dc);}
}
buildStadium(){
 const group=new T.Group();group.name='Stade Rivage';this.scene.add(group);const part=(x,y,z,w,h,d,c)=>{const m=this.box(x,y,z,w,h,d,c);this.scene.remove(m);group.add(m);return m;};
 part(0,6.5,-30,30,.22,4.8,0x173f40);for(const x of [-14,0,14])part(x,3.25,-29,.17,6.5,.17,0x263f42);
 for(const side of [-1,1]){for(let row=0;row<3;row++)part(side*(18.5+row*.9),.45+row*.35,-10,1, .9+row*.7,23,row%2?0x536773:0x354d59);part(side*18,1,-9,.15,.8,24,0x214350);for(const z of [-22,-1]){part(side*19,4.2,z,.15,8.4,.15,0x7c9197);part(side*19,8.3,z,2,.7,.24,0xf5f0d0);}}
 for(const side of [-1,1])for(const end of [-1,1]){const z=end<0?-24:30;for(let row=0;row<4;row++){const m=part(side*(16.5+row*.7),.5+row*.4,z,6,1+row*.8,1.15,row%2?0x536773:0x354d59);m.rotation.y=side*end*Math.PI/4;m.name='Tribune d’angle';}}for(let row=0;row<4;row++)part(0,.5+row*.4,35+row,34,1+row*.8,1.1,0x354d59);for(const side of [-1,1])for(let row=0;row<3;row++)part(side*(18.5+row*.9),.45+row*.35,17,1,.9+row*.7,23,0x354d59);
 // The club name is legible on the covered home stand.
 const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#153f40';ctx.fillRect?.(0,0,1024,128);ctx.fillStyle='#d3f96a';ctx.font='bold 62px sans-serif';ctx.textAlign='center';ctx.fillText('AC RIVAGE • LE TERRAIN T’APPARTIENT',512,85);const sign=new T.Mesh(new T.PlaneGeometry(23,1.1),new T.MeshBasicMaterial({map:new T.CanvasTexture(c),side:T.DoubleSide}));sign.position.set(0,6.1,-27.7);group.add(sign);this.stadium=group;
}
buildCrowd(){
 const group=new T.Group();group.name='Public de test';this.scene.add(group);const fans=[];
 const stand=(...args)=>{const m=this.box(...args);this.scene.remove(m);group.add(m);return m;};
 for(let row=0;row<6;row++){
  const z=-24.6-row*1.05,base=.55+row*.65;
  stand(0,base/2,z,28,base,1.08,row%2?0x3e5159:0x4b6268);
  for(let col=0;col<32;col++){const x=-13.2+col*.85+(row%2)*.2;if(Math.abs(x)<.6)continue;fans.push({x,z,base,phase:(row*7+col)*.71,colour:[0x63b9f4,0xe8f3fa,0x2373a4,0x63b9f4,0x183e59][(row+col*3)%5]});}
 }
 for(const side of [-1,1])for(let row=0;row<2;row++)for(let col=0;col<24;col++)fans.push({x:side*(18.5+row*.9),z:-20+col*.8,base:.9+row*.7,phase:col*.8+row,colour:[0x63b9f4,0xe8f3fa,0x2373a4,0x63b9f4][col%4]});
 for(const side of [-1,1])for(const end of [-1,1])for(let row=0;row<3;row++)for(let col=0;col<8;col++){const u=(col-3.5)*.65;fans.push({x:side*(16.5+row*.7)+u*.707,z:(end<0?-24:30)-u*.707*side*end,base:1+row*.8,phase:col*.7,colour:col%2?0x63b9f4:0xe8f3fa});}
 const inst=(geo,count)=>{const m=new T.InstancedMesh(geo,new T.MeshStandardMaterial({color:0xffffff,roughness:.9}),count);m.frustumCulled=false;group.add(m);return m;};
 const bodies=inst(new T.CylinderGeometry(.22,.18,.53,6),fans.length),heads=inst(new T.SphereGeometry(.17,8,6),fans.length),arms=inst(new T.CylinderGeometry(.055,.055,.42,5),fans.length*2),legs=inst(new T.CylinderGeometry(.075,.065,.5,5),fans.length*2);
 const dummy=new T.Object3D();
 fans.forEach((f,i)=>{dummy.position.set(f.x,f.base+.87,f.z);dummy.rotation.set(0,0,0);dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);bodies.setColorAt(i,new T.Color(f.colour));dummy.position.y=f.base+1.32;dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);heads.setColorAt(i,new T.Color([0xe2b387,0xa77350,0x614837][i%3]));for(let side=0;side<2;side++){dummy.position.set(f.x+(side?1:-1)*.11,f.base+.3,f.z);dummy.updateMatrix();legs.setMatrixAt(i*2+side,dummy.matrix);legs.setColorAt(i*2+side,new T.Color(0x22352e));arms.setColorAt(i*2+side,new T.Color(f.colour));}});
 for(let i=0;i<fans.length;i+=13){const f=fans[i];stand(f.x,f.base+1.14,f.z-.18,.58,.08,.04,0x63b9f4);stand(f.x-.2,f.base+1.03,f.z-.18,.07,.24,.04,0xe8f3fa);}
 const flags=[];for(const side of [-1,1]){stand(side*13.5,2.6,-24.1,.06,5.2,.06,0xdce4d0);const flag=new T.Mesh(new T.PlaneGeometry(1.6,.9),new T.MeshStandardMaterial({color:side<0?0x63b9f4:0xd3f96a,side:T.DoubleSide}));flag.position.set(side*12.7,4.7,-24.1);group.add(flag);flags.push(flag);}
 this.crowd={group,fans,bodies,heads,arms,legs,dummy,flags};this.animateCrowd(0,false);
}
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
setup(a){this.action=a;this.camPos=null;this.clearPlayers();this.hero=this.makePlayer(a.hero.x,a.hero.z,0x63b9f4,this.appearance.number,true,false,this.appearance.name||'Espoir');this.teammates=(a.teammates||[a.receiver]).filter(Boolean).map((t,i)=>this.makePlayer(t.x,t.z,0x63b9f4,t.number||11+i,false,false,t.name||['Martin','Lopez','Morel','Diallo','Petit','Garcia','Leroy','Roux','Faye','Blanc'][i%10]));this.receiver=this.teammates[0]||null;this.defenders=a.defenders.map((d,i)=>this.makePlayer(d.x,d.z,0xd96955,d.number||4+i,false,false,d.name||['Bernard','Thomas','Robert','Dubois','Laurent','Michel','Simon','Durand','Adam','Henry'][i%10]));this.keeper=this.makePlayer(a.keeper.x,a.keeper.z,0xe5c45c,1,false,true,'Gardien');this.aim.visible=false;if(this.targetRing)this.targetRing.visible=false;this.ball.position.set(a.ball.x,R,a.ball.z);}
resize(){const w=this.canvas.parentElement.clientWidth,h=this.canvas.parentElement.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);const a=w/h;this.camera.aspect=a;this.camera.position.set(0,a<.85?27:26,a<.85?25:22);this.camera.fov=a<.85?Math.min(92,2*Math.atan(Math.tan(47*Math.PI/360)*.85/a)*180/Math.PI):45;this.camera.lookAt(0,0,-6);this.camera.far=180;if(this.scene.fog){this.scene.fog.near=65;this.scene.fog.far=130;}this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
 if(this.action){this.fitTeamCamera();}
}
fitTeamCamera(){this.followCamera(this.action,0,true);}
// V13.2: close camera behind the career player. It frames the player, the ball, the goal and
// partners close by, then follows the action smoothly (passes, runs, rebounds).
setWideView(on){this.wideView=!!on;}
// 26 · Rain: falling streaks around the action and a greyer sky.
setRain(on){this.raining=!!on;if(on&&!this.rain){const n=1400,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*44;pos[i*3+1]=Math.random()*20;pos[i*3+2]=(Math.random()-.5)*44;}const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));this.rain=new T.Points(g,new T.PointsMaterial({color:0xdbe8f0,size:2.2,sizeAttenuation:false,transparent:true,opacity:.7,depthWrite:false}));this.rain.frustumCulled=false;this.scene.add(this.rain);}if(this.rain)this.rain.visible=!!on;const sky=new T.Color(on?'#7d8f97':'#91b9c3');this.scene.background=sky;if(this.scene.fog)this.scene.fog.color=sky;}
stepRain(dt){if(!this.raining||!this.rain)return;const p=this.rain.geometry.attributes.position,a=p.array,c=this.camLook||{x:0,z:-8};this.rain.position.set(c.x,0,c.z);for(let i=1;i<a.length;i+=3){a[i]-=dt*14;if(a[i]<0)a[i]+=20;}p.needsUpdate=true;}
setLookYaw(v){this.lookYaw=v;}
// Run cursor: where the player is heading after a pass (pulses while the game waits for the call).
setRunCursor(p,waiting=false){if(!this.runRing){this.runRing=new T.Group();const ring=new T.Mesh(new T.RingGeometry(.45,.6,40),new T.MeshBasicMaterial({color:0x63b9f4,side:T.DoubleSide,transparent:true,opacity:.9,depthTest:false}));ring.rotation.x=-Math.PI/2;const dot=new T.Mesh(new T.CircleGeometry(.14,20),new T.MeshBasicMaterial({color:0x63b9f4,side:T.DoubleSide,depthTest:false}));dot.rotation.x=-Math.PI/2;this.runRing.add(ring,dot);this.runRing.renderOrder=6;this.scene.add(this.runRing);}
 this.runRing.visible=!!p;if(p){this.runRing.position.set(p.x,.05,p.z);this.runRing.scale.setScalar(1+(waiting?.15*Math.sin(performance.now()/160):0));}}
actorNDC(actor){const v=new T.Vector3(actor.x,1,actor.z).project(this.camera);return {x:v.x,y:v.y,behind:v.z>1};}
followCamera(a,dt,snap=false){
 if(!a?.hero)return;const cam=this.camera,h=a.hero,ball=a.ball||h,pts=[];
 const add=(x,y,z)=>pts.push(new T.Vector3(x,y,z));
 for(const x of [-3.66,3.66]){add(x,0,-20.6);add(x,2.44,-20);}
 for(const dx of [-1,1])for(const dz of [-1,1])add(h.x+dx,dz<0?1.9:0,h.z+dz);
 add(ball.x,(ball.y||0)+.3,ball.z);add(ball.x,0,ball.z);
 // Partners up to 12 m ahead or alongside stay in view (a ball out to the wing); the wide view shows the whole attacking half.
 for(const t of a.teammates||[])if(t&&(this.wideView?t.z<h.z+6:Math.hypot(t.x-h.x,t.z-h.z)<12&&t.z<h.z+3))add(t.x,1.8,t.z);
 if(this.wideView)for(const x of [-15,15])for(const z of [-20,h.z+4])add(x,0,z);
 const near=(h.x+ball.x)/2,nz=Math.max(h.z,ball.z);add(near-6,0,nz);add(near+6,0,nz);
 let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;for(const p of pts){x0=Math.min(x0,p.x);x1=Math.max(x1,p.x);z0=Math.min(z0,p.z);z1=Math.max(z1,p.z);}
 const cx=clamp((x0+x1)/2,-9,9),cz=(z0+z1)/2,elev=.66,wide=cam.aspect>1.2,top=wide?.5:.5,bottom=wide?-.9:-.66;
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

groundAtScreen(x,y){const r=this.canvas.getBoundingClientRect();const v=new T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);this.ray.setFromCamera(v,this.camera);const p=new T.Vector3();if(!this.ray.ray.intersectPlane(this.plane,p))return null;return{x:clamp(p.x,-17,17),z:clamp(p.z,-26,31)};}
actorScreen(actor){const p=new T.Vector3(actor.x,1.15,actor.z).project(this.camera),r=this.canvas.getBoundingClientRect();return{x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};}
ballScreen(){const p=this.ball.position.clone().project(this.camera),r=this.canvas.getBoundingClientRect();return{x:r.left+(p.x+1)/2*r.width,y:r.top+(1-p.y)/2*r.height};}
preview(start,end,mode,spin=0,power=null,ability=1){if(this.targetRing)this.targetRing.visible=false;if(!end){this.aim.visible=false;return;}const pts=[];
 if(mode==='dribble'){for(let i=0;i<=24;i++){const t=i/24;pts.push(new T.Vector3(start.x+(end.x-start.x)*t,.1,start.z+(end.z-start.z)*t));}}
 else{const b=launch(start,end,mode,spin,power,ability);pts.push(new T.Vector3(b.x,b.y,b.z));const d=Math.hypot(end.x-start.x,end.z-start.z);for(let i=0;i<160;i++){stepBall(b,1/90);pts.push(new T.Vector3(b.x,b.y,b.z));if(Math.hypot(b.x-start.x,b.z-start.z)>=(Math.abs(spin)>.05?Math.max(2.5,d*.4):2.5)||b.bounces>0||b.z<-19)break;}}
 this.aim.material.color.set(Math.abs(spin)>.1?0x8cdbff:0xd3f96a);this.aim.geometry.dispose();this.aim.geometry=new T.BufferGeometry().setFromPoints(pts);this.aim.computeLineDistances();this.aim.visible=true;
}
posePlayer(p,a,dt,now){
 p.g.position.set(a.x,a.y||0,a.z);let angle=a.angle??0;let difference=Math.atan2(Math.sin(angle-p.lastAngle),Math.cos(angle-p.lastAngle));p.lastAngle+=difference*Math.min(1,dt*(Math.abs(difference)>1.2?24:14));p.g.rotation.y=p.lastAngle;
 const targetSpeed=a.speed||0;p.gaitSpeed=(p.gaitSpeed||0)+(targetSpeed-(p.gaitSpeed||0))*Math.min(1,dt*7);const speed=p.gaitSpeed,running=clamp((speed-1.2)/3.2,0,1),moving=clamp(speed/1.1,0,1);
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

 if(a.kickTimer>=0&&a.kickTimer<.65){const t=a.kickTimer;const swing=t<.16?-.65*(t/.16):t<.32?-.65+(t-.16)/.16*1.9:1.25*(1-(t-.32)/.33);p.legs[1].rotation.x=swing;p.knees[1].rotation.x=t<.16?-.55:-.12;p.pose.rotation.y=-swing*.14;p.arms[0].rotation.z=-.7;}
 if(a.skillTimer>=0&&a.skillTimer<.65){const t=Math.min(a.skillTimer/.62,1),wave=Math.sin(t*Math.PI),side=a.skillSide||1,leg=side<0?0:1;p.legs[leg].rotation.x=.75*wave;p.legs[leg].rotation.z=-side*.55*wave;p.knees[leg].rotation.x=-.3*wave;p.pose.rotation.y=side*.4*wave;p.pose.rotation.z=-side*.16*wave;p.arms[1-leg].rotation.z=-side*.6;}
 if(a.challenge){const c=a.challenge,t=c.time,extend=t<.12?0:t<.32?(t-.12)/.2:t<.55?1-(t-.32)/.23:0;p.pose.rotation.x=-.35*extend;p.pose.position.y-=.12*extend;p.legs[1].rotation.x=(c.kind==='block'?1.4:.95)*extend;p.knees[1].rotation.x=-.08;p.legs[0].rotation.x=-.18*extend;p.knees[0].rotation.x=-.35*extend;p.arms[0].rotation.z=-.7*extend;p.arms[1].rotation.z=.7*extend;}
 // 29 · Celebration poses: arms up (default), aeroplane, knee slide, fist, pointing to the sky, three fingers, hands to the ears.
 if(a.celebrate){const c=a.celebrate;if(c==='plane'){p.arms[0].rotation.set(0,0,-1.45);p.arms[1].rotation.set(0,0,1.45);p.elbows.forEach(e=>e.rotation.x=0);p.pose.rotation.z=Math.sin(now*3)*.25;}
  else if(c==='slide'){p.pose.position.y=.42;p.pose.rotation.x=.38;p.legs.forEach(l=>l.rotation.x=1.25);p.knees.forEach(k=>{k.rotation.x=-2;k.children[1].rotation.x=.75;});p.arms[0].rotation.set(-.3,0,-1.9);p.arms[1].rotation.set(-.3,0,1.9);p.elbows.forEach(e=>e.rotation.x=0);}
  else if(c==='fist'||c==='hat'){p.arms[1].rotation.set(0,0,2.75);p.elbows[1].rotation.x=c==='hat'?0:-.5;p.arms[0].rotation.set(-.4,0,-.5);p.elbows[0].rotation.x=1.2;}
  else if(c==='point'){p.arms[0].rotation.set(-.25,0,-2.85);p.arms[1].rotation.set(-.25,0,2.85);p.elbows.forEach(e=>e.rotation.x=0);p.pose.rotation.x=.12;}
  else if(c==='ears'){p.arms[0].rotation.set(0,0,-2.3);p.arms[1].rotation.set(0,0,2.3);p.elbows.forEach(e=>e.rotation.x=-2.1);}
  else if(c!=='run'){p.arms[0].rotation.z=-2.15;p.arms[1].rotation.z=2.15;p.elbows[0].rotation.x=-.2;p.elbows[1].rotation.x=-.2;}}
 if(p.keeper){p.g.rotation.y=Math.PI;p.pose.rotation.set(0,0,a.tilt||0);const dive=a.state==='dive'||a.state==='ground'||a.state==='recover';if(dive){p.arms.forEach((arm,i)=>{arm.rotation.z=(i?1:-1)*2.75;arm.rotation.x=-.25;});p.legs[0].rotation.x=.15;p.legs[1].rotation.x=-.25;}else{p.pose.position.y-=.12;p.legs.forEach(l=>l.rotation.x=.22);p.knees.forEach(k=>k.rotation.x=-.45);p.arms.forEach((arm,i)=>{arm.rotation.x=a.holding?.85:.55;arm.rotation.z=(i?-1:1)*(a.holding?.5:.35);p.elbows[i].rotation.x=a.holding?.18:-.15;});}}

 const joints=[p.pose,...p.legs,...p.knees,...p.arms,...p.elbows];if(p.previousPose){const blend=1-Math.exp(-dt*22);joints.forEach((j,i)=>{for(const axis of ['x','y','z'])j.rotation[axis]=p.previousPose[i][axis]+(j.rotation[axis]-p.previousPose[i][axis])*blend;});}if(!(a.kickTimer>=0&&a.kickTimer<.65)&&!a.challenge&&!(a.skillTimer>=0&&a.skillTimer<.65))p.knees.forEach((k,i)=>k.children[1].rotation.x=-p.legs[i].rotation.x-k.rotation.x);p.previousPose=joints.map(j=>({x:j.rotation.x,y:j.rotation.y,z:j.rotation.z}));
}
heldBallPosition(){this.keeper.g.updateMatrixWorld(true);const left=this.keeper.hands[0].getWorldPosition(new T.Vector3()),right=this.keeper.hands[1].getWorldPosition(new T.Vector3());return left.add(right).multiplyScalar(.5).add(new T.Vector3(0,0,.12));}
render(a,dt,now){if(a===this.action)this.followCamera(a,dt);this.stepRain(dt);this.animateCrowd(now,a.outcomeKind==='goal');const ball=a.ball;const turnover=a.ballControl==='defender'&&a.after<1.1;const travelling=a.phase==='interval'||a.phase==='incoming'||a.flying||a.phase==='dribble'||a.phase==='skill'||turnover;this.ball.position.set(ball.x,ball.y-(R-BALL_VISUAL),ball.z);if(travelling){this.ball.rotation.x-=dt*(a.phase==='dribble'||a.phase==='skill'||turnover?10:Math.abs(ball.vz)*1.8);this.ball.rotation.z+=dt*(ball.vx||0);}
 this.shadow.position.set(ball.x,.04,ball.z);this.shadow.scale.setScalar((1+ball.y*.12)*.72);this.shadow.material.opacity=Math.max(.06,.4-ball.y*.04);
 this.posePlayer(this.hero,a.hero,dt,now);(this.teammates||[]).forEach((p,i)=>this.posePlayer(p,(a.teammates||[a.receiver])[i],dt,now));this.defenders.forEach((p,i)=>this.posePlayer(p,a.defenders[i],dt,now));this.posePlayer(this.keeper,a.keeper,dt,now);if(a.ballControl==='held'){this.ball.position.copy(this.heldBallPosition());this.shadow.position.set(this.ball.position.x,.04,this.ball.position.z);}this.renderer.render(this.scene,this.camera);
}
}
