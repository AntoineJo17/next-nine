# AUDIT-4 · Contrôles utilisateur, enchaînement des actions, robustesse (branche `qa/gameplay-controles`)

Périmètre : `dist/game.js` (seul fichier de jeu modifié), tests et outils nouveaux. Rien n'est publié (pas de push, pas de `npm run stamp`).

## Méthodes

1. Lecture de `game.js` (boucle `loop`/`tick`/`tickInterval`, gestes `startGesture`/`pointerup`, `startMatch`/`finish`/`leave`, `screen()`, `resolve`, fautes/cartons, hors-champ).
2. Fuzzing déterministe en Node sur le **vrai** `game.js` (harnais `tests/gameplay-controles/harness.mjs`, faux DOM permissif, faux moteur 3D, horloge pilotée). Contrairement aux harnais existants, `beginInterval`/`beginIncoming` ne sont pas remplacés : le vrai enchaînement simulation → occasion → simulation est joué.
   Évènements aléatoires : images (dt de 16 ms à 60 s), onglet masqué/réaffiché, pointerdown/move/up/cancel/lostpointercapture (1 à 3 doigts, relâchement hors fenêtre), tous les boutons (Jouer, Entraînement, Quitter, Reprendre, Aide, replay, vitesse, tactique, effet…), changements de mode et d'effet, redimensionnement, fautes/cartons/hors-jeu/buts/arrêts forcés.
   Invariants vérifiés à chaque pas : aucune exception, aucun NaN (balle, héros, carrière), `match` et `action` simultanément nuls ou non, aucun geste résiduel hors partie, énergie dans [0, 100], événements de but = score, score tactique = score du match en simulation, buts du joueur ≤ buts de l'équipe.
3. Observation réelle : Playwright Python, Chromium `--use-angle=metal --enable-gpu --ignore-gpu-blocklist`, 390×844 tactile (CDP `Input.dispatchTouchEvent`), serveur `python3 -m http.server 8784` sur une **copie** de `dist/` à laquelle on ajoute un crochet `window.__g` (lecture d'état uniquement ; `dist/` n'est pas modifié). Matchs complets joués au toucher, PNG regardés, `pageerror` et console capturés, compteur de rappels `requestAnimationFrame('loop')`.
   Contexte vierge : aucune sauvegarde personnelle.

## Résultats chiffrés

| Campagne | Volume | Résultat |
|---|---|---|
| Fuzz Node, évènements libres (quitter/relancer inclus) | 150 graines x 6 000 pas = 494 527 images, 93 959 gestes, 6 848 démarrages | 0 exception, 0 invariant violé |
| Fuzz Node « calme » (matchs complets enchaînés) | 40 graines x 15 000 pas = 330 188 images, 59 553 gestes, 148 matchs terminés | 0 exception, 0 invariant violé |
| Fuzz Node avec fautes/cartons/hors-jeu/buts forcés | 150 graines x 5 000 pas (412 899 images) + 12 graines x 20 000 (59 matchs) | 0 exception, 0 invariant violé (phase `card` exercée : 3 261 + 2 112 pas) |
| Sonde anti-blocage (un geste puis 40 s sans entrée) | 105 graines x 6 tours, 7 types de gestes + passes par repères | 0 blocage avec entrées réalistes (voir O2) |
| Parcours entraînement (6 leçons) | gestes réels | OK, retour accueil |
| Navigateur réel, Chromium GPU, tactile | 4 sessions (150 s, 300 s, 420 s, 540 s), ~7 000 évènements, rotations, 90 « Quitter » | 0 `pageerror`, 0 erreur console, boucle jamais figée |
| Navigateur réel, 3 matchs complets joués | 90 min chacun, ~50 s réelles | 0 erreur ; XP/parties comptés une fois |
| Fuites (navigateur) | 100 `setup()` + 6 quitter/relancer | géométries 127 → 135 puis plateau, textures 96 → 99, tas JS stable 31 Mo, boucle à 60–68 rappels/s (pas de boucle dupliquée) |

## Anomalies

| ID | Gravité | Reproduction | Cause (ligne de `dist/game.js` d'origine) | Statut |
|---|---|---|---|---|
| C0 | Haute si elle survient (match figé, plus rien ne répond, même pas « Quitter » ne relance la boucle) ; aucune exception naturelle trouvée par le fuzz | Toute exception levée dans `loop` (rendu, `tick`, `updateOffscreen`, …), p. ex. `escapeTarget` absent observé par le précédent agent. Test : `engine.render` qui lève une fois → `requestAnimationFrame` n'est plus rappelé | `loop` (l. 563) appelle `requestAnimationFrame(loop)` en dernière instruction, sans `try/catch` | **Corrigé** : `loop` = `try { loopFrame } catch { journalise + récupération }` puis replanifie toujours. 3 échecs de suite pendant une occasion : occasion annulée proprement (`resolve(..., 'miss')`, le match reprend) ; 90 échecs de suite : retour à l'accueil, énergie conservée, aucune partie comptée. Tests `boucle.test.mjs` (3 échouent avant, passent après) |
| C1 | Moyenne (frappe/passe involontaire) | Taper l'herbe (dribble), puis poser le doigt sur le ballon pendant le dribble et tirer vers soi ; le dribble se termine avant le relâchement : au relâchement le héros arme un **lob/une passe vers l'arrière, à l'endroit du doigt** au lieu de la frappe voulue (mode `lob` si le doigt est resté > 480 ms) | Un geste commencé pendant `phase==='dribble'` est de type `skill` ; au `pointerup`, si le dribble est fini (`ready`), `updateAim` le traite comme une visée « cible » et `windUp(..., 'normal'/'lob', drag.target)` part (l. 285-300) | **Corrigé** : `updateAim` ignore les gestes `skill` ; au relâchement un geste `skill` hors dribble est annulé (le râteau latéral et la poussée avant, valides, sont traités avant). Test `gestes.test.mjs` C1 (échoue avant : `windup` au lieu de `ready`) |
| C2 | Basse (consigne trompeuse, visible sur capture) | Pressing (occasion de type « pressing ») : la barre du bas affiche « TIRE VERS TOI POUR FRAPPER · TAP POUR JOUER » alors que le contrôle est « touche l'herbe pour courir sur le porteur » | `setupPress` ne remet pas `gestureLabel`, resté sur le texte de `setup` (l. 218) | **Corrigé** (texte + puissance remise à zéro). Test `libelles.test.mjs` |
| C3 | Basse à moyenne (son du stade qui continue sur l'accueil après perte du contexte 3D, geste fantôme) | Perte du contexte WebGL pendant un match (`webglcontextlost`) | Le gestionnaire (l. 565) remet `action`/`match` à `null` sans `ambience.stop()` ni `drag=null` | **Corrigé**. Test `contexte.test.mjs` (échoue avant) |
| O1 | Cosmétique | En match, une pastille de commentaire (« Centre pour … ») recouvre en partie le repère hors-champ du coéquipier au bas de l'écran (captures `s1_flight`, `s3_incoming`) | `.commentary` z-index 9 > `.offscreen` z-index 6, bas de l'écran ; la pastille est `pointer-events:none`, le repère reste cliquable | Proposé (ne pas toucher à la disposition sans validation du créateur) : remonter `.offscreen` ou borner le repère à `H-195`. Non corrigé |
| O2 | Basse (non atteignable avec des entrées réelles) | Passe vers un coéquipier à 52 m derrière (coordonnées d'écran hors fenêtre) : l'équipe s'enchaîne ensuite des passes (`teamPass` → `choice` → `teamPass`) plus de 40 s de jeu sans résolution ; `flightTime`/`age` repartent à zéro à chaque passe donc aucun délai ne s'applique | `football-ai.js` `teamDecision` + absence de plafond de passes dans `game.js` | Documenté dans `controles-autres.md` (football-ai) ; non corrigé car aucun scénario réel ne l'atteint (38 graines x 6 tours avec entrées réalistes : aucun blocage) |

## Vérifié, sans défaut (comportement conforme)

- Double appui sur Jouer : un seul match, aucun geste parasite (le second appui tombe sur le terrain, ignoré en phase `interval`/`incoming`).
- Quitter puis relancer (25 fois en Node, 6 fois en navigateur) : ni XP, ni partie, ni but comptés ; énergie bornée ; `drag`, `guideOpen`, `replay`, célébration, annonce, pause de but remis à zéro ; aucun écouteur ni boucle dupliqué.
- Deux doigts : le second est ignoré tant qu'un geste est actif ; un `pointerup` d'un autre identifiant ne déclenche rien ; un `pointerup` tardif ne redéclenche pas.
- `pointercancel`, `lostpointercapture`, Quitter ou Aide pendant un geste : geste et visée effacés ; `pointerup` tardif sans effet.
- Relâchement hors de la fenêtre : la frappe part avec la dernière visée (comportement actuel, pas de geste d'annulation prévu).
- Rotation portrait ↔ paysage pendant une occasion : rendu et toucher corrects (`ResizeObserver` du moteur).
- Retour d'onglet : `loop` ne fait rien tant que `document.hidden` ; un saut d'horloge de 10 min n'avance que de 40 ms (`dt` borné).
- But adverse : pause de 3 s dépendante du temps de jeu (suspendue par l'Aide), bouton de vitesse inactif, score +1 une seule fois, aucun résidu après Quitter.
- Fin de match : l'XP et les parties ne sont comptés qu'une fois ; score = événements ; score tactique = score du match. Aucune fin de match possible pendant une occasion (la simulation est suspendue).
- Énergie : toujours dans [0, 100] ; XP d'un match abandonné inchangée ; une partie abandonnée coûte l'énergie dépensée (plancher de 85 % à chaque départ, règle existante).

## Limites

- Faux moteur 3D en Node (projection linéaire) : les gestes sont réalistes en logique, pas en géométrie ; la géométrie réelle est couverte par les sessions navigateur.
- Le crochet `window.__g` du navigateur sert à observer l'état ; tous les gestes sont de vrais évènements tactiles/souris.
- Non testé sur téléphone réel : reprise du son après retour d'application (iOS), `lostpointercapture` avant `pointerup` (ordre propre à certains navigateurs), clic droit souris (démarre un geste, desktop uniquement).
- `dist/index.html`, `dist/style.css` : aucun changement.

## Commandes

```
export PATH=<node portable>/bin:$PATH
node --check dist/game.js
node --test tests/gameplay-controles/*.test.mjs                  # 20 tests, ~30 s
node --test tests/*.test.mjs                                     # suite principale (229/229 attendus)
node --test tests/career-qa/*.test.mjs                           # 71/71 attendus (« normal must collide with the keeper » est connu pour être instable)
node scripts/audit/controles/fuzz-run.mjs <graine> <nb> <pas> [calm]   # campagne de fuzz
GAME_JS=<ancien game.js> node --test tests/gameplay-controles/*.test.mjs  # rejouer les tests contre une ancienne version (échecs attendus avant correctif)
scripts/audit/controles/probe-stall.mjs, probe-skill.mjs, probe-train.mjs # sondes Node
scripts/audit/controles/serve-obs.sh <dossier_tmp>                # copie de dist + crochet d'observation, sert sur 8784
scripts/audit/controles/py.sh scripts/audit/controles/play2.py <png> <graine> <secondes>   # match complet au toucher
scripts/audit/controles/py.sh scripts/audit/controles/play3.py <png> dbl|relaunch|rotate|hidden|gest|leak
scripts/audit/controles/py.sh scripts/audit/controles/fuzz-browser.py <png> <graine> <secondes> [calm]
```
