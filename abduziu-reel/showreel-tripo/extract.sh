#!/usr/bin/env bash
# Tripo screen recordings -> cropped JPEG sequences (30 fps) for the compositor.
# Crops never include the browser chrome (tabs/bookmarks end at y≈92).
set -e
FF="${FFMPEG:-$(cat ../gameplay/ff.txt)}"
cut() { # name src start dur w h x y
  local d=clips/$1; rm -rf $d; mkdir -p $d
  "$FF" -y -loglevel error -ss $3 -t $4 -i src/$2.mp4 -vf "fps=30,crop=$5:$6:$7:$8" -q:v 3 -start_number 0 $d/%04d.jpg
  echo "$1 $(ls $d | wc -l) frames"
}
cut home   t4 0.2  3.2  1000 495 393 115
cut dash   t4 10.3 9.0  1786 595 0 125
cut upload t4 20.0 7.0  1786 595 0 125
cut turn   t1 0.0  2.9  550 510 640 150
cut rig    t1 3.0  2.9  1160 587 40 125
cut uv     t1 6.0  9.9  1160 587 40 125
cut retopo t1 16.5 2.4  1160 587 40 125
cut tex    t1 19.0 10.9 1160 587 40 125
cut back   t1 29.9 2.0  550 510 640 150
cut man    t5 0.0  21.5 630 595 600 125
cut guid   t5 23.0 29.0 780 595 520 125
cut gtex   t6 0.0  12.4 780 595 520 125
cut topo   t2 16.0 26.0 400 577 40 135
cut gen    t2 0.0  10.0 1260 587 40 125
"$FF" -y -loglevel error -ss 8 -i src/t5.mp4 -frames:v 1 -vf "crop=150:70:1460:128" -q:v 2 clips/stats.jpg
