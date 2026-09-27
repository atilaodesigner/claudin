import { CAMPAIGN, getCity, type CityDef, type CityId } from '../config/cities';
import { MODES, weekKey, type GameMode } from '../config/modes';
import { citiesUnlocked, isUnlocked, starCount, totalStars } from '../progression/CampaignSystem';
import { friendlyError, type Online } from '../online/Online';
import { DIVISIONS, divisionFor } from '../progression/RankSystem';
import type { SaveData } from '../save/SaveService';
import { formatInt } from '../utils/math';
import { h, onTap, Screen } from './dom';

const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** Stylized Brazil outline (lon, lat), clockwise from Acre. */
const BRAZIL: ReadonlyArray<[number, number]> = [
  [-73.9, -7.4], [-72.9, -5.2], [-70.5, -4.2], [-69.9, -1.2], [-69.5, 0.8], [-67.1, 2.0], [-66.3, 0.8], [-64.0, 1.6], [-62.8, 3.8],
  [-60.7, 5.2], [-60.0, 4.5], [-59.6, 1.9], [-56.5, 2.0], [-54.1, 2.2], [-52.5, 2.5], [-51.6, 4.2], [-50.0, 1.7], [-50.0, 0.3],
  [-48.4, -1.2], [-46.9, -0.9], [-44.3, -2.5], [-41.8, -2.8], [-38.5, -3.7], [-37.2, -4.8], [-35.2, -5.2], [-34.8, -7.1],
  [-35.0, -8.1], [-35.7, -9.7], [-37.0, -11.0], [-38.5, -13.0], [-39.0, -15.0], [-39.2, -17.7], [-40.3, -20.3], [-41.0, -21.6],
  [-42.0, -23.0], [-43.2, -23.0], [-44.8, -23.4], [-46.5, -24.1], [-48.4, -25.8], [-48.6, -28.2], [-49.8, -29.4], [-51.0, -31.0],
  [-52.2, -32.2], [-53.4, -33.7], [-55.6, -30.9], [-57.6, -30.2], [-55.0, -27.2], [-53.7, -26.2], [-54.6, -25.6], [-54.3, -24.0],
  [-55.8, -22.3], [-57.9, -22.1], [-57.7, -19.0], [-58.4, -17.3], [-60.0, -16.3], [-60.3, -13.7], [-62.2, -13.2], [-65.3, -11.9],
  [-65.3, -10.8], [-66.6, -9.9], [-68.8, -11.1], [-69.6, -11.0], [-70.5, -9.5], [-72.4, -10.0], [-73.2, -9.4],
];

/** Label placement per pin so close cities (Rio / São Paulo) don't overlap. */
const LABEL_POS: Partial<Record<CityId, [number, number, 'start' | 'end']>> = {
  sao_paulo: [-12, 4, 'end'],
  rio: [12, 14, 'start'],
  nova_aurora: [12, -6, 'start'],
  brasilia: [-12, 4, 'end'],
};

const px = (lon: number) => (lon + 75) * 10;
const py = (lat: number) => (6 - lat) * 10;

/** Step 1 after INVADIR: pick how you want to play. */
export class ModeScreen extends Screen {
  private readonly cards: HTMLDivElement;
  onPick: ((mode: GameMode) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'subscreen modes');
    const top = h('div', 'topbar');
    top.appendChild(h('div', 'title-xl', 'COMO VAI SER A INVASÃO?'));
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => this.onClose?.());
    top.appendChild(back);
    this.cards = h('div', 'mode-cards');
    this.root.append(top, this.cards);
  }

  open(save: SaveData): void {
    this.cards.innerHTML = '';
    const div = divisionFor(save.rank.rp);
    const status: Record<Exclude<GameMode, 'diaria'>, string> = {
      casual: `${citiesUnlocked(save.campaign)} CIDADES LIBERADAS · SEM INIMIGOS`,
      campanha: `★ ${totalStars(save.campaign)} / ${CAMPAIGN.length * 3} · ${citiesUnlocked(save.campaign)}/${CAMPAIGN.length} CIDADES`,
      ranqueada: `${div.division.name} · ${formatInt(save.rank.rp)} RP`,
    };
    const order: Array<Exclude<GameMode, 'diaria'>> = ['casual', 'campanha', 'ranqueada'];
    order.forEach((m, i) => {
      const info = MODES[m];
      const card = h('button', `mode-card panel m-${m}`);
      card.style.animationDelay = `${i * 0.07}s`;
      card.appendChild(h('div', 'tag', info.tag));
      card.appendChild(h('div', 'name', info.name));
      card.appendChild(h('div', 'desc', info.description));
      const st = h('div', 'status', status[m]);
      if (m === 'ranqueada') st.style.color = div.division.color;
      card.appendChild(st);
      onTap(card, () => this.onPick?.(m));
      this.cards.appendChild(card);
    });
    this.show();
  }
}

/** Brazil map with the cities: campaign progress, or free choice for casual. */
export class CityMapScreen extends Screen {
  private readonly title: HTMLSpanElement;
  private readonly sub: HTMLElement;
  private readonly map: SVGSVGElement;
  private readonly detail: HTMLDivElement;
  private mode: GameMode = 'campanha';
  private save: SaveData | null = null;
  private selected: CityId = 'nova_aurora';
  onStart: ((mode: GameMode, city: CityId) => void) | null = null;
  onClose: (() => void) | null = null;
  onHover: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'subscreen citymap');
    const top = h('div', 'topbar');
    const heading = h('div', 'title-xl');
    this.title = h('span', '', '');
    this.sub = h('small', '', '');
    heading.append(this.title, this.sub);
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => this.onClose?.());
    top.append(heading, back);
    const body = h('div', 'map-body');
    const mapWrap = h('div', 'map-wrap');
    this.map = svg('svg', { viewBox: '-10 -10 440 420', class: 'brazil' });
    mapWrap.appendChild(this.map);
    this.detail = h('div', 'city-detail panel');
    body.append(mapWrap, this.detail);
    this.root.append(top, body);
  }

  open(mode: GameMode, save: SaveData): void {
    this.mode = mode;
    this.save = save;
    const campaign = mode === 'campanha';
    this.title.textContent = campaign ? 'INVASÃO DO BRASIL' : 'PASSEIO';
    this.sub.textContent = campaign ? `★ ${totalStars(save.campaign)} / ${CAMPAIGN.length * 3} ESTRELAS` : 'ESCOLHA UMA CIDADE LIBERADA';
    // default selection: the furthest unlocked city in the campaign, or the last one played
    const unlocked = CAMPAIGN.filter((c) => isUnlocked(save.campaign, c.id));
    const last = getCity(save.last.city);
    const frontier = [...unlocked].reverse().find((c) => (save.campaign[c.id]?.clears ?? 0) === 0) ?? unlocked[unlocked.length - 1];
    this.selected = (campaign ? frontier : isUnlocked(save.campaign, last.id) ? last : frontier)?.id ?? 'nova_aurora';
    this.drawMap();
    this.drawDetail();
    this.show();
  }

  private drawMap(): void {
    const save = this.save as SaveData;
    this.map.innerHTML = '';
    const pts = BRAZIL.map(([lo, la]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join(' ');
    this.map.appendChild(svg('polygon', { points: pts, class: 'land' }));
    // grid lines like a radar screen
    for (let i = 0; i <= 8; i++) {
      this.map.appendChild(svg('line', { x1: i * 52, y1: -10, x2: i * 52, y2: 410, class: 'grid' }));
      this.map.appendChild(svg('line', { x1: -10, y1: i * 52, x2: 430, y2: i * 52, class: 'grid' }));
    }
    // the invasion route so far (unlocked cities, in campaign order)
    const open = CAMPAIGN.filter((c) => isUnlocked(save.campaign, c.id));
    if (open.length > 1) {
      const route = open.map((c) => `${px(c.lon).toFixed(1)},${py(c.lat).toFixed(1)}`).join(' ');
      this.map.appendChild(svg('polyline', { points: route, class: 'route' }));
    }
    for (const c of CAMPAIGN) {
      const open = isUnlocked(save.campaign, c.id);
      const g = svg('g', { class: `pin${open ? '' : ' locked'}${c.id === this.selected ? ' sel' : ''}`, transform: `translate(${px(c.lon).toFixed(1)} ${py(c.lat).toFixed(1)})` });
      g.appendChild(svg('circle', { r: 16, class: 'hit' }));
      g.appendChild(svg('circle', { r: 9, class: 'ring' }));
      g.appendChild(svg('circle', { r: 4.5, class: 'dot' }));
      const [lx, ly, anchor] = LABEL_POS[c.id] ?? [12, 4, 'start'];
      const label = svg('text', { x: lx, y: ly, class: 'lbl', 'text-anchor': anchor });
      label.textContent = c.id === 'nova_aurora' ? 'NOVA AURORA ?' : c.name.toUpperCase();
      g.appendChild(label);
      const stars = starCount(save.campaign[c.id]);
      if (open && stars > 0) {
        const st = svg('text', { x: lx, y: ly + 12, class: 'stars', 'text-anchor': anchor });
        st.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        g.appendChild(st);
      }
      g.addEventListener('pointerdown', (e) => e.stopPropagation());
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selected = c.id;
        this.onHover?.();
        this.drawMap();
        this.drawDetail();
      });
      this.map.appendChild(g);
    }
  }

  private drawDetail(): void {
    const save = this.save as SaveData;
    const c = getCity(this.selected);
    const p = save.campaign[c.id];
    const open = isUnlocked(save.campaign, c.id);
    const d = this.detail;
    d.innerHTML = '';
    d.appendChild(h('div', 'label', `${c.nickname} · ${c.uf}`));
    d.appendChild(h('h2', '', c.name.toUpperCase()));
    d.appendChild(h('div', 'desc', c.blurb));
    const diff = h('div', 'diff');
    diff.appendChild(h('span', '', 'AMEAÇA'));
    for (let i = 1; i <= 5; i++) diff.appendChild(h('i', i <= c.difficulty ? 'on' : ''));
    d.appendChild(diff);
    if (this.mode === 'campanha') {
      const list = h('div', 'star-list');
      c.stars.forEach((s, i) => {
        const got = !!p?.stars[i];
        list.appendChild(h('div', got ? 'got' : '', `${got ? '★' : '☆'} ${s.title}`));
      });
      d.appendChild(list);
    }
    const best = h('div', 'best', p?.bestScore ? `RECORDE ${formatInt(p.bestScore)}` : 'AINDA NÃO INVADIDA');
    d.appendChild(best);
    if (open) {
      const go = h('button', 'btn primary', 'INVADIR');
      onTap(go, () => this.onStart?.(this.mode, c.id));
      d.appendChild(go);
    } else {
      const idx = CAMPAIGN.findIndex((x) => x.id === c.id);
      const prev = CAMPAIGN[idx - 1] as CityDef;
      d.appendChild(h('div', 'locked', `🔒 EXTRAIA EM ${prev.name.toUpperCase()} PARA LIBERAR`));
    }
  }
}

/** Divisions, the week's map, the daily map and the online weekly leaderboard. */
export class RankScreen extends Screen {
  private readonly body: HTMLDivElement;
  private boardReq = 0;
  onStart: ((mode: GameMode) => void) | null = null;
  onClose: (() => void) | null = null;
  onAccount: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly online: Online) {
    super(parent, 'subscreen rank');
    const top = h('div', 'topbar');
    const title = h('div', 'title-xl', 'RANQUEADA');
    title.appendChild(h('small', '', `TEMPORADA ${weekKey()}`));
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => this.onClose?.());
    top.append(title, back);
    this.body = h('div', 'content scroll rank-body');
    this.root.append(top, this.body);
  }

  open(save: SaveData, weekCity: CityId, dayCity: CityId, dailyBest: number | null): void {
    const b = this.body;
    b.innerHTML = '';
    const r = save.rank;
    const st = divisionFor(r.rp);
    const badge = h('div', 'rank-badge panel');
    badge.style.setProperty('--div', st.division.color);
    badge.appendChild(h('div', 'emblem', st.division.name.slice(0, 1)));
    const info = h('div', 'info');
    info.appendChild(h('div', 'label', 'SUA DIVISÃO'));
    info.appendChild(h('h2', '', st.division.name));
    info.appendChild(h('div', 'rp', `${formatInt(r.rp)} RP${r.lastDelta ? `  (${r.lastDelta > 0 ? '+' : ''}${r.lastDelta} na última)` : ''}`));
    const bar = h('div', 'bar');
    const fill = h('div', 'fill');
    fill.style.transform = `scaleX(${st.progress.toFixed(3)})`;
    bar.appendChild(fill);
    info.appendChild(bar);
    info.appendChild(h('div', 'next', st.next ? `PRÓXIMA: ${st.next.name} EM ${formatInt(st.next.min - r.rp)} RP` : 'TOPO DO RANKING'));
    badge.appendChild(info);
    b.appendChild(badge);

    const week = getCity(weekCity);
    const wk = h('div', 'rank-play panel');
    wk.appendChild(h('div', 'label', 'MAPA DA SEMANA · IGUAL PARA TODOS'));
    wk.appendChild(h('h2', '', week.name.toUpperCase()));
    wk.appendChild(h('div', 'desc', r.week === weekKey() && r.weekBest > 0 ? `SEU MELHOR NA SEMANA: ${formatInt(r.weekBest)}` : 'Você ainda não jogou a ranqueada desta semana.'));
    const play = h('button', 'btn primary', 'JOGAR RANQUEADA');
    onTap(play, () => this.onStart?.('ranqueada'));
    wk.appendChild(play);
    b.appendChild(wk);

    const day = getCity(dayCity);
    const dy = h('div', 'rank-play panel');
    dy.appendChild(h('div', 'label', 'INVASÃO DO DIA · MUDA À MEIA-NOITE'));
    dy.appendChild(h('h2', '', day.name.toUpperCase()));
    dy.appendChild(h('div', 'desc', dailyBest ? `RECORDE DE HOJE: ${formatInt(dailyBest)}` : 'Um mapa novo por dia. Não mexe no seu RP.'));
    const dbtn = h('button', 'btn gold', 'JOGAR A DO DIA');
    onTap(dbtn, () => this.onStart?.('diaria'));
    dy.appendChild(dbtn);
    b.appendChild(dy);

    const ladder = h('div', 'ladder');
    for (const d of [...DIVISIONS].reverse()) {
      const row = h('div', `rung${d.id === st.division.id ? ' me' : ''}`);
      row.style.setProperty('--div', d.color);
      row.appendChild(h('b', '', d.name));
      row.appendChild(h('span', '', `${formatInt(d.min)} RP`));
      ladder.appendChild(row);
    }
    b.appendChild(ladder);
    const board = h('div', 'board panel');
    b.appendChild(board);
    b.appendChild(
      h(
        'div',
        'note',
        this.online.enabled
          ? 'Com conta, seu RP e suas partidas ranqueadas valem no ranking online (o servidor confere cada partida). Sem conta, o RP fica salvo só neste aparelho.'
          : 'Esta cópia roda offline: o RP fica salvo neste aparelho.',
      ),
    );
    this.show();
    void this.fillBoard(board, week.name.toUpperCase());
  }

  private async fillBoard(board: HTMLDivElement, cityName: string): Promise<void> {
    const req = ++this.boardReq;
    const o = this.online;
    const head = h('div', 'board-head');
    head.appendChild(h('div', 'label', `RANKING DA SEMANA · ${cityName}`));
    const me = h('div', 'me', '');
    head.appendChild(me);
    board.appendChild(head);
    const list = h('div', 'board-list');
    board.appendChild(list);
    if (!o.enabled) {
      list.appendChild(h('div', 'empty', 'Ranking online indisponível nesta versão.'));
      return;
    }
    list.appendChild(h('div', 'empty', 'Carregando o ranking...'));
    try {
      await o.init();
      const wk = weekKey();
      const [rows, mine] = await Promise.all([o.leaderboard(wk, 50), o.signedIn ? o.myStanding(wk) : Promise.resolve(null)]);
      if (req !== this.boardReq) return;
      list.innerHTML = '';
      if (!o.signedIn) {
        const cta = h('button', 'btn gold', 'ENTRAR PRA COMPETIR');
        onTap(cta, () => this.onAccount?.());
        me.appendChild(cta);
      } else if (mine) me.textContent = `VOCÊ: #${mine.pos} DE ${formatInt(mine.players)}`;
      else me.textContent = o.profile ? `${o.profile.nickname} · JOGUE PRA ENTRAR NO RANKING` : '';
      if (!rows.length) {
        list.appendChild(h('div', 'empty', 'Ninguém pontuou nessa semana ainda. O topo tá livre!'));
        return;
      }
      for (const r of rows) {
        const d = divisionFor(r.rp).division;
        const row = h('div', `brow${r.user_id === o.userId ? ' mine' : ''}${r.pos <= 3 ? ` top${r.pos}` : ''}`);
        row.style.setProperty('--div', d.color);
        row.appendChild(h('span', 'pos', `${r.pos}`));
        const who = h('span', 'who');
        who.appendChild(h('i', 'dot'));
        who.appendChild(document.createTextNode(r.nickname));
        row.appendChild(who);
        row.appendChild(h('span', 'div', d.name));
        row.appendChild(h('b', 'score', formatInt(r.score)));
        list.appendChild(row);
      }
    } catch (err) {
      if (req !== this.boardReq) return;
      list.innerHTML = '';
      list.appendChild(h('div', 'empty', friendlyError(err)));
    }
  }
}
