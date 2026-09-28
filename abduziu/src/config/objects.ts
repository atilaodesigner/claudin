/**
 * Every abductable thing in every city. The ABDUCTION DEX is generated from this table.
 * `model` points to a procedural builder in assets/models (or a GLB override, see README).
 */
export type Rarity = 'normal' | 'incomum' | 'raro' | 'epico' | 'alien';

export type ObjectTag =
  | 'lixo'
  | 'movel'
  | 'animal'
  | 'pessoa'
  | 'moto'
  | 'carro'
  | 'van'
  | 'onibus'
  | 'caminhao'
  | 'casa'
  | 'predio'
  | 'estrutura'
  | 'natureza'
  | 'militar'
  | 'radar'
  | 'jato'
  | 'helicoptero'
  | 'drone'
  | 'viatura'
  | 'boss'
  | 'secreto'
  | 'componente'
  | 'barco'
  | 'marco';

export interface ObjectDef {
  id: string;
  dex: number;
  name: string;
  tier: number;
  massKg: number;
  model: string;
  tags: readonly ObjectTag[];
  description: string;
  rarity?: Rarity;
  secret?: boolean;
  /** Tint palette applied to the paintable parts (car body, house walls...). */
  paints?: readonly number[];
  matterMult?: number;
  /** Not listed in the dex (e.g. internal debris). */
  hidden?: boolean;
}

const CAR_PAINTS = [0xd7263d, 0xf4f1e8, 0x1b4f9c, 0x2a2d34, 0xc9ccd1, 0x2e8b57, 0xf2b705, 0x7a1f2b, 0x3fa7d6, 0xe8703a];
const HOUSE_PAINTS = [0xf6c85f, 0x6fb7a8, 0xef8a62, 0xa6d38b, 0xf1a7b5, 0x9ecae1, 0xf4e1b5, 0xd9a0e0, 0xffd166, 0x8fd694, 0xf7a072];
const SHIRT_PAINTS = [0xf2c14e, 0x3a86ff, 0x2ec4b6, 0xff595e, 0x8ac926, 0xffffff, 0xff924c, 0x6a4c93, 0x1982c4, 0x06d6a0];
const BIKE_PAINTS = [0xe63946, 0x1d3557, 0x2a9d8f, 0xf4a261, 0x8338ec];
const CONTAINER_PAINTS = [0xc0392b, 0x2471a3, 0x1e8449, 0xd68910, 0x7d3c98, 0x566573, 0xe67e22];
const TOWER_PAINTS = [0xd8e2ea, 0xb9d3e0, 0xe9d8c4, 0xc7d0d8, 0xa9c7d6];

export const OBJECTS: readonly ObjectDef[] = [
  // ───────────── TIER 0 — lixo e miudezas
  { id: 'lata', dex: 1, name: 'Lata de Refri', tier: 0, massKg: 0.35, model: 'can', tags: ['lixo'], paints: [0xd62828, 0x2a9d8f, 0xf77f00, 0x3a0ca3, 0x70e000], description: 'Vazia. Alguém deixou na calçada. Começo humilde de uma invasão.' },
  { id: 'garrafa', dex: 2, name: 'Garrafa de Vidro', tier: 0, massKg: 0.6, model: 'bottle', tags: ['lixo'], description: 'Retornável. Os terráqueos acham que um dia vão devolver.' },
  { id: 'chinelo', dex: 3, name: 'Chinelo de Dedo', tier: 0, massKg: 0.2, model: 'flipflop', tags: ['lixo'], paints: [0x1d4ed8, 0x16a34a, 0xfacc15, 0xdc2626], description: 'Arma tradicional das mães brasileiras. Alcance lendário.' },
  { id: 'caixa', dex: 4, name: 'Caixa de Papelão', tier: 0, massKg: 2, model: 'box', tags: ['lixo'], description: 'Frágil. Por favor não virar. Tarde demais.' },
  { id: 'saco_lixo', dex: 5, name: 'Saco de Lixo', tier: 0, massKg: 5, model: 'trashbag', tags: ['lixo'], description: 'O caminhão passa terça. Hoje não passa mais.' },
  { id: 'cone', dex: 6, name: 'Cone de Trânsito', tier: 0, massKg: 3, model: 'cone', tags: ['lixo'], description: 'Marca uma obra que começou em 2009.' },
  { id: 'coco', dex: 7, name: 'Coco Verde', tier: 0, massKg: 1.5, model: 'coconut', tags: ['natureza'], description: 'Rico em eletrólitos. Rico em potencial balístico.' },
  { id: 'bola', dex: 8, name: 'Bola de Futebol', tier: 0, massKg: 0.45, model: 'ball', tags: ['lixo'], description: 'Estava no pé do craque da várzea. Não está mais.' },
  { id: 'isopor', dex: 9, name: 'Caixa de Isopor', tier: 0, massKg: 4, model: 'cooler', tags: ['movel'], description: 'Contém gelo e latinhas. Carga preciosa.' },
  { id: 'galinha', dex: 10, name: 'Galinha', tier: 0, massKg: 2.5, model: 'chicken', tags: ['animal'], description: 'Cacareja em três oitavas durante a abdução.' },
  { id: 'vaso', dex: 11, name: 'Vaso de Planta', tier: 0, massKg: 8, model: 'plantpot', tags: ['movel'], description: 'Comigo-ninguém-pode. Pelo visto alguém pode.' },
  { id: 'engradado', dex: 12, name: 'Engradado', tier: 0, massKg: 12, model: 'crate', tags: ['movel'], description: 'Vinte e quatro garrafas, zero cheias.' },

  // ───────────── TIER 1
  { id: 'cadeira', dex: 13, name: 'Cadeira de Plástico', tier: 1, massKg: 3, model: 'chair', tags: ['movel'], paints: [0xf5f5f0, 0xf5f5f0, 0xe63946, 0x2a9d8f], description: 'Patrimônio nacional. Encontrada em todo bar do país.' },
  { id: 'mesa_bar', dex: 14, name: 'Mesa de Bar', tier: 1, massKg: 7, model: 'bartable', tags: ['movel'], paints: [0xf5f5f0, 0xe63946], description: 'Ainda tinha um copo americano em cima.' },
  { id: 'bicicleta', dex: 15, name: 'Bicicleta', tier: 1, massKg: 14, model: 'bicycle', tags: ['movel'], paints: BIKE_PAINTS, description: 'Estava sem cadeado. Erro de principiante.' },
  { id: 'cachorro', dex: 16, name: 'Vira-lata Caramelo', tier: 1, massKg: 18, model: 'dog', tags: ['animal'], description: 'Símbolo nacional. Voltará em segurança. Provavelmente.' },
  { id: 'churrasqueira', dex: 17, name: 'Churrasqueira de Tambor', tier: 1, massKg: 25, model: 'grill', tags: ['movel'], description: 'A picanha subiu antes do ponto.' },
  { id: 'lixeira', dex: 18, name: 'Lixeira', tier: 1, massKg: 15, model: 'bin', tags: ['lixo'], paints: [0x2d6a4f, 0xf4a300, 0x1d4ed8], description: 'Coleta seletiva interplanetária.' },
  { id: 'botijao', dex: 19, name: 'Botijão de Gás', tier: 1, massKg: 30, model: 'gascan', tags: ['movel'], description: 'Treze quilos de pura tensão.' },
  { id: 'pessoa', dex: 20, name: 'Morador Curioso', tier: 1, massKg: 72, model: 'person', tags: ['pessoa'], paints: SHIRT_PAINTS, description: 'Estava filmando para o grupo da família. Viralizou.' },
  { id: 'carrinho_mercado', dex: 21, name: 'Carrinho de Mercado', tier: 1, massKg: 20, model: 'cart', tags: ['movel'], description: 'Sempre tem uma roda que puxa pro lado.' },
  { id: 'guarda_sol', dex: 22, name: 'Guarda-sol', tier: 1, massKg: 5, model: 'parasol', tags: ['movel'], paints: [0xffd166, 0xef476f, 0x06d6a0, 0x118ab2], description: 'Abre sozinho quando venta. Fecha sozinho quando voa.' },
  { id: 'caixa_som', dex: 23, name: 'Caixa de Som', tier: 1, massKg: 25, model: 'speaker', tags: ['movel'], description: 'Tocava pagode no volume máximo. Continua tocando lá em cima.' },
  { id: 'antena_tv', dex: 24, name: 'Antena de TV', tier: 1, massKg: 6, model: 'tvantenna', tags: ['componente'], description: 'Pegava todos os canais. Inclusive o nosso.' },
  { id: 'ar_cond', dex: 25, name: 'Ar-condicionado', tier: 1, massKg: 40, model: 'aircon', tags: ['componente'], description: 'Pingava na calçada desde 2014.' },
  { id: 'banco_praca', dex: 26, name: 'Banco de Praça', tier: 1, massKg: 60, model: 'bench', tags: ['movel'], description: 'Onde os aposentados resolvem a economia do país.' },

  // ───────────── TIER 2
  { id: 'moto', dex: 27, name: 'Moto 125', tier: 2, massKg: 115, model: 'moto', tags: ['moto'], paints: [0xd62828, 0x1d3557, 0x111111, 0xf1faee, 0x2a9d8f], description: 'Motor valente, escapamento furado.' },
  { id: 'mototaxi', dex: 28, name: 'Mototáxi', tier: 2, massKg: 180, model: 'mototaxi', tags: ['moto', 'pessoa'], description: 'Garantiu que chegava em cinco minutos. Chegou em outro planeta.' },
  { id: 'carrinho_pipoca', dex: 29, name: 'Carrinho de Pipoca', tier: 2, massKg: 90, model: 'popcorn', tags: ['movel'], description: 'Pipoca doce ou salgada? Abduzida.' },
  { id: 'barraca_feira', dex: 30, name: 'Barraca de Feira', tier: 2, massKg: 80, model: 'stall', tags: ['estrutura'], paints: [0xe63946, 0x2a9d8f, 0xf4a261, 0x3a86ff], description: 'Pastel de vento, agora literalmente.' },
  { id: 'orelhao', dex: 31, name: 'Orelhão', tier: 2, massKg: 60, model: 'payphone', tags: ['estrutura'], description: 'Relíquia arqueológica. Ninguém lembra a última ligação.' },
  { id: 'caixa_dagua', dex: 32, name: 'Caixa d\'Água', tier: 2, massKg: 150, model: 'watertank', tags: ['componente'], description: 'Mil litros de água azulzinha. O vizinho vai reclamar.' },
  { id: 'arvore', dex: 33, name: 'Árvore de Calçada', tier: 2, massKg: 300, model: 'tree', tags: ['natureza'], description: 'As raízes quebravam a calçada. Problema resolvido.' },
  { id: 'vaca', dex: 34, name: 'Vaca', tier: 2, massKg: 450, model: 'cow', tags: ['animal'], description: 'Clássico absoluto da abdução. Muuuuu.' },
  { id: 'semaforo', dex: 35, name: 'Semáforo', tier: 2, massKg: 150, model: 'trafficlight', tags: ['estrutura'], description: 'Estava sempre no amarelo.' },
  { id: 'placa_rua', dex: 36, name: 'Placa de Rua', tier: 2, massKg: 40, model: 'streetsign', tags: ['estrutura'], description: 'Rua Sem Saída. Agora tem saída: pra cima.' },
  { id: 'trave', dex: 93, name: 'Trave do Campinho', tier: 2, massKg: 120, model: 'goal', tags: ['estrutura'], description: 'Bola na trave não altera o placar. Trave no espaço também não.' },
  { id: 'piscina_boia', dex: 37, name: 'Boia de Flamingo', tier: 2, massKg: 4, model: 'floatie', tags: ['movel'], matterMult: 3, description: 'Ícone de verão. Leve, mas carrega muita autoestima.' },

  // ───────────── TIER 3
  { id: 'hatch', dex: 38, name: 'Hatch Popular', tier: 3, massKg: 950, model: 'hatch', tags: ['carro'], paints: CAR_PAINTS, description: 'Mil cilindradas de determinação. Parcelado em 60 vezes.' },
  { id: 'seda', dex: 39, name: 'Sedã Familiar', tier: 3, massKg: 1200, model: 'sedan', tags: ['carro'], paints: CAR_PAINTS, description: 'Porta-malas enorme. Coube o churrasco inteiro.' },
  { id: 'taxi', dex: 40, name: 'Táxi', tier: 3, massKg: 1100, model: 'taxi', tags: ['carro'], description: 'O taxímetro continua rodando.' },
  { id: 'besourinho', dex: 41, name: 'Besourinho Clássico', tier: 3, massKg: 800, model: 'beetle', tags: ['carro'], paints: [0x7fb3d5, 0xf7dc6f, 0xe74c3c, 0xf5f5f5, 0x58d68d], description: 'Motor atrás, porta-malas na frente, alma eterna.' },
  { id: 'viatura', dex: 42, name: 'Viatura da Patrulha', tier: 3, massKg: 1300, model: 'policecar', tags: ['carro', 'viatura'], matterMult: 2, description: 'Patrulha Aurora. Pediu reforço. Virou reforço nosso.' },
  { id: 'poste', dex: 43, name: 'Poste de Concreto', tier: 3, massKg: 900, model: 'pole', tags: ['estrutura'], description: 'Com transformador, gato de luz e trinta fios misteriosos.' },
  { id: 'banca', dex: 44, name: 'Banca de Jornal', tier: 3, massKg: 400, model: 'newsstand', tags: ['estrutura'], description: 'Vende de tudo, menos jornal.' },
  { id: 'telhado', dex: 45, name: 'Telhado de Cerâmica', tier: 3, massKg: 1500, model: 'roof', tags: ['componente'], description: 'As telhas saem voando uma a uma. Arte pura.' },
  { id: 'coqueiro', dex: 46, name: 'Coqueiro', tier: 3, massKg: 600, model: 'palm', tags: ['natureza'], description: 'Tropical demais pra resistir.' },
  { id: 'ipe', dex: 47, name: 'Ipê Amarelo', tier: 3, massKg: 800, model: 'ipe', tags: ['natureza'], description: 'Floresce no inverno. Floresce no espaço também.' },
  { id: 'ponto_onibus', dex: 48, name: 'Ponto de Ônibus', tier: 3, massKg: 700, model: 'busstop', tags: ['estrutura'], description: 'O ônibus não passou. O disco voador sim.' },
  { id: 'drone', dex: 49, name: 'Drone Sentinela', tier: 3, massKg: 25, model: 'drone', tags: ['drone', 'militar'], matterMult: 4, description: 'Força Sentinela. Câmera 8K, bateria de 12 minutos.' },

  // ───────────── TIER 4
  { id: 'van', dex: 50, name: 'Van Escolar', tier: 4, massKg: 2000, model: 'van', tags: ['van'], description: 'Tia da van nunca atrasa. Hoje atrasou.' },
  { id: 'caminhonete', dex: 51, name: 'Caminhonete', tier: 4, massKg: 2100, model: 'pickup', tags: ['van'], paints: CAR_PAINTS, description: 'Caçamba cheia de melancia. Chuva de melancia.' },
  { id: 'perua', dex: 52, name: 'Perua Clássica', tier: 4, massKg: 1250, model: 'kombi', tags: ['van'], paints: [0x5dade2, 0xf5b041, 0xec7063, 0x58d68d], description: 'Pão de forma. Levava a banda inteira.' },
  { id: 'food_truck', dex: 53, name: 'Food Truck', tier: 4, massKg: 3000, model: 'foodtruck', tags: ['van'], description: 'Hambúrguer artesanal de R$ 49. O ET pagou.' },
  { id: 'quiosque', dex: 54, name: 'Quiosque', tier: 4, massKg: 2500, model: 'kiosk', tags: ['estrutura'], description: 'Água de coco gelada e um pagodinho.' },
  { id: 'outdoor', dex: 55, name: 'Outdoor', tier: 4, massKg: 3500, model: 'billboard', tags: ['estrutura'], description: 'Anúncio: "DISCOS VOADORES AUTO PEÇAS". Coincidência?' },
  { id: 'empilhadeira', dex: 56, name: 'Empilhadeira', tier: 4, massKg: 4000, model: 'forklift', tags: ['caminhao'], description: 'Levantava pallets. Agora é levantada.' },
  { id: 'carro_forte', dex: 57, name: 'Carro-Forte', tier: 4, massKg: 6000, model: 'armored', tags: ['caminhao'], matterMult: 6, description: 'Cheio de dinheiro. Nosso agora.' },
  { id: 'helicoptero', dex: 58, name: 'Helicóptero Beija-Flor', tier: 4, massKg: 3000, model: 'helicopter', tags: ['helicoptero', 'militar'], matterMult: 5, description: 'Força Sentinela. Muito barulho, pouca paciência.' },
  { id: 'piscina', dex: 59, name: 'Piscina de Fibra', tier: 4, massKg: 5000, model: 'pool', tags: ['estrutura'], description: 'Com água, boia e um sapo dentro.' },

  // ───────────── TIER 5
  { id: 'onibus', dex: 60, name: 'Ônibus Urbano', tier: 5, massKg: 12000, model: 'bus', tags: ['onibus'], paints: [0xf4a300, 0x2a9d8f, 0xe63946, 0x3a86ff], description: 'Linha 051 — Centro / Via Láctea.' },
  { id: 'caminhao', dex: 61, name: 'Caminhão Baú', tier: 5, massKg: 10000, model: 'truck', tags: ['caminhao'], paints: [0xf1faee, 0xe63946, 0x457b9d, 0xf4a261], description: 'Mudança de cidade. Mudança de planeta.' },
  { id: 'conteiner', dex: 62, name: 'Contêiner', tier: 5, massKg: 3800, model: 'container', tags: ['estrutura'], paints: CONTAINER_PAINTS, description: 'Vinte pés de mistério. Pode ter qualquer coisa.' },
  { id: 'jato', dex: 63, name: 'Caça Carcará', tier: 5, massKg: 12000, model: 'jet', tags: ['jato', 'militar'], matterMult: 8, description: 'Orgulho da Força Sentinela. Era.' },
  { id: 'antiaereo', dex: 64, name: 'Bateria Antiaérea', tier: 5, massKg: 9000, model: 'aagun', tags: ['militar'], matterMult: 3, description: 'Mirava no céu. Agora está nele.' },
  { id: 'caminhao_mil', dex: 65, name: 'Caminhão Militar', tier: 5, massKg: 11000, model: 'miltruck', tags: ['caminhao', 'militar'], matterMult: 2, description: 'Camuflado. Não o suficiente.' },

  // ───────────── TIER 6
  { id: 'casa_laje', dex: 66, name: 'Casa de Laje', tier: 6, massKg: 45000, model: 'house_slab', tags: ['casa'], paints: HOUSE_PAINTS, description: 'Construída aos fins de semana, laje a laje, com amor.' },
  { id: 'casa_telhado', dex: 67, name: 'Casa com Telhado', tier: 6, massKg: 50000, model: 'house_roof', tags: ['casa'], paints: HOUSE_PAINTS, description: 'Varanda, rede e cachorro. Faltou só o chão.' },
  { id: 'sobrado', dex: 68, name: 'Sobrado da Comunidade', tier: 6, massKg: 38000, model: 'favela_house', tags: ['casa'], paints: HOUSE_PAINTS, description: 'Três andares, vista pro morro inteiro.' },
  { id: 'onibus_articulado', dex: 69, name: 'Ônibus Articulado', tier: 6, massKg: 20000, model: 'artbus', tags: ['onibus'], description: 'Sanfona urbana. Dobrou no meio do caminho pro céu.' },
  { id: 'carreta', dex: 70, name: 'Carreta Pesada', tier: 6, massKg: 30000, model: 'semitruck', tags: ['caminhao'], matterMult: 3, description: 'Nove eixos de pura vontade de não sair do chão.' },
  { id: 'silo', dex: 71, name: 'Silo de Grãos', tier: 6, massKg: 60000, model: 'silo', tags: ['estrutura'], description: 'Soja suficiente para uma frota interestelar.' },
  { id: 'caixa_elevada', dex: 72, name: 'Caixa d\'Água Elevada', tier: 6, massKg: 70000, model: 'watertower', tags: ['estrutura'], description: 'O orgulho do bairro. Abastece três ruas.' },

  // ───────────── TIER 7
  { id: 'loja', dex: 73, name: 'Loja de Esquina', tier: 7, massKg: 120000, model: 'shop', tags: ['predio'], paints: HOUSE_PAINTS, description: 'Padaria, bar ou lanchonete. Fechou pra balanço cósmico.' },
  { id: 'posto', dex: 74, name: 'Posto de Combustível', tier: 7, massKg: 90000, model: 'gasstation', tags: ['estrutura'], description: 'Completa? Completa.' },
  { id: 'galpao', dex: 75, name: 'Galpão Industrial', tier: 7, massKg: 200000, model: 'warehouse', tags: ['predio'], description: 'Telhado serrilhado, eco de martelo, abduzido inteiro.' },
  { id: 'guindaste', dex: 76, name: 'Guindaste', tier: 7, massKg: 180000, model: 'crane', tags: ['estrutura'], description: 'Levantava contêineres. Karma.' },
  { id: 'radar', dex: 77, name: 'Torre de Radar', tier: 7, massKg: 80000, model: 'radar', tags: ['radar', 'militar'], matterMult: 3, description: 'Nos detectou. Parabéns pra ela.' },

  // ───────────── TIER 8
  { id: 'predio', dex: 78, name: 'Prédio Residencial', tier: 8, massKg: 2_000_000, model: 'apartment', tags: ['predio'], paints: TOWER_PAINTS, description: 'Doze andares, uma assembleia de condomínio em andamento.' },
  { id: 'torre_escritorio', dex: 79, name: 'Torre de Escritórios', tier: 8, massKg: 5_000_000, model: 'office', tags: ['predio'], description: 'Reunião que podia ser e-mail. Agora é abdução.' },
  { id: 'hangar', dex: 80, name: 'Hangar', tier: 8, massKg: 400_000, model: 'hangar', tags: ['militar', 'estrutura'], matterMult: 2, description: 'Guardava segredos. Agora guarda nada.' },

  // ───────────── TIER 9
  { id: 'torre_transmissao', dex: 81, name: 'Torre de Transmissão', tier: 9, massKg: 900_000, model: 'radiotower', tags: ['estrutura'], description: 'Transmitia novela. Agora transmite pro espaço.' },
  { id: 'arranha_ceu', dex: 82, name: 'Arranha-céu Aurora', tier: 9, massKg: 12_000_000, model: 'skyscraper', tags: ['predio'], description: 'O mais alto de Nova Aurora. Era.' },
  { id: 'torre_controle', dex: 83, name: 'Torre de Controle', tier: 9, massKg: 1_500_000, model: 'controltower', tags: ['militar', 'estrutura'], matterMult: 2, description: 'Controle, temos um problema. Controle?' },

  // ───────────── TIER 10 — especiais
  { id: 'tucano_negro', dex: 84, name: 'Projeto Tucano Negro', tier: 10, massKg: 80_000, model: 'boss', tags: ['boss', 'militar'], rarity: 'epico', matterMult: 12, description: 'Aeronave experimental secreta. Muito secreta. Era.' },

  // ───────────── SECRETOS
  { id: 'galinha_cosmica', dex: 85, name: 'Galinha Cósmica', tier: 0, massKg: 3, model: 'chicken_cosmic', tags: ['animal', 'secreto'], rarity: 'alien', secret: true, matterMult: 40, description: 'Botou um ovo em órbita baixa.' },
  { id: 'vaca_dourada', dex: 86, name: 'Vaca Dourada', tier: 2, massKg: 450, model: 'cow_gold', tags: ['animal', 'secreto'], rarity: 'epico', secret: true, matterMult: 20, description: 'Mugido em 24 quilates.' },
  { id: 'carro_dourado', dex: 87, name: 'Hatch Dourado', tier: 3, massKg: 1000, model: 'hatch_gold', tags: ['carro', 'secreto'], rarity: 'epico', paints: [0xf5c542], secret: true, matterMult: 15, description: 'Rebaixado, envelopado em ouro, som automotivo de respeito.' },
  { id: 'perua_alien', dex: 88, name: 'Perua Alienígena', tier: 4, massKg: 1250, model: 'kombi_alien', tags: ['van', 'secreto'], rarity: 'alien', paints: [0x7b2cbf], secret: true, matterMult: 18, description: 'Chegou antes da gente. Tem adesivo "EU ACREDITO".' },
  { id: 'meteorito', dex: 89, name: 'Meteorito', tier: 3, massKg: 2000, model: 'meteor', tags: ['secreto'], rarity: 'raro', secret: true, matterMult: 10, description: 'Ainda quente. Cheiro de ferro e mistério.' },
  { id: 'estatua', dex: 90, name: 'Estátua Misteriosa', tier: 5, massKg: 15000, model: 'statue', tags: ['secreto'], rarity: 'epico', secret: true, matterMult: 12, description: 'Aponta pro céu desde 1908. Agora sabemos por quê.' },
  { id: 'antena_secreta', dex: 91, name: 'Antena Secreta', tier: 6, massKg: 30000, model: 'secret_dish', tags: ['secreto', 'militar'], rarity: 'alien', secret: true, matterMult: 14, description: 'Oficialmente é uma caixa d\'água.' },
  { id: 'caminhao_conspiracao', dex: 92, name: 'Caminhão Nada Pra Ver', tier: 5, massKg: 9000, model: 'truck_conspiracy', tags: ['caminhao', 'secreto'], rarity: 'alien', secret: true, matterMult: 16, description: 'Carga: "NADA PRA VER AQUI". Tinha um ET dentro.' },
  // ───────────── CIDADES — praia, águas e cartões-postais
  { id: 'biscoito', dex: 94, name: 'Biscoito de Polvilho', tier: 0, massKg: 0.1, model: 'cookie_bag', tags: ['lixo'], description: 'Crocante, some na boca. Sumiu no céu também.' },
  { id: 'sombrinha_frevo', dex: 95, name: 'Sombrinha de Frevo', tier: 0, massKg: 0.4, model: 'frevo_umbrella', tags: ['movel'], description: 'Gira sozinha ao som do metal. Rodou até a órbita.' },
  { id: 'fitinha', dex: 96, name: 'Fitinhas Coloridas', tier: 0, massKg: 1.5, model: 'ribbons', tags: ['movel'], description: 'Três nós, três pedidos. Um deles era "me leva daqui".' },
  { id: 'pequi', dex: 97, name: 'Pequi', tier: 0, massKg: 0.3, model: 'pequi', tags: ['natureza'], description: 'Aviso universal: não morda. Nem abduza com pressa.' },
  { id: 'arara', dex: 98, name: 'Arara-azul', tier: 0, massKg: 1.3, model: 'macaw', tags: ['animal'], description: 'Voou junto por vontade própria. Gostou da cor do feixe.' },
  { id: 'cadeira_praia', dex: 99, name: 'Cadeira de Praia', tier: 1, massKg: 4, model: 'beach_chair', tags: ['movel'], paints: [0xef476f, 0x118ab2, 0x06d6a0, 0xffd166], description: 'Reclinável em cinco posições. A sexta é "flutuando".' },
  { id: 'prancha', dex: 100, name: 'Prancha de Surfe', tier: 1, massKg: 6, model: 'surfboard', tags: ['movel'], paints: [0xffffff, 0xffd166, 0x3a86ff, 0xef476f], description: 'Esperou a onda perfeita. Veio um disco voador.' },
  { id: 'preguica', dex: 101, name: 'Bicho-preguiça', tier: 1, massKg: 5, model: 'sloth', tags: ['animal'], description: 'Levou quatro minutos pra perceber que estava voando.' },
  { id: 'barraca_praia', dex: 102, name: 'Barraca de Praia', tier: 2, massKg: 60, model: 'beach_tent', tags: ['estrutura'], paints: [0xef476f, 0x06d6a0, 0xffd166, 0x118ab2], description: 'Aluguel de cadeira e guarda-sol. O dono ainda cobra a diária.' },
  { id: 'rede_volei', dex: 103, name: 'Rede de Vôlei', tier: 2, massKg: 70, model: 'volley_net', tags: ['estrutura'], description: 'Altinha acabou. Placar: Terra 0, Espaço 1.' },
  { id: 'carrinho_mate', dex: 104, name: 'Galão de Mate', tier: 2, massKg: 40, model: 'mate_cart', tags: ['movel'], description: 'Mate gelado com limão, direto do ombro do vendedor.' },
  { id: 'baiana_acaraje', dex: 105, name: 'Tabuleiro de Acarajé', tier: 2, massKg: 70, model: 'acaraje_stand', tags: ['estrutura'], description: 'Quente ou frio? O ET pediu quente. Arrependeu.' },
  { id: 'banca_pastel', dex: 106, name: 'Barraca de Pastel', tier: 2, massKg: 110, model: 'pastel_stall', tags: ['estrutura'], description: 'Pastel de carne e caldo de cana. Fim de feira espacial.' },
  { id: 'placa_tubarao', dex: 107, name: 'Placa de Tubarão', tier: 2, massKg: 45, model: 'shark_sign', tags: ['estrutura'], description: '"Risco de ataque". Ninguém avisou do ataque vindo de cima.' },
  { id: 'bananeira', dex: 108, name: 'Bananeira', tier: 2, massKg: 150, model: 'banana_tree', tags: ['natureza'], description: 'Com cacho e tudo. Banana a preço de órbita.' },
  { id: 'capivara', dex: 109, name: 'Capivara', tier: 2, massKg: 55, model: 'capybara', tags: ['animal'], description: 'Nem se abalou. Continua plena lá em cima.' },
  { id: 'jangada', dex: 110, name: 'Jangada', tier: 3, massKg: 400, model: 'jangada', tags: ['barco'], description: 'Vela triangular, madeira leve, destino: estratosfera.' },
  { id: 'lancha', dex: 111, name: 'Lancha', tier: 3, massKg: 1800, model: 'speedboat', tags: ['barco'], paints: [0xffffff, 0xe63946, 0x1d3557, 0xf4a261], description: 'Passeio de fim de semana. Passeio de fim de mundo.' },
  { id: 'jacare', dex: 112, name: 'Jacaré-açu', tier: 3, massKg: 300, model: 'caiman', tags: ['animal'], description: 'Tomava sol na beira do rio. Agora toma sol mais perto.' },
  { id: 'palmeira_acai', dex: 113, name: 'Açaizeiro', tier: 3, massKg: 350, model: 'acai_palm', tags: ['natureza'], description: 'Fonte oficial do açaí de verdade. Sem granola.' },
  { id: 'barco_pesca', dex: 114, name: 'Barco de Pesca', tier: 4, massKg: 6000, model: 'fishing_boat', tags: ['barco'], paints: [0x1d6fa5, 0xe63946, 0x2a9d8f, 0xf4a261], description: 'Voltou sem peixe. Voltou sem mar.' },
  { id: 'bondinho', dex: 115, name: 'Bondinho Amarelo', tier: 4, massKg: 8000, model: 'tram', tags: ['onibus'], description: 'Subia a ladeira desde 1896. Hoje subiu mais.' },
  { id: 'salva_vidas', dex: 116, name: 'Posto de Salva-vidas', tier: 4, massKg: 3000, model: 'lifeguard', tags: ['estrutura'], description: 'Bandeira vermelha: mar agitado e céu também.' },
  { id: 'heli_civil', dex: 117, name: 'Helicóptero Executivo', tier: 4, massKg: 2500, model: 'civil_heli', tags: ['helicoptero'], paints: [0xf5f5f0, 0x1d3557, 0x2a2d34, 0xe63946], description: 'Fugia do trânsito pelo alto. Achou trânsito mais alto.' },
  { id: 'casa_flutuante', dex: 118, name: 'Casa Flutuante', tier: 5, massKg: 14000, model: 'floating_house', tags: ['casa', 'barco'], paints: [0x2a9d8f, 0xf4a261, 0xe9c46a, 0x8ecae6], description: 'Mora no rio há trinta anos. Mudou de endereço hoje.' },
  { id: 'palafita', dex: 119, name: 'Palafita', tier: 6, massKg: 30000, model: 'stilt_house', tags: ['casa'], paints: [0x8ecae6, 0xf4a261, 0x90be6d, 0xffb4a2], description: 'Palafitas aguentam a cheia. A seca de gravidade, não.' },
  { id: 'sobrado_colonial', dex: 120, name: 'Casarão Colonial', tier: 6, massKg: 90000, model: 'colonial_house', tags: ['casa'], paints: [0xf6bd60, 0x84a59d, 0xf28482, 0x9ad1d4, 0xe9c46a, 0xcdb4db, 0xffafcc], description: 'Trezentos anos de história, sacada de ferro e azulejo.' },
  { id: 'barco_recreio', dex: 121, name: 'Barco Recreio', tier: 7, massKg: 120000, model: 'river_boat', tags: ['barco'], description: 'Três andares de redes penduradas. Viagem de 4 dias, agora de 4 segundos.' },
  { id: 'trio_eletrico', dex: 122, name: 'Trio Elétrico', tier: 7, massKg: 40000, model: 'trio', tags: ['caminhao'], matterMult: 2, description: 'Atrás do trio elétrico só não vai quem já foi abduzido.' },
  { id: 'samauma', dex: 123, name: 'Samaúma Gigante', tier: 8, massKg: 400_000, model: 'kapok', tags: ['natureza'], description: 'A rainha da floresta. Raízes do tamanho de uma casa.' },
  { id: 'bloco_pilotis', dex: 124, name: 'Bloco de Superquadra', tier: 8, massKg: 3_000_000, model: 'pilotis_block', tags: ['predio'], paints: [0xf1efe7, 0xe6d8c3, 0xcfe0e8, 0xf2d0a4], description: 'Seis andares sobre pilotis. O térreo é de todo mundo.' },
  { id: 'galo_gigante', dex: 125, name: 'Galo Gigante do Carnaval', tier: 9, massKg: 60_000, model: 'giant_rooster', tags: ['marco', 'estrutura'], matterMult: 6, description: 'Cantou de madrugada. Cantou no espaço.' },
  { id: 'farol_barra', dex: 126, name: 'Farol da Barra', tier: 9, massKg: 2_000_000, model: 'lighthouse', tags: ['marco', 'estrutura'], matterMult: 3, description: 'Guiava navios desde o século XVII. Agora guia discos voadores.' },
  { id: 'arcos_lapa', dex: 127, name: 'Arcos da Lapa', tier: 9, massKg: 9_000_000, model: 'lapa_arches', tags: ['marco', 'estrutura'], matterMult: 3, description: 'Quarenta e dois arcos. O samba debaixo continuou tocando.' },
  { id: 'ministerio', dex: 128, name: 'Bloco de Ministério', tier: 9, massKg: 6_000_000, model: 'ministry', tags: ['predio'], description: 'O processo tramitava há onze anos. Tramitou pro espaço.' },
  { id: 'elevador_lacerda', dex: 129, name: 'Elevador Lacerda', tier: 10, massKg: 14_000_000, model: 'lacerda', tags: ['marco', 'estrutura'], matterMult: 3, description: 'Ligava a Cidade Baixa à Alta. Agora liga à estratosfera.' },
  { id: 'teatro_amazonas', dex: 130, name: 'Teatro Amazonas', tier: 10, massKg: 16_000_000, model: 'amazon_theater', tags: ['marco', 'predio'], matterMult: 3, description: 'Cúpula de 36 mil telhas coloridas. Ópera em gravidade zero.' },
  { id: 'masp', dex: 131, name: 'Museu Suspenso', tier: 10, massKg: 20_000_000, model: 'masp', tags: ['marco', 'predio'], matterMult: 3, description: 'Já era suspenso. Só foi um pouquinho mais alto.' },
  { id: 'copan', dex: 132, name: 'Edifício Onda', tier: 10, massKg: 45_000_000, model: 'copan', tags: ['marco', 'predio'], matterMult: 3, description: 'Mil apartamentos em curva. O síndico está sem palavras.' },
  { id: 'palacio', dex: 133, name: 'Palácio das Colunas', tier: 10, massKg: 25_000_000, model: 'palace', tags: ['marco', 'predio'], matterMult: 3, description: 'Colunas que parecem velas ao vento. Velejou.' },
  { id: 'estadio', dex: 134, name: 'Estádio Colosso', tier: 11, massKg: 120_000_000, model: 'stadium', tags: ['marco', 'estrutura'], matterMult: 4, description: 'Final de campeonato adiada por motivo de abdução.' },
  { id: 'ponte_estaiada', dex: 135, name: 'Ponte Estaiada', tier: 11, massKg: 80_000_000, model: 'cable_bridge', tags: ['marco', 'estrutura'], matterMult: 4, description: 'Cartão-postal da Marginal. O trânsito embaixo nem percebeu.' },
  { id: 'congresso', dex: 136, name: 'Congresso Nacional', tier: 11, massKg: 150_000_000, model: 'congress', tags: ['marco', 'predio'], matterMult: 5, description: 'Duas torres, duas cúpulas, zero quórum. Sessão encerrada.' },

  // ───────────── SECRETOS DAS CIDADES
  { id: 'tubarao', dex: 137, name: 'Tubarão de Boa Viagem', tier: 4, massKg: 700, model: 'shark', tags: ['animal', 'secreto'], rarity: 'epico', secret: true, matterMult: 16, description: 'Estava tomando sol na areia. A placa avisou.' },
  { id: 'acaraje_cosmico', dex: 138, name: 'Acarajé Cósmico', tier: 1, massKg: 0.3, model: 'acaraje_cosmic', tags: ['secreto'], rarity: 'alien', secret: true, matterMult: 30, description: 'Com vatapá de nebulosa e camarão de Saturno.' },
  { id: 'prancha_dourada', dex: 139, name: 'Prancha Dourada', tier: 1, massKg: 6, model: 'surfboard_gold', tags: ['secreto'], rarity: 'epico', paints: [0xf5c542], secret: true, matterMult: 25, description: 'Pegou o tubo perfeito em 1979. Nunca mais foi vista.' },
  { id: 'boto', dex: 140, name: 'Boto Cor-de-rosa', tier: 3, massKg: 160, model: 'pink_dolphin', tags: ['animal', 'secreto'], rarity: 'epico', secret: true, matterMult: 18, description: 'Dizem que vira gente em noite de festa. Hoje virou tripulante.' },
  { id: 'pastel_gigante', dex: 141, name: 'Pastel Gigante', tier: 2, massKg: 90, model: 'giant_pastel', tags: ['secreto'], rarity: 'epico', secret: true, matterMult: 20, description: 'Um metro e meio de pastel de vento. Recorde da feira.' },
  { id: 'pequi_radioativo', dex: 142, name: 'Pequi Radioativo', tier: 0, massKg: 0.4, model: 'pequi_glow', tags: ['natureza', 'secreto'], rarity: 'alien', secret: true, matterMult: 45, description: 'Brilha no escuro. Continua proibido morder.' },

  // ───────────── PACOTE BRASIL — comidinhas e miudezas
  { id: 'pao_queijo', dex: 143, name: 'Cesta de Pão de Queijo', tier: 0, massKg: 0.8, model: 'pao_queijo', tags: ['lixo'], description: 'Saiu quentinho do forno. Esfriou na estratosfera.' },
  { id: 'coxinha', dex: 144, name: 'Coxinha', tier: 0, massKg: 0.15, model: 'coxinha', tags: ['lixo'], description: 'Com catupiry. O formato aerodinâmico ajudou na subida.' },
  { id: 'brigadeiro', dex: 145, name: 'Bandeja de Brigadeiro', tier: 0, massKg: 0.6, model: 'brigadeiro', tags: ['lixo'], description: 'Era pra festa das 15h. Ninguém cantou parabéns.' },
  { id: 'guarana', dex: 146, name: 'Guaraná 2 Litros', tier: 0, massKg: 2.1, model: 'guarana', tags: ['lixo'], description: 'Estava sem gás desde domingo. Agora está sem gravidade também.' },
  { id: 'marmita', dex: 147, name: 'Marmita de Alumínio', tier: 0, massKg: 0.7, model: 'marmita', tags: ['lixo'], description: 'Arroz, feijão, bife e ovo. O almoço mais disputado da galáxia.' },
  { id: 'pipa', dex: 148, name: 'Pipa', tier: 0, massKg: 0.1, model: 'pipa', tags: ['movel'], paints: [0xe63946, 0x3a86ff, 0xffd23f, 0x2ec4b6, 0x8338ec, 0xf77f00], description: 'Cortaram a linha. Ela subiu, subiu, subiu...' },
  { id: 'radinho', dex: 149, name: 'Radinho de Pilha', tier: 0, massKg: 0.9, model: 'radinho', tags: ['movel'], description: 'Transmitia o jogo do Brasileirão. Pegou sinal de Marte.' },
  { id: 'vassoura', dex: 150, name: 'Vassoura de Piaçava', tier: 0, massKg: 1.2, model: 'vassoura', tags: ['movel'], description: 'Varria a calçada todo dia às 6h. Varreu o céu hoje.' },
  { id: 'garrafa_cafe', dex: 151, name: 'Garrafa Térmica de Café', tier: 0, massKg: 1.5, model: 'garrafa_cafe', tags: ['movel'], description: 'Café passado no coador de pano. O ET pediu com açúcar. Muito açúcar.' },
  { id: 'copo_acai', dex: 152, name: 'Copo de Açaí', tier: 0, massKg: 0.6, model: 'copo_acai', tags: ['lixo'], description: 'Setecentos mililitros com leite ninho e paçoca.' },
  { id: 'abacaxi', dex: 153, name: 'Abacaxi', tier: 0, massKg: 1.6, model: 'abacaxi', tags: ['natureza'], description: 'Descascar isso é um abacaxi. Abduzir, nem tanto.' },
  { id: 'melancia', dex: 154, name: 'Melancia', tier: 0, massKg: 9, model: 'melancia', tags: ['natureza'], description: 'Doce igual mel, garantiu o feirante. Vamos conferir lá em cima.' },
  { id: 'pandeiro', dex: 155, name: 'Pandeiro', tier: 0, massKg: 0.8, model: 'pandeiro', tags: ['movel'], description: 'A roda de samba perdeu o ritmo. Por uns três segundos.' },
  { id: 'berimbau', dex: 156, name: 'Berimbau', tier: 0, massKg: 1.1, model: 'berimbau', tags: ['movel'], description: 'Tocou "Paranauê" até sumir no céu.' },
  { id: 'pombo', dex: 157, name: 'Pombo da Praça', tier: 0, massKg: 0.35, model: 'pombo', tags: ['animal'], description: 'Não voou. Nunca voa. Precisou de ajuda alienígena.' },
  { id: 'rapadura', dex: 158, name: 'Rapadura', tier: 0, massKg: 0.5, model: 'rapadura', tags: ['lixo'], description: 'É doce, mas não é mole não.' },

  // ───────────── PACOTE BRASIL — casa, quintal e bichos pequenos
  { id: 'ventilador', dex: 159, name: 'Ventilador de Coluna', tier: 1, massKg: 5, model: 'ventilador', tags: ['movel'], description: 'Única arma contra os 40 graus. A casa vai sentir falta.' },
  { id: 'filtro_barro', dex: 160, name: 'Filtro de Barro', tier: 1, massKg: 9, model: 'filtro_barro', tags: ['movel'], description: 'A água mais gelada do Brasil. Tecnologia que a NASA inveja.' },
  { id: 'tv_tubo', dex: 161, name: 'TV de Tubo', tier: 1, massKg: 28, model: 'tv_tubo', tags: ['movel'], description: 'Com bombril na antena. Pegava todos os canais, menos o que você queria.' },
  { id: 'carrinho_rolima', dex: 162, name: 'Carrinho de Rolimã', tier: 1, massKg: 6, model: 'carrinho_rolima', tags: ['movel'], description: 'Sem freio, ladeira abaixo. Agora ladeira acima.' },
  { id: 'gaiola', dex: 163, name: 'Gaiola com Canário', tier: 1, massKg: 2, model: 'gaiola', tags: ['animal', 'movel'], description: 'O canário finalmente foi solto. Tecnicamente.' },
  { id: 'tanque', dex: 164, name: 'Tanque de Lavar Roupa', tier: 1, massKg: 60, model: 'tanque', tags: ['movel'], description: 'Com sabão em barra e roupa de molho desde ontem.' },
  { id: 'varal', dex: 165, name: 'Varal de Roupa', tier: 1, massKg: 12, model: 'varal', tags: ['movel'], description: 'Ia chover. Choveu disco voador.' },
  { id: 'rede_dormir', dex: 166, name: 'Rede de Dormir', tier: 1, massKg: 15, model: 'rede_dormir', tags: ['movel'], description: 'O cochilo da tarde foi interrompido por uma leve abdução.' },
  { id: 'papagaio', dex: 167, name: 'Papagaio Falante', tier: 1, massKg: 0.5, model: 'papagaio', tags: ['animal'], description: 'Só sabe falar "Corinthians" e "me leva". Pedido atendido.' },
  { id: 'tucano', dex: 168, name: 'Tucano', tier: 1, massKg: 0.7, model: 'tucano', tags: ['animal'], description: 'O bico pesa menos que parece. O resto também.' },
  { id: 'mico', dex: 169, name: 'Mico-leão-dourado', tier: 1, massKg: 0.6, model: 'mico', tags: ['animal'], description: 'Espécie protegida. Vai voltar com uma história incrível.' },
  { id: 'tatu', dex: 170, name: 'Tatu-bola', tier: 1, massKg: 1.5, model: 'tatu', tags: ['animal'], description: 'Virou bola por reflexo. Rolou pro céu.' },
  { id: 'tambor', dex: 171, name: 'Tambor de Bloco', tier: 1, massKg: 10, model: 'tambor', tags: ['movel'], paints: [0x1d4ed8, 0xe63946, 0x2a9d5a, 0xf77f00], description: 'O bloco saiu sem ele. O som continua ecoando lá em cima.' },

  // ───────────── PACOTE BRASIL — ambulantes, móveis largados e bichos médios
  { id: 'carrinho_churros', dex: 172, name: 'Carrinho de Churros', tier: 2, massKg: 80, model: 'carrinho_churros', tags: ['movel'], description: 'Doce de leite escorrendo em órbita baixa.' },
  { id: 'carrinho_picole', dex: 173, name: 'Carrinho de Picolé', tier: 2, massKg: 45, model: 'carrinho_picole', tags: ['movel'], description: 'Picolé de coco derretendo em 3... 2... espaço sideral.' },
  { id: 'carrinho_hotdog', dex: 174, name: 'Carrinho de Cachorro-Quente', tier: 2, massKg: 95, model: 'carrinho_hotdog', tags: ['movel'], description: 'Completo: purê, milho, batata palha e vinagrete. O ET quis dois.' },
  { id: 'carrinho_caldo', dex: 175, name: 'Moenda de Caldo de Cana', tier: 2, massKg: 180, model: 'carrinho_caldo', tags: ['movel'], description: 'Moía cana na feira há 30 anos. Foi moído pelo destino.' },
  { id: 'geladeira', dex: 176, name: 'Geladeira Retrô', tier: 2, massKg: 70, model: 'geladeira', tags: ['movel'], paints: [0x9ecae1, 0xf1a7b5, 0xf5f2ea, 0xa6d38b], description: 'Pote de sorvete dentro? Feijão. Sempre é feijão.' },
  { id: 'sofa', dex: 177, name: 'Sofá na Calçada', tier: 2, massKg: 55, model: 'sofa', tags: ['movel'], paints: [0x8a5a2e, 0x6a4c93, 0x2a9d8f, 0x7a1f2b], description: 'Largado ali "pra alguém que precise". Alguém precisou.' },
  { id: 'sinuca', dex: 178, name: 'Mesa de Sinuca do Bar', tier: 2, massKg: 250, model: 'sinuca', tags: ['movel'], description: 'Bola sete na caçapa do meio. A mesa inteira na caçapa do céu.' },
  { id: 'cama_elastica', dex: 179, name: 'Cama Elástica', tier: 2, massKg: 90, model: 'cama_elastica', tags: ['movel'], description: 'Pulou tão alto que não voltou.' },
  { id: 'bode', dex: 180, name: 'Bode', tier: 2, massKg: 60, model: 'bode', tags: ['animal'], description: 'Comeu o varal do vizinho. Agora está sendo comido pela curiosidade alienígena.' },
  { id: 'jegue', dex: 181, name: 'Jegue', tier: 2, massKg: 200, model: 'jegue', tags: ['animal'], description: 'Teimoso. Levou dez minutos pra aceitar o feixe.' },
  { id: 'porco', dex: 182, name: 'Porco', tier: 2, massKg: 120, model: 'porco', tags: ['animal'], description: 'Estava na lama feliz da vida. Continua feliz, só que voando.' },
  { id: 'tamandua', dex: 183, name: 'Tamanduá-bandeira', tier: 2, massKg: 40, model: 'tamandua', tags: ['animal'], description: 'Abraço de tamanduá não se recusa. Nem se aceita.' },
  { id: 'caixa_eletronico', dex: 184, name: 'Caixa Eletrônico', tier: 2, massKg: 400, model: 'caixa_eletronico', tags: ['estrutura'], matterMult: 3, description: 'Fora de serviço. Sempre esteve. Agora está fora do planeta.' },
  { id: 'moto_entrega', dex: 185, name: 'Motoboy de Entrega', tier: 2, massKg: 190, model: 'moto_entrega', tags: ['moto', 'pessoa'], description: 'Seu pedido saiu para entrega. Destino atualizado: Órbita.' },
  { id: 'canoa', dex: 186, name: 'Canoa', tier: 2, massKg: 90, model: 'canoa', tags: ['barco'], description: 'Remava devagarzinho no igarapé. Subiu rapidinho.' },
  { id: 'mandacaru', dex: 187, name: 'Mandacaru', tier: 2, massKg: 250, model: 'mandacaru', tags: ['natureza'], description: 'Quando fulora na seca é sinal que a chuva chega no sertão. Chegou disco.' },

  // ───────────── PACOTE BRASIL — carros de rua e bichos grandes
  { id: 'quadradinho', dex: 188, name: 'Quadradinho Rebaixado', tier: 3, massKg: 900, model: 'quadradinho', tags: ['carro'], paints: CAR_PAINTS, description: 'Rebaixado, som no talo e película 5%. Raspava em lombada. Agora nem toca o chão.' },
  { id: 'brasilia_amarela', dex: 189, name: 'Brasília Amarela', tier: 3, massKg: 890, model: 'brasilia_amarela', tags: ['carro'], description: 'Com roda gaúcha e alguém cantando que ia pro Guarujá.' },
  { id: 'uno_escada', dex: 190, name: 'Popular com Escada', tier: 3, massKg: 850, model: 'uno_escada', tags: ['carro'], paints: CAR_PAINTS, description: 'Escada no teto: veículo mais resistente já feito pela humanidade.' },
  { id: 'opala', dex: 191, name: 'Opalão Seis Cilindros', tier: 3, massKg: 1250, model: 'opala', tags: ['carro'], paints: [0x1d1d21, 0x7a1f2b, 0x1b4f9c, 0xf4f1e8, 0x2e8b57], description: 'Bebe mais que tio em churrasco. Ronca mais bonito também.' },
  { id: 'carro_pamonha', dex: 192, name: 'Carro da Pamonha', tier: 3, massKg: 950, model: 'carro_pamonha', tags: ['carro'], description: '"Pamonhas, pamonhas, pamonhas! Pamonhas de Piracicaba!" — agora em estéreo espacial.' },
  { id: 'jetski', dex: 193, name: 'Jet Ski', tier: 3, massKg: 400, model: 'jetski', tags: ['barco'], description: 'Fazia zerinho perto dos banhistas. Karma instantâneo.' },
  { id: 'onca', dex: 194, name: 'Onça-pintada', tier: 3, massKg: 110, model: 'onca', tags: ['animal'], matterMult: 3, description: 'Rainha do Pantanal. Ninguém mandou mexer com ela. Mexeram.' },
  { id: 'boi_bumba', dex: 195, name: 'Boi-bumbá', tier: 3, massKg: 180, model: 'boi_bumba', tags: ['marco'], matterMult: 2, description: 'Garantido ou Caprichoso? Agora é Abduzido.' },
  { id: 'cajueiro', dex: 196, name: 'Cajueiro', tier: 3, massKg: 700, model: 'cajueiro', tags: ['natureza'], description: 'Caju, castanha e sombra fresca. Tudo em um pacote só.' },
  { id: 'mangueira', dex: 197, name: 'Mangueira Carregada', tier: 3, massKg: 1200, model: 'mangueira', tags: ['natureza'], description: 'Dava manga pro bairro inteiro. Agora dá pra frota inteira.' },
  { id: 'jaqueira', dex: 198, name: 'Jaqueira', tier: 3, massKg: 1500, model: 'jaqueira', tags: ['natureza'], description: 'Não estacione embaixo. Ninguém ouviu. A jaqueira foi junto.' },
  { id: 'relogio_rua', dex: 199, name: 'Relógio-Termômetro de Rua', tier: 3, massKg: 600, model: 'relogio_rua', tags: ['estrutura'], description: 'Marcava 41 °C às 9 da manhã. Agora marca -270 °C.' },
  { id: 'carroca', dex: 200, name: 'Carroça de Frutas', tier: 3, massKg: 700, model: 'carroca', tags: ['animal', 'movel'], description: 'Jegue, carroça e feira completa. Delivery raiz.' },

  // ───────────── PACOTE BRASIL — utilitários e roça
  { id: 'lotacao', dex: 201, name: 'Van de Lotação', tier: 4, massKg: 2200, model: 'lotacao', tags: ['van'], paints: [0xf4f1e8, 0x2a9d8f, 0xf2b705, 0x1b4f9c], description: 'Cabe mais um! Sempre cabe mais um. Até no espaço.' },
  { id: 'trator', dex: 202, name: 'Trator', tier: 4, massKg: 4500, model: 'trator', tags: ['caminhao'], description: 'Arava a roça desde as 5h. Hora de arar as estrelas.' },
  { id: 'cacamba', dex: 203, name: 'Caçamba de Entulho', tier: 4, massKg: 3500, model: 'cacamba', tags: ['estrutura'], description: 'Tinha um sofá, uma privada e três portas. Levamos tudo.' },
  { id: 'araucaria', dex: 204, name: 'Araucária', tier: 4, massKg: 3000, model: 'araucaria', tags: ['natureza'], description: 'Pinhão pra fazer cozido. Direto do sul pro espaço.' },

  // ───────────── PACOTE BRASIL — caminhões do dia a dia
  { id: 'caminhao_gas', dex: 205, name: 'Caminhão do Gás', tier: 5, massKg: 7000, model: 'caminhao_gas', tags: ['caminhao'], description: 'Tocava "Pour Elise" pelas ruas. A música continua lá em cima.' },
  { id: 'caminhao_pipa', dex: 206, name: 'Caminhão-pipa', tier: 5, massKg: 14000, model: 'caminhao_pipa', tags: ['caminhao'], description: 'Dez mil litros de água. O feixe deu uma lavada.' },
  { id: 'caminhao_lixo', dex: 207, name: 'Caminhão do Lixo', tier: 5, massKg: 12000, model: 'caminhao_lixo', tags: ['caminhao'], description: 'Passava terça. Hoje passou pra cima. O gari veio junto.' },
  { id: 'betoneira', dex: 208, name: 'Caminhão Betoneira', tier: 5, massKg: 15000, model: 'betoneira', tags: ['caminhao'], description: 'Girando sem parar. O concreto vai endurecer no espaço.' },
  { id: 'onibus_excursao', dex: 209, name: 'Ônibus de Excursão', tier: 5, massKg: 14000, model: 'onibus_excursao', tags: ['onibus'], description: 'Excursão pra Aparecida com parada no Graal. Parada extra: Via Láctea.' },

  // ───────────── PACOTE BRASIL — casinhas e comércio de bairro
  { id: 'capela', dex: 210, name: 'Capela do Bairro', tier: 6, massKg: 60000, model: 'capela', tags: ['casa', 'estrutura'], description: 'Missa das sete, quermesse no sábado. Novena de 9 dias no espaço.' },
  { id: 'borracharia', dex: 211, name: 'Borracharia 24h', tier: 6, massKg: 45000, model: 'borracharia', tags: ['predio'], description: 'Aberta 24 horas, mas o dono nunca está.' },
  { id: 'pau_a_pique', dex: 212, name: 'Casa de Pau a Pique', tier: 6, massKg: 20000, model: 'pau_a_pique', tags: ['casa'], description: 'Barro, madeira e fogão a lenha. O café mais cheiroso do sertão.' },

  // ───────────── PACOTE BRASIL — festa, praça e água
  { id: 'coreto', dex: 213, name: 'Coreto da Praça', tier: 7, massKg: 90000, model: 'coreto', tags: ['estrutura'], description: 'A banda municipal tocava dobrado no domingo. Hoje toca em gravidade zero.' },
  { id: 'carro_alegorico', dex: 214, name: 'Carro Alegórico', tier: 7, massKg: 60000, model: 'carro_alegorico', tags: ['estrutura'], matterMult: 3, description: 'Nota dez em alegoria. Nota zero em ficar no chão.' },
  { id: 'balsa', dex: 215, name: 'Balsa com Carros', tier: 7, massKg: 400000, model: 'balsa', tags: ['barco'], matterMult: 2, description: 'Travessia de 40 minutos com oito carros e um vendedor de amendoim.' },
  { id: 'escuna', dex: 216, name: 'Escuna de Passeio', tier: 7, massKg: 60000, model: 'escuna', tags: ['barco'], description: 'Passeio pelas ilhas com caipirinha liberada. O roteiro mudou.' },

  // ───────────── PACOTE BRASIL — gigantes do bairro
  { id: 'roda_gigante', dex: 217, name: 'Roda-gigante do Parque', tier: 8, massKg: 500000, model: 'roda_gigante', tags: ['estrutura'], matterMult: 2, description: 'Do alto dava pra ver a cidade toda. Agora dá pra ver o planeta todo.' },
  { id: 'igreja_matriz', dex: 218, name: 'Igreja Matriz', tier: 8, massKg: 3_500_000, model: 'igreja_matriz', tags: ['predio'], description: 'Duas torres, um sino e 200 anos de casamentos. Ninguém disse "aceito" pra isso.' },
  { id: 'mercadao', dex: 219, name: 'Mercadão Municipal', tier: 8, massKg: 4_000_000, model: 'mercadao', tags: ['predio'], matterMult: 2, description: 'Pastel de bacalhau e sanduíche de mortadela de meio metro. O sonho de todo ET.' },
  { id: 'torre_celular', dex: 220, name: 'Torre de Celular', tier: 9, massKg: 800_000, model: 'torre_celular', tags: ['estrutura'], description: 'Finalmente 5G. Pena que só pega em órbita.' },

  // ───────────── PACOTE BRASIL — secretos: folclore e lendas urbanas
  { id: 'saci', dex: 221, name: 'Saci-Pererê', tier: 1, massKg: 25, model: 'saci', tags: ['secreto', 'pessoa'], rarity: 'alien', secret: true, matterMult: 35, description: 'Veio no redemoinho, de cachimbo aceso. Deu nó no rabo do disco.' },
  { id: 'curupira', dex: 222, name: 'Curupira', tier: 1, massKg: 30, model: 'curupira', tags: ['secreto', 'pessoa'], rarity: 'alien', secret: true, matterMult: 35, description: 'Os pés virados confundiram o radar. Quase fugiu.' },
  { id: 'mula_sem_cabeca', dex: 223, name: 'Mula sem Cabeça', tier: 3, massKg: 300, model: 'mula_sem_cabeca', tags: ['secreto', 'animal'], rarity: 'epico', secret: true, matterMult: 20, description: 'Solta fogo pelo pescoço. O feixe precisou de extintor.' },
  { id: 'chupacabra', dex: 224, name: 'Chupa-cabra', tier: 2, massKg: 45, model: 'chupacabra', tags: ['secreto', 'animal'], rarity: 'epico', secret: true, matterMult: 22, description: 'Os bodes do sítio agradecem a abdução.' },
  { id: 'et_varginha', dex: 225, name: 'ET de Varginha', tier: 1, massKg: 35, model: 'et_varginha', tags: ['secreto', 'pessoa'], rarity: 'alien', secret: true, matterMult: 50, description: 'Desaparecido desde 1996. Finalmente resgatado pelos parentes.' },
  { id: 'boitata', dex: 226, name: 'Boitatá', tier: 3, massKg: 200, model: 'boitata', tags: ['secreto', 'animal'], rarity: 'alien', secret: true, matterMult: 30, description: 'Cobra de fogo azul que protege a mata. Agora protege a nave.' },
  { id: 'caramelo_dourado', dex: 227, name: 'Caramelo Dourado', tier: 1, massKg: 18, model: 'caramelo_dourado', tags: ['secreto', 'animal'], rarity: 'epico', secret: true, matterMult: 25, description: 'O vira-lata mais valioso do Brasil. Estampa a nota de 200. Vai voltar. Prometemos.' },
];

export const OBJECT_BY_ID: ReadonlyMap<string, ObjectDef> = new Map(OBJECTS.map((o) => [o.id, o]));

export function getObjectDef(id: string): ObjectDef {
  const def = OBJECT_BY_ID.get(id);
  if (!def) throw new Error(`Unknown object def "${id}"`);
  return def;
}

export const DEX_OBJECTS: readonly ObjectDef[] = OBJECTS.filter((o) => !o.hidden).slice().sort((a, b) => a.dex - b.dex);

export const RARITY_INFO: Record<Rarity, { label: string; color: number; mult: number }> = {
  normal: { label: 'Comum', color: 0xffffff, mult: 1 },
  incomum: { label: 'Incomum', color: 0x7cf29a, mult: 1.6 },
  raro: { label: 'Raro', color: 0x4cc9f0, mult: 2.5 },
  epico: { label: 'Épico', color: 0xffc300, mult: 5 },
  alien: { label: 'Alienígena', color: 0x9d4dff, mult: 8 },
};

export const TIER_NAMES = [
  'MIUDEZAS',
  'OBJETOS LEVES',
  'MOTOS E CARRINHOS',
  'CARROS',
  'VANS E UTILITÁRIOS',
  'ÔNIBUS E CAMINHÕES',
  'CASAS',
  'COMÉRCIOS E GALPÕES',
  'PRÉDIOS',
  'TORRES',
  'ESTRUTURAS ESPECIAIS',
  'LENDÁRIO',
] as const;
