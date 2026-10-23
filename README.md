# NEXT NINE — code source V18

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

192 tests passent sur cette version (V20 · lot 4). Les tests ne remplacent pas un essai visuel et tactile sur téléphone.

Après une modification, change le numéro de version pour que les téléphones rechargent tous les fichiers :

```sh
npm run stamp -- "V18 · correctif" 18-1
```

## Mettre le jeu en ligne (GitHub Pages)
Le dépôt contient `.github/workflows/pages.yml` : à chaque envoi sur la branche `main`, GitHub relance les tests puis publie `dist/`.

1. Crée un compte sur github.com, puis un dépôt public nommé `next-nine`, vide (sans README).
2. Depuis ce dossier, envoie le code (GitHub demandera de te connecter dans le navigateur, ou un jeton d'accès) :

```sh
git remote add origin https://github.com/TON-COMPTE/next-nine.git
git push -u origin main
```

3. Sur GitHub : Settings → Pages → Source : « GitHub Actions ».
4. Après une à deux minutes (onglet Actions), le jeu est en ligne à l'adresse `https://TON-COMPTE.github.io/next-nine/`. Ouvre-la sur ton téléphone ; dans Safari, Partager → « Sur l'écran d'accueil » le lance en plein écran.

Pour chaque mise à jour : `npm run check`, `npm run stamp -- "<libellé>" <jeton>`, `git commit -am "…"`, `git push`. La sauvegarde de carrière reste dans le navigateur du téléphone : elle n'est jamais envoyée sur GitHub.

## Organisation
- dist/ : code applicatif directement exécutable et dépendance Three.js avec sa licence. commentary.js (commentaires) et audio.js (son du stade) sont nouveaux en V18.
- scripts/stamp.mjs : numéro de version des fichiers (voir plus haut).
- .github/workflows/pages.yml : tests puis mise en ligne sur GitHub Pages.
- tests/ : tests Node, dont simulations et contrôleur du jeu.
- PROJECT.md : historique technique détaillé.
- PASSATION_CLAUDE.md : contexte, demandes et règles de collaboration.
- CODE_APPLICATION.txt : copie texte des sources applicatives pour les interfaces qui ne lisent pas les ZIP (sans Three.js ni les tests).
- capacitor.config.json : préparation pour un futur portage ; les projets natifs iOS/Android ne sont pas inclus.

Version de référence : 753b49784d01830f89f0377dc309f61d064b3bed (V13), puis V13.1 à V18 (voir PROJECT.md). L’historique git local commence à la V17 et contient un commit par idée (21 à 30).
Le numéro npm 0.2.0 est historique et ne désigne pas le numéro de l’itération V13.
