// Einstieg: Canvas, Loop, Verdrahtung von Eingabe, HUD und Service Worker.
import { C } from './constants.js';
import * as G from './game.js';
import { createInput } from './input.js';
import { createRenderer, resize, draw } from './render.js';
import { createHud } from './hud.js';
import { loadTune } from './tune.js';
import { createSound } from './audio.js';
import { createBoard } from './board.js';

loadTune();
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const canvas = document.getElementById('game');
const R = createRenderer(canvas);
const game = G.createGame({
  fixedSeed: seedParam != null ? parseInt(seedParam, 10) >>> 0 : null,
  debug: params.get('debug') === '1',
});
const snd = createSound(game);
game.onEvent = snd.event;
// Bestenliste (board.js): ?board=local nutzt den Mock des Dev-Servers (node tools/serve.js 8082 --board), ?board=<URL>
// eine andere Datenbank, sonst BOARD_URL aus constants.js. Leer = aus.
const boardParam = params.get('board');
const board = createBoard({ url: boardParam === 'local' ? location.origin : boardParam || C.BOARD_URL, g: game, debug: game.debug });

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
  if (G.freshReady(game) && applyUpdate()) return;
  G.fresh(game);
}
const input = createInput(canvas, {
  press: (side) => G.onPress(game, side),
  release: () => G.onRelease(game),
  plow: (on) => G.onPlow(game, on),
  pause: () => { if (G.togglePause(game)) input.cancelAll(); },
  fresh: freshOrUpdate,
});
const hud = createHud(game, document, { fresh: freshOrUpdate, onTune: onResize, sound: snd, board });

// Debug-Haken (?debug=1): Simulation gezielt vorspulen, z. B. powder.advance(2) in der Konsole.
if (game.debug) {
  window.powder = {
    game, R, C, G, snd, board,
    advance(sec) {
      const n = Math.round(sec / C.STEP);
      for (let i = 0; i < n; i++) G.update(game, C.STEP);
      snd.update(game, C.STEP);
      draw(R, game, performance.now() / 1000);
      hud.sync(performance.now(), R, true);
    },
  };
}

// Bildtakt: die Zeitstempel sind je nach Browser nur millisekundengenau und flackern leicht. Deshalb wird das
// Bildintervall geschätzt (Median der ersten Bilder, dann gleitend nachgeführt) und jede Bildzeit auf ganze
// Intervalle gerundet: ein Bild ist genau ein Takt, ein Aussetzer genau zwei. Passt nichts, gilt der Rohwert.
const pace = { est: 0, boot: [], low: 0 };
function pacedDt(raw) {
  if (!(raw > 1) || raw > 250) return raw;              // unplausibel (Tab war weg o. ä.): weder lernen noch runden
  if (!pace.est) {
    if (raw >= 3) pace.boot.push(raw);
    if (pace.boot.length < 30) return raw;
    pace.est = pace.boot.sort((a, b) => a - b)[15];
  }
  const est = pace.est;
  const k = Math.round(raw / est);
  if (k >= 1 && Math.abs(raw - k * est) <= est * 0.25) {
    pace.est = est + (raw / k - est) * 0.02; // träge nachführen, damit der Jitter nicht in den Takt durchschlägt
    pace.low = 0;
    return k * pace.est;
  }
  // Deutlich kürzere Bilder in Folge: das Display läuft schneller als angelernt (z. B. 120 Hz), neu anlernen
  if (raw < est * 0.75) { if (++pace.low >= 10) { pace.est = raw; pace.low = 0; } } else pace.low = 0;
  return raw;
}

// Loop: die Simulation läuft in Teilschritten von höchstens STEP genau bis zur Zeit des Bildes, damit jedes Bild
// exakt seinen Zeitpunkt zeigt. Ein fester Takt mit Restzeit-Akkumulator liefert je nach Bild mal 1, mal 2,
// mal 3 Schritte, bei Tempo sind das sichtbar ungleiche Sprünge.
let last = 0;
function frame(now) {
  const raw = last ? now - last : 1000 / 60;
  last = now;
  let dtMs = pacedDt(raw);
  if (dtMs > C.MAX_FRAME_MS) dtMs = C.MAX_FRAME_MS;
  R.frameMs = R.frameMs * 0.95 + Math.min(raw, C.MAX_FRAME_MS) * 0.05;
  R.paceMs = pace.est;
  const dt = dtMs / 1000;
  const n = Math.max(1, Math.min(C.MAX_STEPS, Math.ceil(dt / C.STEP - 0.05)));
  const h = dt / n;
  for (let i = 0; i < n; i++) G.update(game, h);
  snd.update(game, dt);
  draw(R, game, now / 1000);
  hud.sync(now, R);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// App in den Hintergrund → Pause, kein Nachholen beim Zurückkommen.
function autoPause() {
  G.pauseIfRunning(game);
  input.cancelAll();
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
    if (game.state === 'ready' || game.state === 'paused' || game.state === 'count') applyUpdate();
  });
}
