import {stepBall,R} from '../../../dist/physics.js';
for(const dt of [1/20,1/30,1/60,1/120,1/144,1/240,1/480]){const b={x:0,y:3,z:0,vx:0,vy:0,vz:0,bounces:0,age:0,spin:0};let peaks=[],prev=b.y,rising=false,tmax=0;
 for(let t=0;t<6;t+=dt){stepBall(b,dt);if(b.y>prev)rising=true;else if(rising&&b.y<prev){peaks.push(+prev.toFixed(3));rising=false;}prev=b.y;}
 console.log(dt.toFixed(4),'peaks',peaks.join(' '),'bounces',b.bounces);}
// rolling: ground pass 20 m
import {launch} from '../../../dist/physics.js';
for(const dt of [1/20,1/30,1/60,1/120,1/144,1/240]){const b=launch({x:0,z:30},{x:0,z:10},'low');let t=0;let reach=null;for(;t<6;t+=dt){stepBall(b,dt);if(b.z<=10&&!reach)reach=t;}console.log('low',dt.toFixed(4),'tArrive',reach?.toFixed(3),'z6s',b.z.toFixed(2),'v',Math.hypot(b.vx,b.vz).toFixed(2));}
