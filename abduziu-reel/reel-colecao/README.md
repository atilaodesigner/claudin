# ABDUZIU — reels "coleção" (15 s, 9:16)

Reels vertical em português (1080×1920, 60 fps) que mostra a coleção de objetos do jogo e
termina pedindo pra galera comentar o objeto ou meme que quer ver no ABDUZIU. Feito com o
jogo de verdade, dirigido em JavaScript. Vídeo final: `../abduziu-reels-colecao.mp4`.

Capturado a 540×960 com densidade 2x, pra interface do jogo (tela COLEÇÃO) aparecer no
tamanho real de um celular.

| Tempo | Cena | Texto |
|---|---|---|
| 0–4 s | Nave abduz uma fileira de objetos brasileiros; cada um novo pula um card "NOVO NA COLEÇÃO!" com miniatura, número e nome reais do jogo | CADA COISA QUE VOCÊ ABDUZ... / ...ENTRA PRA SUA COLEÇÃO |
| 4–9 s | Tela COLEÇÃO real: ficha do Chinelo de Dedo ("Arma tradicional das mães brasileiras"), rolagem até os SECRETOS | 142 OBJETOS BEM BRASILEIROS / E TEM OS SECRETOS... |
| 9–15 s | Cartas #143 #144 #145 com "?", ideias de exemplo, CTA de comentário, ABDUZIU · abduziu.fun | O QUE FALTA NA COLEÇÃO? · OS MELHORES PODEM VIRAR OBJETO NO JOGO · COMENTA O OBJETO OU MEME QUE VOCÊ QUER ABDUZIR |

As ideias do CTA aparecem como exemplos ("TIPO... carrinho de pamonha?"), não como
comentários de pessoas.

Som (`audio.js`): pop afinado em cada abdução real (eventos gravados na captura), brilho
de marimba em cada objeto novo, tiques de página no catálogo, "boing" na ficha do chinelo,
suspense nos secretos e pops em cada ideia do CTA.

```bash
cd abduziu && npm run build && npx vite preview --port 4173 &
cd abduziu-reel/reel-colecao && FFMPEG=/caminho/ffmpeg ./build.sh
```
