# Lot 12 · mouvement (point 1 du retour de test)

Agent `mouvement`. Périmètre : `dist/movement.js`, `dist/engine.js`, `dist/physics.js` (non touché) ; `dist/game.js` uniquement via `docs/audit-gameplay2/mouvement-patch.py` (3 remplacements exacts, testé sur une copie propre de main).
Rien n'est publié ni poussé.

## Méthode

- Balayage Node déterministe (`tests/lot12-mouvement/mesure.mjs <graine> <matchs>`) : vitesse logique de chaque acteur à chaque sous-pas de 1/120 s, par phase.
- Mesure du RENDU dans Chromium (Metal) : `scripts/audit2/mouvement/rendu.py` (boucle à pas fixe 60 i/s, 6 000 images, pilote automatique) lit la position réellement dessinée (`engine.*.sx/sz`) et la compare à la position logique. Serveur : `python3 -m http.server <port>` à la racine du dépôt.

## Vitesses réelles mesurées (avant)

| Acteur | Vitesse |
|---|---|
| Héros, niveau 0, course ou conduite | 5,94 m/s (4,4 x PACE 1,35) ; mesuré 5,9 en conduite |
| Héros, niveau 39 (bonus de carrière `attributes().speed` = 4,4 + niveau x 0,02) | 7,02 m/s, plus que la pointe d'un défenseur qui presse |
| Défenseur qui presse (4,35 x style 0,94-1,06 x profil) | 5,5 à 6,6 m/s (p99 6,6) ; défenseur battu qui se replie : jusqu'à 7,2-8,1 |
| Partenaires | p99 6,35, appels en profondeur 6,9 |
| Accélération (paramètre de `moveToward`) | héros 14 (18,9 m/s²), défenseurs 8-10 (10,8-13,5 m/s²) |

## Anomalies

| ID | Statut | Reproduction | Cause | Correctif | Avant -> après |
|---|---|---|---|---|---|
| V1 Héros plus rapide que les défenseurs | **Démontré** (dès qu'il progresse en carrière) | `tests/lot12-mouvement/mouvement.test.mjs` test 1 et 5 (`career.baseLevel=39`) | Le bonus de vitesse de carrière n'était pas plafonné ; accélération 14 contre 8-10 pour les défenseurs ; de plus le héros d'une vraie occasion (`startTacticalChance`) n'avait aucun marqueur | `movement.js` : si `actor.controlled\|\|actor.isHero`, vitesse de base <= 4,5 (6,1 m/s) et accélération <= 11 (14,9 m/s²) ; `game.js` (patch) : `a.hero.controlled=true` dans `startTacticalChance` (on n'utilise pas `isHero`, qui modifie les passes de l'IA) | niveau 39 : 7,02 -> 6,08 m/s ; 0,3 s après le départ : 5,67 -> 4,86 m/s (= défenseur) |
| V2 Arrêt net de 6 m/s à 0 en un pas à la fin d'une conduite | **Démontré** (chaque conduite non interrompue) | `mesure.mjs` : conduite -> `moveToward(..., brake=false)` jette `vx,vz` à 0 à l'arrivée | `brake=false` : aucun ralentissement, arrêt pile | `movement.js` : `brake` accepte un nombre (décélération en m/s²) ; `game.js` (patch) : conduite avec `brake=24` (demandé ; la décélération réelle est limitée à ~15 m/s² par l'accélération du héros), délai de sécurité 1,7 -> 2,3 s | chute de vitesse en un pas : 5,9 -> < 0,2 m/s pendant toute la décélération ; vitesse au dernier pas avant l'arrêt : 6 -> moins de 4 m/s (3,9 mesuré) |
| V3 Saut du corps dessiné à la réception aérienne | **Démontré** (logique : 1,2 à 1,7 m en 1/120 s, `beginAerial` replace le héros sous le ballon, phase de pause) | `rendu.py` : `hero/aerial` 0,26-0,31 m par image (jusqu'à 22 m/s au premier pas), 5 événements > 25 cm sur 6 000 images ; la montée de tête (0,65 m) est un saut vertical d'une image | Rattrapage exponentiel du moteur : démarrait à 22 m/s ; coupure > 2,2 m | `engine.js` (`posePlayer`) : poursuite à vitesse bornée (9 m/s + 2,2 par mètre d'écart) ; montée verticale <= 9 m/s (gardien exclu) ; les jambes marchent pendant le déplacement | 0,31 -> 0,20 m/image max, 0 événement > 25 cm ; 1,7 m couverts en < 0,3 s |
| V4 Corps dessiné en retard derrière un coureur | **Démontré** | `rendu.py` : retard max rendu/logique 0,86 m (conduite), 0,88 m (armement), 1,12 m (aérien) | Une fois le rattrapage exponentiel enclenché (> 0,22 m), il ne s'arrêtait plus tant que le joueur bougeait : retard permanent = vitesse / 13 = 0,46 m à 6 m/s, le ballon (position logique) devançant les pieds | même correctif que V3 : à toute vitesse normale, le retard est <= 1 image de déplacement (test à 30, 60, 144 i/s) | retard en course : 0,46 -> <= 0,10 m |
| V5 Téléportation à la réception / au contrôle | **Pas reproduite en tant que telle** hors V3 | `controlAgain` ne déplace pas le héros ; `receivePass` ne touche que le partenaire ; les seuls repositionnements du héros sont les mises en place de scène (coupes légitimes), `beginAerial` (V3) et `beginBicycle` (0,3 m, lissé par V3) | | | |
| V6 Défenseur qui bouge de 0,23 m en un sous-pas | Non traité | 1 cas sur 40 matchs, phase armement, début d'action | Poussée de `separateBodies` en début de scène | | Invisible au rendu (< 0,25 m/image) |

## Mesures après correction

- Rendu Chromium, 6 000 images à 60 i/s, graine 12345 : plus grande avance rendue en une image 0,20 m (héros, phase aérienne) ; 0 événement > 25 cm ; défenseurs et partenaires <= 0,12 m/image ; 0 erreur console.
- Balayage Node : le héros ne dépasse plus 6,08 m/s en course ou conduite.
- Les sauts de position logique restants du héros (1,2 à 1,7 m dans la phase `aerial`) sont voulus : la position logique est posée sous le ballon pendant la pause de décision ; seul le dessin compte et il est lissé.

## Tests de non-régression

`tests/lot12-mouvement/mouvement.test.mjs` (8 tests). Échouent avant correction : plafond de vitesse (7,02 m/s), accélération, pas de rendu 0,37 m, montée de tête d'un coup. Le test de conduite réelle applique les remplacements de `game.js` en mémoire s'ils ne sont pas déjà là (`STRICT_GAME_PATCHES=1` exige qu'ils y soient).

## Ouvert / à valider au téléphone

- Plafond du héros 4,5 (6,1 m/s) et accélération 11 : à valider au téléphone. Le bonus de vitesse de carrière (`attributes().speed`) n'a donc plus d'effet au-delà du niveau 5 (4,5) ; si l'on veut qu'il serve, relever aussi le profil des défenseurs, ou l'afficher autrement.
- Fin de conduite : `brake=24`. Avec 14 ou 18 le test `career.test.mjs` « shots remain possible after approaching the defence » échoue (la conduite finit ~0,15 s plus tard et les défenseurs rattrapent) ; 24 le garde vert mais le héros arrive encore à ~3,9 m/s avant l'arrêt (reste d'un arrêt net, atténué). Pour un arrêt vraiment doux il faudrait raccourcir la conduite ou laisser le défenseur plus lent (équilibrage).
- Vitesse de rattrapage du dessin (9 m/s + 2,2 par mètre) ; le pas de réception dure ~0,25 s.
- Le défenseur battu qui se replie va à 7,2-8,1 m/s (4,35 x 1,2 x style x profil x PACE) : plus vite que le héros ; non modifié (équilibrage défensif, voir agent IA).
- `beginAerial` pose toujours la position logique d'un coup ; une vraie marche logique obligerait à modifier le système de gestes (hors périmètre).

## Commandes

```
node --test tests/lot12-mouvement/mouvement.test.mjs
node tests/lot12-mouvement/mesure.mjs 1 8
python3 -m http.server 8841 &   # puis :
"<venv>/bin/python" scripts/audit2/mouvement/rendu.py sortie.json 6000 60 12345 8841
python3 docs/audit-gameplay2/mouvement-patch.py [dist/game.js]
```
