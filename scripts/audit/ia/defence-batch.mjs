// usage: node defence-batch.mjs [N]   compare l'ancien refreshDefence (HEAD, scripts/audit/ia/old) au nouveau
import {batch} from '../../../tests/gameplay-ia/defence-harness.mjs';
import {refreshDefence as oldRefresh} from './old/football-ai.js';
const N=+process.argv[2]||300;
const f=o=>({marquages_changes_par_episode:+o.markFlipsPerEpisode.toFixed(2),echanges_A_vers_B_par_episode:+o.swapsPerEpisode.toFixed(2),primaire_flips:+o.pressFlipsPerEpisode.toFixed(2),distance_marqueur_marque_moy:+o.markDist.toFixed(1),gardien_marque:o.keeperMarked,demi_tours:+o.reversalsPerEpisode.toFixed(2)});
console.log('ANCIEN',f(batch(N,{seconds:6,refresh:oldRefresh})));
console.log('NOUVEAU',f(batch(N,{seconds:6})));
