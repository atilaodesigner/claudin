#!/usr/bin/env bash
# Trailer do BSBass Drift Game: 1080×1920 (9:16), 30 fps, 20 s, a partir do jogo de verdade.
#
#   GAME_URL=http://localhost:4173/ FFMPEG=/caminho/ffmpeg ./build.sh [saida.mp4]
#
# Precisa: o jogo buildado rodando (cd .. && npm run build && npx vite preview --port 4173),
# Chromium (CHROME=...), playwright-core e ffmpeg com libx264.
set -euo pipefail
cd "$(dirname "$0")"
URL="${GAME_URL:-http://localhost:4173/}"
OUT="${1:-bsbass-trailer.mp4}"
FF="${FFMPEG:-ffmpeg}"
if [ -z "${SKIP_RENDER:-}" ]; then
  rm -rf frames && mkdir -p frames
  # 4 renderizadores em paralelo, divididos por número de quadros
  node capture.mjs "$URL" frames 1 aereo fim &
  node capture.mjs "$URL" frames 1 drift &
  node capture.mjs "$URL" frames 1 policia &
  node capture.mjs "$URL" frames 1 poste ferro &
  wait
fi
N=$(ls frames/*.jpg | wc -l)
[ "$N" -eq 600 ] || { echo "faltam quadros: $N/600"; exit 1; }

# trilha: tema de abertura a partir de 1:29.6 (3 s de silêncio, drop em 1:32.6 = corte do drift)
# + chuva por baixo (mais alta no silêncio do começo), saída suave no fim
"$FF" -y -framerate 30 -i frames/%05d.jpg \
  -ss 89.6 -t 20 -i ../public/intro/tema.mp3 \
  -stream_loop -1 -t 20 -i ../public/sfx/rain_loop.mp3 \
  -filter_complex "[1:a]asetpts=PTS-STARTPTS,afade=t=out:st=18.4:d=1.6[m];[2:a]asetpts=PTS-STARTPTS,volume='if(lt(t,3),0.9,0.22)':eval=frame,afade=t=in:d=0.6,afade=t=out:st=18.4:d=1.6[r];[m][r]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.0:LRA=11[a]" \
  -map 0:v -map "[a]" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -r 30 \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest "$OUT"
echo "trailer: $OUT"
