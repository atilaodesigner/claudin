import '@fontsource/anton';
import '@fontsource/permanent-marker';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/700.css';
import './style.css';
import { Game } from './game';
import { loadAssets } from './assets';
import { Intro } from './ui/intro';

async function boot(): Promise<void> {
  const manual = new URLSearchParams(location.search).has('manual');
  // ?manual (testes de screenshot): sem abertura, o loop não roda sozinho
  const intro = manual ? null : new Intro();
  document.getElementById('loading')?.remove();

  // as texturas procedurais usam as fontes: espera carregar antes de gerar
  const fonts = Promise.race([
    Promise.all([document.fonts.load('40px Anton'), document.fonts.load('40px "Permanent Marker"'), document.fonts.load('500 40px "Chakra Petch"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => undefined);
  const assetsP = fonts.then(() =>
    loadAssets((done, total) => intro?.setProgress((done / total) * 0.75, `CARREGANDO A QUEBRADA ${Math.round((done / total) * 75)}%`)),
  );

  // música de abertura (já cortada 2 s pra entrar no ponto): toca nas logos, no menu
// e segue na partida até acabar; depois (ou se o jogador trocar a rádio) entra a rádio
  const theme = intro ? makeTheme() : null;
  if (intro && theme) {
    await fonts;
    // celular em pé: pede pra deitar antes da abertura
    await intro.rotate();
    const ok = await theme.play().then(() => true, () => false);
    if (!ok) {
      // navegador bloqueou som sem interação: começa no primeiro toque/tecla (sem tela pedindo)
      const unlock = () => {
        if (!theme.paused || theme.ended || theme.dataset.skipped) return;
        theme.play().then(
          () => ['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.removeEventListener(ev, unlock, true)),
          () => undefined,
        );
      };
      ['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, unlock, true));
    }
    await intro.gueto();
    intro.startVideo();
  }
  const assets = await assetsP;
  intro?.setProgress(0.8, 'MONTANDO A CIDADE 80%');
  // deixa o vídeo pegar embalo antes do trabalho pesado
  await new Promise((r) => setTimeout(r, intro ? 250 : 0));
  const game = new Game(document.getElementById('stage')!, document.getElementById('ui')!, assets);
  if (theme) game.setTheme(theme);
  (window as unknown as { __game: Game }).__game = game;
  if (manual) {
    game.frame(1 / 60);
    return;
  }
  intro!.setProgress(0.9, 'AQUECENDO OS SHADERS 90%');
  await game.warmup();
  intro!.setReady();
  await intro!.videoDone();
  await intro!.finish();
  // o loop só começa depois do fade (o menu já foi desenhado no warmup)
  game.start();
}

function makeTheme(): HTMLAudioElement {
  const a = new Audio('./intro/tema.mp3');
  a.preload = 'auto';
  a.loop = false; // toca uma vez, até o fim (ou até o jogador pular pra rádio)
  let vol = 0.7;
  try {
    vol = JSON.parse(localStorage.getItem('bsbass-drift-save-v1') || '{}')?.vol?.music ?? 0.7;
  } catch {
    /* sem storage */
  }
  a.volume = Math.min(1, Math.max(0, vol));
  return a;
}

void boot();
