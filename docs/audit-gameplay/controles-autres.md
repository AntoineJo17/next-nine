# AUDIT-4 · Défauts relevés hors des fichiers autorisés (non modifiés)

Aucun correctif n'a été appliqué à `physics.js`, `engine.js`, `movement.js`, `football-ai.js`, `tactical.js`, `career.js`, `gestures.js`.

## A1 · football-ai / game.js · enchaînement de passes d'équipe sans plafond (basse, non atteignable avec des entrées réelles)

- **Reproduction** : `node scripts/audit/controles/probe-stall2.mjs 3 1`. Après un geste de passe vers le coéquipier n° 3 placé à z = 52 m (derrière le héros ; dans la sonde, la projection factice accepte des coordonnées d'écran hors fenêtre), les coéquipiers enchaînent des passes sans arrêt : `teamPass` → `choice` → `teamDecision` renvoie `pass` → `windUp` → `flight` → …, plus de 40 s de jeu sans résolution (`callPause` de 3 s à chaque passe). Les délais de sécurité de `tick` (`flightTime > 2`, `ball.age > 5`) repartent à zéro à chaque nouvelle passe, donc ne s'appliquent jamais.
- **Cause probable** : `teamDecision` (football-ai.js) peut choisir `pass` indéfiniment quand aucun tir ni aucune conduite n'est plus attractif ; `game.js` n'a aucun plafond du nombre de passes d'équipe consécutives dans une même occasion.
- **Atteignable avec des entrées réelles ?** Non démontré : une passe vers un coéquipier à plus de 45 m n'est pas proposée par les repères hors-champ et un coéquipier à 52 m n'est pas tapable à l'écran. Sonde avec entrées réalistes (taps sur joueurs visibles, repères, frappes, lobs, râteaux, feintes, protection) : 105 graines x 6 tours, aucun blocage.
- **Correctif proposé** (si le créateur le souhaite) : dans `playTeamDecision`, compter `a.teamPasses` ; au-delà de 4 passes d'équipe sans que le héros touche le ballon, forcer `decision.kind='shot'` ou clore l'occasion avec `resolve(false, 'L’équipe garde le ballon.', a.shotBy, 'deflection')` après avoir posé `a.newOwner = a.receiver`, pour que `resumeTactical` rende la possession à l'équipe. À faire dans `football-ai.js`/`game.js` par l'agent propriétaire.
- **Gravité** : basse.

## A2 · gestures.js

Aucun défaut constaté dans la reconnaissance elle-même (`targetGesture`, `lateralSkill`, `assistedShot`) : les défauts de geste trouvés (C1) venaient de `game.js` (type de geste non revalidé au relâchement).

## A3 · engine.js

Aucune exception ni fuite constatée pendant les sessions réelles (100 `setup()` successifs : plateau des géométries et textures, tas JS stable). Observations visuelles sur captures, non liées aux contrôles : la caméra de coup franc montre le dessous des tribunes (bande grise haute) sur la capture `s2_ready` ; à valider par l'agent « caméra ».
