import { h } from './dom';

export interface ObjectiveView {
  title: string;
  progress: number;
  goal: number;
  done: boolean;
}

interface Row {
  el: HTMLDivElement;
  bar: HTMLDivElement;
  count: HTMLSpanElement;
  title: HTMLSpanElement;
  icon: HTMLSpanElement;
  last: number;
  done: boolean;
}

/**
 * Always-on objective tracker: every objective with its own progress bar. The one that
 * moved last is "in focus" (brighter, and the only one shown in portrait). Progress
 * pulses the row; completion flashes it gold.
 */
export class ObjectiveTracker {
  readonly root: HTMLDivElement;
  private readonly head: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private rows: Row[] = [];
  private signature = '';
  private focus = 0;
  private stars = false;

  constructor(parent: HTMLElement) {
    this.root = h('div', 'obj-tracker');
    this.head = h('div', 'obj-head', 'OBJETIVOS');
    this.list = h('div', 'obj-list');
    this.root.append(this.head, this.list);
    parent.appendChild(this.root);
  }

  set(list: readonly ObjectiveView[], stars: boolean, heading: string): void {
    const sig = `${stars}|${heading}|${list.map((c) => `${c.title}:${c.goal}`).join('|')}`;
    if (sig !== this.signature) this.rebuild(list, stars, heading, sig);
    let moved = -1;
    list.forEach((c, i) => {
      const row = this.rows[i];
      if (!row) return;
      const p = Math.min(c.goal, Math.floor(c.progress));
      if (p !== row.last || c.done !== row.done) {
        if (c.done && !row.done) this.flash(row, 'complete');
        else if (p > row.last) this.flash(row, 'bump');
        if (!c.done) moved = i;
        row.last = p;
        row.done = c.done;
        this.paint(row, c);
      }
    });
    if (moved >= 0) this.focus = moved;
    // keep focus on something still open
    if (list[this.focus]?.done) {
      const open = list.findIndex((c) => !c.done);
      if (open >= 0) this.focus = open;
    }
    this.rows.forEach((r, i) => r.el.classList.toggle('focus', i === this.focus && !r.done));
    this.root.classList.toggle('all-done', list.length > 0 && list.every((c) => c.done));
  }

  private rebuild(list: readonly ObjectiveView[], stars: boolean, heading: string, sig: string): void {
    this.signature = sig;
    this.stars = stars;
    this.head.textContent = heading;
    this.list.innerHTML = '';
    this.rows = list.map((c) => {
      const el = h('div', 'obj-row');
      const icon = h('span', 'ic');
      const title = h('span', 'tt', c.title);
      const count = h('span', 'ct');
      const track = h('div', 'track');
      const bar = h('div', 'fill');
      track.appendChild(bar);
      const top = h('div', 'top');
      top.append(icon, title, count);
      el.append(top, track);
      this.list.appendChild(el);
      const row: Row = { el, bar, count, title, icon, last: Math.floor(c.progress), done: c.done };
      this.paint(row, c);
      return row;
    });
    this.focus = Math.max(0, list.findIndex((c) => !c.done));
  }

  private paint(row: Row, c: ObjectiveView): void {
    const p = Math.min(c.goal, Math.floor(c.progress));
    row.icon.textContent = this.stars ? (c.done ? '★' : '☆') : c.done ? '✔' : '';
    row.count.textContent = c.done ? 'OK' : c.goal > 1 ? `${p}/${c.goal}` : '';
    row.bar.style.transform = `scaleX(${(c.done ? 1 : c.goal > 0 ? p / c.goal : 0).toFixed(3)})`;
    row.el.classList.toggle('done', c.done);
  }

  private flash(row: Row, kind: 'bump' | 'complete'): void {
    row.el.classList.remove('bump', 'complete');
    // restart the CSS animation
    void row.el.offsetWidth;
    row.el.classList.add(kind);
  }

  clear(): void {
    this.signature = '';
    this.rows = [];
    this.list.innerHTML = '';
  }
}
