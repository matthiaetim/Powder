// Spielzustand und Ablauf: ready → running → dead → (Fresh) → ready. Pause jederzeit.
// Super-G (gates.js): ready → count (Countdown) → running → finished (Auslauf) → (Fresh) → ready.
import { C } from './constants.js';
import * as P from './physics.js';
import { createWorld, ensureCells } from './world.js';
import { createAvalanche, updateAvalanche } from './avalanche.js';
import { checkCollision } from './collision.js';
import { createTrack, clearTrack, pushTrack } from './track.js';
import { createParticles, clearParticles, spawnParticle, updateParticles } from './particles.js';
import { loadBest, saveBest, loadBestTime, saveBestTime, loadBestSplits, saveBestSplits, loadRider, saveRider } from './storage.js';
import { MODES, DEFAULT_MODE, lowerIsBetter } from './modes.js';
import { RIDERS, validRider } from './riders.js';
import { createCourse, updateCourse, tickCourse } from './gates.js';
import { rollYeti, updateYeti } from './yeti.js';

const READY_FRAC = 0.78; // Fahrer steht im Intro weit unten im Bild

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

export function createGame(opts = {}) {
  const g = {
    state: 'ready',
    skier: P.createSkier(), world: null, av: null,
    course: null, // Super-G: Tore und Wertung (gates.js), in den anderen Modi null
    yeti: null,   // Classic: Yeti-Spuren (yeti.js), nur in manchen Läufen
    summitT: -1,  // Classic: Laufzeit beim Erreichen der Everest-Höhe (HUD zeigt kurz „Everest“), < 0 = noch nicht
    track: createTrack(), particles: createParticles(),
    dist: 0, runT: 0, best: 0, newBest: false,
    runBest: 0, // Bestwert beim Start des Laufs: dort steht die Rekordlinie, auch wenn best beim Aufprall schon steigt
    marks: {}, runMarks: [], // Bestweiten der anderen je Modus (board.js) und der beim Start eingefrorene Satz für die Linien
    runTainted: false,       // Regler mitten im Lauf verstellt: zählt nicht für die Bestenliste (board.js)
    bestTime: 0, bestSplits: [], newBestTime: false, // Super-G: Bestzeit in Hundertstel, ihre Zwischenzeiten, neue Bestzeit im Lauf
    seed: 0, fixedSeed: opts.fixedSeed ?? null,
    mode: DEFAULT_MODE, runMode: DEFAULT_MODE, intro: true, readyDelayMs: C.READY_AUTO_START_MS,
    rider: validRider(loadRider()), // Fahrer (riders.js), nur Aussehen und Spur
    readyT: 0, deadT: 0, deadCause: '',
    countT: 0, countBeeps: 0, finT: 0, pausedFrom: 'running', // Super-G: Countdown-Zeit und -Töne, Auslauf-Zeit, woher die Pause kam
    crashV: 0, crashX: 0, crashY: 0, crashPush: 0, // Tempo, Hindernis und Schub beim Aufprall (für die Splitter)
    // fogT: -1, // < 0 = kein Nebel; sonst verstrichene Zeit seit dem Hockeystop (render.js) — deaktiviert
    camX: 0, skierFrac: READY_FRAC, zoom: 1,
    viewWm: C.VIEW_W_M, viewHm: C.VIEW_W_M * C.VIEW_ASPECT,
    debug: !!opts.debug, lastGesture: '–', runs: 0,
    trackAcc: 0, spawnAcc: 0, plowAcc: 0,
    onEvent: null, // Haken für den Ton (main.js): press, release, plow, crash, beep, gate, pole, split, finish, summit
    onCourse: null, // Rückruf des Torlaufs (einmal gebunden, keine Allokation pro Schritt)
  };
  g.onCourse = (type, data) => courseEvent(g, type, data);
  loadBests(g);
  reset(g, seedFor(g), true);
  return g;
}

export function hasAvalanche(g) {
  return g.mode === 'chase';
}

export function isSuperG(g) {
  return g.mode === 'superg';
}

// Super-G fährt immer denselben Kurs (SG_SEED), damit Bestzeiten vergleichbar sind; ?seed= gilt für alle Modi.
function seedFor(g) {
  return g.fixedSeed ?? (isSuperG(g) ? C.SG_SEED : randomSeed());
}

// Bestwerte des gewählten Modus: Meter (Classic, Chase) und Bestzeit mit Zwischenzeiten (Super-G)
function loadBests(g) {
  g.best = loadBest(g.mode);
  g.bestTime = loadBestTime(g.mode);
  g.bestSplits = loadBestSplits(g.mode);
}

function emit(g, type, data) {
  if (g.onEvent) g.onEvent(type, data);
}

// intro = true: Kamerafahrt von unten (nur beim App-Start). Sonst direkt beim Fahrer.
export function reset(g, seed, intro) {
  g.seed = seed;
  g.skier = P.createSkier();
  const sg = isSuperG(g);
  // Super-G: flache Pistenmitte, die bei 0 in der Mitte beginnt, und ein hindernisfreier Streifen um sie herum
  g.world = sg
    ? createWorld(seed, { lane: { amp: C.SG_LANE_AMP_M, wave: C.SG_LANE_WAVE_M, amp2: 0, wave2: 97 }, phase: 0, pisteHalf: C.SG_PISTE_HALF_M })
    : createWorld(seed);
  g.course = sg ? createCourse(seed, g.world) : null;
  g.av = createAvalanche(0);
  g.yeti = null;
  g.summitT = -1;
  clearTrack(g.track);
  clearParticles(g.particles);
  g.dist = 0; g.runT = 0; g.newBest = false; g.newBestTime = false;
  g.runBest = g.best;
  g.runMarks = g.marks[g.mode] || [];
  g.runTainted = false;
  g.readyT = 0; g.deadT = 0; g.deadCause = '';
  g.countT = 0; g.countBeeps = 0; g.finT = 0;
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
      // Super-G wartet im Intro auf den Tipp: der gibt zugleich den Ton frei, sonst wäre der erste Countdown stumm
      if (g.readyT * 1000 >= g.readyDelayMs && !(isSuperG(g) && g.intro)) launch(g);
      break;
    case 'count':
      g.countT += dt;
      updateCamera(g, dt);
      countdown(g);
      break;
    case 'running':
      step(g, dt);
      break;
    case 'finished':
      coast(g, dt);
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

// Aus ready heraus: Super-G in den Countdown, die anderen Modi sofort los.
function launch(g) {
  if (g.state !== 'ready') return;
  if (isSuperG(g)) { g.state = 'count'; g.countT = 0; g.countBeeps = 0; } else start(g);
}

// Countdown: SG_COUNT_BEEPS kurze Pieptöne im Abstand SG_COUNT_STEP_S (der erste sofort), dann der lange = Go.
function countdown(g) {
  const due = Math.floor(g.countT / C.SG_COUNT_STEP_S) + 1; // so viele Töne sind bis jetzt fällig
  while (g.countBeeps < due) {
    const k = g.countBeeps++;
    if (k < C.SG_COUNT_BEEPS) { emit(g, 'beep', { n: C.SG_COUNT_BEEPS - k }); continue; }
    emit(g, 'beep', { go: true });
    start(g);
    return;
  }
}

function start(g) {
  if (g.state !== 'ready' && g.state !== 'count') return;
  g.state = 'running';
  g.runMode = g.mode;
  loadBests(g);
  g.runBest = g.best;
  g.runMarks = g.marks[g.mode] || [];
  g.skier.v = C.START_SPEED_KMH / 3.6;
  g.runs++;
  // Erst hier würfeln, nicht in reset(): nur ein wirklich gestarteter Classic-Lauf zählt
  if (g.mode === 'classic') g.yeti = rollYeti(g.world);
}

// Endtempo je Modus: der Super-G hat seinen eigenen Regler
const maxKmh = (g) => (isSuperG(g) ? C.SG_MAX_SPEED_KMH : C.MAX_SPEED_KMH);

function step(g, dt) {
  const s = g.skier;
  g.runT += dt;
  const px = s.x, py = s.y; // Position vor dem Schritt: Super-G wertet Tor-, Zwischenzeit- und Ziellinie dazwischen
  // Hockeystop deaktiviert (Tim und Jürgen wollen ihn nicht) — auskommentiert statt gelöscht.
  // const wasHockey = s.hockeyT >= 0;
  P.updateSkier(s, dt, maxKmh(g));
  // if (!wasHockey && s.hockeyT >= 0) hockeyStop(g);
  // if (g.fogT >= 0) {
  //   g.fogT += dt;
  //   if (g.fogT >= C.HOCKEY_FOG_IN_S + C.HOCKEY_FOG_HOLD_S + C.HOCKEY_FOG_OUT_S) g.fogT = -1;
  // }
  if (s.y - s.y0 > g.dist) g.dist = s.y - s.y0;
  updateCamera(g, dt);
  advanceTrail(g, dt);
  updateYeti(g.yeti, s, dt);
  if (g.summitT < 0 && g.mode === 'classic' && g.dist >= C.EVEREST_Y_M) { g.summitT = g.runT; emit(g, 'summit'); }

  const hit = checkCollision(g.world, s);
  if (hit) { die(g, hit.t === P.TREE ? 'tree' : 'rock', hit); return; }
  if (hasAvalanche(g) && updateAvalanche(g.av, s, g.runT, dt, topDist(g))) { die(g, 'avalanche'); return; }
  if (g.course && updateCourse(g.course, s, px, py, g.runT, dt, g.bestSplits, g.onCourse)) finish(g);
}

// Kamera: x folgt weich; bei Tempo rückt der Fahrer nach oben und die Sicht zoomt heraus
function updateCamera(g, dt) {
  const s = g.skier;
  const k = lookahead(s.v);
  const fracTarget = C.SKIER_SCREEN_Y_FRAC + (C.CAM_Y_FRAC_FAST - C.SKIER_SCREEN_Y_FRAC) * k;
  const zoomTarget = 1 + (C.CAM_ZOOM_FAST - 1) * k;
  const ease = 1 - Math.exp(-dt / C.CAM_ZOOM_EASE_S);
  g.camX += (s.x - g.camX) * (1 - Math.exp(-dt / C.CAM_X_EASE_S));
  g.skierFrac += (fracTarget - g.skierFrac) * ease;
  g.zoom += (zoomTarget - g.zoom) * ease;
  ensureView(g);
}

// Spur (alle 0,4 m ein Punkt, Breite nach Carve, Abstand nach Pflugstellung), Spray und Partikel
function advanceTrail(g, dt) {
  const s = g.skier;
  g.trackAcc += s.v * dt;
  if (g.trackAcc >= C.TRACK_SPACING_M) {
    g.trackAcc = 0;
    pushTrack(g.track, s.x, s.y, Math.cos(s.theta), -Math.sin(s.theta), s.carve, s.plowK);
  }
  spawnSpray(g, dt);
  updateParticles(g.particles, dt);
}

// Auslauf nach dem Ziel (Super-G): die Physik läuft ohne Eingabe weiter, so gehen Winkel, Carve und Ton sauber
// auf null, dazu bremst SG_COAST_DECEL den Fahrer aus. Hindernisse zählen nicht mehr, der Lauf ist gewertet.
function coast(g, dt) {
  const s = g.skier;
  g.finT += dt;
  P.updateSkier(s, dt, maxKmh(g));
  s.v = Math.max(0, s.v - C.SG_COAST_DECEL * dt);
  tickCourse(g.course, dt); // Stangen schwingen aus, Hinweis läuft ab
  if (s.y - s.y0 > g.dist) g.dist = s.y - s.y0;
  updateCamera(g, dt);
  advanceTrail(g, dt);
}

// Ziel gekreuzt (Super-G): Zeit steht, Bestzeit samt Zwischenzeiten speichern, Fahrer in den Auslauf
function finish(g) {
  const s = g.skier, cs = g.course;
  g.state = 'finished';
  g.finT = 0;
  s.side = 0;
  s.plow = false;
  const total = Math.round(cs.total * 100);
  if (g.bestTime === 0 || total < g.bestTime) {
    g.bestTime = total;
    g.bestSplits = cs.splits.slice();
    g.newBestTime = true;
    saveBestTime(g.runMode, total);
    saveBestSplits(g.runMode, g.bestSplits);
  }
  emit(g, 'finish', { total: cs.total, misses: cs.misses, best: g.newBestTime });
}

// Ereignisse aus dem Torlauf: Ton über den Haken, an einer berührten Stange stiebt Schnee
function courseEvent(g, type, data) {
  if (type === 'pole') burstAt(g, data.x, data.y, 10, 3);
  emit(g, type, data);
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
  // Super-G wertet nur Zeiten: ein Aufprall vor dem Ziel setzt keinen Meter-Bestwert
  if (g.runMode !== 'superg' && m > g.best) { g.best = m; g.newBest = true; saveBest(g.runMode, m); }
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
  burstAt(g, g.skier.x, g.skier.y, n, speed);
}

function burstAt(g, x, y, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random());
    spawnParticle(g.particles, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.3 + Math.random() * 0.4, 1 + Math.random() * 2, Math.random() < 0.6 ? 1 : 0);
  }
}

// ---------- Eingabe-Handler ----------

export function onPress(g, side) {
  g.lastGesture = side < 0 ? 'hold L' : 'hold R';
  if (g.state === 'ready') launch(g);
  if (g.state === 'running' || g.state === 'count') P.press(g.skier, side); // im Countdown steht die Seite schon beim Go
  emit(g, 'press', side);
}
export function onRelease(g) {
  emit(g, 'release');
  P.release(g.skier);
}
export function onPlow(g, on) {
  if (on) g.lastGesture = 'plow';
  if (g.state === 'ready' && on) launch(g);
  if (g.state === 'running' || g.state === 'count') P.setPlow(g.skier, on);
  emit(g, 'plow', on);
}
// Pause aus dem Lauf oder aus dem Countdown. Ein unterbrochener Countdown beginnt beim Weiterspielen von vorn,
// sonst liefe er hinter dem Tuning-Panel oder im Hintergrund weiter und der Lauf startete ohne Spieler.
export function togglePause(g) {
  if (g.state === 'running' || g.state === 'count') { pause(g); return true; }
  if (g.state === 'paused') resume(g);
  return false;
}
export function pauseIfRunning(g) {
  if (g.state === 'running' || g.state === 'count') pause(g);
}
function pause(g) {
  g.pausedFrom = g.state;
  g.state = 'paused';
  g.skier.side = 0;
  g.skier.plow = false;
}
function resume(g) {
  if (g.pausedFrom === 'count') { g.state = 'count'; g.countT = 0; g.countBeeps = 0; } else g.state = 'running';
}
// Ende eines Laufs: nach dem Aufprall (dead) oder nach dem Ziel (finished, Super-G). Bis zur Fresh-Seite dauert es
// nach dem Ziel etwas länger, der Fahrer läuft aus.
function ended(g) {
  return g.state === 'dead' || g.state === 'finished';
}
function endedMs(g) {
  return (g.state === 'finished' ? g.finT : g.deadT) * 1000;
}
function overlayMs(g) {
  return g.state === 'finished' ? C.SG_FINISH_OVERLAY_MS : C.DEATH_OVERLAY_MS;
}
export function overlayReady(g) {
  return ended(g) && endedMs(g) >= overlayMs(g);
}
// Fresh darf, sobald die Fresh-Seite steht und die Schonfrist gegen Doppeltipps um ist (main.js nutzt es fürs Update)
export function freshReady(g) {
  return ended(g) && endedMs(g) >= overlayMs(g) + C.FRESH_GUARD_MS;
}
export function fresh(g) {
  if (freshReady(g)) reset(g, seedFor(g), false);
}
// Modus wechseln (auf der Fresh-Seite): Bestwerte gehören zum Modus. Bewusst nicht gespeichert, die App startet
// immer in Classic.
export function selectMode(g, id) {
  const m = MODES[id];
  if (!m || m.soon) return false;
  g.mode = id;
  loadBests(g);
  return true;
}
// Fahrer wechseln (auf der Fresh-Seite). Anders als der Modus bleibt er gespeichert: er gehört zum Spieler, nicht
// zum Lauf.
export function selectRider(g, id) {
  if (!RIDERS[id]) return false;
  g.rider = id;
  saveRider(id);
  return true;
}
// Bestweiten der anderen (board.js), je Modus für die Linien im Schnee. Im Zustand ready sofort übernehmen (Intro und
// Wartephase zeigen sie), sonst erst beim nächsten Lauf, damit während der Fahrt nichts springt.
export function setMarks(g, byMode) {
  g.marks = byMode || {};
  if (g.state === 'ready') g.runMarks = g.marks[g.mode] || [];
}
// Der Server kennt für den eigenen Namen mehr als dieses Gerät (Zweitgerät, gelöschte Daten): lokal übernehmen, damit
// „Bester Lauf“ und die rote Linie zur Bestenliste passen. Die Linie rückt erst beim nächsten Lauf.
// Im Super-G ist m die Gesamtzeit in Hundertstel; die Zwischenzeiten des fremden Laufs kennt der Server nicht, darum
// fallen sie weg (die Hinweise zeigen dann die reine Zwischenzeit, bis ein eigener Lauf die Bestzeit unterbietet).
export function adoptBest(g, mode, m) {
  if (lowerIsBetter(mode)) {
    const cur = loadBestTime(mode);
    if (!(m >= 1) || (cur > 0 && !(m < cur))) return;
    saveBestTime(mode, m);
    saveBestSplits(mode, []);
    if (g.mode === mode) { g.bestTime = m; g.bestSplits = []; g.newBestTime = false; }
    return;
  }
  if (!(m > loadBest(mode))) return;
  saveBest(mode, m);
  if (g.mode === mode) { g.best = m; g.newBest = false; }
}
