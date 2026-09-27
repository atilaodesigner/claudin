# ABDUZIU — Origem (Reel 9:16, 15 s)

Filme de motion graphics feito em código (HTML + CSS + JS, Three.js/WebGL, Canvas 2D, DOM): `abduziu-origem-reel.html`.
Vídeo pronto com trilha sintetizada: `abduziu-origem-reel.mp4` (1080×1920, 60 fps, 15 s, H.264 + AAC).

**Mensagem:** Claude Opus 5.5 = código, mecânicas, protótipo (ciano/branco). Tripo = assets 3D (verde). ABDUZIU = resultado.

| Tempo | Cena | Função |
| --- | --- | --- |
| 0–1.5 | A ideia | `cenaIdeia()` · NOVO EXPERIMENTO → E SE... → você pudesse → ABDUZIR → BRASÍLIA? (o OVNI puxa as letras) |
| 1.5–3 | Reveal | `cenaAbduziu()` · as letras giram e viram ABDUZIU; o raio leva o título para a aba do workspace |
| 3–4.5 | Claude | `cenaClaude()` · código sendo escrito, preview cinza jogável, FUNCIONOU., a câmera mergulha no preview |
| 4.5–6 | O problema | `cenaBlockout()` · placeholders etiquetados, "O GAME funcionava. / O MUNDO ainda não." |
| 6–7 | Muitos assets | `cenaAssets()` · placeholders saem do mapa e se multiplicam; MUITOS gigante; freeze |
| 7–9 | Tripo | `cenaTripo()` · scanner transforma tudo; REFERÊNCIA (brasilia_amarela.jpg) → pontos → wireframe → malha → material → textura → PRONTO PARA O GAME .GLB |
| 9–11 | Smart Mesh | `cenaSmartMesh()` · Smart Mesh P2.0, Quad Topology (500 → 25K faces reais), Mesh Edit, Smart UV, Rigging, Text to Motion |
| 11–13 | Transformação | `cenaTransformacao()` · EXPORTANDO .GLB, o carro pousa sobre o cubo cinza e a onda radial finaliza o MESMO mapa |
| 13–14.3 | Gameplay | `cenaGameplay()` · cone +1, carro +5, poste +10, ônibus +50, x2…x16, "OS ASSETS VIRARAM a MECÂNICA." |
| 14.3–15 | Final | `cenaFinal()` · raio gigante suga tudo (inclusive a UI), ABDUZIU cai, CRIADO COM CLAUDE OPUS 5.5 + TRIPO |

**Controles:** R reinicia · ESPAÇO play/pause · ← → navega (Shift = 1 quadro) · 1–6 pulam para as cenas · H debug.
O som (WebAudio) começa no primeiro toque/tecla (regra dos navegadores). `CONFIG.modoGravacao = true` toca uma vez e mantém o mundo vivo depois dos 15 s.

**Arquivos reais:** preencha `ASSETS` no topo do script (logo, prints, referências, GLBs). Vazio = fallback procedural.
GLBs também entram por `carregarAssetFinal('carro' | 'onibus' | 'predio' | 'arvore' | 'ufo', url)`.
A palavra "TRIPO" está em texto; para a peça patrocinada use o logo oficial conforme o guia de marca.

**Exportar:** `?capture=1&res=1080` expõe `window.REEL.renderAt(t)` e `window.REEL.renderAudio()` (WAV em base64). O MP4 foi gerado quadro a quadro (900 quadros) e a trilha renderizada offline.
