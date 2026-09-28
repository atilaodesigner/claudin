# Progresso

Legenda: ✅ executado (com evidência) · 🧪 medido · 📋 planejado · ⚠️ limitação conhecida

## 2026-09-28: Marco A iniciado

- ✅ Plano completo escrito em [`PLANO.md`](PLANO.md) (seções 1–12).
- ✅ Versões consultadas no npm nesta data: three 0.186.1, @dimforge/rapier3d(-deterministic)-compat 0.21.0, colyseus 0.18.8 (Node ≥ 22), @colyseus/sdk 0.18.4, @colyseus/schema 5.0.x, vite 8.3.1, vitest 5.0.2, typescript 7.0.2. **Ainda não instaladas nem testadas juntas** (B0).
- ✅ Documentação oficial consultada: netcode do Colyseus 0.18 (APIs `room.input()`, `setFixedTimestep()`, `predict`), WebGPURenderer do Three.js (incompatibilidades com ShaderMaterial/onBeforeCompile/EffectComposer) e determinismo do Rapier JS (mesma versão, mesma ordem de inserção, cuidado com funções transcendentais).
- ⚠️ Referência visual: só o texto do post no Threads foi acessível; o vídeo não foi assistido. Nenhuma decisão se baseia em observação do vídeo.
- 📋 Nenhum teste executado ainda: não há código.

## 2026-09-28: abertura animada

- ✅ Criado `packages/client` (Vite 8.3.1 + TypeScript 7.0.2, versões exatas) e o workspace npm em `ginga-arena/`.
- ✅ `src/intro/StudioSting.ts`: vinheta GUETO GAME STUDIO em vermelho `#FB010A`, com geometria medida da arte do estúdio (1860×846). A moldura se desenha, as letras carimbam, passa um brilho, "GAME STUDIO" se escreve em branco e a moldura abre em portal.
- ✅ `src/intro/GameLogo.ts`: logo GINGA ARENA toda branca e vetorial. A bola entra em arco, as letras sobem com balanço (ginga), a bola quica duas vezes no I (altinha), "ARENA" aparece entre duas linhas e a marca balança uma vez. Depois fica em loop leve como tela de título.
- ✅ `src/intro/IntroSequence.ts`: encadeia as duas (a logo aparece através do portal), dá pra pular por tecla/clique/toque, respeita "reduzir movimento", `?intro=0` pula direto.
- ✅ `npm run build` (typecheck + build) passou; bundle JS de 14,5 KB (5,8 KB gzip).
- ✅ Frames capturados no Chromium headless (1280×720 e 844×390 @2x), sem erros de console. ⚠️ Não testado ainda em Firefox, Safari e celular real.

## 2026-09-28: B0 (spike de versões) e B1 (simulação compartilhada)

**B0, executado:**
- ✅ Instaladas e fixadas: `colyseus` 0.18.8, `@colyseus/sdk` 0.18.4, `@colyseus/testing` 0.18.6, `@dimforge/rapier3d-deterministic-compat` 0.21.0, `three` 0.186.1, `tsx` 4.23.15, `vitest` 5.0.2.
- 🧪 Rapier (Node 22): **0 atravessamentos** da rede em 10.000 chutes de 18–26 m/s; z = 0 sempre; trajetória idêntica (hash MD5 igual) entre execuções; **restaurar posição+velocidade num mundo novo reproduz a trajetória com diferença 0**.
- ✅ Decisão D-17: não usar o Schema do Colyseus; snapshots próprios por mensagem (msgpack, float64 exato). Evita a dúvida TS 7 × decorators e dá snapshots marcados por tick, que a reconciliação precisa.
- ✅ A API 0.18 instalada tem `setFixedTimestep`/`defineInput`/`allowRewindState`; por ora usamos nosso próprio loop fixo e fila de inputs (a bola exige lógica própria de qualquer jeito). Reavaliar depois do E-BOLA.
- ✅ `roomId` pode ser definido no `onCreate` → o código curto da sala é o próprio id (entrada com `joinById`).
- 📋 Hash do Rapier nos navegadores (Chrome/Firefox/Safari): pendente, vai para a página de diagnóstico do cliente.

**B1, executado:**
- ✅ `packages/shared`: `params`, `input`, `rng`, `physics` (Rapier), `sim` (partida completa), `bot`, `protocol`.
- ✅ Ajuste na ordem do tick: física da bola **antes** do contato, com varredura do trajeto e o contato no **primeiro** ponto que entra no alcance (a ordem do plano deixava a varredura com comprimento zero).
- ✅ Rotação da bola travada na física (o giro é só visual): com rotação livre, o atrito criava um estado oculto que quebrava a restauração exata.
- ✅ Regra "a bola precisa sair do alcance antes de o mesmo jogador tocar de novo" implementada (sem ela, ataques lentos perto da rede viravam 4º toque).
- ✅ Cálculo do ataque em forma fechada (parábola pelo ponto de folga da rede e pelo ponto de queda).
- ✅ `npm test` (shared): **26 testes passando**. Cobrem placar (7/+2, 10×10, teto 11), ciclo contagem → preparação → saque → auto-saque aos 5 s, chão, fora pelo último toque, rede que segue, 4º toque, 3 toques no 1v1, toque duplo no 2v2, saque inválido, lado do outro, zerar contagem ao cruzar, contato a 22 m/s, 1 contato por ação, parte do corpo por altura, ataque que passa a rede, erro cedo/tarde determinístico, bola presa, pausa (pendência vira ponto; rally anulado), W.O., determinismo (mesma semente) e restauração de snapshot.
- 🧪 Bot contra bot, 6 partidas por nível:

  | Nível | Travessias por rally | Minutos por partida | Faltas de 4 toques |
  |---|---|---|---|
  | fácil | 9,4 | 5,7 | 5 em 65 pontos |
  | médio | 7,9 | 4,8 | 9 em 83 |
  | difícil | 6,6 | 2,8 | 8 em 71 |

## 2026-09-28: B2 (servidor), B3/B4 (cliente jogável e netcode) e B5 (laboratório)

**B2, servidor (executado):**
- ✅ `MatchRoom`: código de 4 caracteres sem O/0/I/1 (é o próprio `roomId`), 2 vagas, apelido sanitizado, pronto/cancelar, contagem, simulação a 60 Hz, snapshots a 20 Hz com `ack`, eventos com id crescente mesmo entre revanches, revanche por votos, pausa na queda + `allowReconnection(15 s)`, limite de 3 quedas / 45 s, W.O. por saída ou tempo esgotado, log opcional de inputs + semente (`GINGA_LOG_DIR`), `/health` e `/stats`.
- ✅ Validação de input: só bits, `seq` crescente, janela de tick [−6, +30], lote ≤ 8 frames, *token bucket* 90/s (rajada 30), 20 violações/min → desconecta. Inputs atrasados: movimento aplicado agora, toques/pulos mesclados (um toque atrasado não se perde).
- 🐛 Achado e corrigido: `patchRate = null` antes do `setFixedTimestep` travava o relógio da sala (D-19).
- ✅ `npm test` (server): **7 testes de integração com clientes reais do SDK**, todos passando: código e entrada; recusa de versão, sala cheia e código inexistente; apelido limpo; partida com os dois recebendo o mesmo ponto; input adulterado (posição, força, placar, bits inválidos, tick no futuro) sem efeito, com flood derrubando o cliente; W.O. ao sair; queda → pausa → reconexão por token na mesma vaga.

**B3/B4, cliente (executado):**
- ✅ Telas: abertura → título → Início (apelido, criar sala, entrar por código, treino, contra bot com nível, controles, reduzir movimento/efeitos, volume) → Sala (código grande, copiar link, compartilhar, vagas, pronto) → Partida → Resultado (estatísticas, revanche) + menu/pausa, sobreposição de reconexão, avisos de erro (sala cheia, código inválido, versão nova, servidor fora), convite por `?sala=`, volta automática à partida depois de recarregar a página (token em `sessionStorage`).
- ✅ Arena "Orla do Posto 7½" em código: quadra com linhas, chinelos nos cantos, rede com fita, calçadão com ondas originais, quiosque Coco & Cia, guarda-sóis, cadeiras, caixa térmica, bicicletas, prédios, morro, torcida e o cachorro caramelo (abana o rabo, anima nos pontos). Avatares procedurais da Duda e do Juninho (silhuetas diferentes, olhar para a rede, pernas animadas pelas janelas de ação da simulação), bola maior que a física para leitura, sombra da bola sempre ativa, rastro em ataques, estrela no contato (dourada no perfeito), areia no chão, câmera lateral sem cortes com tremor opcional, indicador de bola acima da tela.
- ✅ HUD: placar com ▲/●, quem saca, bolinhas de toques restantes (a última pisca), ponto de partida, contagem, "Sua vez de sacar · 5s", faltas ("Caiu!", "Pra fora!", "Quatro toques!"…), "De primeira!", "Boa!", "Essa foi bonita!", ping. F3 abre o painel de rede.
- ✅ Som sintetizado (WebAudio), com panorâmica pela posição da jogada.
- ✅ Controles: teclado, controle e toque (◀ ▶ + Pular/Toque/Ataque, com deslizar entre ◀ e ▶).
- ✅ Netcode: relógio por mediana, adiantamento dinâmico, previsão do próprio avatar com reconciliação suavizada, interpolação do adversário, bola em duas linhas do tempo, toque previsto e confirmado pelo servidor, deduplicação de eventos.
- ✅ Bundle: abertura **6,7 KB gzip** (aparece na hora); jogo em chunk separado de **~1,9 MB gzip** (1,68 MB é o WASM do Rapier embutido), carregado enquanto a vinheta roda.
- ✅ Verificado no Chromium (Playwright): menu, partida contra bot, duas abas online na mesma sala (placar igual, lado espelhado certo para cada jogador), celular deitado (Pixel 7) com controles de toque. Sem erros de console.

**B5, laboratório de latência (executado, com ressalvas):**
- 🐛 Achados pelo laboratório e corrigidos:
  - a URL da sala apagava os outros parâmetros;
  - frames lentos pulavam a leitura de input (clientes lentos "congelavam");
  - o adiantamento ignorava o tempo de frame (D-20);
  - toques descobertos na re-simulação não eram contados (D-21);
  - o histórico de reação do bot guardava referências vivas (o atraso de reação não valia).
- 🧪 Medido: dois Chromium (renderização por software, ~10 fps por causa da CPU do sandbox), bot médio × bot médio, 90 s por perfil, pelo proxy TCP:

```
== RTT 40 ms ±5, perda 0.5% ==
A: RTT 41 ms, jitter 4 ms, lead 9, interp 7 | toques previstos 24, confirmados 24, rejeitados 0 (0.0%), achados no replay 0 | correção da bola p95 0.0 cm | correções do avatar 3 (grandes 0)
B: RTT 44 ms, jitter 5 ms, lead 9, interp 7 | toques previstos 29, confirmados 27, rejeitados 1 (3.4%), achados no replay 0 | correção da bola p95 0.0 cm | correções do avatar 12 (grandes 0)
placar A 5×4 | B 4×5 → IGUAL
servidor: vaga 0: 5319 frames, 104 atrasados aplicados, 6 descartados | vaga 1: 5270 frames, 67 atrasados aplicados, 10 descartados
erros de página: nenhum
== RTT 100 ms ±15, perda 1.0% ==
A: RTT 100 ms, jitter 19 ms, lead 13, interp 9 | toques previstos 28, confirmados 28, rejeitados 0 (0.0%), achados no replay 0 | correção da bola p95 0.0 cm | correções do avatar 29 (grandes 0)
B: RTT 98 ms, jitter 12 ms, lead 12, interp 8 | toques previstos 36, confirmados 34, rejeitados 2 (5.6%), achados no replay 2 | correção da bola p95 0.0 cm | correções do avatar 26 (grandes 0)
placar A 2×5 | B 5×2 → IGUAL
servidor: vaga 0: 5288 frames, 110 atrasados aplicados, 15 descartados | vaga 1: 5296 frames, 117 atrasados aplicados, 13 descartados
erros de página: nenhum
== RTT 180 ms ±30, perda 2.0% ==
A: RTT 185 ms, jitter 15 ms, lead 15, interp 8 | toques previstos 23, confirmados 21, rejeitados 1 (4.3%), achados no replay 1 | correção da bola p95 0.0 cm | correções do avatar 33 (grandes 0)
B: RTT 206 ms, jitter 58 ms, lead 21, interp 14 | toques previstos 28, confirmados 27, rejeitados 1 (3.6%), achados no replay 1 | correção da bola p95 0.0 cm | correções do avatar 30 (grandes 0)
placar A 4×5 | B 5×4 → IGUAL
servidor: vaga 0: 5238 frames, 102 atrasados aplicados, 3 descartados | vaga 1: 5210 frames, 92 atrasados aplicados, 14 descartados
erros de página: nenhum
```

  | RTT (jitter, perda) | Toques rejeitados | Meta do plano | Placar igual |
  |---|---|---|---|
  | 40 ms (±5, 0,5%) | 0% e 3,4% | < 1% | sim |
  | 100 ms (±15, 1%) | 0% e 5,6% | < 2% | sim |
  | 180 ms (±30, 2%) | 4,3% e 3,6% | < 5% | sim |

- ⚠️ **Limitações conhecidas:**
  - Quem joga são bots, não pessoas, e os clientes rodam a ~10 fps no sandbox. O adiantamento fica maior do que num computador normal (8–21 ticks), o que é pior que o caso real.
  - As rejeições vêm de inputs descartados por chegarem > 6 ticks atrasados durante as "travadas" que simulam perda (aparecem como `descartados` no `/stats`). O contato retroativo limitado (PLANO §7.6) **ainda não foi implementado**; é o próximo passo para bater a meta de 100 ms.
  - A correção da bola no lado do jogador local deu 0,0 cm no p95. É esperado com simulação determinística: ali a bola só depende dos seus próprios inputs. As correções aparecem no avatar (inputs atrasados) e na bola vinda do adversário (suavizadas, fora da métrica).
  - Ainda não testado: Firefox, Safari, celular real, duas redes diferentes, 10 partidas completas seguidas. Continuam pendentes no checklist da §11.

## Próximos passos

1. **B5, fechar a meta de 100 ms:** contato retroativo limitado no servidor (≤ 6 ticks, só com bola do próprio lado e sem contato no meio) e aceitar pressionamentos atrasados até ~30 ticks (movimento descartado, toque avaliado no tick original). Repetir o laboratório.
2. **B6, staging:** cliente no Cloudflare Pages + servidor Node persistente em São Paulo. É custo, então precisa de confirmação antes de criar recurso pago.
3. Checklist §11 com pessoas: dois aparelhos em redes diferentes, 10 partidas, Firefox/Safari/iPhone/Android.
4. Marco C: playtests, ajuste de janelas e alcance, finta, tutorial de 5 passos, remapeamento, controles de toque ajustáveis (hoje os botões da direita cobrem um pouco o canto da quadra no celular).
