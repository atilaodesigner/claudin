import './styles/base.css';
import './styles/ui.css';
import { Game } from './core/Game';

function showFatal(message: string): void {
  const el = document.createElement('div');
  el.className = 'fatal';
  el.innerHTML = `<h1>ABDUZIU</h1><p>${message}</p><p class="small">Tente atualizar a página ou usar um navegador com WebGL 2.</p>`;
  document.body.appendChild(el);
}

function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  if (!hasWebGL2()) {
    showFatal('Seu dispositivo não suporta WebGL 2.');
    return;
  }
  const game = new Game(document.getElementById('app') as HTMLElement);
  (window as unknown as { __game: Game }).__game = game;
  await game.init();
}

boot().catch((err: unknown) => {
  console.error(err);
  showFatal('Falha ao iniciar o jogo.');
});

// embedded copies (iframes) don't get offline mode
if ('serviceWorker' in navigator && import.meta.env.PROD && window.self === window.top) {
  window.addEventListener('load', () => {
    // sandboxed frames (embeds, previews) throw on access instead of rejecting
    try {
      navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    } catch {
      /* offline mode unavailable here */
    }
  });
}
