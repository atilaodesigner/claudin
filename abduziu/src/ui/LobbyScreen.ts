import type { FriendInfo, SocialState } from '../online/SocialNet';
import { h, onTap, Screen } from './dom';

/**
 * ONLINE · LOBBY: your nick + friend code, your group, friend requests and the friends
 * list (invite them, or jump into the room they're playing in).
 */
export class LobbyScreen extends Screen {
  private readonly nickInput: HTMLInputElement;
  private readonly codeEl: HTMLSpanElement;
  private readonly copyBtn: HTMLButtonElement;
  private readonly partyList: HTMLDivElement;
  private readonly partyHint: HTMLDivElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly leaveBtn: HTMLButtonElement;
  private readonly addInput: HTMLInputElement;
  private readonly reqBox: HTMLDivElement;
  private readonly reqList: HTMLDivElement;
  private readonly friendList: HTMLDivElement;
  private readonly friendCount: HTMLSpanElement;
  private readonly status: HTMLDivElement;
  private state: SocialState | null = null;
  private connected = false;
  onClose: (() => void) | null = null;
  onPlay: (() => void) | null = null;
  onNick: ((nick: string) => void) | null = null;
  onAdd: ((tag: string) => void) | null = null;
  onAccept: ((code: string) => void) | null = null;
  onDecline: ((code: string) => void) | null = null;
  onRemove: ((code: string) => void) | null = null;
  onInvite: ((code: string) => void) | null = null;
  onJoin: ((code: string) => void) | null = null;
  onLeaveParty: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    super(parent, 'subscreen lobby');
    const top = h('div', 'topbar');
    const title = h('div', 'title-xl', 'ONLINE');
    title.appendChild(h('small', '', 'LOBBY · AMIGOS · JOGUE JUNTO'));
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => this.onClose?.());
    top.append(title, back);

    const grid = h('div', 'content scroll lobby-grid');

    // ── left: me + group + play
    const left = h('div', 'lobby-col');
    const me = h('div', 'panel lobby-card me');
    me.appendChild(h('div', 'lbl', 'SEU PERFIL'));
    const idRow = h('div', 'id-row');
    this.nickInput = h('input', 'lobby-input nick');
    this.nickInput.maxLength = 16;
    this.nickInput.placeholder = 'Seu nick';
    this.nickInput.autocomplete = 'off';
    this.nickInput.spellcheck = false;
    const commit = () => {
      const v = this.nickInput.value.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16);
      if (v.length >= 2 && v !== this.state?.me.nick) this.onNick?.(v);
      else if (this.state) this.nickInput.value = this.state.me.nick;
    };
    this.nickInput.addEventListener('change', commit);
    this.nickInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.nickInput.blur();
    });
    this.codeEl = h('span', 'code', '#······');
    idRow.append(this.nickInput, this.codeEl);
    me.appendChild(idRow);
    this.copyBtn = h('button', 'btn ghost small', 'COPIAR MEU ID');
    onTap(this.copyBtn, () => this.copyId());
    me.appendChild(this.copyBtn);
    me.appendChild(h('div', 'hint', 'Mande seu NICK#CÓDIGO pros amigos te adicionarem.'));

    const party = h('div', 'panel lobby-card party');
    const ph = h('div', 'lbl', 'SEU GRUPO');
    party.appendChild(ph);
    this.partyList = h('div', 'party-list');
    party.appendChild(this.partyList);
    this.partyHint = h('div', 'hint', '');
    party.appendChild(this.partyHint);
    this.playBtn = h('button', 'btn primary play', 'JOGAR ONLINE');
    onTap(this.playBtn, () => this.onPlay?.());
    this.leaveBtn = h('button', 'btn ghost small', 'SAIR DO GRUPO');
    onTap(this.leaveBtn, () => this.onLeaveParty?.());
    party.append(this.playBtn, this.leaveBtn);
    left.append(me, party);

    // ── right: add + requests + friends
    const right = h('div', 'lobby-col');
    const add = h('div', 'panel lobby-card add');
    add.appendChild(h('div', 'lbl', 'ADICIONAR AMIGO'));
    const addRow = h('div', 'add-row');
    this.addInput = h('input', 'lobby-input');
    this.addInput.placeholder = 'NICK#CÓDIGO';
    this.addInput.maxLength = 30;
    this.addInput.autocomplete = 'off';
    this.addInput.spellcheck = false;
    const addBtn = h('button', 'btn small', 'ADICIONAR');
    const doAdd = () => {
      const v = this.addInput.value.trim();
      if (!v) return;
      this.onAdd?.(v);
      this.addInput.value = '';
    };
    onTap(addBtn, doAdd);
    this.addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doAdd();
    });
    addRow.append(this.addInput, addBtn);
    add.appendChild(addRow);

    this.reqBox = h('div', 'panel lobby-card reqs');
    this.reqBox.appendChild(h('div', 'lbl', 'PEDIDOS DE AMIZADE'));
    this.reqList = h('div', 'friend-list');
    this.reqBox.appendChild(this.reqList);

    const fr = h('div', 'panel lobby-card friends');
    const fl = h('div', 'lbl', 'AMIGOS ');
    this.friendCount = h('span', 'count', '');
    fl.appendChild(this.friendCount);
    fr.appendChild(fl);
    this.friendList = h('div', 'friend-list');
    fr.appendChild(this.friendList);
    right.append(add, this.reqBox, fr);

    grid.append(left, right);
    this.status = h('div', 'lobby-status', '');
    this.root.append(top, this.status, grid);
    this.render();
  }

  open(): void {
    this.render();
    this.show();
  }

  setConnected(up: boolean): void {
    this.connected = up;
    this.render();
  }

  setState(s: SocialState): void {
    this.state = s;
    if (this.visible) this.render();
  }

  private copyId(): void {
    const s = this.state;
    if (!s) return;
    const text = `${s.me.nick}#${s.me.code}`;
    const done = () => {
      this.copyBtn.textContent = 'COPIADO!';
      setTimeout(() => (this.copyBtn.textContent = 'COPIAR MEU ID'), 1400);
    };
    navigator.clipboard?.writeText(text).then(done, () => {
      this.codeEl.textContent = text;
      done();
    });
  }

  render(): void {
    const s = this.state;
    this.status.textContent = this.connected ? '' : 'CONECTANDO AO SERVIDOR DE AMIGOS...';
    this.status.style.display = this.connected ? 'none' : '';
    if (!s) {
      this.playBtn.textContent = 'JOGAR ONLINE';
      this.leaveBtn.style.display = 'none';
      this.partyHint.textContent = 'Jogue sozinho ou chame amigos pro seu grupo.';
      this.reqBox.style.display = 'none';
      this.friendList.replaceChildren(h('div', 'empty', 'Seus amigos aparecem aqui.'));
      return;
    }
    if (document.activeElement !== this.nickInput) this.nickInput.value = s.me.nick;
    this.codeEl.textContent = `#${s.me.code}`;

    // group
    const members = s.party?.members ?? [{ code: s.me.code, nick: s.me.nick, leader: true }];
    this.partyList.replaceChildren(
      ...members.map((m) => {
        const row = h('div', `member${m.code === s.me.code ? ' me' : ''}`);
        row.append(h('span', 'crown', m.leader ? '♛' : '•'), h('span', 'nm', m.nick), h('span', 'tag', m.code === s.me.code ? 'VOCÊ' : `#${m.code}`));
        return row;
      }),
    );
    const leader = members.some((m) => m.leader && m.code === s.me.code);
    const group = members.length > 1;
    this.leaveBtn.style.display = s.party && group ? '' : 'none';
    this.playBtn.disabled = group && !leader;
    this.playBtn.textContent = group ? (leader ? `JOGAR EM GRUPO (${members.length})` : 'ESPERANDO O LÍDER...') : 'JOGAR ONLINE';
    this.partyHint.textContent = group
      ? leader
        ? 'Todo mundo do grupo entra na mesma sala quando você apertar JOGAR.'
        : 'O líder (♛) escolhe a hora. Você entra junto automaticamente.'
      : 'Convide amigos online pro seu grupo e entrem juntos na mesma sala.';

    // requests
    this.reqBox.style.display = s.requests.length ? '' : 'none';
    this.reqList.replaceChildren(
      ...s.requests.map((r) => {
        const row = h('div', 'friend');
        const who = h('div', 'who');
        who.append(h('span', 'nm', r.nick), h('span', 'tag', `#${r.code}`));
        const acts = h('div', 'acts');
        const yes = h('button', 'btn small', 'ACEITAR');
        onTap(yes, () => this.onAccept?.(r.code));
        const no = h('button', 'btn ghost small', 'RECUSAR');
        onTap(no, () => this.onDecline?.(r.code));
        acts.append(yes, no);
        row.append(h('span', 'dot on'), who, acts);
        return row;
      }),
    );

    // friends
    const online = s.friends.filter((f) => f.online).length;
    this.friendCount.textContent = s.friends.length ? `· ${online} ONLINE DE ${s.friends.length}` : '';
    this.friendList.replaceChildren(...(s.friends.length ? s.friends.map((f) => this.friendRow(f, leader || !group)) : [h('div', 'empty', 'Nenhum amigo ainda. Adicione alguém pelo NICK#CÓDIGO.')]));
  }

  private friendRow(f: FriendInfo, canInvite: boolean): HTMLDivElement {
    const row = h('div', `friend${f.online ? ' online' : ''}`);
    const who = h('div', 'who');
    who.append(h('span', 'nm', f.nick), h('span', 'tag', `#${f.code}`));
    who.appendChild(h('span', 'st', !f.online ? 'offline' : f.room ? 'jogando online' : f.party ? 'no seu grupo' : 'no menu'));
    const acts = h('div', 'acts');
    if (f.online && f.room) {
      const join = h('button', 'btn small', 'ENTRAR JUNTO');
      onTap(join, () => this.onJoin?.(f.code));
      acts.appendChild(join);
    } else if (f.online && !f.party && canInvite) {
      const inv = h('button', 'btn small', 'CONVIDAR');
      onTap(inv, () => {
        inv.textContent = 'ENVIADO';
        inv.disabled = true;
        this.onInvite?.(f.code);
      });
      acts.appendChild(inv);
    }
    const del = h('button', 'btn ghost small x', '✕');
    del.title = 'Remover amigo';
    let armed = false;
    onTap(del, () => {
      if (!armed) {
        armed = true;
        del.textContent = 'REMOVER?';
        setTimeout(() => {
          armed = false;
          del.textContent = '✕';
        }, 2500);
        return;
      }
      this.onRemove?.(f.code);
    });
    acts.appendChild(del);
    row.append(h('span', `dot${f.online ? ' on' : ''}${f.room ? ' play' : ''}`), who, acts);
    return row;
  }
}
