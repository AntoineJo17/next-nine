#!/usr/bin/env python3
"""Lot 12 · mouvement : remplacements exacts à rejouer sur dist/game.js (chaque `old` doit apparaître une seule fois).
Usage : python3 docs/audit-gameplay2/mouvement-patch.py [chemin/vers/dist/game.js]   (défaut : dist/game.js)
Idempotent : refuse de rejouer si déjà appliqué."""
import sys
P = sys.argv[1] if len(sys.argv) > 1 else 'dist/game.js'
s = open(P, encoding='utf-8').read()
R = []

# 0. Le héros d'une vraie occasion (startTacticalChance) n'avait aucun marqueur : le plafond de vitesse de movement.js ne le voyait pas. (`controlled`, et non `isHero`, qui change les passes de l'IA.)
R.append(("a.hero=make(hero);a.teammates=", "a.hero=make(hero);a.hero.controlled=true;a.teammates="))

# 1. Fin de conduite : le porteur ralentit (24 m/s² demandés, ~15 réels : limités par l’accélération) au lieu de passer de 6 m/s à 0 en un pas ; délai de sécurité relevé en conséquence (1,7 s -> 2,3 s).
R.append(("*(held?.86:1),dt,14,false);attachBall(a.hero,true);", "*(held?.86:1),dt,14,24);attachBall(a.hero,true);"))
R.append(("if(!a.ended&&(reached||a.dribbleElapsed>1.7))controlAgain(", "if(!a.ended&&(reached||a.dribbleElapsed>2.3))controlAgain("))

if 'a.hero.controlled=true' in s:
    sys.exit('déjà appliqué : ' + P)
for old, new in R:
    assert s.count(old) == 1, ('remplacement introuvable ou ambigu', s.count(old), old[:70])
    s = s.replace(old, new)
open(P, 'w', encoding='utf-8').write(s)
print('ok :', len(R), 'remplacements appliqués à', P)
