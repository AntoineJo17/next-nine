# NEXT NINE

Jeu mobile de carrière joueur pour Antoine-Jo, usage personnel et quelques amis, sans commercialisation prévue. Références : World Soccer Champs, New Star Soccer et Score! Hero. Seules les actions décisives sont jouées.

## Direction acceptée
- Tester dans le navigateur du téléphone pour l'instant, au même lien. Aucune application à télécharger à ce stade.
- À terme : application mobile, personnages reconnaissables, personnalisation approfondie, vrais clubs/logos/effectifs (sources à sélectionner).
- Développer d'abord la jouabilité, puis enrichir la carrière.

## V2
Three.js est embarqué localement dans dist/vendor (licence MIT incluse). Terrain, but, personnages stylisés 3D, trajectoires balistiques et rebonds. Sauvegarde locale compatible V1. La première apparence est personnalisable : teint, cheveux, numéro. Les effectifs restent fictifs.

## Vérification
`npm run check` couvre la syntaxe, la physique et la progression de carrière. Le navigateur de test n'est pas disponible dans l'environnement : rendu, contrôles tactiles et performances restent à valider sur le téléphone.

## Application ultérieure
La configuration Capacitor est préparatoire. Aucun projet iOS/Android ni binaire signé n'a été généré. Le jeu peut ultérieurement être embarqué avec ses assets sans dépendre du site distant ; compilation iOS et signature via Xcode sur Mac. Ne pas confondre la prévisualisation web avec une app installée.

## V3 — retours de jeu
- Contrôle en retrait : partir du ballon et tirer dans la direction opposée à la frappe. Trajectoire affichée, caméra fixe rapprochée.
- Occasions à environ 11–14 mètres du centre du but. Dribbles orientables courts (3,2 m maximum), défenseurs qui suivent et peuvent récupérer.
- Personnages articulés, déplacements, course, armé et frappe synchronisés. Gardien placé selon le porteur, délai de réaction, plongeon borné puis relevé.
- La réception d’une passe ne donne aucun but automatique. Le coéquipier contrôle puis le joueur choisit : remise en une-deux avec reprise de contrôle, ou conduite et frappe du coéquipier, visibles et soumises aux interceptions/arrêts.
- La passe décisive est attribuée uniquement si le tir du coéquipier traverse effectivement le but.
- Le rendu reste stylisé. Pas de validation visuelle dans un navigateur disponible ; tests de physique, gestes, poses articulées, cadrage, combinaisons et sauvegarde.

## V3.1 — collisions et pressing (captures utilisateur)
- Le ballon marqué ne pouvait auparavant heurter que le fond : les côtés et la bouche n'étaient pas contraints. Il pouvait ressortir pendant la célébration malgré le message « but ». Le volume complet du filet est maintenant contraint ; les rebonds sont amortis et le ballon se pose.
- Un arrêt annonçait l'échec du tir mais laissait une vitesse résiduelle et la gravité actives. Le ballon est désormais bloqué, avec un ancrage visuel calculé sur les deux gants du personnage animé. Une collision balayée empêche un tir rapide de traverser le gardien entre deux pas physiques.
- Pendant le dribble, le défenseur le plus proche ferme l'angle à 4,6 m/s et le second couvre. Après un dribble, ils gardent le marquage au lieu de rentrer en patrouille ; l'attente de visée reste jouable, sans perte automatique à l'arrêt.
- Régressions testées : buts diagonaux dans le filet, stabilité après célébration, ballon tenu pendant le relevé, ancrage aux gants, pressing avec récupération sur conduite directe et possibilité d'évitement latéral. Validation visuelle sur téléphone toujours à réaliser.

## V3.2 — pressing de la préparation et contacts des joueurs
- Pressing dès le départ sur tous les modes (dribble, passe au sol, frappe et lob), pendant la visée et l'armé. Le premier défenseur ferme sur le porteur, le second couvre une ligne. Une préparation prolongée permet une récupération ; la visée ralentit toujours le temps.
- Accélération et changements de direction bornés pour permettre les changements d'appui, sans poursuite qui pivote instantanément à pleine vitesse.
- Séparation des corps : suppression de la superposition montrée sur la capture utilisateur. Le défenseur qui récupère repart avec le ballon.
- Une-deux adapté au pressing : remise plus courte dans l'espace devant le joueur pour garder une combinaison jouable.
- Couverture explicite par mode : buts contenus dans le filet, arrêts avec ballon bloqué, progression et sauvegardes conservées. Vérification visuelle sur appareil toujours nécessaire.

## V4 — gestes, effets et terrain plein écran
- L'occasion attend la première action intentionnelle : aucune progression des défenseurs avant le premier tap/passe/dribble/frappe. Les reprises de balle conservent le pressing de V3.2.
- Suppression des boutons de modes. Tap sur l'herbe = conduite courte ; tap sur le bleu = passe ; appui d'au moins 480 ms sur une destination = lob ; tir en retrait depuis le ballon = frappe.
- Courber le geste de frappe donne un effet signé. La trajectoire et le pourcentage sont affichés avant relâchement ; la physique fait réellement tourner la vitesse horizontale et amortit la rotation.
- Terrain fixé bord à bord dans la fenêtre, HUD en surimpression, gestion des marges sûres et cadrage en portrait étroit et paysage. Bouton de vrai plein écran uniquement si l'API du navigateur est disponible.
- Aide intégrée avec pause. Le choix d'un une-deux peut aussi se faire sur le terrain (tap sur son joueur pour la remise, tap sur le but pour laisser tirer), avec boutons contextuels en alternative.
- Tests ajoutés sur les événements tactiles, première touche figée, aide en pause, modes sans boutons, effet réel et cadre 390x844/370x740/844x390. Le confort et le rendu CSS restent à vérifier sur appareil : pas de navigateur de QA disponible dans cet environnement.

## V4.1 — pauses entre touches, contact explicite et public de test
- Décisions en pause à chaque contrôle, notamment à la fin d'un dribble, pendant le choix de combinaison et pendant le réglage d'effet. Les déplacements et duels reprennent à l'exécution de la prochaine action ; les animations d'attente restent visibles.
- Une frappe se déroule en deux étapes : viser en retrait, puis toucher le grand ballon. Le centre donne un tir droit, les côtés donnent un effet gauche/droite. Glisser sur le disque règle la force et prévisualise la trajectoire ; relâcher déclenche la frappe. Visée annulable.
- Tribune derrière le but : environ 180 spectateurs modélisés (têtes, torses, jambes, bras), couleurs variées, mouvements et célébration, deux drapeaux. Personnages regroupés en InstancedMesh pour limiter les appels de rendu. Public activé pour les tests, désactivable sur l'accueil ; ce n'est pas une décision de peupler les matchs régionaux à terme.
- Tests : pause prolongée après conduite, sélection de contact gauche/centre/droite et rotation réelle du ballon, public dans le cadrage portrait et animation, option de visibilité. Les régressions de buts, arrêts, combinaisons et sauvegarde passent. Pas de contrôle visuel sur appareil disponible dans cet environnement.

## V5 — frappe continue, râteau et interventions debout
- Le grand ballon de choix d'effet est supprimé. Le tir se joue d'un seul geste : tirer en arrière, conserver la direction initiale puis décaler la fin du geste en crochet pour courber la frappe. La direction est fixée après le début de la traction ; le mouvement latéral règle l'effet et la trajectoire reste prévisualisée.
- Râteau : balayage latéral rapide depuis le terrain, à l'arrêt ou pendant la conduite. La balle roule sous le pied et le joueur change d'appui sur une courte distance. Pas d'invulnérabilité : un défenseur sur la trajectoire peut intercepter.
- Défense : tentative de récupération debout et jambe avancée pour contrer, avec anticipation, extension et temps de récupération. La direction d'engagement est fixée au départ ; changer d'appui peut provoquer une intervention manquée. Un contre à la jambe dévie le ballon au lieu de l'attribuer automatiquement au défenseur.
- Pause entre les touches maintenue, public et plein écran conservés. La roulette est l'étape suivante prévue, pas une fonctionnalité de cette livraison.
- Tests : événements de tir sans panneau, râteau en conduite, réussite et échec face à une intervention, déviation physique, poses des jambes, régressions de buts/arrêts/une-deux/sauvegarde. Validation visuelle et tactile sur téléphone toujours nécessaire.

## V6 — audit appliqué : commandes, contacts et progression
- Six exercices accessibles depuis l'accueil : dribble, râteau, passe, lob, frappe et effet. Reconnaissance du geste affichée, répétition possible, progression carrière désactivée pendant l'entraînement. Un geste démarré sur le ballon est toujours une frappe ; le râteau part de l'herbe. La direction fixée est indiquée avant l'effet.
- Force de frappe tactile réelle (9 + 22 × puissance, avant progression), indépendante de la direction. La prévisualisation emploie les mêmes paramètres de force et d'effet que le lancement. Les tirs automatiques gardent leur dosage adapté à la distance.
- Collision balayée contre les deux poteaux et la barre, pour passes, frappes et lobs. Le ballon entier doit franchir la ligne pour valider le but. Filets fermés conservés.
- Contres et arrêts puissants repoussés restent en jeu : course vers le second ballon, duel de récupération, nouvelle décision en pause au contrôle. Le gardien bloque les ballons moins rapides. Les seconds ballons peuvent produire un nouveau tir ou un but ; une récupération adverse clôt l'occasion. Les ballons libres expirent après sept secondes de jeu actif.
- Douze situations sur quatre journées, avec positions et combinaisons différentes, trois profils défensifs alternés : équilibré, pressing haut, bloc prudent. Toujours trois occasions par match. Événements de score simulés entre les occasions, appliqués chronologiquement et affichés jusqu'à la 90e minute.
- Note et XP valorisent les passes complétées, dribbles réussis, occasions créées, buts et passes décisives ; pertes de balle pénalisées. Contributions de conduite plafonnées pour la récompense. Les niveaux améliorent vitesse, force, capacité d'effet, vitesse de passe et rayon de contrôle. Anciennes carrières conservées.
- Export JSON et import validé avec confirmation avant remplacement. Fichier invalide refusé sans toucher à la carrière. La sauvegarde reste locale au navigateur ; l'export est portable.
- Vérification : tests de régression et nouveaux tests de gestes, force, poteaux/barre, franchissement complet, récupération, renvoi du gardien, chronologie, statistiques, apprentissage et import. Pas de navigateur de test pris en charge dans cet environnement : sensations tactiles, fluidité et rendu sur téléphone restent à vérifier.

## V7 — visée libre, accueil et stade
- Tir assisté centré sur le but : un glissement vers soi d'au moins 18 pixels peut commencer sur une zone libre du terrain ou sur le ballon. Le déplacement latéral ajuste continuellement la cible jusqu'au relâchement ; aucune direction n'est verrouillée. Puissance progressive avec un minimum adapté aux occasions proches, rétraction pour annuler. Cible visible devant le but et trajectoire prévisualisée.
- Effet facultatif choisi avant de viser (droit/gauche/droite). Les corrections latérales de visée n'ajoutent plus d'effet involontaire. Aide et entraînement adaptés au nouveau geste. Râteau sur balayage horizontal et passes/lobs tactiles conservés.
- Accueil refait autour du prochain match : illustration du maillot et du stade, accès match/entraînement prioritaires, carrière compacte, trois conseils courts. Profil, apparence et sauvegardes repliés ; pas de création de joueur obligatoire pendant cette phase de test.
- Actions de match à quatre attaquants contre quatre défenseurs et un gardien. Trois partenaires sélectionnables au toucher, appels pendant les actions, réception et une-deux possibles avec chacun. Séparation des corps, marquage des partenaires et pause entre touches étendus au groupe. Entraînement sans défenseurs conservé.
- Stade permanent avec tribune couverte, tribunes latérales, enseigne AC Rivage et mâts d'éclairage décoratifs. Public animé étendu aux côtés, géométrie instanciée pour les spectateurs. Masquer le public laisse le stade visible.
- 74 tests réussis, dont changements de direction pendant la visée, départ du tir depuis le terrain, annulation par rétraction, sélection des trois partenaires, appels/pauses et présence du stade. Contrôle des références HTML effectué. Pas de validation navigateur/tactile disponible dans cet environnement ; fluidité ressentie et rendu sur téléphone à confirmer.

## V8 — appels, passe d’entrée et courses
- Chaque occasion de match débute par une passe visible d'un partenaire situé derrière le joueur : préparation du geste, trajet du ballon, réception puis décision en pause. Cette introduction n'est pas un duel ; la défense attend le contrôle.
- Après une passe, toucher l'espace lance un appel pendant le trajet ou après la réception du partenaire. La destination peut être ajustée pendant l'appel ; le partenaire arme ensuite une remise visible. Une interception reste possible. Le choix de laisser tirer le partenaire est conservé.
- Effet sans bouton : balayage latéral après relâchement du tir, accepté pendant la préparation puis pendant les premières 0,55 secondes simulées de vol. Départ au ralenti x0,32 pour laisser le temps au geste. Sans balayage, tir droit. C'est une commande arcade de trajectoire, pas une simulation du contact pied-ballon.
- Quinze joueurs : sept attaquants dont le héros, sept défenseurs, un gardien. Joueurs de soutien disposés jusqu'au milieu, déplacements de soutien et couverture ; caméra élargie pour les montrer. Public et stade conservés.
- Accélération progressive, vitesse de freinage liée à la distance, inertie de changement de direction. Pressing rééquilibré pour le départ progressif de l'attaquant. Foulée liée à la vitesse, transitions de course adoucies, flexion des genoux, rotation des épaules, inclinaison du buste ; tête légèrement affinée. Animations toujours procédurales, pas de capture de mouvement.
- 78 tests réussis : passe d'entrée, appels avec remise, effet pendant le vol, accélération/inertie, visibilité du milieu en portrait, et régressions. Validation du confort tactile et de la fluidité sur téléphone encore nécessaire ; pas de navigateur pris en charge pour contrôle visuel dans cet environnement.

## V9 — visée courte, effet volontaire, stade et identité
- Aperçu des frappes/passes/lobs limité à environ 2,5 m, sans cible dans le but. Effet avant tir : immobilité 380 ms (tolérance 5 px) pour verrouiller direction et puissance, puis décalage latéral. Signal visuel et vibration si disponible. Tir direct immédiat conservé, ralentis et modification du ballon en vol supprimés.
- Budget de vitesse/accélération des défenseurs harmonisé entre dribbles et passes. Intentions de couverture conservées et préparation de frappe modérée.
- Quatre tribunes d'angle, extension des côtés et tribune opposée ; public dans les angles. Noms provisoires et numéros en étiquettes face caméra, numéros sur les deux faces du maillot.
- Général : 700 XP/point, règle commune aux attributs et à l'accueil. Migration conserve le niveau acquis des carrières existantes, imports compris.
- Phase suivante : niveaux d'équipes, tactique et énergie pour les occasions/participation ; entraînement de progression séparé ; cinématiques. Ces systèmes restent à concevoir : score et trois occasions actuels conservés pour cette livraison.
- 84 tests réussis (maintien, vitesse normale, aperçu court, défense, tribunes, noms et migration), références HTML vérifiées. Pas de validation visuelle/tactile sur téléphone disponible ici.

## V10 — maillots lisibles, temps de match et énergie
- Toutes les étiquettes flottantes sont retirées. Noms provisoires et numéros sont imprimés sur les deux faces du maillot, avec choix automatique d'encre foncée/claire selon la couleur du tissu et contour opposé. Le terrain reste dégagé.
- Séquences de match accélérées entre le coup d'envoi, les trois occasions et la 90e minute. Les joueurs circulent et le ballon passe entre eux ; horloge, score et commentaires évoluent chronologiquement. Il s'agit d'une animation de circulation accompagnant la simulation des événements, pas d'un moteur autonome complet à 90 minutes. Les buts sont annoncés dans les commentaires. Bouton pour passer la séquence, sans perdre les événements ni modifier la dépense d'énergie. Les occasions restent jouables avec leur passe d'entrée.
- Énergie affichée en permanence pendant le match, sur l'accueil et au bilan. Consommation de base avec les minutes simulées et coût supplémentaire des courses/gestes ; les décisions en pause ne coûtent rien. Influence sur la vitesse de course et la force de frappe, avec plancher pour conserver la jouabilité. La fatigue est sauvegardée, même lors d'un abandon. Bouton de récupération +20 points depuis l'accueil, sans calendrier de repos encore modélisé. Entraînement de gestes à énergie pleine, sans dépense persistante.
- Sauvegardes anciennes : énergie initialisée à 100, import borné à 0–100. Système énergie/tactique/niveau pour le nombre d'occasions toujours à une prochaine phase ; trois actions conservées.
- 91 tests réussis : aucune étiquette, contraste textile, horloge/buts/contrôle après simulation, passage accéléré sans doublons, fin de match, fatigue et récupération, anciennes sauvegardes et régressions. Références HTML vérifiées. Pas de contrôle navigateur ou téléphone disponible ; rendu textile à distance et confort de la jauge restent à confirmer sur appareil.


## V11 — collective play and tactical intervals
- Defensive assignments persist per touch: one presser, unique markers, positions between marked player and ball. Support defenders participate; phase-dependent sinusoidal patrols removed. Shared acceleration budget during dribble and flight; windup pressure remains reduced for playability.
- Pass recipient is retained and meets the target; swept relative-motion player collisions replace endpoint tests. Backward passes remain live through z=32. Ground/lob receptions beyond midfield tested.
- Teammates can shoot in one touch on a low reception in a clear scoring position; otherwise choose open passing options across the team or carry. Decisions take 0.4 seconds, rather than an indefinite choice pause. A requested run receives a return if its lane is clear, with an alternative decision if blocked. Assist credit only survives a direct hero pass.
- Between highlights: dedicated top-down 22-dot simulation with seeded variation, passing, turnovers and accelerated clock. Existing authoritative match timeline still determines goals and score; dot simulation illustrates these events and is not a full match physics engine. Energy and skip semantics preserved.
- Player proportions revised: smaller heads, tapered torso, slimmer articulated limbs; stance/swing foot targets drive knee flexion. Procedural stylized models, not scanned humans or motion-captured animation. Shirt-only identification preserved.
- Crowd uses home blue/white palette, with static scarves on some fans.
- Validation: 99 automated checks pass (game/controller, relative collision, tactical simulation, animation scene graph, progression). Browser visual QA attempted via managed preview, but cloud browser access was rejected by URL policy; no workaround attempted. Phone appearance/performance and feel remain unverified.


## V12 — authoritative tactical match and connected highlights
- Replaced the illustrative loop/pregenerated goal timeline with a persistent 22-player possession simulation. Shots travel to goal and can score; levels affect pressure, circulation, finishing and the resulting opportunities. Regional team levels are provisional values shown in the UI. The clock reaches 90 minutes, with a variable number of playable chances.
- The career player is the highlighted home striker dot. On their attacking opportunity, every player and the ball map from normalized tactical coordinates into the 3D pitch. After the highlight, positions and the outcome feed back into the same match. Other team members can also finish attacking moves autonomously.
- Tactical movement uses formation anchors and a presser instead of mutually chasing mirrored player positions. Passes have fixed destinations, swept interceptions and spreading between dots. Fixed simulation steps ensure the speed toggle does not alter the result.
- Automatic recovery brings kickoff energy to at least 85%, with a home-screen explanation; energy then decreases during match minutes and efforts. Existing saved careers are preserved. This is a provisional inter-fixture recovery model, not a full calendar.
- Dribble boundary now extends to z=-19.35. Small taps on/near the player's ball can dribble; a retracted shot gesture still cancels. Teammate tap radius reduced to prevent nearby grass being interpreted as a pass.
- Good shooting positions take priority over requested return runs. More permissive shooting evaluation still leaves actual shot interception to physics.
- Explicit left/straight/right spin choice replaces stationary-hold locking in the UI. Aim remains freely editable. Keeper/defender/frame contacts remove residual spin; post-contact chase clears prior run commands.
- Corrected knee bending direction, elbow flexion and blended pose changes. Shirt numbers enlarged and moved outside the torso; independent torso twisting no longer clips their planes. Action camera fits the hero, goal and nearby teammates more closely. Procedural stylized rigs remain; no claim of motion-captured realism.
- Validation: 108 automated checks pass, including live match completion, exact tactical/3D handoff, deterministic acceleration, opponent scoring, seeded level dominance, zero-energy save recovery, near-goal taps, shooting priority, rebound spin/chase and anatomical knee direction. HTML/module references and diff whitespace checked. Browser/mobile visual QA remains unavailable following the prior browser URL-policy rejection; no workaround or unsupported browser path used.

## V13 — wide play, defensive handovers and goal announcement
- Opponent tactical goals show the actual simulated scorer's provisional name with a restrained ball entrance animation. Controller freezes for three real seconds, independent of playback speed; clock, positions and score remain stable. Skip is disabled during this pause.
- Restored a wide camera that fits both wings and deep backward passing options across the pitch. This intentionally trades close-up character size for readable team availability. Tactical/3D coordinates remain unchanged.
- Reassess the pressing defender every 0.18 seconds, preferring a player who can intercept from goal side over a beaten pursuer. A second player covers depth; others retain goal-side marking. Possession pressure anticipates the carrier's current movement. Supporting teammates move with the attack.
- Team choices now include carrying into open space and lofted crosses from wide positions. Backward and immediate return passes are penalized when forward options exist. One-touch finishing remains for clear close low-ball chances; other shots allow a control phase.
- Excessive shot power increases elevation and can clear the crossbar. A high-shot indicator appears above 85% power; measured strikes remain viable.
- Replaced briefs-shaped hip mesh with waistband and two shorts legs. Shirt text uses centered baselines and a smaller centered plane. Provisional scorer names match the 3D roster.
- Removed turf danger recolouring entirely; original alternating green stripes remain.
- 113 automated tests pass, including real-time goal pause, broad camera coverage, defensive handover, carry/cross decisions and high-shot physics. HTML IDs and diff whitespace verified. Browser visual QA remains blocked by the previously reported URL policy; mobile appearance and feel unverified.

## V13.1 — audit de Claude : caméra lisible, cohérence du score et des occasions
- Caméra d'action : même couverture que V13 (deux lignes de touche, but, options de passe en retrait jusqu'au fond), mais objectif modéré (45° au lieu de 70 à 100°). La caméra recule au lieu d'élargir l'angle, ce qui supprime la déformation sur les bords. Mesure en 390×844 : joueur d'environ 8 px de haut en V13, 12 px en V13.1. Marges réservées au score et au bandeau de gestes, cadrage spécifique en paysage pour que le but ne passe plus sous le score. Brouillard et plan lointain recalés sur la distance de caméra. Anneau du joueur agrandi pour le repérer d'un coup d'œil.
- Simulation tactique : le point du joueur de carrière ne frappe plus jamais seul. Une position de tir devient une occasion jouable. Avant, il pouvait marquer sans intervention, sans que le but compte dans les statistiques de carrière. Si aucune occasion n'est venue après la 55e minute, le jeu en propose une dès que le joueur a le ballon dans la moitié adverse : 2 % de matchs sans occasion sur 100 matchs simulés, contre 10 % auparavant.
- Bilan de match : les buts marqués pendant les occasions jouées figurent dans la liste des buts, avec leur buteur. Avant, un 2–1 pouvait n'afficher qu'un seul but.
- Indicateur de frappe haute : mesuré avec la physique, le ballon passe au-dessus de la barre dès 80–83 % de puissance entre 11 et 17 m. L'alerte « FRAPPE HAUTE » apparaît désormais dès 78 %, puis « AU-DESSUS ! » au-delà de 86 %. Avant, elle n'apparaissait qu'à 85 %, quand le tir était déjà raté. La physique de la frappe n'est pas modifiée.
- Interface : le sélecteur d'effet ne recouvre plus le titre de l'occasion. Numéro de version harmonisé, l'en-tête affichait encore « VERSION 10 ».
- Public : torse, tête et jambes sautent ensemble pendant les célébrations, alors que les têtes se détachaient auparavant des corps. Ombres en PCFShadowMap, puisque la version de Three.js embarquée ignorait PCFSoftShadowMap avec un avertissement.
- Nettoyage : une branche de déplacement inatteignable et un message immédiatement écrasé ont été supprimés de game.js.
- Validation : 119 tests passent. Cinq tests de régression ont été ajoutés (caméra, public, buteur simulé, occasion garantie, alerte de frappe haute) ; tous échouent sur V13 et passent sur V13.1. Un test d'endurance joue des matchs complets avec des gestes aléatoires et vérifie la cohérence entre score et liste des buts. Contrôle visuel réalisé dans Chrome (rendu WebGL logiciel) en 390×844 et 844×390, avec captures avant/après. Pas d'essai sur un vrai téléphone : sensations tactiles et fluidité restent à confirmer.

## V13.2 — retours du créateur sur la V13.1
- Caméra rapprochée derrière le joueur, comme demandé. Elle cadre le joueur de carrière, le ballon, le but et les partenaires à moins de 8 m, puis suit l'action en douceur pendant les passes, les courses et les seconds ballons. Elle ne montre plus tout le stade. En 390×844, le joueur mesure 30 à 42 px de haut, contre 12 px en V13.1 et 8 px en V13. Les partenaires éloignés peuvent sortir du cadre : c'est le compromis assumé de ce changement.
- Le texte « Accélérer jusqu'à la prochaine occasion » est supprimé et remplacé par un bouton de vitesse « » ×1 → »» ×2 → »»» ×4 ». La vitesse choisie est conservée d'une séquence à l'autre pendant le match. Le résultat simulé est identique à toutes les vitesses (test).
- Puissance de frappe : seul le pourcentage est affiché. Les alertes « FRAPPE HAUTE » et « AU-DESSUS ! » sont supprimées pour garder la difficulté. La physique n'a pas changé.
- Panneau de l'occasion plus compact sur fond sombre, lisible devant le public, sans masquer le but.
- 120 tests passent. Les tests de l'ancienne caméra large et de l'alerte de hauteur sont remplacés par des tests de la nouvelle caméra (taille du joueur, but visible, suivi progressif), de l'absence d'indication de hauteur et de la vitesse ×1/×2/×4. Contrôle visuel dans Chrome en portrait. Pas d'essai sur téléphone réel.

## V14 — retours du créateur : variété, défense, réalisme
- Rythme : environ 4 occasions par match (au moins 3 dans 94 % des matchs simulés). La moitié des ouvertures partent de la passe d'un partenaire, à l'endroit exact où la simulation l'a décidée. S'y ajoutent des centres (0,7 par match) avec reprise de volée ou tête, des coups francs (0,4, mur de 4 joueurs qui saute) et des penalties (rares, le gardien choisit un côté). Les fautes sont issues de la simulation (pressing dans le dernier tiers).
- Défense : la faille « provoquer le tacle puis s'échapper pendant la pause » est corrigée. Tous les défenseurs proches peuvent tacler, coupent la course côté but et se placent dans l'axe du tir. Leurs tacles sont plus courts et les touches de balle aussi quand un adversaire est au contact.
- Seconds ballons : le coéquipier et le défenseur les plus proches attaquent le ballon.
- Ballon dessiné plus petit (rayon 0,15 m), rayon physique inchangé (0,22 m), donc la difficulté face au gardien est la même.
- Caméra : partenaires visibles jusqu'à 12 m vers l'avant ; bouton 👁 pour voir tout le camp adverse ; jusqu'à 4 repères bleus touchables pour les partenaires hors de l'écran (jamais le gardien).
- Personnages : nouvelles proportions, teints et coiffures variés, crampons ; démarche à foulée proportionnelle à la vitesse (pieds posés au lieu de glisser), phase de vol, buste penché, bras coudes pliés.

## V15 — idées 1 à 10 du créateur
1. Appels : pendant ta passe, touche ton joueur pour venir dans les pieds, ou touche plus loin pour partir en profondeur ; la remise est jouée devant ta course.
2. Passe dans l'espace : pose le doigt sur un partenaire puis glisse vers l'espace. Il y court et le ballon est dosé pour arriver avec lui.
3. Centres et reprises (V14) : volée ou tête selon la hauteur.
4. Contrôle : toute passe reçue s'arrête au contact. Contrôle orienté (touche de 1,9 m au plus), protection, ou jeu en une touche.
5. Feinte de frappe : tire vers toi puis relâche au-dessus du point de départ (revenir au point de départ annule toujours, comme avant). Le défenseur mord à 85 %, puis 50 %, puis 22 % ; le gardien peut se décaler.
6. Poussée de balle : pendant un dribble, glisse vers l'avant. Longue touche de 7,5 m et sprint ; les défenseurs peuvent la couper, les coéquipiers la laissent à ton joueur.
7. Protection : touche ton joueur (pas le ballon). Il se met dos au défenseur 1,3 s et un partenaire vient en soutien ; le défenseur peut encore passer devant.
8. Pied faible : joueur droitier. Une frappe ou passe qui part nettement vers sa gauche est moins précise et moins forte. Niveau sauvegardé dans la carrière (45 % au départ), progression à chaque utilisation, plus rapide à l'entraînement.
9. Duels aériens : pendant un centre, touche l'herbe pour te placer (4 m au plus). Si un défenseur est mieux placé sous le ballon, il gagne la tête et le second ballon est disputé. Le choix du moment de saut n'est pas encore implémenté.
10. Coups francs et penalties (V14).
- 129 tests passent, dont 10 pour ces actions. Contrôle visuel dans Chrome ; pas d'essai sur téléphone réel.

## V16 — retours du créateur après essai sur téléphone
- Effet : curseur continu de −100 % à +100 % (effet de 0 à 0,4) au lieu de trois boutons fixes. Avec de l'effet, l'aperçu en pointillés suit le ballon sur 40 % de la distance, sans jamais entrer dans le but. Les gestes latéraux restent réservés à la visée.
- Coups francs : mesurés à 2 % de réussite (134 tirs sur 180 dans le mur). Frappe brossée (élan vertical 5,4 m/s, vitesse ×0,84) et effet plongeant (gravité ×1,9 dans la descente, pour ces frappes uniquement). Saut du mur 0,30 m, gardien décalé de 0,75 m au plus. Réussite d'environ 24 % sur l'ensemble des essais, plus de 50 % avec la bonne puissance sur un coin. Le mur n'arrête plus tout.
- Temps d'arrêt après chaque passe en jeu (la tienne ou celle d'un partenaire), 3 secondes au plus : toucher l'herbe lance la course, toucher son joueur le fait rester. Un cercle bleu (curseur) montre la course.
- Tourner la tête : garder le doigt sur 👁 et glisser pour faire pivoter la caméra autour du joueur (±63°). Un simple appui bascule la vue large.
- Duel aérien : défenseurs placés à côté et non devant, centre visé sur le joueur. Le défenseur gagne seulement s'il est nettement mieux placé (0,35 m) ; à égalité, l'attaquant gagne 6 fois sur 10 (7 s'il s'est placé lui-même).
- Défense sur le dribble : un défenseur au contact (moins de 0,95 m) peut gagner le ballon au corps.
- IA de Rivage : conduites de balle plus longues (4 m) et plus fréquentes dans l'espace ; les appels du joueur sont davantage servis.
- Fin d'action : le match reprend seul après 2,6 s (3,8 s après un but). Le bouton reste là pour passer plus vite.
- Plus de phrase de motivation en titre pendant le match ; les informations utiles restent en bas.
- Décor : pelouse en une seule texture détaillée (tontes, brins, usure légère, filtrage anisotrope), seconde tribune derrière le but, tribunes latérales plus hautes, pylônes d'éclairage, 46 immeubles et des arbres autour du stade.
- 133 tests passent. Contrôle visuel dans Chrome ; pas d'essai sur téléphone réel.

## V17 — idées 11 à 20 du créateur
11. Seconds ballons : déjà en place (poteau, barre, parade, duel aérien perdu, poussée de balle). Le coéquipier et le défenseur les plus proches attaquent le ballon (V14).
12. Défense jouable : nouveau type d'occasion « PRESSING » (environ 0,4 par match), quand un adversaire relance près du joueur. Toucher l'herbe pour courir ; au contact, le ballon peut être gagné ; sa passe peut être coupée. Il se dégage s'il garde le ballon 6 s ou ressort proprement. Un ballon gagné devient une attaque normale.
13. Personnalités de Rivage selon le poste : les ailiers (8, 10) provoquent et portent le ballon, le meneur (6) cherche la passe, les relayeurs (5, 7) jouent simple.
14. Profils des défenseurs adverses : « anticipe » (lit la course, plus rapide), « prudent » (moins de portée, garde ses distances), « engagé » (tacle de plus loin).
16. Appels complémentaires : quand le joueur passe à un partenaire, l'attaquant le plus avancé part dans le dos de la défense.
17. Gardien : capte les centres dans les 5 m s'il y arrive avant l'attaquant ; sort de sa ligne (jusqu'à 1,9 m) face à un attaquant seul à moins de 13 m.
18. Adaptation : la défense penche vers le côté où le joueur dribble le plus souvent (mesuré pendant le match, sans connaître le geste à l'avance).
19. Erreurs crédibles : contrôle trop long sous pression (13 %), passes moins précises au contact d'un défenseur, défenseur surpris par un changement de direction de plus de 60° (55 %, figé 0,35 s).
20. Entente : chaque passe réussie avec un partenaire renforce l'entente (sauvegardée par numéro, jusqu'à 60). Les remises des une-deux sont plus précises avec un partenaire habituel.
- Le point 15 (défense organisée) avait été traité en V14.
- 141 tests passent. Contrôle visuel non refait pour cette version, à cause du contexte limité.
