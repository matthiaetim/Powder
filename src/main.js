// Einstieg: Canvas, Loop, Verdrahtung von Eingabe, HUD und Service Worker.
import { C } from './constants.js';
import * as G from './game.js';
import { createInput } from './input.js';
import { createRenderer, resize, draw } from './render.js';
import { createHud } from './hud.js';
import { loadTune } from './tune.js';

loadTune();
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const canvas = document.getElementById('game');
const R = createRenderer(canvas);
const game = G.createGame({
  fixedSeed: seedParam != null ? parseInt(seedParam, 10) >>> 0 : null,
  debug: params.get('debug') === '1',
});

function onResize() {
  resize(R);
  game.viewWm = R.W / R.S;
  game.viewHm = R.H / R.S;
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
onResize();

// Neue Version im Hintergrund installiert: beim nächsten Fresh (oder sofort, wenn kein Run läuft) neu laden
let updateReady = false;
function applyUpdate() {
  if (!updateReady) return false;
  updateReady = false;
  location.reload();
  return true;
}
function freshOrUpdate() {
  const overlayDone = game.state === 'dead' && game.deadT * 1000 >= C.DEATH_OVERLAY_MS + C.FRESH_GUARD_MS;
  if (overlayDone && applyUpdate()) return;
  G.fresh(game);
}
const input = createInput(canvas, {
  press: (side) => G.onPress(game, side),
  release: () => G.onRelease(game),
  plow: (on) => G.onPlow(game, on),
  pause: () => { if (G.togglePause(game)) input.cancelAll(); },
  fresh: freshOrUpdate,
});
const hud = createHud(game, document, { fresh: freshOrUpdate, onTune: onResize });

// Debug-Haken (?debug=1): Simulation gezielt vorspulen, z. B. powder.advance(2) in der Konsole.
if (game.debug) {
  window.powder = {
    game, R, C, G,
    advance(sec) {
      const n = Math.round(sec / C.STEP);
      for (let i = 0; i < n; i++) G.update(game, C.STEP);
      draw(R, game, performance.now() / 1000);
      hud.sync(performance.now(), R, true);
    },
  };
}

let last = performance.now();
let acc = 0;
function frame(now) {
  let dtMs = now - last;
  last = now;
  if (dtMs > C.MAX_FRAME_MS) dtMs = C.MAX_FRAME_MS;
  R.frameMs = R.frameMs * 0.95 + dtMs * 0.05;
  acc += dtMs / 1000;
  let steps = 0;
  while (acc >= C.STEP && steps < C.MAX_STEPS) {
    G.update(game, C.STEP);
    acc -= C.STEP;
    steps++;
  }
  if (steps === C.MAX_STEPS) acc = 0;
  draw(R, game, now / 1000);
  hud.sync(now, R);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// App in den Hintergrund → Pause, kein Nachholen beim Zurückkommen.
function autoPause() {
  G.pauseIfRunning(game);
  input.cancelAll();
  acc = 0;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('pagehide', autoPause);
window.addEventListener('blur', autoPause);

// Service Worker nur unter HTTPS (GitHub Pages). Lokal bleibt alles ungecacht.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); });
  }).catch(() => { /* offline oder blockiert */ });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return; // Erstinstallation: Seite ist schon aktuell
    updateReady = true;
    document.getElementById('version').classList.add('update');
    if (game.state === 'ready' || game.state === 'paused') applyUpdate();
  });
}
