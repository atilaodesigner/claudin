#!/usr/bin/env bash
# Gera o reels (1080x1920, 60 fps, 15 s) a partir do jogo real.
#   GAME_URL=http://localhost:4173/ ./build.sh [saida.mp4]
set -euo pipefail
cd "$(dirname "$0")"
URL="${GAME_URL:-http://localhost:4173/}"
OUT="${1:-../abduziu-reels-abducao.mp4}"
FF="${FFMPEG:-ffmpeg}"
CAP=../trailer/capture.mjs
export W=1080 H=1920 DIRECTOR="$PWD/director.js"
mkdir -p frames

node "$CAP" "$URL" frames 1 lata boteco &
node "$CAP" "$URL" frames 1 carros &
node "$CAP" "$URL" frames 1 cidade fim &
wait
node audio.mjs frames reel.wav

"$FF" -y -framerate 60 -i frames/%05d.jpg -i reel.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -r 60 \
  -af "loudnorm=I=-14:TP=-1.0:LRA=11" -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -shortest "$OUT"
echo "reels: $OUT"
