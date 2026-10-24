#!/bin/sh
# Lance les tests QA carrière (le glob tests/*.test.mjs ne descend pas dans les sous-dossiers).
cd "$(dirname "$0")/../.." && exec node --test tests/career-qa/*.test.mjs
