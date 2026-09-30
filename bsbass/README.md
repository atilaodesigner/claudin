# BSBass Drift Game

> Poeira vermelha, grave no talo e um Mustang azul-escuro na madrugada da quebrada.

Jogo de drift que roda direto no navegador (celular em pé ou PC), feito com **Three.js + TypeScript + Vite**, sem engine. Inspirado na mecânica do *Threejs-Punk Drive*, mas com a estética da periferia do Distrito Federal: quadras de cidade-satélite, casa de laje com tijolo baiano aparente, ferro de espera pro próximo andar, caixa d'água azul, muro pixado, bar com mesa de plástico na calçada, luz de sódio laranja, poeira vermelha do cerrado subindo no pé do muro, balão com a Caixa d'Água no meio e a silhueta do Plano Piloto no horizonte.

É madrugada depois do temporal: asfalto molhado com reflexo de verdade (câmera espelhada + poças), chuva fina, cone de luz nos postes, neon de bar, açaí, sinuca, igreja e barbearia, fita de LED no comércio e outdoor aceso em cima da laje.

A cidade, o Mustang, o neon, o áudio e as três rádios são procedurais. Por cima disso entram assets gratuitos de licença **CC0** (domínio público):

| O quê | Fonte | Onde |
|---|---|---|
| Asfalto rachado, tijolo, reboco, concreto, concreto com ferragem, ferro enferrujado, chapa, portão pintado, telha ondulada, calçada, terra, casca de árvore e folhas (fotos PBR) | [ambientCG](https://ambientcg.com) (Road012B, Bricks092, Plaster007, Concrete036, Concrete012, Concrete042C, Metal022, MetalPlates013, PaintedMetal006, CorrugatedSteel005, PavingStones136, Ground103, Bark012, LeafSet009) | `public/tex/` |
| HDRI de rua à noite pros reflexos do carro (*Cobblestone Street Night*) | [Poly Haven](https://polyhaven.com) | `public/tex/night.hdr` |
| Tambor, bombona, pneu velho, carro com capa, ar-condicionado, hidrante, lixeira, caixa de energia, barreira de concreto, saco de cimento, caixa de papelão, rádio | [Poly Haven](https://polyhaven.com) (coleção *Hidden Alley* e outros) | `public/models/` |
| Cadeira de plástico (monobloco), engradado, botijão de gás, saco de lixo e caixote de madeira (*Plastic Monobloc Chair 01*, *Plastic Crate 02*, *Propane Tank*, *Trashbag*, *Wooden Crate 01*; baixados e comprimidos por `node scripts/fetch-props.mjs`) | [Poly Haven](https://polyhaven.com) | `public/models/` |

| Motor (4 loops de rotação), pneu cantando, batidas, buzina, pipoco de escapamento, chuva, cachorro ao longe | [Freesound](https://freesound.org) (FreeCarSoundsGaming, audible-edge, magnuswaker, LPA134, qubodup, innov8_Music, Pól, craigsmith, mihnelis, FiretailHorizons) | `public/sfx/` |

**Campanha**: os carros do bonde (Rolê, Lâmina, Tanque), os pilotos (Duck Jay, Diey, Bella, Bozo), a viatura, o caminhão e as peças do ferro-velho (guindaste, contêiner, pilha de pneu, pilha de carro amassado, cerca, portão, guincho) vêm do **BSBASS THE GAME** (`site/`), com o mesmo visual de desenho (toon + contorno) e a mesma bandeira. Ficam em `public/campaign/`.

**Carros de verdade (Sketchfab, CC-BY)**: `scripts/cars.json` lista o Mustang GT (S550, mesma carroceria do 2020) e os carros da rua (Gol, Gol G4, Uno, Uno com escada, Kombi, Fusca, Opala, Chevette, Palio, Corsa, Saveiro e um ônibus Comil). O Sketchfab só libera download com login, então precisa de um token (conta grátis → Settings → Password & API → API token) na variável `SKETCHFAB_TOKEN`:

```bash
SKETCHFAB_TOKEN=... node scripts/fetch-cars.mjs          # baixa, simplifica, comprime e gera public/models/cars/manifest.json
node scripts/fetch-cars.mjs --local mustang=/caminho/carro.glb   # usa um GLB seu no lugar
```

O jogo normaliza qualquer modelo sozinho (escala pelo comprimento real, frente/trás, chão, rodas girando e esterçando, pintura azul-escura no Mustang, faróis e lanternas acesos). Sem o manifesto, usa os carros procedurais. Os créditos aparecem em CRÉDITOS.

Os modelos foram otimizados com `gltf-transform` (texturas 512 px WebP, malha simplificada). Se algum asset não carregar, o jogo cai de volta na versão procedural. Pra hospedar onde `.glb`/`.hdr` não são servidos, dá pra buildar com `VITE_BIN_SUFFIX=.wasm` e acrescentar `.wasm` no nome desses arquivos (os carregadores reconhecem o formato pelo conteúdo).

## Rodando

Precisa de Node 20+.

```bash
cd bsbass
npm install
npm run dev        # http://localhost:5173 (também na rede local pra testar no celular)
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build estático em `dist/` |
| `npm run preview` | serve o build (`--host`) |
| `npm test` | testes de física, colisão, pontuação e mapa (Vitest) |

O build é estático (`base: './'`): dá pra hospedar `dist/` em qualquer lugar.

### No ar: bsbass.fun (Cloudflare Pages)

`.github/workflows/deploy-bsbass.yml` publica a cada push em `main` (ou no branch do jogo) que mexa em `bsbass/`: testa, builda, junta o BSBASS THE GAME original (`site/`) em `/classico` e sobe tudo pro projeto `bsbass` do Cloudflare Pages, ligado a **bsbass.fun** (e www → apex). Usa os segredos do repositório `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. Cache em `public/_headers`. Na mão: `npm run build`, copiar `site/index.html`, `site/assets` e `site/vendor` pra `dist/classico/` e `npx wrangler pages deploy dist --project-name=bsbass --branch=main`.

## Controles

| | Toque (celular) | Teclado | Controle |
|---|---|---|---|
| Acelerar | **GÁS** | W / ↑ | RT |
| Frear / ré | **FREIO** | S / ↓ | LT |
| Virar | **◀ ▶** | A D / ← → | analógico esquerdo |
| Freio de mão | **DRIFT** | Espaço | A |
| Nitro | **NITRO** | Shift / N | B ou X |
| Câmera (perto / longe / capô) | CAM | C | Y |
| Voltar pra pista | RESET | R | D-pad ↓ |
| Ação (segurar ~1 s) | **AÇÃO** | E / Enter | X |
| Mapa (segurar) | **MAPA** | M | Back |
| Trocar rádio | RÁDIO | Q / Z | LB / RB |
| Mudo | | O | |
| Player do rádio | ícone de equalizador | Tab | |
| Pausa | ☰ | Esc / P | Start |

## Mecânica

- **Física**: modelo de bicicleta com pneu tipo Pacejka, transferência de carga, tração traseira com círculo de atrito (acelerador demais faz a traseira sair), freio de mão travando a traseira, câmbio automático de 6 marchas e assist de contra-esterço. Roda a 120 Hz em passo fixo.
- **Controle de drift**: o carro é aderente (não é sabão): solto segura ~30°, contra-esterço endireita e soltando tudo ele volta a andar reto. Volante pra dentro **com** acelerador ou freio de mão libera a rotação: dá pra girar 180°, 360° e fazer donut. A luz **ESC** acende quando o controle está segurando.
- **Drift**: acima de 28 km/h e 12° de ângulo os pontos sobem por ângulo × velocidade. O multiplicador sobe a cada 2,4 s de lado (até x10). Você tem 1,8 s pra emendar o próximo drift; depois disso o combo vai **pro bolso**. Bateu forte: **perdeu o combo**. O texto muda com o ângulo (DRIFT, BOM DRIFT, DRIFT BRABO, DRIFT INSANO, DRIFT LENDÁRIO).
- **Raspando**: passar colado num carro durante o combo dá bônus, sobe o multiplicador e enche nitro.
- **Nitro**: enche drifando, raspando e pegando fitas.
- **Fitas K7**: 30 fitas espalhadas (cilindro amarelo). A bússola no topo aponta a mais perto ("SINAL DA FITA").
- **Rachas**: 5 corridas de checkpoint contra o relógio. Pare no círculo azul e segure a ação pra começar.
- **Linha guia**: durante o racha e a missão da campanha uma faixa no chão com setas correndo sai do carro e mostra o caminho (azul no racha, ligando os checkpoints pela mão de direção e arredondando as esquinas; âmbar na missão, seguindo a rota do capítulo). No mundo livre ela some.
- **Campanha (BSBASS THE GAME no mundo aberto)**: os 5 capítulos ficam em pontos da cidade, cada um com um feixe de luz suave na cor do estado (âmbar = disponível, verde = feito, cinza = trancado), o número no chão e o ícone do capítulo girando no meio (mira, setas, caminhão, sirene, lua). Chegando perto (~25 m) aparece o cartão com nome, resumo e recorde. Pare dentro do círculo e segure a ação ~1 s (um anel enche); nada começa só de encostar. Os capítulos destrancam em ordem e cada um guarda feito, recorde e estrelas. As regras, inimigos, cinemáticas e recompensas são as mesmas do jogo original: a rota do capítulo vira um circuito fechado pelas ruas (com barreiras nas esquinas só durante a missão). Perdeu: **Tentar de novo** ou **Voltar ao mundo aberto** (o carro volta parado, do lado do ponto, virado pra rua). Ganhou: pontos, estrelas e moedas, o feixe fica verde, o próximo acende e um aviso diz a distância. A pausa tem **Abandonar missão**.
- **Achando o caminho**: a bússola no topo aponta o ponto disponível mais perto (ou o próximo a destrancar); segurando o mapa ela aponta o ferro-velho e o mapa grande abre. Minimapa e mapa usam as mesmas cores.
- **Ferro-velho (base do bonde)**: pátio de terra cercado com guindastes, torre de luz, contêiner, pilhas de pneu e de carro, tambor com fogo e a bandeira do BSBASS balançando entre os ganchos. O portão abre quando você chega e fecha depois. Lá dentro tem dois círculos com ícone girando, igual os das missões: **GARAGEM** (troca, compra e pinta o carro) e **PERSONAGENS** (escolhe quem pilota); para dentro e segura a ação pra abrir o menu. Os carros do bonde ficam estacionados e a galera em pé em volta do fogo. É lugar seguro: sem polícia, sem dano, sem pontuação, e a música abaixa. Tem ícone próprio no mapa desde o começo.
- **Coisas que caem**: poste de calçada, lixeira, tambor, caixa de papelão, cadeira de plástico, botijão, saco de lixo, caixote, hidrante e caixa de energia não seguram o carro: batendo rápido o bastante eles saem voando (o poste tomba, apaga e arrebenta os fios, o hidrante vira chafariz, a caixa de energia solta faísca) e o carro perde só o embalo que o objeto leva, sem perder o combo. Devagar, o poste ainda segura. Longe dali, tudo volta pro lugar.
- **Tráfego**: Gol quadrado, Uno, Kombi saia-e-blusa, picape e busão. Andam na mão, contornam o balão no sentido certo, buzinam se você parar na frente e saem rodando quando levam pancada.
- **Superfícies**: asfalto, calçada e o **terrão** de terra vermelha (menos aderência, levanta poeira).
- **Rádio**: GRAVE 61 FM (funk de quebrada), BSBASS PHONK (drift phonk) e EIXÃO TRAP, tudo sintetizado na hora. O paredão da feira pisca no grave. Volume de música e de carro separados.
- **Fumaça de desenho**: a fumaça do pneu, a poeira e a das batidas são nuvens "brócolis" (cacho de bolotas com sombra de desenho e borda firme) que se desfazem pelas bordas.
- **Rabiscos estilo NFS Unbound**: traço de caneta que "ferve" em volta do carro: laçadas de fumaça no drift, asa quando o ângulo passa de 32°, zigue-zague de chama e linhas de velocidade no nitro, espiral na patinada e estalos na batida, no raspando e quando o combo vai pro bolso. Lanternas e faróis deixam rastro de luz.
- **Abertura**: logo da Gueto Game Studio animada em código (moldura desenhada por um rastro de lanterna, letras entrando de lado, separação de cor, GAME STUDIO acendendo como neon) e depois o vídeo da logo BSBASS, enquanto o jogo carrega, monta a cidade e compila os shaders por trás. Toque ou tecla pula.
- **Celular em pé**: antes da abertura aparece o aviso DEITA O CELULAR (com botão de tela cheia deitada no Android); vira o celular e ele some sozinho, ou dá pra jogar em pé mesmo.
- **HUD enxuto**: velocímetro no canto de baixo (no celular deitado, pequeno entre os controles), textos menores e o nome da música só aparece quando troca.
- **Câmera livre**: mexendo o mouse (PC) ou arrastando o dedo na tela (celular) a câmera gira em volta do carro; soltou, ela volta sozinha pra trás. Dá pra desligar nas configurações.
- **Controle no celular**: antes do BORA! o jogador escolhe BOTÕES (◀ ▶ na tela) ou GIRAR O CELULAR (inclina o celular deitado igual volante, estilo Asphalt; freio e drift na esquerda, gás e nitro na direita). No iPhone a permissão do sensor é pedida no toque; sem sensor fica nos botões.
- **Música de abertura**: toca nas logos, no menu e segue na partida até acabar; trocar a rádio (Q / RÁDIO) pula pra rádio.
- **Menu**: JOGAR, CONFIGURAÇÕES e COMO JOGAR. Os créditos ficam no fim das configurações: desenvolvido pela Gueto Game Studio, direção artística e construção por Átila (@atiladesigner) para o álbum BSBASS da Tribo da Periferia.
- **Qualidade gráfica**: AUTO, BAIXA, MÉDIA, ALTA e ULTRA mudam resolução, reflexo do asfalto, bloom, chuva, luzes dinâmicas, cones de luz e partículas na hora, sem recarregar. No AUTO começa em MÉDIA (celular) ou ALTA (PC) e desce sozinho se o FPS cair. Dá pra desligar rabiscos, rastro de luz, chuva, tremida de câmera e efeito de lente, e mostrar o FPS.
- Progresso (pontos, maior drift, fitas, rachas, câmera, rádio, capítulos, moedas, carro, piloto e pintura) e as configurações ficam salvos no navegador.

## Estrutura

```
src/
  physics/car.ts        física do carro
  physics/collide.ts    SAT (retângulo/círculo), grade espacial, impulso
  score/drift.ts        combo, multiplicador, raspando, perdeu
  world/city.ts         layout da quebrada (dados puros)
  world/cityMesh.ts     malhas da cidade (um draw call por material)
  world/textures.ts     texturas procedurais em canvas
  world/missions.ts     fitas K7 e rachas
  car/mustang.ts        o Mustang (carroceria em seções, cabine, interior, rodas)
  fx/wet.ts             reflexo do asfalto molhado
  fx/rain.ts            chuva e cones de luz dos postes
  fx/guide.ts           linha guia animada no chão (racha e missão)
  world/neon.ts         neon, LED e outdoors
  world/props.ts        objetos de rua (Poly Haven) instanciados
  world/breakables.ts   postes e objetos derrubáveis (física solta, respawn)
  assets.ts             carrega texturas e modelos
  traffic/              modelos e IA do tráfego
  fx/doodles.ts         rabiscos estilo Unbound (atlas em canvas + pontos na GPU)
  fx/                   fumaça, poeira, faíscas, marcas de pneu, rastro das lanternas
  settings.ts           presets de qualidade e opções salvas
  audio/                motor V8, pneu, efeitos e as rádios
  ui/intro.ts           abertura (Gueto Game Studio + vídeo BSBASS) e barra de carregamento
  car/gltfCar.ts        normaliza carros GLB (escala, frente, rodas, pintura)
  ui/hud.ts             HUD, menu, configurações, intro, pausa, player do rádio, minimapa, mapa grande
  campaign/core.js      núcleo do BSBASS THE GAME (carros, pilotos, capítulos, pontuação, save), igual ao do site
  campaign/layout.ts    rotas dos capítulos e lugar do ferro-velho na grade da cidade
  campaign/routes.ts    circuito de cada capítulo pelas ruas (quadro, curvatura, projeção, barreiras)
  campaign/mission.js   missão: polícia, caminhão, bonde, bloqueios, kits, cinemáticas, resultado
  campaign/yard.ts      o ferro-velho (cerca, portão, guindastes, bandeira de pano)
  campaign/campaign.ts  pontos, segurar pra ativar, bússola/mapa, progressão, troca de carro e piloto
  game.ts               loop principal, câmera, pós-processamento
tests/                  testes de lógica
```

Faixas, artistas e estabelecimentos são fictícios.
