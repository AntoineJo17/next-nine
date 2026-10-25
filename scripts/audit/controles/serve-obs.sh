#!/bin/sh
# Copie dist/ vers un dossier temporaire, y ajoute un crochet d'observation window.__g en fin de game.js, et sert sur 8784.
# Usage : scripts/audit/controles/serve-obs.sh <dossier_tmp>
set -e
OUT="$1"; HERE="$(cd "$(dirname "$0")/../../.." && pwd)"
rm -rf "$OUT"; mkdir -p "$OUT"; cp -R "$HERE/dist/." "$OUT/"
printf '\n;window.__g={get action(){return action},get match(){return match},get career(){return career},get engine(){return engine},get drag(){return drag},get guideOpen(){return guideOpen},get replay(){return replay},get frameHandle(){return frameHandle},get mode(){return mode},get shotCurve(){return shotCurve},startMatch,tick,loop,screen,setMode,ev:s=>eval(s)};\n' >> "$OUT/game.js"
exec python3 -m http.server 8784 --directory "$OUT" --bind 127.0.0.1
