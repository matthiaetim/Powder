// Einstieg: Canvas, Loop, Verdrahtung von Eingabe, HUD und Service Worker.
import { C } from './constants.js';
import * as G from './game.js';
import { createInput } from './input.js';
import { createRenderer, resize, draw } from './render.js';
import { createHud } from './hud.js';
import { loadTune } from './tune.js';
import { createSound } from './audio.js';
import { createNet } from './net.js';
import { createBoard } from './board.js';
import { createDuel } from './duel.js';
import { validCode } from './room.js';

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
// Bestenliste (board.js) und Duell-Räume (room.js, duel.js) teilen sich die Datenbank: ?board=local nutzt die Mocks des
// Dev-Servers (node tools/serve.js 8082 --board), ?board=<URL> eine andere Datenbank, sonst BOARD_URL aus constants.js.
// Leer = aus. ?room=CODE öffnet nach dem Start direkt die Lobby dieses Raums (Einladungslink).
const boardParam = params.get('board');
const dbUrl = boardParam === 'local' ? location.origin : boardParam || C.BOARD_URL;
const net = createNet(dbUrl, { EventSourceImpl: window.EventSource });
const board = createBoard({ url: dbUrl, g: game, debug: game.debug, net });
const duel = createDuel({ g: game, net, board, onTune: () => onResize(), debug: game.debug });
game.onEvent = (type, data) => { snd.event(type, data); duel.event(type, data); };
const roomParam = validCode(params.get('room'));

let needDraw = true; // nächstes Bild auf jeden Fall zeichnen (Start, Größenänderung, Regler, Zustandswechsel)
function onResize() {
  resize(R);
  game.viewWm = R.W / R.S;
  game.viewHm = R.H / R.S;
  needDraw = true;
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
  // Duell: Fresh-Knopf und Tasten öffnen die Lobby, den Lauf startet der gemeinsame Countdown
  if (duel.active() || game.mode === 'duel') { hud.openDuel(); return; }
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
const hud = createHud(game, document, { fresh: freshOrUpdate, onTune: onResize, sound: snd, board, duel, net });
if (roomParam) hud.openDuel(roomParam);

// Debug-Haken (?debug=1): Simulation gezielt vorspulen, z. B. powder.advance(2) in der Konsole.
if (game.debug) {
  window.powder = {
    game, R, C, G, snd, board, duel, net,
    advance(sec) {
      const n = Math.round(sec / C.STEP);
      duel.beforeFrame();
      for (let i = 0; i < n; i++) G.update(game, C.STEP, (n - 1 - i) * C.STEP);
      snd.update(game, C.STEP);
      draw(R, game, performance.now() / 1000);
      hud.sync(performance.now(), R, true);
      duel.afterFrame();
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
// Leerlauf: steht das Bild (Fresh-Seite, Pause, Intro), wird nur noch mit IDLE_FPS gezeichnet; Simulation, Ton und
// HUD laufen weiter. Ein Zustandswechsel oder eine Größenänderung erzwingt das nächste Bild, sonst stünde nach Fresh
// bis zu 100 ms lang die alte Szene.
// Messung (nur ?debug=1): Zeit je Phase (Rechnen, Zeichnen, HUD) als Mittel und Maximum je Sekunde, dazu fps und
// der Anteil ausgelassener Bilder; hud.js zeigt R.prof im Overlay.
let last = 0, lastDraw = -1e9, lastDrawState = '';
const prof = game.debug ? { t0: 0, n: 0, drawn: 0, upd: 0, updMax: 0, draw: 0, drawMax: 0, hud: 0, hudMax: 0 } : null;
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
  const t0 = prof ? performance.now() : 0;
  duel.beforeFrame();
  for (let i = 0; i < n; i++) G.update(game, h, (n - 1 - i) * h); // Restzeit des Bildes fürs Duell (Zielzeit)
  snd.update(game, dt);
  const t1 = prof ? performance.now() : 0;
  const live = G.animating(game) || needDraw || game.state !== lastDrawState || now - lastDraw >= 1000 / C.IDLE_FPS;
  if (live) {
    draw(R, game, now / 1000);
    lastDraw = now;
    lastDrawState = game.state;
    needDraw = false;
  }
  const t2 = prof ? performance.now() : 0;
  hud.sync(now, R);
  if (prof) {
    const t3 = performance.now();
    const u = t1 - t0, d = t2 - t1, hd = t3 - t2;
    prof.n++;
    prof.upd += u; if (u > prof.updMax) prof.updMax = u;
    if (live) { prof.drawn++; prof.draw += d; if (d > prof.drawMax) prof.drawMax = d; }
    prof.hud += hd; if (hd > prof.hudMax) prof.hudMax = hd;
    if (!prof.t0) prof.t0 = now;
    else if (now - prof.t0 >= 1000) {
      R.prof = {
        fps: (prof.n * 1000) / (now - prof.t0), idle: 1 - prof.drawn / prof.n,
        upd: prof.upd / prof.n, updMax: prof.updMax,
        draw: prof.drawn ? prof.draw / prof.drawn : 0, drawMax: prof.drawMax,
        hud: prof.hud / prof.n, hudMax: prof.hudMax,
      };
      prof.t0 = now; prof.n = prof.drawn = 0;
      prof.upd = prof.updMax = prof.draw = prof.drawMax = prof.hud = prof.hudMax = 0;
    }
  }
  duel.afterFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// App in den Hintergrund → Pause, kein Nachholen beim Zurückkommen.
function autoPause() {
  G.pauseIfRunning(game);
  input.cancelAll();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); else duel.resume(); }); // zurück: Stream des Duells neu
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
    // nicht mitten in einem Duell: die Lobby oder der Countdown wäre weg
    if (!duel.active() && (game.state === 'ready' || game.state === 'paused' || game.state === 'count')) applyUpdate();
  });
}
