// Lot 13 · pressing côté joueur : la possession ne change que si le contact est crédible.
// Avant correction (mesuré) : au tacle réussi le ballon partait avec le geste de jambe à 0 s (la jambe n'avait pas encore atteint le ballon),
// puis il était recollé aux pieds du joueur d'un saut de 11 cm (délai de sécurité de 1,2 s).
import test from 'node:test';import assert from 'node:assert/strict';
import {duel} from './_duel.mjs';

test('tacle réussi : le ballon ne bouge qu\'une fois la jambe arrivée au ballon (geste ≥ 0,2 s)',()=>{
 for(const seed of [1,2,3]){const r=duel(seed);
  assert.ok(r.released,'le tacle doit réussir dans le scénario forcé');
  assert.ok(r.relKick>=.2,`seed ${seed} : le ballon part avec le geste à ${r.relKick} s (la jambe n'a pas touché le ballon)`);
  assert.ok(r.relDist<=1.0,`seed ${seed} : la jambe touche le ballon à ${r.relDist.toFixed(2)} m du joueur (portée d'une jambe)`);
 }
});

test('tacle réussi : le ballon n\'est jamais recollé aux pieds d\'un saut visible (≤ 6 cm par 1/120 s, moins d’une demi-balle)',()=>{
 for(const seed of [1,2,3]){const r=duel(seed);
  assert.ok(r.done,'le joueur reprend le contrôle');
  assert.ok(r.attachJump<=.06,`seed ${seed} : saut final de ${(r.attachJump*100).toFixed(0)} cm`);
  assert.ok(r.maxStep<=.06,`seed ${seed} : plus grand saut du ballon ${(r.maxStep*100).toFixed(0)} cm`);
 }
});
