import { IntroSequence } from './intro/IntroSequence';

const canvas = document.getElementById('intro') as HTMLCanvasElement;
const title = document.getElementById('title') as HTMLElement;
const params = new URLSearchParams(location.search);

const intro = new IntroSequence(canvas, {
  skipStudio: params.get('intro') === '0',
  onTitle: () => {
    // Title screen placeholder: the Início menu (PLANO.md §5.2) plugs in here.
    title.hidden = false;
  },
});
intro.start();
