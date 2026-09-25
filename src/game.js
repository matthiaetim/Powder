// Spielzustand und Ablauf: ready → running → dead → (Fresh) → ready. Pause jederzeit.
import { C } from './constants.js';
import * as P from './physics.js';
import { createWorld, ensureCells } from './world.js';
import { createAvalanche, updateAvalanche } from './avalanche.js';
import { checkCollision } from './collision.js';
import { createTrack, clearTrack, pushTrack } from './track.js';
import { createParticles, clearParticles, spawnParticle, updateParticles } from './particles.js';
import { loadBest, saveBest, loadMode, saveMode } from './storage.js';
import { MODES, DEFAULT_MODE } from './modes.js';

const READY_FRAC = 0.78; // Fahrer steht im Intro weit unten im Bild

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

export function createGame(opts = {}) {
  const g = {
    state: 'ready',
    skier: P.createSkier(), world: null, av: null,
    track: createTrack(), particles: createParticles(),
    dist: 0, runT: 0, best: 0, newBest: false,
    runBest: 0, // Bestwert beim Start des Laufs: dort steht die Rekordlinie, auch wenn best beim Aufprall schon steigt
    seed: 0, fixedSeed: opts.fixedSeed ?? null,
    mode: DEFAULT_MODE, runMode: DEFAULT_MODE, intro: true, readyDelayMs: C.READY_AUTO_START_MS,
    readyT: 0, deadT: 0, deadCause: '',
    crashV: 0, crashX: 0, crashY: 0, crashPush: 0, // Tempo, Hindernis und Schub beim Aufprall (für die Splitter)
    // fogT: -1, // < 0 = kein Nebel; sonst verstrichene Zeit seit dem Hockeystop (render.js) — deaktiviert
    camX: 0, skierFrac: READY_FRAC, zoom: 1,
    viewWm: C.VIEW_W_M, viewHm: C.VIEW_W_M * C.VIEW_ASPECT,
    debug: !!opts.debug, lastGesture: '–', runs: 0,
    trackAcc: 0, spawnAcc: 0, plowAcc: 0,
    onEvent: null, // Haken für den Ton (main.js): press, release, plow, crash
  };
  const saved = loadMode();
  if (MODES[saved] && !MODES[saved].soon) g.mode = saved;
  g.best = loadBest(g.mode);
  reset(g, g.fixedSeed ?? randomSeed(), true);
  return g;
}

export function hasAvalanche(g) {
  return g.mode === 'chase';
}

function emit(g, type, data) {
  if (g.onEvent) g.onEvent(type, data);
}

// intro = true: Kamerafahrt von unten (nur beim App-Start). Sonst direkt beim Fahrer.
export function reset(g, seed, intro) {
  g.seed = seed;
  g.skier = P.createSkier();
  g.world = createWorld(seed);
  g.av = createAvalanche(0);
  clearTrack(g.track);
  clearParticles(g.particles);
  g.dist = 0; g.runT = 0; g.newBest = false;
  g.runBest = g.best;
  g.readyT = 0; g.deadT = 0; g.deadCause = '';
  // g.fogT = -1; // Hockeystop deaktiviert
  g.camX = 0; g.zoom = 1;
  g.intro = !!intro;
  g.skierFrac = intro ? READY_FRAC : C.SKIER_SCREEN_Y_FRAC;
  g.readyDelayMs = intro ? C.READY_AUTO_START_MS : C.FRESH_START_MS;
  g.trackAcc = 0; g.spawnAcc = 0;
  g.state = 'ready';
  ensureView(g);
}

function ensureView(g) {
  const s = g.skier;
  const halfW = (g.viewWm * g.zoom) / 2;
  const vh = g.viewHm * g.zoom;
  ensureCells(g.world, g.camX - halfW, g.camX + halfW, s.y - g.skierFrac * vh, s.y + (1 - g.skierFrac) * vh);
}

// Abstand vom Fahrer zum oberen Bildrand in m (dort erscheint die Lawine).
export function topDist(g) {
  return g.skierFrac * g.viewHm * g.zoom;
}

// 0..1: wie viel Vorausschau das Tempo verlangt (Fahrer weiter oben, Sicht herausgezoomt).
function lookahead(v) {
  const t = Math.min(1, Math.max(0, v / (C.CAM_SPEED_REF_KMH / 3.6)));
  return t * t * (3 - 2 * t);
}

export function update(g, dt) {
  switch (g.state) {
    case 'ready':
      g.readyT += dt;
      if (g.readyT * 1000 >= g.readyDelayMs) start(g);
      break;
    case 'running':
      step(g, dt);
      break;
    case 'dead':
      g.deadT += dt;
      if (g.deadCause === 'avalanche') updateAvalanche(g.av, g.skier, g.runT, dt, topDist(g)); // rollt über den Fahrer
      updateParticles(g.particles, dt);
      break;
    default:
      break;
  }
}

function start(g) {
  if (g.state !== 'ready') return;
  g.state = 'running';
  g.runMode = g.mode;
  g.best = loadBest(g.mode);
  g.runBest = g.best;
  g.skier.v = C.START_SPEED_KMH / 3.6;
  g.runs++;
}

function step(g, dt) {
  const s = g.skier;
  g.runT += dt;
  // Hockeystop deaktiviert (Tim und Jürgen wollen ihn nicht) — auskommentiert statt gelöscht.
  // const wasHockey = s.hockeyT >= 0;
  P.updateSkier(s, dt);
  // if (!wasHockey && s.hockeyT >= 0) hockeyStop(g);
  // if (g.fogT >= 0) {
  //   g.fogT += dt;
  //   if (g.fogT >= C.HOCKEY_FOG_IN_S + C.HOCKEY_FOG_HOLD_S + C.HOCKEY_FOG_OUT_S) g.fogT = -1;
  // }
  if (s.y - s.y0 > g.dist) g.dist = s.y - s.y0;
  // Kamera: x folgt weich; bei Tempo rückt der Fahrer nach oben und die Sicht zoomt heraus
  const k = lookahead(s.v);
  const fracTarget = C.SKIER_SCREEN_Y_FRAC + (C.CAM_Y_FRAC_FAST - C.SKIER_SCREEN_Y_FRAC) * k;
  const zoomTarget = 1 + (C.CAM_ZOOM_FAST - 1) * k;
  const ease = 1 - Math.exp(-dt / C.CAM_ZOOM_EASE_S);
  g.camX += (s.x - g.camX) * (1 - Math.exp(-dt / C.CAM_X_EASE_S));
  g.skierFrac += (fracTarget - g.skierFrac) * ease;
  g.zoom += (zoomTarget - g.zoom) * ease;
  ensureView(g);

  // Spur: alle 0,4 m ein Punkt, Breite nach Carve, Abstand nach Pflugstellung
  g.trackAcc += s.v * dt;
  if (g.trackAcc >= C.TRACK_SPACING_M) {
    g.trackAcc = 0;
    pushTrack(g.track, s.x, s.y, Math.cos(s.theta), -Math.sin(s.theta), s.carve, s.plowK);
  }

  spawnSpray(g, dt);
  updateParticles(g.particles, dt);

  const hit = checkCollision(g.world, s);
  if (hit) { die(g, hit.t === P.TREE ? 'tree' : 'rock', hit); return; }
  if (hasAvalanche(g) && updateAvalanche(g.av, s, g.runT, dt, topDist(g))) die(g, 'avalanche');
}

function die(g, cause, hit) {
  const s = g.skier;
  g.state = 'dead';
  g.deadT = 0;
  g.deadCause = cause;
  g.crashV = s.v;
  // Lawine: sie trifft von oben, die Splitter fliegen mit ihrem Tempo hangabwärts
  g.crashX = hit ? hit.x : s.x;
  g.crashY = hit ? hit.y : s.y - 1.5;
  g.crashPush = hit ? 0 : g.av.speed * 0.5;
  emit(g, 'crash', { cause, v: g.crashV });
  s.alive = false;
  s.side = 0;
  s.plow = false;
  burst(g, 24, 4);
  s.v = 0;
  const m = Math.floor(g.dist);
  if (m > g.best) { g.best = m; g.newBest = true; saveBest(g.runMode, m); }
}

function spawnSpray(g, dt) {
  const s = g.skier;
  if (s.v < 2) return;
  const rate = (15 + 220 * s.carve) * Math.min(1.5, s.v / 20);
  g.spawnAcc += rate * dt;
  const dx = Math.sin(s.theta), dy = Math.cos(s.theta); // Fahrtrichtung
  const outSign = s.theta > 0 ? 1 : -1;                    // Außenseite der Kurve
  const ox = -dy * outSign, oy = dx * outSign;
  while (g.spawnAcc >= 1) {
    g.spawnAcc -= 1;
    const side = Math.random() < 0.5 ? -0.16 : 0.16;
    const px = s.x - dx * 0.8 + dy * side;
    const py = s.y - dy * 0.8 - dx * side;
    const spread = 1.5 + 9 * s.carve;
    const k = 0.5 + Math.random();
    const vx = -dx * (0.15 * s.v) + ox * spread * k + (Math.random() - 0.5) * 2;
    const vy = -dy * (0.15 * s.v) + oy * spread * k + (Math.random() - 0.5) * 2;
    spawnParticle(g.particles, px, py, vx, vy, 0.3 + Math.random() * 0.3, 1 + Math.random() * 1.5, Math.random() < 0.6 ? 1 : 0);
  }
  // Schneepflug: an beiden gespreizten Ski-Enden spritzt Schnee nach außen
  if (s.plowK > 0.05) {
    g.plowAcc += 200 * s.plowK * Math.min(1.5, s.v / 20) * dt;
    const spread = 0.16 + C.PLOW_SPREAD_M * s.plowK;
    while (g.plowAcc >= 1) {
      g.plowAcc -= 1;
      const sgn = Math.random() < 0.5 ? -1 : 1;
      const lx = dy * sgn, ly = -dx * sgn; // seitlich nach außen, Seite sgn
      const px = s.x - dx * 0.7 + lx * spread;
      const py = s.y - dy * 0.7 + ly * spread;
      const out = (2 + 4 * s.plowK) * (0.5 + Math.random());
      const vx = -dx * (0.12 * s.v) + lx * out + (Math.random() - 0.5) * 2;
      const vy = -dy * (0.12 * s.v) + ly * out + (Math.random() - 0.5) * 2;
      spawnParticle(g.particles, px, py, vx, vy, 0.3 + Math.random() * 0.3, 1 + Math.random() * 1.5, Math.random() < 0.6 ? 1 : 0);
    }
  } else g.plowAcc = 0;
}

// Hockeystop deaktiviert (Tim und Jürgen wollen ihn nicht) — auskommentiert statt gelöscht.
// function hockeyStop(g) {
//   burst(g, 16, 7);
//   g.fogT = 0;
// }

function burst(g, n, speed) {
  const s = g.skier;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random());
    spawnParticle(g.particles, s.x, s.y, Math.cos(a) * v, Math.sin(a) * v, 0.3 + Math.random() * 0.4, 1 + Math.random() * 2, Math.random() < 0.6 ? 1 : 0);
  }
}

// ---------- Eingabe-Handler ----------

export function onPress(g, side) {
  g.lastGesture = side < 0 ? 'hold L' : 'hold R';
  if (g.state === 'ready') start(g);
  if (g.state === 'running') P.press(g.skier, side);
  emit(g, 'press', side);
}
export function onRelease(g) {
  emit(g, 'release');
  P.release(g.skier);
}
export function onPlow(g, on) {
  if (on) g.lastGesture = 'plow';
  if (g.state === 'ready' && on) start(g);
  if (g.state === 'running') P.setPlow(g.skier, on);
  emit(g, 'plow', on);
}
export function togglePause(g) {
  if (g.state === 'running') { g.state = 'paused'; g.skier.side = 0; g.skier.plow = false; return true; }
  if (g.state === 'paused') g.state = 'running';
  return false;
}
export function pauseIfRunning(g) {
  if (g.state === 'running') { g.state = 'paused'; g.skier.side = 0; g.skier.plow = false; }
}
export function fresh(g) {
  if (g.state === 'dead' && g.deadT * 1000 >= C.DEATH_OVERLAY_MS + C.FRESH_GUARD_MS) reset(g, g.fixedSeed ?? randomSeed(), false);
}
// Modus wechseln (auf der Fresh-Seite): Bestwert gehört zum Modus.
export function selectMode(g, id) {
  const m = MODES[id];
  if (!m || m.soon) return false;
  g.mode = id;
  g.best = loadBest(id);
  saveMode(id);
  return true;
}
export function overlayReady(g) {
  return g.state === 'dead' && g.deadT * 1000 >= C.DEATH_OVERLAY_MS;
}
