# ABDUZIU — reels "até onde você chega?" (15 s, 9:16)

Anúncio vertical (1080×1920, 60 fps) no estilo de jogo casual mobile, 100% em português,
feito com o jogo de verdade e dirigido em JavaScript. Vídeo final: `../abduziu-reels-abducao.mp4`.

## Roteiro

| Tempo | Cena | Texto |
|---|---|---|
| 0–2 s | Disquinho puxando uma fileira de latinhas + mãozinha "arraste" | COMECEI COM UMA LATINHA... |
| 2–5,5 s | Campinho com fileiras de cadeiras e mesas de bar, uma cor por fileira | DEPOIS O BOTECO INTEIRO |
| 5,5–9 s | Estacionamento com carros em degradê de arco-íris, varrido fileira por fileira | AÍ VIERAM OS CARROS... |
| 9–12,5 s | Nave gigante em frenesi sobre o centro de São Paulo | ...E NO FIM, A CIDADE TODA |
| 12,5–15 s | Cartela: ABDUZIU · ATÉ ONDE VOCÊ CONSEGUE CHEGAR? · botão JOGAR AGORA · abduziu.fun | |

Interface de anúncio por cima: nível da nave com barra, contador "ABDUZIDOS", "+1/+10/+100"
saindo de cada objeto e combo gigante.

## Som

Cada abdução real é registrada durante a captura (`events-*.json`) e vira um "pop" afinado
na escala pentatônica, no quadro exato, subindo de tom junto com o combo; objetos pesados
ganham um grave. Por baixo, batida casual a 120 BPM com marimba, e um jingle na cartela.

## Como gerar

Usa o mesmo `capture.mjs` do trailer (`../trailer`), com viewport vertical:

```bash
cd abduziu && npm run build && npx vite preview --port 4173 &
cd abduziu-reel/reel-abducao
FFMPEG=/caminho/ffmpeg ./build.sh
```
