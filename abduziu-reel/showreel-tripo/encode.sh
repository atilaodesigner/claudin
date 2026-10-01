#!/usr/bin/env bash
# out/frames + trilha -> MP4s (H.264 high, yuv420p, AAC). 8 Mbps fica abaixo do limite de 100 MB
# do GitHub e acima do que o Instagram mantém depois de recomprimir.
set -e
FF="${FFMPEG:-$(cat ../gameplay/ff.txt)}"
V="-framerate 30 -i out/frames/%05d.jpg"
ENC="-c:v libx264 -preset medium -b:v 8M -maxrate 10M -bufsize 16M -profile:v high -pix_fmt yuv420p -movflags +faststart"
"$FF" -y -loglevel error $V -i out/music.wav -map 0:v -map 1:a $ENC -c:a aac -b:a 256k -ar 48000 -shortest out/abduziu-tripo-showreel.mp4
"$FF" -y -loglevel error $V -i out/sfx.wav -map 0:v -map 1:a $ENC -c:a aac -b:a 256k -ar 48000 -shortest out/abduziu-tripo-showreel-sfx.mp4
ls -la out/*.mp4
