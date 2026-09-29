# ABDUZIU — reels de features (EN + PT, 25,6 s, 9:16)

Dois anúncios verticais (1080×1920, 60 fps), um em inglês e outro em português, mostrando as
features do jogo em cortes rápidos no ritmo da música. Tudo que aparece é o jogo de verdade
(mesmo build de abduziu.fun), dirigido em JavaScript; os textos são uma camada separada por idioma.

Vídeos finais: `../reels-features/abduziu-reel-features-en.mp4` e `...-pt.mp4`.

## Roteiro

Cortes a cada 2,4 s (6 tempos de um funk a 150 BPM), sempre no tempo forte.

| Tempo | Cena | EN | PT |
|---|---|---|---|
| 0–2,4 s | Frenesi em câmera lenta sobre os prédios de São Paulo | ABDUCT THE WHOLE CITY | ABDUZA A CIDADE INTEIRA |
| 2,4–4,8 s | Mergulho da órbita até o Rio, clarão na reentrada | DROP IN FROM ORBIT | DESÇA DIRETO DA ÓRBITA |
| 4,8–7,2 s | Crescimento exponencial em espiral, medidor de tamanho | START TINY... END UP GIANT | COMECE PEQUENO... E FIQUE GIGANTE |
| 7,2–9,6 s | Copacabana lotada varrida pelo feixe, contador de abduzidos | ABDUCT ANYTHING · 227 OBJECTS | ABDUZA QUALQUER COISA · 227 OBJETOS |
| 9,6–12 s | Saci, ET de Varginha, Curupira, Mula sem Cabeça, Boitatá e Chupa-cabra na areia de Salvador, sugados um a um | HUNT SECRET LEGENDS | CACE LENDAS SECRETAS |
| 12–14,4 s | Brasília: helicópteros, jatos e o pulso EMP | THE ARMY FIGHTS BACK | O EXÉRCITO REVIDA |
| 14,4–16,8 s | Arena: duas naves engolidas em sequência ("GULP!"/"NHAC!") | EAT OTHER SAUCERS · LIVE ONLINE PvP | ENGULA OUTRAS NAVES · PvP ONLINE AO VIVO |
| 16,8–19,2 s | Squad de 4 naves com skins diferentes, tags NICK#CÓDIGO e notificação de amigo | SQUAD UP WITH FRIENDS | JOGUE COM OS AMIGOS |
| 19,2–21,6 s | Skins trocando no espaço: Neon Rosa → Lava → Cristal → Ouro → Buraco Negro → Nave-Mãe | UNLOCK LEGENDARY SKINS | DESBLOQUEIE SKINS LENDÁRIAS |
| 21,6–25,6 s | Extração: a nave sai do Rio e fura a atmosfera; cartela com logo, CTA, abduziu.fun e as cidades | PLAY FREE | JOGUE GRÁTIS |

## Como funciona

- `director.js` — injetado no jogo: para o loop, avança com relógio fixo, esconde a UI e roteiriza nave,
  câmera e cena de cada corte. Registra eventos (abduções, level-ups, EMP, engolidas, trocas de skin) e a
  posição na tela das lendas e das naves dos amigos (`tracks-*.json`) para a camada de texto.
- `capture.mjs` — grava os quadros JPEG de cada cena com Playwright/Chromium.
- `overlay.html` + `overlay.js` — camada de texto (legendas com palavras entrando no tempo, destaques,
  tags que seguem as lendas e as naves, medidor, contador, cartela final). `overlay.mjs` exporta PNG
  transparente quadro a quadro para cada idioma.
- `audio.js` + `audio.mjs` — trilha sintetizada: funk 150 BPM (tamborzão, 808, palmas, stabs em Lá menor),
  break no espaço, impacto em cada corte e os sons do jogo nos quadros exatos dos eventos.
- `build.sh` — junta tudo com ffmpeg (H.264 High, CRF 17, áudio AAC normalizado em −14 LUFS).

## Como gerar

```bash
cd abduziu && npm run build && npx vite preview --port 4173 &
cd abduziu-reel/reel-features
ln -s ../trailer/node_modules node_modules   # playwright-core
FFMPEG=/caminho/ffmpeg ./build.sh             # --skip-footage reaproveita os quadros já gravados
```

Pré-visualização rápida: `W=540 H=960 node capture.mjs http://localhost:4173/ preview 12 <cena>` e
`./mksheets.sh preview <cena>` monta uma folha de contato em `sheets/`.
