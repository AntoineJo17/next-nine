// Rejoue un tir précis (JSON en argv[2]) avec un découpage de dt donné et affiche les événements et la fin de trajectoire.
import {newGame} from '../../../tests/gameplay-physique/_game.mjs';
const c=JSON.parse(process.argv[2]);const g=newGame(c.seed||1);g.run('Math.random=()=>.5;');
g.run(`const h=action.hero;h.x=${c.hx};h.z=${c.hz};attachBall(h);action.started=true;action.defenders.forEach((d,k)=>{d.x=30+k;d.z=40;});action.teammates.forEach(d=>{d.x=-30;d.z=30;});windUp(h,{x:${c.tx},z:${c.mode==='normal'?-21:-17}},'${c.mode}','hero',${c.spin},${c.mode==='normal'?c.power:null});`);
const o=g.drive({dts:c.dts,maxT:c.maxT||12,afterT:.2,trace:!!c.trace});
const tr=o.trace;delete o.trace;console.log(JSON.stringify(o,null,1));
if(tr){const from=c.from??0,to=c.to??tr.length;console.log(tr.slice(from,to).map(x=>x.join(' ')).join('\n'));}
