# NEXT NINE · Lots 2 et 3 : un vrai geste de frappe et de passe (propositions, rien n'est implémenté)

Ce document prépare la discussion avec ChatGPT. **Aucune ligne du jeu n'a été modifiée.** Le prototype ci-joint (`docs/prototype-gestes/index.html`, à ouvrir dans un navigateur ; moteur dans `sim.js`, tableau généré par `examples.js`) permet de dessiner un geste au doigt ou à la souris et de voir la trajectoire (dessus et profil), avec ou sans balle sans effet, puis de rejouer 80 fois le même geste pour mesurer la dispersion.

## 1. Point de départ : ce que fait le jeu aujourd'hui

- `launch(start,target,mode,spin,power)` (physics.js) reçoit une **cible au sol**, une puissance (0,08 à 1) et un effet `spin` (−1 à 1, un seul nombre : effet latéral). La vitesse initiale va de 9 à 31 m/s ; la montée du ballon est déduite de la puissance. Le joueur ne choisit donc ni la hauteur, ni la vitesse indépendamment.
- Le tir assisté (`assistedShot`, gestures.js) pose la cible sur la ligne de but et la **limite à ±5,2 m** du centre : impossible de viser largement à côté ou au-dessus ; la précision ne dépend pas du geste.
- `stepBall` (physics.js) gère : gravité, rebond, frottement au sol, un effet latéral qui fait tourner la vitesse, un plongeon (`dip`). Il ne gère pas : traînée de l'air, effet vertical (rétro-effet qui porte, top-spin qui plonge), balle sans effet.
- Le gardien (`updateKeeper`, movement.js) réagit à la **trajectoire réelle** du ballon : cela reste valable avec un nouveau système.
- Un ralenti existe déjà (`startReplay`, enregistrement à 30 Hz, `TAPE_HZ`), réutilisable pour les fautes.

## 2. Ce qu'on peut mesurer dans un geste (briques communes)

Mesurées sur la liste de points (x, y, t) du doigt :

| Mesure | Comment | Sert à |
|---|---|---|
| Direction | angle du premier quart du tracé | cap du ballon, **n'importe où** autour du joueur |
| Longueur | distance départ → fin | puissance (ou portée d'une passe) |
| Vitesse | longueur / durée ; vitesse dans les 60 dernières ms | puissance ; geste « qui traverse » ou « qui s'arrête net » |
| Courbure | angle entre début et fin du tracé | effet latéral (le ballon suit l'arc dessiné) |
| Tremblement | écart du tracé à un arc lisse (en % de la longueur) | précision : un geste sale disperse le ballon |
| Point de contact | où le doigt **commence** sur l'image du ballon (3×3 zones, centre = frappe normale) | hauteur (bas = lob / rétro-effet), top-spin (haut), effet (côtés) |
| Maintien | durée avant que le doigt bouge | frappe préparée, lob (≥ 0,48 s comme aujourd'hui) |

Bruit du ballon = base / technique du joueur + tremblement + dépassement de vitesse + pression + difficulté de l'effet demandé. Un joueur faible ou un geste précipité loupe le cadre ; un geste propre est fiable sans l'être à 100 %.

## 3. Les propositions

### A · « Balayage » : on dessine ce que doit faire le ballon (recommandée pour les tirs)
Le doigt part du ballon et le **traverse** comme un pied.
- Cap = début du tracé ; **puissance = vitesse du balayage** ; effet = **l'arc dessiné** (le ballon part le long de la tangente de départ et finit sur celle d'arrivée) ; hauteur = point de départ sur le ballon (bas = frappe levée, haut = frappe rasante qui plonge).
- Exemples : balayage rapide et droit = frappe tendue ; balayage lent = placée ; arc vers la gauche = enroulée intérieure ; départ bas = lob ou frappe haute.
- Une frappe technique (enroulée, par-dessus le mur) demande **cap, vitesse, arc et point de contact justes en même temps** : difficile par construction, sans bouton.

### B · « Fronde libre » : on tire en arrière, comme aujourd'hui, sans cible limitée
Le doigt recule depuis le ballon ; la direction opposée donne le cap (n'importe où), la longueur la puissance, la courbure du retour l'effet, un maintien long (≥ 0,48 s) la frappe levée.
- Avantage : proche de l'habitude actuelle ; le tracé se voit partir.
- Défaut : la vitesse du geste n'intervient pas, donc moins de gestes « techniques » ; la longueur est limitée par la taille de l'écran (portée maximale d'une passe longue délicate).

### C · « Deux temps » : viser puis frapper
1) Un doigt pose librement un **point de visée au sol** (partout, y compris hors cadre) avec une ligne droite d'aide ; 2) un geste court sur le ballon donne puissance (vitesse), effet (arc ou point de contact) et bruit.
- Avantage : visée très précise sur téléphone (le pouce ne cache pas la cible), très lisible.
- Défaut : deux gestes = plus lent, moins instinctif, risque de casser le rythme.

### D · Hybride proposé
- Jeu en mouvement : balayage (A), un seul geste.
- Coups francs, penalties, corners : visée posée (C) puis balayage (A), avec la balle sans effet (§5).
- Passes lobées : le même balayage avec point de contact bas (§4).

## 4. Passes lobées

Trois réglages indépendants, exprimés par le geste : cap, portée, hauteur.
- Cap : direction du balayage (visée libre, y compris vers l'arrière ou en diagonale).
- Portée : longueur et vitesse du balayage (de 8 à 45 m).
- Hauteur : point de contact (bas : angle élevé, apogée 2 à 10 m ; milieu : lob tendu).
- Risque réel : geste tremblé ou départ trop bas = trop court, trop long ou décalé ; un défenseur sous le trajet peut intercepter de la tête ; le coéquipier réceptionne selon sa distance au point de chute.

## 5. Balle sans effet (coups francs uniquement)

Détection : geste **droit** (courbure < 4°), **très rapide** (> 1 700 px/s), **qui s'arrête net** (vitesse finale < 650 px/s), point de contact **centré**, sans tremblement, et **seulement** en coup franc. Résultat : aucun effet, trajectoire avec un flottement latéral/vertical (environ ±2 m/s²) qui grandit au-delà de 20 m/s. Si le geste est tremblé ou ne s'arrête pas net, la balle part sans flottement (frappe tendue ordinaire) : la « knuckle » est ratée.

## 6. Comparaison (note de 1 à 5, 5 = meilleur)

| Critère | A · Balayage | B · Fronde libre | C · Deux temps | D · Hybride |
|---|---|---|---|---|
| Liberté offerte | 5 (cap, vitesse, arc, contact) | 3 (cap, longueur, courbure) | 4 (visée libre, frappe moins variée) | 5 |
| Difficulté / maîtrise | 5 (plusieurs paramètres à la fois) | 3 | 3 (visée facile, difficulté sur le 2ᵉ geste) | 4 |
| Précision sur téléphone | 3 (le doigt cache le ballon) | 4 | 5 (visée à découvert) | 4 |
| Compatibilité moteur | 3 (vitesse et effet 3D à ajouter) | 4 (proche de l'existant) | 4 | 3 |
| Risque de lourdeur en match | moyen | faible | élevé | moyen |

## 7. Exemples concrets

Moteur du prototype, sans gardien, tir depuis 18 m (lobs depuis ma moitié de terrain). « 80 tirs » = le même geste rejoué 80 fois avec bruit de technique et de pression.

| Geste | Variante | Vitesse | Élévation | Effet (rad/s) | Résultat (un tir) | 80 tirs, mêmes gestes |
|---|---|---|---|---|---|---|
| Frappe tendue et puissante (swipe rapide, droit) | A | 29 m/s | 4° | 0 | BUT (x=-0.4 m, h=0.2 m, 0.75 s) | 100 % but · 0 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |
| Frappe douce et placée (swipe lent, légèrement vers le coin) | A | 15 m/s | 4° | -0 | BUT (x=1.6 m, h=0.2 m, 2.19 s) | 100 % but · 0 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |
| Enroulée intérieure (arc vers la gauche, départ vers la droite) | A | 23 m/s | 4° | -38 | BUT (x=-3.3 m, h=0.2 m, 1.09 s) | 73 % but · 28 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |
| Enroulée extérieure (arc inverse) | A | 23 m/s | 4° | 38 | BUT (x=1.1 m, h=0.2 m, 1.07 s) | 74 % but · 26 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |
| Frappe aérienne haute (doigt parti du bas du ballon) | A | 22 m/s | 36° | 0 | au-dessus (x=-0.2 m, h=8.4 m, 1.22 s) | 0 % but · 0 % à côté · 100 % au-dessus · 0 % sans atteindre la ligne |
| Frappe trop rapide et tremblée (raté probable) | A | 36 m/s | 4° | 7 | BUT (x=-2.6 m, h=0.3 m, 0.59 s) | 46 % but · 54 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |
| Même geste, joueur peu précis (compétence .7, stress .5) | A | 29 m/s | 4° | 0 | BUT (x=-1.1 m, h=0.2 m, 0.74 s) | 100 % but · 0 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |
| Visée libre très large (45° hors cadre)  | A | 27 m/s | 4° | 0 | à côté (x=18.2 m, h=0.2 m, 1.37 s) | 0 % but · 100 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |
| Coup franc balle sans effet (droit, très rapide, arrêt net) | A | 36 m/s | 4° | 0 | BUT (x=-0.7 m, h=0.4 m, 0.41 s) | 100 % but · 0 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |
| Coup franc enroulé par-dessus le mur | A | 24 m/s | 22° | -38 | au-dessus (x=-3.5 m, h=3.7 m, 0.62 s) | 0 % but · 28 % à côté · 73 % au-dessus · 0 % sans atteindre la ligne |
| Passe lobée courte par-dessus un défenseur (départ bas du ballon, geste lent) | A | 16 m/s | 23° | 0 | retombe à 17 m vers l'avant et -0 m en latéral (apogée 2.2 m) | 0 % but · 0 % à côté · 0 % au-dessus · 100 % sans atteindre la ligne |
| Passe lobée en profondeur (geste plus long et plus rapide) | A | 22 m/s | 29° | 0 | retombe à 34 m vers l'avant et -0 m en latéral (apogée 5.8 m) | 0 % but · 0 % à côté · 0 % au-dessus · 100 % sans atteindre la ligne |
| Renversement de jeu, grande diagonale (geste long, très haut) | A | 26 m/s | 34° | 0 | retombe à 25 m vers l'avant et +38 m en latéral (apogée 10.6 m) | 0 % but · 0 % à côté · 0 % au-dessus · 100 % sans atteindre la ligne |
| Même tir, fronde (B) : tirer 180 px en arrière | B | 26 m/s | 3° | 0 | BUT (x=-0.2 m, h=0.2 m, 0.93 s) | 100 % but · 0 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |
| Deux temps (C) : visée au poteau gauche + frappe courte | C | 23 m/s | 3° | 0 | à côté (x=-3.5 m, h=0.2 m, 1.10 s) | 66 % but · 34 % à côté · 0 % au-dessus · 0 % sans atteindre la ligne |

Lecture : un geste propre et rapide donne un tir tendu fiable ; ajouter un arc réduit la fiabilité (la frappe enroulée est un pari) ; un geste tremblé ou trop rapide perd environ la moitié des tirs ; partir trop bas sur le ballon envoie la frappe au-dessus ; viser à 45° hors cadre fait un tir raté volontaire (visée libre). Les passes lobées retombent à 17, 34 et 25 m selon le geste (+38 m en latéral pour le renversement de jeu).

## 8. Précision sur téléphone

- Zone de départ sur le ballon d'au moins 44 × 44 px (ballon agrandi quand le joueur est prêt à frapper).
- **Aperçu non triché** : pas de fantôme de la trajectoire pendant le geste (sinon pas de difficulté) ; seuls restent une flèche de cap et la jauge de puissance. À décider : aperçu complet en entraînement seulement.
- Seuil anti-geste involontaire : 12 px minimum (sinon tap = dribble, appui long = lob, comme aujourd'hui).
- Enchaînements : un balayage = une frappe ; un second doigt dans les 300 ms = « une-deux » (passe puis appel) ; pas de combinaison à trois mouvements.
- Souris : mêmes mesures (la souris tremble moins : la difficulté vient surtout de la vitesse et de l'arc).

## 9. Compatibilité avec le moteur physique (travaux nécessaires)

1. Une version de `launch` qui prend une vitesse 3D et un vecteur d'effet ; l'ancienne reste pour les passes simples (aucune régression).
2. `stepBall` : traînée de l'air (≈ 0,0133 v²), force de Magnus avec effet vertical (plafonnée), flottement de la balle sans effet ; rebond et frottement conservés.
3. Gardien et tactique : ils lisent la trajectoire ; à vérifier : prédiction du plongeon et interceptions (les trajectoires courbes arrivent plus tard au même point).
4. Les balayages de test actuels (`sim.mjs`) supposent des cibles bornées : prévoir un mode « ancien système » pendant la transition.
5. Sauvegardes : le geste n'écrit rien dans la carrière (aucun risque), sauf si l'on enregistre des statistiques de précision.
6. Équilibrage : la difficulté d'exécution doit être compensée par la progression (technique du joueur, XP), pas par un aperçu.

## 10. Fautes et ralentis (lot 2 D)

- Tacle : l'animation existe (`beginChallenge` / `updateChallenge`, glissé de 2,6 m). La faute doit être décidée **au contact** (jambe, ballon, joueur dans le rayon), pas par un message : le fautif joue le tacle, le joueur touché chute, l'arbitre siffle, le jeu se fige 0,4 s.
- Ralenti : réutiliser `startReplay` sur les 3 dernières secondes, caméra latérale à 0,35×, bouton **Passer** toujours visible (44 px), puis le coup franc.
- Pas de faute purement textuelle : sans contact détecté, pas de faute.
- Cette partie ne dépend pas du choix du geste et peut être faite avant.

## 11. Étapes proposées après votre choix

1. Prototype dans le jeu derrière un interrupteur (ancien système conservé).
2. Passes lobées et balle sans effet.
3. Réglage de la difficulté sur téléphone (les valeurs du §7 sont à recalibrer au doigt).
4. Fautes et ralenti.
5. Retrait de l'ancien système.

## 12. Questions à trancher

1. A (balayage), B (fronde) ou D (hybride) ?
2. Aperçu de trajectoire : jamais, entraînement seulement, ou flèche de cap seulement ?
3. Dispersion de base pour un geste propre : ±1 m ou ±2 m à 18 m ?
4. Le gardien reste-t-il inchangé (KEEPER_BODY_BLOCK désactivé) pendant la mise au point des nouveaux tirs ?

*Limites : le moteur du prototype est une approximation (traînée, Magnus, bruit calibrés à la main, aucun gardien) ; les valeurs servent à comparer des idées, pas à régler le jeu.*
