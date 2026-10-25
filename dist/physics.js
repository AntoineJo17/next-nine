export const G=9.81,R=.22,GOAL_Z=-20,GOAL_HALF=3.66,GOAL_HEIGHT=2.44;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// V19 · Real pitch, 105 × 68 m: the attacked goal line is z=-20, the other one z=85. Boards stand 2.5 m outside
// the lines; the stands start just behind them.
export const PITCH={W:34,far:85,board:36.5,boardEnd:3.5};
// The ball rebounds on the advertising boards and dies in the stands instead of flying through them.
export function stadiumBounds(ball){const B=PITCH.board,lo=GOAL_Z-PITCH.boardEnd,hi=PITCH.far+PITCH.boardEnd,goalMouth=Math.abs(ball.x)<3.9&&ball.y<2.6;
 const hitX=Math.abs(ball.x)>B,hitZ=ball.z<lo&&!goalMouth||ball.z>hi;if(!hitX&&!hitZ)return false;
 if(ball.y<1){if(hitX){ball.x=Math.sign(ball.x)*B;ball.vx*=-.35;}if(hitZ){ball.z=ball.z<lo?lo:hi;ball.vz*=-.35;}ball.spin=0;return true;}
 // Above the boards: into the stands, where the ball is stopped by the seats.
 const deep=Math.abs(ball.x)>B+2.4||ball.z<lo-2.4||ball.z>hi+2.4;if(deep){ball.x=clamp(ball.x,-B-2.4,B+2.4);ball.z=clamp(ball.z,lo-2.4,hi+2.4);ball.vx*=.1;ball.vz*=.1;ball.vy=Math.min(ball.vy,0);ball.spin=0;}return true;}
export function launch(start,target,mode,spin=0,power=null,ability=1){
 if(mode==='normal'&&power!==null){const dx=target.x-start.x,dz=target.z-start.z,d=Math.hypot(dx,dz)||1,p=clamp(power,.08,1),speed=(9+22*p)*ability;return {x:start.x,y:R,z:start.z,vx:dx/d*speed,vz:dz/d*speed,vy:1.2+2.8*p+Math.max(0,p-.72)*32,bounces:0,age:0,spin:clamp(spin,-1,1)};}
 const distance=Math.hypot(target.x-start.x,target.z-start.z);
 const duration=mode==='low'?clamp(distance/21,.3,1.25):mode==='lob'?clamp(distance/13,1.05,2.2):clamp(distance/23,.38,1.55);
 // A ground pass rolls; the two aerial modes use a ballistic arc.
 const factor=mode==='low'?.55/(1-Math.exp(-.55*duration))*(1+(ability-1)*.75):1/duration;
 return {x:start.x,y:R,z:start.z,vx:(target.x-start.x)*factor,vy:mode==='low'?0:G*duration/2,vz:(target.z-start.z)*factor,bounces:0,age:0,spin:clamp(spin,-1,1)};
}
export function stepBall(ball,dt){const before={...ball};ball.age+=dt;
 if(ball.spin){const turn=ball.spin*.75*Math.min(1,Math.hypot(ball.vx,ball.vz)/20)*(ball.y>R+.02?1:.12)*dt,c=Math.cos(turn),s=Math.sin(turn),vx=ball.vx;ball.vx=vx*c-ball.vz*s;ball.vz=vx*s+ball.vz*c;ball.spin*=Math.exp(-.35*dt);}
 const g=ball.dip&&ball.vy<0&&ball.y>R+.05?G*1.9:G;ball.x+=ball.vx*dt;ball.z+=ball.vz*dt;ball.y+=ball.vy*dt-g*dt*dt/2;ball.vy-=g*dt;if(ball.y<=R+.02)ball.dip=false;if(ball.y<R){ball.y=R;if(ball.vy<-.7){ball.vy=-ball.vy*.42;ball.bounces++;}else ball.vy=0;ball.vx*=Math.exp(-.55*dt);ball.vz*=Math.exp(-.55*dt);}stadiumBounds(ball);return before;}
export function goalCrossing(before,after){if(before.z>GOAL_Z-R&&after.z<=GOAL_Z-R){const k=(before.z-(GOAL_Z-R))/(before.z-after.z);const x=before.x+(after.x-before.x)*k,y=before.y+(after.y-before.y)*k;return {x,y,inside:Math.abs(x)<GOAL_HALF-R&&y<GOAL_HEIGHT-R};}return null;}
export function hitPlayer(ball,p,radius=.55,height=1.8){return Math.hypot(ball.x-p.x,ball.z-p.z)<radius+R&&ball.y<height+R;}

// Closed scoring volume: after a valid goal, the ball belongs inside the net.
export function containGoalBall(ball){
 ball.x=clamp(ball.x,-GOAL_HALF+R,GOAL_HALF-R);
 ball.z=clamp(ball.z,GOAL_Z-2+R,GOAL_Z-R);
 ball.y=clamp(ball.y,R,GOAL_HEIGHT-R);
}
export function stepNetBall(ball,dt){
 stepBall(ball,dt);
 const left=-GOAL_HALF+R,right=GOAL_HALF-R,back=GOAL_Z-2+R,front=GOAL_Z-R,roof=GOAL_HEIGHT-R;
 if(ball.x<left||ball.x>right){ball.x=clamp(ball.x,left,right);ball.vx*=-.08;ball.netContact=true;}
 if(ball.z<back||ball.z>front){ball.z=clamp(ball.z,back,front);ball.vz*=-.06;ball.netContact=true;}
 if(ball.y>roof){ball.y=roof;ball.vy=-Math.abs(ball.vy)*.1;ball.netContact=true;}
 const drag=Math.exp(-(ball.netContact?6:1.5)*dt);ball.vx*=drag;ball.vz*=drag;
 if(Math.abs(ball.vx)<.025)ball.vx=0;if(Math.abs(ball.vz)<.025)ball.vz=0;
 if(ball.y<=R+.006&&Math.abs(ball.vy)<.3){ball.y=R;ball.vy=0;}
}

// Swept sphere against cylindrical posts and crossbar, in chronological order.
export function frameContact(before,ball){
 const n=Math.max(1,Math.ceil(Math.hypot(ball.x-before.x,ball.y-before.y,ball.z-before.z)/.04)),radius=R+.06;
 for(let i=0;i<=n;i++){const t=i/n,x=before.x+(ball.x-before.x)*t,y=before.y+(ball.y-before.y)*t,z=before.z+(ball.z-before.z)*t;
  const candidates=[];if(y<=GOAL_HEIGHT+.06)for(const px of [-GOAL_HALF,GOAL_HALF])candidates.push({x:px,y,z:GOAL_Z,kind:'post'});if(Math.abs(x)<=GOAL_HALF)candidates.push({x,y:GOAL_HEIGHT,z:GOAL_Z,kind:'bar'});
  for(const c of candidates){const dx=x-c.x,dy=y-c.y,dz=z-c.z,d=Math.hypot(dx,dy,dz);if(d>radius||d<.00001)continue;const nx=dx/d,ny=dy/d,nz=dz/d,dot=ball.vx*nx+ball.vy*ny+ball.vz*nz;if(dot>=0)continue;ball.x=c.x+nx*(radius+.002);ball.y=Math.max(R,c.y+ny*(radius+.002));ball.z=c.z+nz*(radius+.002);ball.spin=0;ball.vx-=1.72*dot*nx;ball.vy-=1.72*dot*ny;ball.vz-=1.72*dot*nz;return c.kind;}
 }return null;
}

// Lot 12 · Possession : a ball won by a defender is never placed on him in one step. It rolls (at most `speed` m/s) towards the point
// where he controls it, and is pushed out of the bodies it would cross (the defender himself, the player who lost it).
export function followBall(ball,target,dt,speed=8,avoid=[]){
 const ox=ball.x,oz=ball.z,dx=target.x-ball.x,dz=target.z-ball.z,d=Math.hypot(dx,dz),step=speed*dt;
 if(d<=step){ball.x=target.x;ball.z=target.z;}else{ball.x+=dx/d*step;ball.z+=dz/d*step;}
 ball.y+=((target.y??R)-ball.y)*Math.min(1,dt*14);if(ball.y<R)ball.y=R;
 for(const q of avoid){const ex=ball.x-q.x,ez=ball.z-q.z,e=Math.hypot(ex,ez);if(e<q.r){const nx=e>1e-6?ex/e:(ox-q.x)/(Math.hypot(ox-q.x,oz-q.z)||1),nz=e>1e-6?ez/e:(oz-q.z)/(Math.hypot(ox-q.x,oz-q.z)||1);ball.x=q.x+nx*q.r;ball.z=q.z+nz*q.r;}}
 {const mx=ball.x-ox,mz=ball.z-oz,m=Math.hypot(mx,mz),cap=speed*1.6*dt;if(m>cap){ball.x=ox+mx/m*cap;ball.z=oz+mz/m*cap;}}
 ball.vx=dt>0?(ball.x-ox)/dt:0;ball.vz=dt>0?(ball.z-oz)/dt:0;ball.vy=0;
 return Math.hypot(target.x-ball.x,target.z-ball.z)<.02;
}
