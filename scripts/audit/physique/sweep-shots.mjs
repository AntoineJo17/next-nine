// Balayage de tirs/passes dans le jeu réel (vm) : invariants par tick. Usage : node sweep-shots.mjs [N] [seed]
import {newGame,rng} from '../../../tests/gameplay-physique/_game.mjs';
const N=+process.argv[2]||300,seed=+process.argv[3]||7;const r=rng(seed);
const modes=['normal','normal','normal','low','lob'];
const sum={n:0,nan:0,under:0,fast:0,kinds:{},bad:[],notEnded:[],oob:[]};
for(let i=0;i<N;i++){
 const g=newGame(i+1);const mode=modes[i%modes.length];
 const hx=(r()-.5)*40,hz=-8+r()*45,tx=(r()-.5)*(mode==='normal'?14:30),tz=mode==='normal'?-21:-30+r()*50,power=mode==='normal'?.08+r()*.92:null,spin=(r()-.5)*2;
 const setup=`const h=action.hero;h.x=${hx};h.z=${hz};attachBall(h);action.started=true;action.defenders.forEach((d,k)=>{d.x=${r()<.5?'30':'(k-3)*7'};d.z=${r()<.5?'40':'-5+k*4'};});windUp(h,{x:${tx},z:${tz}},'${mode}','hero',${spin},${power});`;
 g.setRandom(1000+i);g.run(setup);
 const o=g.drive({dts:r()<.5?1/120:[1/120,1/200,1/300],maxT:14,afterT:.3});sum.n++;
 const cfg={i,mode,hx:+hx.toFixed(2),hz:+hz.toFixed(2),tx:+tx.toFixed(2),tz:+tz.toFixed(2),power,spin:+spin.toFixed(2)};
 if(o.nan)sum.nan++;if(o.minY<.22-1e-6){sum.under++;sum.bad.push({...cfg,why:'minY '+o.minY});}if(o.maxSpeed>45){sum.fast++;sum.bad.push({...cfg,why:'speed '+o.maxSpeed.toFixed(1)});}
 const k=(o.kind||'none')+'/'+(o.us>0?'US':'-');sum.kinds[k]=(sum.kinds[k]||0)+1;
 if(!o.ended&&!o.ready)sum.notEnded.push({...cfg,phase:o.phase,t:o.t,fb:o.msg,fin:o.finalBall});
 if(o.jumps)sum.bad.push({...cfg,why:'jump',jumps:o.jumps});if(o.us>1)sum.bad.push({...cfg,why:'goals '+o.us});
 const fc=o.firstCross;if(fc&&Math.abs(fc.x)<3.38&&fc.y<2.16&&o.kind!=='goal')sum.bad.push({...cfg,why:'ball crossed line inside frame but outcome '+o.kind,fc,msg:o.msg});if(fc&&(Math.abs(fc.x)>=3.66+.1||fc.y>2.7)&&o.kind==='goal')sum.bad.push({...cfg,why:'goal though crossing outside',fc});
 if(o.kind==='goal'&&o.insideFrames===0)sum.bad.push({...cfg,why:'goal without ball inside'});
}
console.log(JSON.stringify(sum,null,1));
