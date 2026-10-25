// Balayage des scénarios spéciaux (penalty, coup franc, aile, meneur) : frappes/passes/lobs aléatoires, invariants par tick.
import {newGame,rng} from '../../../tests/gameplay-physique/_game.mjs';
const N=+process.argv[2]||60,seed=+process.argv[3]||13;const r=rng(seed);
const scen=['setupPenalty()','setupFreeKick()','setupWing()','setupPlaymaker()','setupFreeKick(20,14)'];
const sum={n:0,kinds:{},bad:[],bySc:{}};
for(let i=0;i<N*scen.length;i++){
 const sc=scen[i%scen.length];const g=newGame(i+1);g.setRandom(3000+i);
 const mode=['normal','normal','normal','lob','low'][Math.floor(r()*5)],tx=(r()-.5)*(mode==='normal'?9:24),power=.2+r()*.8,spin=(r()-.5)*2;
 g.run(`${sc};action.started=true;windUp(action.hero,{x:${tx},z:${mode==='normal'?-21:-16-r()*0}},'${mode}','hero',${spin},${mode==='normal'?power:null});`);
 let o;try{o=g.drive({dts:[1/120,1/160],maxT:14,afterT:.2});}catch(e){sum.bad.push({i,sc,why:'EXCEPTION '+e.message,stack:String(e.stack).split('\n').slice(0,4).join(' | ')});continue;}
 sum.n++;const k=sc+' '+(o.ended?o.kind:o.ready?'ready':'run:'+o.phase);sum.kinds[k]=(sum.kinds[k]||0)+1;
 if(o.nan||o.minY<.22-1e-6)sum.bad.push({i,sc,why:'nan/underground'});
 if(o.maxSpeed>42&&mode==='normal')sum.bad.push({i,sc,mode,tx,power,why:'speed '+o.maxSpeed.toFixed(1)});
 if(!o.ended&&!o.ready)sum.bad.push({i,sc,mode,tx,power,why:'stuck phase '+o.phase,fin:o.finalBall,msg:o.msg});
 if(o.us>1)sum.bad.push({i,sc,why:'double goal'});
 const fc=o.firstCross;if(fc&&Math.abs(fc.x)<3.38&&fc.y<2.16&&o.kind!=='goal')sum.bad.push({i,sc,mode,tx,power,why:'crossed inside frame but '+o.kind,fc,keeper:o.keeperAt,msg:o.msg});
 if(o.kind==='goal'&&(!fc||Math.abs(fc.x)>3.8||fc.y>2.7))sum.bad.push({i,sc,why:'goal w/o proper crossing',fc});
 if(o.jumps&&o.jumps.some(j=>j.dd>2.2))sum.bad.push({i,sc,why:'big jump',jumps:o.jumps});
}
console.log(JSON.stringify(sum,null,1));
