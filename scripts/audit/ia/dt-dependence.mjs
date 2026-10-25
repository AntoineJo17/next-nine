// Dépendance au pas de temps : mêmes graines à 30, 60 et 120 Hz.
import {playMatch} from './sim-mass.mjs';
const N=+process.argv[2]||60;
for(const hz of [30,60,120]){let g=0,sh=0,po=0,pa=0,off=0,won=0;
 for(let i=1;i<=N;i++){const r=playMatch(i*11+3,{dt:1/hz,levels:[60,60]});const s=r.s;g+=s.score[0]+s.score[1];sh+=s.shots[0]+s.shots[1];pa+=s.passes[0]+s.passes[1];off+=s.offsides[0]+s.offsides[1];won+=s.won[0]+s.won[1];}
 console.log(hz+'Hz','buts/match',(g/N).toFixed(2),'tirs',(sh/N).toFixed(2),'passes',(pa/N).toFixed(1),'hors-jeu',(off/N).toFixed(2),'ballons gagnés',(won/N).toFixed(1));}
