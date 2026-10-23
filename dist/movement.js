import {clamp,GOAL_Z,G,R,PITCH} from './physics.js?v=20-7c';
// V19 · On the real 105 m pitch everybody runs 35 % faster: real sprint speeds, the same balance between players.
export const PACE=1.35;
export function moveToward(actor,target,speed,dt,acceleration=12,brake=true){speed*=PACE;acceleration*=PACE;const dx=target.x-actor.x,dz=target.z-actor.z,d=Math.hypot(dx,dz);if(d<.035){actor.speed=0;actor.vx=0;actor.vz=0;return true;}const desired=brake?Math.min(speed,Math.sqrt(16*d)):speed,tx=dx/d*desired,tz=dz/d*desired,cx=tx-(actor.vx||0),cz=tz-(actor.vz||0),change=Math.hypot(cx,cz)||1,gain=Math.min(1,acceleration*dt/change);actor.vx=(actor.vx||0)+cx*gain;actor.vz=(actor.vz||0)+cz*gain;const step=Math.hypot(actor.vx,actor.vz)*dt;if(step>=d&&actor.vx*dx+actor.vz*dz>0){actor.x=target.x;actor.z=target.z;actor.vx=actor.vz=actor.speed=0;return true;}actor.x+=actor.vx*dt;actor.z+=actor.vz*dt;actor.speed=Math.hypot(actor.vx,actor.vz);if(actor.speed>.03)actor.angle=Math.atan2(-actor.vx,-actor.vz);return false;}

export function dribbleTarget(start,target){const dx=target.x-start.x,dz=target.z-start.z,len=Math.hypot(dx,dz)||1,d=clamp(len,.25,5);return {x:clamp(start.x+dx/len*d,-PITCH.W+1,PITCH.W-1),z:clamp(start.z+dz/len*d,-19.35,PITCH.far-1)};}
export function createKeeper(){return {x:0,z:-19.25,y:0,vx:0,vz:0,speed:0,angle:Math.PI,state:'set',elapsed:0,shotTime:0,dir:0,tilt:0,reach:0,jump:0,diveStartX:0};}
export function updateKeeper(k,ball,dt,flying){k.elapsed+=dt;if(k.holding&&k.state==='set'){k.speed=0;return;}if(k.state==='set'){
 if(!k.rush){const ideal=clamp(ball.x*.24,-1.2,1.2);const old=k.x;k.x+=clamp(ideal-k.x,-1.8*dt,1.8*dt);k.speed=Math.abs(k.x-old)/dt;}
 if(flying&&ball.vz<-.2&&!k.noReact){if(!k.shotTime){k.react=.2+Math.random()*.16;/* Lot 4 · he reads the shot, he does not know it: the harder and further from him, the bigger his misjudgement */k.misread=(Math.random()-.5)*(.25+Math.hypot(ball.vx,ball.vz)*.03);}k.shotTime+=dt;if(k.shotTime>(k.react||.2)){const t=(GOAL_Z-ball.z)/ball.vz;const impact=ball.x+ball.vx*t+(k.misread||0)*Math.min(1,Math.abs(ball.x+ball.vx*t-k.x)/1.5);const height=ball.y+ball.vy*t-G*t*t/2;if(t>0&&t<.52&&Math.abs(impact)<4.8&&height<3.5){k.state='dive';k.elapsed=0;k.dir=Math.sign(impact-k.x)||1;k.diveStartX=k.x;k.diveDX=clamp(impact-k.x,-1.3,1.3);k.diveT=t;k.jump=Math.abs(k.diveDX)<.6?clamp(height-1.45,0,.85):clamp(height*.5,.2,1.2);}}}
 }else if(k.state==='dive'){
 const p=clamp(k.elapsed/.55,0,1);/* Lot 2 · the dive covers the distance to the ball: a shot at him is blocked standing, not dived away from */const dx=k.diveDX??k.dir*1.5,lat=Math.min(1,Math.abs(dx)/1.2);k.x=k.diveStartX+dx*Math.sin(p*Math.PI/2);k.tilt=k.dir*Math.min(p*2,1)*1.32*lat;const jp=clamp(k.elapsed/(2*(k.diveT||.28)),0,1);/* the jump peaks when the ball arrives */k.y=Math.sin(jp*Math.PI)*k.jump-p*.5*lat;k.reach=Math.sin(p*Math.PI/2)*.72*lat;k.speed=0;if(p>=1){k.state='ground';k.elapsed=0;}
 }else if(k.state==='ground'){k.speed=0;if(k.elapsed>.7){k.state='recover';k.elapsed=0;}}
 else if(k.state==='recover'){const p=clamp(k.elapsed/.8,0,1);k.tilt=k.dir*1.32*(1-p);k.y=-.5*(1-p);k.reach=.72*(1-p);if(p>=1){k.state='set';k.elapsed=0;k.shotTime=0;k.dir=0;}}
}
export function keeperTouches(ball,k){if(k.state==='ground')return Math.abs(ball.z-k.z)<.6&&Math.abs(ball.x-(k.x+k.dir*.45))<1&&ball.y<.65;if(k.state==='dive'){const handX=k.x+k.dir*k.reach;const handY=clamp(1.65+k.y-Math.abs(k.tilt)*.5,.5,2.6);if(Math.abs(k.diveDX??1)<.6&&Math.abs(ball.z-k.z)<.55&&Math.abs(ball.x-k.x)<.5+R&&ball.y<2.25+Math.max(0,k.y))return true;return Math.abs(ball.z-k.z)<.65&&Math.hypot(ball.x-handX,ball.y-handY)<.42+R;}
return Math.abs(ball.z-k.z)<.55&&Math.abs(ball.x-k.x)<.48+R&&ball.y<2.1;}
// Touchscreen slingshot: pulling down sends the aim upwards on screen.
export function slingPoint(start,current,anchor,gain=2.2){return {x:anchor.x+(start.x-current.x)*gain,y:anchor.y+(start.y-current.y)*gain};}

export function pressDefender(defender,carrier,ball,intent,dt,primary=true,waiting=false,cover=null,intensity=1){
 const dx=intent.x-carrier.x,dz=intent.z-carrier.z,len=Math.hypot(dx,dz)||1;
 let target=primary?{x:ball.x+dx/len*.35,z:ball.z+dz/len*.35}:cover?{x:ball.x*.45+cover.x*.55,z:ball.z*.45+cover.z*.55}:{x:carrier.x*.45+defender.home.x*.55,z:Math.max(-17,carrier.z-2.2)};
 if(waiting&&primary){const px=defender.x-carrier.x,pz=defender.z-carrier.z,d=Math.hypot(px,pz)||1;if(d<1.4){defender.speed=0;defender.vx=0;defender.vz=0;defender.angle=Math.atan2(-(carrier.x-defender.x),-(carrier.z-defender.z));return;}target={x:carrier.x+px/d*1.36,z:carrier.z+pz/d*1.36};}
 const speed=(waiting?primary?2.8:2.2:primary?3.9:3.3)*intensity;
 if(waiting){moveToward(defender,target,speed,dt);return;}
 const tx=target.x-defender.x,tz=target.z-defender.z,distance=Math.hypot(tx,tz)||1;
 const desiredX=tx/distance*speed,desiredZ=tz/distance*speed,changeX=desiredX-(defender.vx||0),changeZ=desiredZ-(defender.vz||0),change=Math.hypot(changeX,changeZ)||1,gain=Math.min(1,8*dt/change);
 defender.vx=(defender.vx||0)+changeX*gain;defender.vz=(defender.vz||0)+changeZ*gain;
 defender.x+=defender.vx*dt;defender.z+=defender.vz*dt;defender.speed=Math.hypot(defender.vx,defender.vz);if(defender.speed>.03)defender.angle=Math.atan2(-defender.vx,-defender.vz);
}
// Resolve cylinder contacts on the ground, keeping the controlled player stable.
export function separateBodies(a,b,min=.82,fixedB=false){
 let dx=a.x-b.x,dz=a.z-b.z,d=Math.hypot(dx,dz);if(d>=min)return false;
 if(d<.00001){dx=1;dz=0;d=1;const shift=fixedB?min:min/2;a.x+=shift;if(!fixedB)b.x-=shift;return true;}
 const overlap=min-d,share=fixedB?1:.5;a.x+=dx/d*overlap*share;a.z+=dz/d*overlap*share;if(!fixedB){b.x-=dx/d*overlap*.5;b.z-=dz/d*overlap*.5;}return true;
}
export function keeperGrip(k){return {x:k.x+(k.state==='dive'||k.state==='ground'?k.dir*k.reach:0),y:Math.max(R,.92+k.y),z:k.z+.42};}
export function sweptKeeperTouch(before,after,k){
 const steps=Math.max(1,Math.ceil(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)/.07));
 for(let i=0;i<=steps;i++){const t=i/steps,p={x:before.x+(after.x-before.x)*t,y:before.y+(after.y-before.y)*t,z:before.z+(after.z-before.z)*t};if(keeperTouches(p,k))return p;}return null;
}

const c0=(v,k)=>(v||0)*k;
export function beginChallenge(d,ball,kind='poke'){
 if(d.challenge||d.challengeCooldown>0)return false;
 const dx=ball.x-d.x,dz=ball.z-d.z,len=Math.hypot(dx,dz)||1;
 /* Lot 4 · a poke keeps the run going (a stab on the move), only a slide or a block plants the body */const carry=kind==='poke'?.8:0;d.challenge={kind,time:0,x:d.x,z:d.z,dx:dx/len,dz:dz/len,vx:(d.vx||0)*carry,vz:(d.vz||0)*carry};d.angle=Math.atan2(-dx,-dz);d.vx=c0(d.vx,carry);d.vz=c0(d.vz,carry);d.speed=Math.hypot(d.vx,d.vz);return true;
}
// V19 · Slide tackle: 2.6 m along the ground (decelerating), on the ground until 1.35 s, back up at 1.6 s.
export const SLIDE={length:2.6,slide:.55,down:1.35,up:1.6};
export function updateChallenge(d,dt){
 if(!d.challenge){d.challengeCooldown=Math.max(0,(d.challengeCooldown||0)-dt);return false;}
 const c=d.challenge;c.time+=dt;
 if(c.kind==='slide'){const u=Math.min(1,c.time/SLIDE.slide),e=1-(1-u)*(1-u);d.x=c.x+c.dx*SLIDE.length*e;d.z=c.z+c.dz*SLIDE.length*e;d.speed=0;if(c.time>=SLIDE.up){d.challenge=null;d.challengeCooldown=1.2;}return true;}const extend=c.time<.12?0:c.time<.32?(c.time-.12)/.2:c.time<.55?1-(c.time-.32)/.23:0;
 if(c.vx||c.vz){const k=Math.exp(-dt*1.6);c.vx*=k;c.vz*=k;c.x+=c.vx*dt;c.z+=c.vz*dt;}d.x=c.x+c.dx*.38*extend;d.z=c.z+c.dz*.38*extend;d.speed=Math.hypot(c.vx||0,c.vz||0);d.vx=c.vx||0;d.vz=c.vz||0;
 if(c.time>=.72){d.challenge=null;d.challengeCooldown=.45;}return true;
}
export function challengeHits(d,ball){
 const c=d.challenge;if(c?.kind==='slide'){if(c.time<.06||c.time>.5)return false;const fx=d.x+c.dx*.9,fz=d.z+c.dz*.9;return Math.hypot(ball.x-fx,ball.z-fz)<.45+R&&ball.y<.6;}
 if(!c||c.time<.14||c.time>.47)return false;
 const e=c.time<.32?(c.time-.12)/.2:Math.max(0,1-(c.time-.32)/.23);
 const foot={x:d.x+c.dx*.75*e,z:d.z+c.dz*.75*e,y:c.kind==='block'?.75:.28};
 return Math.hypot(ball.x-foot.x,ball.z-foot.z)<.3+R&&Math.abs(ball.y-foot.y)<.3+R;
}
