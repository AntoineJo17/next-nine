// AUDIT-1 · P2 : le plafond de pas de temps de loop() (0,04 s) ralentit le jeu sous 25 images/s (« pas de ralenti » du cahier des charges).
// Test « todo » : il passera quand le correctif de docs/audit-gameplay/physique-patches-game.md (P2) sera appliqué à dist/game.js.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=fs.readFileSync(new URL('../../dist/game.js',import.meta.url),'utf8');
const cap=+/function loopFrame\(t\)\{const dt=Math\.min\(\(t-lastTime\)\/1000,(\.?\d*\.\d+)\)/.exec(src)?.[1];

test('P2 · constat : loop() découpe en sous-pas <= 1/120 s, donc un plafond plus haut ne risque pas de tunnel',()=>{
 assert.ok(Number.isFinite(cap),'plafond trouvé dans loop()');
 assert.match(src,/const d=Math\.min\(remaining,1\/120\);tick\(d\)/,'sous-pas de 1/120 s');
});

test('P2 · à 15 images/s le jeu tourne à vitesse réelle (plafond >= 1/15 s)',()=>{
 assert.ok(cap>=1/15,`plafond actuel ${cap} s : à 15 images/s la simulation avance de ${(cap*15*100).toFixed(0)} % du temps réel`);
});
