# Passation à Claude — NEXT NINE V13 (audit V13.1 appliqué)

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
Les tests automatisés passent (113/113), mais cette livraison n’a pas fait l’objet d’une validation visuelle complète dans un navigateur ou sur téléphone. Priorité : tester réellement la caméra, les commandes tactiles, les décisions défensives et la fluidité des animations.
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
