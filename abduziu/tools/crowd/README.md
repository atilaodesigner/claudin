# Multidão do ABDUZIU (personagens da Tripo)

Transforma personagens gerados na Tripo, já com rig Mixamo e animações, nos pedestres do jogo.
Todo mundo que anda pela cidade vira um desses personagens. Eles correm da nave, surtam embaixo
do feixe e, quando o feixe levanta, **nadam de costas com a barriga virada pro céu** até serem abduzidos.

| Personagem | Arquivo |
|---|---|
| HUEHUE | `source/huehue.glb` |
| CABEÇA DE GUIDÃO | `source/cabeca_guidao.glb` |
| MANOEL GOMES | `source/manoel_gomes.glb` |

## Como funciona

1. **`simplify`**: reduz cada modelo pra ~5 mil triângulos (de 35 a 54 mil) mantendo o esqueleto e
   as UVs. A Tripo recorta muito as UVs, então a simplificação pode atravessar costuras, pesando o
   quanto a textura estica.
2. **`bake`**: num navegador (three.js), amostra cada animação em matrizes de osso e grava tudo numa
   textura de floats. Também:
   - junta os 40 ossos dos dedos na mão (não aparecem na multidão);
   - tira o deslocamento da corrida (quem anda é o código) e guarda a velocidade original, pro pé
     não patinar;
   - pega animações que faltam de outro personagem (mesmo esqueleto Mixamo, altura do quadril
     corrigida);
   - mede barriga, cabeça e ombros do `swim` e gira a animação pra barriga ficar pra cima;
   - gera uma segunda malha leve (~1,2 mil triângulos) pra quem tá longe;
   - reduz a textura pra WebP 512.

   Resultado: `public/crowd/<id>.bin` (~450 KB) + `<id>.webp` (~50 KB) por personagem.
3. **No jogo**: `src/world/crowd/` desenha cada personagem como uma malha instanciada, com o
   esqueleto rodando no shader do material da cidade. Assim herda luz, sombra das nuvens, luz do
   feixe e brilho de abdução. É 1 desenho por personagem, seja quantos pedestres forem.

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

## Adicionar um personagem novo

1. Na Tripo: gere o personagem (em pose T, veja o prompt de referência), faça o rig e exporte em
   GLB com as animações `run`, `afraid`, `freaky` e `swim`. As que faltarem são emprestadas de outro
   personagem.
2. Salve como `source/<id>.glb` e adicione uma entrada em `characters.json`. Copie uma existente,
   troque `id`, `name`, `source` e `file`, e liste os outros personagens em `extra`.
3. Adicione o personagem em `CROWD_CHARACTERS` (`src/world/crowd/CrowdAssets.ts`).
4. Rode:

```bash
cd abduziu/tools/crowd
npm install
npm run simplify      # work/<id>.glb
npm run preview       # work/preview-<id>.png: confira as animações
npm run bake          # public/crowd/<id>.bin + .webp
```

Precisa de Chromium (`CHROME=/caminho/chromium`, padrão `/opt/pw-browsers/chromium`).
