# Objetos CC0 (kits do Kenney)

323 objetos da Coleção (dex #231 a #553) vêm dos kits low-poly do [Kenney](https://kenney.nl).
Todos são **CC0 1.0** (domínio público, conforme o `License.txt` de cada kit). Dá pra usar em
projeto comercial sem pedir nada; o crédito é opcional, mas fica aqui: **modelos por Kenney (www.kenney.nl)**.

Kits usados: Food Kit, Furniture Kit, Car Kit, Nature Kit, Holiday Kit, Mini Market, Train Kit,
Watercraft Kit, Space Kit, Survival Kit, Retro Urban Kit, Cube Pets, Mini Characters, Mini Skate,
Racing Kit, Platformer Kit, Fantasy Town Kit, Pirate Kit, Graveyard Kit e Factory Kit.

## Como funciona

- A lista fica em `src/config/kitCatalog.ts`. Cada entrada traz o modelo de origem, o tamanho em
  metros, o nome em português, a descrição, a classe, a raridade e onde aparece (`spawn`).
- `npm run pack` lê os GLB e grava `src/assets/props/props.pack` (~0,9 MB em gzip). No pacote, cada
  modelo é guardado assim:
  - triângulos com posição quantizada;
  - uma cor por triângulo, tirada da textura-paleta do kit ou da cor do material;
  - escalado, centrado, apoiado no chão e com o lado comprido em Z.
- No jogo, `src/assets/PropPack.ts` baixa o pacote junto com o boot e registra os modelos como `kit:<id>`.
  Eles ganham o mesmo sombreamento dos modelos procedurais (oclusão no pé, faces de baixo mais escuras).
- `spawn` coloca o objeto em cada lugar:
  - na calçada ou no terreno de um distrito (`R1.5`);
  - entre os raros de um distrito (`r:U1`);
  - nas vagas (`car`, `carH`);
  - na água (`boat`). Navio grande só onde cabe;
  - no pátio industrial (`yard`), com trens montados em fila;
  - na base aérea (`base`);
  - no centro da praça (`praca`);
  - no sítio (`farm`);
  - no topo dos prédios (`roof`).

## Atualizar

```bash
npm install
npm run fetch                                      # baixa os kits pra source/ (fora do git)
node --experimental-strip-types pack.mjs           # gera src/assets/props/props.pack
npm run preview food-kit 0 64                      # folha de prévia de um kit (servidor estático em :8765)
```

Kits antigos (Furniture, Nature, Space, Racing) gravaram cor sRGB no `baseColorFactor`. O `pack.mjs`
converte esses casos pra cor não sair desbotada.
