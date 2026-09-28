# GINGA ARENA

> Entre pelo navegador, chame um amigo e transforme uma troca de bola em uma disputa cheia de ginga.

Futevôlei arcade 2,5D para navegador, com multiplayer online autoritativo (1v1 no MVP, 2v2 na beta).

**Status:** Marco B (protótipo técnico online) jogável: 1v1 online com servidor autoritativo, treino e partida contra bot, abertura animada. Arte e animação definitivas vêm no Marco D.

## Rodando

Precisa de Node 22+.

```bash
cd ginga-arena
npm install
npm run dev        # servidor de partidas (ws://localhost:2567) + cliente (http://localhost:5173)
```

Pra jogar online com outra pessoa na mesma rede: abra `http://SEU-IP:5173`, clique em **Criar sala online** e mande o link (ou o código de 4 letras). O cliente procura o servidor no mesmo host, porta 2567. Dá pra apontar pra outro com `VITE_SERVER_URL=wss://…` no build ou `?server=wss://…` na URL.

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor + cliente com hot reload |
| `npm test` | testes de regras/simulação (shared) e de sala (server, com clientes reais) |
| `npm run typecheck` | TypeScript estrito nos três pacotes |
| `npm run build` | build de produção do cliente (`packages/client/dist`) |
| `npm run start:server` | só o servidor de partidas (`PORT`, `GINGA_LOG_DIR` opcionais) |

### Controles

| | Teclado | Controle | Toque |
|---|---|---|---|
| Mover | A/D ou ←/→ | analógico / D-pad | ◀ ▶ |
| Pular | Espaço, W ou ↑ | A | Pular |
| Toque / levantar | J (ou Z) | X | Toque |
| Ataque | K (ou X) | B ou Y | Ataque |
| Menu | Esc | | ⏸ |
| Painel de rede | F3 | | |

A direção segurada escolhe a intenção: **frente** (rumo à rede) ou **trás**. Seu lado aparece sempre à esquerda, então frente é sempre a direita. No 3º toque, o toque vira um lob por cima da rede.

### Laboratório de latência

`tools/netlab/`: um proxy TCP (atraso, jitter, perda) e um executor com Playwright que coloca dois navegadores jogando online com o bot (`?autobot=medium`) pelo mesmo caminho de input de uma pessoa.

```bash
npm run start:server &                                   # servidor
(cd packages/client && npm run build && npx vite preview --port 4173) &
node tools/netlab/proxy.mjs --rtt 100 --jitter 15 --loss 0.01 &
node tools/netlab/run.mjs --proxy 2600 --seconds 90       # precisa do pacote playwright
```

## Estrutura

```
packages/shared   regras, parâmetros, simulação (Rapier), bot, protocolo: sem DOM
packages/server   Node + Colyseus 0.18: salas por código, 60 Hz autoritativo
packages/client   Vite + Three.js + HTML/CSS: abertura, telas, HUD, previsão e interpolação
tools/netlab      proxy de latência e executor de partidas com bots
```

| Documento | Conteúdo |
|---|---|
| [`docs/PLANO.md`](docs/PLANO.md) | plano completo: regras, controles, arte, UX, arquitetura, netcode, backlog, orçamento, riscos |
| [`docs/DECISOES.md`](docs/DECISOES.md) | registro de decisões |
| [`docs/PROGRESSO.md`](docs/PROGRESSO.md) | o que foi feito, medido e o que vem a seguir |
