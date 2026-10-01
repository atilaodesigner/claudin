#!/usr/bin/env bash
# motion v2: out/frames2 + out/music2.wav -> MP4 (trilha normalizada pra -14 LUFS, sem narração)
set -e
FF="${FFMPEG:-$(cat ../gameplay/ff.txt)}"
"$FF" -y -loglevel error -framerate 30 -i out/frames2/%05d.jpg -i out/music2.wav -map 0:v -map 1:a \
  -c:v libx264 -preset medium -b:v 8M -maxrate 10M -bufsize 16M -profile:v high -pix_fmt yuv420p -movflags +faststart \
  -af "loudnorm=I=-14:TP=-1.0:LRA=9" -c:a aac -b:a 256k -ar 48000 -shortest out/abduziu-tripo-motion-v2.mp4
ls -la out/abduziu-tripo-motion-v2.mp4
