# Correctifs à appliquer hors périmètre (AUDIT-1 physique)

Ces deux corrections touchent des fichiers interdits à l'agent AUDIT-1 (`dist/movement.js`, `dist/game.js`).
Chacune est donnée en remplacement exact (le texte « ancien » apparaît une seule fois dans le fichier, vérifié par `grep -c`).
Après application : `npm run stamp` (versions `?v=`), puis `node --test tests/*.test.mjs tests/gameplay-physique/*.test.mjs`.
Les tests `todo` de `tests/gameplay-physique/keeper-dive-body.test.mjs` et `loop-cap.test.mjs` passeront alors (ils échouent avant, c'est le but).

## P1 · `dist/movement.js` : le ballon traverse le corps d'un gardien en plongeon

Fichier : `dist/movement.js`, fonction `keeperTouches` (ligne 16), branche `k.state==='dive'`.

Ancien (copié à l'identique) :

```js
return Math.abs(ball.z-k.z)<.65&&Math.hypot(ball.x-handX,ball.y-handY)<.42+R;}
```

Nouveau :

```js
if(Math.abs(ball.z-k.z)<.65&&Math.hypot(ball.x-handX,ball.y-handY)<.42+R)return true;const lean=Math.abs(k.tilt||0),side=Math.sign(k.tilt||k.dir)||1,fx=k.x,fy=Math.max(.1,.1+k.y),tx=k.x+side*Math.sin(lean)*1.7,ty=Math.max(.1,Math.cos(lean)*1.7+k.y),sx=tx-fx,sy=ty-fy,u=clamp(((ball.x-fx)*sx+(ball.y-fy)*sy)/(sx*sx+sy*sy||1),0,1);return Math.abs(ball.z-k.z)<.55&&Math.hypot(ball.x-(fx+sx*u),ball.y-(fy+sy*u))<.2+R;}
```

Principe : en plongeon (`dive`, dès que `|diveDX| >= .6`), seule une sphère autour de la main était testée (centre à 1,0 à 1,5 m de haut). Le corps (jambes, torse couché, rendu par `engine.js` ligne 442 : `pose.rotation.z = tilt`) n'avait aucun volume : une balle rasante à son aplomb passait à travers et le but était accordé. Le correctif ajoute le segment pieds-tête (longueur 1,7 m, incliné de `tilt` du côté `dir`, rayon 0,2 m + rayon du ballon).

Preuves :
- Reproduction navigateur (Chromium Metal, 390x844) : gardien figé en plongeon (`elapsed=.35`), balle au sol x=-0,5 vers le but : « BUUUT » sans que le gardien ne la touche (capture : le corps est couché sur la ligne, la balle le traverse). Après correctif : « Arrêt du gardien ! ».
- Balayage 300 tirs visés au gardien (`node scripts/audit/physique/sweep-keeper.mjs 300 5 all`) : 41 buts avant, dont 38 disparaissent après correctif (ballon rasant à l'aplomb du gardien en plongeon ou à terre) ; 7 buts après.
- Balayage 500 frappes aléatoires de tous angles (`sweep-shots.mjs 500 11`) : 95 buts / 32 arrêts avant, 76 buts / 44 arrêts après.
- Suite complète sur copie corrigée : 229/229 (avant ajout des tests gameplay-physique) ; les 2 tests todo P1 passent après correctif.

Attention équilibrage : la proportion de buts baisse d'environ 20 % sur les frappes aléatoires, parce qu'une part de ces buts étaient des tirs rasants qui traversaient le gardien. Si le créateur veut compenser, ajuster la précision/force du gardien (`updateKeeper`, `k.react`, `k.misread`) plutôt que de retirer le corps du plongeon. Variante plus douce : rayon 0,2 -> 0,16 m.

## P2 · `dist/game.js` : plafond du pas de temps de `loop()` = ralenti sous 25 images/s

Fichier : `dist/game.js`, fonction `loop` (ligne 563).

Ancien (copié à l'identique) :

```js
function loop(t){const dt=Math.min((t-lastTime)/1000,.04);
```

Nouveau :

```js
function loop(t){const dt=Math.min((t-lastTime)/1000,.1);
```

Principe : la simulation avance de `min(dt réel, 0,04 s)` par image. Dès que l'appareil descend sous 25 images/s, le temps de jeu s'écoule moins vite que le temps réel (15 i/s : 60 %, 10 i/s : 40 %, 5 i/s : 20 %), ce qui est un ralenti involontaire (règle « pas de ralenti » de PASSATION_CLAUDE.md) : ballon, joueurs et gardien semblent flotter. `loop()` découpe déjà en sous-pas de 1/120 s (`const d=Math.min(remaining,1/120);tick(d)`), donc un plafond de 0,1 s ne crée pas de tunnel (balayages dt 1/20 à 1/240 : mêmes issues dans 94 % des cas, écarts seulement après contact). Retour d'un onglet en arrière-plan : `document.hidden` suspend les ticks et `lastTime` est remis à jour par chaque `requestAnimationFrame`, le premier pas après retour est au plus 0,1 s.
Les audits externes en rendu logiciel (SwiftShader, 0,8 à 2 i/s, cf. docs/PERF.md) voient le jeu à 3-8 % de la vitesse réelle à cause de ce plafond : ce n'est pas la physique, c'est ce plafond.
Variante prudente : 0,08.
