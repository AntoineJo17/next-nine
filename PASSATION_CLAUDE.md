# Passation à Claude — NEXT NINE V19 (étape 8)

Tu reprends un jeu existant avec son créateur et Codex. Lis README.md et PROJECT.md, puis le code avant toute modification. Préserve le fonctionnement existant et explique tes changements. Rends une archive complète modifiée ou un patch unifié, avec la liste des fichiers touchés, les tests exécutés et les limites constatées. Ne prétends pas avoir testé visuellement si tu ne l’as pas fait. Aucun canal automatique ne synchronise Claude et Codex : le créateur transfère les fichiers.

## Vision et préférences
Carrière joueur sur téléphone, usage personnel et quelques amis, web pour le moment. Inspirations NSS, World Soccer Champs et Score Hero. Moments décisifs jouables et simulation tactique accélérée entre les actions. Clubs et joueurs fictifs actuellement ; noms et logos réels différés.
Terrain plein écran, geste de frappe tiré vers soi puis relâché, visée courte pour conserver la difficulté. Pas de ralenti. Dribble au toucher du terrain, passe au coéquipier et lob par maintien ; geste latéral pour râteau. Les temps de décision doivent laisser le joueur réfléchir. Pas de noms flottants : noms et numéros contrastés sur le maillot uniquement. Stade complet avec coins et public. Progression lente et entraînement séparé, énergie visible.

## Dernières demandes prises en compte dans V13, à évaluer en jeu
- But adverse : pause réelle de trois secondes, animation et nom du buteur ; le score n’est incrémenté qu’une fois.
- Caméra élargie pour voir les ailes, les partenaires et les passes en retrait.
- Partenaires : choix entre conduite, passe, centre et tir selon la situation ; pas d’obligation de jouer systématiquement en une touche.
- Défense : renouvellement du joueur au pressing, couverture de la profondeur, anticipation du porteur et marquage. Éviter de courir vers une position ancienne du ballon ou de monter en laissant le porteur seul.
- Shorts avec deux jambes et inscriptions de maillot recentrées.
- Frappe trop puissante pouvant passer au-dessus de la barre.
- Suppression des bandes rouges sur le gazon lors du danger adverse.

## Architecture à respecter
- game.js orchestre l’interface, les états, les actions et la carrière.
- engine.js dessine le terrain, les joueurs, la caméra, le public et les animations Three.js.
- physics.js : trajectoire, gravité, collisions, cages et filets.
- movement.js et football-ai.js : déplacements, défense et décisions.
- tactical.js : simulation de possession à 22 joueurs, influencée par les niveaux ; les coordonnées de la simulation amènent les occasions 3D, puis l’état retourne à la simulation.
- gestures.js : reconnaissance des gestes ; certaines fonctions et certains tests historiques peuvent ne plus représenter le contrôle actif. Vérifier leurs appels dans game.js.
- career.js : énergie, sauvegarde et progression.

## Points sensibles et limites
Les tests automatisés passent (177/177 en V20 · lot 1), mais cette livraison n’a pas fait l’objet d’une validation visuelle complète dans un navigateur ou sur téléphone. Priorité : tester réellement la caméra, les commandes tactiles, les décisions défensives et la fluidité des animations.
Les personnages sont des modèles procéduraux stylisés, pas des modèles réalistes animés par capture de mouvement. Leur naturel reste à améliorer avec le créateur.
Le système d’effet actuel est un petit sélecteur gauche/droit/tout droit près du score. Plusieurs gestes d’effet précédents ont été rejetés par le créateur : faire valider toute nouvelle interaction avant de la généraliser.
Les collisions doivent rester cohérentes pour tirs, passes et lobs : arrêt = ballon bloqué ou repoussé ; but = ballon dans les filets ; rebond = pas de maintien artificiel de l’effet initial.
L’énergie possède encore des règles provisoires de récupération avant rencontre ; le calendrier de carrière complet reste à développer.
Préserver les sauvegardes existantes, le passage exact simulation/occasion et l’absence de ralentissement. Ne pas remplacer le jeu par une maquette.

## Pour une collaboration simple
1. Reproduire le problème ciblé et définir un changement limité.
2. Modifier, lancer npm run check et tester les interactions dans un navigateur si possible.
3. Ajouter des tests de régression utiles pour les bugs de logique.
4. Fournir le code complet ou un patch et un bref compte rendu. Ne pas publier ni modifier l’hébergement sans demande du créateur.
5. Avant toute livraison : `npm run stamp -- "<libellé>" <jeton>` pour que les téléphones ne gardent pas d’anciens fichiers en cache.

## État V18
Idées 21 à 30 livrées (détail dans PROJECT.md) : poste du joueur, consignes et confiance du coach, tactique d’équipe active dans la simulation, banc, entrées et sorties, changements, scénarios (derby, remontada, dernière journée, pluie, carton rouge), commentaires courts, son du stade synthétisé, célébrations selon le contexte, replay facultatif. Le créateur a demandé la mise en ligne : un workflow GitHub Pages est prêt, à activer depuis son compte GitHub. Nouvelles données de carrière (position, trust, tactic, sound) : les anciennes sauvegardes reçoivent des valeurs par défaut.
À évaluer en jeu : équilibre des tactiques avec les occasions jouées, fréquence des sorties décidées par le coach, volume et timbre du son sur téléphone, lisibilité des poses de célébration, intérêt du point de vue du replay.

## État V20 · lot 1 (en cours de test)
Lot 1 « sensations de jeu » tiré de l'audit ChatGPT : passe d'introduction réelle, priorité des gestes, effet synchronisé, appel non forcé, décisions des coéquipiers, marquage stable (détails dans PROJECT.md, V20). Prochains lots proposés : gestion entre les matchs (énergie, entraînement, compétences séparées), championnat vivant (classement, historique, accueil), identité du club (petit stade qui grandit, affluence, horaires), défis entre amis.

## État V19 (étapes 1 à 8, en ligne)
Terrain réel 105 × 68 m et stade complet ; interface du match épurée (menu ⋯) ; gardien en position, vraie course (rythme × 1,35, touches de 5 m), arrêt sur image pendant les décisions ; jeu aérien (têtes, retournée, lobs, moins de centres) ; duels d'épaule, tacles glissés, fautes et cartons ; hors-jeu avec juge de touche ; 15 célébrations aléatoires en cinématique ; compte à rebours et lecteur de replay à quatre caméras ; quartier vivant autour du stade. Détail et chiffres dans PROJECT.md, section V19.

## Publier une mise à jour
1. `npm run check` (177 tests, environ 1 min 30).
2. `npm run stamp -- "<libellé>" <jeton>`.
3. Commit, puis envoi via GitHub Desktop (« Push origin ») : le terminal n'a pas d'identifiants GitHub.
4. GitHub Actions relance les tests et publie dist/ sur https://antoinejo17.github.io/next-nine/.
Les commits sont signés « AJ <aj@next-nine.invalid> » pour ne pas exposer l'adresse du créateur sur le dépôt public.
