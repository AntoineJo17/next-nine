import {layout,run} from '../../../tests/gameplay-ia/defence-harness.mjs';
import {refreshDefence,defensiveTarget,distance} from '../../../dist/football-ai.js';
import {moveToward} from '../../../dist/movement.js';
let worst=1,w=-1;for(let s=1;s<=60;s++){const st=run(layout(s*17+3),{seconds:6});if((st.swaps||0)>w){w=st.swaps||0;worst=s;}}console.log('pire graine',worst,w);
const {hero,defenders,mates}=layout(worst*17+3);const partners=[hero,...mates];let press=-1,clock=0,t=0,dt=1/60;let shown=0;
const name=p=>p===hero?'H':'T'+mates.indexOf(p);
while(t<6&&shown<14){const ang=Math.atan2(-hero.x,-20-hero.z)+Math.sin(t*2.6)*.6;hero.vx=Math.sin(ang)*5.5;hero.vz=Math.cos(ang)*5.5;hero.x+=hero.vx*dt;hero.z=Math.max(-17,hero.z+hero.vz*dt);
 clock-=dt;if(clock<=0){const prevMarks=defenders.map(d=>d.mark);press=refreshDefence(defenders,hero,partners,press);clock=.18;
  defenders.forEach((d,i)=>{if(prevMarks[i]&&d.mark&&prevMarks[i]!==d.mark&&shown<14){shown++;console.log('t',t.toFixed(2),'D'+i,name(prevMarks[i]),'->',name(d.mark),'dist',distance(d,prevMarks[i]).toFixed(1),'->',distance(d,d.mark).toFixed(1),'press',press);}});}
 const ball={x:hero.x,z:hero.z-.5,vx:hero.vx,vz:hero.vz};
 defenders.forEach((d,i)=>{const T=defensiveTarget(d,hero,ball,i===press,false,{x:hero.x+hero.vx*.5,z:hero.z+hero.vz*.5});moveToward(d,T,(i===press?4.35:3.8),dt,9);});t+=dt;}
