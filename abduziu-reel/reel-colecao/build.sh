#!/usr/bin/env bash
# Gera o reels "coleção" (1080x1920, 60 fps, 15 s) a partir do jogo real.
#   GAME_URL=http://localhost:4173/ ./build.sh [saida.mp4]
set -euo pipefail
cd "$(dirname "$0")"
URL="${GAME_URL:-http://localhost:4173/}"
OUT="${1:-../abduziu-reels-colecao.mp4}"
FF="${FFMPEG:-ffmpeg}"
CAP=../trailer/capture.mjs
export W=540 H=960 DPR=2 DIRECTOR="$PWD/director.js"
mkdir -p frames

node "$CAP" "$URL" frames 1 coleta &
node "$CAP" "$URL" frames 1 catalogo &
node "$CAP" "$URL" frames 1 pergunta &
wait
node audio.mjs frames colecao.wav

"$FF" -y -framerate 60 -i frames/%05d.jpg -i colecao.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -r 60 \
  -af "loudnorm=I=-14:TP=-1.0:LRA=11" -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -shortest "$OUT"
echo "reels: $OUT"
