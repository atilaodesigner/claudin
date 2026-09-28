#!/usr/bin/env bash
# ABDUZIU feature reels, English + Portuguese (1080x1920, 60 fps, 25.6 s) from the real game.
#   GAME_URL=http://localhost:4173/ FFMPEG=/path/to/ffmpeg ./build.sh [--skip-footage]
# Footage is rendered once (no text); each language gets its own caption layer on top.
set -euo pipefail
cd "$(dirname "$0")"
URL="${GAME_URL:-http://localhost:4173/}"
FF="${FFMPEG:-ffmpeg}"
OUT="${OUT:-../reels-features}"
export W=1080 H=1920

if [ "${1:-}" != "--skip-footage" ]; then
  rm -rf frames && mkdir -p frames
  node capture.mjs "$URL" frames 1 hook orbit grow &
  node capture.mjs "$URL" frames 1 beach legends army &
  node capture.mjs "$URL" frames 1 arena friends &
  node capture.mjs "$URL" frames 1 skins end &
  wait
fi
node audio.mjs frames 25.6 frames/reel.wav

mkdir -p "$OUT"
for L in en pt; do
  rm -rf "ov_$L"
  node overlay.mjs frames "$L" "ov_$L"
  "$FF" -y -loglevel error -framerate 60 -i frames/%05d.jpg -framerate 60 -i "ov_$L/%05d.png" -i frames/reel.wav \
    -filter_complex "[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]" -map "[v]" -map 2:a \
    -c:v libx264 -preset slow -crf 17 -maxrate 16M -bufsize 32M -profile:v high -r 60 -g 60 \
    -af "loudnorm=I=-14:TP=-1.0:LRA=11" -c:a aac -b:a 192k -ar 48000 \
    -movflags +faststart -shortest "$OUT/abduziu-reel-features-$L.mp4"
  echo "ok: $OUT/abduziu-reel-features-$L.mp4"
done
