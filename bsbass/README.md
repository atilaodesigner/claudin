# BSBass Drift Game

> Poeira vermelha, grave no talo e um Mustang azul-escuro na madrugada da quebrada.

Jogo de drift que roda direto no navegador (celular em pé ou PC), feito com **Three.js + TypeScript + Vite**, sem engine. Inspirado na mecânica do *Threejs-Punk Drive*, mas com a estética da periferia do Distrito Federal: quadras de cidade-satélite, casa de laje com tijolo baiano aparente, ferro de espera pro próximo andar, caixa d'água azul, muro pixado, bar com mesa de plástico na calçada, luz de sódio laranja, poeira vermelha do cerrado subindo no pé do muro, balão com a Caixa d'Água no meio e a silhueta do Plano Piloto no horizonte.

É madrugada depois do temporal: asfalto molhado com reflexo de verdade (câmera espelhada + poças), chuva fina, cone de luz nos postes, neon de bar, açaí, sinuca, igreja e barbearia, fita de LED no comércio e outdoor aceso em cima da laje.

A cidade, o Mustang, o neon e os sons do carro são procedurais. Por cima disso entram assets gratuitos de licença **CC0** (domínio público):

| O quê | Fonte | Onde |
|---|---|---|
| Asfalto rachado, tijolo, reboco, concreto, concreto com ferragem, ferro enferrujado, chapa, portão pintado, telha ondulada, calçada, terra, casca de árvore e folhas (fotos PBR) | [ambientCG](https://ambientcg.com) (Road012B, Bricks092, Plaster007, Concrete036, Concrete012, Concrete042C, Metal022, MetalPlates013, PaintedMetal006, CorrugatedSteel005, PavingStones136, Ground103, Bark012, LeafSet009) | `public/tex/` |
| HDRI de rua à noite pros reflexos do carro (*Cobblestone Street Night*) | [Poly Haven](https://polyhaven.com) | `public/tex/night.hdr` |
| Tambor, bombona, pneu velho, carro com capa, ar-condicionado, hidrante, lixeira, caixa de energia, barreira de concreto, saco de cimento, caixa de papelão, rádio | [Poly Haven](https://polyhaven.com) (coleção *Hidden Alley* e outros) | `public/models/` |
| Postes de madeira com cruzeta, isoladores e transformador (*Modular Electricity Poles*: dois dos postes montados do pacote, sem as pecinhas miúdas; baixados e comprimidos por `node scripts/fetch-props.mjs`). O braço curvo e a luminária acesa são feitos no código | [Poly Haven](https://polyhaven.com) | `public/models/utility_pole_*.glb` |
| Cadeira de plástico (monobloco), engradado, botijão de gás, saco de lixo e caixote de madeira (*Plastic Monobloc Chair 01*, *Plastic Crate 02*, *Propane Tank*, *Trashbag*, *Wooden Crate 01*; baixados e comprimidos por `node scripts/fetch-props.mjs`) | [Poly Haven](https://polyhaven.com) | `public/models/` |

| Motor (4 loops de rotação), pneu cantando, batidas, buzina, pipoco de escapamento, chuva, cachorro ao longe | [Freesound](https://freesound.org) (FreeCarSoundsGaming, audible-edge, magnuswaker, LPA134, qubodup, innov8_Music, Pól, craigsmith, mihnelis, FiretailHorizons) | `public/sfx/` |

**Campanha**: os carros do bonde (Rolê, Lâmina, Tanque), os pilotos (Duck Jay, Diey, Bella, Bozo), a viatura, o caminhão e as peças do ferro-velho (guindaste, contêiner, pilha de pneu, pilha de carro amassado, cerca, portão, guincho) vêm do **BSBASS THE GAME** (`site/`), com o mesmo visual de desenho (toon + contorno) e a mesma bandeira. Ficam em `public/campaign/`.

**Carros do jogador (Sketchfab)**: só três, escolhidos na GARAGEM do ferro-velho: **Chevrolet Corvette C8 Stingray** (vermelho de fábrica, por Hari Prasath R / Haris3D, CC-BY 4.0), **Chevrolet Camaro ZL1** (azul-escuro, por Ddiaz Design, CC-BY 4.0) e **Porsche 911 GT3 992.2** (amarelo, por Ddiaz Design, CC-BY-NC-SA 4.0). Cada um tem seu jeito na física (Camaro com mais torque e traseira solta, Porsche mais colado, Corvette no meio) e a pintura troca na garagem. Sem os arquivos, o jogo volta pro Mustang procedural. **Tráfego (Sketchfab, CC-BY 4.0)**: já estão no jogo o Fiat Uno Turbo 1995 (subishi), o Uno com escada (ClrModels), a Kombi 1969 (Scuderia Morello) e o ônibus Comil Svelto (guilhermescosta); `scripts/cars.json` também lista Gol, Gol G4, Fusca, Opala, Chevette, Palio, Corsa e Saveiro, que entram quando forem baixados. **Caminhão**: na missão "A Carga" o caminhão é um Scania com carreta baú (jsa201077, CC-BY 4.0) no lugar do de desenho. O Sketchfab só libera download com login: ou um token (conta grátis → Settings → Password & API → API token) na variável `SKETCHFAB_TOKEN`, ou o GLB baixado na mão com `--local`:

```bash
SKETCHFAB_TOKEN=... node scripts/fetch-cars.mjs          # baixa, simplifica, comprime e gera public/models/cars/manifest.json
node scripts/fetch-cars.mjs --local corvette=/caminho/carro.glb  # usa um GLB baixado na mão no lugar
```

O jogo normaliza qualquer modelo sozinho (escala pelo comprimento real, frente/trás, chão, rodas girando e esterçando, pintura de fábrica de cada carro, faróis e lanternas acesos). Sem o manifesto, usa os carros procedurais. Os créditos aparecem em CRÉDITOS.

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
- **Fitas K7**: 36 fitas espalhadas (6 nas áreas novas) (cilindro amarelo). A bússola no topo aponta a mais perto ("SINAL DA FITA").
- **Rachas**: 7 corridas de checkpoint contra o relógio (5 na grade, a **Subida da Serra** até o mirante e a **Volta na Estrutural**). Pare no círculo azul e segure a ação pra começar.
- **Rádio do bonde**: o pessoal (DuckJay, Diey, Bella, Bozó) conversa durante o jogo numa caixinha discreta no canto (foto de quem fala, cada um com o retrato tirado do próprio modelo 3D, e a fala digitando, some sozinha): no começo do rolê, drift grande, batida, fita K7, racha, chegada no ferro-velho, papo à toa de vez em quando no mundo livre, e conversa de começo e meio de cada capítulo, carro muito amassado e resultado da missão. Dá pra desligar nas configurações.
- **Linha guia**: durante o racha e a missão da campanha uma faixa no chão com setas correndo sai do carro e mostra o caminho (azul no racha, ligando os checkpoints pela mão de direção e arredondando as esquinas; âmbar na missão, seguindo a rota do capítulo). No mundo livre ela some.
- **Campanha (BSBASS THE GAME no mundo aberto)**: os 5 capítulos ficam em pontos da cidade, cada um com um feixe de luz suave na cor do estado (âmbar = disponível, verde = feito, cinza = trancado), o número no chão e o ícone do capítulo girando no meio (mira, setas, caminhão, sirene, lua). Chegando perto (~25 m) aparece o cartão com nome, resumo e recorde. Pare dentro do círculo e segure a ação ~1 s (um anel enche); nada começa só de encostar. Os capítulos destrancam em ordem e cada um guarda feito, recorde e estrelas. As regras, inimigos, cinemáticas e recompensas são as mesmas do jogo original: a rota do capítulo vira um circuito fechado pelas ruas (com barreiras nas esquinas só durante a missão). Perdeu: **Tentar de novo** ou **Voltar ao mundo aberto** (o carro volta parado, do lado do ponto, virado pra rua). Ganhou: pontos, estrelas e moedas, o feixe fica verde, o próximo acende e um aviso diz a distância. A pausa tem **Abandonar missão**.
- **Achando o caminho**: a bússola no topo aponta o ponto disponível mais perto (ou o próximo a destrancar); segurando o mapa ela aponta o ferro-velho e o mapa grande abre. Minimapa e mapa usam as mesmas cores.
- **Ferro-velho (base do bonde)**: pátio de terra cercado com guindastes, torre de luz, contêiner, pilhas de pneu e de carro, tambor com fogo e a bandeira do BSBASS balançando entre os ganchos. O portão abre quando você chega e fecha depois. Lá dentro tem dois círculos com ícone girando, igual os das missões: **GARAGEM** (troca, compra e pinta o carro) e **PERSONAGENS** (escolhe quem pilota); para dentro e segura a ação pra abrir o menu. Os carros do bonde ficam estacionados e a galera em pé em volta do fogo. É lugar seguro: sem polícia, sem dano, sem pontuação, e a música abaixa. Tem ícone próprio no mapa desde o começo.
- **Rua de verdade**: os postes são de madeira (Poly Haven), com cruzeta e isoladores onde os fios amarram, um em cada quatro com transformador, braço curvo e luminária de sódio; as cruzetas só aparecem até uns 230 m da câmera. Os carros estacionados no meio-fio são os mesmos modelos do tráfego (Uno, Uno com escada, Kombi; o ônibus não estaciona), parados, de farol apagado e cada um com uma cor. Todo carro (o seu, o tráfego e os estacionados) tem vidro com película preta: não dá pra ver o interior.
- **Grafite e pixo**: murais grandes de BSBASS, FAVELA, BRASIL (na bandeira), DISTRITO FEDERAL (na bandeira do DF), DF 61, CEILÂNDIA, QUEBRADA, com letra de wildstyle, e paredes de tag com throw-ups e assinaturas das quebradas do DF. O mural sempre aparece inteiro no muro.
- **Posto 61 em 3D**: cobertura de bordas arredondadas com a faixa vermelha e painéis de LED, pilares pintados, ilhas com meio-fio zebrado, quatro bombas com visor de preço aceso (gasolina, etanol, diesel), mangueira e bico, totem de preços em LED, calibrador e pneus.
- **Farol sempre aceso**: o carro do jogador acende o farol em qualquer qualidade, com a lente acesa e a luz no asfalto à frente mesmo no BAIXA (sem bloom). Lanterna, luz de freio, de ré e farol acendem na peça do próprio modelo (a lente de vidro quando o modelo não tem a lâmpada com nome); nada de placa colada por fora da lataria.
- **Becos e quadras abertas**: em mais ou menos metade das quadras tem um beco entre as casas (às vezes dos dois lados, atravessando a quadra) que dá no miolo de terra batida, com poste de lâmpada e entulho que o carro derruba; terrenos baldios com terra e lixo também dão pra entrar.
- **Mapa maior e torto**: 200 m de cerrado em volta da grade, com um anel de estrada de terra batida (aderência menor, poeira), saídas de terra curvas no fim das ruas, barracos e casinhas virados pra estrada (fora do esquadro) e postes de madeira.
- **Além da quebrada** (mapa de 2,3 km, estilo guia de jogo de rua): a **Via Estrutural**, anel de via expressa de 22 m com faixa dupla e postes, contorna tudo e liga na avenida (que segue como rodovia) e na rua do meio pro norte e pro sul. No noroeste a **Estrada da Serra** sobe em zigue-zague com três cotovelos e curvas abertas entre morros de terra e pedra até o **Mirante** (praça redonda com guarda-corpo). No sudeste o **Setor Novo**, bairro de ruas tortas com casas de laje, postes e carro na beira; no nordeste o **Polo de Galpões**. Cada bairro é uma malha própria (fora da tela, não desenha). Respawn longe da grade cai na estrada asfaltada mais perto.
- **Mapa grande** (segurando o botão do mapa): papel claro, ruas em traço preto, vias expressas com contorno duplo, morros em bege, nomes dos lugares e legenda (ferro-velho, missão, racha, fita K7, você). Norte pra cima, sem espelhar, e a seta aponta pra onde o carro está virado. O minimapa gira com a câmera de verdade (olhando em volta ou de capô continua certo).
- **Carro estacionado voa**: batendo forte (acima de ~22 km/h) nos carros estacionados (e nos com capa) eles são arremessados, giram, capotam e param onde caírem; o seu carro perde o embalo de bater num carro de verdade. Longe dali, voltam pro lugar.
- **Coisas que caem**: poste de calçada, lixeira, tambor, caixa de papelão, cadeira de plástico, botijão, saco de lixo, caixote, hidrante e caixa de energia não seguram o carro: batendo rápido o bastante eles saem voando (o poste tomba, apaga e arrebenta os fios, o hidrante vira chafariz, a caixa de energia solta faísca) e o carro perde só o embalo que o objeto leva, sem perder o combo. Devagar, o poste ainda segura. Longe dali, tudo volta pro lugar.
- **O bonde rodando**: quem não está pilotando roda sozinho pela quebrada, cada um num carro do bonde pintado na própria cor (DuckJay dourado, Diey marrom, Bella vermelho, Bozó prata) com neon da mesma cor: anda a esmo pelas ruas e pelo balão e entra nas esquinas de lado (traseira saindo, volante contra-esterçado, fumaça e marca de pneu), segurando o drift na saída. Aparecem no mapa com a cor de cada um, chamam no rádio quando você cruza com eles, reclamam se você bater e contam pro "raspando".
- **Tráfego**: Gol quadrado, Uno, Kombi saia-e-blusa, picape e busão. Andam na mão, contornam o balão no sentido certo, buzinam se você parar na frente e saem rodando quando levam pancada.
- **Superfícies**: asfalto, calçada e o **terrão** de terra vermelha (menos aderência, levanta poeira).
- **Rádio** (música de verdade, em streaming de `public/radio/`): **BSBASS FM** abre com *Um Grave Romance* (Tribo da Periferia, a música da abertura) e segue no hip-hop; **TRAP 61** e **CRUNK DO DF** (crunk / dirty south). Faixas do [ccMixter](https://ccmixter.org), licença CC-BY 3.0: *The Power of Will*, *Trap Monopoly*, *Goat (Southern Trap)*, *SunLight* e *The Right Voice* (Robbero), *Slow Down Move Over* (Reiswerk), *I Dunno* (grapes), *Slumlord* (lotagblanco), *PoPPin Over Here* (Jeffo_32), *KyA (dirrty)* (Paulus), *The Crunk Alphabet* (blakeht), *M.U.S.T.A.N.G (Going South)* (whytong). Normalizadas em −14 LUFS, 96 kbps. O paredão da feira pisca no grave da música. Volume de música e de carro separados.
- **Fumaça de desenho**: a fumaça do pneu, a poeira e a das batidas são nuvens "brócolis" (cacho de bolotas com sombra de desenho e borda firme) que se desfazem pelas bordas.
- **Rastro de luz**: lanternas e faróis deixam rastro de luz.
- **Abertura**: logo da Gueto Game Studio animada em código (moldura desenhada por um rastro de lanterna, letras entrando de lado, separação de cor, GAME STUDIO acendendo como neon) e depois o vídeo da logo BSBASS, enquanto o jogo carrega, monta a cidade e compila os shaders por trás. Toque ou tecla pula.
- **Celular em pé**: antes da abertura aparece o aviso DEITA O CELULAR (com botão de tela cheia deitada no Android); vira o celular e ele some sozinho, ou dá pra jogar em pé mesmo.
- **HUD enxuto**: velocímetro no canto de baixo (no celular deitado, pequeno entre os controles), textos menores e o nome da música só aparece quando troca.
- **Câmera livre**: mexendo o mouse (PC) ou arrastando o dedo na tela (celular) a câmera gira em volta do carro; soltou, ela volta sozinha pra trás. Dá pra desligar nas configurações.
- **Controle no celular**: antes do BORA! o jogador escolhe BOTÕES (◀ ▶ na tela) ou GIRAR O CELULAR (inclina o celular deitado igual volante, estilo Asphalt; freio e drift na esquerda, gás e nitro na direita). No iPhone a permissão do sensor é pedida no toque; sem sensor fica nos botões.
- **Música de abertura**: toca nas logos, no menu e segue na partida até acabar; trocar a rádio (Q / RÁDIO) pula pra rádio.
- **Menu**: JOGAR, CONFIGURAÇÕES e COMO JOGAR. Os créditos ficam no fim das configurações: desenvolvido pela Gueto Game Studio, direção artística e construção por Átila (@atiladesigner) para o álbum BSBASS da Tribo da Periferia.
- **Qualidade gráfica**: AUTO, BAIXA, MÉDIA, ALTA e ULTRA mudam resolução, reflexo do asfalto, bloom, chuva, luzes dinâmicas, cones de luz e partículas na hora, sem recarregar. No AUTO começa em MÉDIA (celular) ou ALTA (PC) e desce sozinho se o FPS cair. Dá pra desligar rastro de luz, chuva, tremida de câmera e efeito de lente, e mostrar o FPS.
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
  ui/chatter.ts         rádio do bonde (conversas em pontos do jogo) e as falas
  world/neon.ts         neon, LED e outdoors
  world/props.ts        objetos de rua (Poly Haven) instanciados
  world/chunks.ts       instâncias repartidas em pedaços de 160 m (some o que está longe/fora da tela)
  world/region.ts       Via Estrutural, Estrada da Serra + mirante, Setor Novo e Polo de Galpões (dados puros)
  world/breakables.ts   postes e objetos derrubáveis (física solta, respawn)
  world/lampModel.ts    poste de madeira de verdade + braço e luminária
  world/parked.ts       carros estacionados (GLB do tráfego, instanciados)
  world/posto.ts        posto de gasolina em 3D
  utils/mergeModel.ts   junta as malhas de um GLB por material (pra instanciar)
  assets.ts             carrega texturas e modelos
  traffic/              modelos e IA do tráfego
  fx/                   fumaça, poeira, faíscas, marcas de pneu, rastro das lanternas
  settings.ts           presets de qualidade e opções salvas
  audio/                motor V8, pneu, efeitos e a rádio (MP3 em streaming)
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
