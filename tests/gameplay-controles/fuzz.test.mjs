// AUDIT-4 · Fuzzing déterministe (graines fixes) des évènements utilisateur sur le vrai game.js : aucune exception,
// aucun NaN, match/action synchronisés, énergie bornée, score = événements = score tactique, pas de geste résiduel hors partie.
// Pour une campagne plus longue : node scripts/audit/controles/fuzz-run.mjs <graine> <nb> <pas> [calm]
// Exécution : node --test tests/gameplay-controles/*.test.mjs
import {test} from 'node:test';import assert from 'node:assert/strict';
import {fuzz} from './fuzzer.mjs';

test('fuzz : 24 graines d’évènements aléatoires (quitter/relancer inclus) sans exception ni invariant violé',()=>{
 let games=0,gestures=0;
 for(let seed=1;seed<=24;seed++){
  const r=fuzz(seed,{steps:2500});games+=r.stats.games;gestures+=r.stats.gestures;
  assert.deepEqual([...r.errors,...r.bad],[],'graine '+seed);
 }
 assert.ok(gestures>4000,'le fuzz doit réellement produire des gestes ('+gestures+')');
});

test('fuzz « calme » : matchs complets enchaînés avec gestes, aides, replays, fautes et cartons forcés',()=>{
 let games=0;
 for(let seed=500;seed<=505;seed++){
  const r=fuzz(seed,{steps:12000,calm:true});games+=r.stats.games;
  assert.deepEqual([...r.errors,...r.bad],[],'graine '+seed);
 }
 assert.ok(games>=3,'des matchs doivent aller au bout ('+games+')');
});
