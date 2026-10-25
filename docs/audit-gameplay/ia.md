# AUDIT-3 · IA, placement tactique, adversaires et partenaires

Branche `qa/gameplay-ia`. Fichiers modifiés : `dist/football-ai.js`, `dist/tactical.js`. Nouveaux : `tests/gameplay-ia/*`, `scripts/audit/ia/*`, ce document et `ia-patches-game.md`. Rien n'est publié (pas de push, pas de stamp).

## Méthode

1. Lecture de `football-ai.js`, `tactical.js` et des passages de `game.js` (updateActors, pressing, mises en place des occasions, resumeTactical).
2. Simulation massive déterministe en Node (`scripts/audit/ia/sim-mass.mjs`, `tactics-balance.mjs`, `options-sweep.mjs`, `jitter.mjs`, `overlap2d.mjs`, `dt-dependence.mjs`, `fuzz-ai.mjs`) : plus de 2 000 matchs complets de 90 minutes de la simulation à 22 joueurs, 4 000 configurations aléatoires pour les décisions.
3. Observation réelle dans Chromium (GPU Metal, 390x844, serveur `python3 -m http.server 8783 --directory dist`) : `scripts/audit/ia/browser_probe.py` expose l'état interne en patchant `game.js` à la volée par `page.route` (le fichier du dépôt n'est pas touché), fige la boucle `requestAnimationFrame`, pilote `tick(1/60)` avec `Math.random` graine et un héros-robot (conduite vers l'espace libre, frappe dans la surface), puis enregistre 22 joueurs + ballon + gardien à 30 Hz. Environ 115 occasions déclenchées (open 48, cross 27, press 19, coup franc 18, penalty 3) et 75 occasions conduites (38 + 37). Captures PNG (`shots.py`, vue de dessus `topdown.mjs` + `svg2png.py`) regardées avec Read.
4. Banc d'essai de la défense sans navigateur (`tests/gameplay-ia/defence-harness.mjs`) : reprend la boucle des défenseurs de `updateActors` avec les vraies fonctions de `football-ai.js` et `movement.js` sur des dispositions relevées en navigateur.

## Tableau des constats

| ID | Gravité | Reproduction | Cause | Fichiers | Statut |
|---|---|---|---|---|---|
| IA-01 | Moyenne | `node scripts/audit/ia/defence-batch.mjs 300` ; navigateur : graines 11 à 40, `marks.mjs smart-17 0` montre D9 : T4, T2, T4, T2, T4, T2, T4 en 4 s | `refreshDefence` / `assignMarkers` : un marqueur ne garde son joueur que s'il est à moins de 9 m (or la distance marqueur-marqué est de 29 m en moyenne sur le banc d'essai, médiane 11,4 m en navigateur), sinon tout est recalculé toutes les 0,18 s, défenseur par défenseur (glouton selon l'ordre du tableau) : deux défenseurs échangent leurs hommes en boucle, des marquages se croisent sur tout le terrain, et le gardien allié (style gardien) peut être marqué (8 images sur 67 en graine 11) | `dist/football-ai.js` | **Corrigé** |
| IA-02 | Moyenne | `node --test tests/gameplay-ia/reprise.test.mjs` (échoue sur l'ancien code) ; navigateur : toute occasion `penalty` (3) ou `coup franc` (18), puis occasion suivante (graine 11 : gardien allié à z = 19 m en jeu ouvert) | Les mises en place 3D `setupPenalty` / `setupFreeKick` placent le gardien allié (partenaire 0) au bord de la surface adverse (-7,2 ; -2,6) ou à (14 ; 18) ; `resumeTactical` recopie ces positions : le gardien met environ 10 s de simulation (soit ~10 minutes de jeu) à rentrer, but vide pendant ce temps | `dist/tactical.js` (simulation) ; `dist/game.js` (3D) | **Corrigé** côté simulation ; **proposé** côté 3D (G2, G3) |
| IA-03 | Moyenne | graines 62 à 65 (occasions `press`, 16 % des occasions) : les 9 autres défenseurs et les 10 partenaires bougent de 0,00 à 0,01 m pendant 1,5 s | `updateActors` : `if(a.phase==='press')return;` ; `patrol()` existe mais n'est jamais appelée ; `home` non défini en phase press | `dist/game.js` | **Proposé** (G1, vérifié à la volée : 0,22 à 0,69 m) |
| IA-04 | Faible | Test 3 de `marquage.test.mjs` ; 7,5 % des configurations aléatoires (299 sur 4 000) | `assignMarkers` (début de conduite, de frappe) désigne le plus proche, `refreshDefence` (0,18 s plus tard) préfère le défenseur côté but : le presseur change aussitôt après chaque geste | `dist/football-ai.js` | **Corrigé** (score commun `pressScore`) |
| IA-05 | Faible | `node scripts/audit/ia/asym.mjs 150` : à niveaux égaux, Rivage : possession 44,2 %, tirs 1,24 contre 2,38, buts 0,21 contre 0,46 ; sans le bonus de passe au héros (+0,25 dans `choosePass`), 52,3 % et 1,93 contre 1,67 (60 matchs) | Bonus voulu de passes vers le joueur de carrière ; le coût est une équipe légèrement moins bonne en simulation, compensée par les occasions jouables (+4 par match) | `dist/tactical.js` | **Choix de design** |
| IA-06 | Moyenne (équilibrage) | `node scripts/audit/ia/tactics-balance.mjs 70` | Voir tableau ci-dessous : « Pressing haut » domine, « Contre-attaque » et « Possession » ne rapportent rien de mesurable | `dist/tactical.js` (TACTICS) | **Choix de design**, chiffres fournis |
| IA-07 | Faible | `sim-mass.mjs 40` | Simulation seule : 0,7 but et 3,6 tirs par match à 60 contre 60 ; 3 à 6 matchs sur 40 sans aucun tir pour pressing contre pressing ou possession contre possession. Les occasions jouables (3 à 4 par match) apportent le reste | `dist/tactical.js` | **Choix de design** |
| IA-08 | — | `dt-dependence.mjs 50` | 30 / 60 / 120 Hz : tirs 3,78 / 3,82 / 3,84, passes 78,5 / 81,4 / 83,0, buts 0,74 / 0,58 / 0,54 (bruit de 50 matchs). Le jeu appelle `stepTactical(t,1/60)` à pas fixe | — | **Non reproduit** (sans effet réel) |

### IA-06 · effet des tactiques (niveaux 60/60, côtés permutés, 140 matchs par ligne, face à « Équilibrée »)

| Tactique | tirs | tirs adverses | buts | buts adverses | possession | ballons gagnés | adverses |
|---|---|---|---|---|---|---|---|
| Équilibrée (référence) | 1,99 | 1,99 | 0,32 | 0,32 | 50 % | 6,8 | 6,8 |
| Pressing haut | 2,86 | 0,46 | 0,53 | 0,16 | 46,2 % | 10,6 | 7,8 |
| Contre-attaque | 1,56 | 3,03 | 0,25 | 0,21 | 50,6 % | 8,8 | 10,4 |
| Possession | 0,97 | 1,36 | 0,16 | 0,16 | 63,7 % | 6,3 | 6,1 |

Lecture : le pressing est dominant (4,3 fois moins de tirs concédés que la référence, 3,3 fois plus de buts marqués que concédés), et c'est le seul choix gagnant ; la contre-attaque concède plus de tirs sans en créer plus (le bonus de contre `breakAt` ne s'active que contre une ligne haute, c'est-à-dire seulement contre le pressing) ; la possession gagne 14 points de possession sans gain de tirs. Aucun correctif appliqué : c'est de l'équilibrage voulu par le créateur. Le coût en énergie du pressing (x1,18) ne compense pas l'écart.

## Corrections appliquées (avec preuve avant/après)

### IA-01 · marquage stable (football-ai.js)

Changements : (1) un marqueur garde son joueur s'il est à moins de 9 m, ou si aucun joueur libre (non marqué par un autre) n'est plus de 4 m plus proche ; (2) les joueurs libres sont répartis par paires (défenseur, joueur) en commençant par la distance la plus courte, ce qui supprime les échanges et les croisements ; (3) le gardien allié (`style==='gardien'`) n'est jamais marqué ; (4) `assignMarkers` et `refreshDefence` partagent le même score de pressing (IA-04).

Mesure (banc d'essai, 300 occasions de 6 s, `defence-batch.mjs`) :

| | avant | après |
|---|---|---|
| changements de marquage par occasion | 18,5 | 4,8 |
| échanges A vers B (même défenseur) par occasion | 15,2 | 1,5 |
| gardien allié marqué | 0 (rare) | 0 |

Navigateur (graines 11 à 40 avant, 60 à 71 après, mêmes outils d'analyse) : changements de marquage par image vivante 0,30 vers 0,11, gardien allié marqué 8 images vers 0, distance médiane marqueur-marqué 11,4 m vers 8,9 m, marquages à plus de 20 m 17,6 % vers 9,4 %.

Tests ajoutés (`tests/gameplay-ia/marquage.test.mjs`, échouent avant : 1, 3 et 4 sur 5) : gardien jamais marqué, pas de doublon de marquage, même presseur pour `assignMarkers` et `refreshDefence`, moins de 3 échanges par occasion, hystérésis (garde / change si un joueur libre apparaît à côté).

### IA-02 · gardien allié (tactical.js)

`resumeTactical` ne recopie plus la position 3D du gardien allié (seul joueur que les mises en place déplacent hors de sa zone). Tests `reprise.test.mjs` : les deux premiers échouent sur l'ancien code (gardien à y = 0,638 au lieu de 0,025 après un coup franc), le troisième vérifie que les autres joueurs sont bien recopiés.

## Vérifiés et non reproduits (aucune anomalie)

| Suspicion | Mesure |
|---|---|
| Défenseurs superposés | 0 image avec deux acteurs à moins de 0,5 m sur 75 occasions (3D) ; 0 image avec deux points à moins de 1,3 m sur 8 matchs complets (2D) |
| Tous les défenseurs courent au porteur | 3 défenseurs ou plus à moins de 4,5 m du héros : 1 à 6 % des images selon la série (dans la surface, normal) ; jamais plus de 4 |
| Défenseur qui s'éloigne du porteur | primaire qui s'éloigne : 0,7 % à 2,5 % des images |
| Joueurs hors du terrain, NaN | 0 sur plus de 2 000 matchs (positions 2D dans [0 ; 1], ballon fini) et 0 image 3D hors terrain |
| Gardien mal placé / immobile | gardien dans |x| < 4,2 m et z entre -20,2 et -14 sauf sortie volontaire face à face (`keeperRush`) ; démarre à z = -17,4 m (1,9 m devant sa ligne, `homeY` de la simulation) puis revient à 2,5 m/s : cosmétique |
| Partenaires immobiles | à moins de 25 m du héros, 3,9 % du temps à l'arrêt hors pressing (46 % pendant le pressing : IA-03) |
| Possession bloquée | 2,5 s maximum sur 840 matchs |
| Tremblement de décision | 2D : inversions de direction à plus de 137 degrés 0,14 à 0,29 par s (gardiens : 0,9 par s, amplitude de quelques pixels) ; aucun saut de position hors reprise et hors but |
| Passes absurdes (`teamDecision`, 4 000 configurations) | 0 passe vers un joueur hors-jeu, 0 tir hors cadre, 0 passe hors terrain, 0 passe au sol dans une ligne bloquée (passes lobées exceptées) ; 1,2 % de passes en retrait de plus de 4 m (sous pression, voulu) |
| Hors-jeu mal calculé | `offsideLine` et `offsidePosition` vérifiés dans les deux sens (test 7 de `simulation.test.mjs`), même formule que `offsideLineZ` de `game.js` ; 2,8 hors-jeux par match en simulation |
| Cartons, remplacements, tactique changée en cours de match, reprise après chaque issue | 120 matchs à options variées : aucun invariant violé ; 8 % de matchs avec carton rouge, 6 remplacements par match |
| Dépendance au pas de temps | voir IA-08 |

## Observations sans correction

- Conduite naïve du robot : 79 % des 38 occasions conduites finissent en tacle en 4 s ou moins (médiane 2,7 s). C'est de la difficulté de jeu et de la qualité du robot, pas une preuve de défaut d'IA.
- Un défenseur qui tente une « piqûre » ou un tacle glissé reste figé 0,72 s (plus 0,45 s de récupération) ; pendant ce temps le héros peut le dépasser. Voulu (V19) ; cela explique des changements de presseur rapides entre deux défenseurs voisins (40 en 2 386 images).
- Les partenaires gardent leur formation (suivent le héros de ±8 m) hormis les deux appels planifiés (`planRuns`) : choix de design.

## Commandes

```
export PATH=/private/tmp/claude-502/-Users-AJ-Downloads-NEXT-NINE-V13/db178aee-03b3-48b9-9487-bf2487b7ce7a/scratchpad/node-v22.11.0-darwin-arm64/bin:$PATH
node --test tests/gameplay-ia/*.test.mjs          # 15 tests, environ 25 s
node --test tests/*.test.mjs                       # suite complète : 229 tests existants doivent rester verts
node scripts/audit/ia/sim-mass.mjs 40              # statistiques de matchs complets (9 min)
node scripts/audit/ia/tactics-balance.mjs 70
node scripts/audit/ia/defence-batch.mjs 300        # avant/après du marquage (compare à scripts/audit/ia/old/)
node scripts/audit/ia/fuzz-ai.mjs
python3 -m http.server 8783 --directory dist &     # puis, navigateur :
python scripts/audit/ia/browser_probe.py <graine> <dossier> smart 6
GAME_PATCHES=scripts/audit/ia/game-patches.json python scripts/audit/ia/browser_probe.py ...   # avec les correctifs G1 à G3 à la volée
node scripts/audit/ia/analyze.mjs <dossier>; node scripts/audit/ia/behaviour.mjs <dossier>
```

`scripts/audit/ia/old/` contient la version d'origine de `football-ai.js` et `tactical.js` et `oldtests/` les tests relancés dessus (ils échouent, preuve de non-régression inverse).

## Limites

- Le héros est piloté par un robot : la difficulté réelle et les gestes tactiles ne sont pas évalués. Les occasions `wing` et `playmaker` n'ont pas été jouées en navigateur (poste de carrière par défaut : attaquant) ; elles sont couvertes seulement par la simulation (balayage des postes, invariants).
- Les correctifs G1 à G3 touchent `game.js` : validés à la volée dans le navigateur, pas dans le fichier. Aucune validation sur un vrai téléphone.
- Le banc d'essai de la défense réutilise la boucle de `updateActors` recopiée : si `game.js` change cette boucle, `defence-harness.mjs` doit être mis à jour.
- Les chiffres de simulation (0,7 but par match, tactiques) valent pour `allowChances:false` ; en jeu, les occasions jouables s'y ajoutent.
