# Lot 12 · Agent `possession` — récupérations de balle sans contact (point 2 du retour de test)

## Ce que le joueur a vu
« Des défenseurs récupèrent le ballon sans contact visible alors que mon joueur est devant eux ; le ballon se téléporte au défenseur, parfois en traversant mon joueur. »

## Reproduction (jeu réel, harnais vm, graine fixe, pas de 1/120 s)
Outils : `tests/lot12-possession/obs.mjs` (matchs entiers joués au hasard), `scenario.mjs` + `q.mjs` (duels ciblés : le héros conduit le ballon, un défenseur est placé à 0,9 / 1,3 / 2 m, devant, sur le côté ou derrière ; 306 essais, 72 à 85 pertes de balle selon la version), `compare.sh` (même balayage avant / après).

Anomalies **démontrées** (avant correctif) :

| # | Anomalie | Mesure avant |
|---|----------|--------------|
| A | `winBall` appelle `attachBall(défenseur)` : le ballon est **posé** à 0,58 m devant le défenseur en un seul pas, et le défenseur pivote d'un coup vers sa sortie (`defender.angle=…`). | saut du ballon en 1 pas : médiane 0,49 m, maximum 2,17 m (≈ 260 m/s) |
| B | Dans la conduite, la clause `close<.95 && random` donne le ballon à un défenseur qui n'a **aucun contact** (ni pied, ni corps) : il suffit qu'il soit à moins de 0,95 m du *héros*. | 14 récupérations sur 85 avec le ballon à plus de 1 m du défenseur (max 1,65 m) |
| C | Défenseur derrière / sur le côté : le ballon est reposé de l'autre côté du défenseur, donc **à travers le héros**. | 2 cas où le ballon passe à moins de 0,35 m du centre du héros (min 0,11 m) |
| D | `winBall` fait `defender.challenge=null` : la jambe (piqué, bloc) ou le tacle glissé est **coupé net** et le défenseur se relève instantanément ; seule une brève animation de frappe reste. | tacle glissé gagné : plus aucun challenge dès le contact |
| E | `resolve(...,'tackle')` écrase `ball.y=R` : un ballon intercepté en l'air (jusqu'à 1,7 m) tombe au sol en un pas. | saut vertical instantané |

Non reproduit / choix de design :
- Interception de passe (`sweptPlayerContact`, rayon 0,38 + 0,22 m, hauteur 1,7 m) : le contact est calculé sur la trajectoire balayée, donc réel ; seul le replacement du ballon (A, E) posait problème. Le bloc (`beginChallenge 'block'`) démarre déjà à moins de 1,6 m.
- Contact ballon / corps du défenseur (`< .59 m`) : c'est une vraie collision, conservée.
- Pressing (`tickPress`, le héros reprend le ballon à ≤ 0,95 m) : même téléportation dans l'autre sens (héros qui gagne). **Non traité** (hors de la plainte, laissé ouvert).

## Correctif
`dist/physics.js` (direct) : nouvelle fonction `followBall(ball, cible, dt, vitesse, corps)` — le ballon **roule** vers le point de contrôle à 9 m/s au plus, ne rentre pas dans les corps listés (défenseur 0,42 m, héros 0,5 m) et ne bouge jamais de plus de 1,6 × vitesse × dt par pas.

`dist/game.js` via `docs/audit-gameplay2/possession-patch.py` (5 remplacements exacts, idempotent) :
1. import de `followBall` ;
2. `winBall` : plus de `attachBall`, plus de rotation instantanée, la jambe/le tacle n'est plus coupé, la hauteur du ballon est conservée ; nouvelle `carryToOwner` ;
3. fin d'action : tant que son geste dure, le défenseur ne repart pas (pas de glissement sur place) ;
4. le ballon d'un défenseur vainqueur est suivi par `carryToOwner` (trajet physique) au lieu d'être recollé ;
5. conduite : `close<.95` ne donne plus le ballon, il déclenche un **piqué** (`beginChallenge 'poke'`) : la jambe doit réellement atteindre le ballon (`challengeHits`). Un défenseur derrière le héros ne peut donc plus le lui prendre sans le rattraper.

## Mesures (306 essais, mêmes graines)
| | avant | après |
|---|---|---|
| saut du ballon au moment de la récupération (1 pas) | médiane 0,49 m, max 2,17 m | médiane 0,05 m, max 0,16 m (c'est le mouvement normal du héros) |
| plus grand déplacement du ballon par pas de 1/120 s sur 1,5 s | 0,208 m | 0,12 m (≤ 14 m/s) |
| ballon à moins de 0,35 m du centre du héros | 2 cas (min 0,11 m) | 0 (min 0,50 m) |
| récupérations avec ballon à > 1,3 m du défenseur | plusieurs (max 1,65 m) | 0 (hors tacle glissé/bloc, qui ont leur portée) |
| récupérations / 306 duels forcés | 85 | 72 |

Effet sur l'équilibre : un défenseur au contact a un peu moins de chances de prendre le ballon dans le duel forcé (85 → 72 sur ces essais) car la clause sans contact est devenue un piqué qui peut rater. Les autres voies (piqué à portée, tacle glissé, bloc, collision corps) sont inchangées. À valider au téléphone : si la défense paraît trop molle, augmenter le taux `1.5` de la clause 5.

## Tests de non-régression (`tests/lot12-possession/possession.test.mjs`)
Le test applique lui-même le patch sur une copie en mémoire de `dist/game.js` (`LOT12_AVANT=1` désactive le correctif pour voir l'échec) : 3 des 4 tests échouent sans correctif (téléportation, tacle coupé, balayage de duels), tous passent avec.

## Reste ouvert
- Reprise de balle par le héros au pressing (`tickPress`) : même téléportation héros ← porteur (≤ 1,4 m). À traiter avec `controlAgain`.
- Les conditions de contact corps (0,59 m) laissent parfois une récupération « par le corps » sans jambe visible quand le héros conduit dans le défenseur : c'est une collision, pas un vol, mais une animation d'épaule/jambe pourrait la rendre plus lisible (moteur 3D, agent `mouvement`).
- Pas de vérification Chromium/GPU dans ce lot : mesures faites sur le vrai `game.js` dans le harnais ; à confirmer visuellement au téléphone (le ballon doit rouler jusqu'au pied du défenseur en ~0,1–0,2 s).

## À valider au téléphone
- Vitesse de roulement du ballon vers le défenseur : 9 m/s (constante dans `carryToOwner`).
- Distance d'évitement du héros : 0,5 m ; du défenseur : 0,42 m.
- Taux de piqué en conduite : `dt*1.5*match.profile.press` (inchangé, mais ne donne plus le ballon directement).
