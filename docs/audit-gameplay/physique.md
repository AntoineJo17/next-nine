# AUDIT-1 · Physique du ballon, passes, tirs, collisions

Branche `qa/gameplay-physique`. Aucun fichier de jeu modifié : `dist/physics.js` et `dist/gestures.js` n'ont aucun bug démontré. Deux défauts réels ont été trouvés dans des fichiers hors périmètre : correctifs exacts dans `physique-patches-game.md`.

## Méthodes

1. Lecture de `physics.js`, `gestures.js`, et dans `game.js` : `tick` (vol, contacts, but, gardien), `releaseBall`, `windUp`, `resolve`, `makeLoose`, `loop`.
2. Balayages déterministes (graines fixes) en Node, dans le jeu réel chargé par le harnais vm (`tests/career-qa/harness.mjs`), pilotés par `tests/gameplay-physique/_game.mjs` (invariants relevés à chaque tick : NaN, y sous le sol, vitesse, sauts de position, franchissement de ligne, état du gardien à ce moment, buts comptés).
3. Observation navigateur réelle (Chromium Metal, 390x844, `game.js` patché à la volée par `page.route` pour exposer l'état, aucun fichier modifié) : trajectoires image par image à 27-41 images/s et captures regardées.

## Commandes

```
export PATH=/private/tmp/claude-502/-Users-AJ-Downloads-NEXT-NINE-V13/db178aee-03b3-48b9-9487-bf2487b7ce7a/scratchpad/node-v22.11.0-darwin-arm64/bin:$PATH
node --test tests/gameplay-physique/*.test.mjs                  # 12 tests verts + 3 « todo » (P1 x2, P2) qui échouent tant que les correctifs ne sont pas appliqués
node scripts/audit/physique/sweep-physics.mjs                   # physics.js seul, 4000 trajectoires x 5 pas de temps
node scripts/audit/physique/sweep-shots.mjs 500 11              # 500 frappes/passes/lobs de toutes positions, dt variable
node scripts/audit/physique/sweep-keeper.mjs 300 5 [all]        # tirs visés sur le gardien
node scripts/audit/physique/sweep-frame.mjs 150 3               # tirs visés sur poteaux/barre
node scripts/audit/physique/sweep-scenarios.mjs 40 13           # penalty, coups francs, aile, meneur (200 situations)
node scripts/audit/physique/sweep-incoming.mjs 200 9            # passes entrantes sol/lob
node scripts/audit/physique/sweep-cross.mjs 100 31              # centres + reprises de volée/tête
node scripts/audit/physique/sweep-dt.mjs 100 17                 # indépendance au pas de temps
node scripts/audit/physique/monkey.mjs 300 99                   # joueur aléatoire (dribbles, passes, lobs, râteaux, frappes), 90 s simulées max
python browser_observe.py <dossier> | browser_keeper_dive.py <dossier> [x]   # serveur dist sur 8781
```

## Résultats chiffrés

| Balayage | Volume | Résultat |
|---|---|---|
| physics.js seul | 4 000 trajectoires x dt 1/20, 1/30, 1/60, 1/120, 1/144 | 0 NaN, 0 balle sous le sol. Issues but/pas but différentes selon dt dans 62 cas, uniquement à très grande distance avec effet, aux pas 1/20 et 1/30 que le jeu n'utilise jamais (sous-pas <= 1/120). |
| rebonds | dt 1/20 à 1/480 | crêtes décroissantes (0,71 / 0,31 / 0,24 m), pas de rebond fantôme ; écart de crête <= 0,02 m entre 1/60 et 1/480 (0,06 m à 1/20). |
| jeu réel, frappes/passes/lobs | 500 (graine 11) + 60 dans les tests | 0 NaN, 0 sous le sol, 0 but compté deux fois, 0 but sans franchissement valide, 0 balle franchissant la ligne dans le cadre sans issue « but » hors gardien/défenseur, 0 action bloquée. |
| poteaux / barre | 150 tirs, 48 contacts | 0 pénétration, vitesse après contact <= vitesse avant (restitution 0,72), issues cohérentes (but sur rebond intérieur, « à côté » sur rebond extérieur). |
| scénarios spéciaux | 200 (penalty, 2 coups francs, aile, meneur) | 0 anomalie. |
| passes entrantes | 200 | 100 % reçues, interceptées ou libres, 0 blocage. |
| centres + reprises | 100 | 0 anomalie. |
| pas de temps dans le jeu | 100 frappes x 7 découpages (1/120, 1/240, frames de 1/20, 1/30, 1/60, 1/144, 0,04 s) | issue identique pour 94 % ; les 6 % restants divergent après un contact (poteau, défenseur) : sensibilité chaotique normale, pas une dépendance systématique. |
| singe | 360 actions complètes | 0 exception, 0 NaN, 0 blocage. |
| gardien | 300 tirs visés | 41 buts dont 38 sont des balles qui traversent le gardien : voir P1. |

## Problèmes retenus

| ID | Gravité | Reproduction | Cause | Fichiers | Statut |
|---|---|---|---|---|---|
| P1 | Haute | `node scripts/audit/physique/sweep-keeper.mjs 300 5 all` : tirs d'indice i=8, 11, 20, 25, 26, 40, 59, 72, 78, 98, 99... dans la sortie `all` ; ou le test `keeper-dive-body.test.mjs` ; navigateur : `browser_keeper_dive.py` : gardien en plongeon, balle rasante à x=-0,5 : but accordé, le corps couché du gardien est sur la balle (capture `dive_3.png`). | `keeperTouches` (movement.js:16), branche `dive` : quand `\|diveDX\| >= .6`, seule une sphère autour de la main (hauteur 1,0-1,5 m) est testée. Jambes et torse (rendu incliné par `tilt`) n'ont aucun volume. Une balle basse à l'aplomb du plongeon passe à travers. | `dist/movement.js` (interdit) | Proposé, testé sur copie : correctif exact dans `physique-patches-game.md`. 229/229 sur copie corrigée, tests todo P1 verts après. |
| P2 | Moyenne | Lire `loop()` : `dt = min(dt réel, 0,04)`. À 15 images/s le jeu avance à 60 % du temps réel, à 5 images/s à 20 %. Test `loop-cap.test.mjs`. | Plafond de pas trop bas ; `loop()` sous-découpe déjà à 1/120 s, donc le plafond ne protège de rien. Contredit « pas de ralenti ». C'est ce qui rend le jeu « flottant » en rendu logiciel (audits externes) ou sur un téléphone lent. | `dist/game.js` (interdit) | Proposé (plafond 0,1 s), exact dans `physique-patches-game.md`. |
| D1 | Basse | `sweep-shots.mjs` : 23 passes au sol sur 500 dépassent 45 m/s (jusqu'à 72 m/s). | `launch` mode `low` : durée plafonnée à 1,25 s, donc vitesse initiale = 1,1 x distance au-delà de 26 m (40 m : 44 m/s ; 60 m : 66 m/s), plus rapide qu'une frappe à pleine puissance (31 m/s). La visée de passe n'est pas bornée en distance. | `physics.js` `launch`, `game.js` | Choix de design / équilibrage : non modifié. Piste : allonger le plafond de durée de la passe basse (2,4 s ramène 40 m à ~30 m/s) ou borner la portée. |
| D2 | Basse (visuel) | `sweep-shots.mjs` (rapport « jump »), toutes réceptions. | À la réception ou à l'arrêt, la balle est collée instantanément (`attachBall`, `keeperGrip`) : saut de 0,8 à 2,1 m. Aussi arrêt du gardien (`keeperGrip`) et hors-jeu (balle posée au sol depuis 1,7 m de haut). | `game.js`, `engine.js` | Choix de design (balle au pied à la prise de contrôle) : non modifié ; un lissage visuel relèverait du moteur de rendu. |
| D3 | Info | Tir `power > .72` : `vy = 1,2 + 2,8p + (p-.72) x 32` | Une frappe à pleine puissance décolle à 13 m/s verticaux (apex ~9 m) : tirs en tribune. | `physics.js` `launch` | Choix de design (risque/récompense de la puissance) : non modifié. |
| D4 | Info | Frappe avec `spin` = -0,52 sur 26 m : la balle dévie de ~6 m (rotation de la vitesse ~0,5 rad sur 1,3 s). | `stepBall` fait tourner la vitesse de `spin x .75 x min(1, v/20)` rad/s. | `physics.js` | Choix de design (l'aperçu de visée et le vol utilisent la même fonction). |

## Non reproduit (recherché, aucune anomalie)

Ballon qui traverse joueur adverse, coéquipier, poteau, barre ou filet (hors P1) ; but compté deux fois ; but non compté alors que la balle est dedans (la balle qui rebondit sur le poteau puis entre est bien comptée) ; passe qui change de cible ou s'arrête en l'air ; accélération sans contact (spin et gravité conservent ou réduisent l'énergie horizontale ; seule la chute libre accélère) ; balle immobile coincée (fin forcée à 7 s par `a.ball.age`) ; sortie de terrain sans suite (résolue par `resolve` à |x| > 34,5 ou z > 85 ou z < -24) ; NaN/Infinity (y compris pas de 0,25 s à 2 s) ; balle sous le sol ; plantage de boucle (singe).
Exception d'interprétation à noter : l'arrêt sur une frappe à plus de 25 m/s peut être « repoussé » plutôt que capté (`tick`, branche gardien de `game.js`) : conforme à la règle « arrêt = ballon bloqué ou repoussé ».

## Limites

- Les balayages tournent dans un faux DOM (harnais vm) : pas de rendu, pas de latence tactile ; le rendu est vérifié seulement sur les scénarios navigateur listés.
- Les situations de plusieurs IA concurrentes (tactique 2D) et `engine.js` (animation, filets visuels) ne sont pas couverts ici.
- La baisse de buts après P1 (-20 % sur frappes aléatoires, mesurée sur 500 tirs) est une conséquence attendue d'un gardien réellement solide : à valider par le créateur.
- Le test connu instable « normal must collide with the keeper » n'a pas été touché.
