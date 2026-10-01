// Rádio do bonde: o pessoal conversando durante o jogo numa caixinha discreta
// na lateral (foto/bolinha de quem fala, nome e a fala digitando). As falas
// vêm por evento (drift grande, batida, fita, racha, ferro-velho, missão) e,
// de vez em quando, um papo à toa no mundo livre. Some sozinha.

export type Who = 'duckjay' | 'diey' | 'bella' | 'bozo';
export type Line = [Who, string];

const PEOPLE: Record<Who, { name: string; color: string; img?: string }> = {
  duckjay: { name: 'DuckJay', color: '#E6B84A', img: './campaign/duckjay.webp' },
  diey: { name: 'Diey', color: '#9A6A45' },
  bella: { name: 'Bella', color: '#D8323C' },
  bozo: { name: 'Bozó', color: '#B8B8C4' },
};

/** falas por situação; cada item é uma fala solta ou uma conversa (várias falas em sequência) */
export const LINES: Record<string, (Line | Line[])[]> = {
  intro: [
    [['duckjay', 'Na escuta, piloto? Rádio do bonde ligado.'], ['bella', 'Até que enfim! Bora pro rolê.']],
    [['duckjay', 'Rua molhada, madrugada vazia. Noite boa pra drift.'], ['bozo', 'Asfalto liso desse jeito é presente, mano.']],
  ],
  idle: [
    [['bozo', 'Alguém viu a minha jaqueta? Deixei no ferro-velho.'], ['diey', 'Tá no capô do Tanque, como sempre.']],
    [['bella', 'Esse grave tá batendo até no meu peito daqui.'], ['duckjay', 'É o paredão da feira, tá virado hoje.']],
    [['diey', 'Rádio de polícia tá quieto demais.'], ['duckjay', 'Quieto é bom. Aproveita.']],
    [['bozo', 'Passa no açaí depois? Tô morrendo de fome.'], ['bella', 'Depois do rolê, Bozó. Foco.']],
    [['duckjay', 'Ó, tem fita K7 espalhada pela quebrada. Cata tudo.']],
    [['bella', 'Viu o balão? Dá pra fazer a volta inteira de lado.'], ['bozo', 'Só se for com fé.']],
    [['diey', 'Cuidado na terra vermelha, o carro escorrega mais.']],
    [['duckjay', 'Os rachas tão marcados de azul no mapa. Quem topa?'], ['bella', 'Eu topo sempre.']],
  ],
  bigDrift: [
    ['bella', 'Isso que é ângulo!'],
    ['bozo', 'Caraca, de lado a quadra inteira!'],
    ['duckjay', 'A quebrada inteira viu essa.'],
    ['diey', 'Limpo. Muito limpo.'],
    ['bozo', 'Me ensina esse aí depois.'],
  ],
  crash: [
    ['bozo', 'Ih, beijou o muro.'],
    ['diey', 'Respira. Endireita e volta.'],
    ['bella', 'Calma, o combo foi, mas o carro tá inteiro.'],
    ['duckjay', 'Pega leve, o carro não é de lata. Quer dizer, é.'],
  ],
  fita: [
    ['duckjay', 'Mais uma fita pro acervo!'],
    ['bella', 'Essa aí é raridade.'],
    ['diey', 'Guarda essa, tem faixa que nunca saiu.'],
  ],
  fitaAll: [[['duckjay', 'Todas as fitas! Agora o grave é todo teu.'], ['bella', 'Lenda da quebrada.']]],
  rachaStart: [
    ['bella', 'Valendo! Corta caminho que eu duvido.'],
    ['duckjay', 'Segue a faixa azul e não tira o pé.'],
    ['bozo', 'Vai, vai, vai!'],
  ],
  rachaWin: [
    ['bella', 'Chegou voando! Essa foi bonita.'],
    ['duckjay', 'Tempo bom. O bonde agradece.'],
  ],
  rachaFail: [
    ['diey', 'Passou do tempo. Tenta de novo, já pegou o traçado.'],
    ['bozo', 'Quase! O relógio que é rápido demais.'],
  ],
  yard: [
    ['duckjay', 'Chegou no ferro-velho. Aqui é casa, ninguém mexe.'],
    ['bozo', 'O fogo tá aceso, cola aí.'],
    ['diey', 'Quer trocar de carro? A garagem tá aberta.'],
  ],
  lowLife: [
    ['diey', 'O carro tá todo amassado, segura a onda!'],
    ['bella', 'Para de bater, piloto!'],
    ['duckjay', 'Mais uma dessa e o carro fica.'],
  ],
  missionWin: [
    [['duckjay', 'Missão cumprida. Câmbio.'], ['bella', 'Bonde invicto!']],
    [['bozo', 'Eu sabia! Eu falei que dava!'], ['diey', 'Tu falou que não dava, Bozó.']],
  ],
  missionFail: [
    [['duckjay', 'Não deu dessa vez. Respira e volta.'], ['diey', 'Já viu onde errou. Agora vai.']],
    [['bella', 'Calma, ninguém nasceu sabendo.']],
  ],
  // conversa de cada capítulo: começo e meio
  c1Start: [[['duckjay', 'Movimentação estranha no bairro. Faz a volta e sente o carro.'], ['bella', 'Tô colada atrás de você.']]],
  c1Mid: [['diey', 'Isso, entra de lado e sai acelerando.']],
  c2Start: [[['duckjay', 'Tem viatura rondando a região da carga.'], ['diey', 'Não para. Ritmo constante e chega no caminhão.']]],
  c2Mid: [['bozo', 'Sirene atrás! Não olha pra trás, só vai.']],
  c3Start: [[['duckjay', 'O caminhão tá na pista. Cola nele e segura.'], ['bella', 'Atrás ou do lado, não larga de jeito nenhum.']]],
  c3Mid: [['diey', 'Tá colado, mantém a distância!']],
  c4Start: [[['duckjay', 'A polícia veio atrás do grupo. Olho nos bloqueios.'], ['bozo', 'Eles fecharam a rua de cima!']]],
  c4Mid: [['bella', 'Passa pela brecha, vai, vai!']],
  c5Start: [[['duckjay', 'Última volta. Some com o bonde na noite.'], ['bella', 'Bora sumir.'], ['bozo', 'Ninguém vai ver nem a lanterna.']]],
  c5Mid: [['diey', 'Tá quase. Não inventa agora.']],
};

const LINE_TIME = 4.2; // segundos por fala (mais o tempo de digitar)

export class Chatter {
  private el: HTMLDivElement;
  private avatar: HTMLDivElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private queue: Line[] = [];
  private cur: { line: Line; t: number; shown: number } | null = null;
  private cooldown = new Map<string, number>();
  private lastPick = new Map<string, number>();
  private time = 0;
  /** desligado pelas configurações ou fora do jogo */
  enabled = true;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'chatter';
    this.el.innerHTML = '<div class="ch-av"></div><div class="ch-body"><b></b><p></p></div>';
    this.avatar = this.el.querySelector('.ch-av')!;
    this.nameEl = this.el.querySelector('b')!;
    this.textEl = this.el.querySelector('p')!;
    parent.appendChild(this.el);
  }

  get busy(): boolean {
    return !!this.cur || this.queue.length > 0;
  }

  /**
   * Fala de uma situação. `cool` = segundos até essa situação poder falar de
   * novo; `chance` = probabilidade (pra não falar toda vez); `urgent` passa na frente.
   */
  say(key: string, opts: { cool?: number; chance?: number; urgent?: boolean } = {}): void {
    if (!this.enabled) return;
    const pool = LINES[key];
    if (!pool?.length) return;
    if ((this.cooldown.get(key) ?? -1) > this.time) return;
    if (opts.chance !== undefined && Math.random() > opts.chance) return;
    // não interrompe uma conversa com papo à toa
    if (!opts.urgent && this.busy) return;
    this.cooldown.set(key, this.time + (opts.cool ?? 20));
    let i = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && i === this.lastPick.get(key)) i = (i + 1) % pool.length;
    this.lastPick.set(key, i);
    const item = pool[i]!;
    const lines = (Array.isArray(item[0]) ? item : [item]) as Line[];
    if (opts.urgent) {
      this.queue = [...lines];
      this.cur = null;
    } else this.queue.push(...lines);
  }

  update(dt: number): void {
    this.time += dt;
    if (!this.enabled) {
      this.queue = [];
      this.cur = null;
      this.el.classList.remove('on');
      return;
    }
    if (!this.cur && this.queue.length) {
      const line = this.queue.shift()!;
      this.cur = { line, t: 0, shown: 0 };
      const p = PEOPLE[line[0]];
      this.nameEl.textContent = p.name;
      this.nameEl.style.color = p.color;
      this.avatar.style.setProperty('--c', p.color);
      this.avatar.innerHTML = p.img ? `<img src="${p.img}" alt="" />` : `<span>${p.name[0]}</span>`;
      this.textEl.textContent = '';
      this.el.classList.add('on');
    }
    if (!this.cur) return;
    const c = this.cur;
    c.t += dt;
    // digita (~45 letras por segundo)
    const n = Math.min(c.line[1].length, Math.floor(c.t * 45));
    if (n !== c.shown) {
      c.shown = n;
      this.textEl.textContent = c.line[1].slice(0, n);
    }
    const dur = LINE_TIME + c.line[1].length / 45;
    if (c.t > dur) {
      this.cur = null;
      if (!this.queue.length) this.el.classList.remove('on');
    }
  }
}
