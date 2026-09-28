import { IntroSequence } from './intro/IntroSequence';

const introCanvas = document.getElementById('intro') as HTMLCanvasElement;
const gameCanvas = document.getElementById('game') as HTMLCanvasElement;
const title = document.getElementById('title') as HTMLElement;
const params = new URLSearchParams(location.search);

// The game (Three.js + the physics WASM) loads in its own chunk while the intro plays.
const game = import('./app/App').then(async (m) => {
  const { initPhysics } = await import('@ginga/shared');
  await initPhysics();
  return m.App;
});
let started = false;
let titled = false;

const intro = new IntroSequence(introCanvas, {
  skipStudio: params.get('intro') === '0' || params.has('sala'),
  onTitle: () => {
    titled = true;
    title.hidden = false;
  },
});
intro.start();

async function enter(): Promise<void> {
  if (!titled || started) return;
  started = true;
  removeEventListener('keydown', onKey);
  introCanvas.removeEventListener('pointerup', enterFromPointer);
  title.querySelector('.press')!.textContent = 'Carregando…';
  let App: Awaited<typeof game>;
  try {
    App = await game;
  } catch (e) {
    title.querySelector('.press')!.textContent = 'Não deu pra carregar o jogo. Recarregue a página.';
    throw e;
  }
  title.hidden = true;
  intro.stop();
  introCanvas.hidden = true;
  const app = new App(gameCanvas);
  await app.start();
}

const onKey = (e: KeyboardEvent): void => {
  if (e.code === 'F3' || e.code === 'Tab') return;
  void enter();
};
const enterFromPointer = (): void => void enter();
addEventListener('keydown', onKey);
introCanvas.addEventListener('pointerup', enterFromPointer);
