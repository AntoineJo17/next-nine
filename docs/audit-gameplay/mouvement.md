# Audit gameplay · déplacements, animations, transitions (AUDIT-2)

Branche `qa/gameplay-mouvement`. Périmètre modifiable : `dist/movement.js`, `dist/engine.js`, `tests/gameplay-mouvement/`, `scripts/audit/mouvement/`, ce dossier.
Rien n'a été publié (pas de push, pas de stamp). `dist/game.js` n'est pas modifié : les corrections qui l'exigent sont dans `mouvement-patches-game.md`.

## Méthodes

1. Lecture de `movement.js`, de `updateActors` / `tick` / `loop` / `celebrate` / `resolve` de `game.js` et de `posePlayer` / `followCamera` / `cineView` d'`engine.js`.
2. Balayages déterministes en Node (harnais vm, `tests/gameplay-mouvement/harness-reel.mjs` = copie du harnais carrière **sans** les raccourcis `beginInterval` / `beginIncoming`, donc simulation tactique -> occasion -> passe d'ouverture réelles).
   Enregistrement de chaque acteur à chaque sous-pas de 1/120 s, images de 1/30, 1/60 et 1/144 s. Outil : `node scripts/audit/mouvement/analyze.mjs <graine> <matchs> <fps>`.
3. Observation réelle dans Chromium (Python Playwright, `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`, 390x844, serveur `python3 -m http.server 8782 --directory dist`).
   `game.js` est patché à la volée par `page.route` (fin de fichier : accès à `action`, `engine`, `tick`...). La boucle du jeu est remplacée par une boucle synchrone à pas fixe (mêmes appels que `loop()` : `tick` par sous-pas de 1/120 s, `engine.render(action,dt,time)`), ce qui rend la mesure indépendante de la charge de la machine (load average 36-50 pendant l'audit, cause de ~7 images/s avec la vraie boucle).
   Outils : `observe.py` (pilote automatique, enregistrement position logique + rendue, PNG à chaque anomalie), `analyze_obs.py`, `scenes.py` (célébration, gardien).
4. Mesures ciblées : `dt.mjs` (indépendance au framerate de `moveToward`), `keeper.mjs`, `celebration.mjs`, `ballpop.mjs`.

## Résultats chiffrés

| Mesure | Résultat |
|---|---|
| Balayages Node (graines 1-5, 15 à 60 matchs, 30 / 60 / 144 i/s), plus de 150 actions réelles | 0 NaN, 0 sortie de terrain, 0 empilement < 0,4 m, 0 outil bloqué (tacle > 2,2 s), 0 inversion de vitesse à l'arrêt |
| Dépendance au framerate (`moveToward`, 20 à 144 i/s) | écart max 2,4 % sur 2 s (Euler explicite) ; la logique du jeu avance toujours par pas <= 1/120 s (loop découpe, plafond 0,04 s) : distance identique à 30, 60 et 144 i/s |
| Gros dt (retour d'onglet) | `loop` plafonne `dt` à 0,04 s et ne tick pas quand `document.hidden` : pas de rattrapage brutal (lecture du code) |
| Vitesse max observée | 9,45 m/s (départ du tacle glissé, théorique) ; 6,75 m/s à la course (4,5 x PACE 1,35) |
| Chromium, 4 enregistrements (3 000 à 5 000 images) | voir tableau des problèmes ; 0 erreur console |

## Problèmes

| ID | Gravité | Reproduction | Cause | Fichiers | Statut |
|---|---|---|---|---|---|
| M1 | Moyenne (visible à chaque plongeon lent) | `node scripts/audit/mouvement/keeper.mjs` ; en jeu : tir lent et haut, le gardien plonge | `updateKeeper` : l'état `ground` ne touche pas `k.y` (reste là où le plongeon l'a laissé : jusqu'à +0,6 m en l'air pendant 0,7 s), puis `recover` démarre d'office à `y=-0,5`, `tilt=1,32`, `reach=0,72` quel que soit `lat` : saut de 0,41 m en hauteur, 0,89 rad d'inclinaison, 0,49 m de portée en un pas (mesuré aussi en rendu : saut vertical de 1,0-1,1 m du mesh du gardien, Chromium, `observe.py`, PNG). `diveDX`/`diveT` jamais remis à zéro (un plongeon ou une sortie ultérieure réutilisait l'ancien) | `dist/movement.js` (`updateKeeper`) | **Corrigé** : chute avec la gravité pendant `ground`, `recover` part des valeurs réelles, paramètres remis à zéro. `keeper.test.mjs` (échoue avant : saut 0,194 m ; après : 0 saut > 0,02 m) |
| M2 | Haute (le plus fréquent) | `node scripts/audit/mouvement/ballpop.mjs` : dribble à 90° du regard -> le ballon saute de 0,84 m autour du joueur en 1/120 s (51 cm à 45°, 1,16 m à 180°). Début de chaque passe d'ouverture : 6 défenseurs font demi-tour (150-180°) dans le même pas | `moveToward` et `pressDefender` fixaient `angle = atan2(-vx,-vz)` instantanément ; `attachBall` colle le ballon à `hero.angle` | `dist/movement.js` | **Corrigé** : `turnToward`, 14 rad/s (`TURN_RATE`) ; un pas de plus de 1/30 s (tests, outils) garde l'orientation immédiate. Balayage 25 matchs : demi-tours > 150° en un pas 248 -> 16, rotations > 57° 499 -> 65 (restes : angles fixés directement par `game.js`, voir M3). `orientation.test.mjs`, `sweep.test.mjs` (125 rotations de course avant, 0 après) |
| M3 | Basse à moyenne | `observe.py ... 30` : 19 drapeaux « rotation-rendue 90-143° par image » à 30 i/s | `posePlayer` : rotation = `diff x min(1, dt x 24)` -> jusqu'à 75 rad/s (180° en ~4 images). Les orientations posées directement par le jeu (`winBall`, `beginChallenge`, `receivePass`, `windUp`...) passent donc par ce lissage trop vif | `dist/engine.js` (`posePlayer`) | **Corrigé** : plafond de 16 rad/s pour tous sauf le personnage du joueur (le ballon est collé à son angle logique : réponse inchangée). `engine.test.mjs` |
| M4 | Moyenne (tous les buts à plus de ~17 m) | `node scripts/audit/mouvement/celebration.mjs` ; Chromium `scenes.py celebration` : buteur parti de z = 8 | `celebrate` coupe la course à `c.time > 2.6` quelle que soit la distance : le buteur passe de 6,7 m/s à 0 en une image à 9-16 m de sa cible et célèbre au milieu du terrain, face à personne | `dist/game.js` (interdit) | **Proposé** : `mouvement-patches-game.md`, remplacement exact ; `celebration.test.mjs` applique le même remplacement en mémoire (échoue sans, passe avec) |
| M5 | Basse | `analyze.mjs 3 25 60` | Phase `ended` : les défenseurs ont `speed = 0` mais `separateBodies` (3 passes dans `resolveBodyContacts`) les repousse devant les partenaires qui courent féliciter le buteur (5 m x PACE) : ils glissent jusqu'à 6,4 m/s, pieds immobiles. 137 pas (~1 s) sur 25 matchs | `dist/game.js` (`resolveBodyContacts`) | Non corrigé (hors périmètre, effet rare et bref). Piste : ne pas séparer défenseurs / partenaires pendant `a.ended`, ou faire courir légèrement le défenseur poussé |
| M6 | Basse | phase `aerial` (volée / tête) | `beginAerial` replace le joueur sous le ballon (1,2-1,7 m en un pas) ; `posePlayer` l'affiche en pas rapide sur ~0,1 s (« Lot 4 » : jamais de téléportation visible) | `game.js` / `engine.js` | **Choix de design** |
| M7 | Basse | `observe.py` : saut de caméra 28-33 m à l'image de fin de but | `render` bascule de `followCamera` (haute) à `cineView` (2 m de haut, 5,8 m du buteur) : coupe franche voulue (caméra de célébration) | `dist/engine.js` | **Choix de design** |
| M8 | Basse | joueurs à l'arrêt | L'orientation à l'arrêt reste celle de la dernière course ; pas de suivi du ballon (ni corps, ni tête : `updateFace` n'anime que les yeux). Au début d'une occasion, 3 partenaires sur 6 regardent le but alors que le ballon est derrière eux | `engine.js` | **Choix de design** (amélioration possible : tourner doucement les joueurs immobiles vers le ballon, hors arrêt sur image) |
| M9 | Très basse | course à pleine vitesse | Cadence de foulée en accord avec la vitesse jusqu'à ~5 m/s ; au-delà, l'amplitude du pas est plafonnée à 0,46 m (jambe de 0,86 m) : le pied d'appui glisse d'environ 25 % à 6 m/s (calcul : 0,92 / (0,38 x 3,2) = 0,75) | `engine.js` | **Choix de design** / limite géométrique du squelette |

### Vérifié et non reproduit

- Glissement / course sur place : en Chromium, 1 seule séquence de course sur place (13 images, un défenseur qui court contre un corps), sinon les 253 « arrêts » sont la décroissance normale de la foulée (0,2 s). Aucun glissement systématique ; reste M5 et le pas rapide de M6.
- Téléportations : aucune hors phase `aerial` (pas > 12 cm en 1/120 s) ; le cas `incoming` au démarrage d'une occasion est un changement de scène, pas un saut.
- Animations qui ne se terminent pas : tacle (<= 1,6 s), frappe, célébration (`group` -> reprise), plongeon (M1 mis à part), carton : toutes terminent ; 0 « tacle bloqué ».
- Tremblement à l'arrêt : 0 inversion de vitesse ; arrêt à moins de 4 cm de la cible, sans dépassement à 20-144 i/s.
- NaN, sortie de terrain, empilement : 0.
- Retard rendu/logique d'un joueur en course (glide du moteur) : médiane 0, max 0,35 m, 0 % au-delà de 0,3 m à 60 i/s, 1 % à 30 i/s : sans conséquence visible.
- Caméra : saut max 0,8 m par image à 60 i/s (hors coupe de célébration) ; lissage exponentiel correct.

## Commandes

```
export PATH=<node portable>/bin:$PATH
node --test tests/gameplay-mouvement/*.test.mjs      # 16 tests, ~35 s
node --test tests/*.test.mjs                          # suite complète (229 existants), 5 à 6 min sous charge
node scripts/audit/mouvement/analyze.mjs 3 25 60      # balayage + anomalies (graine, matchs, images/s)
node scripts/audit/mouvement/dt.mjs                   # framerate / arrêt / demi-tour de moveToward
python3 -m http.server 8782 --directory dist &        # puis :
python scripts/audit/mouvement/observe.py out.json 4000 pngs 30 777 && python scripts/audit/mouvement/analyze_obs.py out.json
python scripts/audit/mouvement/scenes.py pngs celebration|keeper 60
```

## Limites

- Le pilote automatique joue au hasard (tir, conduite, passe) ; peu de buts, aucun geste de râteau / protection ciblé en navigateur. Les scènes ciblées (célébration, plongeon) sont forcées.
- Machine très chargée pendant l'audit : les mesures de temps réel ne sont pas fiables (d'où la boucle à pas fixe) ; le ressenti sur téléphone n'est pas vérifié.
- Les coups francs, penalties et cartons sont couverts seulement quand le balayage les rencontre (pas de comptage dédié).
- `TURN_RATE = 14` rad/s et le plafond de rendu à 16 rad/s sont des réglages de ressenti : à valider à la main sur téléphone.
