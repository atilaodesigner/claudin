# GINGA ARENA: plano de construção

> **Versão:** 0.1 (Marco A, Definição) · **Data:** 2026-09-28 · **Status:** documento vivo
> Decisões: [`DECISOES.md`](DECISOES.md) · Progresso: [`PROGRESSO.md`](PROGRESSO.md)

**Sobre a referência.** Consegui acessar apenas o texto público do post no Threads (perfil *teamgoodknight*): *"That Must Have Felt Good! 😍 He Snuck Through BOTH of Them?! Gotta Love Making These Shots! (Wishlist Sepak U | Stage: 🇵🇭)"*. **Não consegui assistir ao vídeo nesta sessão.** Nenhuma observação visual deste plano vem dele. A premissa usada é a descrição do briefing: disputa lateral sobre rede, acrobacias, golpes expressivos e apresentação próxima de um jogo de luta.

**Como ler.** O jogo é simulado em *ticks* de 1/60 s. "6 ticks" = 100 ms. Unidades de mundo em metros. Todo número marcado como *hipótese* é ponto de partida para medir, não verdade.

---

## 1. Visão executiva e diferencial

**GINGA ARENA** é um futevôlei arcade em 2,5D para navegador: dois lados, uma rede, uma bola e quatro botões. Você abre um link, manda o código pro parça e em menos de um minuto os dois estão numa disputa de sete pontos.

> *"Entre pelo navegador, chame um amigo e transforme uma troca de bola em uma disputa cheia de ginga."*

### Diferenciais

1. **Esporte com leitura de jogo de luta.** Cada ação tem preparação, contato e recuperação visíveis, então o adversário lê seu corpo antes de a bola sair. No Marco C testamos a **finta** (o "migué"): cancelar o início de um ataque num toque curto. É ginga como mecânica, não só como tema.
2. **Quatro botões, corpo inteiro.** Pé, coxa, peito e cabeça são escolhidos pelo contexto (altura da bola + ação). A profundidade vem de posição, timing, direção e risco, não de decorar comandos.
3. **Brasil específico, não genérico.** Cada arena é um lugar coerente, com humor de cotidiano no fundo: chinelo marcando a quadra, cachorro caramelo na torcida.
4. **Link → partida.** Sem instalação, sem conta, sala por código ou convite.
5. **Competição justa.** O servidor decide bola, contatos, faltas e placar. Efeitos visuais nunca mudam regra.

### Futevôlei (modo principal) × altinha (expansão)

| | **Futevôlei arcade** (MVP) | **Altinha em roda** (Marco F) |
|---|---|---|
| Formato | 2 lados + rede; 1v1, depois 2v2 | roda cooperativa, 3–6 pessoas, sem rede |
| Objetivo | fazer a bola cair no lado adversário | manter a bola no ar o maior tempo possível |
| Contatos | até 3 por equipe | sequência livre; regra de "não repetir o mesmo" configurável |
| Pontuação | ponto por rally, até 7 | combo coletivo, recorde da roda |
| Câmera | lateral fixa, sem cortes | 3/4 elevada ao redor da roda |
| Física | plano lateral (2D dentro de 3D) | 3D completo; exige mira em profundidade |
| Emoção | duelo, leitura, risco | colaboração, estilo, sequência |

A altinha exige câmera, mira e regras próprias. Por isso fica fora do MVP. A arquitetura só a deixa possível: a física já nasce em 3D, mas presa ao plano no modo competitivo.

---

## 2. Decisões recomendadas e premissas

### 2.1 Decisões

| # | Decisão | Por quê | Alternativa descartada (por ora) |
|---|---|---|---|
| D-01 | Projeto em `ginga-arena/` neste repositório, monorepo com **npm workspaces** | mesmo gerenciador do `abduziu/`, sem ferramenta nova | pnpm/turborepo: ganho pequeno agora |
| D-02 | Pacotes `shared`, `client`, `server` (+ `tools` no Marco D) | regras e simulação únicas para cliente, servidor e bot | lógica duplicada no cliente |
| D-03 | Simulação fixa a **60 Hz**, estado a **~20 Hz**, render livre | tick curto dá timing fino; 20 Hz economiza banda | 30 Hz (janelas de contato grosseiras demais) |
| D-04 | **Rapier 3D** com a bola travada no plano X/Y, build `rapier3d-deterministic-compat` | mesma API do build comum, com determinismo multiplataforma documentado; o custo de desempenho é irrelevante para uma bola | `rapier2d` (plano B se o travamento falhar); física própria |
| D-05 | Contato jogador–bola é **consulta de jogo**, não colisão física | evita impulsos acidentais e deixa o contato 100% controlado por regra | colisão física de corpos |
| D-06 | **WebGLRenderer (WebGL2)** no MVP; WebGPU/TSL como experimento isolado no Marco E | compatibilidade ampla. A doc oficial avisa que `ShaderMaterial`, `onBeforeCompile` e `EffectComposer` não funcionam no `WebGPURenderer` | adotar WebGPU direto |
| D-07 | Visual com **materiais padrão/toon, contorno por geometria** (*inverted hull*) e **sem pós-processamento no MVP** | o mesmo visual porta para os dois renderers; menos custo no celular | pós-processamento com EffectComposer (prende ao WebGL) |
| D-08 | HUD e menus em **HTML/CSS + TS puro**, com store simples | leve, acessível, igual ao `abduziu/` | React/Preact (reavaliar se as telas crescerem) |
| D-09 | **Colyseus 0.18** (servidor) + **`@colyseus/sdk` 0.18** (cliente) | salas, estado, reconexão e APIs de netcode documentadas | `colyseus.js` 0.16: versão antiga, não misturar |
| D-10 | **Bola em duas linhas do tempo** (ver §7.5) + contato local previsto e confirmado pelo servidor | o maior risco de sensação sob latência | só interpolar a bola (timing injogável acima de ~60 ms) |
| D-11 | Treino e partida contra bot rodam **localmente** com o mesmo `shared/sim`, com o bot rotulado BOT | custo zero de servidor e funciona offline. **Não conta como teste de multiplayer** | bot no servidor desde o início |
| D-12 | **Lado local sempre à esquerda** na tela, espelhando só a apresentação | "frente" = direita para todo mundo; aprendizado mais rápido | tela fixa com lado A à esquerda |
| D-13 | Cliente e assets em **Cloudflare Pages** (conta já usada no repositório); servidor Node **persistente** em região de São Paulo | CDN pronta; processo contínuo perto dos jogadores | simulação em funções HTTP efêmeras (proibido) |
| D-14 | Convidado sem conta no MVP; banco só com progressão persistente | acesso rápido | login obrigatório |
| D-15 | Contato sem aleatoriedade: erro de timing vira desvio **determinístico** e legível (cedo = curta, tarde = longa) | justo, aprendível e reproduzível | dispersão aleatória |

### 2.2 Versões (consultadas no npm em 2026-09-28; fixar exatas no B0 após o *smoke test*)

| Pacote | Versão | Observação |
|---|---|---|
| `three` / `@types/three` | 0.186.1 / 0.186.x | mesma do `abduziu/` |
| `@dimforge/rapier3d-deterministic-compat` | 0.21.0 | a variante `-compat` embute o WASM (facilita Vite e Node) |
| `colyseus` (servidor) | 0.18.8 | exige **Node ≥ 22** (ambiente atual: 22.22) |
| `@colyseus/sdk` (cliente) | 0.18.4 | depende de `@colyseus/schema` ^5 |
| `@colyseus/schema` | 5.0.x | alinhar com o que o servidor resolver |
| `@colyseus/testing` | 0.18.6 | testes de sala |
| `vite` / `vitest` | 8.3.1 / 5.0.2 | mesmas do `abduziu/` |
| `typescript` | 7.0.2 | **verificar decorators do `@colyseus/schema` com o TS 7 no B0**; se falhar, usar a definição de schema sem decorators ou fixar TS 5.x no servidor |

Regra: versões exatas (sem `^`), `package-lock.json` versionado, nenhum trecho copiado de tutorial de outra versão. Toda API usada é conferida na documentação da versão fixada.

### 2.3 Premissas

- **Equipe de referência** para as estimativas: 2 engenheiros, 1 artista 3D/animador, 1 designer UX/UI em meio período, áudio terceirizado. Com menos gente, as faixas aumentam na proporção.
- **Dispositivos declarados (hipótese, a confirmar no Marco B com aparelhos reais):**
  - Desktop intermediário: notebook com GPU integrada da classe Intel Iris Xe / Radeon Vega, 16 GB, tela 1080p.
  - Android intermediário: SoC classe Snapdragon 7xx, 6–8 GB.
  - iPhone classe 12/13.
- **Rede de teste para "treino em 8 s":** 10 Mbps de download, 2 Mbps de upload, RTT de 60 ms, cache frio (perfil customizado no DevTools).
- **Região:** jogadores no Brasil, principalmente Sudeste, com servidor em São Paulo.

---

## 3. Regras, controles e ciclo de partida

### 3.1 Quadra e unidades (hipóteses de ajuste)

| Parâmetro | 1v1 | 2v2 |
|---|---|---|
| Meia-quadra (rede → linha de fundo) | 6,5 m | 8,0 m |
| Zona livre além do fundo | 3,0 m | 3,0 m |
| Altura do topo da rede | 2,20 m | 2,20 m |
| Rede | parede sólida do chão ao topo, com a borda superior arredondada | igual |

- A rede fica em `x = 0`. A equipe A ocupa `x < 0` e a B, `x > 0` (canônico no servidor; na tela, cada cliente vê o próprio lado à esquerda).
- **Linha é dentro:** a bola toca o chão com `|x| ≤ meiaQuadra + raioDaBola` → dentro.
- Jogadores se movem de `|x| = 0,30 m` (não encostam na rede) até `meiaQuadra + zona livre`. Podem jogar a bola fora das linhas.

### 3.2 Regras do protótipo (ambiguidades resolvidas)

| Situação | Regra | Resultado |
|---|---|---|
| Contatos | até 3 por equipe por posse; zeram quando a bola cruza para o outro lado | 4º contato → ponto do adversário |
| 1v1 | o mesmo jogador pode fazer os 3 contatos | |
| 2v2 | 3 contatos compartilhados; o mesmo jogador não pode tocar duas vezes seguidas | toque duplo → ponto do adversário |
| Bola no chão dentro | ponto para quem **não** é dono daquele lado | |
| Bola fora | ponto contra a **equipe que tocou por último** (saque conta como toque). Rede não conta como toque | |
| Saída pela zona livre | bola com `|x| > meiaQuadra + zona livre` → fora imediato | mesma regra de fora |
| Bola na rede | continua em jogo; não zera nem soma contatos | |
| Passagem válida | a bola troca de lado quando o centro cruza `x = 0` acima do topo da rede. Por baixo é impossível (a rede é sólida) | contagem da nova equipe começa em 0 |
| Tocar a bola do outro lado | proibido por construção: o contato só existe se a bola está no lado da equipe. Com `x = 0` exato, vale o lado de onde ela veio | sem bloqueio no MVP |
| Contatos simultâneos | no máximo **1 contato por tick**. Desempate: melhor qualidade de contato, depois menor índice de vaga. Entre equipes é impossível pela regra do lado | determinístico |
| Bola presa | velocidade < 0,2 m/s por 60 ticks sem tocar o chão (ex.: equilibrada na rede), ou rally > 60 s (salvaguarda) | **rally anulado**, mesmo sacador |
| Jogadores | ficam no próprio lado, sem colisão entre avatares, sem falta por tocar a rede (o corpo não alcança) | |
| Saque | quem venceu o ponto saca. Após a preparação, 5 s para apertar Toque ou Ataque; senão o servidor saca automático (neutro, seguro) | |
| Saque válido | precisa cruzar direto. Pode tocar a rede e passar | |
| Saque inválido | não cruza (cai do próprio lado), cai fora ou é tocado por colega antes de cruzar | ponto do adversário |
| 1º saque da partida | "chinelo ao alto": sorteio com a semente do servidor, mostrado na tela | |
| Rodízio no 2v2 | a equipe mantém o sacador enquanto pontua; ao recuperar o saque, saca o outro parceiro | |
| Placar | até 7, diferença de 2, teto 11. Em 10×10 o próximo ponto encerra. Vence quem tem (≥ 7 e +2) ou 11 | |
| Acrobacias | sem ponto extra no modo competitivo | |
| Abandono | ver §7.9 (pausa de 15 s; depois, W.O.) | |
| Confirmação de ponto | chão, fora e falta viram "ponto pendente" por **6 ticks** e só então se confirmam (ver §7.6, contato atrasado). O efeito de areia sai na hora; o anúncio "PONTO" sai depois | |

### 3.3 Máquina de estados da partida (100% no servidor)

```
            ┌─────────────┐  2 (ou 4) vagas ocupadas e todos "pronto"
            │ SALA_ABERTA │──────────────────────────────┐
            └─────▲───────┘                              ▼
                  │ alguém sai                    ┌───────────┐ 3 s
                  └───────────────────────────────│ CONTAGEM  │──────┐
                                                  └───────────┘      ▼
   ┌───────────────────────────────────────────────────────► ┌──────────────────┐
   │                                                         │ PREPARACAO_SAQUE │ 1,2 s, inputs ignorados,
   │                                                         └────────┬─────────┘ posições resetadas
   │                                                                  ▼
   │                                                         ┌──────────────────┐ recebedores se movem;
   │                                                         │  SAQUE_ARMADO    │ sacador parado; 5 s
   │                                                         └────────┬─────────┘ (auto-saque no fim)
   │                                                                  ▼ contato de saque
   │                                                         ┌──────────────────┐
   │                                                         │      RALLY       │
   │                                                         └────────┬─────────┘
   │                                         falta/chão/fora (após 6 ticks pendente) │ bola presa
   │                                                                  ▼                     │
   │   não acabou   ┌──────────────┐                        ┌──────────────────┐            │
   └────────────────│ PONTO (1,5 s)│◄───────────────────────│ PONTO_PENDENTE   │            │
                    └──────┬───────┘                        └──────────────────┘            │
                           │ acabou                                                          │
                           ▼                  RALLY_ANULADO (1 s) ───► PREPARACAO_SAQUE ◄───┘
                    ┌──────────────┐
                    │ FIM_PARTIDA  │──► RESULTADO ──► REVANCHE (votos, 30 s) ──► CONTAGEM
                    └──────────────┘                         └── sem acordo ──► SALA_ABERTA

 Qualquer estado de jogo ──(queda de conexão)──► PAUSA_CONEXAO (até 15 s)
      ├─ voltou    ──► RETOMADA (3 s) ──► PREPARACAO_SAQUE (rally em curso anulado)
      └─ não voltou ──► FIM_PARTIDA (W.O.)
```

| Estado | Entra quando | Durante | Sai quando | Quem decide |
|---|---|---|---|---|
| SALA_ABERTA | sala criada | entradas, apelidos, "pronto" | vagas cheias + todos prontos | servidor |
| CONTAGEM | todos prontos | 3 s; cancela se alguém desmarcar | tempo | servidor |
| PREPARACAO_SAQUE | início, ponto ou anulação | posições padrão, inputs ignorados | 72 ticks | servidor |
| SAQUE_ARMADO | fim da preparação | sacador parado; timer de 300 ticks | Toque/Ataque do sacador, ou timeout (auto) | servidor |
| RALLY | contato de saque | simulação completa | falta detectada, ou bola presa | servidor |
| PONTO_PENDENTE | falta detectada | 6 ticks aceitando contato atrasado válido | tempo ou contato retroativo válido (volta ao RALLY) | servidor |
| PONTO | pendência confirmada | placar atualizado, comemoração 90 ticks | tempo; testa o fim de partida | servidor |
| RALLY_ANULADO | bola presa ou reconexão | 60 ticks | tempo | servidor |
| PAUSA_CONEXAO | cliente cai | relógio de jogo parado; contador de 15 s | volta ou expira | servidor |
| FIM_PARTIDA / RESULTADO | vitória ou W.O. | estatísticas | votos de revanche / saída | servidor |

O cliente só **pede**: `ready`, `unready`, `rematchVote`, `leave`. E só envia inputs. Nunca envia transições.

### 3.4 Controles

| Ação | Teclado (padrão) | Alternativo | Controle (layout Xbox) | Touch |
|---|---|---|---|---|
| Mover | A / D | ← / → | analógico esquerdo / D-pad | slider horizontal ou dois botões ◀ ▶ (lado esquerdo) |
| Pular | Espaço | W / ↑ | A | botão grande (direita, embaixo) |
| Toque / levantamento | J | Z | X | botão (direita, meio) |
| Ataque | K | X | B ou Y | botão (direita, cima) |
| Menu / pausa local | Esc | | Start | ícone no topo |

- **Direção no momento do botão = intenção.** "Frente" = rumo à rede (sempre a direita da tela, graças à D-12). "Trás" = para longe. Sem direção = neutro.
- Remapeamento de teclado e controle desde o Marco C, salvo localmente.
- O input vira um **campo de bits por tick**: `ESQ | DIR | PULO | TOQUE | ATAQUE` (+ flags de "pressionado neste tick"). Nada de força, ângulo ou posição.

### 3.5 Ações e janelas (ticks a 60 Hz; hipótese inicial)

| Ação | Preparação | Contato ativo | Recuperação (acertou) | Recuperação (vazio) | Nota |
|---|---|---|---|---|---|
| Toque no chão (J) | 3 (50 ms) | 7 (117 ms) | 10 | 16 | a ação mais tolerante |
| Toque no ar (J) | 2 | 6 | até pousar + 4 | até pousar + 8 | |
| Ataque no chão (K) | 6 (100 ms) | 4 (67 ms) | 16 | 24 | chute; arco mais alto |
| Ataque no ar (K) | 5 | 4 | até pousar + 8 | até pousar + 12 | voleio/cabeçada; mais rápido |
| Saque (K ou J) | 12 | 1 | 20 | n/a | bola apoiada num montinho de areia |
| Pulo | 2 (agachamento) | n/a | pouso: 3 | | *buffer* de pulo de 4 ticks |
| Finta, Marco C (K → J nos ticks 1–4 da preparação) | | vira toque curto | +4 | | o "migué" |

- **Buffer de ação:** 6 ticks. Apertar um pouco antes de a bola entrar no alcance ainda vale, se o ativo cobrir a chegada.
- Cada ação produz **no máximo um contato**. Não dá para cancelar uma ação andando. Pular cancela a preparação do toque no chão.

### 3.6 Contato contextual: qual parte do corpo

O volume de contato é fixo e relativo aos pés (+x = rumo à rede): de **−0,45 m a +0,85 m** na horizontal e de **0 a 2,05 m** na vertical (acompanha o corpo no pulo), mais a **tolerância fixa `CONTACT_GRACE = 0,12 m`**. A parte do corpo é só o rótulo, e muda um pouco a trajetória:

| Altura da bola (h) | Toque (J) | Ataque (K) | Modificador |
|---|---|---|---|
| < 0,55 m | peito do pé | chute | chute: arco mais alto e mais lento |
| 0,55–1,05 m | coxa | voleio de pé | coxa: +1 tick na janela "perfeito" (mais controle) |
| 1,05–1,55 m | peito | voleio alto | peito: levantamento 0,4 m mais baixo (amortece) |
| > 1,55 m (ou acima do ombro no ar) | cabeça | cabeçada | cabeça: mais rápida, janela perfeita −1 tick |
| no ar, bola acima da cabeça, "trás" segurado (Marco D) | n/a | **bicicleta** | acrobacia característica: ataque veloz de costas |

### 3.7 Trajetórias, qualidade e risco

O resultado do contato é **velocidade definida por solução balística** até um alvo. Não é impulso somado.

- **Toque (J), 1º ou 2º contato:** levanta no próprio lado até o ápice de ~3,2 m. Neutro = sobe para você mesmo (+0,6 m rumo à rede); frente = adiantado, perto da rede (prepara ataque); trás = recua (ganha tempo). **No 3º contato**, o J vira "toque de passagem": um lob seguro por cima da rede (neutro = meio, frente = fundo, trás = curtinha).
- **Ataque (K):** sempre tenta passar. A direção escolhe a profundidade no lado adversário (trás = curta, neutro = meia, frente = funda). A velocidade horizontal vai de 9–12 m/s (chute baixo) a 14–20 m/s (contato alto no pulo). Atacar no 1º contato é permitido e arriscado ("De primeira!").
- **Qualidade:** a distância da bola ao ponto ideal da parte do corpo no tick do contato define a nota: **perfeito** < 0,25 m, **bom** < 0,50 m, **ok** até o limite do volume. A bola rápida chegando (> 14 m/s) encolhe a janela "perfeito".
- **Erro legível e sem sorte:** fora do "perfeito", o alvo desloca `0,35 m × (erro normalizado)`. Contato cedo (bola ainda chegando) → curta, podendo pegar na rede. Tarde (bola já passando) → longa, podendo sair. O ataque forte de longe da rede tem menos margem sobre a rede e sobre o fundo. **É aí que mora o risco.**
- Velocidade vertical do contato limitada a 11 m/s (ápice máximo de ~7 m).

### 3.8 Assistência e tolerância (limitadas e constantes)

- A assistência de direção só ajusta o **alvo** em até ±0,5 m rumo ao "ponto bom" (ex.: o levantamento procura o ponto de ataque ideal). **Nunca move o jogador nem estica o alcance.**
- `CONTACT_GRACE` é constante do `shared/params`. Não depende de FPS, preset gráfico, dispositivo nem latência.
- **Sem marcador de onde a bola vai cair no competitivo.** A leitura é pela sombra. Treino e tutorial podem ligar o marcador.

### 3.9 Câmera

- Perspectiva com FOV estreito (~30°) e bem afastada. Quase ortográfica, mas mantém a sensação de volume 3D.
- Enquadra sempre a quadra inteira, a rede e as zonas livres. Segue a bola de leve na horizontal (±1 m) e sobe quando ela vai alta. Acima do limite, aparece um indicador de borda com a altura.
- **Sem cortes durante o rally.** Zoom suave só na preparação do saque e na comemoração.
- *Shake* ≤ 0,08 m e ≤ 120 ms, só em ataque forte e ponto. Desliga no modo "reduzir tremor".
- Enquadramento em 16:9; telas mais largas (19,5:9) mostram mais cenário lateral e telas 4:3 mostram mais céu. A quadra nunca é cortada.

### 3.10 Parâmetros iniciais centralizados (`shared/params.ts`)

| Grupo | Parâmetro | Valor inicial | Faixa de ajuste |
|---|---|---|---|
| Mundo | `TICK_HZ` | 60 | fixo |
| Bola | gravidade | 11 m/s² | 9–14 |
| Bola | raio | 0,12 m | 0,11–0,15 |
| Bola | velocidade máxima | 22 m/s | 18–26 |
| Bola | amortecimento linear | 0,05 | 0–0,15 |
| Bola | restituição na rede / no chão | 0,25 / 0,40 (só visual após o ponto) | |
| Jogador | corrida | 5,5 m/s | 4,5–6,5 |
| Jogador | aceleração chão / ar | 45 / 20 m/s² | |
| Jogador | velocidade do pulo / gravidade própria | 7,0 m/s / 22 m/s² (ápice ~1,1 m, ~38 ticks no ar) | |
| Contato | alcance, tolerância, janelas | §3.5–3.6 | |
| Partida | preparação / saque / ponto | 72 / 300 / 90 ticks | |

---

## 4. Direção de arte, animação e áudio

### 4.1 Direção: "toon de orla"

Estilizado, gráfico e quente. Formas grandes e silhuetas legíveis a 100 px de altura. Sombreamento em 2–3 tons (toon ramp), contorno fino por geometria nos personagens e na bola, e cores chapadas com gradientes pintados só no céu. Proporção heroica estilizada (~6,5 cabeças) com **pés grandes e expressivos**, porque no futevôlei o pé é a mão. Movimento com antecipação clara (preparação exagerada, contato seco, *follow-through* longo).

**Hierarquia de leitura (sempre, em qualquer preset):** bola > sombra da bola > jogadores > rede e linhas > cenário.

### 4.2 Paleta

| Papel | Cor | Hex |
|---|---|---|
| Areia clara / sombra | | `#F2D29B` / `#C9955A` |
| Mar / sombra fria | | `#1FA6A0` / `#0E6E78` |
| Céu de tarde (gradiente) | | `#FFD9A0` → `#FF9A6B` → `#8C6BB1` |
| **Bola** (base / gomos / contorno) | máxima leitura | `#FFF6E0` / `#1B2A6B` / `#10122B` |
| Sombra da bola (sempre ativa) | | `#6B3F1F` a 65% |
| **Equipe Maré** + símbolo ▲ | | `#2D7FF9` |
| **Equipe Brasa** + símbolo ● | | `#FF5A36` |
| UI base / texto claro | | `#14163A` / `#FFF8EC` |
| Destaque, "perfeito" | | `#FFD23F` |
| Sucesso / alerta / erro | | `#2EC27E` / `#FFB020` / `#E5484D` |

Azul × laranja se distingue na maioria dos tipos de daltonismo, e ainda assim **toda informação de equipe leva símbolo** (▲ ●) e posição.

### 4.3 Tipografia

- **Logo:** letreiro desenhado à mão, inspirado nos abridores de letras e nas placas pintadas brasileiras. É asset autoral, não fonte.
- **Placar, HUD e callouts:** *Barlow Condensed* (OFL), com pesos Bold/Black Italic e números tabulares. Já é usada no repositório.
- **Texto de interface:** *Barlow* (OFL), com boa cobertura de acentos.
- Subconjunto latin + latin-ext em woff2, auto-hospedado (~100 KB no total).

### 4.4 Materiais e iluminação

- Personagens: `MeshToonMaterial` com rampa de 3 tons, 1 material por personagem (atlas) e contorno por *inverted hull*.
- Cenário: cores por vértice com AO assado + atlas pintado. Mar com textura rolando por UV (sem shader customizado).
- Luz: 1 direcional (sol de tarde, levemente lateral, para dar *rim light*) + hemisférica.
  - **Alto:** sombra em tempo real só de jogadores e bola, com *frustum* justo na quadra.
  - **Baixo:** sombras em blob.
  - **A sombra da bola é blob em todos os presets:** é indicador de jogo, não enfeite.
- Pegadas na areia como decalques num *ring buffer* de 64.

### 4.5 Linguagem de efeitos

| Momento | Visual | Duração | Regra |
|---|---|---|---|
| Toque | estalo em estrela 2D + poeira leve | 150 ms | nunca cobre a bola (desenhado atrás dela) |
| Perfeito | anel amarelo + faísca + som extra | 200 ms | |
| Ataque | rastro grosso na cor da equipe (com padrão ▲/●) + linhas de velocidade | enquanto > 14 m/s | |
| Rede | ondulação da malha + fiapos | 300 ms | |
| Chão / ponto | estouro de areia + reação da torcida | 400 ms | *shake* opcional |
| Pouso | anel de areia pequeno | 150 ms | |
| Congelamento de impacto | só a pose do atacante segura 3 frames. **A bola e o relógio nunca param** | 50 ms | desliga com "reduzir efeitos" |

### 4.6 Arena 1: "Orla do Posto 7½" (praia urbana fictícia, Sudeste)

A câmera olha do mar para a cidade.

- **Primeiro plano (baixo, desfocado):** espuma de onda na borda e um balde de areia. Nada que tampe a bola.
- **Quadra:** areia com pegadas, rede com fita azul e branca, e cantos marcados com **chinelos** (piada visual recorrente).
- **Meio:** guarda-sóis, cadeiras de praia listradas, caixa térmica, bicicletas encostadas e o **quiosque "Coco & Cia"**, com placas pintadas ("Mate gelado", "Aluga-se cadeira", "Açaí na tigela").
- **Torcida:** no calçadão (piso de ondas com padrão **original**), em cartões animados, com o **cachorro caramelo** que abana o rabo nos pontos e às vezes late.
- **Fundo:** prédios da orla, morro em silhueta e céu de tarde.
- **Som:** mar, gente conversando, ambulante ao longe e caixinha de som tocando a trilha original.

Tudo dentro de um único contexto regional: nada de coqueiral nordestino, coreto ou símbolos de outras regiões aqui.

### 4.7 Catálogo de expansões (Marco F)

| Arena | Arquitetura | Vegetação | Som | Objetos e humor |
|---|---|---|---|---|
| **Areião do Bairro** (periferia urbana, Sudeste) | muro grafitado, lajes, caixas-d'água azuis, varal | mangueira solitária | moto passando, som automotivo distante (trilha original), crianças | chinelo-trave, geladinho/sacolé, vizinho na laje de torcida |
| **Orla Nordestina** (fictícia) | barracas de palha, falésias coloridas, jangadas na areia | coqueiros, vegetação de restinga | zabumba, triângulo e sanfona sintetizada; vento forte | queijo coalho na brasa (fumaça), rede de descanso, chapéu de palha |
| **Praça do Interior** | coreto, igreja matriz ao fundo, calçamento de pedra | ipê-amarelo, palmeiras imperiais | sino, cigarras, caixa de som no poste anunciando o torneio | pipoqueiro, bandeirinhas (variante de festa junina), banco com o casal de idosos torcendo |

### 4.8 Elenco: 4 conceitos, 2 no MVP

| Personagem | Visual | Corpo | Personalidade | Assinatura (futuro) | MVP? |
|---|---|---|---|---|---|
| **Duda "Maré" Nascimento** | pele marrom-escura, tranças nagô longas num rabo alto (balançam com física secundária), top azul-petróleo, bermuda de lycra, tornozeleira | alta, atlética | calma, lê o jogo, fala pouco | voleio de cobertura | **sim** (Maré ▲) |
| **Juninho "Brasa" Pereira** | pele parda, cabelo platinado curto com risco na sobrancelha, bermuda laranja com estampa de chamas | baixo e forte | *showman*, provoca, comemora demais | **bicicleta** | **sim** (Brasa ●) |
| **Dona Cida "Coqueiro"** | pele clara bronzeada, cabelo grisalho curto, viseira, óculos na cabeça | corpo cheio, 50+ | veterana da orla, humor seco | "chapéu" (lob preciso) | não |
| **Kauê "Sereno"** | pele marrom, *black power* volumoso, regata amarela aberta | magro, longilíneo | relaxado, zoeiro | peixinho de cabeça | não |

No MVP os dois têm os mesmos atributos, mas silhuetas opostas: alta com tranças × baixo com cabelo claro, e azul × laranja. As cores de equipe vêm do uniforme, então qualquer personagem pode jogar em qualquer equipe.

### 4.9 Microtexto

| Momento | Texto |
|---|---|
| Contato perfeito | "Boa!", "No capricho!" |
| Ataque no 1º contato | "De primeira!" |
| Rally longo / ataque bonito | "Essa foi bonita!", "Que isso!" |
| Rede | "Na rede! Segue o jogo." |
| Faltas | "Quatro toques!", "Toque duplo!", "Pra fora!", "Caiu!", "Saque não passou!" |
| Saque | "Sua vez de sacar", "Saque automático" |
| Ponto de partida | "PONTO DE PARTIDA" |
| Sala | "Chama a galera: manda o link.", "Tô pronto!", "Esperando o parça…" |
| Desconexão | "Conexão caiu. Voltando… 12s", "Brasa caiu. Esperando 12s — se não voltar, vitória por W.O." |
| Erros | "Código não encontrado. Confere aí?", "Sala cheia. Cria outra?", "Tem versão nova do jogo. Recarregar" |
| Resultado | "Ganhou na ginga!", "Perdeu, mas foi bonito.", "Revanche?", "Bora de novo?" |

**Regra de repetição:** no máximo 1 callout de voz por rally, exceto no ponto de partida. Frequência ajustável (normal / pouco / nunca).

### 4.10 Animação

**Autoridade:** a simulação move a raiz. **Não há *root motion*.** Os clipes são autorados no lugar e a malha animada nunca decide contato.

| Grupo | Clipes (MVP) |
|---|---|
| Base | idle (2 variações), ginga parada (balanço ritmado no idle), corrida, frenagem, virada |
| Ar | agachamento de pulo, subida, ápice, queda, pouso leve, pouso pesado |
| Toque | pé, coxa, peito, cabeça (chão e ar) |
| Ataque | chute, voleio de pé, voleio alto, cabeçada, ataque aéreo; bicicleta (Marco D polido) |
| Saque | posicionar a bola, chute de saque |
| Recuperação e emoção | recuperação curta, erro (vazio), comemoração ×2, frustração, espera (bocejo) |

- **Blending:** *crossfade* de 4–8 frames entre locomoções. Preparação → contato sem *blend* (corte seco dá impacto). Camada de tronco superior aditiva para o "olhar a bola".
- **Procedural (só visual):** cabeça e pescoço olhando a bola (com limite angular), torção leve do tronco na direção do alvo, pés planos na areia via IK de dois ossos no pouso e no idle, e física secundária nas tranças e na roupa.
- **Sincronia pose × impacto:** cada clipe de ação tem um marcador `contact` no frame do contato. O animador faz *time-warp* do clipe para o marcador cair no tick de contato da simulação. No contato, um IK de acabamento aproxima o pé ou a cabeça da **posição real da bola** (no máximo 0,25 m). A bola nunca é movida para encontrar o corpo.
- **Acrobacia:** a bicicleta entra no Marco D, depois de os movimentos básicos passarem nos playtests.

### 4.11 Pipeline de assets

```
conceito (2D) → blockout 3D → modelagem low-poly → UV + atlas pintado
  → rig (esqueleto único para o elenco, ≤ 70 ossos) → animação no Blender
  → export glTF 2.0 (.glb): personagem sem animações + pacote de animações compartilhado
  → gltf-transform: dedup, weld, compressão de geometria (meshopt), texturas KTX2 (Basis: ETC1S para cor, UASTC se houver normal map)
  → validação: glTF-Validator + script próprio (triângulos, ossos, nomes de clipe, marcadores `contact`, escala em metros, orientação +Z/+Y)
  → cena de inspeção no cliente (/?viewer) antes de entrar no jogo
```

- **Aquisição:** personagens, animações, arena, logo, trilha e voz são **autorais** ou contratados com cessão de direitos. Ferramentas generativas, se usadas, só para exploração interna de conceito, com revisão de direitos antes de qualquer asset final. Rigs automáticos de terceiros só no protótipo, conferindo a licença.
- **Dá para prototipar por código (Marcos B–C):** cápsulas com "nariz" de direção e cor de equipe, *squash and stretch* procedural, bola e sombra, rede, quadra em *graybox*, partículas por sprite gerado, HUD inteiro e sons sintetizados em WebAudio.
- **Exige modelagem e animação dedicadas (Marco D):** os dois personagens, rig, ~30 clipes, a arena com props, torcida em cartões, logo, trilha com *stems*, pacote de SFX e voz.

### 4.12 Áudio

- **Trilha original:** percussão brasileira (surdo, caixa, repique, pandeiro, agogô) + eletrônico (sub-grave, synth). É adaptativa:
  - camada 1 no saque;
  - camada 2 a partir do 3º cruzamento do rally;
  - camada 3 no ponto de partida;
  - vinhetas de vitória e derrota.
- **SFX por parte do corpo:**
  - pé: "tum" seco;
  - coxa: abafado;
  - peito: "pof";
  - cabeça: "toc";
  - ataque: *whoosh* + estalo, com intensidade pela velocidade;
  - rede: "tchhh";
  - chão: areia + reação da torcida.
- 3–5 variações por som + *pitch* levemente aleatório (aleatoriedade só na apresentação).
- **Direção e intensidade:** *pan* estéreo pela posição x (espelhado junto com a tela), volume e brilho pela velocidade da bola, e o "perfeito" ganha uma camada extra distinta.
- **Contra cansaço:** torcida com murmúrio contínuo e *swell* só em rallies longos, cachorro late no máximo 1× a cada 3 pontos, e callouts limitados (§4.9).
- **Volumes independentes:** geral, música, efeitos, voz, ambiente.
- Formato AAC (.m4a) para compatibilidade com Safari.

---

## 5. Fluxos de UX e composição do HUD

### 5.1 Fluxo principal

```
abrir link ─► [Início] apelido ─► Jogar online ─► Criar sala ─► [Sala] copiar link / código
                  │                     └──────► Entrar por código ─┘        │
                  ├─► Treino (tutorial) ─► Treino livre                     confirmar presença
                  └─► Contra bot (BOT)                                        │
                                                                    [Partida] ─► [Resultado] ─► Revanche ─► [Partida]
                                                                         └─ queda ─► [Reconexão]
```

Um convite (`/?sala=K7QF`) cai direto na sala depois de o jogador escolher o apelido. **Nada exige recarregar a página.**

### 5.2 Telas

| Tela | Conteúdo | Ações | Estados e erros |
|---|---|---|---|
| **Carregamento** | logo, barra de bytes reais, dica rotativa | n/a | falha de download → "Tentar de novo" |
| **Início** | logo, campo de apelido (lembrado), 3 botões grandes, configurações | Jogar online, Treino, Contra bot | servidor fora → online desabilitado com aviso, treino segue funcionando |
| **Treino** | tutorial em 5 passos (~90 s, pulável): mover/pular → toque para si → levantar e atacar → receber saque → partida curta até 3 contra bot lento | pular passo, repetir | n/a |
| **Sala** | código grande (sem O/0/I/1), botão copiar link, compartilhar (Web Share no celular), vagas com avatar, apelido, ▲/● e ping | Pronto/Desmarcar, trocar personagem, sair | carregando; sala cheia; código inválido; ninguém chegou em 2 min ("Manda o link de novo?" + treinar enquanto espera); versão incompatível |
| **Partida** | HUD (§5.3) | pausa local (menu não pausa o jogo online) | aviso de conexão ruim |
| **Reconexão** | *overlay* sobre o jogo congelado, contador de 15 s, quem caiu | sair | voltou → contagem de 3 s; expirou → resultado W.O. |
| **Resultado** | placar final, vencedor, estatísticas (perfeitos, ataques certeiros, maior rally, "De primeira!") | Revanche (votos 1/2), Chamar outro, Sair | adversário saiu → "Chamar outro" |

### 5.3 HUD

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ⏸                 ▲ DUDA  5  ◆  4  JUNINHO ●                  ▂▄▆ 48ms │
│                   ●●○ (toques)     ○○○                                    │
│                         PONTO DE PARTIDA                                  │
│                                                                           │
│            [área de jogo livre: nenhum elemento fixo aqui]               │
│                                                                           │
│   (Você) ◯5s ← anel do saque em volta do nome no mundo                  │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Prioridade:** placar e equipes (topo central, com ▲/● e o ícone de bola marcando quem saca) → contatos disponíveis (3 bolinhas sob cada equipe; a última fica em alerta amarelo e o "3º" aparece na sombra da bola) → conexão (barras + ms; amarelo > 120 ms, vermelho > 200 ms ou perda).
- Callouts no terço superior, **nunca sobre a trajetória da bola**.
- Nome flutuante só do jogador local ("Você") e dos parceiros no 2v2.
- O HUD é DOM sobre o canvas e só atualiza quando o *store* muda (não a cada frame).

### 5.4 Touch (testado desde o Marco B)

- Lado esquerdo: slider horizontal flutuante (padrão) ou dois botões ◀ ▶.
- Lado direito: Pular (maior, embaixo), Toque, Ataque.
- Ajustes: tamanho (80–140%), opacidade, modo de edição de posição (arrastar botões) e espelhar para canhotos.
- Área mínima de toque de 56 px, feedback visual e háptico (`vibrate`, onde houver).
- Tela cheia + aviso "gire o celular" no retrato.

### 5.5 Acessibilidade

- Símbolos além de cor, sempre.
- Reduzir tremor (sem *shake* nem *zoom punch*) e reduzir efeitos (partículas mínimas, sem *flash*).
- Bola de alto contraste (contorno grosso).
- Tamanho de texto.
- Menus navegáveis por teclado e controle, com foco visível, ARIA e ordem lógica.
- Legendas nos callouts de voz (o próprio texto).
- Nenhuma informação de jogo depende só de som.

---

## 6. Arquitetura

### 6.1 Monorepo

```
ginga-arena/
  package.json                (workspaces, scripts dev/test/build)
  docs/                       PLANO.md · DECISOES.md · PROGRESSO.md · REGRAS.md (Marco B)
  packages/
    shared/                   @ginga/shared: sem DOM, áudio ou render
      src/params.ts           todos os números de ajuste
      src/protocol.ts         mensagens, códigos de erro, PROTOCOL_VERSION
      src/input.ts            bits, codificação, validação
      src/rules/              máquina de estados, placar, faltas (TS puro)
      src/sim/                World (Rapier), PlayerController, BallController,
                              ContactResolver, trajectory solver, step()
      src/bot/                BotBrain (usa as mesmas ações)
      src/rng.ts              PRNG com semente (inteiros)
    server/                   @ginga/server: Node ≥ 22 + Colyseus 0.18
      src/rooms/MatchRoom.ts  loop 60 Hz, fila de inputs, schema, eventos
      src/lobby/              códigos curtos → salas, convites
      src/metrics/            log por partida, contadores
    client/                   @ginga/client: Vite + Three.js
      src/app/                boot, roteador de telas, settings
      src/input/              teclado, controle, touch → InputFrame
      src/net/                Colyseus SDK, relógio, envio de inputs, buffer de snapshots
      src/game/               predição, reconciliação, linha do tempo da bola, modo local (treino/bot)
      src/render/             cena, câmera, arena, personagens, presets de qualidade
      src/anim/               máquina de animação, procedural, IK
      src/fx/  src/audio/     consumidores de eventos (com dedupe por eventId)
      src/ui/                 telas DOM e HUD
    tools/  (Marco D)         pipeline de assets, simulador de rede, bots de carga
```

### 6.2 Diagrama

```
              ┌──────────────────── packages/shared ────────────────────┐
              │ params · protocol · input · rules · sim (Rapier) · bot  │
              └───────────▲───────────────────────────────▲─────────────┘
                          │ importa                       │ importa
┌──────────────── CLIENTE (navegador) ─────────┐   ┌──── SERVIDOR (Node + Colyseus) ────┐
│ teclado/controle/touch                       │   │ MatchRoom (60 Hz fixo)             │
│      ▼                                       │   │  ┌─ fila de inputs por jogador     │
│ [input] → InputFrame{tick,seq,bits} ─[net]───┼─WS┼─►│  validação / limites / atraso   │
│      │                                  ▲    │   │  ├─ shared/sim.step(inputs)        │
│      ▼                                  │    │   │  ├─ shared/rules (estados/placar)  │
│ [game] predição do próprio avatar       │    │   │  ├─ eventos {id,tick,tipo}         │
│        + linha do tempo da bola  ◄──────┴────┼WS─┤  └─ estado (schema, patch ~20 Hz) │
│        + interpolação dos outros             │   │ lobby/códigos · reconexão 15 s     │
│      ▼                                       │   │ métricas · log de inputs + semente │
│ [apresentação] → [anim] → [render Three.js]  │   └────────────────────────────────────┘
│      └──eventos (dedupe por id)→ [fx] [audio]│
│ [store] → [ui HTML/CSS: menus e HUD]         │
└──────────────────────────────────────────────┘
```

### 6.3 Fronteiras

| Módulo | Faz | Não faz |
|---|---|---|
| `input` | lê dispositivos e produz `InputFrame` por tick | não conhece rede nem simulação |
| `shared/sim` | avança o mundo 1 tick de forma determinística e emite `SimEvent`s | não lê relógio, DOM, áudio nem `Math.random` |
| `shared/rules` | transforma eventos em estados, faltas e placar | não mexe em física |
| `net` | transporta inputs e recebe estado e eventos; sincroniza o relógio | não decide nada de jogo |
| `game` | concilia previsão e servidor; decide **o que mostrar e quando** | não renderiza |
| `render` / `anim` / `fx` / `audio` | apresentação a partir do estado de apresentação | nunca alimentam a simulação |
| `ui` | telas e HUD a partir do *store* | não roda no loop do jogo |

### 6.4 Interfaces principais (esboço)

```ts
// shared/input.ts
export const enum Btn { Left = 1, Right = 2, Jump = 4, Touch = 8, Attack = 16 }
export interface InputFrame { tick: number; seq: number; buttons: number }

// shared/sim
export interface SimEvent { kind: 'contact'|'net'|'cross'|'ground'|'out'|'serve'|'fault'; tick: number; data: unknown }
export interface Simulation {
  step(inputs: ReadonlyMap<SlotId, InputFrame>): SimEvent[]; // 1 tick
  snapshot(): SimSnapshot;       // estado serializável (posições, ações, bola, contagem)
  restore(s: SimSnapshot): void; // para re-simular a bola e o próprio avatar
}

// shared/rules
export interface MatchMachine {
  state: MatchState;             // SALA_ABERTA | CONTAGEM | ... (§3.3)
  onTick(tick: number, ev: SimEvent[]): RuleOutcome[];
  request(slot: SlotId, r: 'ready'|'unready'|'rematch'|'leave'): void;
}

// client/net
export interface NetAdapter {
  join(code: string, opts: JoinOpts): Promise<void>;
  sendInputs(frames: InputFrame[]): void;
  onSnapshot(cb: (s: NetSnapshot) => void): void;
  onEvent(cb: (e: NetEvent) => void): void;   // NetEvent = SimEvent + id
  clock: { serverTickEstimate(): number; rttMs(): number; jitterMs(): number };
}
```

### 6.5 Inicialização

1. `index.html` com CSS crítico e tela de carregamento.
2. Em paralelo: bundle principal, `RAPIER.init()` (WASM) e fontes. Arena e personagens em **baixa resolução** primeiro.
3. Menu interativo assim que o crítico chega. O Treino fica disponível com a arena *low*; texturas altas e áudio chegam depois, com troca progressiva.
4. Online: `join` com `{ protocol, simVersion, nickname, reconnectToken? }` → o servidor valida → estado inicial → sincronização de relógio (5 pings) → pronto.

### 6.6 Ciclo de atualização

**Cliente (cada `requestAnimationFrame`):**
```
acumulador += dt (limitado a 250 ms)
enquanto acumulador ≥ 1/60:
    frame = input.sample(tickLocal)
    net.enviar(frame)                     // online
    predição.step(frame)                  // avatar próprio (+ bola local)
    tickLocal++
net.drenar() → reconciliar avatar, atualizar keyframes da bola, eventos
alpha = acumulador / (1/60)
apresentação.atualizar(alpha, tempoRemoto = servidor - atrasoInterp)
anim → fx → áudio → render
store → HUD (só se mudou)
```

**Servidor (MatchRoom):** intervalo fixo de 60 Hz (`setSimulationInterval` ou o timestep fixo da 0.18, a validar no B0) → consome a fila de inputs do tick → `sim.step` → `rules.onTick` → escreve o schema. O patch sai a cada 50 ms (o *patch rate* padrão do Colyseus é 50 ms; vamos declará-lo explícito). Eventos vão como mensagens com `id`.

### 6.7 Renderer: WebGL2 agora, WebGPU como experimento

- MVP em `WebGLRenderer`, pois WebGL2 é a base de compatibilidade.
- **Experimento no Marco E (1 semana, isolado em branch):** portar a cena para `three/webgpu` + TSL e medir, nos dispositivos declarados:
  - tempo de frame;
  - *draw calls* com *instancing*;
  - tempo de compilação de *shaders*;
  - compatibilidade (Chrome, Edge, Firefox, Safari);
  - linhas de código que mudam.
- **Critério:** adotar só se ganhar ≥ 15% de tempo de frame no celular declarado sem perder navegador, ou se destravar um efeito que o design pedir de verdade. Caso contrário, registrar em `DECISOES.md` e reavaliar em 6 meses.
- Por causa da D-07, o custo de porte fica pequeno: não usamos `ShaderMaterial`, `onBeforeCompile` nem `EffectComposer`. A documentação oficial avisa que eles não funcionam no `WebGPURenderer` e que ele ainda é experimental.

---

## 7. Estratégia de física e multiplayer

### 7.1 Mundo físico (Rapier 3D preso ao plano)

- **Bola:** corpo dinâmico com `setEnabledTranslations(true, true, false)` (z = 0 sempre), rotação só em Z (visual), **CCD ligado**, amortecimento e gravidade de `params`. Depois de cada passo, a velocidade é limitada a `BALL_MAX_SPEED`.
- **Estáticos:** chão; rede como caixa de 0,10 m com borda superior em cápsula (a bola rola na fita); nenhuma parede lateral (sair pela zona livre = fora).
- **Jogadores:** o movimento é **nosso** (1D + pulo, aritmética simples e determinística). No Rapier eles só existem como sensores cinemáticos, com grupos de colisão que **excluem a bola**. Assim a bola nunca recebe impulso de corpo.
- **Spike obrigatório (B0):**
  - z permanece exatamente 0 após 10⁵ ticks;
  - zero atravessamentos da rede em 10.000 lançamentos aleatórios de até 26 m/s;
  - *hash* do `world.takeSnapshot()` idêntico entre Node, Chrome, Firefox e Safari após 3.600 ticks com a mesma sequência.
- **Plano B:** se algo falhar, trocar para `rapier2d` (a API é da mesma família e a interface `Simulation` isola a troca).

### 7.2 Ordem estável do tick (idêntica no cliente e no servidor)

1. Aplicar inputs em ordem de índice de vaga.
2. Mover jogadores e avançar as máquinas de ação (preparação → ativo → recuperação).
3. **Resolver contato:** para cada ação em janela ativa com a bola do lado da equipe, testar a distância entre o **segmento** percorrido pela bola no tick anterior e o volume de contato (+ tolerância). Escolher 1 vencedor (desempate §3.2), definir a velocidade pelo *solver* balístico e marcar a ação como consumida.
4. `world.step()`.
5. Detectar rede, cruzamento, chão, fora e bola presa.
6. `rules.onTick`.
7. Emitir eventos.

### 7.3 Garantias de física

| Problema | Como impedimos |
|---|---|
| Contato duplicado | 1 contato por ação (flag consumida) + recarga de 10 ticks por jogador + 1 contato por tick no mundo + a bola precisa sair do volume antes de um novo contato do mesmo jogador |
| Atravessamento | CCD na bola contra a rede e o chão; velocidade limitada (0,37 m/tick a 22 m/s); contato por varredura de segmento, não por ponto |
| Impulso acidental do corpo | corpos são sensores sem colisão com a bola; bola e corpo só interagem via `ContactResolver` |
| Pose × impacto | o volume de contato é fixo e independente da animação; a animação se ajusta ao tick de contato (time-warp + IK de acabamento, §4.10) |
| Diferença por qualidade gráfica | `params` não tem nada por preset; teste automatizado roda a sim com presets diferentes e compara o *hash* |

### 7.4 Avatares

- **Próprio avatar:** previsão local com os inputs + reconciliação. A cada estado do servidor (último `seq` processado + posição e estado da ação), o cliente volta àquele ponto e **reaplica os inputs pendentes**. Divergência < 5 cm é suavizada em ~100 ms; acima disso, *snap*.
- **Adversários e parceiros:** interpolação entre snapshots com atraso adaptativo de ~2 intervalos de patch (≈ 100 ms) + margem de *jitter*. Extrapolação curta de no máximo 50 ms se faltar snapshot; depois disso, congela.
- **Colyseus 0.18:** a documentação oficial descreve `room.input()`, `defineInput()`, `setFixedTimestep()` e `predict` (reconciliador e `predict.sim` para física), com demo de *air hockey* com disco previsto. **Não assumimos que isso resolve nossa bola.** No B0 validamos se essas APIs servem para o avatar próprio. Se servirem, usamos atrás do `NetAdapter`; se não, a reconciliação é nossa (o código é pequeno).

### 7.5 A bola: duas linhas do tempo (o risco principal)

**O problema.** Se a bola só for interpolada, o jogador a vê ~(RTT/2 + 100 ms) no passado. Quando o input chega ao servidor, a bola real está 150–250 ms à frente, ou seja, de 1,5 a 4 m de erro a 10–16 m/s. O timing fica injogável.

**A ideia.** Entre dois contatos, a bola é 100% previsível: só gravidade, rede e chão; nenhum input a afeta. Então:

1. O servidor manda um **keyframe da bola** a cada contato ou colisão com a rede (tick + posição + velocidade), além do estado normal.
2. O cliente roda uma **simulação só da bola** (mesmos colliders estáticos, mesmo build do Rapier) a partir do último keyframe.
3. **Mistura de tempo pela posição:** quando a bola está perto do jogador local, ela é mostrada no **tempo previsto** (o mesmo tick do próprio avatar), exatamente onde estará quando o input chegar ao servidor. Quando está perto do adversário, é mostrada no **tempo interpolado** dele, alinhada com o pé que vai tocá-la. Na travessia, o tempo de exibição da bola acelera suavemente (até +25%) para alcançar o presente.
4. Contato do adversário chega atrasado: a nova trajetória parte do keyframe e o desvio visual é absorvido em 150–250 ms, **enquanto a bola ainda está longe de você**. Acima de 1,5 m de desvio, *snap* com rastro.
5. **Contato do jogador local:** a animação e o som saem na hora. A bola já segue a trajetória prevista, porque o cliente roda o mesmo `ContactResolver`. O servidor confirma pelo `eventId` casado (tipo + vaga + tick ±2). Se ele **rejeitar**, a bola volta para a trajetória oficial com um efeito de "escapou", e isso é contado como métrica.

**Quando usar o quê:**

| Situação | Técnica |
|---|---|
| Bola em voo sem contatos pendentes | simulação local a partir do keyframe (não precisa de extrapolação) |
| Falta um snapshot (≤ 50 ms) | extrapolação curta do avatar remoto; a bola continua simulada |
| Contato remoto confirmado | re-simulação a partir do keyframe + correção suavizada |
| Contato local | previsão completa (avatar + bola) com confirmação ou rejeição do servidor |
| Rollback do mundo inteiro | **não** no MVP. Só se o experimento E-BOLA mostrar rejeição > 5% a 100 ms |

**Metas do experimento E-BOLA (Marco B):**

| RTT (+ jitter) | Contatos locais rejeitados | Correção visual p95 perto do jogador local | Atraso percebido do próprio toque |
|---|---|---|---|
| 40 ms (±5) | < 1% | < 5 cm | imperceptível (0 ticks) |
| 100 ms (±15) | < 2% | < 15 cm | 0 ticks |
| 180 ms (±30) | < 5% | < 30 cm | 0 ticks; aceitável em playtest |

### 7.6 Inputs: sequência, validação, limites e atrasos

- **Formato:** o cliente manda **a cada tick** (em rajadas de 2 ticks se o FPS cair) `{seq, tick, buttons}`, com os 3 últimos frames repetidos. É barato e cobre perdas e re-envios.
- **Validação no servidor:**
  - `seq` crescente;
  - bits conhecidos;
  - `tick` entre `[tickServidor − 6, tickServidor + 30]`;
  - *token bucket* de 90 frames/s com rajada de 30;
  - mensagem ≤ 64 bytes;
  - 20 violações/min → desconexão com código.
- **Nunca aceito:** posição, velocidade, força, ângulo, pontos, placar ou transição de estado.
- **Adiantamento do cliente:** o cliente simula à frente do servidor em `RTT/2 + margem de jitter + 1 tick`, para os inputs chegarem um pouco antes. O servidor guarda um buffer de 1–3 ticks.
- **Input atrasado:**
  - **movimento:** aplicado no tick atual (o tick antigo é descartado);
  - **ação (J/K):** o servidor tenta o **contato retroativo limitado**, e só se tudo isto valer:
    - atraso ≤ 6 ticks (100 ms);
    - nenhum outro contato entre o tick do input e agora;
    - a bola estava do lado da equipe;
    - não houve ponto confirmado.

    O servidor avalia o contato com a posição do jogador e da bola **daquele tick** (histórico em *ring buffer*) e, se for válido, aplica o contato no tick original e re-simula só a bola até agora (≤ 6 passos). Se o chão foi tocado nesse intervalo, a **pendência de 6 ticks** (§3.2) permite cancelar o ponto.

  Não é compensação de tiro instantâneo: vale só para a bola, com limite duro, pré-condições e medição. Acima do limite, a ação é descartada e o cliente recebe `lateAction` (métrica).

### 7.7 Relógio

- **Tick do servidor = referência.** Ping/pong a cada 1 s (5 na entrada) com `(tickServidor, tempoServidor)`.
- Estimativa de *offset* e RTT pela **mediana** das últimas 8 amostras; *jitter* pelo desvio.
- O cliente corrige a deriva **acelerando ou desacelerando a própria simulação em até ±5%**, nunca pulando ticks. Salto só se o desvio for > 250 ms.

### 7.8 Eventos sem repetição

- Todo evento de servidor tem `id` monotônico por partida + `tick`. O cliente mantém um conjunto dos últimos 256 ids: nenhum som ou efeito toca duas vezes, inclusive após reconexão (o estado inicial traz o último `id`).
- Eventos **previstos** localmente têm id provisório. Quando chega a confirmação, casam com ela; se ela não vier em 2×RTT, são cancelados com *fade*.

### 7.9 Desconexão, reconexão e abandono

- `allowReconnection(client, 15)` no servidor; token de reconexão em `sessionStorage` no cliente. A reconexão é automática (inclusive após recarregar a aba) e recupera vaga, apelido, personagem e equipe.
- **Durante a queda:** estado `PAUSA_CONEXAO`, relógio de jogo parado, *overlay* para todos. O rally em curso é **anulado** (ninguém ganha ponto por queda) e reinicia com o mesmo sacador depois de 3 s de contagem.
- **Limites:** 3 quedas por jogador por partida e 45 s de pausa acumulada. Estourou → abandono.
- **Abandono:**
  - **1v1:** W.O., vitória do adversário, registrada como "por abandono".
  - **2v2 (beta):** W.O. para a equipe adversária. A opção "continuar com BOT, sem valor de resultado" fica para depois da beta.
  - **Sair pelo menu:** abandono imediato, com confirmação.

### 7.10 Compatibilidade de versões

- `PROTOCOL_VERSION` (mensagens) + `SIM_VERSION` (hash de `params` + versão do Rapier + versão das regras) enviados no `join`. **Qualquer diferença = recusa** com código `VERSION_MISMATCH` → tela "Tem versão nova. Recarregar".
- **Deploy:** cliente e servidor juntos. O servidor novo sobe ao lado; o antigo para de aceitar salas novas e **drena** as partidas em curso (máximo de 20 min) antes de desligar.

### 7.11 Determinismo, replay e rollback

Não há rollback do mundo inteiro no MVP. Mesmo assim, garantimos desde o início (é o que torna a re-simulação da bola, os testes e os replays futuros confiáveis):

- a mesma versão do Rapier (build *deterministic*) no cliente e no servidor;
- o mesmo estado inicial e a mesma ordem de inserção de corpos;
- a ordem estável do tick (§7.2);
- PRNG com semente do servidor, sem `Math.random`;
- nenhum `Math.sin`/`cos`/`pow` na simulação: só aritmética básica, ou tabelas e funções próprias (a doc do Rapier alerta que funções transcendentais não são multiplataforma);
- log de inputs + semente por partida no servidor (alguns KB) para reproduzir bugs.

**Teste de CI:** rodar a mesma partida gravada e comparar *hashes* por tick. O determinismo do Rapier **não** garante o do jogo; esse teste é que garante.

### 7.12 Bot

- `BotBrain` lê um **estado observado com atraso** (tempo de reação configurável: fácil 380 ms, médio 250 ms, difícil 160 ms) e produz `InputFrame` pelo mesmo caminho do jogador, com as mesmas janelas, alcance e limites.
- **Erro de leitura:** estimativa do ponto de queda com ruído por nível (PRNG com semente).
- **Comportamento:** posicionar-se → escolher a ação pela altura → mirar pela profundidade livre do adversário.
- Nome sempre com a etiqueta **BOT**. Partidas contra bot não entram em nenhuma métrica de multiplayer.

---

## 8. Backlog por marcos

Estimativas em semanas da equipe de referência (§2.3). Cada tarefa vira uma entrega pequena com verificação.

### Marco A: Definição, 1–2 semanas *(este documento é a primeira entrega)*

- **Objetivo:** fechar conceito, regras, arte, riscos e plano.
- **Dependências:** nenhuma.
- **Tarefas:**
  - validar este plano com a equipe;
  - escrever `REGRAS.md` com diagramas;
  - fazer um *moodboard* e 4 esboços de personagem;
  - prototipar a paleta em uma tela da arena;
  - listar aparelhos de teste reais.
- **Módulos:** `docs/`.
- **Assets:** *moodboard*, esboços, paleta.
- **Riscos:** regra ambígua virar bug.
- **Critérios de conclusão:** as regras respondem a todos os casos da §3.2; a lista de dispositivos está fechada; as decisões D-01..D-15 estão aceitas ou alteradas em `DECISOES.md`.

### Marco B: Protótipo técnico online, 3–5 semanas

- **Objetivo:** duas pessoas, em dois dispositivos e redes diferentes, jogam uma partida completa com cápsulas, bola, contatos e placar decididos pelo servidor. **A latência é medida desde aqui.**
- **Dependências:** Marco A (regras).
- **Assets:** nenhum de arte (tudo por código).

| # | Entrega | Verificação |
|---|---|---|
| B0 | *Spike* de versões: monorepo, pacotes fixados, Rapier deterministic no Node e no browser, Colyseus 0.18 + TS 7 (decorators), avaliação das APIs `input`/`predict` | `npm test` verde; página de *hash* mostra o mesmo valor em 4 navegadores + Node; relatório no `PROGRESSO.md` |
| B1 | `shared`: params, input, sim (bola, rede, chão, jogadores, contato, *solver*), rules (máquina §3.3) | ≥ 40 testes: regras (4º toque, fora, rede, saque inválido, 10×10, teto 11), contatos a 22 m/s sem túnel, determinismo por *hash* |
| B2 | Servidor: `MatchRoom` 60 Hz, sala por código, pronto, inputs validados, patch 20 Hz | testes com `@colyseus/testing`: 2 clientes, input adulterado rejeitado |
| B3 | Cliente: cápsulas, câmera lateral, HUD mínimo, teclado, touch básico, lado local à esquerda | 2 abas jogam uma partida até 7 |
| B4 | Netcode: previsão do avatar, interpolação, bola em duas linhas do tempo, contato previsto/confirmado, contato retroativo limitado | métricas no painel de *debug* (F3) |
| B5 | Laboratório de latência: *proxy* de atraso/jitter/perda (Node) + bots headless; roda E-BOLA a 40/100/180 ms | tabela da §7.5 preenchida no `PROGRESSO.md` |
| B6 | Deploy de *staging*: cliente no Pages, servidor em SP; queda e reconexão (15 s); revanche sem recarregar | checklist da §11 |

- **Riscos:** bola sob latência; APIs 0.18; TS 7 × decorators.
- **Critérios de conclusão:** checklist da §11 completo, com resultados **executados** registrados (não planejados).

### Marco C: Protótipo de diversão, 3–5 semanas

- **Objetivo:** receber, levantar e atacar ficam **gostosos** com cápsulas, e o jogo é aprendível em 2 minutos.
- **Dependências:** Marco B.
- **Tarefas:**
  - ajuste de janelas, alcance, gravidade e *solver*;
  - qualidade de contato e erro legível;
  - finta (experimento);
  - bot de 3 níveis;
  - Treino + tutorial de 5 passos;
  - remapeamento;
  - touch ajustável;
  - efeitos e sons provisórios por código;
  - painel de *tuning* ao vivo (só no *dev*);
  - 3 rodadas de playtest (5–8 pessoas cada, gravadas).
- **Módulos:** `shared/sim`, `shared/bot`, `client/input`, `client/ui`, `client/fx`, `client/audio`.
- **Assets:** sons provisórios sintetizados; ícones do touch.
- **Riscos:** "falta graça" com cápsulas; touch impreciso.
- **Critérios de conclusão:**
  - ≥ 80% dos novatos completam o tutorial em ≤ 3 min;
  - ≥ 70% acertam um ataque que passa a rede na 1ª partida;
  - ≥ 60% pedem revanche espontaneamente;
  - faltas entendidas (acertar o motivo em ≥ 80% dos casos perguntados);
  - partidas contra o bot médio duram 3–6 min.

### Marco D: MVP polido, 8–12 semanas (arte em paralelo desde o fim do B)

- **Objetivo:** a primeira versão pública, com a cara do GINGA ARENA.
- **Dependências:** Marco C (a sensação aprovada congela o volume de contato e as janelas que a animação precisa respeitar).
- **Tarefas:**
  - pipeline de assets (`tools/`);
  - 2 personagens riggados com ~30 clipes;
  - arena Orla do Posto 7½ com presets baixo/médio/alto;
  - máquina de animação + procedural + IK + time-warp de contato;
  - bicicleta;
  - efeitos finais e áudio final (trilha adaptativa, SFX, voz);
  - todas as telas da §5;
  - acessibilidade;
  - carregamento progressivo;
  - otimização até o orçamento da §9.
- **Assets:** tudo da §4.11 "exige dedicado".
- **Riscos:** atraso de assets, orçamento no celular, animação × contato.
- **Critérios de conclusão:**
  - metas de desempenho e download da §9 medidas nos dispositivos declarados;
  - todos os estados de erro da §5.2 demonstráveis;
  - 10 partidas online em redes diferentes com resultado idêntico nos dois clientes;
  - reconexão testada;
  - Chrome, Edge, Firefox e Safari verificados.

### Marco E: Beta multiplayer, 6–10 semanas

- **Objetivo:** 2v2 com quatro humanos, touch refinado, compatibilidade e carga.
- **Dependências:** Marco D.
- **Tarefas:**
  - 2v2 (quadra 8 m, toque duplo, rodízio de saque, desempate de contatos);
  - câmera 2v2;
  - HUD de equipe;
  - vagas e trocas na sala;
  - touch refinado (playtests de celular);
  - experimento WebGPU;
  - teste de carga com bots headless;
  - monitoramento (salas, CPU, RTT médio, rejeições);
  - drenagem de deploy;
  - política de privacidade para dados técnicos.
- **Assets:** variações de uniforme, 2º par de comemorações, ajustes de câmera.
- **Riscos:** confusão visual com 4 corpos; carga.
- **Critérios de conclusão:**
  - 4 humanos em 4 dispositivos concluem 10 partidas 2v2;
  - relatório de carga (máquina, salas, CPU, memória, banda);
  - decisão WebGPU registrada.

### Marco F: Expansão (contínuo; cada arena leva 4–6 semanas de arte)

- **Objetivo:** conteúdo e retenção.
- **Tarefas:**
  - arenas do catálogo;
  - Cida e Kauê;
  - altinha em roda (câmera 3/4, física 3D sem trava, regras cooperativas: 3–6 semanas de protótipo antes de arte);
  - cosméticos;
  - contas (banco);
  - só depois disso: ranking.
- **Critério de entrada:** retenção de revanche e sessões da beta medidas. Nada do F atrasa correções da beta.

---

## 9. Orçamento técnico e hipóteses de custo

### 9.1 Orçamento de desempenho

| Item | Desktop intermediário (alto) | Celular intermediário (baixo) |
|---|---|---|
| FPS alvo | 60 | 30 estável (60 onde der) |
| Triângulos visíveis | ≤ 300 mil | ≤ 100 mil |
| *Draw calls* | ≤ 150 | ≤ 70 |
| Personagem | 15–20 mil tris, 1 material, ≤ 70 ossos | LOD de 8 mil tris |
| Texturas na GPU | ≤ 96 MB | ≤ 48 MB |
| Sombras | 1 direcional, mapa de 2048, só na quadra | blob |
| Partículas ativas | ≤ 2.000 (instanciadas) | ≤ 500 |
| Torcida | ≤ 200 cartões instanciados | ≤ 60 |
| Heap JS | ≤ 150 MB | ≤ 100 MB |
| Resolução | nativa até DPR 2 | adaptativa de 0,6× a 1× por tempo de frame |
| Tempo de simulação por tick (cliente) | ≤ 0,5 ms | ≤ 1,5 ms |

**Qualidade adaptativa:** mede a média de 2 s do tempo de frame e desce resolução → sombras → partículas → torcida. **Nunca** mexe em `params`, na bola, na sombra da bola, nas linhas ou na rede.

### 9.2 Download (meta ~10 MB comprimidos para a experiência inicial)

| Parte | Estimativa (a medir) |
|---|---|
| JS (Three tree-shaken + jogo + SDK) | 0,4–0,7 MB |
| Rapier WASM (compat) | 0,8–1,5 MB |
| Fontes | 0,1 MB |
| 2 personagens + animações compartilhadas | 2,0–3,0 MB |
| Arena (low primeiro, high depois) | 1,0 + 2,0 MB |
| Áudio inicial (SFX + 1 trilha) | 1,5–2,0 MB |
| **Total** | **~8–10 MB** |
| **Crítico para o treino** (JS + WASM + fontes + arena low + personagens low + SFX básico) | **≤ 4,5 MB** → cabe em 8 s na rede de teste (§2.3) |

### 9.3 Rede e servidor (hipóteses a medir no B5/E)

- **Descida:** ~20 patches/s × 60–120 B + eventos ≈ 2–4 KB/s por cliente.
- **Subida:** 60 inputs/s × ~16 B (com redundância e *framing*) ≈ 1–2 KB/s.
- **Por partida 1v1 de 5 min:** ≈ 2–4 MB no total do servidor. Os assets (~10 MB por jogador novo) saem da CDN, não do servidor de jogo.
- **CPU:** 1 sala = 1 mundo Rapier minúsculo. Hipótese < 0,2 ms/tick → centenas de salas por vCPU. Isso **não está comprovado**; o teste de carga do Marco E decide.

### 9.4 Custos (estrutura, não preços)

Preços mudam; o custo é calculado na hora, com a tabela vigente de cada provedor.

| Categoria | Protótipo (B–C) | Beta (E) | Premissas |
|---|---|---|---|
| Hospedagem do servidor | 1 VM ou contêiner pequeno (2 vCPU, 4 GB) em São Paulo, ligado sob demanda | 2 instâncias (redundância e deploy com drenagem) + *uptime monitor* | processo persistente; candidatos com região em SP: AWS sa-east-1, GCP southamerica-east1, Azure Brazil South, Fly.io (gru), Vultr/Oracle SP. Critério: RTT medido de 3 capitais + preço vigente |
| Tráfego do jogo | `partidas × ~3 MB` | idem × volume da beta | medir no B5 |
| CDN (cliente e assets) | Cloudflare Pages (conta já usada no repositório) | idem | `jogadores novos × ~10 MB`, cache alto |
| Armazenamento | logs e replays de partida (KB) | + banco se houver contas (Supabase já é usado no `abduziu/`) | sem banco no MVP |
| Produção de assets (esforço) | ~0 (código) | 2 personagens: modelo e textura 8–15 dias cada; rig 2–4 dias; ~30 clipes 15–25 dias; arena 15–25 dias; logo 3–5 dias; trilha (3 faixas com *stems*), pacote de SFX, voz (2 atores, ~40 falas) | orçar com fornecedores (custo = dias × diária vigente) |

**Fórmula-guia mensal:** `horas_servidor × preço_hora + GB_saída × preço_GB + armazenamento + CDN (geralmente fixo ou gratuito no volume de protótipo)`.

---

## 10. Riscos prioritários e experimentos

| # | Risco | Impacto | Prob. | Experimento | Decide quando |
|---|---|---|---|---|---|
| R1 | Bola compartilhada sob latência (timing, correções, rejeições) | crítico | alta | **E-BOLA** (B4–B5): proxy 40/100/180 ms ± jitter + perda; bots e humanos; mede rejeição, correção p95, atraso percebido e questionário | metas da §7.5 atingidas → segue; senão, rollback do mundo (física já determinística) ou mais tolerância só no servidor |
| R2 | Rapier 3D preso ao plano (z, CCD, determinismo multiplataforma) | alto | média | *spike* B0: 10⁵ ticks, 10.000 lançamentos, hash em 4 navegadores + Node | falhou → `rapier2d` |
| R3 | Falta de graça com poucos botões | crítico | média | Marco C: 3 playtests, métricas de aprendizado e revanche, finta A/B | critérios do Marco C |
| R4 | Colyseus 0.18 / TS 7 (decorators, APIs novas) | médio | média | B0: sala mínima + schema + reconexão | não funcionou → schema sem decorators / TS 5.x no servidor / reconciliação própria |
| R5 | Desempenho e touch no celular | alto | média | touch testado desde o B3; perfil em aparelho real a cada entrega do D | fora do orçamento → corta cenário, não jogo |
| R6 | Produção de assets atrasar | alto | alta | arte começa no fim do B com volumes congelados; placeholders jogáveis sempre | escopo fixo em 2 personagens e 1 arena |
| R7 | Safari/iOS (áudio só após gesto, tela cheia, WASM, memória) | médio | alta | testes em iPhone desde o B3 | lista de contornos no `PROGRESSO.md` |
| R8 | WebSocket (TCP) e perda: *head-of-line blocking* vira "engasgo" | médio | média | medir picos no E-BOLA com perda de 1–3% | alto demais → estudar WebTransport depois da beta |
| R9 | Trapaça (inputs forjados, *speed hack*) | médio | baixa (servidor autoritativo) | testes de input adulterado no B2 | n/a |
| R10 | Crescimento de escopo (loja, ranking, carreira) | alto | alta | regra: nada do Marco F entra antes da beta medida | revisão a cada marco |

---

## 11. Checklist da primeira entrega online (fim do Marco B)

Registrar cada item no `PROGRESSO.md` como **executado** (com data, dispositivos e rede), **planejado** ou **limitação conhecida**.

**Reprodutibilidade**
- [ ] `git clone` → `npm ci` → `npm run dev` sobe cliente e servidor com um comando; README com passos
- [ ] Versões exatas e lockfile; `npm test` verde

**Regras e simulação**
- [ ] Testes: 4º toque, toque duplo (no modo 2v2 da sim), chão, fora pelo último toque, rede que continua, saque inválido (3 casos), auto-saque aos 5 s, bola presa, 7/+2, 10×10, teto 11
- [ ] Contatos a 22 m/s sem túnel (10.000 casos)
- [ ] Hash determinístico igual em Node + Chrome + Firefox + Safari

**Online**
- [ ] Criar sala → código/link → entrar → pronto → partida → resultado → revanche, **sem recarregar**
- [ ] Sala cheia, código inválido e versão incompatível mostram a mensagem certa
- [ ] **Dois dispositivos em redes diferentes** (ex.: Wi-Fi de casa × 4G) concluem **10 partidas** com placar e resultado iguais nos dois clientes e no log do servidor
- [ ] Queda de até 15 s: volta à mesma vaga e o rally é anulado; mais de 15 s: W.O.
- [ ] Input adulterado (bits inválidos, *flood*, tick fora da janela, mensagem de posição forjada) não altera posição, força nem placar

**Latência**
- [ ] E-BOLA a 40, 100 e 180 ms com jitter e perda: tabela de rejeição, correção p95 e atraso preenchida
- [ ] Painel F3 mostra RTT, jitter, tick, correções e rejeições

**Dispositivos**
- [ ] Desktop Chrome e Firefox; celular Android Chrome e iPhone Safari jogam (touch básico)

---

## 12. Próximo prompt de implementação (limitado ao Marco B)

> Copie o bloco abaixo para iniciar a implementação.

```text
Atue como engenheiro sênior de jogos web e netcode do GINGA ARENA.
Leia antes: ginga-arena/docs/PLANO.md (§3, §6, §7, §11), DECISOES.md e PROGRESSO.md.

MISSÃO: executar SOMENTE o Marco B (protótipo técnico online) em entregas B0→B6,
uma de cada vez, com commit e verificação ao fim de cada uma. Nada de arte final,
áudio final, bot, tutorial, 2v2 jogável ou WebGPU (fora do escopo).

B0 — Spike de versões (pare e reporte ao terminar):
- Criar ginga-arena/ com npm workspaces: packages/shared, packages/server, packages/client.
- Confirmar no npm e fixar versões EXATAS: three, @dimforge/rapier3d-deterministic-compat,
  colyseus (servidor, Node ≥ 22), @colyseus/sdk (cliente), @colyseus/schema, @colyseus/testing,
  vite, vitest, typescript. Não usar colyseus.js 0.16. Não misturar APIs de versões diferentes:
  consultar a documentação da versão instalada (docs.colyseus.io, rapier.rs, threejs.org).
- Provar: (a) schema do Colyseus compila com o TypeScript escolhido (decorators ou alternativa);
  (b) Rapier deterministic inicializa em Node e no navegador via Vite; (c) bola presa ao plano
  (z = 0 após 100k ticks); (d) hash de world.takeSnapshot() após 3600 ticks igual em Node e
  navegador (página /hash.html); (e) avaliar room.input()/setFixedTimestep()/predict da 0.18
  para o avatar próprio e registrar a conclusão.
- Registrar resultados e versões em PROGRESSO.md e a decisão em DECISOES.md.

B1 — packages/shared (sem DOM/áudio/render; sem Math.random/sin/cos na sim):
- params.ts com os valores da §3.10; input.ts (bits, validação); protocol.ts (PROTOCOL_VERSION,
  SIM_VERSION, mensagens, códigos de erro); rng.ts com semente.
- sim/: World com Rapier (bola dinâmica + CCD + trava de plano; chão; rede sólida com borda);
  PlayerController 1D + pulo; máquina de ações (janelas §3.5); ContactResolver por varredura de
  segmento, 1 contato/tick, desempate §3.2; solver balístico (§3.7) com erro determinístico;
  ordem de tick da §7.2; snapshot/restore.
- rules/: máquina de estados da §3.3 inteira (inclusive PONTO_PENDENTE, RALLY_ANULADO,
  PAUSA_CONEXAO), placar 7/+2/teto 11, saque e auto-saque, todas as faltas da §3.2.
- Testes Vitest cobrindo a seção "Regras e simulação" da §11.

B2 — packages/server: MatchRoom Colyseus a 60 Hz fixos, patch 50 ms explícito, salas por código
curto (sem O/0/I/1) e convite, ready/unready/leave/rematch, validação e limites de input (§7.6),
eventos com id, allowReconnection 15 s + regras de pausa/abandono (§7.9), recusa por versão,
log de inputs+semente por partida. Testes com @colyseus/testing (inclui input adulterado).

B3 — packages/client: Vite + Three.js WebGLRenderer; cápsulas coloridas com símbolo ▲/●, bola +
sombra blob, rede, linhas; câmera lateral §3.9; lado local sempre à esquerda (espelhar só a
apresentação); teclado A/D/←/→, Espaço, J, K; touch básico (◀ ▶ + 3 botões); telas DOM mínimas:
início (apelido), sala (código, link, pronto), HUD (placar, contatos, conexão), resultado
(revanche), reconexão; todos os estados de erro da §5.2 com textos da §4.9.

B4 — Netcode: loop de tick fixo no cliente; relógio §7.7; previsão + reconciliação do avatar;
interpolação dos remotos; bola em duas linhas do tempo §7.5; contato local previsto e
confirmado/rejeitado; contato retroativo limitado no servidor (§7.6); dedupe de eventos (§7.8);
painel F3 com RTT, jitter, correções e rejeições.

B5 — Laboratório: proxy WebSocket em Node com atraso/jitter/perda configuráveis + clientes
headless que jogam com o BotBrain mínimo (só para teste, rotulado). Rodar 40/100/180 ms e
preencher a tabela da §7.5 em PROGRESSO.md com números medidos.

B6 — Staging: cliente em Cloudflare Pages e servidor Node persistente (documentar opções e
comandos; não criar recursos pagos sem minha confirmação). Executar o checklist da §11.

REGRAS DE TRABALHO:
- Mudanças pequenas; `npm test` e typecheck antes de cada commit; um comando para subir
  cliente+servidor localmente (`npm run dev` na raiz de ginga-arena/).
- Atualize PROGRESSO.md (feito / medido / pendente / limitações) e DECISOES.md a cada entrega.
- Nunca afirme que um teste passou sem executá-lo; diferencie executado × planejado.
- Qualquer ambiguidade de regra: decidir pela §3.2, registrar e seguir; se não coberta, perguntar.
- Commits e push no branch de desenvolvimento indicado.
```
