// Tirs visés sur/près du gardien : le ballon traverse-t-il son corps ? arrêts incohérents ?
import {newGame,rng} from '../../../tests/gameplay-physique/_game.mjs';
const N=+process.argv[2]||200,seed=+process.argv[3]||5;const r=rng(seed);
const sum={n:0,kinds:{},bad:[]};
for(let i=0;i<N;i++){
 const g=newGame(i+1);const hx=(r()-.5)*10,hz=-6+r()*24,tx=(r()-.5)*5,power=.3+r()*.7,mode=r()<.8?'normal':'lob';
 g.setRandom(900+i);
 g.run(`const h=action.hero;h.x=${hx};h.z=${hz};attachBall(h);action.started=true;action.defenders.forEach(d=>{d.x=30;d.z=40;});action.teammates.forEach(d=>{d.x=-30;d.z=30;});windUp(h,{x:${tx},z:${mode==='normal'?-21:-17}},'${mode}','hero',0,${mode==='normal'?power:null});`);
 const o=g.drive({dts:1/120,maxT:10,afterT:.2});sum.n++;sum.kinds[o.kind||'none']=(sum.kinds[o.kind||'none']||0)+1;
 const fc=o.firstCross,k=o.keeperAt;if(process.argv[4]==='all')(sum.all??=[]).push({i,kind:o.kind||'none',fc,k,hx,hz,tx,power,mode});
 if(o.kind==='goal'&&fc&&k&&k.state==='set'&&Math.abs(fc.x-k.x)<.45&&fc.y<2)sum.bad.push({i,hx,hz,tx,power,mode,fc,k,why:'goal through standing keeper'});
 if(o.kind==='goal'&&fc&&k&&k.state==='dive'&&Math.abs(fc.x-(k.x+k.dir*k.reach))<.3&&fc.y<2.2)sum.bad.push({i,hx,hz,tx,power,mode,fc,k,why:'goal through diving keeper hand'});
}
console.log(JSON.stringify(sum,null,1));
