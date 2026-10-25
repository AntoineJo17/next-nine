# Audit gameplay réel — rapport de synthèse (supervision)

Base : V20 · lot 10 (`ed86a44`). Quatre audits (physique, mouvement, IA, contrôles) fusionnés, détails dans `physique.md`, `mouvement.md`, `ia.md`, `controles.md`.

## Corrigé
| ID | Problème | Fichier |
|---|---|---|
| P1 | Le ballon traversait le corps d'un gardien en plongeon (but accordé) ; corps = segment de 0,16 m de rayon | movement.js |
| P2 | Plafond du pas de temps de la boucle à 0,04 s = ralenti sous 25 i/s ; relevé à 0,08 s | game.js |
| M1 | Gardien en lévitation après un plongeon, saut brutal au relèvement | movement.js |
| M2 | Dribble hors du regard : le ballon sautait de 0,84 m ; demi-tours instantanés des défenseurs (TURN_RATE 14 rad/s) | movement.js |
| M3 | Rotation rendue jusqu'à 75 rad/s (plafond 16 rad/s hors joueur) | engine.js |
| M4 | Buteur lointain : arrêt net au milieu du terrain avant de célébrer | game.js |
| M5 | Partenaires en célébration qui poussaient des défenseurs immobiles (apparu après M4) | game.js |
| IA-01/04 | Marquage instable, échanges de marquage, gardien allié marqué, presseur qui change à chaque geste | football-ai.js |
| IA-02 | Gardien allié non remis en place après penalty / coup franc (simulation) | tactical.js |
| G1 | Phase pressing : 19 joueurs figés | game.js |
| G2/G3 | Penalty / coup franc : gardien allié posté en jeu ouvert | game.js |
| C0 | Une exception dans la boucle figeait le match : try/catch, reprise, retour accueil après 90 échecs | game.js |
| C1 | Geste de dribble involontaire armant une passe vers l'arrière | game.js |
| C2 | Libellé de pressing erroné | game.js |
| C3 | Perte du contexte WebGL : son du stade qui continue, geste en mémoire | game.js |

## Choix de design (non modifiés, à décider)
Pressing haut dominant, contre-attaque sans gain, passes au sol longues > 45 m/s, bonus de passes vers le héros, collage brutal de la balle au gardien, pastille de commentaire sur le repère hors-champ, caméra qui coupe en fin de but, joueurs à l'arrêt sans regard vers le ballon, pas d'appui limité à 0,46 m.

## Ouverts
O2 : passes d'équipe enchaînées sans plafond (non atteignable avec des entrées réelles). Caméra de coup franc montrant la sous-face des tribunes. Gestes et ressenti non validés sur téléphone ; occasions ailier et meneur non jouées en navigateur ; WebKit non validé.

## Effet d'équilibrage à valider
Le corps du gardien en plongeon réduit les buts d'environ 20 % sur des frappes aléatoires ; sur un scénario de tirs vers les coins, 5 tirs sur 33 marquent contre 12 avant. Revenir en arrière = retirer la ligne P1 de `keeperTouches`.

## Tests
`npm run check` 229/229 ; `tests/career-qa` 71/71 ; `tests/gameplay-*` 65/65. Tests « charge-sensibles » déjà vus : « normal must collide with the keeper », « dribble sans saut du ballon » (verts en isolé).
