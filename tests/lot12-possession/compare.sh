#!/bin/sh
# Compare AVANT (game.js de main) et APRES (game.js corrigé) sur le même balayage.
S=/private/tmp/claude-502/-Users-AJ-Downloads-NEXT-NINE-V13/db178aee-03b3-48b9-9487-bf2487b7ce7a/scratchpad/possession
export PATH=/private/tmp/claude-502/-Users-AJ-Downloads-NEXT-NINE-V13/db178aee-03b3-48b9-9487-bf2487b7ce7a/scratchpad/node-v22.11.0-darwin-arm64/bin:$PATH
SCRIPT=${1:-tests/lot12-possession/q.mjs}
cp dist/game.js $S/game.patched.js
echo APRES; node $SCRIPT
cp $S/game.main.js dist/game.js
echo AVANT; node $SCRIPT
cp $S/game.patched.js dist/game.js
