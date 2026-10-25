// Centres : l'ailier centre, le héros reprend (tête / volée / contrôle) avec une frappe aléatoire. Invariants par tick.
import {newGame,rng} from '../../../tests/gameplay-physique/_game.mjs';
const N=+process.argv[2]||100,seed=+process.argv[3]||31;const r=rng(seed);
const sum={n:0,phases:{},kinds:{},bad:[]};
for(let i=0;i<N;i++){
 const g=newGame(i+1);g.setRandom(5000+i);
 g.run(`match.index=2;setup(true);const a=action;a.defenders.forEach((d,k)=>{if(k>1){d.x=30+k;d.z=40;}});const p=a.teammates[0];p.x=${r()<.5?-1:1}*${16+r()*10};p.z=${-10+r()*6};setupCross(p);`);
 let phase='?',o=null;
 try{
  // vol du centre jusqu'à la reprise (aerial) ou fin
  g.run(`globalThis.__cross=0;`);
  const res=JSON.parse(g.run(`(function(){let t=0;while(t<8&&!action.ended&&action.phase!=='aerial'&&!(action.ready&&action.phase!=='aerial')){tick(1/120);t+=1/120;}return JSON.stringify({phase:action.phase,t,ended:action.ended,kind:action.outcomeKind,ball:action.ball});})()`));
  phase=res.phase;sum.phases[phase]=(sum.phases[phase]||0)+1;
  if(phase==='aerial'){
   const tx=(r()-.5)*7,power=.3+r()*.7,spin=(r()-.5)*1.2;
   g.run(`windUp(action.hero,{x:${tx},z:-21},'normal','hero',${spin},${power});`);
   o=g.drive({dts:1/120,maxT:12,afterT:.2});
  }
 }catch(e){sum.bad.push({i,why:'EXC '+e.message,stack:String(e.stack).split('\n').slice(0,4).join('|')});continue;}
 sum.n++;if(o){const k=o.ended?o.kind:o.ready?'ready':'run:'+o.phase;sum.kinds[k]=(sum.kinds[k]||0)+1;
  if(o.nan||o.minY<.22-1e-6)sum.bad.push({i,why:'nan/under'});if(o.maxSpeed>45)sum.bad.push({i,why:'speed '+o.maxSpeed});
  if(!o.ended&&!o.ready)sum.bad.push({i,why:'stuck '+o.phase,fin:o.finalBall});
  if(o.jumps&&o.jumps.some(j=>j.dd>2.2))sum.bad.push({i,why:'jump',j:o.jumps.filter(j=>j.dd>2.2)});
  const fc=o.firstCross;if(fc&&Math.abs(fc.x)<3.38&&fc.y<2.16&&o.kind!=='goal')sum.bad.push({i,why:'crossed inside frame but '+o.kind,fc,k:o.keeperAt});}
}
console.log(JSON.stringify(sum,null,1));
