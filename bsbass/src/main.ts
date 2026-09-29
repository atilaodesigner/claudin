import '@fontsource/anton';
import '@fontsource/permanent-marker';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/700.css';
import './style.css';
import { Game } from './game';
import { loadAssets } from './assets';

async function boot(): Promise<void> {
  // as texturas procedurais usam as fontes: espera carregar antes de gerar
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px Anton'), document.fonts.load('40px "Permanent Marker"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* segue com a fonte de fallback */
  }
  const loading = document.getElementById('loading');
  const assets = await loadAssets((done, total) => {
    if (loading) loading.textContent = `CARREGANDO A QUEBRADA... ${Math.round((done / total) * 100)}%`;
  });
  const game = new Game(document.getElementById('stage')!, document.getElementById('ui')!, assets);
  // ?manual: o loop não roda sozinho (usado pelos testes de screenshot)
  if (!new URLSearchParams(location.search).has('manual')) game.start();
  else game.frame(1 / 60);
  (window as unknown as { __game: Game }).__game = game;
  document.getElementById('loading')?.remove();
}

void boot();
