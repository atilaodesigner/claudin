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

## Próximos passos

1. Revisar o plano com a equipe e passar as decisões de `proposta` para `aceita` em `DECISOES.md`.
2. Fechar a lista de dispositivos de teste reais (§2.3).
3. Iniciar o Marco B pelo B0 (prompt pronto na §12 do plano).
