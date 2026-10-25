# Lot 12 · defense — séquences qui commencent avec le ballon chez l'adversaire

Retour de test n°3 : « certaines actions commencent avec le ballon déjà possédé par l'adversaire : le joueur ne peut rien faire et attend la fin ».

## 1. D'où viennent ces séquences (démontré)

- Balayage de départs (`tests/lot12-defense/depart-mesure.mjs`, 8 graines × 3 matchs, 66 occasions) : **une seule famille** commence avec le ballon chez l'adversaire, le type `press` (14 % des occasions : 9 sur 66). Dans les 9 cas : le porteur est un défenseur (`hasBall`), le ballon est plus près de lui que du héros, et le héros est à plus de 1,5 m du ballon. Les types `open`, `cross`, `freekick`, `penalty` démarrent tous avec le ballon chez nous.
- Origine : `tactical.js` (ligne « 12 · pressing chance », défenseur adverse qui construit depuis l'arrière à moins de 0,2 du héros) → `startTacticalChance` → `applyChanceKind` → `setupPress` / `tickPress` dans `game.js`.
- `matchScenarios` / `matchScenario` dans `career.js` ne sont PAS en cause : ils ne choisissent que le profil d'adversaire et la météo/XP (derby, remontada, pluie). Rien à changer dans `career.js` ni `commentary.js`.

## 2. Ce que vivait le joueur (mesuré sur de vrais matchs, harnais vm)

`tests/lot12-defense/press-mesure.mjs` (16 graines × 3 matchs, jeu réel, joueur-bot qui touche le porteur) :

| | un seul toucher | touche toutes les 0,25 s |
|---|---|---|
| ballon récupéré (avant) | **16 %** (3 sur 19) | 29 % (7 sur 24) |
| distance minimale au porteur (avant) | **3,1 m** : le héros s'arrête sur le point touché, le porteur s'est déjà enfui | 0,84 m |

Causes (toutes dans `tickPress`) :
1. Un toucher fixait un point fixe. Le porteur fuit à 1,6–2,3 m/s : le joueur arrivait sur un point vide et restait là, spectateur, jusqu'au « Le porteur s'est dégagé » (jusqu'à 6 s) puis écran « Reprendre le match ».
2. Le tacle n'existait pas : tirage au sort `d<0,95 et random < dt·2,4` à chaque image, sans geste ni contact lisible. Récupéré = le ballon sautait dans les pieds du héros (`controlAgain` → `attachBall`).
3. Le héros freinait en approchant (arrêt fluide vers un point à 0,8 m du porteur qui bouge) et n'arrivait au contact qu'après le lâcher de la passe : le tirage ne s'exécutait souvent jamais (`pressDuels = 0` dans la majorité des échecs).
4. Une passe lâchée à bout portant touchait automatiquement le héros collé au passeur (ballon à 0,5 m de lui) : interception instantanée, ballon collé (c'est aussi un cas du retour n°2).

## 3. Choix : en faire une vraie situation défensive (et pas la confier à la simulation)

- Confier à la simulation exigerait de changer `tactical.js` (génération des événements, compteur `chancesDue`) : hors périmètre, et le joueur perdrait une occasion de jouer.
- Le mécanisme existe déjà (consigne « TOUCHE… POUR COURIR SUR LE PORTEUR », phase `press`, recoveries). Le plus simple et robuste est de le rendre lisible et réellement jouable, **sans nouvelle commande** : un seul geste, le toucher.

## 4. Correctif (`docs/audit-gameplay2/defense-patch.py`, 9 remplacements exacts, count==1)

1. **Toucher le porteur (à moins de 4,5 m de lui) = « presse-le »** : le héros le suit seul, plein régime, sans freiner, et s'arrête à 0,8 m (il ne le traverse pas). Plus besoin de retoucher l'herbe.
2. **Un vrai duel** à moins de 1,15 m : un seul tacle (animation de jambe du héros), probabilité 42 % × fatigue (plafond 0,42), puis 1,2 s d'attente avant de pouvoir réessayer. Réussi : le ballon quitte le porteur et ROULE vers les pieds du héros (2,4 m/s) ; le héros s'y place et ne reprend le contrôle que lorsque le ballon est devant ses pieds (écart ≤ 0,14 m, donc pas de saut). Raté : « Il résiste : reste sur lui ! ».
3. **Le porteur ne lâche sa passe que s'il est vraiment serré** (2,2 m au lieu de 3,2 m, 0,75 s) : le héros qui accélère a le temps d'arriver au contact.
4. **Passe lâchée** : le héros part automatiquement sur la trajectoire (il peut retoucher l'herbe pour choisir lui-même) ; une passe ne peut être coupée qu'à plus de 1,1 m du passeur et le ballon est amorti vers ses pieds au lieu d'être collé instantanément (« Interception ! »).
5. Libellés : « TOUCHE LE PORTEUR POUR COURIR DESSUS ET LE PRESSER » (garde « COURIR » : test `C2` des libellés) et consigne de coupe de passe.
6. Fin de séquence perdue inchangée : l'adversaire ressort le ballon, `resolve(...'miss')`, la simulation reprend (aucun changement de sauvegarde, de format, d'xp ni de statistique ; `match.recoveries` est incrémenté comme avant, une fois par ballon récupéré).

`career.js`, `commentary.js` : inchangés. Aucune clé ni format de sauvegarde touché.

## 5. Mesures après correctif (mêmes graines, vrais matchs)

| | un seul toucher | touche toutes les 0,25 s |
|---|---|---|
| ballon récupéré | **55 %** (11 sur 20) | 59 % (13 sur 22) |
| distance minimale au porteur | 0,82 m | 0,83 m |
| attente passive loin du porteur après le toucher | 0,01 s max | 0,01 s max |
| plus grand saut de ballon en 1/120 s (scène forcée à 5 m, 40 tirages) | 0,14 m (avant : 0,37 m, saut au contrôle) | idem |

Justification des 55 % : avant, un joueur qui touche une fois gagnait 16 % du temps, soit « presque jamais » ; à 55 %, c'est un duel que le joueur gagne un peu plus d'une fois sur deux en jouant correctement, pas une action offerte. Impact équilibrage : les pressings sont ~14 % des occasions ; +40 points de récupération donnent un ballon haut et une occasion normale au héros dans ~5 % de plus des séquences ; les buts ne sont pas touchés directement (pas de bonus de tir). À valider au téléphone, valeur unique à ajuster : `.42` dans `clamp(.42*fatigueFactor…)`.

## 6. Tests (`tests/lot12-defense/defense.test.mjs`, 6 tests)

Échouent avant le correctif (2 : récupération trop automatique par interception à bout portant ; 3 : saut du ballon 0,37 m), passent après. Les 4 autres sont des garde-fous : un toucher suffit pour rejoindre le porteur à 12 m, pas d'attente passive, la séquence n'est jamais bloquée sans geste, un toucher loin du porteur reste une coupe de passe.
`npm run check` : 229 sur 229. `node --test tests/career-qa tests/gameplay-* tests/lot12-defense` : 142 réussis, 2 todo volontaires (KEEPER_BODY_BLOCK).
Outils de mesure ajoutés : `mesure.mjs` (temps par type d'occasion), `depart-mesure.mjs` (qui a le ballon au départ), `press-mesure.mjs` (taux de récupération en vrais matchs, `node press-mesure.mjs 1` = un seul toucher), `_stats.mjs`.

## 7. Reste ouvert / à valider au téléphone

- Le tacle réussi du héros n'a pas d'animation de glissade dédiée (jambe seulement, `kickTimer`) ; le porteur adverse ne tombe pas, il s'immobilise 1 s.
- Le geste « coupe la passe » (toucher l'herbe sur la ligne) reste simple mais exige de viser ; le départ automatique sur la trajectoire aide sans garantir l'interception.
- Si 55 % paraît trop facile ou trop dur : ajuster `.42` (duel) et `2.2` (distance de serrage).
- Le test n°2 (retour de test) reste dans le périmètre d'un autre agent ; je n'ai touché que le cas « passe à bout portant » du pressing.
- Fichiers scratchpad partagés : j'ai supprimé par erreur `game.patched.js`, `edit_patch.py`, `dbg.mjs` du dossier scratchpad commun (noms génériques, peut-être écrasés par un autre agent). À vérifier côté superviseur.
