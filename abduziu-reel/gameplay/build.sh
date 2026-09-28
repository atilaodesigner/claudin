#!/usr/bin/env bash
# Renders the gameplay clips (1920x1080, 60 fps, no text) from the real game.
#   GAME_URL=http://localhost:4173/ FFMPEG=/path/to/ffmpeg ./build.sh [clip ...]
# Clips: espaco gigante frenesi exercito arena (default: all).
set -euo pipefail
cd "$(dirname "$0")"
URL="${GAME_URL:-http://localhost:4173/}"
FF="${FFMPEG:-ffmpeg}"
CAP=../trailer/capture.mjs
export W=1920 H=1080 DIRECTOR="$PWD/director.js"
CLIPS=("${@:-espaco gigante frenesi exercito arena}")
declare -A LEN=([espaco]=15 [gigante]=15 [frenesi]=12 [exercito]=15 [arena]=15)
declare -A NAME=([espaco]=01-do-espaco-a-copacabana [gigante]=02-de-latinha-a-arranha-ceu [frenesi]=03-frenesi-sao-paulo [exercito]=04-exercito-em-brasilia [arena]=05-arena-engolindo-naves)
mkdir -p out

render() {
  local c=$1 u="$URL"
  [ "$c" = espaco ] && u="${URL}?city=rio"
  rm -rf "frames/$c"
  node "$CAP" "$u" "frames/$c" 1 "$c"
  node audio.mjs "$c" "frames/$c" "${LEN[$c]}" "frames/$c.wav"
  "$FF" -y -loglevel error -framerate 60 -i "frames/$c/%05d.jpg" -i "frames/$c.wav" \
    -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -r 60 -g 60 \
    -af "loudnorm=I=-14:TP=-1.0:LRA=11" -c:a aac -b:a 192k -ar 48000 \
    -movflags +faststart -shortest "out/abduziu-gameplay-${NAME[$c]}.mp4"
  echo "ok: out/abduziu-gameplay-${NAME[$c]}.mp4"
}

for c in ${CLIPS[@]}; do render "$c" & done
wait
