# ABDUZIU × TRIPO — Reel 9:16 (0–10 s)

Animação de apresentação (não faz parte do jogo). Arquivo único: `abduziu-tripo-reel.html` (HTML + CSS + JS, Three.js via CDN). O vídeo pronto é o `abduziu-tripo-reel.mp4` (1080×1920, 60 fps, 10 s, H.264).

## Roteiro

| Tempo | Beat |
| --- | --- |
| 0–2.5 s | Gameplay em greybox: o disco abduz um carro placeholder. "O GAME JÁ FUNCIONAVA." |
| 2.5–4 s | A câmera sobe, cor sai do quadro. "MAS O MUNDO AINDA ESTAVA VAZIO." |
| 4–5.5 s | Slow-mo, callouts amarelos (CAR / BUS / BUILDING / URBAN PROP / VEGETATION MISSING). "EU PRECISAVA DE MUITOS ASSETS 3D." |
| 5.5–6.5 s | Scanner verde + painel REFERENCE → TRIPO → 3D ASSET. |
| 6.5–9 s | Onda de render do Congresso até a câmera: greybox → wireframe → mesh → material → textura → final, com GENERATING MESH / QUAD TOPOLOGY / SMART UV / READY / EXPORT: GLB. |
| 9–10 s | Mundo pronto, o disco freia e abduz um carro 3D completo. "ABDUZIU! +1", "O GAME JÁ EXISTIA. A TRIPO DEU UM MUNDO PRA ELE." e a assinatura ABDUZIU × TRIPO. |

## Controles

- `R` reinicia · `ESPAÇO` play/pause · `1` só blockout · `2` só final · `3` roda a transformação
- `?res=1080` força render interno 1080×1920 · `?capture=1` expõe `window.REEL.renderAt(t)` (exportação quadro a quadro) · `?lang=EN` textos em inglês
- `RECORDING_MODE = true` (padrão): toca uma vez, para em 10 s e dispara o evento `reel-done`.

## Trocando pelos modelos da Tripo

Cada placeholder tem um `blockoutMesh` e um `finalMesh`. Pra usar um GLB real, preencha `ASSET_GLBS` no topo do script (`car: 'tripo/car.glb'`, etc.) ou chame `loadFinalAsset(name, glbUrl)`. O modelo é centralizado e escalado pro tamanho do placeholder, e o shader de transformação (wireframe → material → textura) é aplicado igual. Se o arquivo não carregar, o procedural continua.

## Marca

A palavra "TRIPO" está em texto. Pra peça patrocinada, troque pelo logo oficial da Tripo seguindo o guia de marca deles.

## Exportar de novo

O MP4 foi renderizado quadro a quadro (`renderAt(i / 60)` para `i = 0..599`, screenshot 1080×1920, ffmpeg `libx264 -crf 15 -pix_fmt yuv420p`), então sai idêntico em qualquer máquina, sem depender do fps do navegador.
