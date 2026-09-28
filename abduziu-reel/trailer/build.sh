#!/usr/bin/env bash
# Builds the ABDUZIU launch trailer (1920x1080, 60 fps, ~30 s) from the real game.
#
#   GAME_URL=http://localhost:4173/ ./build.sh [out.mp4]
#
# Needs: a running build of the game (npm run build && npx vite preview --port 4173 in
# ../../abduziu), Chromium (CHROME=...), playwright-core and ffmpeg (FFMPEG=...).
set -euo pipefail
cd "$(dirname "$0")"
URL="${GAME_URL:-http://localhost:4173/}"
OUT="${1:-../abduziu-trailer.mp4}"
FF="${FFMPEG:-ffmpeg}"
mkdir -p frames

# three renderers in parallel, balanced by frame count
node capture.mjs "$URL" frames 1 hook descend small grow &
node capture.mjs "$URL" frames 1 skyline army arena &
node capture.mjs "$URL" frames 1 city_rio city_sp city_ssa city_mao end &
node audio.mjs trailer.wav &
wait

"$FF" -y -framerate 60 -i frames/%05d.jpg -i trailer.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -r 60 \
  -af "loudnorm=I=-14:TP=-1.0:LRA=11" -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -shortest "$OUT"
echo "trailer: $OUT"
