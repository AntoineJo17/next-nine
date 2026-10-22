# NEXT NINE — code source V13

Prototype web de carrière de foot, conçu pour téléphone. HTML, CSS, JavaScript natif et Three.js fourni dans dist/vendor.

## Lancer le jeu
Depuis le dossier extrait, avec Python 3 :

```sh
python3 -m http.server 8000 --directory dist
```

Ouvrir http://localhost:8000 dans un navigateur. Ne pas ouvrir index.html directement en file:// : le jeu utilise des modules JavaScript.
Aucune compilation ni installation npm n’est nécessaire pour jouer. La sauvegarde de carrière est stockée dans le navigateur ; une sauvegarde personnelle n’est pas incluse.

## Vérifier les modifications
Avec Node.js 20 ou supérieur et npm :

```sh
npm run check
```

141 tests passent sur cette version (V17). Les tests ne remplacent pas un essai visuel et tactile sur téléphone.

## Organisation
- dist/ : code applicatif directement exécutable et dépendance Three.js avec sa licence.
- tests/ : tests Node, dont simulations et contrôleur du jeu.
- PROJECT.md : historique technique détaillé.
- PASSATION_CLAUDE.md : contexte, demandes et règles de collaboration.
- CODE_APPLICATION.txt : copie texte des sources applicatives pour les interfaces qui ne lisent pas les ZIP (sans Three.js ni les tests).
- capacitor.config.json : préparation pour un futur portage ; les projets natifs iOS/Android ne sont pas inclus.

Version de référence : 753b49784d01830f89f0377dc309f61d064b3bed (V13), corrigée en V13.1 par l’audit de Claude (voir PROJECT.md).
Le numéro npm 0.2.0 est historique et ne désigne pas le numéro de l’itération V13.
