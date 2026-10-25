# Correctifs `dist/game.js` proposés par AUDIT-2 (à appliquer par le superviseur)

`dist/game.js` était hors périmètre : aucun fichier n'a été touché. Un seul remplacement, exact, à appliquer sur le texte tel qu'il est dans `dist/game.js` (une occurrence).

## P1 · Célébration d'un but lointain : le buteur ne s'arrête plus net au milieu du terrain (M4)

Fichier : `dist/game.js`, fonction `celebrate`.

Texte ancien (copié à l'identique) :

```
if(d<.45||c.time>2.6){c.phase='perform';
```

Texte nouveau :

```
if(c.d0==null){c.d0=d;c.duration+=Math.max(0,d-14)/6;}if(d<.45||c.time>2.6+Math.max(0,c.d0-14)/6){c.phase='perform';
```

Effet : jusqu'à 14 m de la cible rien ne change (délai de 2,6 s conservé) ; au-delà, la course dure `(d-14)/6` s de plus (6 m/s ~ vitesse de course du buteur) et `c.duration` (qui pilote `continueDelay`, donc le passage automatique à la suite) est rallongé d'autant : la célébration n'est pas écourtée. Mesuré avant : départ z = 8 -> arrêt à 9,2 m de la cible, 6,8 m/s, après 2,61 s ; départ x = -12, z = 15 -> 15,9 m, 6,7 m/s.

Preuve : `tests/gameplay-mouvement/celebration.test.mjs` applique ce remplacement en mémoire (échoue sans, passe avec). Quand le remplacement est dans `dist/game.js`, le test passe sans transformation ; `STRICT_GAME_PATCHES=1 node --test tests/gameplay-mouvement/celebration.test.mjs` exige sa présence.

## Piste (non fournie sous forme de remplacement) · M5

Pendant `a.ended`, `resolveBodyContacts` (et la boucle de séparation de `updateActors`) repousse les défenseurs immobiles (`speed = 0`) devant les partenaires qui courent féliciter le buteur : ils glissent à jusqu'à 6,4 m/s pieds immobiles (~1 s sur 25 matchs). Effet rare ; si on veut le supprimer, ne pas appeler `separateBodies(d, t, …)` pour les partenaires quand `a.ended && a.celebration`.
