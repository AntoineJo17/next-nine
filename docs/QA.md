# QA navigateur (Playwright) — lanceur durci

Code : `scripts/qa/` (dérivé du kit externe « NEXT NINE - Agents de test »). Aucun fichier du jeu n'est modifié.

## Lancer

```sh
# 1) servir dist/ (port 8771)
python3 -m http.server 8771 --directory dist
# 2) lancer (Python avec `playwright`, Chromium installé)
python scripts/qa/run.py --device mobile --repo .          # 390x844, série
python scripts/qa/run.py --device desktop --repo .         # 1280x800
python scripts/qa/run.py --agents interface --headed       # fenêtre visible
```
Sorties dans `scripts/qa/out/latest/` (ignoré par git) : `journal.log` (horodaté, flush immédiat), `rapport.json` (réécrit après chaque test, donc présent même si interruption), `rapport.html`, `agent-*.json`, captures `*-echec.png`.
`--repo .` active la vérification HTML/JS, les imports et l'analyse de la carrière (`node` doit être dans le PATH). `--npm-check` ajoute `npm run check` (long).

## Options utiles
`--url` (défaut `http://127.0.0.1:8771/`), `--browser chromium|webkit`, `--headed|--headless`, `--device mixte|mobile|desktop`, `--parallel N` (défaut 1 = série), `--global-timeout` (900 s), `--agent-timeout` (240 s), `--test-timeout` (45 s), `--health-timeout` (20 s), `--gl auto|swiftshader`, `--output`, `--agents` (dont `selftest-slow`, `selftest-404`).

## Statuts et code de sortie
Test/agent : `PASS`, `FAIL`, `SKIP`, `INFRA` (navigateur ou serveur inutilisable : cause indiquée, pas un défaut du jeu).
Code de sortie : 0 = PASS/SKIP, 1 = FAIL ou interruption (timeout global/agent, Ctrl-C), 2 = INFRA. Le processus se termine toujours (`os._exit` après écriture du rapport).

## Garanties
- Série par défaut ; chaque agent a un contexte Chromium vierge (jamais de profil personnel).
- Sas de santé : lancement + `new_context` + `new_page` + `about:blank`, 20 s par étape ; échec -> statut INFRA avec l'étape fautive.
- URL injoignable avant tout lancement -> INFRA.
- Réseau : toute réponse HTTP >= 400 et tout `requestfailed` sont consignés avec URL complète, type de ressource, compteur (dédupliqués) ; les erreurs console indiquent leur URL source.
- Le rapport indique la charge machine (`load_avg`). Les scènes 3D en rendu logiciel sont très lentes quand la machine est saturée : un timeout sous forte charge n'est pas une preuve de bug du jeu.
- `--gl auto` (défaut) laisse Chromium choisir ; `--gl swiftshader` force le WebGL logiciel (plus lent, plus de faux échecs).
- Bascule `#crowdToggle` : clic sur `label.crowd-option` + vérification de l'état (pas de `set_checked`).
- IDs `flockName` / `flockCount` / `flockNumber` : créés par `panel.innerHTML` à l'ouverture de l'onglet Maillot du vestiaire ; le test ouvre `#openLocker` puis l'onglet Maillot (ils sont donc ignorés par le contrôle « ID statique manquant »).
- Test conservé : pseudo `<img src=x>` affiché comme texte.

## Auto-tests
`PY=<python> sh tests/qa/selftests.sh` : cas lent coupé par timeout, 404 forcée capturée, mauvaise URL, timeout d'agent, WebKit.

## Limites connues
- WebKit : sur le Mac de test, `browser.launch` réussit mais `context.new_page()` ne répond jamais ; le sas le classe INFRA.
- Le rendu 3D (vestiaire, terrain) peut prendre de 10 à plus de 70 s sous forte charge CPU ; les délais sont mesurés et consignés (observations INFO).
