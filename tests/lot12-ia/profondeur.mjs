// Lot 12 · ia : mesure des passes en profondeur (ballon dans la course d'un partenaire), jouées comme le fait le geste « toucher le bout d'une course ».
// Pour chaque occasion jouable on trouve une course planifiée (planRuns), on joue la passe et on relève : distance, vitesse initiale, temps de trajet jusqu'au point,
// et si le ballon est arrivé jusqu'au point. Usage : node tests/lot12-ia/profondeur.mjs [matchs=20] [graine=3]
import {boot} from '../gameplay-mouvement/harness-reel.mjs';
import {rngOf} from '../gameplay-mouvement/sim.mjs';
export function profondeur({matches=20,seed=3}={}){
 const {run}=boot();
 run(`{let r=${seed*104729+11};Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return (r%2147483648)/2147483648;};}`);
 const out=[];let guard=0;
 for(let m=0;m<matches;m++){
  run("$('play').onclick();");
  let g=0,done=0;
  while(run('!!match')&&g++<40000&&done<3){
   if(run("action.ready&&action.phase==='aerial'"))run('controlAgain("x")');
   if(run('action.ready&&!action.ended&&!action.setPiece&&action.phase===\'ready\'&&!action.__d')){
    run('action.__d=1');
    run('planRuns(action)');
    const info=JSON.parse(run(`(()=>{const a=action;const r=(a.runs||[])[0];if(!r)return JSON.stringify(null);const h=a.hero;const dx=r.point.x-h.x,dz=r.point.z-h.z,dl=Math.hypot(dx,dz)||1;if(dl<12)return JSON.stringify(null);
     a.receiver=r.mate;a.throughRun={mate:r.mate,point:{...r.point}};const aim={x:r.point.x+dx/dl*2.5,z:r.point.z+dz/dl*2.5};windUp(h,aim,'low','hero',0,null);
     return JSON.stringify({dist:dl,mateToPoint:Math.hypot(r.mate.x-r.point.x,r.mate.z-r.point.z),kind:r.kind});})()`));
    done++;
    if(!info)continue;
    // on avance jusqu'à la remise ou la fin du vol
    let t=0,v0=null,reach=null,got=false,moved=false;const p0=JSON.parse(run('JSON.stringify({x:action.ball.x,z:action.ball.z})'));
    for(let i=0;i<1200&&run('!!action&&!action.ended');i++){
     run('tick(1/120)');t+=1/120;const s=JSON.parse(run('JSON.stringify({fl:action.flying,ph:action.phase,b:action.ball,tp:action.throughRun&&action.throughRun.point,loose:action.loose,cp:action.callPause})'));
     if(s.cp){run('action.callPause=false;action.callWait=9');}
     if(s.fl&&v0===null)v0=Math.hypot(s.b.vx,s.b.vz);
     if(s.fl&&!moved&&Math.hypot(s.b.x-p0.x,s.b.z-p0.z)>.3){moved=true;t=0;}
     if(moved&&s.tp&&reach===null&&Math.hypot(s.b.x-s.tp.x,s.b.z-s.tp.z)<1.5)reach=t;
     if(s.ph==='choice'||s.ph==='offball'||s.loose){got=s.ph!=='flight'&&!s.loose;if(moved)break;}
     if(!s.fl&&moved)break;
    }
    out.push({...info,v0,reach,got,avg:reach?info.dist/reach:null});
    continue;
   }
   if(run('action.ended&&action.after>1.2')){run("$('continue').onclick()");continue;}
   if(run('action.phase')==='interval'){run('action.interval.fast=true;tick(.04)');continue;}
   run('tick(1/60)');
  }
 }
 return out;
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
if(process.argv[1].endsWith('profondeur.mjs')){
 const o=profondeur({matches:+process.argv[2]||20,seed:+process.argv[3]||3});
 console.log('passes en profondeur jouées:',o.length);
 console.log('distance moy',avg(o.map(x=>x.dist)).toFixed(1),'| mate->point moy',avg(o.map(x=>x.mateToPoint)).toFixed(1));
 console.log('v0 moy',avg(o.map(x=>x.v0)).toFixed(1),'min',Math.min(...o.map(x=>x.v0)).toFixed(1),'| vitesse moyenne de trajet',avg(o.filter(x=>x.avg).map(x=>x.avg)).toFixed(1),'| temps de trajet',avg(o.filter(x=>x.reach).map(x=>x.reach)).toFixed(2),'s');
 console.log('ballon arrivé au point:',o.filter(x=>x.reach!=null).length+'/'+o.length,'| v0<10:',o.filter(x=>x.v0<10).length,'| v0<14:',o.filter(x=>x.v0<14).length);
 for(const x of o.slice(0,12))console.log(JSON.stringify({d:+x.dist.toFixed(1),m2p:+x.mateToPoint.toFixed(1),v0:+x.v0?.toFixed(1),t:x.reach&&+x.reach.toFixed(2),got:x.got}));
}
