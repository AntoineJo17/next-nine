// Lot 12 · ia : équilibre. Joue des matchs réels (balayage de tests/gameplay-mouvement/sim.mjs, héros au hasard, graine fixe) et compte les issues des occasions jouables :
// buts, arrêts, ballons perdus (interceptions), et le score final cumulé (buts pour / contre) par match. Usage : node tests/lot12-ia/equilibre.mjs [matchs=60] [graine=7]
import {sweep} from '../gameplay-mouvement/sim.mjs';
export function equilibre({matches=60,seed=7}={}){
 const out={actions:0,kinds:{},goals:0,matches};let last=null;
 const st=sweep({seed,matches,frameDt:1/60,onStep(run){
  if(run('!!action&&action.ended')){const id=run('action.__id');if(id!==last){last=id;out.actions++;const k=run('action.outcomeKind||"?"');out.kinds[k]=(out.kinds[k]||0)+1;if(k==='goal'){const by=run('action.shotBy||"?"');out.goalBy=out.goalBy||{};out.goalBy[by]=(out.goalBy[by]||0)+1;}}}
 }});
 out.stats=st;return out;
}
if(process.argv[1].endsWith('equilibre.mjs')){
 const n=+process.argv[2]||60,o=equilibre({matches:n,seed:+process.argv[3]||7});
 console.log('matchs',n,'occasions jouées',o.actions,'issues',JSON.stringify(o.kinds),'| buts/match',((o.kinds.goal||0)/n).toFixed(2),'| buts par occasion',((o.kinds.goal||0)/o.actions*100).toFixed(1)+' %','| buts par auteur de la dernière frappe',JSON.stringify(o.goalBy||{}));
}
