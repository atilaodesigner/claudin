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
| D-13 | 2026-09-28 | proposta | Cliente no Cloudflare Pages; servidor Node persistente em SP | CDN existente; processo contínuo perto do jogador | custo/RTT medidos |
| D-14 | 2026-09-28 | proposta | Convidado sem conta; banco só com progressão | acesso rápido | Marco F |
| D-15 | 2026-09-28 | proposta | Erro de contato determinístico (cedo = curta, tarde = longa), sem RNG | justo e legível | playtest achar monótono |
| D-16 | 2026-09-28 | aceita | Abertura em Canvas 2D puro (sem Three.js): vinheta GUETO (vermelha, vetorizada da arte do estúdio) → logo GINGA ARENA (branca, vetorial) → tela de título | ~6 KB gzip, aparece antes do motor 3D e do WASM carregarem | a logo final desenhada à mão substituir a versão vetorial |
| D-17 | 2026-09-28 | aceita | Snapshots próprios por mensagem (sem `@colyseus/schema`); Colyseus cuida de salas, transporte e reconexão | snapshots marcados por tick para reconciliar; estado pequeno; evita decorators no TS 7 | banda medida no B5 exigir delta/binário |
| D-18 | 2026-09-28 | aceita | Ordem do tick: física da bola antes do contato; contato no primeiro ponto do trajeto que entra no alcance; bola sem rotação física | varredura real do trajeto; restauração exata do estado | n/a |
