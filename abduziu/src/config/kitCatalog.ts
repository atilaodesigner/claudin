/**
 * Objects built from CC0 low-poly kits by Kenney (www.kenney.nl, Creative Commons Zero).
 *
 * Each entry is a model and its dex entry. `tools/props` packs the listed GLB files
 * into `public/props/props.bin` (sized to `h` meters tall or `s` meters on the longest
 * side) and the game loads them as models named `kit:<id>`.
 *
 * `spawn` says where it shows up, as space-separated codes with a weight:
 *   R1.5         loose prop in that district (R, V, C, P, S, I, F, U, A, K, Q, G, M, L, B)
 *   r:U1         rare in that district
 *   car1 carH1   parked at the curb (light / heavy table)
 *   boat1        floating on any city's water
 *   yard1        industrial yard (trains, big machines)
 *   base1        air base apron
 *   praca1       praça centerpiece
 *   farm1        sítio corner
 *   beach1       on the sand
 *   roof1        on top of office towers
 */
import type { ObjectDef, ObjectTag, Rarity } from './objects';

export interface KitPart {
  src: string;
  x?: number;
  y?: number;
  z?: number;
  /** Degrees around Y. */
  ry?: number;
}

export interface KitEntry {
  id: string;
  /** "<kit>/<file>" without extension, or several parts glued together. */
  src: string | readonly KitPart[];
  /** Target height in meters, or longest side in meters. */
  h?: number;
  s?: number;
  /** Degrees around Y applied after sizing (to face +Z like the procedural models). */
  ry?: number;
  name: string;
  tier: number;
  kg: number;
  tags: readonly ObjectTag[];
  desc: string;
  rarity?: Rarity;
  matterMult?: number;
  spawn?: string;
}

const K = (id: string, src: string | readonly KitPart[], size: number | { h: number }, name: string, tier: number, kg: number, tags: ObjectTag | readonly ObjectTag[], desc: string, spawn = '', extra: Partial<KitEntry> = {}): KitEntry => ({
  id,
  src,
  ...(typeof size === 'number' ? { s: size } : size),
  name,
  tier,
  kg,
  tags: typeof tags === 'string' ? [tags] : tags,
  desc,
  spawn,
  ...extra,
});

export const KIT: readonly KitEntry[] = [
  // ───────────── feira e sacolão
  K('banana', 'food-kit/banana', 0.55, 'Banana Prata', 0, 0.15, 'natureza', 'Escorregou da feira direto pra órbita. A casca ficou na calçada.', 'C1 K1 P.6 R.4 V.5'),
  K('maca', 'food-kit/apple', 0.4, 'Maçã', 0, 0.2, 'natureza', 'Uma por dia mantém o médico longe. E o ET perto.', 'C.8 K.6 P.4'),
  K('abacate', 'food-kit/avocado', 0.45, 'Abacate', 0, 0.4, 'natureza', 'No Brasil é com açúcar. No espaço também, decidimos.', 'C.7 U.6 R.3'),
  K('coco_quebrado', 'food-kit/coconut-half', 0.5, 'Coco Quebrado', 0, 0.8, 'natureza', 'Já beberam a água. Sobrou a polpa e a curiosidade.', 'A1.5 P.4'),
  K('laranja', 'food-kit/orange', 0.4, 'Laranja Pera', 0, 0.2, 'natureza', 'Dez por cinco reais, gritava o feirante. Agora é uma por zero.', 'C.8 K.5 U.5'),
  K('limao', 'food-kit/lemon', 0.35, 'Limão Taiti', 0, 0.1, 'natureza', 'Ia virar caipirinha. Virou combustível de disco voador.', 'C.6 A.5 K.4'),
  K('uva', 'food-kit/grapes', 0.45, 'Cacho de Uva', 0, 0.5, 'natureza', 'Da serra gaúcha, colhida no ponto. Pelo feixe.', 'C.5 K.3'),
  K('morango', 'food-kit/strawberry', 0.4, 'Morango do Amor', 0, 0.05, 'natureza', 'A febre da padaria. Fila de duas horas, abdução em dois segundos.', 'C.7 P.5 K.4', { rarity: 'incomum' }),
  K('cereja', 'food-kit/cherries', 0.4, 'Cereja do Bolo', 0, 0.05, 'natureza', 'Sempre foi o detalhe mais importante. Agora é do disco.', 'C.4 K.3'),
  K('pera', 'food-kit/pear', 0.42, 'Pera', 0, 0.2, 'natureza', 'Ninguém escolhe a pera. Os ETs escolheram.', 'C.4'),
  K('milho', 'food-kit/corn', 0.6, 'Espiga de Milho', 0, 0.3, 'natureza', 'Ia virar pamonha. Agora é pipoca estelar.', 'U1.5 C.6 K.4'),
  K('cenoura', 'food-kit/carrot', 0.55, 'Cenoura', 0, 0.1, 'natureza', 'Faz bem pra vista. Viu o disco antes de todo mundo.', 'C.5 U.6'),
  K('tomate', 'food-kit/tomato', 0.35, 'Tomate', 0, 0.15, 'natureza', 'Está mais caro que gasolina. Levamos assim mesmo.', 'C.7 K.4'),
  K('cebola', 'food-kit/onion', 0.35, 'Cebola', 0, 0.15, 'natureza', 'O feixe chorou. Primeira vez.', 'C.5'),
  K('berinjela', 'food-kit/eggplant', 0.55, 'Berinjela', 0, 0.3, 'natureza', 'Ninguém sabe fazer direito. Os ETs também não.', 'C.4'),
  K('brocolis', 'food-kit/broccoli', 0.5, 'Brócolis', 0, 0.4, 'natureza', 'Árvore em miniatura. Abduzida em tamanho natural.', 'C.4'),
  K('repolho', 'food-kit/cabbage', 0.5, 'Repolho', 0, 1, 'natureza', 'Virava salada de maionese no domingo. Domingo cancelado.', 'C.4 U.4'),
  K('abobora', 'food-kit/pumpkin', 0.7, 'Abóbora Moranga', 1, 5, 'natureza', 'Camarão na moranga? Não, ET na moranga.', 'U1 C.5'),
  K('cogumelo', 'food-kit/mushroom', 0.4, 'Champignon', 0, 0.05, 'natureza', 'Em conserva era melhor. Mas tudo bem.', 'C.3 M.6'),
  K('couve_flor', 'food-kit/cauliflower', 0.5, 'Couve-flor', 0, 0.8, 'natureza', 'Parece um cérebro. Os cientistas da nave adoraram.', 'C.3'),
  K('beterraba', 'food-kit/beet', 0.55, 'Beterraba', 0, 0.2, 'natureza', 'Mancha tudo. Inclusive o compartimento de carga.', 'C.3 U.3'),
  K('pimentao', 'food-kit/paprika', 0.45, 'Pimentão', 0, 0.15, 'natureza', 'Verde, amarelo ou vermelho. Esse é o vermelho, o caro.', 'C.4'),
  K('rabanete', 'food-kit/radish', 0.4, 'Rabanete', 0, 0.05, 'natureza', 'Ninguém comprou. Nem sabiam que vendia.', 'C.3 U.3'),

  // ───────────── padaria, lanchonete e cozinha
  K('pao_forma', 'food-kit/loaf', 0.6, 'Pão de Forma', 0, 0.5, 'lixo', 'Com a ponta guardada, como manda a tradição.', 'R.8 C.8 V.5'),
  K('pao_italiano', 'food-kit/loaf-round', 0.55, 'Pão Italiano', 0, 0.8, 'lixo', 'A padaria jura que é de fermentação natural.', 'C.6 K.5'),
  K('baguete', 'food-kit/loaf-baguette', 0.9, 'Baguete', 0, 0.3, 'lixo', 'Chique demais pro café da manhã. Perfeita pra espada.', 'C.5 F.4'),
  K('croissant', 'food-kit/croissant', 0.5, 'Croissant da Padaria', 0, 0.1, 'lixo', 'Recheado de presunto e queijo, como nenhum francês aprovaria.', 'C.6 F.6'),
  K('bolo_aniversario', 'food-kit/cake-birthday', 0.75, 'Bolo de Aniversário', 1, 3, 'movel', 'Parabéns pra você, nesta data querida... pro espaço.', 'R.5 V.5 C.3', { rarity: 'incomum' }),
  K('bolo_morango', 'food-kit/cake', 0.7, 'Bolo de Morango', 1, 2.5, 'movel', 'Da vitrine da confeitaria. Sobrou só a etiqueta do preço.', 'C.5 K.4'),
  K('cupcake', 'food-kit/cupcake', 0.4, 'Cupcake', 0, 0.1, 'lixo', 'Bolinho com nome em inglês, preço em dólar.', 'C.5 F.5'),
  K('rosquinha', 'food-kit/donut-sprinkles', 0.45, 'Rosquinha Colorida', 0, 0.1, 'lixo', 'Granulado espalhado por três quarteirões.', 'C.6 F.5 P.4'),
  K('rosquinha_choco', 'food-kit/donut-chocolate', 0.45, 'Rosquinha de Chocolate', 0, 0.1, 'lixo', 'A da polícia sumiu. Começou uma investigação.', 'C.4 F.4'),
  K('biscoito_recheado', 'food-kit/cookie-chocolate', 0.4, 'Biscoito Recheado', 0, 0.02, 'lixo', 'Abre, lambe o recheio, abduz.', 'R.6 V.6 C.4'),
  K('cookie', 'food-kit/cookie', 0.4, 'Cookie Gigante', 0, 0.1, 'lixo', 'Gotas de chocolate e muita confiança.', 'C.4 F.4'),
  K('waffle', 'food-kit/waffle', 0.5, 'Waffle', 0, 0.2, 'lixo', 'Café da manhã de hotel. O hóspede está no 9º andar procurando.', 'F.4 C.3'),
  K('panqueca', 'food-kit/pancakes', 0.5, 'Pilha de Panquecas', 0, 0.5, 'lixo', 'Com mel escorrendo pelo feixe.', 'C.3 F.3'),
  K('torta', 'food-kit/pie', 0.6, 'Torta da Vó', 1, 1.5, 'lixo', 'Esfriando na janela. Sumiu. A vó já culpou o vizinho.', 'R.6 V.4'),
  K('pizza', 'food-kit/pizza', 0.75, 'Pizza de Calabresa', 0, 1, 'lixo', 'Chegou em menos de 30 minutos. No endereço errado: a órbita.', 'R.5 C.6 F.4'),
  K('caixa_pizza', 'food-kit/pizza-box', 0.7, 'Caixa de Pizza', 0, 0.3, 'lixo', 'Vazia, mas ainda cheirosa. O feixe não resistiu.', 'R.6 V.6 C.4'),
  K('x_burguer', 'food-kit/burger', 0.55, 'X-Burguer', 0, 0.3, 'lixo', 'Do trailer da esquina. Com batata palha, claro.', 'R.5 V.5 C.6 S.5'),
  K('x_tudo', 'food-kit/burger-cheese-double', 0.65, 'X-Tudo', 0, 0.6, 'lixo', 'Ovo, bacon, milho, ervilha e o ET. X-Tudo mesmo.', 'C.6 V.5 S.4', { rarity: 'incomum' }),
  K('x_salada', 'food-kit/burger-double', 0.6, 'X-Salada Duplo', 0, 0.5, 'lixo', 'A alface é só pra dizer que é saudável.', 'C.5 R.4'),
  K('cachorro_quente', 'food-kit/hot-dog', 0.65, 'Cachorro-quente Prensado', 0, 0.3, 'lixo', 'Purê, vinagrete, batata palha e duas salsichas. O completo.', 'C.6 S.6 P.5 V.4'),
  K('batata_frita', 'food-kit/fries', 0.45, 'Batata Frita', 0, 0.2, 'lixo', 'Uma porção pra dividir. Ninguém dividiu.', 'C.5 F.4 A.4'),
  K('misto_quente', 'food-kit/sandwich', 0.45, 'Misto-quente', 0, 0.2, 'lixo', 'Da chapa da padaria, cortado na diagonal como deve ser.', 'C.6 R.4'),
  K('sanduiche_metro', 'food-kit/sub', 0.9, 'Sanduíche de Metro', 1, 2, 'lixo', 'Um metro de pão, meio metro de recheio, zero de vergonha.', 'C.4 F.4'),
  K('salsicha_empanada', 'food-kit/corn-dog', 0.6, 'Salsicha Empanada', 0, 0.15, 'lixo', 'Clássico da festa junina e de toda rodoviária.', 'C.4 S.5 P.4'),
  K('espetinho', 'food-kit/skewer', 0.7, 'Espetinho de Carne', 0, 0.2, 'lixo', 'Três reais com farofa. O espeto já era.', 'C.6 S.6 V.6 P.4'),
  K('espetinho_legumes', 'food-kit/skewer-vegetables', 0.7, 'Espetinho de Legumes', 0, 0.2, 'lixo', 'O vegetariano do churrasco ficou sem nada.', 'C.3 S.3'),
  K('costela', 'food-kit/meat-ribs', 0.8, 'Costela Fogo de Chão', 1, 4, 'lixo', 'Doze horas no fogo e dois segundos no feixe.', 'S.4 U.4'),
  K('picanha', 'food-kit/meat-cooked', 0.6, 'Picanha', 0, 1.2, 'lixo', 'Com a capa de gordura, mal passada. O churrasqueiro chorou.', 'S.5 R.4 V.4'),
  K('linguica', 'food-kit/meat-sausage', 0.6, 'Linguiça Toscana', 0, 0.4, 'lixo', 'Entrada do churrasco. Saída pela atmosfera.', 'S.5 R.3'),
  K('pernil', 'food-kit/whole-ham', 0.75, 'Pernil de Natal', 1, 6, 'lixo', 'Assado desde ontem. A ceia vai ser só farofa.', 'R.4 V.3'),
  K('chester', 'food-kit/turkey', 0.75, 'Chester da Ceia', 1, 4, 'lixo', 'Ninguém nunca viu um chester vivo. Nem o ET.', 'R.4'),
  K('tilapia', 'food-kit/fish', 0.7, 'Tilápia', 0, 1, 'animal', 'Pescada no pesqueiro, abduzida no estacionamento.', 'C.4 A.5 U.3'),
  K('ovo_frito', 'food-kit/egg-cooked', 0.45, 'Ovo Frito', 0, 0.05, 'lixo', 'Gema mole. Escorreu pelo feixe inteiro.', 'R.4 C.3'),
  K('ovo_caipira', 'food-kit/egg', 0.35, 'Ovo Caipira', 0, 0.06, 'lixo', 'A galinha não gostou nada disso.', 'U1 R.3'),
  K('queijo_minas', 'food-kit/cheese', 0.6, 'Queijo Minas', 0, 1, 'lixo', 'Curado, da serra. Mineiro guarda até de ET.', 'C.5 K.5 U.6'),
  K('mel', 'food-kit/honey', 0.45, 'Pote de Mel', 0, 0.5, 'lixo', 'As abelhas vieram atrás. Até o espaço.', 'C.4 U.5'),
  K('doce_de_leite', 'food-kit/peanut-butter', 0.45, 'Pote de Doce de Leite', 0, 0.5, 'lixo', 'Comido de colher, escondido, na porta da geladeira.', 'C.4 K.4 R.3'),
  K('refri_2l', 'food-kit/soda-bottle', 0.7, 'Refri de 2 Litros', 0, 2, 'lixo', 'O almoço de domingo ficou sem gás. Literalmente.', 'R.8 V.8 C.6 S.5'),
  K('copao_refri', 'food-kit/soda', 0.55, 'Copão de Refri', 0, 0.5, 'lixo', 'Tamanho família, refil infinito.', 'C.4 F.4 P.3'),
  K('cafezinho', 'food-kit/cup-coffee', 0.35, 'Cafezinho', 0, 0.1, 'lixo', 'Passado na hora. Toma um, ET?', 'C.6 F.6 K.4'),
  K('caneca', 'food-kit/mug', 0.4, 'Caneca do Escritório', 0, 0.3, 'lixo', '"Melhor funcionário do mês". Era mentira.', 'F.6 C.3'),
  K('cafe_gelado', 'food-kit/frappe', 0.5, 'Café Gelado', 0, 0.4, 'lixo', 'Com chantili, canudo e nome escrito errado no copo.', 'F.5 C.4'),
  K('caixinha_leite', 'food-kit/carton', 0.55, 'Caixinha de Leite', 0, 1, 'lixo', 'Validade amanhã. Ou nunca mais.', 'R.6 V.5 C.4'),
  K('achocolatado', 'food-kit/carton-small', 0.4, 'Achocolatado de Caixinha', 0, 0.2, 'lixo', 'Lanche da escola. Ninguém devolveu o canudo.', 'R.6 V.5 S.4'),
  K('ketchup', 'food-kit/bottle-ketchup', 0.45, 'Ketchup', 0, 0.4, 'lixo', 'Só sai quando não precisa.', 'C.4 S.3'),
  K('mostarda', 'food-kit/bottle-musterd', 0.45, 'Mostarda', 0, 0.4, 'lixo', 'Sempre sobra. Agora não sobra.', 'C.3 S.3'),
  K('oleo', 'food-kit/bottle-oil', 0.55, 'Garrafa de Óleo', 0, 0.9, 'lixo', 'A mais cara do mercado. Escolhemos bem.', 'C.4 R.3'),
  K('sorvete', 'food-kit/ice-cream', 0.55, 'Sorvete de Casquinha', 0, 0.2, 'lixo', 'Derreteu na mão, congelou no espaço.', 'A1 P.6 C.4'),
  K('picole', 'food-kit/popsicle', 0.5, 'Picolé de Fruta', 0, 0.08, 'lixo', 'Do carrinho da praia. O vendedor gritou "olha o picolé!" pro céu.', 'A1 P.5 S.4'),
  K('sundae', 'food-kit/sundae', 0.5, 'Sundae', 0, 0.3, 'lixo', 'Calda quente, sorvete gelado, feixe morno.', 'F.4 C.3'),
  K('copinho_sorvete', 'food-kit/ice-cream-cup', 0.45, 'Copinho de Sorvete', 0, 0.2, 'lixo', 'Napolitano, e o morango sobrou como sempre.', 'P.4 A.5'),
  K('chocolate', 'food-kit/chocolate', 0.5, 'Barra de Chocolate', 0, 0.2, 'lixo', 'Escondida no fundo da geladeira. Achada pelo radar.', 'C.4 R.4'),
  K('pirulito', 'food-kit/lollypop', 0.55, 'Pirulito', 0, 0.05, 'lixo', 'Doce de troco da padaria.', 'C.5 V.5 P.4'),
  K('panela_feijoada', 'food-kit/pot-stew', 0.7, 'Panelão de Feijoada', 1, 12, 'movel', 'Sábado, uma da tarde. O feijão tinha tudo, menos final feliz.', 'R.5 V.5 K.4', { rarity: 'incomum' }),
  K('frigideira', 'food-kit/frying-pan', 0.75, 'Frigideira de Ferro', 0, 2.5, 'movel', 'Passou de geração em geração. A próxima geração é alienígena.', 'R.4 V.4'),
  K('panela', 'food-kit/pot', 0.6, 'Panela de Arroz', 0, 3, 'movel', 'O arroz grudou no fundo. Agora grudou na nave.', 'R.4 V.4'),
  K('tabua_carne', 'food-kit/cutting-board', 0.7, 'Tábua de Carne', 0, 1, 'movel', 'Do churrasco de domingo, ainda com o sal grosso.', 'S.3 R.3'),
  K('pilao', 'food-kit/mortar-pestle', 0.45, 'Pilão de Tempero', 0, 2, 'movel', 'Socava alho desde 1987.', 'K.4 U.4'),
  K('barril_chope', 'food-kit/barrel', 0.9, 'Barril de Chope', 1, 50, 'movel', 'Da festa da firma. A firma ficou sem festa.', 'C.5 S.4 F.3'),
  K('sacola_pao', 'food-kit/bag', 0.55, 'Saco de Pão', 0, 0.6, 'lixo', 'Dez pãezinhos e um sonho. O sonho era abduzir.', 'R.6 V.5 C.4'),
  K('quentinha', 'food-kit/styrofoam-dinner', 0.5, 'Quentinha de Isopor', 0, 0.6, 'lixo', 'Arroz, feijão, bife e farofa. O PF do trabalhador.', 'I.6 C.5 F.4'),
  K('yakisoba', 'food-kit/chinese', 0.5, 'Yakisoba na Caixinha', 0, 0.5, 'lixo', 'Da feira de domingo. O hashi ficou.', 'C.4 F.4'),
  K('oniguiri', 'food-kit/rice-ball', 0.4, 'Oniguiri', 0, 0.1, 'lixo', 'Bolinho de arroz da Liberdade, embrulhado em alga.', 'C.3 F.3'),
  K('sushi', 'food-kit/maki-salmon', 0.4, 'Uramaki de Salmão', 0, 0.05, 'lixo', 'Rodízio japonês. Comeram a nave inteira.', 'F.4 C.3'),
  K('chantilly', 'food-kit/whipped-cream', 0.5, 'Lata de Chantilly', 0, 0.3, 'lixo', 'Psssshhh. O feixe ficou branquinho.', 'C.3'),

  // ───────────── casa e escritório
  K('cama_casal', 'furniture-kit/bedDouble', 2.1, 'Cama de Casal', 2, 80, 'movel', 'Ainda quentinha. Os donos foram trabalhar sem saber.', 'R.4 V.3'),
  K('beliche', 'furniture-kit/bedBunk', 2.0, 'Beliche', 2, 70, 'movel', 'Quem dorme em cima sempre ganha. Até agora.', 'R.3 V.4'),
  K('cama_solteiro', 'furniture-kit/bedSingle', 2.0, 'Cama de Solteiro', 1, 40, 'movel', 'Encostada na parede da república.', 'R.3 V.3'),
  K('banheira', 'furniture-kit/bathtub', 1.7, 'Banheira', 2, 90, 'movel', 'Ainda com a espuma. E o patinho de borracha.', 'R.3'),
  K('privada', 'furniture-kit/toilet', 0.8, 'Vaso Sanitário', 1, 25, 'movel', 'Ocupado? Não mais.', 'R.3 V.4 I.3'),
  K('pia', 'furniture-kit/bathroomSink', 0.9, 'Pia do Banheiro', 1, 20, 'movel', 'A torneira pinga desde a Copa de 2014.', 'R.2 V.3'),
  K('maquina_lavar', 'furniture-kit/washer', 1.0, 'Máquina de Lavar', 1, 60, 'movel', 'Centrifugou no último ciclo: o de abdução.', 'R.5 V.5'),
  K('secadora', 'furniture-kit/dryer', 1.0, 'Secadora', 1, 55, 'movel', 'Encolheu a camisa de time. E a dignidade do dono.', 'R.3'),
  K('geladeira_duplex', 'furniture-kit/kitchenFridgeLarge', 1.9, 'Geladeira Duplex', 2, 110, 'movel', 'Cheia de pote de sorvete com feijão dentro.', 'R.3 C.3'),
  K('fogao', 'furniture-kit/kitchenStove', 1.0, 'Fogão de 4 Bocas', 1, 35, 'movel', 'Uma boca não acende desde que compraram.', 'R.4 V.5'),
  K('microondas', 'furniture-kit/kitchenMicrowave', 0.6, 'Micro-ondas', 1, 15, 'movel', 'Apitou três vezes e sumiu. Ninguém tirou a pipoca.', 'R.5 V.4 F.3'),
  K('liquidificador', 'furniture-kit/kitchenBlender', 0.5, 'Liquidificador', 0, 3, 'movel', 'Seis da manhã, vitamina de banana, vizinho acordado.', 'R.5 V.4'),
  K('cafeteira', 'furniture-kit/kitchenCoffeeMachine', 0.5, 'Cafeteira', 0, 4, 'movel', 'O escritório parou. Ninguém trabalha sem ela.', 'F.6 R.3'),
  K('torradeira', 'furniture-kit/toaster', 0.4, 'Torradeira', 0, 2, 'movel', 'Pulou o pão e pulou a torradeira junto.', 'R.4'),
  K('sofa_retratil', 'furniture-kit/loungeSofa', 2.2, 'Sofá Retrátil', 2, 70, 'movel', 'Retrátil, reclinável e agora orbital.', 'R.4 V.4'),
  K('sofa_couro', 'furniture-kit/loungeDesignSofa', 2.2, 'Sofá de Couro', 2, 80, 'movel', 'Do escritório da diretoria. A diretoria está no telhado.', 'F.4'),
  K('poltrona', 'furniture-kit/loungeChair', 1.1, 'Poltrona do Vô', 1, 30, 'movel', 'Ninguém senta nela. Era sagrada.', 'R.5 V.3'),
  K('cadeira_escritorio', 'furniture-kit/chairDesk', 1.1, 'Cadeira de Escritório', 1, 15, 'movel', 'Rodinhas, regulagem de altura e a função "girar até enjoar".', 'F.8 C.3'),
  K('escrivaninha', 'furniture-kit/desk', 1.4, 'Escrivaninha', 1, 35, 'movel', 'Cheia de boletos. Agora são problema do espaço.', 'F.5 R.3'),
  K('monitor', 'furniture-kit/computerScreen', 0.6, 'Monitor', 0, 4, 'movel', 'Com post-it da senha colado na borda.', 'F.7 C.3'),
  K('notebook', 'furniture-kit/laptop', 0.45, 'Notebook', 0, 2, 'movel', 'Estava atualizando. Não desligue o computador.', 'F.6 C.3 R.3'),
  K('smart_tv', 'furniture-kit/televisionModern', 1.3, 'Smart TV de 65"', 1, 25, 'movel', 'Comprada em 12 vezes sem juros. Faltam 11.', 'R.4 V.4 C.3'),
  K('estante', 'furniture-kit/bookcaseOpen', 1.9, 'Estante de Livros', 1, 50, 'movel', 'Livros de enfeite e uma bíblia de 1980.', 'R.3 F.3'),
  K('abajur', 'furniture-kit/lampRoundFloor', 1.7, 'Abajur de Pé', 0, 5, 'movel', 'Iluminou a abdução. Ironia.', 'R.4'),
  K('ventilador_teto', 'furniture-kit/ceilingFan', 1.2, 'Ventilador de Teto', 1, 8, 'movel', 'Na velocidade três, quase voava sozinho.', 'R.3 V.3'),
  K('planta_ap', 'furniture-kit/pottedPlant', 1.0, 'Costela-de-adão', 0, 6, 'natureza', 'A planta de todo apartamento de 2020.', 'R.5 F.5 C.3'),
  K('suculenta', 'furniture-kit/plantSmall2', 0.35, 'Suculenta', 0, 0.3, 'natureza', 'Não precisa de água. Nem de gravidade.', 'R.4 F.4'),
  K('cabideiro', 'furniture-kit/coatRackStanding', 1.8, 'Cabideiro', 0, 6, 'movel', 'Tinha um guarda-chuva esquecido desde 2019.', 'F.3 R.3'),
  K('mesa_centro', 'furniture-kit/tableCoffee', 1.2, 'Mesa de Centro', 1, 20, 'movel', 'Tampo de vidro e um controle remoto sem pilha.', 'R.4'),
  K('mesa_redonda', 'furniture-kit/tableRound', 1.3, 'Mesa Redonda', 1, 30, 'movel', 'Onde a família discute política no Natal.', 'R.3 C.3'),
  K('lixeira_pedal', 'furniture-kit/trashcan', 0.6, 'Lixinho de Pedal', 0, 2, 'lixo', 'Pisou, abriu. Abduziu, fechou.', 'R.4 F.4'),
  K('tapete', 'furniture-kit/rugRound', 1.6, 'Tapete Redondo', 0, 4, 'movel', 'Debaixo dele, a poeira de três anos.', 'R.3'),
  K('travesseiro', 'furniture-kit/pillow', 0.6, 'Travesseiro', 0, 0.8, 'movel', 'Babado na fronha, como manda o figurino.', 'R.4 V.3'),
  K('urso_pelucia', 'furniture-kit/bear', 0.7, 'Ursinho de Pelúcia', 0, 0.5, 'movel', 'Ganhado no parque de diversões, guardado por 15 anos.', 'R.5 V.5 P.3', { rarity: 'incomum' }),
  K('caixa_mudanca', 'furniture-kit/cardboardBoxOpen', 0.7, 'Caixa de Mudança', 0, 8, 'lixo', 'Escrito "FRÁGIL" e "COZINHA". Era o banheiro.', 'R.6 V.5 C.4'),
  K('banqueta', 'furniture-kit/stoolBar', 0.9, 'Banqueta de Balcão', 0, 5, 'movel', 'Do boteco. Girava e rangia.', 'C.5 V.4'),
  K('criado_mudo', 'furniture-kit/sideTableDrawers', 0.7, 'Criado-mudo', 1, 12, 'movel', 'Na gaveta: carregador, moedas e um terço.', 'R.3'),
  K('rack_tv', 'furniture-kit/cabinetTelevision', 1.6, 'Rack da TV', 1, 30, 'movel', 'Cheio de DVD pirata.', 'R.3 V.3'),
  K('chuveiro', 'furniture-kit/showerRound', 2.1, 'Box do Chuveiro', 1, 40, 'movel', 'Água quente só no inverno. Esse inverno nem chegou.', 'R.2'),

  // ───────────── carros, utilitários e serviços
  K('ambulancia', 'car-kit/ambulance', 5.4, 'Ambulância', 4, 3500, 'van', 'Sirene ligada. A emergência agora é dela.', 'carH.8 car.3', { matterMult: 1.5 }),
  K('bombeiro', 'car-kit/firetruck', 7.5, 'Caminhão de Bombeiro', 5, 14000, 'caminhao', 'Vieram apagar o feixe. Não deu.', 'carH.5', { matterMult: 1.6 }),
  K('furgao', 'car-kit/delivery', 5.2, 'Van de Entregas', 4, 2800, 'van', 'Seu pedido saiu para entrega. Pra Marte.', 'carH1.4 car.4'),
  K('furgao_aberto', 'car-kit/delivery-flat', 5.2, 'Furgão de Carroceria', 4, 2600, 'van', 'Carregava cadeira de plástico pra uma festa. A festa é aqui em cima.', 'carH.8'),
  K('hatch_rebaixado', 'car-kit/hatchback-sports', 4.0, 'Hatch Rebaixado', 3, 1000, 'carro', 'Som no porta-malas, suspensão no chão, dignidade no espaço.', 'car1.2', { rarity: 'incomum' }),
  K('esportivo', 'car-kit/sedan-sports', 4.4, 'Esportivo Vermelho', 3, 1400, 'carro', 'Zero a cem em 4 segundos. Zero ao espaço em 2.', 'car.6 r:F1', { rarity: 'raro', matterMult: 2 }),
  K('suv', 'car-kit/suv', 4.6, 'SUV da Firma', 3, 1800, 'carro', 'Nunca saiu do asfalto. Agora saiu do planeta.', 'car1.2 carH.6'),
  K('suv_luxo', 'car-kit/suv-luxury', 4.8, 'SUV Blindado', 4, 2600, 'carro', 'Blindagem nível 3. Feixe nível 9.', 'car.5 r:F.8', { rarity: 'incomum', matterMult: 1.6 }),
  K('carro_corrida', 'car-kit/race', 4.3, 'Carro de Arrancada', 3, 900, 'carro', 'Fazia 400 metros em 8 segundos. Fez 400 km em 3.', 'r:S1 r:I.6', { rarity: 'raro', matterMult: 2.5 }),
  K('carro_futuro', 'car-kit/race-future', 4.4, 'Protótipo Futurista', 3, 800, 'carro', 'Era o carro do futuro. O futuro chegou de disco.', 'r:F.6 r:I.5', { rarity: 'epico', matterMult: 4 }),
  K('van_excursao', 'car-kit/van', 5.0, 'Van da Excursão', 4, 2700, 'van', 'Destino: Aparecida. Desvio: Andrômeda.', 'carH1 car.3'),
  K('caminhao_toco', 'car-kit/truck', 7.0, 'Caminhão Toco', 5, 8000, 'caminhao', 'Carga de tijolo baiano. Mudança de planeta.', 'carH.6'),
  K('caminhao_prancha', 'car-kit/truck-flat', 7.0, 'Caminhão Prancha', 5, 7000, 'caminhao', 'Levava um trator. Agora leva saudade.', 'carH.4'),
  K('retroescavadeira', 'car-kit/tractor-shovel', 6.0, 'Retroescavadeira', 5, 8500, 'caminhao', 'Abria buraco na rua há seis meses. A obra acabou.', 'yard.8 carH.3'),
  K('kart', 'car-kit/kart-oodi', 1.8, 'Kart', 2, 150, 'moto', 'Do kartódromo do shopping. A volta mais rápida da história.', 'S.4 r:P.5'),
  K('pneu', 'car-kit/debris-tire', 0.9, 'Pneu Velho', 1, 10, 'lixo', 'Acumulava água da chuva. A dengue agradece o fim.', 'R.4 V.6 I.6 U.4'),
  K('roda', 'car-kit/wheel-default', 0.8, 'Roda Solta', 1, 15, 'lixo', 'Era do hatch da frente. O hatch também sumiu.', 'I.4 V.3'),

  // ───────────── natal e festas
  K('arvore_natal', 'holiday-kit/tree-decorated', 3.2, 'Árvore de Natal', 2, 30, 'natureza', 'Montada em novembro, desmontada pelos ETs.', 'P.4 C.4 F.3', { rarity: 'incomum' }),
  K('presente', 'holiday-kit/present-a-cube', 0.55, 'Presente de Natal', 0, 1, 'lixo', 'Era meia. Sempre é meia.', 'R.5 C.4 P.3'),
  K('presente_redondo', 'holiday-kit/present-b-round', 0.55, 'Presente Redondo', 0, 1, 'lixo', 'Formato estranho, laço gigante. Parece uma bola. É uma bola.', 'R.4 C.3'),
  K('boneco_neve', 'holiday-kit/snowman', { h: 1.7 }, 'Boneco de Neve de Gramado', 1, 60, 'estrutura', 'Feito de isopor, como manda o Natal brasileiro.', 'P.3 C.3 r:R.6', { rarity: 'raro' }),
  K('quebra_nozes', 'holiday-kit/nutcracker', { h: 2.2 }, 'Quebra-nozes de Shopping', 1, 40, 'estrutura', 'Vigiava a decoração do shopping. Falhou.', 'C.3 F.3'),
  K('rena', 'holiday-kit/reindeer', { h: 1.6 }, 'Rena de Decoração', 1, 30, 'animal', 'Do presépio luminoso da praça. Tem pilha até 2030.', 'P.3 r:C.6', { rarity: 'incomum' }),
  K('treno', 'holiday-kit/sled-long', 2.4, 'Trenó do Papai Noel', 2, 120, 'movel', 'Num país sem neve, só servia pra foto. Agora voa de verdade.', 'r:P1 r:C.6', { rarity: 'raro', matterMult: 3 }),
  K('lampiao', 'holiday-kit/lantern', 0.6, 'Lampião', 0, 2, 'movel', 'De festa junina. A quadrilha parou no "olha a chuva!".', 'K.5 U.5 S.4'),
  K('trenzinho', 'holiday-kit/train-locomotive', 1.0, 'Trenzinho de Brinquedo', 0, 3, 'movel', 'Rodava em volta da árvore de Natal desde 1994.', 'R.3 C.3'),
  K('biscoito_gengibre', 'holiday-kit/gingerbread-man', 0.5, 'Biscoito de Gengibre', 0, 0.05, 'lixo', 'Correu o mais rápido que pôde. Não deu.', 'C.4'),
  K('bengala_doce', 'holiday-kit/candy-cane-red', 0.8, 'Bengala Doce', 0, 0.1, 'lixo', 'Doce de vitrine. Ninguém come, todo mundo compra.', 'C.3 P.3'),
  K('guirlanda', 'holiday-kit/wreath-decorated', 0.8, 'Guirlanda', 0, 1, 'movel', 'Estava pendurada na porta. A porta continua lá.', 'R.4 C.3'),
  K('meia_natal', 'holiday-kit/sock-red', 0.6, 'Meia de Natal', 0, 0.2, 'lixo', 'Tinha uma tangerina e uma moeda de 50 centavos.', 'R.3'),
  K('pisca_pisca', 'holiday-kit/lights-colored', 1.2, 'Pisca-pisca', 0, 0.5, 'movel', 'Embolado. Ninguém nunca vai desembolar.', 'R.4 V.5 C.3'),

  // ───────────── mercadinho
  K('caixa_registradora', 'mini-market/cash-register', 0.6, 'Caixa Registradora', 1, 12, 'movel', 'Abriu sozinha. Pela primeira vez sem troco faltando.', 'C.5 K.3', { matterMult: 2 }),
  K('cestinha', 'mini-market/shopping-basket', 0.55, 'Cestinha de Mercado', 0, 1, 'lixo', 'Só ia comprar pão. Encheu a cesta. Sumiu a cesta.', 'C.6 R.3'),
  K('freezer', 'mini-market/freezer', 1.4, 'Freezer de Sorvete', 2, 90, 'movel', 'Da padaria, cheio de picolé de groselha.', 'C.5 A.4 P.3'),
  K('banca_frutas', 'mini-market/display-fruit', 1.6, 'Banca de Frutas', 2, 120, 'estrutura', 'Tudo fresquinho, freguesa. Tudo no feixe, freguesa.', 'C.6 K.5'),
  K('vitrine_paes', 'mini-market/display-bread', 1.6, 'Vitrine de Pães', 2, 100, 'estrutura', 'Sonho, bisnaga e pão de queijo. Saiu tudo quentinho.', 'C.5 K.4'),
  K('gondola', 'mini-market/shelf-boxes', 2.0, 'Gôndola de Mercado', 2, 140, 'estrutura', 'Corredor 7: produtos de limpeza e de outro planeta.', 'C.4 I.3'),
  K('atendente', 'mini-market/character-employee', { h: 1.7 }, 'Atendente do Mercadinho', 1, 65, 'pessoa', 'Ia chamar o gerente. O gerente foi chamado primeiro.', 'C.4 K.3'),

  // ───────────── bichos
  K('gato_malhado', 'cube-pets/animal-cat', { h: 0.55 }, 'Gato do Muro', 1, 4, 'animal', 'Caiu de pé. No disco.', 'R.8 V.8 K.5 C.4'),
  K('cachorro_bolinha', 'cube-pets/animal-dog', { h: 0.6 }, 'Cachorro Bolinha', 1, 8, 'animal', 'Late pra moto, pra carteiro e agora pra disco voador.', 'R.6 V.6 P.4'),
  K('porquinho', 'cube-pets/animal-pig', { h: 0.8 }, 'Porquinho', 1, 90, 'animal', 'Fugiu do chiqueiro e da feijoada.', 'U1.2 V.3'),
  K('vaca_mimosa', 'cube-pets/animal-cow', { h: 1.4 }, 'Vaca Mimosa', 2, 420, 'animal', 'Dá leite, dá carinho e agora dá audiência.', 'U1 r:U.6'),
  K('pintinho', 'cube-pets/animal-chick', { h: 0.4 }, 'Pintinho Amarelinho', 0, 0.1, 'animal', 'Cabe na mão, tão pequenininho. Cabe no feixe também.', 'U1.2 R.4 V.4', { rarity: 'incomum' }),
  K('coelho', 'cube-pets/animal-bunny', { h: 0.6 }, 'Coelho de Páscoa', 1, 3, 'animal', 'Não botava ovo nenhum. Agora a verdade apareceu.', 'P.4 U.5 R.3'),
  K('papagaio_louro', 'cube-pets/animal-parrot', { h: 0.55 }, 'Papagaio Louro', 1, 0.5, 'animal', 'Já sabia falar "socorro" em três idiomas.', 'R.4 V.5 M.5 K.4', { rarity: 'incomum' }),
  K('macaco_prego', 'cube-pets/animal-monkey', { h: 0.7 }, 'Macaco-prego', 1, 4, 'animal', 'Roubava salgadinho de turista. Os turistas venceram.', 'M1 P.4 V.4'),
  K('caranguejo', 'cube-pets/animal-crab', { h: 0.45 }, 'Caranguejo do Mangue', 0, 0.4, 'animal', 'Andava de lado, foi pra cima.', 'A1 W.0'),
  K('peixinho', 'cube-pets/animal-fish', { h: 0.5 }, 'Peixe-palhaço do Aquário', 0, 0.2, 'animal', 'Pulou do aquário da sala. Achou a saída.', 'R.3 C.3'),
  K('veado_campeiro', 'cube-pets/animal-deer', { h: 1.4 }, 'Veado-campeiro', 2, 35, 'animal', 'Vive nos pampas e no cerrado. Vivia.', 'U.6 M.6'),
  K('graxaim', 'cube-pets/animal-fox', { h: 0.7 }, 'Graxaim', 1, 6, 'animal', 'A raposa dos pampas. Esperta, mas não o suficiente.', 'U.6 M.5'),
  K('javaporco', 'cube-pets/animal-hog', { h: 0.9 }, 'Javaporco', 2, 120, 'animal', 'Praga do agro. O fazendeiro agradeceu de joelhos.', 'U.8 M.5'),
  K('leao_zoo', 'cube-pets/animal-lion', { h: 1.3 }, 'Leão do Zoológico', 2, 190, 'animal', 'Rei da selva, súdito do feixe.', 'r:P.5 r:M.4', { rarity: 'raro', matterMult: 3 }),
  K('elefante_zoo', 'cube-pets/animal-elephant', { h: 2.6 }, 'Elefante do Zoológico', 4, 5000, 'animal', 'Pesado demais pra qualquer coisa. Menos pra gente.', 'r:P.4 r:U.3', { rarity: 'raro', matterMult: 3 }),
  K('girafa_zoo', 'cube-pets/animal-giraffe', { h: 2.8 }, 'Girafa do Zoológico', 3, 800, 'animal', 'Viu o disco chegando antes de todo mundo.', 'r:P.4 r:M.3', { rarity: 'raro', matterMult: 3 }),
  K('tigre', 'cube-pets/animal-tiger', { h: 1.2 }, 'Tigre de Circo Aposentado', 2, 200, 'animal', 'Aposentado do picadeiro. Voltou à ativa na órbita.', 'r:P.4 r:S.3', { rarity: 'raro', matterMult: 3 }),
  K('panda', 'cube-pets/animal-panda', { h: 1.2 }, 'Panda Emprestado', 2, 110, 'animal', 'Estava num intercâmbio diplomático. Agora é um incidente.', 'r:P.3 r:F.3', { rarity: 'epico', matterMult: 5 }),
  K('pinguim', 'cube-pets/animal-penguin', { h: 0.7 }, 'Pinguim-de-Magalhães', 1, 4, 'animal', 'Pegou a corrente errada e veio parar no Brasil. De novo errado.', 'A.4 W.0 r:A.6', { rarity: 'incomum' }),
  K('abelha_jatai', 'cube-pets/animal-bee', { h: 0.5 }, 'Abelha Jataí', 0, 0.01, 'animal', 'Sem ferrão, toda fofa. O mel ficou pra trás.', 'U.6 P.4 M.4'),
  K('taturana', 'cube-pets/animal-caterpillar', { h: 0.5 }, 'Taturana', 0, 0.02, 'animal', 'Não encosta! O feixe encostou.', 'M.6 U.5 P.3'),
  K('urso_polar', 'cube-pets/animal-polar', { h: 1.3 }, 'Urso-polar Perdido', 2, 400, 'animal', 'Ninguém sabe como chegou aqui. Nem pra onde vai.', 'r:A.3 r:W.0', { rarity: 'epico', matterMult: 5 }),
  K('coala', 'cube-pets/animal-koala', { h: 0.8 }, 'Coala Turista', 1, 10, 'animal', 'Veio da Austrália de férias. Férias estendidas.', 'r:M.3 r:P.3', { rarity: 'raro', matterMult: 3 }),
  K('castor', 'cube-pets/animal-beaver', { h: 0.7 }, 'Castor Engenheiro', 1, 20, 'animal', 'Tentou fazer uma represa no esgoto. Melhor ir embora.', 'r:W.0 r:M.3', { rarity: 'raro', matterMult: 3 }),

  // ───────────── gente
  K('turista', 'mini-characters/character-female-b', { h: 1.7 }, 'Turista de Viseira', 1, 65, 'pessoa', 'Tirou selfie com o disco. Viralizou fora do planeta.', 'A.6 L.6 K.5 P.4'),
  K('vovo_igreja', 'mini-characters/character-female-c', { h: 1.6 }, 'Vó da Missa das Sete', 1, 60, 'pessoa', 'Rezou um terço inteiro durante a subida.', 'R.4 K.5 P.4'),
  K('executiva', 'mini-characters/character-female-d', { h: 1.7 }, 'Executiva do Café', 1, 62, 'pessoa', 'Tinha reunião às nove. Agora é remota.', 'F1 C.3'),
  K('cientista', 'mini-characters/character-female-e', { h: 1.7 }, 'Cientista da Federal', 1, 60, 'pessoa', 'Estudava vida fora da Terra. Agora estuda de perto.', 'F.4 r:B.6', { rarity: 'incomum' }),
  K('estudante', 'mini-characters/character-female-f', { h: 1.65 }, 'Estudante de Mochila', 1, 58, 'pessoa', 'Faltou na prova. Melhor desculpa da história.', 'R.4 C.4 P.4'),
  K('professor', 'mini-characters/character-male-a', { h: 1.75 }, 'Professor de Física', 1, 78, 'pessoa', 'Sempre disse que era possível. Ninguém acreditou.', 'C.3 F.3 P.3'),
  K('tiozao', 'mini-characters/character-male-b', { h: 1.7 }, 'Tiozão do Churrasco', 1, 95, 'pessoa', 'Largou a picanha na brasa pra filmar. Perdeu as duas.', 'R.5 S.5 V.4'),
  K('guarda_transito', 'mini-characters/character-male-c', { h: 1.75 }, 'Guarda de Trânsito', 1, 80, 'pessoa', 'Multou o disco por estacionar em local proibido.', 'C.5 F.5 L.4'),
  K('advogado', 'mini-characters/character-male-d', { h: 1.75 }, 'Advogado de Terno', 1, 80, 'pessoa', 'Já está preparando o processo contra a galáxia.', 'F.8 C.3'),
  K('vo_jardim', 'mini-characters/character-male-e', { h: 1.65 }, 'Vô do Jardim', 1, 70, 'pessoa', 'Regava as plantas de chinelo e meia. Clássico.', 'R.5 U.4'),
  K('ambulante', 'mini-characters/character-male-f', { h: 1.7 }, 'Vendedor Ambulante', 1, 72, 'pessoa', '"Olha a água, olha o mate!" Ele ainda grita lá de cima.', 'A.6 C.5 S.4 L.4'),
  K('skatista', 'mini-skate/character-skate-boy', { h: 1.7 }, 'Skatista da Praça', 1, 60, 'pessoa', 'Mandou um ollie tão alto que não voltou.', 'P.6 C.3'),
  K('skatista_mina', 'mini-skate/character-skate-girl', { h: 1.65 }, 'Skatista Radical', 1, 55, 'pessoa', 'Kickflip, heelflip e abduflip.', 'P.6 C.3'),
  K('astronauta', 'space-kit/astronautA', { h: 1.8 }, 'Astronauta da Agência', 1, 110, 'pessoa', 'Treinou a vida inteira pra ir ao espaço. Pegou carona.', 'r:B1 r:F.3', { rarity: 'raro', matterMult: 4 }),
  K('astronauta_b', 'space-kit/astronautB', { h: 1.8 }, 'Astronauta Reserva', 1, 110, 'pessoa', 'Era o reserva. Foi titular hoje.', 'r:B.6', { rarity: 'raro', matterMult: 4 }),
  K('alien_primo', 'space-kit/alien', { h: 1.4 }, 'Primo Alienígena', 1, 50, ['pessoa', 'secreto'], 'Estava disfarçado de turista há 30 anos. Finalmente voltou pra casa.', 'r:R.4 r:K.4 r:B.6', { rarity: 'alien', matterMult: 30 }),
  K('fantasma', 'graveyard-kit/character-ghost', { h: 1.6 }, 'Fantasma do Casarão', 1, 0.1, ['pessoa', 'secreto'], 'Assombrava o casarão desde 1890. Mudou de endereço.', 'r:K.6 r:U.3', { rarity: 'epico', matterMult: 15 }),
  K('esqueleto', 'graveyard-kit/character-skeleton', { h: 1.7 }, 'Esqueleto da Aula de Biologia', 1, 15, ['pessoa'], 'Saiu do laboratório da escola. Não tinha nada por dentro mesmo.', 'r:R.4 r:C.3', { rarity: 'raro', matterMult: 3 }),
  K('zumbi', 'graveyard-kit/character-zombie', { h: 1.7 }, 'Zumbi da Fantasia', 1, 70, ['pessoa'], 'Era só fantasia de Halloween. A gente achou que era sério.', 'r:V.4 r:C.3', { rarity: 'raro', matterMult: 3 }),
  K('vampiro', 'graveyard-kit/character-vampire', { h: 1.8 }, 'Vampiro de Festa à Fantasia', 1, 75, ['pessoa'], 'Fugiu do sol a vida inteira. Agora fica mais perto dele.', 'r:F.3 r:K.3', { rarity: 'raro', matterMult: 3 }),
  K('coveiro', 'graveyard-kit/character-keeper', { h: 1.75 }, 'Coveiro do Plantão', 1, 70, 'pessoa', 'Já viu de tudo. Agora viu mais.', 'K.3 U.3'),
  K('mascote_gelatina', 'platformer-kit/character-oobi', { h: 1.4 }, 'Mascote de Gelatina', 1, 30, ['pessoa', 'secreto'], 'Ninguém sabe de que marca é. Nem ele.', 'r:C.4 r:P.4 r:S.3', { rarity: 'epico', matterMult: 12 }),
  K('robo_operario', 'factory-kit/oopi', { h: 1.2 }, 'Robô Operário', 1, 120, ['pessoa', 'secreto'], 'Trabalhava três turnos sem reclamar. Pediu demissão pro feixe.', 'r:I1', { rarity: 'epico', matterMult: 12 }),

  // ───────────── acampamento, roça e obra
  K('barraca_camping', 'survival-kit/tent', 2.6, 'Barraca de Camping', 2, 15, 'movel', 'Montada torta, com o pessoal dentro. O pessoal reclamou.', 'U.6 M.6 A.4'),
  K('fogueira_sao_joao', 'survival-kit/campfire-pit', 1.6, 'Fogueira de São João', 1, 80, 'estrutura', 'Pula a fogueira, Iaiá! Pulou mesmo, foi pro céu.', 'U.6 S.5 P.4'),
  K('balde', 'survival-kit/bucket', 0.6, 'Balde', 0, 2, 'lixo', 'Lavava o carro na calçada todo sábado.', 'R.6 V.6 U.5'),
  K('bau_tesouro', 'survival-kit/chest', 0.9, 'Baú da Vó', 1, 25, 'movel', 'Fotos antigas, cartas de amor e um broche de ouro.', 'r:R.5 r:K.5 r:U.5', { rarity: 'raro', matterMult: 4 }),
  K('barril', 'survival-kit/barrel', 1.0, 'Tonel', 1, 60, 'movel', 'Guardava água da chuva no quintal.', 'U.6 I.5 V.4'),
  K('caixote', 'survival-kit/box-large', 1.0, 'Caixote de Madeira', 1, 20, 'lixo', 'Da feira, com cheiro de tomate.', 'C.5 I.5 K.4'),
  K('pa_obra', 'survival-kit/tool-shovel', 1.3, 'Pá de Obra', 0, 3, 'lixo', 'A obra parou. O pedreiro foi tomar café. Faz uma semana.', 'I.6 R.3 U.4'),
  K('martelo', 'survival-kit/tool-hammer', 0.5, 'Martelo', 0, 1, 'lixo', 'Vai que é seu, ET.', 'I.4 R.3'),
  K('bancada', 'survival-kit/workbench', 1.6, 'Bancada de Marceneiro', 1, 70, 'movel', 'Fazia móveis sob medida. Esse não coube no feixe. Coube.', 'I.4 U.4'),
  K('placa_trilha', 'survival-kit/signpost', 1.6, 'Placa de Trilha', 1, 15, 'estrutura', '"Cachoeira: 2 km". Desatualizada.', 'M.6 U.4'),
  K('saco_dormir', 'survival-kit/bedroll-packed', 0.6, 'Saco de Dormir', 0, 2, 'movel', 'Do retiro espiritual. Retiro mais longo que o previsto.', 'U.3 A.3'),
  K('tora', 'survival-kit/tree-log', 2.2, 'Tora de Madeira', 2, 300, 'natureza', 'Ia virar lenha pro fogão. Virou míssil.', 'U.6 M.6'),
  K('fardo_feno', 'graveyard-kit/hay-bale', 1.3, 'Fardo de Feno', 1, 30, 'natureza', 'A vaca vai sentir falta.', 'U1 S.3'),
  K('abobora_halloween', 'graveyard-kit/pumpkin-carved', 0.7, 'Abóbora de Halloween', 0, 4, 'lixo', 'Brasileiro também comemora. Com coxinha.', 'R.3 C.3 r:R.4', { rarity: 'incomum' }),
  K('caixao', 'graveyard-kit/coffin', 2.1, 'Caixão de Funerária', 2, 60, 'movel', 'Vazio, graças a Deus. Ia ser entregue amanhã.', 'r:K.3 r:C.3', { rarity: 'raro', matterMult: 2 }),
  K('lapide', 'graveyard-kit/gravestone-round', 1.1, 'Lápide', 2, 200, 'estrutura', '"Aqui jaz". Jazia.', 'K.3'),
  K('braseiro', 'graveyard-kit/fire-basket', 1.2, 'Braseiro', 1, 30, 'movel', 'Esquentava o pessoal da vigília. A vigília acabou.', 'U.4 K.3'),

  // ───────────── natureza
  K('palmeira_imperial', 'nature-kit/tree_palmTall', 9, 'Palmeira Imperial', 4, 1500, 'natureza', 'Plantada por Dom Pedro, abduzida por nós.', 'P.4 L.4 G.4'),
  K('pinheiro', 'nature-kit/tree_pineRoundC', 6, 'Pinheiro', 3, 900, 'natureza', 'Cheirinho de serra gaúcha.', 'U.4 M.4 R.3'),
  K('arvore_outono', 'nature-kit/tree_default_fall', 6, 'Plátano de Outono', 3, 700, 'natureza', 'As folhas caíram. A árvore subiu.', 'R.3 P.3 Q.3'),
  K('arvore_redonda', 'nature-kit/tree_oak', 6, 'Árvore Frondosa', 3, 900, 'natureza', 'Dava sombra pro carro inteiro. Agora o carro torra.', 'R.3 P.3 Q.3 U.3'),
  K('pe_milho', 'nature-kit/crops_cornStageD', 2.2, 'Pé de Milho', 1, 5, 'natureza', 'Espiga no ponto pra festa junina.', 'U1.5'),
  K('melao_pe', 'nature-kit/crop_melon', 0.9, 'Melão no Pé', 0, 3, 'natureza', 'Doce que só. O feixe tirou antes da hora.', 'U.8'),
  K('abobora_roca', 'nature-kit/crop_pumpkin', 0.9, 'Abóbora na Roça', 1, 8, 'natureza', 'Ia virar doce de abóbora com coco.', 'U.8'),
  K('bambuzal', 'nature-kit/crops_bambooStageB', 3.5, 'Bambuzal', 2, 60, 'natureza', 'Quem planta bambu nunca mais arranca. A gente arrancou.', 'U.6 M.6'),
  K('pilha_lenha', 'nature-kit/log_stack', 1.8, 'Pilha de Lenha', 2, 250, 'natureza', 'Pro fogão a lenha do inverno.', 'U1 M.4'),
  K('toco', 'nature-kit/stump_roundDetailed', 1.0, 'Toco de Árvore', 1, 80, 'natureza', 'Sobrou da árvore que caiu na última tempestade.', 'M.6 U.5 P.3'),
  K('cogumelo_vermelho', 'nature-kit/mushroom_redTall', 0.6, 'Cogumelo Vermelho', 0, 0.2, 'natureza', 'Não come esse aí não.', 'M1 U.4'),
  K('flor_campo', 'nature-kit/flower_yellowA', 0.6, 'Flor do Campo', 0, 0.05, 'natureza', 'Bem-me-quer. Mal-me-quer. Abduziu.', 'P.6 U.6 R.4 M.4'),
  K('flor_roxa', 'nature-kit/flower_purpleA', 0.6, 'Flor Roxa', 0, 0.05, 'natureza', 'Igual à do ipê, mas baixinha.', 'P.5 U.5 R.3'),
  K('vitoria_regia', 'nature-kit/lily_large', 1.6, 'Vitória-régia', 1, 15, 'natureza', 'Aguentava um bebê em cima. Não aguentou um feixe.', 'r:W.0 r:M.5', { rarity: 'raro', matterMult: 3 }),
  K('canoa_madeira', 'nature-kit/canoe', 4.0, 'Canoa de Madeira', 2, 60, 'barco', 'Remava devagarinho pelo rio. Subiu rapidinho.', 'boat1.2 A.4'),
  K('barraca_acampamento', 'nature-kit/tent_detailedOpen', 2.6, 'Barraca da Trilha', 2, 12, 'movel', 'Acamparam pra ver estrelas. Viram de perto.', 'M.6 U.4'),
  K('cabeca_pedra', 'nature-kit/statue_head', 2.4, 'Cabeça de Pedra Misteriosa', 4, 6000, ['estrutura', 'secreto'], 'Ninguém sabe quem esculpiu. Os ETs sabem.', 'r:M.5 r:U.3', { rarity: 'epico', matterMult: 10 }),
  K('vaso_barro', 'nature-kit/pot_large', 1.0, 'Vaso de Barro', 1, 25, 'movel', 'Cerâmica de artesão, feita à mão.', 'K.6 U.4 P.3'),
  K('moita', 'nature-kit/plant_bushLarge', 1.4, 'Moita', 1, 20, 'natureza', 'Alguém sempre se esconde atrás dela.', 'P.5 R.4 U.4 M.5'),
  K('pedra_grande', 'nature-kit/rock_largeA', 2.5, 'Pedra Grande', 3, 3000, 'natureza', 'Estava ali há 10 mil anos. Não está mais.', 'U.4 M.5'),
  K('cacto', 'nature-kit/cactus_tall', 2.4, 'Cacto de Vaso', 1, 30, 'natureza', 'Não precisa de água, nem de carinho.', 'R.3 U.4'),
  K('palmeira_torta', 'pirate-kit/palm-bend', 6, 'Coqueiro Torto', 3, 600, 'natureza', 'Cresceu na direção do mar. Agora na do céu.', 'A.8'),

  // ───────────── barcos e água
  K('barco_pesca_pequeno', 'watercraft-kit/boat-fishing-small', 6, 'Barquinho de Pesca', 4, 1500, 'barco', 'Saiu às quatro da manhã. Pescou um disco.', 'boat1.5'),
  K('bote_remo', 'watercraft-kit/boat-row-small', 3.5, 'Bote a Remo', 2, 80, 'barco', 'Os remos ficaram boiando. Lembrança.', 'boat1.5 A.3'),
  K('barco_remo', 'watercraft-kit/boat-row-large', 5, 'Barco a Remo', 3, 200, 'barco', 'Passeio no lago do parque. Passeio cancelado.', 'boat1'),
  K('veleiro', 'watercraft-kit/boat-sail-a', 9, 'Veleiro', 5, 4000, 'barco', 'Navegava com o vento. Agora com o feixe.', 'boat1.2'),
  K('lancha_esportiva', 'watercraft-kit/boat-speed-c', 7, 'Lancha Esportiva', 4, 2500, 'barco', 'Som alto, gente bronzeada, zero noção.', 'boat1.2'),
  K('lancha_cabine', 'watercraft-kit/boat-speed-f', 9, 'Lancha com Cabine', 5, 6000, 'barco', 'Do empresário. O empresário tá ligando pro seguro.', 'boat.8', { rarity: 'incomum', matterMult: 1.5 }),
  K('rebocador', 'watercraft-kit/boat-tug-a', 12, 'Rebocador do Porto', 6, 120000, 'barco', 'Puxava navios gigantes. Foi puxado.', 'boat.6'),
  K('barco_casa', 'watercraft-kit/boat-house-a', 12, 'Barco-casa', 6, 40000, 'barco', 'Morava na água. Mudou-se pro ar.', 'boat.6'),
  K('aerobarco', 'watercraft-kit/boat-fan', 5, 'Aerobarco do Pantanal', 3, 600, 'barco', 'A hélice nas costas já ajudou a decolar.', 'boat.6 r:W.0', { rarity: 'incomum' }),
  K('cargueiro', 'watercraft-kit/ship-cargo-a', 60, 'Navio Cargueiro', 9, 8_000_000, 'barco', 'Mil contêineres de eletrônicos. Frete grátis pro espaço.', 'boat.25', { matterMult: 2 }),
  K('cruzeiro', 'watercraft-kit/ship-ocean-liner-small', 70, 'Navio de Cruzeiro', 10, 20_000_000, 'barco', 'Show de mágica no deck, buffet livre e agora: o espaço.', 'boat.15', { rarity: 'epico', matterMult: 3 }),
  K('boia', 'watercraft-kit/buoy', 2.0, 'Boia de Sinalização', 2, 300, 'estrutura', 'Marcava o canal do porto. Desmarcou.', 'boat.8'),
  K('navio_pirata', 'pirate-kit/ship-pirate-large', 30, 'Navio Pirata Cenográfico', 8, 400_000, ['barco', 'secreto'], 'Passeio de escuna temático. O capitão gritou "terra à vista". Era o céu.', 'boat.12 r:A.3', { rarity: 'epico', matterMult: 4 }),
  K('naufragio', 'pirate-kit/ship-wreck', 18, 'Naufrágio', 7, 150_000, ['barco', 'secreto'], 'Estava no fundo havia 200 anos. Agora está no topo.', 'r:A.3', { rarity: 'epico', matterMult: 5 }),
  K('canhao_forte', 'pirate-kit/cannon', 2.2, 'Canhão do Forte', 2, 900, 'estrutura', 'Defendeu a baía em 1700 e pouco. Hoje não defendeu nada.', 'L.4 K.4 A.3'),
  K('bau_pirata', 'pirate-kit/chest', 0.9, 'Baú Pirata', 1, 40, ['movel', 'secreto'], 'Ouro de verdade, enterrado na areia da praia.', 'r:A1', { rarity: 'raro', matterMult: 6 }),
  K('garrafa_mensagem', 'pirate-kit/bottle', 0.5, 'Garrafa com Mensagem', 0, 0.5, 'lixo', '"Socorro, estou numa ilha". Já era.', 'A.8'),
  K('bandeira_pirata', 'pirate-kit/flag-pirate', 3, 'Bandeira Pirata', 1, 5, 'estrutura', 'Do quiosque temático da orla.', 'A.3'),

  // ───────────── trens
  K('maria_fumaca', 'train-kit/train-locomotive-a', 7, 'Maria Fumaça', 6, 45000, 'caminhao', 'Piuí! Trem bom, sô. Voa até.', 'yard1 r:U.4', { rarity: 'incomum', matterMult: 1.5 }),
  K('locomotiva', 'train-kit/train-diesel-a', 9, 'Locomotiva a Diesel', 7, 120000, 'caminhao', 'Puxava 200 vagões de minério. Puxou o próprio peso.', 'yard1'),
  K('trem_metro', 'train-kit/train-electric-subway-a', 10, 'Vagão do Metrô', 7, 35000, 'onibus', 'Hora do rush. A porta não fechava. Agora fechou.', 'yard.8'),
  K('trem_urbano', 'train-kit/train-electric-city-a', 10, 'Trem Metropolitano', 7, 40000, 'onibus', 'Sentido Centro. Desvio: Galáxia.', 'yard.8'),
  K('trem_bala', 'train-kit/train-electric-bullet-a', 12, 'Trem-bala', 8, 50000, ['onibus', 'secreto'], 'Prometido há 20 anos. Chegou e foi embora no mesmo dia.', 'yard.3 r:I.4', { rarity: 'epico', matterMult: 4 }),
  K('bonde', 'train-kit/train-tram-classic', 7, 'Bonde Clássico', 6, 16000, 'onibus', 'Dim-dim! O passageiro pendurado aproveitou a vista.', 'yard.6 r:K.5', { rarity: 'incomum' }),
  K('vlt', 'train-kit/train-tram-modern', 9, 'VLT', 7, 30000, 'onibus', 'Veículo Leve sobre Trilhos. Leve mesmo, levamos fácil.', 'yard.5'),
  K('vagao_minerio', 'train-kit/train-carriage-coal', 8, 'Vagão de Minério', 6, 90000, 'caminhao', 'Minério de ferro de Minas. O ET vai fazer outro disco.', 'yard1.2'),
  K('vagao_tanque', 'train-kit/train-carriage-tank', 8, 'Vagão-tanque', 6, 80000, 'caminhao', 'Etanol puro. A nave agradece o combustível.', 'yard1'),
  K('vagao_toras', 'train-kit/train-carriage-lumber', 8, 'Vagão de Toras', 6, 60000, 'caminhao', 'Madeira de reflorestamento, certificada. A abdução não.', 'yard.8'),
  K('vagao_conteiner', 'train-kit/train-carriage-container-red', 8, 'Vagão Contêiner', 6, 50000, 'caminhao', 'Leva contêiner pro porto. Levou pro espaço.', 'yard.8'),
  K('vagao_fechado', 'train-kit/train-carriage-box', 8, 'Vagão Fechado', 6, 40000, 'caminhao', 'Ninguém sabe o que tem dentro. Agora os ETs sabem.', 'yard.8'),

  // ───────────── base aérea, espaço e ciência
  K('foguete', [
    { src: 'space-kit/rocket_baseA' },
    { src: 'space-kit/rocket_fuelA', y: 1 },
    { src: 'space-kit/rocket_fuelA', y: 2 },
    { src: 'space-kit/rocket_sidesA', y: 3 },
    { src: 'space-kit/rocket_topA', y: 4 },
  ], { h: 26 }, 'Foguete de Lançamento', 9, 500_000, ['estrutura', 'militar'], 'Contagem regressiva: 3, 2, 1... já foi, mas pro lado errado.', 'base.6', { rarity: 'epico', matterMult: 4 }),
  K('jipe_lunar', 'space-kit/rover', 4.0, 'Jipe Lunar', 3, 900, ['carro', 'militar'], 'Protótipo da agência espacial. Testado no lugar certo.', 'base1 r:F.3', { rarity: 'raro', matterMult: 3 }),
  K('parabolica_gigante', 'space-kit/satelliteDish_large', 8, 'Antena Parabólica Gigante', 6, 30000, ['estrutura', 'radar'], 'Procurava sinais de vida alienígena. Achou.', 'base1 roof.5', { matterMult: 2 }),
  K('parabolica', 'space-kit/satelliteDish', 2.2, 'Antena Parabólica', 2, 150, ['componente', 'radar'], 'Pegava 400 canais e nenhum prestava.', 'roof1 R.4 V.6 U.5'),
  K('nave_corrida', 'space-kit/craft_speederA', 5, 'Nave de Corrida Alien', 3, 600, ['jato', 'secreto'], 'A gente esqueceu ela aqui em 1987. Obrigado por guardar.', 'r:B.5 r:I.3', { rarity: 'alien', matterMult: 20 }),
  K('nave_cargueira', 'space-kit/craft_cargoA', 8, 'Nave Cargueira Perdida', 5, 9000, ['jato', 'secreto'], 'Caiu em Varginha, foi escondida num galpão. Bela tentativa.', 'r:B.5 r:I.4', { rarity: 'alien', matterMult: 20 }),
  K('nave_mineradora', 'space-kit/craft_miner', 7, 'Nave Mineradora', 5, 8000, ['jato', 'secreto'], 'Veio buscar nióbio. O Brasil tem 98% do mundo.', 'r:B.4 r:U.3', { rarity: 'alien', matterMult: 20 }),
  K('cristal_alien', 'space-kit/rock_crystals', 1.6, 'Cristal Alienígena', 1, 50, ['natureza', 'secreto'], 'Brilha no escuro e no radar.', 'r:M.6 r:U.4 r:V.3', { rarity: 'alien', matterMult: 25 }),
  K('gerador', 'space-kit/machine_generator', 2.4, 'Gerador Industrial', 3, 2500, 'componente', 'Quando falta luz no bairro, é ele que segura.', 'I.6 B.6'),
  K('barris', 'space-kit/barrels', 1.6, 'Barris de Combustível', 2, 600, 'componente', 'Querosene de aviação. Querosene de disco agora.', 'B1 I.6'),

  // ───────────── esporte, festa e evento
  K('formula_vermelha', 'racing-kit/raceCarRed', 4.8, 'Carro de Fórmula Vermelho', 3, 750, 'carro', 'Volta mais rápida em Interlagos: 1min10s. Volta ao planeta: menos.', 'r:S.6 r:F.3', { rarity: 'epico', matterMult: 5 }),
  K('formula_verde', 'racing-kit/raceCarGreen', 4.8, 'Carro de Fórmula Verde', 3, 750, 'carro', 'Estava nos boxes trocando pneu. Trocou de dimensão.', 'r:S.4', { rarity: 'epico', matterMult: 5 }),
  K('arquibancada', 'racing-kit/grandStandCovered', 14, 'Arquibancada Coberta', 7, 80000, 'estrutura', 'Torcida organizada, bandeirão e agora vista aérea.', 'praca.4'),
  K('tenda_evento', 'racing-kit/tentClosedLong', 6, 'Tenda de Evento', 3, 300, 'estrutura', 'Casamento no sábado. A noiva vai ficar sem tenda.', 'P.4 S.4 C.3'),
  K('bandeira_quadriculada', 'racing-kit/flagCheckers', 2.5, 'Bandeira Quadriculada', 1, 5, 'estrutura', 'Fim de corrida. Começo de viagem.', 'S.4'),
  K('poste_led', 'racing-kit/lightPostModern', 6, 'Poste de LED', 3, 400, 'estrutura', 'A prefeitura trocou todos. Esse sumiu na primeira semana.', 'F.4 G.4 Q.3'),
  K('camera_tv', 'racing-kit/camera_exclusive', 2, 'Câmera de TV', 1, 40, 'movel', 'Transmitia ao vivo. Transmitiu tudo.', 'S.4 L.4 F.3'),
  K('skate', 'mini-skate/skateboard', 0.9, 'Skate', 0, 3, 'movel', 'O dono foi pegar água. O skate foi pegar órbita.', 'P1 C.4 R.3'),
  K('half_pipe', 'mini-skate/half-pipe', 10, 'Half-pipe', 6, 20000, 'estrutura', 'A pista da praça. Os skatistas querem de volta.', 'praca.8'),
  K('chafariz', 'fantasy-town-kit/fountain-round', 9, 'Chafariz da Praça', 7, 60000, 'estrutura', 'Jogaram tanta moeda que dava pra comprar outro.', 'praca1.2', { matterMult: 1.5 }),
  K('carroca_madeira', 'fantasy-town-kit/cart', 3, 'Carroça de Madeira', 2, 300, 'movel', 'Carroça de verdureiro. O cavalo fugiu antes.', 'U.6 K.4 C.3'),
  K('barraca_artesanato', 'fantasy-town-kit/stall-red', 3.5, 'Barraca de Artesanato', 3, 300, 'estrutura', 'Pulseirinha, filtro dos sonhos e brinco de pena.', 'K.5 P.4 A.4 C.3'),
  K('lampiao_rua', 'fantasy-town-kit/lantern', 3, 'Lampião de Rua', 2, 200, 'estrutura', 'Iluminava a rua de paralelepípedo do centro histórico.', 'K.8 L.4'),
  K('roda_carroca', 'fantasy-town-kit/wheel', 1.4, 'Roda de Carroça', 1, 40, 'lixo', 'Decoração de restaurante country.', 'U.4 K.3'),
  K('moeda_ouro', 'platformer-kit/coin-gold', 1.0, 'Moeda de Ouro Gigante', 1, 10, ['lixo', 'secreto'], 'Ninguém sabe de onde veio. Vale mais de 1 ponto, com certeza.', 'r:R.5 r:C.5 r:P.5', { rarity: 'epico', matterMult: 15 }),
  K('joia', 'platformer-kit/jewel', 0.9, 'Joia Brilhante', 0, 1, ['lixo', 'secreto'], 'Caiu do colar da madame na saída do shopping.', 'r:F.6 r:C.4', { rarity: 'epico', matterMult: 15 }),
  K('estrela_cadente', 'platformer-kit/star', 1.2, 'Estrela Cadente', 1, 5, ['natureza', 'secreto'], 'Fizeram um pedido. O pedido era a gente.', 'r:U.4 r:A.4 r:M.4', { rarity: 'alien', matterMult: 25 }),
  K('chave_dourada', 'platformer-kit/key', 0.8, 'Chave Dourada', 0, 0.5, ['lixo', 'secreto'], 'Abre alguma coisa muito importante. Agora não abre mais nada.', 'r:K.5 r:R.4', { rarity: 'raro', matterMult: 6 }),
  K('coracao', 'platformer-kit/heart', 0.9, 'Coração de Pelúcia', 0, 0.5, ['lixo'], 'Presente de Dia dos Namorados. O namoro subiu junto.', 'P.4 C.3 R.3', { rarity: 'incomum' }),
  K('mola', 'platformer-kit/spring', 1.0, 'Mola Gigante', 1, 20, 'componente', 'Pula alto. Mas não tão alto.', 'P.3 I.3'),
  K('cogumelos', 'platformer-kit/mushrooms', 0.9, 'Família de Cogumelos', 0, 0.5, 'natureza', 'Brotaram depois da chuva. Sumiram depois do feixe.', 'M.6 U.4 P.3'),
  K('bomba_desenho', 'platformer-kit/bomb', 0.9, 'Bomba de Desenho Animado', 1, 15, ['militar', 'secreto'], 'Pavio aceso. Melhor levar logo.', 'r:B.6 r:I.3', { rarity: 'raro', matterMult: 4 }),

  // ───────────── indústria
  K('engrenagem', 'factory-kit/cog-a', 1.8, 'Engrenagem Gigante', 2, 900, 'componente', 'Peça de reposição da máquina que ninguém sabe consertar.', 'I1'),
  K('guindaste_magnetico', 'factory-kit/crane-magnet', 7, 'Guindaste Magnético', 6, 25000, 'caminhao', 'Pegava carro do ferro-velho. Hoje foi pego.', 'yard.6'),
  K('maquina', 'factory-kit/machine', 3, 'Máquina Industrial', 4, 4000, 'componente', 'Fazia parafuso. Tinha um botão vermelho. Alguém apertou.', 'I.8'),
  K('braco_robo', 'factory-kit/robot-arm-a', 3, 'Braço Robótico', 4, 2500, 'componente', 'Montava carros. Agora monta naves.', 'I.6 r:F.3', { rarity: 'incomum' }),
  K('tremonha', 'factory-kit/hopper-high-round', 6, 'Tremonha de Grãos', 6, 20000, 'estrutura', 'Soja do agro, a caminho da China. Desvio de rota.', 'yard.6 farm.4'),
  K('cacamba_entulho', 'retro-urban-kit/detail-dumpster-closed', 3, 'Caçamba de Entulho', 3, 1500, 'estrutura', 'Alugada por uma semana. Seis meses depois...', 'R.4 V.4 I.5 C.3'),
  K('pallet', 'retro-urban-kit/pallet', 1.3, 'Pallet', 0, 20, 'lixo', 'Virou sofá de bar hipster. Ia virar.', 'I1 C.4 V.4'),
  K('andaime', 'retro-urban-kit/scaffolding-structure', 6, 'Andaime', 4, 800, 'estrutura', 'A pintura do prédio vai atrasar. Mais.', 'F.4 C.4 R.3'),
  K('caminhao_verde', 'retro-urban-kit/truck-green-cargo', 7, 'Caminhão Baú Verde', 5, 9000, 'caminhao', 'Entregava bebida no boteco. O boteco está desolado.', 'carH.5'),
  K('semaforo_duplo', 'retro-urban-kit/detail-light-traffic', 4.5, 'Semáforo Antigo', 2, 180, 'estrutura', 'Ficava vermelho por 3 minutos. Ninguém sente falta.', 'C.3 F.3'),
];

const SPAWN_RE = /^(r:)?([A-Za-z]+)([\d.]+)?$/;

/** Spawn targets parsed out of every entry's `spawn`. */
export interface KitSpawn {
  id: string;
  /** District letter or a special group (car, carH, boat, yard, base, praca, farm, beach, roof). */
  where: string;
  rare: boolean;
  w: number;
}

export const KIT_SPAWNS: readonly KitSpawn[] = KIT.flatMap((e) =>
  (e.spawn ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((code) => {
      const m = SPAWN_RE.exec(code);
      if (!m) throw new Error(`kit ${e.id}: bad spawn "${code}"`);
      return { id: e.id, where: m[2] as string, rare: !!m[1], w: m[3] ? Number(m[3]) : 1 };
    })
    .filter((s) => s.w > 0),
);

/** Spawns for one target ("R", "car", "boat"...). */
export function kitSpawns(where: string, rare = false): Array<{ id: string; w: number }> {
  return KIT_SPAWNS.filter((s) => s.where === where && s.rare === rare).map((s) => ({ id: s.id, w: s.w }));
}

export const KIT_MODEL_PREFIX = 'kit:';

/** Dex numbers continue after the hand-made objects and memes. */
export const KIT_DEX_START = 231;

export const KIT_OBJECTS: readonly ObjectDef[] = KIT.map((e, i) => ({
  id: e.id,
  dex: KIT_DEX_START + i,
  name: e.name,
  tier: e.tier,
  massKg: e.kg,
  model: KIT_MODEL_PREFIX + e.id,
  tags: e.tags,
  description: e.desc,
  ...(e.rarity ? { rarity: e.rarity } : {}),
  ...(e.matterMult ? { matterMult: e.matterMult } : {}),
  ...(e.tags.includes('secreto') && (e.rarity === 'alien' || e.rarity === 'epico') ? { secret: true } : {}),
}));
