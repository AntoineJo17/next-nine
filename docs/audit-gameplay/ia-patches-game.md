# AUDIT-3 · correctifs proposés pour `dist/game.js` (fichier interdit à l'agent : à appliquer par le superviseur)

Remplacements EXACTS (le texte ancien apparaît une seule fois dans `dist/game.js`, vérifié par `grep -c`).
Source machine-lisible : `scripts/audit/ia/game-patches.json`. Les trois remplacements ont été **appliqués à la volée dans Chromium** (interception `page.route`, fichier du dépôt intact) sur les mêmes graines que la série sans patch : voir le résultat sous chaque correctif.

Après application : `node --check dist/game.js`, puis `node --test tests/*.test.mjs`, puis `npm run stamp` (par le superviseur).

## G1 · phase « pressing » : les 20 autres joueurs sont des statues

- Reproduction : graines 62, 63, 64, 65 sans patch ; 62 à 71 avec patch (`python scripts/audit/ia/browser_probe.py <graine> <dossier> smart 6`, occasion de type `press`, 16 % des occasions observées : 19 sur 115).
- Mesure avant : déplacement maximal des 9 autres défenseurs et des 10 partenaires entre le début et la fin de l'occasion = **0,00 à 0,01 m** pendant que le porteur et le héros courent jusqu'à 5 m (durées observées 0,25 à 1,6 s ; un pressing raté peut durer 6 s).
- Cause : `updateActors` commence par `if(a.phase==='press')return;` ; la fonction `patrol(p,i,dt)` (déjà écrite, balancement léger autour de la position d'origine) n'est appelée nulle part dans le fichier. De plus `applyChanceKind` fait `return` pour `press` avant d'affecter `p.home`, donc `home` n'existe pas dans cette phase.
- Remplacement :
  - ancien : `function updateActors(a,dt){if(a.phase==='press')return;`
  - nouveau : `function updateActors(a,dt){if(a.phase==='press'){let k=0;for(const p of [...a.defenders,...(a.teammates||[])]){if(p===a.pressCarrier||p.tacticalId%11===0)continue;if(!p.home)p.home={x:p.x,z:p.z};patrol(p,k++,dt);}return;}`
- Mesure après (même graines, patch appliqué à la volée) : déplacement maximal 0,22 à 0,69 m, moyenne 0,46 m, aucune erreur de console. Limite : `patrol` est un simple balancement (±0,6 m) ; il supprime l'effet « statue » mais ne donne pas encore de vraie défense/appel de balle pendant le pressing (choix de design à faire par le créateur).
- Gravité : moyenne (visible à chaque occasion de pressing, 1 sur 6).

## G2 · penalty : le gardien allié est posté au bord de la surface adverse

- Reproduction : toute occasion `penalty` (graines 11, 16, 28 de la série initiale) : `E.initial.T[0]` = gardien allié = (-7,2 ; -2,6).
- Cause : `setupPenalty` fait `[...a.teammates,...a.defenders].forEach((p,i)=>…)` ; `a.teammates[0]` est toujours le gardien allié (indice 0 de la simulation), placé comme un joueur de champ à `i = 0` : x = -7,2, z = -2,6.
- Remplacement :
  - ancien : `[...a.teammates,...a.defenders].forEach((p,i)=>{const side=i%2?1:-1,rank=Math.floor(i/2)%5;`
  - nouveau : `[...a.teammates.filter(t=>t.tacticalId%11!==0),...a.defenders].forEach((p,i)=>{const side=i%2?1:-1,rank=Math.floor(i/2)%5;`
- Mesure après : gardien allié à (-0,55 ; 82,4), sur sa ligne (graine 63).
- Gravité : faible à moyenne (2,6 % des occasions), mais voir la correction de `resumeTactical` déjà appliquée (la simulation ne gardait pas ce déplacement non plus, avant ma correction).

## G3 · coup franc : le gardien allié est posté au milieu du terrain

- Reproduction : toute occasion `coup franc` (18 sur 115 occasions observées, soit 16 %) : gardien allié = (14 ; 18) m, à 65 m de son but.
- Cause : `setupFreeKick` trie `[...a.teammates]` par distance à (0 ; -14) ; le gardien, le plus loin, reçoit le dernier emplacement de la liste `spots` ([14,18]).
- Remplacement :
  - ancien : `const mates=[...a.teammates].sort((p,q)=>Math.hypot(p.x,p.z+14)-Math.hypot(q.x,q.z+14))`
  - nouveau : `const mates=a.teammates.filter(t=>t.tacticalId%11!==0).sort((p,q)=>Math.hypot(p.x,p.z+14)-Math.hypot(q.x,q.z+14))`
- Mesure après : gardien allié à (-0,38 ; 82,4) (graines 61, 63, 64).
- Gravité : faible à moyenne (16 % des occasions).

## Non proposé (choix de design, voir `ia.md`)

- Pression défensive très efficace du héros contre le bot de test (80 % des occasions jouables finissent par un tacle en moins de 4 s avec une conduite naïve) : difficulté, pas un défaut d'IA.
- Partenaires hors appels : ils restent près de leur poste (±8 m) ; 3,9 % seulement du temps immobiles à moins de 25 m du héros (hors pressing).
