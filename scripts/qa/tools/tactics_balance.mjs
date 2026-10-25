// Équilibrage des tactiques (niveaux égaux 60/60, côtés permutés) : X contre Équilibrée. Usage : node tactics_balance.mjs <dossier dist> <matchs>
// Sortie : tableau JSON sur la dernière ligne. Ne modifie rien.
import {pathToFileURL} from 'node:url';import path from 'node:path';
const dist=path.resolve(process.argv[2]||'dist'),N=+process.argv[3]||40;
const {createTactical,stepTactical,TACTICS}=await import(pathToFileURL(path.join(dist,'tactical.js')).href);
function match(seed,t0,t1){const s=createTactical(seed,{tactic:t0,opponentTactic:t1,allowChances:false,levels:[60,60]});for(let k=0;k<400000;k++){if(stepTactical(s,1/60)?.type==='finish')break;}return s;}
const ids=Object.keys(TACTICS);const rows=[];
for(const x of ids){let sh=0,shA=0,g=0,gA=0,po=0,poA=0,pa=0,paA=0,won=0,wonA=0;
 for(let i=1;i<=N;i++){for(const side of[0,1]){const s=side===0?match(i*19+5,x,'equilibre'):match(i*19+5,'equilibre',x);const me=side,ot=1-side;
  sh+=s.shots[me];shA+=s.shots[ot];g+=s.score[me];gA+=s.score[ot];po+=s.possession[me];poA+=s.possession[ot];pa+=s.passes[me];paA+=s.passes[ot];won+=s.won[me];wonA+=s.won[ot];}}
 const M=2*N,f=v=>+(v/M).toFixed(2);rows.push({tactique:x,tirs:f(sh),tirs_adv:f(shA),buts:f(g),buts_adv:f(gA),possession_pct:+(100*po/(po+poA)).toFixed(1),passes:f(pa),passes_adv:f(paA),ballons_gagnes:f(won),gagnes_adv:f(wonA)});}
console.table(rows);

console.log(JSON.stringify(rows));
