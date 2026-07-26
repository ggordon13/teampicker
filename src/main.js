import './styles.css';
import { store } from './state.js';
import { getSport } from './sports.js';
import { Background } from './three/background.js';
import { enterScreen } from './anim.js';
import { $, clear } from './dom.js';

import setupScreen from './screens/setup.js';
import rosterScreen from './screens/roster.js';
import matchScreen from './screens/match.js';
import standingsScreen from './screens/standings.js';

const SCREENS = {
  setup: setupScreen,
  roster: rosterScreen,
  match: matchScreen,
  standings: standingsScreen,
};

const app = $('#app');
const bg = new Background($('#bg'));

const ctx = {
  store,
  bg,
  /** Push a sport's palette into both the CSS layer and the 3D scene. */
  applySport(id) {
    const sport = getSport(id);
    const root = document.documentElement;
    root.style.setProperty('--accent', sport.accent);
    root.style.setProperty('--accent-2', sport.accent2);
    root.style.setProperty('--ball', sport.ball);
    root.style.setProperty('--court', sport.court);
    root.style.setProperty('--bg', sport.bg);
    root.dataset.sport = sport.id;
    bg.setSport(sport);
  },
};

function render() {
  const screen = SCREENS[store.state.screen] || setupScreen;
  clear(app);
  const node = screen(ctx);
  app.appendChild(node);
  enterScreen(node);
  window.scrollTo(0, 0);
}

ctx.applySport(store.state.sport);
store.subscribe(render);
render();

// Handy while running a real session: keyboard shortcuts for the two winners.
window.addEventListener('keydown', (e) => {
  if (store.state.screen !== 'match' || e.target.matches('input, select, textarea')) return;
  if (e.key === 'a' || e.key === 'A') $('.side-a .btn-win')?.click();
  if (e.key === 'b' || e.key === 'B') $('.side-b .btn-win')?.click();
});
