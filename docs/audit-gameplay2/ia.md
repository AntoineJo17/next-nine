# Lot 12 · agent `ia` — point 4 du retour de test (partenaires cantonnés, passes insuffisantes, adversaires qui tournent, passes en profondeur lentes)

Branche : `worktree-agent-abd2478ed50e38cee` (départ : main `f8b6c28`). Rien n'est poussé ni publié.

Fichiers modifiés directement : `dist/football-ai.js` (nouvelle fonction `supportSpot`).
Fichier `dist/game.js` : **modifié uniquement par le script** `docs/audit-gameplay2/ia-patch.py` (7 remplacements exacts, vérifié sur une copie propre de main : résultat octet pour octet identique). `dist/tactical.js`, `dist/physics.js`, `dist/movement.js` : **non touchés**.
Tests : `tests/lot12-ia/ia.test.mjs` (10 tests : 9 échouent sur l'ancien code, 1 garde-fou d'équilibre de la simulation 2D). Outils de mesure : `tests/lot12-ia/{mesure,profondeur,duel,equilibre,sim2d,scenario}.mjs`.

## Méthode

Mesures sur le **vrai** `game.js` (harnais vm, balayage déterministe de `tests/gameplay-mouvement/sim.mjs`, héros joué au hasard, graines fixes), comparées avant/après avec la même graine. Les chiffres « avant » viennent d'une copie propre de main. Ce n'est pas un test sur téléphone.

## Constats

| Anomalie du retour de test | Verdict | Mesure |
|---|---|---|
| Passes en profondeur anormalement lentes | **Démontrée** | voir A |
| Partenaires trop cantonnés à leur poste | **Démontrée** (en 3D) | voir B |
| Possibilités de passes insuffisantes | **Démontrée, effet modéré** | voir B |
| Adversaires qui tournent autour du ballon sans le récupérer | **Démontrée seulement pendant la « protection du ballon »**; non reproduite en conduite ni dans la simulation 2D | voir C |
| Passes au sol (« low ») lentes | **Non reproduite** : 22 à 25 m/s en moyenne, 40 m en 1,3 s | — |
| Passes lobées (« lob ») un peu lentes | **Choix de design**, non modifié (voir « Reste ouvert ») | durée = distance / 13, de 1,05 à 2,2 s |

### A · Passe en profondeur lente (corrigé)

- Reproduction : `node tests/lot12-ia/profondeur.mjs 30 3` — le joueur touche le bout d'une course planifiée (même chemin que le geste : `planRuns` puis `throughRun` puis `windUp` puis `releaseBall`).
- Cause : `releaseBall` réglait la vitesse du ballon sur le temps de course du partenaire (`dist / run + 1,2`, plancher 6 m/s). Quand le partenaire est loin du point (jusqu'à 28 m, les courses planifiées n'étaient pas bornées), le ballon part à 5,5 à 8 m/s ; avec le frottement du sol (0,55 /s) il **s'arrête avant le point** ou se fait couper.
- Avant : vitesse de départ moyenne **6,7 m/s** (5,5 à 8,3), temps de trajet 2,5 s, ballon arrivé au point **2 fois sur 8**.
- Correctif (patch 3 et 4) : le ballon arrive au point en 0,75 fois le temps de course du partenaire, borné entre `distance/22` et `distance/12` secondes (donc jamais en dessous de 12 m/s en moyenne), jamais plus vite que la passe normale, et il ne roule pas plus de 12 m au-delà du point. Une course de plus de 16 m est raccourcie (le point reste en jeu, il devient moins profond).
- Après : vitesse de départ moyenne **14,0 m/s** (12,6 à 16,7), 1,16 s de trajet, ballon arrivé au point **11 fois sur 16** (les autres : coupés par un défenseur, ce qui est normal).

### B · Partenaires cantonnés et peu d'options de passe (corrigé en partie)

- Cause : en jeu, un partenaire sans ballon ne visait que `poste + décalage fixe + suivi du porteur` (`updateActors`, 2,7 m/s), sans tenir compte des défenseurs ni de la ligne de passe. Seules 2 courses (« appels ») pouvaient être proposées.
- Correctif :
  - **`supportSpot`** (football-ai.js) : autour de son poste (rayon 5 m défenseur, 8 m milieu, 10 m attaquant), le partenaire évalue ~30 points et prend le meilleur : ligne de passe ouverte depuis le porteur, espace par rapport aux marqueurs (jamais à moins de 1,4 m d'un adversaire), en jeu, ni trop près du porteur (< 5 m) ni sur un coéquipier, ne recule pas derrière sa zone. Un latéral du côté du porteur peut passer à l'extérieur (**dédoublement**), les attaquants se glissent **entre les lignes** juste derrière la ligne de hors-jeu. Un défenseur reste derrière le ballon. Le choix est stable (il n'en change que si l'autre est nettement meilleur) et recalculé toutes les 0,4 s ; il court à 3,9 m/s quand le point est à plus de 2,5 m (2,7 avant). Le gardien n'est jamais déplacé. Un partenaire collé au porteur (< 3 m) garde son ancien comportement le temps de s'écarter (sinon il bloquait physiquement un défenseur en duel d'épaule : test V19 existant).
  - Jusqu'à **3 appels** (au lieu de 2) proposés au joueur.
  - Au début d'une occasion « jeu ouvert », un partenaire dont la ligne est bouchée est placé d'emblée dans un espace ouvert (disposition de départ de la scène, pas un déplacement visible).
- Mesures (3 graines de 150 matchs, 330 décisions de passe par côté ; « passables » = à 4 à 35 m du porteur, ligne libre > 1,2 m, adversaire > 2,2 m, en jeu) :

| | avant | après |
|---|---|---|
| distance moyenne des partenaires à leur poste | 2,7 m (p90 6,3) | **4,9 m** (p90 10,4) |
| partenaires passables à chaque décision | 3,12 | 3,30 |
| décisions avec 1 option ou moins | 13,7 % | 12 % |
| appels proposés par décision | 1,01 | **1,49** |
| options totales (passes libres + appels) | 4,14 | **4,78** (+15 %) |

  Lecture honnête : le gain principal est sur les appels et sur le mouvement des partenaires ; le nombre de partenaires directement passables ne bouge que de peu (le jeu est « au tour par tour » : les partenaires ne courent que pendant les conduites, les passes et les réceptions, soit 1 à 2 s entre deux décisions).

### C · Adversaires qui tournent autour du ballon (corrigé pour la protection ; non reproduit ailleurs)

- Non reproduit en conduite : `node tests/lot12-ia/duel.mjs` (le joueur enchaîne des conduites droit vers le but) : 52 à 59 % des conduites perdues en moins de 0,5 s ; aucun défenseur collé (< 1,6 m) plus de 0,6 s sans tacler (max 0,59 s). Simulation 2D (`sim2d.mjs`) : un adversaire reste à moins de 3,5 m du porteur 0,4 s en moyenne, jamais plus de 2,5 s ; les joueurs de champ sont à 9,9 m de leur poste en moyenne : rien à corriger.
- **Démontré en protection du ballon** (geste « protéger ») : le défenseur visait un point à 1,4 m du joueur, alors que la perte de balle ne se joue qu'à moins de 1 m (`if(distance<1 && random<dt*.35)`) : il restait ~1 s à moins de 2 m (distance minimale moyenne 1,41 m) et ne prenait le ballon que dans 7,5 % des protections.
- Correctif (patch 5) : pendant la protection, le défenseur vient au contact (0,95 m, la séparation des corps garde ≥ 0,82 m). Après : distance minimale ~1,0 m, ballon perdu dans ~25 % des protections où un défenseur est proche. **Cela rend la protection un peu plus risquée** (voir équilibre) : à valider.

## Équilibre

`node tests/lot12-ia/equilibre.mjs 200 <graine>` — héros joué au hasard, 6 graines x 200 matchs = 1 200 matchs (1 800 occasions jouables) avant et après :

| | avant | après |
|---|---|---|
| buts par occasion jouable | 12,35 % (218 / 1 765) | **13,2 %** (237 / 1 799) |
| buts par match (3 occasions) | 0,18 | 0,20 |
| tacles réussis par l’adversaire (par occasion) | 58,5 % | 57 % |

L'écart (+0,02 but par match) est dans le bruit statistique (environ 1 écart-type). La difficulté n'est pas modifiée de façon mesurable ; la simulation 2D (`tactical.js`) n'est pas modifiée (0,75 but et 3,8 tirs par match, 77 passes — inchangés). Un premier essai de dédoublement dans la simulation 2D faisait passer les centres de 15,9 % à 22,5 % des occasions (test V19 « fewer crosses » rouge) : abandonné et retiré.

## Tests

`npm run check` : **229 / 229** verts. `node --test tests/career-qa/*.test.mjs tests/gameplay-*/*.test.mjs tests/lot12-ia/*.test.mjs` : **146 verts, 0 échec, 2 todo volontaires** (136 + 2 d'avant, + 10 nouveaux). Les 10 nouveaux ont été relancés sur le code d'origine : 9 échouent (`supportSpot` absent, vitesse de profondeur, protection, soutien), le garde-fou 2D passe avant et après.

Les nouveaux tests n'étant pas dans `tests/*.test.mjs`, le superviseur doit ajouter `tests/lot12-ia/*.test.mjs` à sa commande de campagne.

## Reste ouvert / non fait

- **Lob** (`physics.js`, `launch`, `duration = distance/13`, 1,05 à 2,2 s) : un lob de 20 m dure 1,5 s, de 30 m 2,2 s. Plausible mais un peu lent ; non modifié (fichier d'un autre agent). Piste : `distance/16` borné à 1,9 s.
- Frottement du ballon au sol très fort (0,55 /s, `stepBall`) : explique que les passes longues « meurent » ; non touché.
- Réactions défensives (appels de pression, couverture) : non modifiées, aucune anomalie démontrée.
- Les partenaires déplacés par `supportSpot` peuvent croiser un défenseur : `pushOut` pousse alors le défenseur (jamais observé hors du balayage de mouvement, qui passe).
- Pas d'essai en navigateur 3D (CPU saturé par les autres agents) : tout est mesuré dans le harnais, pas à l'écran.

## À valider au téléphone

1. Les partenaires bougent-ils de façon naturelle (pas de va-et-vient, pas de course dans un défenseur, un latéral qui double sur l'aile quand tu es sur le côté) ?
2. Passe en profondeur (toucher le bout d'une flèche de course) : le ballon part franchement (~14 m/s) et le partenaire le reçoit ; trop rapide / trop facile ?
3. 3 flèches d'appel au lieu de 2 : lisibles ? Une course de partenaire éloigné est raccourcie.
4. Protection du ballon : le défenseur te colle puis récupère parfois (25 %) ; est-ce trop sévère ? (valeur à ajuster : `0.95` dans le patch 5, ou le `.35` de perte par seconde).
5. Valeurs réglables : vitesse de soutien 3,9 m/s, rayon 5 / 8 / 10 m, bonus de dédoublement 4,5 (`dist/football-ai.js`, `supportScore` et `supportSpot`).

## Commandes

```
export PATH=/private/tmp/claude-502/-Users-AJ-Downloads-NEXT-NINE-V13/db178aee-03b3-48b9-9487-bf2487b7ce7a/scratchpad/node-v22.11.0-darwin-arm64/bin:$PATH
python3 docs/audit-gameplay2/ia-patch.py                   # applique les remplacements à dist/game.js (idempotent, arrêt si une cible est absente)
node --test tests/lot12-ia/*.test.mjs                      # 10 tests
node tests/lot12-ia/mesure.mjs 150 6                       # distance au poste, partenaires passables, appels, vitesse des passes, adversaire collé
node tests/lot12-ia/profondeur.mjs 30 3                    # passes en profondeur
node tests/lot12-ia/duel.mjs 40 4                          # conduites contre les défenseurs
node tests/lot12-ia/equilibre.mjs 200 21                   # buts par occasion jouable
node tests/lot12-ia/sim2d.mjs 300                          # simulation 2D
```
