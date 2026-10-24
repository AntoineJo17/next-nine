# NEXT NINE – protocole de mesure de performance (moteur 3D)

Ce document décrit un protocole reproductible et les mesures obtenues le 25/10/2026. Il ne dit jamais « le jeu tourne à N FPS » sans machine, backend WebGL et phase : un chiffre sans ces trois éléments ne veut rien dire.

## Contexte : d'où vient le « 5 FPS » de l'audit

L'audit externe a mesuré ~5 FPS par `requestAnimationFrame` sur 2,1 s, dans un Chromium headless piloté par Playwright avec 6 pages en parallèle. Ce n'est pas une mesure du moteur Three.js sur un appareil réel. Ce que montrent les mesures ci-dessous :

- Le Chromium headless de Playwright utilise **SwiftShader (rendu WebGL logiciel sur CPU)** par défaut, même sur un Mac Apple Silicon. Les phases 3D y tombent à 0,8–2 images/s (une scène 3D) ; le chiffre « 5 FPS » est cohérent avec cet ordre de grandeur, pas avec le GPU.
- Avec `--use-angle=metal` (vrai GPU), les mêmes pages tiennent 60 images/s (plafond vsync), y compris à 3 pages en parallèle.

## Matériel et logiciels de la campagne

| Élément | Valeur |
|---|---|
| Machine | MacBook Air, Apple M2, 8 Go de RAM (`sysctl machdep.cpu.brand_string hw.memsize`) |
| OS | Darwin 23.4.0 arm64 (`uname -srm`) |
| Navigateur | Chromium 156.0.8078.4 (Playwright), headless, viewport 390x844 (taille téléphone) |
| Backend « default » | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device ...))` = **logiciel (CPU)** |
| Backend « metal » | `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` -> `ANGLE (Apple, ANGLE Metal Renderer: Apple M2)` = **GPU** |
| Backend « metal-uncapped » | idem + `--disable-frame-rate-limit --disable-gpu-vsync` : retire le plafond 60 Hz pour voir le coût réel d'une frame |
| Backend « swiftshader » | option disponible (`--use-angle=swiftshader --enable-unsafe-swiftshader`), équivalent à « default » ici, non rejoué |
| WebKit | non testable sur ce Mac (bloqué), Chromium uniquement |

Le backend réellement utilisé est lu dans la page (`WEBGL_debug_renderer_info`) et imprimé en tête de chaque exécution : ne pas se fier au seul argument de lancement.

## Protocole

Scripts (dans `scripts/perf/`, aucun fichier du jeu requis) :

- `serve.py` : serveur statique du dossier `dist/` sur le port 8773, avec une file TCP large. Le `python3 -m http.server` standard (backlog 5) refuse des connexions quand plusieurs pages chargent leurs modules ensemble (`net::ERR_SOCKET_NOT_CONNECTED`) : une page sur trois restait alors bloquée sur « Préparation du terrain… ». C'est un artefact du banc de mesure (vérifié : 0 blocage sur 6 essais avec `serve.py`).
- `measure.py` : mesure par phase.
- `profile.py` : profil CPU (CDP) de la phase 3D, pour savoir où va le temps JS.
- `results/*.json` : toutes les sorties brutes de cette campagne.

Phases :

| Phase | Comment elle est atteinte | Ce qui est rendu |
|---|---|---|
| `home` | page d'accueil / menu | **aucun appel de dessin** (la boucle du jeu ne rend rien tant qu'aucune action n'est en cours ; le canvas 3D n'est pas dessiné à l'accueil) |
| `locker` | `?debug=1`, clic `#openLocker`, attente de `globalThis.__locker.running` | vestiaire : 1 joueur, 25 appels de dessin, 49 k triangles |
| `match3d` | clic `#practice` (entraînement), fermeture du guide, action en phase « ready » (statique, animations d'attente) | terrain complet : ~176 appels de dessin, ~626 k triangles |
| `match3d-action` | idem, puis un pilote enchaîne tir par glisser / replay / occasion suivante pendant la mesure | idem avec ballon, joueurs et caméra en mouvement |
| `tactical2d` | clic `#play` : simulation tactique 2D (`#tacticalPitch`). Elle s'interrompt à chaque occasion (action 3D) ; le pilote enchaîne les occasions et seules les frames où le terrain 2D est affiché sont retenues, sur une fenêtre 4x plus longue | canvas 2D, 0 appel WebGL |

Pour chaque phase : 3 s d'échauffement, puis 10 s de mesure (tactical2d : 40 s de fenêtre, on ne garde que les frames 2D). Une page = un contexte de navigateur isolé. Mesures : temps entre deux `rAF` (p50/p95/p99/max), durée JS cumulée des callbacks `rAF` du jeu par frame (`js_cb_ms`, soumission GL comprise mais pas le travail GPU/raster), appels de dessin et triangles par frame (compteurs injectés sur `drawElements/drawArrays/...` car `renderer.info` n'est pas exposé par `game.js` : `engine` est une variable de module), mémoire JS (`performance.memory`, quantifiée par Chromium donc peu informative).

Commandes (depuis la racine du dépôt ; `$PY` = `"/Users/AJ/Downloads/NEXT NINE - Agents de test/.venv/bin/python"`) :

```
python3 scripts/perf/serve.py 8773 dist &
$PY scripts/perf/measure.py --phases all --pages 1 --backend default --out scripts/perf/results/1p-default.json
$PY scripts/perf/measure.py --phases all --pages 1 --backend metal
$PY scripts/perf/measure.py --phases all --pages 1 --backend metal-uncapped
$PY scripts/perf/measure.py --phases all --pages 3 --backend default --ready-timeout 120   # saturation
$PY scripts/perf/profile.py --backend metal-uncapped                                         # où va le temps JS
```

Options utiles : `--phases home,locker,match3d,match3d-action,tactical2d`, `--pages N`, `--duration`, `--warmup`, `--viewport LxH`, `--headed`.

## Résultats (après correctif de la foule, voir plus bas)

Mac M2 / Chromium 156 / viewport 390x844. Temps de frame = intervalle `rAF` en ms ; « fps » = 1000 / p50. Entre parenthèses : p95 / max.

### Une seule page

| Phase | SwiftShader (CPU) | Metal, vsync (GPU) | Metal sans plafond |
|---|---|---|---|
| accueil (0 dessin) | 16,7 ms (16,7 / 16,8) | 16,7 ms (16,8 / 16,8) | 17,7 ms (17,8 / 20,7) (le plafond de l'accueil n'a pas été levé : cause non identifiée) |
| vestiaire (25 dessins, 49 k tri) | 50,0 ms = 20 fps (83 / 167) ; variable d'une exécution à l'autre : 2 à 20 fps | 16,7 ms (16,8 / 16,8) | 1,3 ms (3,4 / 21) |
| match 3D « ready » (~176 dessins, 626 k tri) | 550 ms = ~2 fps (683 / 750) ; autres exécutions : 0,75 à 2 fps | 16,7 ms (16,7 / 16,8), JS 2,6 ms | 3,9 ms (7,5 / 26) |
| match 3D en action | 500 ms = ~2 fps (586 / 650) | 16,7 ms (16,8 / 16,8), JS 2,5 ms | 3,9 ms (8,4 / 119), JS 3,3 ms |
| simulation tactique 2D (0 dessin) | 16,7 ms* | 16,7 ms (16,8 / 33) | 0,9 ms (3,3 / 891) |

\* SwiftShader : 1 s seulement de frames 2D récoltées (le pilote ne progresse presque pas, chaque frame 3D coûte ~0,5 s) ; la valeur n'est pas significative. Le coût 2D ne dépend pas du backend WebGL (0,5 ms de JS dans tous les cas).

### Trois pages en parallèle (une par contexte, mêmes phases en même temps)

| Phase | SwiftShader (CPU) | Metal, vsync | Metal sans plafond |
|---|---|---|---|
| accueil | 16,7 ms, 60 fps | 16,7 ms, 60 fps | non mesuré |
| vestiaire | 100 ms = ~10 fps par page | 16,7 ms (16,8 / 16,8) | 4,1 ms (12,5 / 43) par page |
| match 3D « ready » | 1 225 ms = ~0,8 fps par page | 16,7 ms (16,8 / 16,8) | 12,5–15 ms (50–56 / 135) par page, ~50 fps chacune |
| match 3D en action | 1 250 ms = ~0,8 fps par page, callbacks JS jusqu'à 900 ms | 16,7 ms (16,7 / 33), 60 fps | non mesuré |
| simulation tactique 2D | 16,7 ms (pages 1–2 : <1 s récoltée) | 16,7 ms (16,7 / 66), 59 fps | non mesuré |

Lecture :

1. **La saturation de l'audit est reproduite avec SwiftShader** : le rendu logiciel se partage les cœurs CPU entre les pages. Une scène de match passe de ~2 fps (1 page) à ~0,8 fps par page (3 pages). Ce n'est pas le FPS du moteur sur GPU.
2. **Sur le GPU Metal, rien ne sature** à 3 pages : 60 fps partout (plafond vsync). Sans plafond, une page de match fait 3,9 ms/frame seule (≈230 fps) et ~13 ms/frame quand 3 pages se partagent le CPU : le goulot sur ce Mac est le **thread principal JS**, pas le GPU (`js_cb_ms` ≈ `frame_ms`).
3. Le coût 3D est dominé par la scène complète : ~176 appels de dessin et ~626 k triangles par frame, contre 25 appels / 49 k triangles au vestiaire. C'est ce volume (stade, foule, ville) qui sera le plus sensible sur téléphone, pas un défaut de l'accueil ni de la simulation 2D.
4. L'accueil ne dessine rien en 3D (0 appel de dessin) et la simulation tactique non plus : leur coût est du JS négligeable (0–0,6 ms par frame).

## Défaut mesuré et corrigé : animation de la foule non limitée (dist/engine.js)

Le profil CPU (`profile.py`, match 3D, Metal sans plafond) a montré 36 % du temps JS dans la mise à jour de la foule : `animateCrowd` (engine.js) + `Euler -> Quaternion` (`setFromEuler`) + `updateMatrix` + `updateMatrixWorld`.

Cause : la classe `Pitch3D` définissait `animateCrowd` **deux fois**. La première version est limitée à 20 Hz comme son commentaire l'annonce (« The crowd animates at 20 Hz ») ; la seconde, définie plus loin dans la classe, la masquait silencieusement et recalculait ~170 spectateurs x 6 matrices à **chaque frame**. Correctif : suppression de la copie sans limitation (5 lignes, aucune autre modification). Les 226 tests `tests/*.test.mjs` passent, `node --check dist/engine.js` est OK.

Avant / après (Metal sans plafond, match 3D « ready », 3 exécutions chacune, `scripts/perf/results/before-fix-*.json` et `after-fix-*.json`) :

| Mesure | Avant | Après |
|---|---|---|
| temps de frame p50 | 6,2 / 6,3 / 6,2 ms | 4,1 / 4,2 / 4,2 ms (−33 %) |
| JS des callbacks rAF p50 | 5,9 / 6,0 / 5,9 ms | 3,5 / 3,6 / 3,5 ms (−40 %) |
| fps moyen (sans plafond) | 154 / 148 / 150 | 211 / 214 / 213 (+41 %) |
| part de `engine.js` dans le profil CPU | 16,0 % | 2,9 % |

Ce gain est mesuré sur un M2, CPU seul : sur un téléphone, 2,4 ms de JS économisés par frame valent probablement davantage en proportion, mais cela reste **à confirmer sur l'appareil**. Le profil restant est dominé par le parcours de scène et la préparation des programmes de Three.js (`projectObject`, `updateMatrixWorld`, `getProgram`/`getParameters` ≈ 25 % cumulés, liés au nombre d'objets/matériaux), ce qui pointe vers la fusion d'objets statiques comme prochaine piste, **non engagée** ici faute de mesure sur téléphone justifiant le risque visuel.

Note de déploiement : `index.html` importe `engine.js?v=20-9s` ; sans passage de `scripts/stamp.mjs` (hors périmètre de cette mission), les navigateurs ayant déjà le fichier en cache ne verront pas la correction.

## Limites

- **Un Mac M2 en headless n'est pas un téléphone.** CPU de bureau 3 à 6 fois plus rapide qu'un téléphone milieu de gamme, GPU, thermique, résolution, `devicePixelRatio` différents. Les valeurs absolues ne se transposent pas ; seuls les rapports (avant/après, 1 page contre 3) et l'identification des goulots sont exploitables.
- Le vsync plafonne `rAF` à 60 Hz sur Metal : un p50 de 16,7 ms signifie « tient 60 fps », pas « 16,7 ms de coût ». Le coût réel se lit dans `metal-uncapped` et `js_cb_ms`. Le travail GPU n'est pas mesuré directement (pas de requête de timer WebGL).
- `js_cb_ms` n'est que le temps JS du callback (soumission des commandes comprise), pas le temps de raster/GPU.
- Mémoire : `performance.memory` est quantifiée par Chromium (valeurs fixes sur 10 s) ; elle ne permet pas de détecter une fuite. Pas de mesure de pression mémoire sur 8 Go.
- Les variations sous SwiftShader sont fortes d'une exécution à l'autre (vestiaire : 2 à 20 fps sur 5 exécutions) : le Mac partage ses cœurs avec d'autres processus ; les chiffres SwiftShader sont des ordres de grandeur.
- `match3d` reste en phase « ready » (animations d'attente) ; `match3d-action` déclenche des tirs par glisser aux coordonnées du centre du canvas, sans scénario de jeu maîtrisé (les occasions varient d'une exécution à l'autre).
- `tactical2d` récolte des segments de 4 à 10 s entre occasions ; sous SwiftShader le pilote avance trop lentement pour en collecter 10 s.
- Chromium uniquement ; Safari/WebKit (le moteur des iPhone) n'a pas pu être testé.
- Sur trois pages en parallèle, une page sur ~6 est restée bloquée à l'initialisation avec le serveur `http.server` standard (voir `serve.py`) ; avec `serve.py` ce blocage n'est plus apparu.

## Anomalie de jeu observée (hors périmètre, non corrigée)

Pendant les enchaînements du pilote, la boucle de jeu s'est arrêtée (exception non rattrapée, puis plus aucune frame de gameplay) dans 4 des ~14 exécutions où le pilote jouait plusieurs occasions :

```
TypeError: Cannot read properties of undefined (reading 'x')
  at moveToward (movement.js:4)
  at updateActors (game.js:463)   // branche `a.ended` : d===a.newOwner && a.after<1.1 -> moveToward(d, a.escapeTarget, ...)
  at tick (game.js:518) / loop (game.js:561)
```

`a.escapeTarget` est apparemment non défini dans certains cas où un nouveau porteur de balle est désigné après la fin de l'action. Comme `loop` n'est pas protégé, l'exception interrompt `requestAnimationFrame(loop)` et fige le match. À faire examiner côté gameplay (non reproduit à la main, déclenché ici par des tirs répétés sans réflexion). Ce n'est pas un problème de performance.

## À demander : mesure sur le téléphone du créateur

Aucun de ces chiffres ne remplace une mesure sur l'appareil réel. Il n'existe aujourd'hui aucun affichage FPS dans le jeu : `?debug=1` n'expose que `globalThis.__locker` (vestiaire), et `engine` n'est pas exposé. Pas de mode FPS proposé sans modification de `game.js` (interdite dans cette mission). Protocole minimal pour le téléphone :

1. Ouvrir le jeu hébergé, `Réglages Safari/Chrome > Développeur` : brancher le téléphone à un Mac, ouvrir l'inspecteur Web (Safari > Développement > [iPhone]) ou `chrome://inspect` (Android).
2. Dans la console, coller le contenu de la fonction `INIT_JS` de `scripts/perf/measure.py` avant de charger la page n'est pas possible à distance ; à la place, après chargement, lancer :
   `(function(){let l=performance.now(),a=[];function f(t){a.push(t-l);l=t;if(a.length<600)requestAnimationFrame(f);else{a.sort((x,y)=>x-y);console.log('p50',a[300],'p95',a[570],'max',a[599])}}requestAnimationFrame(f)})()`
   dans quatre états : accueil, vestiaire, match 3D (après « Prendre ses marques »), simulation tactique.
3. Noter le modèle du téléphone, le navigateur, la charge batterie/mode économie d'énergie, et envoyer les quatre lignes `p50/p95/max`.
