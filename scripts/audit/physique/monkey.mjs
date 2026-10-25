// Singe : un joueur aléatoire enchaîne dribbles, passes, lobs, frappes, râteaux dans l'action réelle, tick 1/120 ou dt variable.
// Détecte exceptions, NaN, ballon hors bornes pendant le jeu, blocage (aucun changement d'état pendant 20 s simulées).
import {newGame,rng} from '../../../tests/gameplay-physique/_game.mjs';
const N=+process.argv[2]||100,seed=+process.argv[3]||23;const r=rng(seed);
const sum={n:0,ended:{},bad:[],ticks:0};
const DRIVER=`globalThis.__monkey=function(cfg){const rr=(()=>{let s=cfg.seed>>>0;return()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296;})();
 const out={acts:[],t:0,problems:[]};let t=0,lastSig='',lastChange=0;
 while(t<cfg.maxT&&!action.ended){
  if(action.callPause)action.callPause=false;
  if(action.ready&&!action.frozenAct){const h=action.hero,mates=action.teammates.filter(m=>m!==h);const k=rr();let desc;
   try{
    if(k<.3){const a=rr()*6.28,d=2+rr()*7;beginDribble({x:h.x+Math.sin(a)*d,z:h.z+Math.cos(a)*d});desc='dribble';}
    else if(k<.5&&mates.length){const m=mates[Math.floor(rr()*mates.length)];action.receiver=m;windUp(h,{x:m.x,z:m.z},'low','hero');desc='pass';}
    else if(k<.6&&mates.length){const m=mates[Math.floor(rr()*mates.length)];action.receiver=m;windUp(h,{x:m.x,z:m.z},'lob','hero');desc='lobpass';}
    else if(k<.65){beginRake(rr()<.5?-1:1);desc='rake';}
    else{windUp(h,{x:(rr()-.5)*8,z:-21},'normal','hero',(rr()-.5)*1.4,.3+rr()*.7);desc='shot';}
   }catch(e){out.problems.push('EXC '+desc+' '+e.message+' '+String(e.stack).split('\\n').slice(0,3).join('|'));break;}
   out.acts.push(desc);}
  const dt=cfg.dts[Math.floor(rr()*cfg.dts.length)];
  try{tick(dt);}catch(e){out.problems.push('EXC tick '+e.message+' '+String(e.stack).split('\\n').slice(0,4).join('|'));break;}
  t+=dt;const b=action.ball;
  if(![b.x,b.y,b.z].every(Number.isFinite)){out.problems.push('NaN ball at '+t.toFixed(2));break;}
  if(b.y<.22-1e-6)out.problems.push('under ground '+b.y);
  const sig=action.phase+'|'+Math.round(b.x*2)+'|'+Math.round(b.z*2)+'|'+Math.round(action.hero.x*2)+'|'+Math.round(action.hero.z*2);
  if(sig!==lastSig){lastSig=sig;lastChange=t;}else if(t-lastChange>20&&!action.ready){out.problems.push('stuck '+action.phase+' '+t.toFixed(1));break;}
 }
 out.t=t;out.ended=action.ended;out.kind=action.outcomeKind;out.phase=action.phase;out.us=match.us;return JSON.stringify(out);};`;
for(let i=0;i<N;i++){
 const g=newGame(i+1);g.run(DRIVER);g.run(`match.index=${i%3};setup();`);g.setRandom(7000+i);
 let o;try{o=JSON.parse(g.run(`__monkey({seed:${1+Math.floor(r()*1e9)},maxT:90,dts:[1/120,1/120,1/200,1/60].map(x=>Math.min(x,1/120))})`));}catch(e){sum.bad.push({i,why:'harness exception '+e.message});continue;}
 sum.n++;const k=o.ended?o.kind:'timeout:'+o.phase;sum.ended[k]=(sum.ended[k]||0)+1;
 if(o.problems.length)sum.bad.push({i,idx:i%3,acts:o.acts.slice(-6),problems:o.problems,t:o.t});
}
console.log(JSON.stringify(sum,null,1));
