# GINGA ARENA

> Entre pelo navegador, chame um amigo e transforme uma troca de bola em uma disputa cheia de ginga.

Futevôlei arcade 2,5D para navegador, com multiplayer online autoritativo (1v1 no MVP, 2v2 na beta).

**Status:** Marco A (Definição). Primeiro código: a abertura (vinheta GUETO GAME STUDIO → logo GINGA ARENA → tela de título). O jogo começa pelo Marco B.

## Rodando

Precisa de Node 22+.

```bash
cd ginga-arena
npm install
npm run dev        # http://localhost:5173 (também na rede local, pra abrir no celular)
npm run build      # typecheck + build de produção em packages/client/dist
```

- Qualquer tecla, clique ou toque adianta a abertura.
- `?intro=0` abre direto na logo assentada (útil em desenvolvimento).
- Com "reduzir movimento" ativo no sistema, as duas marcas só aparecem em fade.

| Documento | Conteúdo |
|---|---|
| [`docs/PLANO.md`](docs/PLANO.md) | plano completo: regras, controles, arte, UX, arquitetura, netcode, backlog, orçamento, riscos |
| [`docs/DECISOES.md`](docs/DECISOES.md) | registro de decisões (o que, por quê, alternativas) |
| [`docs/PROGRESSO.md`](docs/PROGRESSO.md) | o que foi feito, medido e o que vem a seguir |

Stack planejada: TypeScript · Vite · Three.js (WebGL2) · Rapier (WASM) · Node.js + Colyseus 0.18 · WebSocket.
