# ABDUZIU — gameplay clips (1920×1080, 60 fps, no text)

Five short, text-free moments rendered from the real game (same build as abduziu.fun).
Final files: `../gameplay-videos/`.

| # | Clip | Length | What happens |
|---|---|---|---|
| 01 | Do espaço a Copacabana | 15 s | Orbit over Brazil → the globe turns to Rio → re-entry → through the clouds → sweeping a packed Copacabana |
| 02 | De latinha a arranha-céu | 15 s | One take: a tiny saucer between Rio's towers grows until it lifts the towers themselves |
| 03 | Frenesi em São Paulo | 12 s | Max-level frenzy downtown, slow motion, skyscrapers ripped into the beam |
| 04 | Exército em Brasília | 15 s | Red-alert sky, jets and helicopters, two EMP blasts, the Esplanada torn apart |
| 05 | Arena: engolindo naves | 15 s | Arena .io: five saucers swallowed in a row, each bigger than the last |

- `director.js` is injected into the game: it stops the game loop, steps the simulation
  with a fixed clock, hides every piece of UI and scripts the saucer + camera. Every
  abduction, level-up, explosion, EMP and swallow is logged for the sound.
- `audio.js` synthesizes a groove per clip plus the game sounds on the exact frames
  (Web Audio `OfflineAudioContext`); `audio.mjs` renders it to WAV.
- `build.sh` renders all clips in parallel (headless Chromium) and muxes with ffmpeg.
  The published files were re-encoded from the frames for social platforms:
  H.264 High 4.2, CRF 16, max 24 Mbps, AAC 192 kb/s, −14 LUFS.

```bash
cd abduziu && npm run build && npx vite preview --port 4173 &
cd abduziu-reel/gameplay && FFMPEG=/path/to/ffmpeg ./build.sh            # all clips
FFMPEG=/path/to/ffmpeg ./build.sh arena                                    # one clip
```
