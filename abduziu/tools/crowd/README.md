# Multidão do ABDUZIU

Transforma personagens com rig nos pedestres do jogo. A cidade é feita de **gente comum**. Os **memes**
feitos na Tripo só existem no **modo história** (campanha) e são super raros: em ~35% das fases um deles
aparece no meio da multidão depois de 35 a 110 s (às vezes um segundo, mais tarde). Ele vem brilhando
dourado, com uma coluna de luz que dá pra ver de qualquer ponto da cidade e um ponto pulsando no radar.
Quando o feixe levanta o meme, roda uma mini cinematic na hora: tarjas pretas, câmera lenta, a câmera
girando em volta dele enquanto sobe (procura um ângulo sem prédio na frente) e o cartão com nome, número
e raridade. No fim aparece "+1 NA COLEÇÃO" e o jogo volta ao normal. A lógica fica em `src/core/MemeHunt.ts`.
Cada meme é uma entrada própria na Coleção (dex #228–230).

Todos correm da nave, surtam embaixo do feixe e, quando o feixe levanta, **nadam de costas com a barriga
virada pro céu** até serem abduzidos.

## Gente comum (13 pedestres)

Vêm dos pacotes **Ultimate Modular Men** e **Ultimate Modular Women** do [Quaternius](https://quaternius.com)
(CC0 1.0, domínio público, conforme o `License.txt` dos pacotes). As animações de correr, ter medo, surtar e
ser abduzido foram feitas aqui, em `src/prep.js`.

| id | Pacote | | id | Pacote |
|---|---|---|---|---|
| `servidor` | Men / Suit (sem a pistola) | | `estudante` | Women / Casual |
| `servidora` | Women / Formal | | `moleque` | Men / Casual_Hoodie |
| `executiva` | Women / Suit | | `agro` | Men / Farmer |
| `peao` | Men / Worker | | `casual` | Men / Casual_2 |
| `mestre_obras` | Women / Worker | | `punk` | Women / Punk |
| `turista` | Men / Beach | | `punk2` | Men / Punk |
| `aventureira` | Women / Adventurer | | | |

O `npm run fetch` baixa os glTF pra `source/quaternius/`. Eles ficam fora do git: só o resultado
(`public/crowd/*`) vai pro jogo.

### Como as animações são feitas (`npm run prep`)

O rig do Quaternius tem os pés como ossos soltos guiados por IK e a corrida do pacote é no lugar. O `prep`:

1. junta todas as partes num mesh só, tira acessórios (a pistola do terno), transforma as cores dos materiais
   numa textura-paleta (uma célula por cor), solda os vértices e suaviza as normais (~3 mil vértices);
2. cria as poses mirando cada segmento do corpo (coluna, braço, antebraço, coxa, canela) numa direção do
   corpo (esquerda, cima, frente). Funciona sem depender dos eixos locais dos ossos. Os pés IK são colados
   na ponta da canela a cada quadro e, nas poses em pé, o corpo desce/sobe pra manter o pé no chão.

| Animação | O que é |
|---|---|
| `run` | a corrida do pacote com os braços jogados pra cima em pânico; a velocidade do chão é medida pelo pé apoiado (o jogo ajusta o ritmo à velocidade do pedestre, pro pé não patinar) |
| `afraid` | agachado, mãos na cabeça, tremendo |
| `freaky` | pulando no lugar, braços se debatendo, cabeça balançando |
| `swim` | sendo abduzido: costas arqueadas, braços se esticando, pernas chutando. O `bake` vira de barriga pra cima |

`npm run sheet` gera `work/sheet-<id>.png` com as quatro animações (`YAW=1.57` pra ver de lado).

## Memes (Tripo)

| Personagem | Arquivo | Coleção |
|---|---|---|
| HUEHUE | `source/huehue.glb` | #228, raro |
| CABEÇA DE GUIDÃO | `source/cabeca_guidao.glb` | #229, raro |
| MANOEL GOMES | `source/manoel_gomes.glb` | #230, épico |

Gerados na Tripo com rig Mixamo e animações. `simplify` reduz pra ~5 mil triângulos mantendo esqueleto e UVs
(atravessando as costuras de UV da Tripo pesando o quanto a textura estica). Animação que falta num é
emprestada do outro (mesmo esqueleto, altura do quadril corrigida). `npm run thumbs` renderiza o retrato de
cada um pra Coleção (`public/crowd/thumbs/<id>.webp`).

## Bake (todos)

`npm run bake` amostra cada animação em matrizes de osso numa textura de floats e grava
`public/crowd/<id>.bin` + `<id>.webp`. No caminho, ele:

- junta os ossos dos dedos na mão (Mixamo ou Quaternius);
- tira o deslocamento da corrida e guarda a velocidade original;
- mede barriga, cabeça e ombros do `swim` e gira a animação pra barriga ficar pra cima;
- gera uma segunda malha leve (~1,2 mil triângulos) pra quem tá longe.

No jogo, `src/world/crowd/` desenha cada personagem como uma malha instanciada, com o esqueleto rodando no
shader do material da cidade (luz, sombra das nuvens, luz do feixe e brilho de abdução). É um desenho por
personagem, seja quantos pedestres forem.

| Estado do pedestre | Animação |
|---|---|
| parado, sentado | `afraid` lento |
| curioso, filmando | `afraid` |
| andando | `run` devagar |
| fugindo | `run` na velocidade da fuga |
| em pânico | `freaky` |
| se escondendo | `afraid` rápido |
| tremendo embaixo do feixe | `freaky` |
| subindo no feixe | `swim` de barriga pra cima, virado pra onde gira |
| caiu de volta | `afraid` |

## Adicionar personagem

**Gente comum** (rig Quaternius): coloque o glTF em `source/quaternius/` (e no `fetch.mjs`), crie uma entrada
em `characters.json` com `"prep"` apontando pra ele, adicione em `CROWD_CHARACTERS`
(`src/world/crowd/CrowdAssets.ts`) e rode `npm run prep && npm run bake <id>`.

**Meme** (Tripo com rig Mixamo e animações `run`, `afraid`, `freaky`, `swim`; as que faltarem são emprestadas):

1. salve como `source/<id>.glb` e crie a entrada em `characters.json` (copie uma existente, com `thumb`);
2. adicione em `CROWD_CHARACTERS` com `meme: 'meme_<id>'`;
3. crie a entrada `meme_<id>` em `src/config/objects.ts` (tag `meme`, `thumb: 'crowd/thumbs/<id>.webp'`);
4. rode:

```bash
npm run simplify && npm run bake <id> && npm run thumbs <id>
```

Precisa de Chromium (`CHROME=/caminho/chromium`, padrão `/opt/pw-browsers/chromium`).
