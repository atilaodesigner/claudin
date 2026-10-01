# ABDUZIU × Tripo — showreel (9:16, 63,5 s)

Showreel vertical (1080×1920, 30 fps) pro Instagram Reels: do protótipo cinza ao jogo cheio de
assets feitos na Tripo, com os memes brasileiros e o CTA do código de convite. Sem narração; a trilha
fica em −21 LUFS pra voz entrar por cima.

| Arquivo | O que é |
|---|---|
| `out/abduziu-tripo-showreel.mp4` | vídeo final com trilha + efeitos |
| `out/abduziu-tripo-showreel-sfx.mp4` | só efeitos sonoros (whoosh, impactos, pops), pra editar com narração + música própria |

## Roteiro

| Tempo | Bloco | Material |
|---|---|---|
| 0–6,5 | 01 A ideia | take `ideia` (Brasília no feixe), "ABDUZIR" com o vídeo dentro das letras, zoom através do texto, logo |
| 6,5–11,5 | 02 Protótipo | take `proto`: a mesma cidade com todo material trocado por clay cinza |
| 11,5–16 | 03 Assets | parede 3D com 40 objetos do jogo (renders do `tools/studio`) + rajada de categorias |
| 16–19 | 04 Tripo | home e dashboard da Tripo em cards 3D |
| 19–23 | imagem/texto → 3D | painel com a referência do Manoel → malha |
| 23–26,5 | multivisões | 4 vistas do Guidão (frente, 3/4, lado, costas) que se fundem num modelo girando |
| 26,5–31 | textura / PBR / Smart UV | wipe diagonal malha ↔ textura (mesmo enquadramento nas duas gravações) + painel de textura que vira o Smart UV |
| 31–36 | Smart Mesh P2.0 | retopologia quad, contador 500 → 25.000 faces, painel de topologia, Mesh Edit regenerando uma região |
| 36–39 | rigging | painel Rigging 3D + esqueleto do HUEHUE (render com os ossos) |
| 39–41,5 | Text to Motion | prompt digitado → os três personagens correndo |
| 41,5–44,5 | export GLB | pipeline referência → modelo → textura → rig → GLB → asset no jogo |
| 44,5–49,5 | 05 Gameplay | take `payoff`: personagens da Tripo sendo abduzidos |
| 49,5–55,5 | 06 Memes | 15 objetos brasileiros + HUEHUE, Cabeça de Guidão e Manoel Gomes |
| 55,5–63,5 | 07 CTA | +500 créditos, código RIWOHB, como resgatar, aviso das 24 h, pergunta pra comunidade |

## Como gerar de novo

Precisa do jogo em preview (`cd abduziu && npm run build && npx vite preview --port 4173`) e do
studio em dev (`cd abduziu && npx vite --port 5180`). Coloque as gravações da Tripo em `src/`
(`t1.mp4` … `t6.mp4`).

```bash
node capture.mjs http://localhost:4173/ frames/ideia 1 ideia     # takes do jogo (também proto, payoff)
node studio.mjs                                                # objetos + personagens com fundo transparente
./extract.sh                                                   # recortes das gravações (sem a barra do navegador)
node comp.mjs out/frames                                       # compõe os 1905 frames
node music.mjs music out/music.wav && node music.mjs sfx out/sfx.wav
./encode.sh
```

`node comp.mjs look/p 15` gera um frame a cada 0,5 s pra revisar rápido.
