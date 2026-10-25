// Prototype isolé (aucun fichier du jeu n'est modifié) : du geste (doigt/souris) au ballon, avec effet latéral, rétro/top-spin et balle sans effet.
// Repère identique au jeu : x vers la droite, y vers le haut, z négatif vers le but attaqué (ligne à z=-20, but de 7,32 m x 2,44 m, rayon du ballon .22).
(function(root){
const G=9.81,RB=.22,GOAL_Z=-20,GOAL_HALF=3.66,GOAL_H=2.44;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function rng(seed){let r=seed>>>0||1;return()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}

// ---------- Physique : gravité, traînée, Magnus (effet), rebond, balle sans effet (knuckle)
function fly(l,{T=4,dt=1/240,rand=rng(1)}={}){
 const p={x:l.x,y:l.y??RB,z:l.z},v={x:l.vx,y:l.vy,z:l.vz},w={x:l.wx||0,y:l.wy||0,z:l.wz||0},pts=[{t:0,x:p.x,y:p.y,z:p.z}];
 let t=0,goal=null,ph=rand()*6.28,bounces=0,apex=p.y;
 const knuckle=!!l.knuckle;
 while(t<T){
  const sp=Math.hypot(v.x,v.y,v.z)||1e-6;
  // traînée : a = .0133 v² (Cd .25)
  let ax=-.0133*sp*v.x,ay=-G-.0133*sp*v.y,az=-.0133*sp*v.z;
  // Magnus : a = .00586 * (w x v), plafonné (Cl <= .3)
  const wm=Math.hypot(w.x,w.y,w.z);if(wm>.01){const cl=Math.min(.3,wm*.11/sp),k=.0533*cl*sp*sp/(wm*sp);
   const cx=w.y*v.z-w.z*v.y,cy=w.z*v.x-w.x*v.z,cz=w.x*v.y-w.y*v.x;ax+=k*cx;ay+=k*cy;az+=k*cz;}
  // balle sans effet : déviation latérale lente, seulement à grande vitesse et en l'air
  if(knuckle&&sp>16&&p.y>RB+.05){const a=2.6*Math.sin(ph+t*9)+1.6*Math.sin(ph*1.7+t*14);const nx=-v.z/Math.hypot(v.x,v.z||1e-6),nz=v.x/Math.hypot(v.x,v.z||1e-6);ax+=nx*a*clamp((sp-16)/10,0,1);az+=nz*a*clamp((sp-16)/10,0,1);ay+=1.2*Math.sin(ph*.7+t*11)*clamp((sp-16)/10,0,1);}
  const bx=p.x,by=p.y,bz=p.z;
  v.x+=ax*dt;v.y+=ay*dt;v.z+=az*dt;p.x+=v.x*dt;p.y+=v.y*dt;p.z+=v.z*dt;
  const d=Math.exp(-.15*dt);w.x*=d;w.y*=d;w.z*=d;
  if(p.y<RB){p.y=RB;if(v.y<-.7){v.y=-v.y*.55;bounces++;const f=Math.exp(-.08);v.x*=f;v.z*=f;w.x*=.6;w.y*=.6;w.z*=.6;}else{v.y=0;const f=Math.exp(-.55*dt);v.x*=f;v.z*=f;}}
  apex=Math.max(apex,p.y);t+=dt;
  if(!goal&&bz>GOAL_Z-RB&&p.z<=GOAL_Z-RB){const k=(bz-(GOAL_Z-RB))/(bz-p.z),x=bx+(p.x-bx)*k,y=by+(p.y-by)*k;
   goal={x,y,t,inside:Math.abs(x)<GOAL_HALF-RB&&y<GOAL_H-RB,over:y>=GOAL_H-RB&&Math.abs(x)<GOAL_HALF,wide:Math.abs(x)>=GOAL_HALF-RB};}
  pts.push({t,x:p.x,y:p.y,z:p.z});
  if(goal&&p.z<GOAL_Z-3)break;
  if(Math.hypot(v.x,v.z)<.4&&p.y<=RB+.01&&t>1)break;
 }
 return {pts,goal,apex,bounces,landing:pts.find((q,i)=>i>2&&q.y<=RB+.001)||pts[pts.length-1],speed0:Math.hypot(l.vx,l.vy,l.vz)};
}

// ---------- Analyse du geste : points {x,y,t} en pixels écran (y vers le bas), t en ms
function analyse(points){
 const a=points[0],b=points[points.length-1],n=points.length;
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,dur=Math.max(30,b.t-a.t);
 let path=0;for(let i=1;i<n;i++)path+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 // tangentes de départ (premier quart) et de fin (dernier quart)
 const q=Math.max(1,Math.floor(n/4)),s0=points[Math.min(q,n-1)],e0=points[Math.max(0,n-1-q)];
 const t0=Math.atan2(s0.x-a.x,-(s0.y-a.y)),t1=Math.atan2(b.x-e0.x,-(b.y-e0.y));
 let turn=t1-t0;while(turn>Math.PI)turn-=2*Math.PI;while(turn<-Math.PI)turn+=2*Math.PI;
 // tremblement : écart quadratique à la corde, sans l'arc voulu (ajustement parabolique)
 let tremor=0;if(n>4){let m=0;const ux=dx/len,uy=dy/len;const pr=points.map(p=>{const X=((p.x-a.x)*ux+(p.y-a.y)*uy)/len,Y=(-(p.x-a.x)*uy+(p.y-a.y)*ux)/len;return [X,Y];});
  // Y ≈ c*X*(1-X) + d*X*(1-X)*(2X-1)
  let s11=0,s12=0,s22=0,r1=0,r2=0;for(const [X,Y] of pr){const f1=X*(1-X),f2=f1*(2*X-1);s11+=f1*f1;s12+=f1*f2;s22+=f2*f2;r1+=f1*Y;r2+=f2*Y;}
  const det=s11*s22-s12*s12||1,c=(r1*s22-r2*s12)/det,d=(r2*s11-r1*s12)/det;let ss=0;for(const [X,Y] of pr){const f1=X*(1-X);ss+=(Y-c*f1-d*f1*(2*X-1))**2;}tremor=Math.sqrt(ss/n);}
 // vitesse de fin (derniers 60 ms) : un geste qui s'arrête net vs un geste qui passe à travers
 const tail=points.filter(p=>b.t-p.t<=60),vEnd=tail.length>1?Math.hypot(b.x-tail[0].x,b.y-tail[0].y)/Math.max(10,b.t-tail[0].t)*1000:0;
 return {len,dur,speed:path/dur*1000,vEnd,heading:Math.atan2(dx,-dy),h0:t0,h1:t1,turn,tremor,start:a,end:b,path};
}

// ---------- Compétence : 0,6 (faible) .. 1,2 (excellent) ; stress : 0..1
const skillNoise=(g,skill,stress)=>{
 const speedN=clamp((g.speed-300)/1900,0,1);
 return {dir:(.020+6*g.tremor+.15*Math.max(0,speedN-.65)+.05*stress+.05*Math.abs(g.turn))/skill,pow:(.03+3*g.tremor+.08*stress)/skill,loft:(.01+.2*g.tremor)/skill};
};

// ---------- Interprétations
// ctx : {x,z} position du joueur, {contact:{ox,oy}} décalage du doigt au départ sur le ballon (en rayons, oy>0 = bas)
const PROPOSALS={
 // A — « Balayage » : on trace la trajectoire voulue, à travers le ballon.
 A(g,ctx,skill=1,stress=0,rand=rng(3)){
  const sn=skillNoise(g,skill,stress),pw=clamp((g.speed-250)/2050,0,1)*(1+sn.pow*(rand()*2-1)*1.0);
  const ox=ctx.contact?.ox||0,oy=ctx.contact?.oy||0;
  const heading=g.h0+sn.dir*(rand()*2-1)*1.7;
  const v0=clamp(11+25*pw,8,36);
  const elev=clamp((.07+.62*Math.max(0,oy))*(1+sn.loft*(rand()*2-1))-.05*Math.max(0,-oy),0,.95);
  const wy=-clamp(g.turn*1.0,-1.3,1.3)/1.3*58-ox*14,wx=(.0+Math.max(0,oy)*30-Math.max(0,-oy)*26)*(v0/28);
  return {kind:'tir',v0,heading,elev,wy,wx,knuckle:false,pw,note:'trajet tracé = trajet du ballon'};},
 // B — « Fronde » : on tire en arrière depuis le ballon (comme aujourd'hui) ; la vitesse du relâchement et la courbure du retour donnent l'effet.
 B(g,ctx,skill=1,stress=0,rand=rng(3)){
  const sn=skillNoise(g,skill,stress),pw=clamp((g.len-30)/260,0,1)*(1+sn.pow*(rand()*2-1)),
   heading=g.heading+Math.PI+sn.dir*(rand()*2-1)*1.7;
  const v0=clamp(11+25*pw,8,36),hold=ctx.holdMs||0,elev=clamp(.05+(hold>480?.45:0)+(g.end.y<g.start.y?0:0)+.5*clamp(ctx.lift||0,0,1),0,.95);
  const wy=-clamp(g.turn,-1.3,1.3)/1.3*50;return {kind:'tir',v0,heading,elev,wy,wx:0,knuckle:false,pw,note:'tirer en arrière : direction opposée, longueur = puissance'};},
 // C — « Deux temps » : 1) viser (point libre au sol, y compris hors du cadre), 2) frapper d'un geste court dont la vitesse donne la puissance et le point de départ sur le ballon l'effet.
 C(g,ctx,skill=1,stress=0,rand=rng(3)){
  const sn=skillNoise(g,skill,stress),aim=ctx.aim||{x:0,z:GOAL_Z},dxw=aim.x-ctx.x,dzw=aim.z-ctx.z;
  const pw=clamp((g.speed-250)/1800,0,1)*(1+sn.pow*(rand()*2-1));
  const ox=ctx.contact?.ox||0,oy=ctx.contact?.oy||0,heading=Math.atan2(dxw,-dzw)+sn.dir*(rand()*2-1)*1.5+ox*.0;
  const v0=clamp(11+25*pw,8,36),elev=clamp(.06+.55*Math.max(0,oy)+.2*(ctx.loftTap||0),0,.95);
  return {kind:'tir',v0,heading,elev,wy:-ox*40-clamp(g.turn,-1,1)*20,wx:Math.max(0,oy)*28-Math.max(0,-oy)*24,knuckle:false,pw,note:'visée posée au sol + frappe courte'};}
};
// Balle sans effet (coup franc) : geste droit, rapide, sans arc ni point de contact décentré, qui s'arrête net.
function isKnuckle(g,ctx){return Math.abs(g.turn)<.07&&g.tremor<.012&&g.speed>1700&&g.vEnd<650&&Math.abs(ctx.contact?.ox||0)<.2&&Math.abs(ctx.contact?.oy||0)<.2&&ctx.freekick;}

function toLaunch(res,ctx,g){
 const {v0,heading,elev,wy,wx}=res,h=Math.cos(elev)*v0;
 const knuckle=isKnuckle(g,ctx);
 return {x:ctx.x,y:RB,z:ctx.z,vx:Math.sin(heading)*h,vz:-Math.cos(heading)*h,vy:Math.sin(elev)*v0,
  // l'axe de rotation est exprimé dans le repère du tir : wy autour de la verticale, wx autour de l'axe latéral du tir
  wx:wx*Math.cos(heading)+0*Math.sin(heading),wz:-wx*Math.sin(heading)*-1,wy:wy,knuckle};
}
function play(proposal,points,ctx,{skill=1,stress=0,seed=7}={}){
 const g=analyse(points),r=PROPOSALS[proposal](g,ctx,skill,stress,rng(seed)),l=toLaunch(r,ctx,g),f=fly(l,{rand:rng(seed+1)});
 return {gesture:g,params:r,launch:l,flight:f};
}

// ---------- Générateurs de gestes d'exemple (pixels, ball au point (0,0), geste vers le haut)
function line(len,dur,{bow=0,jitter=0,seed=1,dir=0,n=20,brake=false}={}){
 const r=rng(seed),pts=[];for(let i=0;i<=n;i++){const u=i/n,e=brake?1-(1-u)*(1-u):u,X=len*e,Y=bow*len*Math.sin(Math.PI*u)*1,j=jitter*(r()-.5)*2;
  const x0=Y+j,y0=-X;pts.push({x:x0*Math.cos(dir)-y0*Math.sin(dir),y:x0*Math.sin(dir)+y0*Math.cos(dir),t:u*dur});}return pts;}
const api={G,RB,GOAL_Z,GOAL_HALF,GOAL_H,fly,analyse,PROPOSALS,play,line,rng,clamp,toLaunch,isKnuckle};
if(typeof module!=='undefined')module.exports=api;else root.NNGest=api;
})(typeof window!=='undefined'?window:globalThis);
