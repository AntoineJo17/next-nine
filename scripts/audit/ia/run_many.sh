#!/bin/zsh
# usage: run_many.sh <dossier_sortie> <seedDebut> <seedFin> <politique> [episodes]
OUT=$1; A=$2; B=$3; pol=$4; EP=${5:-6}
PY=/private/tmp/claude-502/-Users-AJ-Downloads-NEXT-NINE-V13/db178aee-03b3-48b9-9487-bf2487b7ce7a/scratchpad/py
for s in $(seq $A $B); do
  $PY "$(dirname $0)/browser_probe.py" $s $OUT/$pol-$s $pol $EP > $OUT/$pol-$s.log 2>&1
done
echo done
