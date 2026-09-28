# ABDUZIU

> Comece abduzindo uma lata e termine arrancando prédios inteiros do chão.

Jogo mobile-first que roda direto no navegador, feito com **Three.js + TypeScript + Vite** (sem engine, sem React Three Fiber). Você pilota um disco voador sobre cidades brasileiras geradas proceduralmente (**Recife, Salvador, Rio de Janeiro, Manaus, São Paulo, Brasília** e a cidade de testes **Nova Aurora**) e usa um feixe gravitacional pra puxar, girar, orbitar e absorver tudo: latas, cadeiras de plástico, vira-latas caramelo, motos, carros populares, ônibus, casas de laje, prédios, helicópteros e caças da Força Sentinela.

Tudo é procedural: modelos 3D, texturas (placas, outdoors, calçada portuguesa), áudio e trilha sonora. **Não há assets externos obrigatórios**, então o jogo abre rápido e funciona offline (PWA).

---

## Rodando

Precisa de Node 20+.

```bash
cd abduziu
npm install
npm run dev        # http://localhost:5173 (também exposto na rede local pra testar no celular)
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento com hot reload |
| `npm run build` | typecheck (`tsc --noEmit`) + build de produção em `dist/` |
| `npm run preview` | serve o build de produção (`--host`, dá pra abrir no celular pela rede) |
| `npm run typecheck` | só o typecheck (TypeScript strict) |
| `npm test` | testes de lógica (Vitest) |

Pra testar no celular: rode `npm run dev` ou `npm run preview`, abra o IP que o Vite mostra (`Network: http://192.168.x.x:5173`) no Chrome Android / Safari iOS. Em HTTPS (deploy) o jogo pode ser instalado como app (PWA) e roda em tela cheia/paisagem.

O build é estático: dá pra hospedar `dist/` em qualquer lugar (GitHub Pages, Netlify, Vercel, S3). O `base` do Vite é relativo (`./`), então funciona em subpasta.

---

## Controles

| | Touch | Desktop |
|---|---|---|
| Pilotar | arraste com um dedo em qualquer lugar (joystick flutuante) | WASD / setas, ou clique e arraste |
| Feixe | automático: tudo que fica embaixo do disco é puxado | automático |
| Força extra | fique parado em cima de algo pesado (o feixe fica mais forte) | idem |
| EMP | botão EMP (canto inferior direito) | Espaço |
| Dash | botão DASH ou "flick" rápido com o dedo (desbloqueia em Evoluções) | Shift |
| Extrair | botão EXTRAIR (aparece aos 5:00) | E |
| Pausa | botão ‖ | Esc / P |
| Evoluir (level up) | toque num dos 3 chips no rodapé, **sem pausar** | clique ou 1 / 2 / 3 |

---

## O loop

```
EXPLORAR → ABDUZIR → GANHAR MATÉRIA → COMBO → LEVEL UP → EVOLUÇÃO (SEM PAUSA) → MAIS PODER
   → A CIDADE REAGE (ALERTA 0–6) → SOBREVIVER → ABDUZIR COISAS MAIORES → EXTRAIR OU ARRISCAR
   → ALIEN CORES → EVOLUÇÕES PERMANENTES → NOVA INVASÃO
```

- **Classe de massa (tier 0–11):** cada objeto tem um `tier`. A nave começa puxando tier 0–1 (lata, cadeira, cachorro). A matéria absorvida aumenta a classe (e o tamanho da nave, e a câmera abre junto). Tentar puxar algo pesado demais faz o objeto tremer, deformar, soltar lascas e dar tranco na nave, e aparece `PODER INSUFICIENTE` com uma barra mostrando quanto falta.
- **Física fake:** `STATIC → SHAKING → LIFTING → ORBITING → SUCKING → ABSORBED` (+ `ANTICIPATE`, `STRAINING`, `CARRIED`, `FALLING`, `SETTLING`). É espiral + subida + rotação + mola, sem rigid body. Objetos pesados atrasam atrás da nave (mola mais mole), e peças em cima de outras (caixa d'água, telhado, antena) são arrancadas separadas ou vão junto quando a casa inteira sobe.
- **Combo:** absorções em sequência. O áudio sobe numa escala pentatônica, o feixe fica mais forte, a partir de x10 os objetos orbitam a nave, e no x50 entra o **ABDUCTION FRENZY**.
- **Alerta:** abduzir gera ameaça. Viaturas da Patrulha Aurora → drones → helicópteros Beija-Flor → caças Carcará (com entrada cinematográfica) → unidades especiais → **PROTOCOLO CÉU VERMELHO** → **PROJETO TUCANO NEGRO** (chefe).
- **Extração:** aos 5:00 abre o portal (x1), aos 7:00 vira x2, aos 9:00 x4 e aos 12:00 x8. Se a nave for abatida você perde a maior parte das cores.
- **Level up sem pausa:** a cada nível aparecem 3 chips (ícone + nome) no rodapé do HUD e o jogo continua rodando. Toque/clique ou 1-2-3 escolhe; níveis acumulados ficam na fila (`+N`). No desktop, passar o mouse mostra a descrição.
- **Objetivos na tela:** o painel do canto superior esquerdo mostra cada objetivo com barra de progresso; o que andou por último fica em foco (no celular em pé só ele aparece). Progresso pulsa a linha, conclusão pisca dourado. Cartões-postais que são objetivo aparecem no radar.
- **Meta:** Alien Cores compram evoluções permanentes (árvore com 5 ramos). A Coleção (ABDUCTION DEX) tem 142 objetos, alguns secretos (um por cidade).

---

## Modos

| Modo | Pra quem | Regras |
|---|---|---|
| **Passeio** (casual) | quem quer relaxar | sem inimigos, sem alerta, sem dano; encerre quando quiser (conta como extração). Desafios que dependem de inimigos não aparecem. Rende 50% das cores. Cidades liberadas na campanha. |
| **Invasão do Brasil** (progresso) | campanha | 7 cidades em ordem, cada uma com 3 estrelas fixas: extrair com vida, um objetivo local e abduzir o cartão-postal. Extrair libera a próxima cidade. Estrela nova vale +40 cores, primeira extração +60. |
| **Ranqueada** (rank) | competitivo | mesma cidade e mesma seed para todos na semana (`weeklySetup`). A pontuação comparada ao "par" da sua divisão dá ou tira RP (escala log: dobrar o par = +25 RP; extrair +10, morrer -10). Divisões: Bronze, Prata, Ouro, Platina, Diamante, Mestre Alienígena. |
| **Arena** (.io) | contra bots | rodada de 4 min estilo slither.io (`src/arena/ArenaSystem.ts`) num **mapa infinito**: a cidade da arena é gerada como um ladrilho que dá a volta (`WorldGenerator` com `wrap`), e `Game.renderWrapCopies` desenha cópias dela do lado que a câmera vê, então não existe borda. 9 a 15 naves-bot, algumas já grandes no começo, crescem abduzindo e comem mais rápido conforme o tempo passa. Uma nave 0,6 classe maior segura a outra no feixe e engole (1 s entre bots, 0,85 s pra te engolir), ficando com 60% da matéria; o resto cai como sucata. Bots te preferem como alvo, caçam em arrancadas curtas e só dão 8 s de carência. Placar ao vivo, nome sobre cada nave (vermelho = te engole, roxo = dá pra engolir), radar colorido. |
| **Invasão do Dia** | todo dia | seed diária, cidade do dia em rodízio. Não mexe no RP. |

Fluxo no menu: **INVADIR → escolha o modo → mapa do Brasil (campanha/passeio) ou tela da ranqueada**.

## Cidades

Cada cidade é só dado em `src/config/cities.ts`: layout de quarteirões, luz/céu/névoa, cor da água, placas e outdoors locais (16 + 5 slots redesenhados no atlas), rádio da introdução, cartões-postais, objetos extras por bairro, barcos, segredo e as 3 estrelas.

| Cidade | Ameaça | Destaques |
|---|---|---|
| Nova Aurora | 1 | cidade de testes (tutorial), arranha-céu Aurora |
| Recife | 1 | Rio Capibaribe com pontes, Recife Antigo, Boa Viagem (placa de tubarão), jangadas, Galo Gigante do Carnaval |
| Salvador | 2 | Pelourinho (casario colonial), trio elétrico, tabuleiro de acarajé, Elevador Lacerda, Farol da Barra |
| Rio de Janeiro | 3 | Copacabana com calçadão de ondas, morros, Arcos da Lapa com bondinho, Estádio Colosso, Pão de Açúcar e Corcovado no horizonte |
| Manaus | 3 | floresta com samaúmas, Encontro das Águas (água escura e barrenta), barcos recreio, casas flutuantes, palafitas, jacarés, Teatro Amazonas |
| São Paulo | 4 | Paulista cheia de torres com helicóptero no teto, Museu Suspenso, Edifício Onda, Rio Pinheiros com Ponte Estaiada, trânsito 1.8x, garoa |
| Brasília | 5 | superquadras sobre pilotis, Esplanada, Palácio das Colunas, Congresso Nacional, Lago Paranoá, base aérea (capital com a defesa mais pesada) |

Tipos de quarteirão novos: `W` água, `A` praia, `K` centro histórico, `Q` superquadra, `G` esplanada, `M` floresta, `L` cartão-postal. `CityGrid` sabe onde tem rua, ponte, areia e água (ruas terminam na margem, trânsito e polícia fazem retorno, pontes seguem a linha da rua). Os cartões-postais são objetos tier 9–11: dá pra abduzir o Congresso inteiro.

Pra criar uma cidade: copie uma entrada de `CITIES`, desenhe o `layout` (8 colunas por 8 linhas é o tamanho testado em celular), escolha `start` numa quadra seca, liste `landmarks` nas células `L` e rode `npm test` (o teste `cities` valida grade, objetos e estrelas).

---

## Arquitetura

```
src/
  core/          Game (composition root + máquina de estados), RunController (regras da partida),
                 GameLoop, Time (slow-mo / hit-stop), EventBus tipado
  config/        TODO o balanceamento: gameBalance, objects, upgrades, enemies, events,
                 districts (mapa), meta, challenges
  rendering/     Renderer (DPR/escala/context loss), CameraController, Lighting (color script),
                 PostProcessing (bloom + grade custom), Sky, WorldMaterial (shader da cidade),
                 TextureAtlas (placas geradas em canvas), Environment (env map procedural)
  assets/        ModelBuilder (primitivas → geometria mesclada com cores/máscaras),
                 ModelLibrary, AssetLoader (GLB opcional), models/* (todos os modelos)
  world/         World, WorldGenerator (cidade procedural), ChunkManager (streaming de detalhe),
                 WorldBatch (BatchedMesh), HeightField, NPCSystem, TrafficSystem, Wires
  ufo/           UFOController (voo), UFOStats (stats derivados), UFOVisuals (evolução visual),
                 TractorBeam (shader do feixe)
  abduction/     AbductionSystem (física fake), DynamicObjectPool
  enemies/       EnemyManager, Police/Drone/Helicopter/Jet/Boss controllers, MissileController,
                 BulletSystem, EnemyAssets
  combat/        DamageSystem, ShieldSystem (shader com ripple), EMPSystem
  progression/   RunProgression (XP/tier), ComboSystem, ThreatSystem, UpgradeSystem,
                 SynergySystem, MetaProgression, ChallengeSystem, ScoreSystem, EventDirector,
                 HighlightManager
  effects/       ParticleManager (pontos + detritos, pooling), RingEffects, VFXManager (receitas de juice)
  audio/         AudioManager (SFX procedurais), MusicSystem (trilha adaptativa), Synth, Haptics
  ui/            HUD, UpgradeScreen, MainMenu, ResultsScreen, MetaScreen, DexScreen, Records,
                 Settings, Pause, Loading, IntroOverlay, DebugPanel, Thumbnails
  input/         InputManager, TouchInput (joystick flutuante), KeyboardInput
  save/          SaveService (+ migração), SaveBackend (LocalStorage / memória / futuro servidor)
  performance/   AdaptiveQualityManager, ObjectPool
tests/           Vitest: XP, tiers, combo, alertas, upgrades, sinergias, save/load, meta,
                 extração, desafios, timeline de balanceamento
```

### Decisões de performance

- **A cidade inteira é 1 draw call.** Todos os objetos estáticos ficam num `BatchedMesh` (com `WEBGL_multi_draw`) com frustum culling por objeto. NPCs, animais e trânsito ficam num segundo `BatchedMesh`. Só os objetos sendo abduzidos no momento viram meshes individuais (pool).
- **Um material pra tudo.** Cores ficam nos vértices, placas/outdoors num atlas único, e a pintura por instância (cor do carro, da casa, da camisa) sai de uma máscara no shader. O mesmo shader faz sombra de nuvem falsa, luzes da cidade (que piscam no EMP) e a mancha de luz do feixe no chão.
- **Física fake** (fórmulas de espiral + molas) em vez de rigid bodies. Nada de colisão física entre objetos.
- **Pooling** de partículas, detritos, balas, mísseis, meshes dinâmicas e anéis. Zero alocação por frame nos sistemas quentes.
- **ChunkManager** esconde miudezas (latas, cadeiras, bikes) por quarteirão além da distância de detalhe. NPCs distantes somem e são simulados a cada 8 frames.
- **AdaptiveQualityManager** mede o frame time e ajusta resolução em passos de 5% (imperceptível). Mudanças caras (sombras → recompile de shader) esperam um momento de pausa, como a tela de cartas. Presets: Mínima/Baixa/Média/Alta, detecção de GPU por software (força Mínima) e `?quality=0..3` na URL.
- **Pós-processamento próprio** (HDR → bloom 1/4 + 1/8 → composição única com ACES, grade, vinheta, aberração cromática em eventos). Desligado em qualidade baixa.
- **Shaders pré-compilados** no loading (`compileAsync`) pra primeira abdução não engasgar.

### EventBus

Sistemas conversam por eventos tipados (`src/core/EventBus.ts`): `object:abduct:start`, `object:abduct:complete`, `combo:changed`, `combo:frenzy`, `player:levelup`, `player:tierup`, `alert:changed`, `enemy:spawn`, `enemy:destroyed`, `player:damage`, `shield:break`, `emp:fired`, `run:end`, `highlight:*`...

### Highlights (clip moments)

`HighlightManager` registra momentos absurdos (`highlight:jet_capture`, `highlight:building_abduction`, `highlight:frenzy`, `highlight:boss`) com posição, tempo e pontuação. É a base pra um sistema de replay/clipes no futuro.

### Save

`SaveService` salva em LocalStorage (com fallback em memória no modo privado), com migração que completa campos faltando e aguenta save corrompido. A interface `SaveBackend` permite plugar um servidor (ranking/cloud save) sem mexer no jogo. A **Invasão do Dia** usa uma seed diária (`dailySeed()`) e a **Ranqueada** uma seed semanal (`weeklySetup()`): mesma cidade, mesmos eventos e mesmos desafios pra todo mundo. O save guarda progresso de campanha (`campaign`), divisão/RP (`rank`) e o último modo/cidade (`last`).

---

## Debug

Abra com **`?debug=1`**. Aparece o painel com FPS, draw calls, triângulos, objetos vivos, NPCs, inimigos, ameaça, classe, stats da nave, e cheats: `+XP`, `+Level`, `+Threat`, `Alert +1`, `Spawn Jet`, `Jet Intro`, `Spawn Heli`, `Spawn Drone`, `Spawn Police`, `Spawn Car`, `Spawn Bus`, `Spawn Boss`, `God Mode`, `Max Beam`, `Frenzy`, `Max Upgr.`, `Event`, `+5 min`, `Extract`, `Kill`, `+1000 cores`, `Quality`.

Outros parâmetros de URL: `?autostart=1` (começa direto), `?mode=casual|campanha|ranqueada|diaria`, `?city=recife|salvador|rio|manaus|sao_paulo|brasilia|nova_aurora`, `?skipintro=1`, `?quality=0..3`.

A tela de carregamento é o motion de abertura do ABDUZIU (`src/ui/LoadingScreen.ts`, canvas 2D): o disco entra, o feixe puxa cada letra do logo no ritmo do carregamento real e, no fim, o feixe estoura e a tela se dissolve no menu. Respeita `prefers-reduced-motion`.

---

## Como adicionar...

### ...um objeto novo

1. Crie o modelo em `src/assets/models/*.ts` (ou num arquivo novo registrado em `ModelLibrary.ts`):

   ```ts
   geladeira: (b) => {
     b.block(0.8, 1.8, 0.7, COL.paintBase, 0, 0, 0, { paint: 1 }) // parte pintável
       .box(0.05, 0.4, 0.05, COL.chrome, 0.32, 1.2, 0.36);
   },
   ```
   Convenções: metros, base em `y = 0`, frente pra `+Z`. `{ paint: 1 }` usa a cor da instância, `{ emit: 1 }` brilha (e pisca no EMP), `{ uv: atlas.get('...') }` usa textura do atlas.
2. Registre em `src/config/objects.ts`:
   ```ts
   { id: 'geladeira', dex: 94, name: 'Geladeira', tier: 2, massKg: 70, model: 'geladeira', tags: ['movel'], paints: [0xffffff, 0xd62828], description: 'Tinha pudim.' },
   ```
3. Coloque nas tabelas de spawn dos distritos (`src/config/districts.ts`) ou num gerador em `WorldGenerator.ts`. Pronto: ele aparece na cidade, na Coleção, nos desafios por tag, no score etc.

### ...um upgrade

1. Adicione o id em `UpgradeId` e a definição em `UPGRADES` (`src/config/upgrades.ts`), e os números em `UPGRADE_VALUES`.
2. Aplique o efeito em `UFOStats.compute()` (`src/ufo/UFOStats.ts`). Se precisar de comportamento novo, leia `stats.<campo>` no sistema correspondente.
3. Sinergias: adicione em `SYNERGIES` com `requires`, e cheque `upgrades.has('id')` onde fizer sentido.

### ...um inimigo

1. Adicione o tipo em `EnemyKind`, os stats em `ENEMIES` e os limites por alerta em `ALERT_BUDGETS` / `SPAWN_INTERVALS` (`src/config/enemies.ts`).
2. Crie `src/enemies/XController.ts` estendendo `Enemy` (implemente `flying`, `update(ctx)`; use `updateGun` / `updateMissiles` pra armas com lock).
3. Instancie no `switch` de `EnemyManager.spawn()`. Se o inimigo puder virar destroço abduzível, aponte `objectId` pra um objeto de `objects.ts`.

### ...trocar um placeholder por GLB

1. Coloque o arquivo em `public/models/hatch.glb`.
2. Em `src/assets/AssetLoader.ts`:
   ```ts
   export const MODEL_OVERRIDES = { hatch: 'models/hatch.glb' };
   ```
3. Na carga, o GLB é mesclado numa geometria só e as cores dos materiais viram cores de vértice (continua cabendo no batch de 1 draw call). Meshes com `paint` no nome recebem a cor da instância e materiais emissivos viram luzes. Se o GLB não carregar, o modelo procedural continua sendo usado. O `GLTFLoader` só é baixado se existir algum override.

Pra modelos com textura própria, o caminho é criar um segundo material/batch (a arquitetura já separa `WorldBatch` por material).

---

## Login, ranking online e save na nuvem (Supabase)

Projeto Supabase **abduziu** (`dhdtawdkmzcuoklzyqig`). O jogo continua 100% jogável sem conta; logar é opcional.

**O que tem:**
- **Login** com Google ou link/código por e-mail (`src/online/Online.ts`, tela `src/ui/AccountScreen.ts`, chip de conta no canto do menu). O SDK da Supabase é carregado sob demanda (chunk separado de ~55 kB gzip) e só no boot se já existir sessão ou retorno de login.
- **Apelido:** todo cadastro nasce com um apelido provisório (`ET-1A2B3C`) e o jogador escolhe o dele (3–16 caracteres, único sem diferenciar maiúsculas).
- **Ranking semanal:** a tela Ranqueada mostra o top 50 da semana (melhor partida de cada jogador) e a sua posição. O resultado da partida mostra "RANKING DA SEMANA: #N DE M".
- **RP autoritativo no servidor:** a função `submit_ranked_run` recalcula o RP com a mesma fórmula do `RankSystem.ts` (testado lado a lado em `tests/online.test.ts`). Logado, o RP do servidor manda.
- **Antitrapaça básica:** semana ISO válida, score ≤ 150 mil/s de partida e ≤ 60 mi, duração 15 s–60 min, 1 envio a cada 15 s. Cliente não tem permissão de escrever em `profiles`/`ranked_runs` direto.
- **Save na nuvem:** tabela `saves` (JSON do `SaveData`, só o dono lê/escreve via RLS). No login vence o save com mais partidas (empate: mais cores ganhos); depois cada gravação local sobe pra nuvem com debounce de 4 s. Configurações ficam por aparelho.
- **LGPD:** botão "Apagar conta e dados online" (RPC `delete_my_account`) remove usuário, perfil, partidas e save.

**Banco:** migration em `supabase/migrations/20260927160000_abduziu_online.sql` (já aplicada no projeto).

**Configurar no painel da Supabase (uma vez):**
1. *Authentication → URL Configuration:* em **Site URL** coloque `https://abduziu.fun` e em **Redirect URLs** adicione `https://abduziu.fun/**`, `https://www.abduziu.fun/**`, `https://*.abduziu.pages.dev/**` (prévias da Cloudflare) e `http://localhost:5173/**` pro dev.
2. *Authentication → Providers → Google:* ative e cole o Client ID/Secret criados no Google Cloud Console (OAuth "Web application", redirect `https://dhdtawdkmzcuoklzyqig.supabase.co/auth/v1/callback`).
3. *Authentication → Email Templates → Magic Link:* acrescente `Código: {{ .Token }}` pra quem abre o e-mail em outro app/aparelho poder digitar o código no jogo.
4. Pra volume real de e-mails, configure um SMTP próprio (o SMTP padrão da Supabase tem limite baixo por hora).

**Hospedagem:** Cloudflare Pages no domínio **abduziu.fun** (raiz `abduziu`, build `npm run build`, saída `dist`; cache em `public/_headers`). A prévia no claude.ai bloqueia chamadas externas, então aquela cópia é gerada com `VITE_ONLINE=off` e mostra "versão demo".

**Outros projetos/ambientes:** copie `.env.example` pra `.env` e troque URL/chave publicável. Nunca use a `service_role` no cliente.

## Roadmap

**Cidades:** Porto Alegre, Belo Horizonte, Fortaleza, Belém, Curitiba · ciclo dia/noite por cidade · clima (garoa de verdade em SP, chuva de fim de tarde em Manaus).

**Sistemas:** login com Apple · skins de OVNI · novas naves · eventos semanais · replay/clipes a partir do `HighlightManager` · compartilhamento de clipes · multiplayer assíncrono (fantasma da Invasão do Dia) · OVNI rival · buraco negro instável como evento · mais chefes · regiões brasileiras · trilha com instrumentos gravados.

**Técnico:** LOD por geometria nos prédios · atlas de janelas com iluminação noturna · ciclo dia/noite · áudio espacial com HRTF · worker pra geração da cidade · testes de integração com Playwright.

---

Feito com Three.js. Nenhuma marca, brasão ou logotipo real é usado: Força Sentinela, Patrulhas, Carcará, Beija-Flor, Nova Aurora, lojas e placas são fictícios. Os cartões-postais são estilizados (silhuetas reconhecíveis, não réplicas). Antes de um lançamento comercial vale uma checagem jurídica de direitos de imagem de monumentos (o Cristo Redentor, por exemplo, tem uso de imagem controlado; aqui ele é só uma silhueta distante no horizonte do Rio e não pode ser abduzido).
