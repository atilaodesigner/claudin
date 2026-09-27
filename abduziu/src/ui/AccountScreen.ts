import { divisionFor } from '../progression/RankSystem';
import { friendlyError, type Online } from '../online/Online';
import { formatInt } from '../utils/math';
import { h, onTap, Screen } from './dom';

/** Login (Google or e-mail), nickname, cloud save status and LGPD controls. */
export class AccountScreen extends Screen {
  private readonly body: HTMLDivElement;
  private readonly msg: HTMLDivElement;
  private pendingEmail = '';
  private busy = false;
  private unsub: (() => void) | null = null;
  onClose: (() => void) | null = null;
  /** Last cloud sync, shown under the save row. */
  lastSync: number | null = null;

  constructor(parent: HTMLElement, private readonly online: Online) {
    super(parent, 'subscreen account');
    this.root.style.zIndex = '42';
    const top = h('div', 'topbar');
    const title = h('div', 'title-xl', 'CONTA');
    title.appendChild(h('small', '', 'RANKING ONLINE · SAVE NA NUVEM'));
    const back = h('button', 'btn ghost', 'VOLTAR');
    onTap(back, () => this.onClose?.());
    top.append(title, back);
    const content = h('div', 'content scroll');
    this.body = h('div', 'list acc');
    this.msg = h('div', 'acc-msg');
    content.append(this.body);
    this.root.append(top, content);
  }

  open(): void {
    this.unsub?.();
    this.unsub = this.online.subscribe(() => {
      if (this.visible && !this.busy) this.render();
    });
    this.setMsg('');
    this.render();
    this.show();
    if (this.online.enabled && this.online.status === 'idle') void this.online.init();
  }

  override hide(): void {
    this.unsub?.();
    this.unsub = null;
    super.hide();
  }

  private setMsg(text: string, tone: 'ok' | 'bad' | '' = ''): void {
    this.msg.textContent = text;
    this.msg.className = `acc-msg ${tone}`;
  }

  private async run(btn: HTMLButtonElement, fn: () => Promise<string | void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    btn.disabled = true;
    this.setMsg('Conectando...');
    try {
      const ok = await fn();
      this.setMsg(ok ?? '', ok ? 'ok' : '');
    } catch (err) {
      this.setMsg(friendlyError(err), 'bad');
    } finally {
      this.busy = false;
      btn.disabled = false;
      this.render();
    }
  }

  private render(): void {
    const o = this.online;
    const b = this.body;
    b.innerHTML = '';
    if (!o.enabled) {
      b.appendChild(this.card('LOGIN INDISPONÍVEL NESTA VERSÃO', 'Esta cópia do jogo roda só offline. Na versão publicada você entra com Google ou e-mail, aparece no ranking semanal e leva o progresso pra qualquer aparelho.'));
      return;
    }
    if (o.status === 'idle' || o.status === 'loading') {
      b.appendChild(this.card('CONECTANDO...', 'Procurando o sinal da nave-mãe.'));
      return;
    }
    if (o.status === 'unreachable') {
      const c = this.card('SEM SINAL', 'Não deu pra falar com o servidor agora. Seu progresso continua salvo neste aparelho.');
      const retry = h('button', 'btn ghost', 'TENTAR DE NOVO');
      onTap(retry, () => {
        o.status = 'idle';
        void o.init();
        this.render();
      });
      c.appendChild(retry);
      b.appendChild(c);
      return;
    }
    if (o.signedIn) this.renderSignedIn();
    else this.renderSignedOut();
    b.appendChild(this.msg);
  }

  private card(title: string, text: string): HTMLDivElement {
    const c = h('div', 'panel acc-card');
    c.appendChild(h('h3', '', title));
    if (text) c.appendChild(h('p', '', text));
    return c;
  }

  private input(type: string, placeholder: string, value = ''): HTMLInputElement {
    const i = h('input', 'acc-input');
    i.type = type;
    i.placeholder = placeholder;
    i.value = value;
    i.autocomplete = type === 'email' ? 'email' : 'off';
    i.spellcheck = false;
    for (const ev of ['pointerdown', 'keydown', 'keyup'] as const) i.addEventListener(ev, (e) => e.stopPropagation());
    return i;
  }

  private renderSignedOut(): void {
    const o = this.online;
    const c = this.card('ENTRE PRA COMPETIR', 'Com conta você aparece no ranking semanal, seu RP vale no mundo todo e o progresso fica salvo na nuvem.');
    const google = h('button', 'btn acc-google', 'ENTRAR COM GOOGLE');
    onTap(google, () => void this.run(google, async () => {
      await o.signInWithGoogle();
      return 'Abrindo o Google...';
    }));
    c.appendChild(google);
    c.appendChild(h('div', 'acc-or', 'OU COM E-MAIL'));
    const email = this.input('email', 'seu@email.com', this.pendingEmail);
    const send = h('button', 'btn ghost', this.pendingEmail ? 'REENVIAR' : 'RECEBER LINK DE ACESSO');
    onTap(send, () => void this.run(send, async () => {
      const v = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error('E-mail inválido');
      await o.sendEmailLink(v);
      this.pendingEmail = v;
      return `Link enviado pra ${v}. Abra neste mesmo aparelho (ou digite o código do e-mail).`;
    }));
    const row = h('div', 'acc-row');
    row.append(email, send);
    c.appendChild(row);
    if (this.pendingEmail) {
      const code = this.input('text', 'CÓDIGO DE 6 DÍGITOS');
      code.inputMode = 'numeric';
      code.maxLength = 6;
      const ok = h('button', 'btn', 'CONFIRMAR');
      onTap(ok, () => void this.run(ok, async () => {
        const v = code.value.replace(/\D/g, '');
        if (v.length !== 6) throw new Error('Token has expired or is invalid');
        await o.verifyEmailCode(this.pendingEmail, v);
        this.pendingEmail = '';
        return 'Bem-vindo a bordo!';
      }));
      const r2 = h('div', 'acc-row');
      r2.append(code, ok);
      c.appendChild(r2);
    }
    c.appendChild(h('p', 'fine', 'Guardamos só o necessário pro jogo: e-mail de login, apelido, RP, partidas ranqueadas e seu save. Dá pra apagar tudo quando quiser.'));
    this.body.appendChild(c);
  }

  private renderSignedIn(): void {
    const o = this.online;
    const p = o.profile;
    const st = divisionFor(p?.rp ?? 0);
    const who = h('div', 'panel acc-card acc-who');
    who.style.setProperty('--div', st.division.color);
    who.appendChild(h('div', 'emblem', st.division.name.slice(0, 1)));
    const info = h('div', 'info');
    info.appendChild(h('div', 'label', o.email ?? 'CONTA CONECTADA'));
    info.appendChild(h('h2', '', p?.nickname ?? '...'));
    info.appendChild(h('div', 'rp', `${st.division.name} · ${formatInt(p?.rp ?? 0)} RP · ${formatInt(p?.games ?? 0)} RANQUEADAS`));
    who.appendChild(info);
    this.body.appendChild(who);

    const nick = this.card(o.needsNickname ? 'ESCOLHA SEU APELIDO' : 'APELIDO', o.needsNickname ? 'É assim que você aparece no ranking.' : '');
    const inp = this.input('text', 'APELIDO', o.needsNickname ? '' : (p?.nickname ?? ''));
    inp.maxLength = 16;
    const save = h('button', 'btn', 'SALVAR');
    onTap(save, () => void this.run(save, async () => {
      const v = inp.value.trim();
      if (!/^[A-Za-z0-9_.-]{3,16}$/.test(v)) throw new Error('bad_nickname');
      await o.setNickname(v);
      return 'Apelido salvo!';
    }));
    const row = h('div', 'acc-row');
    row.append(inp, save);
    nick.appendChild(row);
    this.body.appendChild(nick);

    const cloud = this.card('SAVE NA NUVEM', this.lastSync ? `Sincronizado ${this.ago(this.lastSync)}. Entre com a mesma conta em outro aparelho e continue de onde parou.` : 'Sincronizando seu progresso...');
    this.body.appendChild(cloud);

    const out = h('button', 'btn ghost', 'SAIR DA CONTA');
    onTap(out, () => void this.run(out, async () => {
      await o.signOut();
      return 'Você saiu. O progresso continua neste aparelho.';
    }));
    const del = h('button', 'btn danger', 'APAGAR CONTA E DADOS ONLINE');
    let armed = false;
    onTap(del, () => {
      if (!armed) {
        armed = true;
        del.textContent = 'TOQUE DE NOVO PRA CONFIRMAR';
        return;
      }
      void this.run(del, async () => {
        await o.deleteAccount();
        return 'Conta e dados online apagados.';
      });
    });
    const actions = h('div', 'acc-actions');
    actions.append(out, del);
    this.body.appendChild(actions);
  }

  private ago(t: number): string {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 10) return 'agora';
    if (s < 60) return `há ${s}s`;
    return `há ${Math.round(s / 60)} min`;
  }
}
