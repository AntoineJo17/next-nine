// Asymétrie équipe 0 / équipe 1 à niveaux égaux, graines différentes.
import {playMatch} from './sim-mass.mjs';
const N=+process.argv[2]||150;let a=[0,0,0,0,0,0,0],kick=[0,0];
for(let i=1;i<=N;i++){const r=playMatch(i*13+5,{});const s=r.s;a[0]+=s.score[0];a[1]+=s.score[1];a[2]+=s.shots[0];a[3]+=s.shots[1];a[4]+=s.possession[0];a[5]+=s.possession[1];a[6]+=s.passes[0]-s.passes[1];}
console.log(JSON.stringify({N,buts0:a[0]/N,buts1:a[1]/N,tirs0:a[2]/N,tirs1:a[3]/N,poss0:a[4]/(a[4]+a[5]),diffPasses:a[6]/N}));
