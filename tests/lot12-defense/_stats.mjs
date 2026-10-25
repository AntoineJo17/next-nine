import {pressing} from './_press.mjs';
const agg=(dist,opts)=>{let won=0,n=40,idle=0,step=0,reach=0,t=0;for(let seed=1;seed<=n;seed++){const r=pressing(seed,dist,opts);if(r.won)won++;idle=Math.max(idle,r.idle);step=Math.max(step,r.maxBallStep);if(r.minDist<1.3)reach++;t+=r.t;}return {dist,opts,won:won+'/'+n,reach:reach+'/'+n,idleMax:+idle.toFixed(2),ballStepMax:+step.toFixed(3),dureeMoy:+(t/n).toFixed(2)};};
console.log(agg(5,{}));console.log(agg(12,{}));console.log(agg(5,{tapEvery:20}));console.log(agg(12,{tapEvery:20}));
