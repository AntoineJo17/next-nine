# QA carrière, sauvegarde et cohérence

Tests déterministes dans `tests/career-qa/` (59 tests). Le glob `node --test tests/*.test.mjs` ne descend pas dans les sous-dossiers : lancer

    node --test tests/career-qa/*.test.mjs      # ou : tests/career-qa/run.sh

Aucune vraie sauvegarde n'est utilisée : toutes les données sont des fixtures écrites dans les tests. `harness.mjs` charge `dist/game.js` dans un contexte `vm` (faux DOM, faux `localStorage`, faux `Blob`/`URL`) et expose `playMatch`, `exportFile`, `importText`.

| Fichier | Couvre |
|---|---|
| `roundtrip.test.mjs` | export puis import, rechargement, idempotence de `parseCareer`, look complet (face, brow, beardColor, number, name) |
| `migration.test.mjs` | fixtures V13 à V19 (reconstituées d'après `parseCareer`), champs manquants, face partielle, hors bornes, types faux, NaN |
| `hostile.test.mjs` | JSON malformé, tronqué, trop gros, imbriqué, `__proto__`/`constructor`, couleurs hostiles, stockage illisible ou bloqué |
| `journey.test.mjs` | 12 journées : bornes, monotonie, XP égale à `performance + coach + scénario`, niveau, énergie, confiance |
| `import-reset.test.mjs` | cas « IMPORT QA » (QA-07), rechargement, reset annulé ou confirmé, brouillon du vestiaire |

## Conclusions

- **QA-07 : pas d'incohérence.** Une carrière importée avec 2 matchs, 1 but et `xp: 0` affiche bien JOURNÉE 3 / 6 et 0 / 700 XP. Les statistiques et l'XP sont des champs indépendants. Le premier match joué ensuite rapporte au moins 10 XP.
- **Cas voisin à connaître** : une ancienne sauvegarde sans `baseXP`/`baseLevel` mais avec de l'XP s'affiche aussi 0 / 700 XP après import. C'est voulu : le niveau général est figé dans `baseLevel` (`xp/100`) et l'indicateur ne compte que l'XP gagnée depuis.
- **Défaut corrigé** : `parseCareer` acceptait `position` = `constructor`, `__proto__`, `toString`... car `POSITIONS[s.position]` lit aussi les clés héritées d'`Object`. Le jeu plantait ensuite (`Cannot read properties of undefined (reading 'text')`) dans `refresh()`. Corrigé par `Object.hasOwn(POSITIONS, ...)`. Régression : `hostile.test.mjs`.

## Limites connues (non modifiées)

- Au chargement, une sauvegarde invalide (par exemple nom de plus de 20 caractères) est ignorée en silence : le jeu démarre sur une carrière neuve et la sauvegarde illisible est écrasée à la première action. Le test vérifie qu'elle n'est pas écrasée avant. Le correctif est dans `dist/game.js`, hors périmètre.
- Une carrière neuve n'a pas `chem` ni `weakFoot` ; ils apparaissent (`{}` et 0,45) au premier rechargement ou import. Aucune perte.
- Les formes des sauvegardes V13..V19 sont une hypothèse déduite du code, pas des fichiers réels.
- `xp` est plafonné à 10 000 000 à l'import, sans plafond lors du jeu (hors de portée en pratique).
