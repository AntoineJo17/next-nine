// Dépendance au pas de temps dans le jeu réel : mêmes tirs (Math.random figé) avec dt = 1/120 constant, 1/240, et le découpage
// de loop() pour des frames de 1/20, 1/30, 1/60, 1/144 s (sous-pas <= 1/120, reste inclus). L'issue doit être identique.
import {newGame,rng} from '../../../tests/gameplay-physique/_game.mjs';
const N=+process.argv[2]||120,seed=+process.argv[3]||17;const r=rng(seed);
const chunks=frame=>{const out=[];let rem=frame;while(rem>0){const d=Math.min(rem,1/120);out.push(d);rem-=d;}return out;};
const variants={'1/120':1/120,'1/240':1/240,'frame1/20':chunks(1/20),'frame1/30':chunks(1/30),'frame1/60':chunks(1/60),'frame1/144':chunks(1/144),'frame1/25(.04)':chunks(.04)};
const sum={n:0,mismatch:0,ex:[],kindsByVariant:{}};
for(let i=0;i<N;i++){
 const mode=['normal','normal','normal','lob','low'][i%5],hx=(r()-.5)*30,hz=-4+r()*25,tx=(r()-.5)*(mode==='normal'?9:24),power=.2+r()*.8,spin=(r()-.5)*2;
 const res={};
 for(const [name,dts] of Object.entries(variants)){
  const g=newGame(i+1);g.run('Math.random=()=>.5;');
  g.run(`const h=action.hero;h.x=${hx};h.z=${hz};attachBall(h);action.started=true;action.defenders.forEach((d,k)=>{d.x=30+k;d.z=40;});action.teammates.forEach(d=>{d.x=-30;d.z=30;});windUp(h,{x:${tx},z:${mode==='normal'?-21:-17}},'${mode}','hero',${spin},${mode==='normal'?power:null});`);
  const o=g.drive({dts,maxT:12,afterT:.2});res[name]=o.ended?o.kind:o.ready?'ready':'run';
  sum.kindsByVariant[name]??={};sum.kindsByVariant[name][res[name]]=(sum.kindsByVariant[name][res[name]]||0)+1;
 }
 sum.n++;if(new Set(Object.values(res)).size>1){sum.mismatch++;if(sum.ex.length<10)sum.ex.push({i,mode,hx,hz,tx,power,spin,res});}
}
console.log(JSON.stringify(sum,null,1));
