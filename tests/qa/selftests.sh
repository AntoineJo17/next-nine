#!/bin/sh
# Auto-tests du lanceur QA (preuves : timeout, capture 404, mauvaise URL, sas WebKit).
# Prérequis : serveur sur 8771 (python3 -m http.server 8771 --directory dist) et un Python avec playwright.
# Usage : PY=/chemin/vers/python sh tests/qa/selftests.sh
# Ce n'est PAS un *.test.mjs : `npm run check` ne l'exécute pas.
PY="${PY:-python3}"
cd "$(dirname "$0")/../../scripts/qa" || exit 1
echo "1) cas lent coupé par son timeout (attendu : PASS)"
"$PY" run.py --agents selftest-slow --output out/selftest-slow >/dev/null 2>&1; echo "   code=$? (attendu 0)"
echo "2) 404 forcée capturée avec URL (attendu : PASS)"
"$PY" run.py --agents selftest-404 --output out/selftest-404 >/dev/null 2>&1; echo "   code=$? (attendu 0)"
echo "3) mauvaise URL -> INFRA"
"$PY" run.py --url http://127.0.0.1:8799/ --agents interface --output out/selftest-badurl >/dev/null 2>&1; echo "   code=$? (attendu 2)"
echo "4) timeout d'agent 3 s -> rapport partiel"
"$PY" run.py --agents selftest-slow --agent-timeout 3 --output out/selftest-agent-timeout >/dev/null 2>&1; echo "   code=$? (attendu 1)"
echo "5) WebKit (INFRA attendu si new_page se bloque sur cette machine)"
"$PY" run.py --browser webkit --agents interface --output out/selftest-webkit >/dev/null 2>&1; echo "   code=$? (2 = INFRA, 0/1 = WebKit fonctionne)"
