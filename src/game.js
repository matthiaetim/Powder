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
    dist: 0, best: loadBest(), newBest: false,
    seed: 0, fixedSeed: opts.fixedSeed ?? null,
    mode: DEFAULT_MODE, intro: true, readyDelayMs: C.READY_AUTO_START_MS,
    readyT: 0, deadT: 0, deadCause: '',
    camX: 0, skierFrac: READY_FRAC,
    viewWm: C.VIEW_W_M, viewHm: C.VIEW_H_M,
    debug: !!opts.debug, lastGesture: '–', runs: 0,
    trackAcc: 0, spawnAcc: 0,
  };
  const saved = loadMode();
  if (MODES[saved] && !MODES[saved].soon) g.mode = saved;
  reset(g, g.fixedSeed ?? randomSeed(), true);
  return g;
}

export function hasAvalanche(g) {
  return g.mode === 'chase';
}

// intro = true: Kamerafahrt von unten (nur beim App-Start). Sonst direkt beim Fahrer.
export function reset(g, seed, intro) {
  g.seed = seed;
  g.skier = P.createSkier();
  g.world = createWorld(seed);
  g.av = createAvalanche(0);
  clearTrack(g.track);
  clearParticles(g.particles);
  g.dist = 0; g.newBest = false;
  g.readyT = 0; g.deadT = 0; g.deadCause = '';
  g.camX = 0;
  g.intro = !!intro;
  g.skierFrac = intro ? READY_FRAC : C.SKIER_SCREEN_Y_FRAC;
  g.readyDelayMs = intro ? C.READY_AUTO_START_MS : C.FRESH_START_MS;
  g.trackAcc = 0; g.spawnAcc = 0;
  g.state = 'ready';
  ensureView(g);
}

function ensureView(g) {
  const s = g.skier;
  const halfW = g.viewWm / 2;
  ensureCells(g.world, g.camX - halfW, g.camX + halfW, s.y - g.skierFrac * g.viewHm, s.y + (1 - g.skierFrac) * g.viewHm);
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
      if (g.deadCause === 'avalanche') updateAvalanche(g.av, g.skier, g.dist, dt, false);
      updateParticles(g.particles, dt);
      break;
    default:
      break;
  }
}

function start(g) {
  if (g.state !== 'ready') return;
  g.state = 'running';
  g.runs++;
}

function step(g, dt) {
  const s = g.skier;
  P.updateSkier(s, dt);
  if (s.y - s.y0 > g.dist) g.dist = s.y - s.y0;
  g.camX += (s.x - g.camX) * (1 - Math.exp(-dt / C.CAM_X_EASE_S));
  g.skierFrac += (C.SKIER_SCREEN_Y_FRAC - g.skierFrac) * (1 - Math.exp(-dt / 0.6));
  ensureView(g);

  // Spur: alle 0,4 m ein Punkt, Breite nach Carve
  g.trackAcc += s.v * dt;
  if (g.trackAcc >= C.TRACK_SPACING_M) {
    g.trackAcc = 0;
    pushTrack(g.track, s.x, s.y, Math.cos(s.theta), -Math.sin(s.theta), s.carve);
  }

  spawnSpray(g, dt);
  updateParticles(g.particles, dt);

  const hit = checkCollision(g.world, s);
  if (hit) { die(g, hit.t === P.TREE ? 'tree' : 'rock'); return; }
  if (hasAvalanche(g) && updateAvalanche(g.av, s, g.dist, dt, false)) die(g, 'avalanche');
}

function die(g, cause) {
  const s = g.skier;
  g.state = 'dead';
  g.deadT = 0;
  g.deadCause = cause;
  s.alive = false;
  s.side = 0;
  if (cause !== 'avalanche') burst(g, 24, 4);
  s.v = 0;
  const m = Math.floor(g.dist);
  if (m > g.best) { g.best = m; g.newBest = true; saveBest(m); }
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
}

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
}
export function onRelease(g) {
  P.release(g.skier);
}
export function togglePause(g) {
  if (g.state === 'running') { g.state = 'paused'; g.skier.side = 0; return true; }
  if (g.state === 'paused') g.state = 'running';
  return false;
}
export function pauseIfRunning(g) {
  if (g.state === 'running') { g.state = 'paused'; g.skier.side = 0; }
}
export function fresh(g) {
  if (g.state === 'dead' && g.deadT * 1000 >= C.DEATH_OVERLAY_MS + C.FRESH_GUARD_MS) reset(g, g.fixedSeed ?? randomSeed(), false);
}
export function selectMode(g, id) {
  const m = MODES[id];
  if (!m || m.soon) return false;
  g.mode = id;
  saveMode(id);
  return true;
}
export function overlayReady(g) {
  return g.state === 'dead' && g.deadT * 1000 >= C.DEATH_OVERLAY_MS;
}
