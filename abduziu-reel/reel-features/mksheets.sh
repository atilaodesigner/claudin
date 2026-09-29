#!/usr/bin/env bash
# contact sheets of the preview frames: ./mksheets.sh <dir> [shot ...]
FF="${FFMPEG:-ffmpeg}"
D=${1:-preview}; shift
ALL=(hook orbit grow beach legends army arena friends skins end)
SEL=("${@:-${ALL[@]}}")
mkdir -p sheets
for s in ${SEL[@]}; do
  i=0; for x in "${ALL[@]}"; do [ "$x" = "$s" ] && break; i=$((i+1)); done
  f0=$((i*144)); f1=$((f0+144)); [ $s = end ] && f1=1536
  T=$(mktemp -d); k=0
  for ((f=f0; f<f1; f+=12)); do p=$D/$(printf %05d $f).jpg; [ -f $p ] && ln -s "$PWD/$p" $T/$(printf %03d $k).jpg && k=$((k+1)); done
  "$FF" -y -loglevel error -framerate 5 -i $T/%03d.jpg -frames:v 1 -vf "scale=216:384,tile=${k}x1:padding=4" sheets/$s.jpg
  rm -rf $T
done
