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

## Próximos passos

1. Revisar o plano com a equipe e passar as decisões de `proposta` para `aceita` em `DECISOES.md`.
2. Fechar a lista de dispositivos de teste reais (§2.3).
3. Iniciar o Marco B pelo B0 (prompt pronto na §12 do plano).
