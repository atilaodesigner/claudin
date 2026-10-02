# BSBASS — trailer 9:16

Vídeo de 20 s, 1080×1920, 30 fps, feito **com o jogo de verdade** (mesmo build do bsbass.fun): `bsbass-trailer.mp4`.

- `director.js` é injetado no jogo aberto com `?manual`: esconde o HUD, avança a simulação com relógio fixo (1/30 s), dirige o carro (piloto automático seguindo as rotas dos capítulos, controlador de drift que segura ~35° de ângulo no terrão), move a câmera por roteiro e escreve as legendas.
- `capture.mjs` abre o jogo no Chromium headless (WebGL via SwiftShader), prepara uma cena e salva cada quadro em JPEG.
- `build.sh` roda 4 capturas em paralelo e junta tudo com ffmpeg: H.264, trilha = tema de abertura a partir de 1:29,6 (o drop em 1:32,6 cai no corte do drift) com chuva por baixo, loudness −14 LUFS.

| Tempo | Cena | Texto |
|---|---|---|
| 0–3 s | Aéreo na chuva em volta da Caixa d'Água | PERIFERIA DO DF · madrugada, chuva, grave |
| 3–7 s | Drift no terrão levantando poeira (entra o drop) | DRIFT NO GRAVE |
| 7–9,4 s | Câmera lenta derrubando o poste (respiro da música) | DERRUBA O QUE VIER |
| 9,4–14 s | Capítulo 4: fuga com o bonde e a polícia | 5 CAPÍTULOS · a polícia na cola |
| 14–17 s | Ferro-velho: bandeira, guindastes, galera | O FERRO-VELHO · base do bonde |
| 17–20 s | Mustang parado na chuva + logo | JOGUE GRÁTIS · bsbass.fun |

## Gerar de novo

```bash
cd bsbass && npm run build && npx vite preview --port 4173 &
cd bsbass/trailer && npm i playwright-core   # uma vez
FFMPEG=/caminho/ffmpeg ./build.sh             # SKIP_RENDER=1 só recodifica os quadros já feitos
```

Prévia rápida (1 de cada 8 quadros): `node capture.mjs http://localhost:4173/ previa 8 aereo drift`.
