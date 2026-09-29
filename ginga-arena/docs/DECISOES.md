# Registro de decisões

Formato: **ID · data · status**: decisão. *Por quê.* Alternativas. Como reverter.
Status possíveis: `proposta`, `aceita`, `substituída por D-xx`, `descartada`.
Detalhes e contexto no [`PLANO.md`](PLANO.md) §2.1.

| ID | Data | Status | Decisão | Motivo curto | Reavaliar se… |
|---|---|---|---|---|---|
| D-01 | 2026-09-28 | proposta | Projeto em `ginga-arena/`, npm workspaces | mesmo gerenciador do `abduziu/` | o projeto ganhar repositório próprio |
| D-02 | 2026-09-28 | proposta | Pacotes `shared` / `client` / `server` (+`tools` no D) | regras e simulação únicas | n/a |
| D-03 | 2026-09-28 | proposta | Sim 60 Hz, estado ~20 Hz, render livre | timing fino, banda baixa | medições do E-BOLA pedirem outro valor |
| D-04 | 2026-09-28 | proposta | Rapier 3D (`rapier3d-deterministic-compat`) travado no plano | determinismo multiplataforma; porta aberta para a altinha 3D | spike B0 falhar → `rapier2d` |
| D-05 | 2026-09-28 | proposta | Contato jogador–bola é consulta de jogo, não colisão física | sem impulsos acidentais | n/a |
| D-06 | 2026-09-28 | proposta | WebGLRenderer (WebGL2) no MVP; WebGPU só como experimento no E | compatibilidade; incompatibilidades documentadas no WebGPURenderer | experimento no E atingir o critério da §6.7 |
| D-07 | 2026-09-28 | proposta | Sem ShaderMaterial/onBeforeCompile/EffectComposer no MVP; contorno por geometria | portabilidade entre renderers, celular | design exigir efeito impossível sem isso |
| D-08 | 2026-09-28 | proposta | UI em HTML/CSS + TS puro | leve, acessível | telas crescerem demais |
| D-09 | 2026-09-28 | proposta | Colyseus 0.18 + `@colyseus/sdk` 0.18 (não `colyseus.js` 0.16) | versão atual, APIs de netcode | B0 revelar incompatibilidade |
| D-10 | 2026-09-28 | proposta | Bola em duas linhas do tempo + contato local previsto e confirmado | maior risco de sensação sob latência | E-BOLA fora das metas → rollback do mundo |
| D-11 | 2026-09-28 | proposta | Treino e bot rodam localmente, bot rotulado; não contam como teste online | custo zero, offline | n/a |
| D-12 | 2026-09-28 | proposta | Lado local sempre à esquerda (espelha só a apresentação) | "frente" = direita para todos | playtest indicar confusão |
| D-13 | 2026-09-28 | substituída por D-24 | Cliente no Cloudflare Pages; servidor Node persistente em SP | CDN existente; processo contínuo perto do jogador | custo/RTT medidos |
| D-14 | 2026-09-28 | proposta | Convidado sem conta; banco só com progressão | acesso rápido | Marco F |
| D-15 | 2026-09-28 | proposta | Erro de contato determinístico (cedo = curta, tarde = longa), sem RNG | justo e legível | playtest achar monótono |
| D-16 | 2026-09-28 | aceita | Abertura em Canvas 2D puro (sem Three.js): vinheta GUETO (vermelha, vetorizada da arte do estúdio) → logo GINGA ARENA (branca, vetorial) → tela de título | ~6 KB gzip, aparece antes do motor 3D e do WASM carregarem | a logo final desenhada à mão substituir a versão vetorial |
| D-17 | 2026-09-28 | aceita | Snapshots próprios por mensagem (sem `@colyseus/schema`); Colyseus cuida de salas, transporte e reconexão | snapshots marcados por tick para reconciliar; estado pequeno; evita decorators no TS 7 | banda medida no B5 exigir delta/binário |
| D-18 | 2026-09-28 | aceita | Ordem do tick: física da bola antes do contato; contato no primeiro ponto do trajeto que entra no alcance; bola sem rotação física | varredura real do trajeto; restauração exata do estado | n/a |
| D-19 | 2026-09-28 | aceita | Loop do servidor via `setFixedTimestep` do Colyseus; `patchRate = null` só **depois** dele | setar antes cria um segundo relógio que zera o acumulador (bug achado no B2) | n/a |
| D-20 | 2026-09-28 | aceita | Adiantamento do cliente = RTT/2 + 2·jitter + **1 frame** + 20 ms (mín. 3 ticks); inputs enviados em lote por frame, com 2 repetições | inputs saem uma vez por frame; sem o frame no cálculo, clientes lentos chegavam atrasados e tinham toques rejeitados | E-BOLA com humanos |
| D-21 | 2026-09-28 | aceita | Toques do jogador local que só aparecem ao re-simular depois de um snapshot contam como previstos e ganham efeito na hora | a bola rápida do adversário pode chegar dentro da janela de re-simulação | n/a |
| D-22 | 2026-09-28 | aceita | Arena, avatares e sons 100% por código no Marco B (sem assets) | provar o online antes de produzir arte; o cliente inteiro cabe em ~1,9 MB gzip, a abertura em 7 KB | Marco D |
| D-23 | 2026-09-29 | aceita | Regras da sala em `RoomCore` (packages/shared), sem plataforma; Colyseus (Node) e Durable Object (Cloudflare) são só adaptadores de transporte | uma única autoridade testada; troca de hospedagem sem reescrever regra | n/a |
| D-24 | 2026-09-29 | aceita | Produção: salas em **Cloudflare Durable Objects** (uma por código, `locationHint: sam`), site no Pages, `/api/*` por service binding (mesma origem). Colyseus segue para desenvolvimento local e para uma VM Node no futuro | a conta tem Workers/DO/Pages; Containers negado pela API e nenhum provedor de VM disponível. O DO é um ator persistente e com estado, que fica vivo enquanto há jogadores (não é função HTTP efêmera) | RTT medido de outras capitais, custo de DO, ou necessidade de Node |
| D-25 | 2026-09-29 | aceita | Rapier no Worker: o WASM embutido (base64) é extraído no build para `.wasm` e importado como `WebAssembly.Module` (o Worker proíbe compilar WASM de bytes em tempo de execução) | mesmos bytes, mesmo motor: o servidor continua idêntico aos clientes | nova versão do Rapier mudar o formato (o script falha alto) |
| D-26 | 2026-09-29 | aceita | Toque atrasado (≤ 8 ticks): o servidor re-simula a partir do tick certo, só se nada visível aconteceu no intervalo; senão mescla no tick atual | fecha a maior fonte de toques rejeitados sem reescrever o que os clientes já viram | E-BOLA com humanos |
| D-27 | 2026-09-29 | aceita | Deploy pelo GitHub Actions (`deploy-ginga-arena.yml`), como o ABDUZIU | o proxy de credenciais do ambiente de desenvolvimento sobrescreve o token de upload do Pages | n/a |

