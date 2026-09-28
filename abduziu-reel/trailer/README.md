# ABDUZIU — launch trailer (JavaScript)

30-second, 16:9 (1920×1080), 60 fps trailer made **from the real game**, directed
entirely in JavaScript. Made with Claude Opus 5.5. Final video: `../abduziu-trailer.mp4`.

## How it works

- `director.js` is injected into the running game (same build as abduziu.fun). It stops
  the game's own `requestAnimationFrame` loop and advances the simulation itself with a
  fixed 1/60 s clock. Each shot sets the scene (city, saucer size, enemies, arena bots),
  scripts the flight path and the camera, and paints the English titles/CTAs as DOM on
  top. Because time never depends on the machine, every frame is perfectly smooth even on
  a slow software renderer.
- `capture.mjs` loads the game in headless Chromium (WebGL via SwiftShader), prepares a
  shot with `TRAILER.prepare(id)` and saves each frame as JPEG.
- `audio.js` composes the score with the Web Audio API (`OfflineAudioContext`):
  120 BPM baile-funk groove, 808 bass, theremin-like UFO lead, hits on every cut, an
  alarm on the army scene and a big pad on the end card. `audio.mjs` renders it to WAV.
- `build.sh` runs three renderers in parallel plus the audio, then muxes with ffmpeg
  (H.264 high profile, CRF 17, loudness normalized to −14 LUFS for social platforms).

## Timeline

| Time | Shot | Copy |
|---|---|---|
| 0–2 s | São Paulo skyline torn apart in slow motion | WHAT IF YOU COULD ABDUCT AN ENTIRE CITY? |
| 2–3.5 s | Tiny saucer descends over Rio | IT STARTS SMALL. |
| 3.5–7 s | Snacking on a Salvador street, combo counter | ABDUCT ANYTHING. / CANS. DOGS. PLASTIC CHAIRS. |
| 7–10.5 s | Growth spurts in Recife: cars, buses, trucks | GROW WITH EVERY BITE. |
| 10.5–13.5 s | Frenzy over downtown São Paulo | EAT THE SKYLINE. |
| 13.5–16 s | Jets, helicopters and police in Brasília + EMP | THE ARMY WILL TRY. |
| 16–22 s | Arena .io: swallow a bot, then a giant swallows you | EAT OTHER SAUCERS... / ...OR GET EATEN. |
| 22–24 s | Rio, São Paulo, Salvador, Manaus | 7 BRAZILIAN CITIES |
| 24–30 s | End card | ABDUZIU · PLAY FREE IN YOUR BROWSER · abduziu.fun · Made with Claude Opus 5.5 |

"Made with Claude Opus 5.5" and "▶ PLAY FREE abduziu.fun" stay on screen as corner
badges during the whole gameplay part.

## Rebuild

```bash
cd abduziu && npm run build && npx vite preview --port 4173 &
cd abduziu-reel/trailer && npm i playwright-core   # once
FFMPEG=/path/to/ffmpeg ./build.sh
```

To check framing quickly, render one frame out of every 15:
`node capture.mjs http://localhost:4173/ preview 15 hook arena end`.
