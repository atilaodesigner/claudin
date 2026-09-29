# BSBass Drift Game

> Poeira vermelha, grave no talo e um Mustang azul-escuro na madrugada da quebrada.

Jogo de drift que roda direto no navegador (celular em pé ou PC), feito com **Three.js + TypeScript + Vite**, sem engine. Inspirado na mecânica do *Threejs-Punk Drive*, mas com a estética da periferia do Distrito Federal: quadras de cidade-satélite, casa de laje com tijolo baiano aparente, ferro de espera pro próximo andar, caixa d'água azul, muro pixado, bar com mesa de plástico na calçada, luz de sódio laranja, poeira vermelha do cerrado subindo no pé do muro, balão com a Caixa d'Água no meio e a silhueta do Plano Piloto no horizonte.

Tudo é procedural: cidade, texturas (pixo, grafite, placas, asfalto), carros, áudio e as três rádios. **Nenhum asset externo**, só as fontes.

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

## Controles

| | Toque (celular) | Teclado | Controle |
|---|---|---|---|
| Acelerar | **GÁS** | W / ↑ | RT |
| Frear / ré | **FREIO** | S / ↓ | LT |
| Virar | **◀ ▶** | A D / ← → | analógico esquerdo |
| Freio de mão | **DRIFT** | Espaço | A |
| Nitro | **NITRO** | Shift / N | B ou X |
| Câmera (perto / longe / capô) | CAM | C | Y |
| Voltar pra pista | RESET | R | Back |
| Trocar rádio | RÁDIO | Q / E | LB / RB |
| Player do rádio | ícone de equalizador | Tab | |
| Pausa | ☰ | Esc / P | Start |

## Mecânica

- **Física**: modelo de bicicleta com pneu tipo Pacejka, transferência de carga, tração traseira com círculo de atrito (acelerador demais faz a traseira sair), freio de mão travando a traseira, câmbio automático de 6 marchas, assist de contra-esterço e amortecimento de pião. Roda a 120 Hz em passo fixo.
- **Drift**: acima de 28 km/h e 12° de ângulo os pontos sobem por ângulo × velocidade. O multiplicador sobe a cada 2,4 s de lado (até x10). Você tem 1,8 s pra emendar o próximo drift; depois disso o combo vai **pro bolso**. Bateu forte: **perdeu o combo**. O texto muda com o ângulo (DRIFT, BOM DRIFT, DRIFT BRABO, DRIFT INSANO, DRIFT LENDÁRIO).
- **Raspando**: passar colado num carro durante o combo dá bônus, sobe o multiplicador e enche nitro.
- **Nitro**: enche drifando, raspando e pegando fitas.
- **Fitas K7**: 30 fitas espalhadas (cilindro amarelo). A bússola no topo aponta a mais perto ("SINAL DA FITA").
- **Rachas**: 5 corridas de checkpoint contra o relógio. Pare no círculo azul pra começar.
- **Tráfego**: Gol quadrado, Uno, Kombi saia-e-blusa, picape e busão. Andam na mão, contornam o balão no sentido certo, buzinam se você parar na frente e saem rodando quando levam pancada.
- **Superfícies**: asfalto, calçada e o **terrão** de terra vermelha (menos aderência, levanta poeira).
- **Rádio**: GRAVE 61 FM (funk de quebrada), BSBASS PHONK (drift phonk) e EIXÃO TRAP, tudo sintetizado na hora. O paredão da feira pisca no grave. Volume de música e de carro separados.
- Progresso (pontos, maior drift, fitas, rachas, câmera, rádio) fica salvo no navegador.

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
  car/mustang.ts        o Mustang
  traffic/              modelos e IA do tráfego
  fx/                   fumaça, poeira, faíscas, marcas de pneu, rastro das lanternas
  audio/                motor V8, pneu, efeitos e as rádios
  ui/hud.ts             HUD, intro, pausa, player do rádio, minimapa
  game.ts               loop principal, câmera, pós-processamento
tests/                  testes de lógica
```

Faixas, artistas e estabelecimentos são fictícios.
