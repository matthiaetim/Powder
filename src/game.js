// Spielzustand und Ablauf: ready → running → dead → (Fresh) → ready. Pause jederzeit.
// Torlauf (Super-G, Slalom; gates.js): ready → count (Countdown) → running → finished (Auslauf) → (Fresh) → ready.
// Duell (duel.js): ready mit hold (Lobby) → count aus einer gemeinsamen Uhr → running → dead → running (Weiterfahrt
// nach der Sturzpause) → finished an der Zielweite oder wenn die Zeit vorbei ist.
// Piste (piste.js): wie Classic ohne Countdown, aber mit Weiterfahrt nach dem Sturz wie im Duell (PISTE_FREE_CRASHES
// Stürze sind frei, der nächste beendet den Lauf) und einem Ziel bei PISTE_FINISH_M. Was an der Strecke lebt (andere
// Fahrer, Sprünge, Tore, Tempomessung), rechnet piste-life.js nach jedem Physikschritt.
import { C } from './constants.js';
import * as P from './physics.js';
import { createWorld, ensureCells, laneX } from './world.js';
import { createAvalanche, updateAvalanche, holdAvalanche } from './avalanche.js';
import { checkCollision } from './collision.js';
import { createTrack, clearTrack, pushTrack } from './track.js';
import { createParticles, clearParticles, spawnParticle, updateParticles } from './particles.js';
import { loadBest, saveBest, loadBestTime, saveBestTime, loadSplitRef, saveSplitRef, loadRider, saveRider, noteRecentMode, loadMarksOn, saveMarksOn } from './storage.js';
import { MODES, DEFAULT_MODE, lowerIsBetter, modeOn } from './modes.js';
import { RIDERS, validRider } from './riders.js';
import { createCourse, updateCourse, tickCourse, crossFrac, courseOf, cv } from './gates.js';
import { hasFence, fenceClamp, fenceRelax } from './fence.js';
import { rollYeti, updateYeti } from './yeti.js';
import { startStop, speedAt, distAt, headingAt, stopClock } from './hockey.js';
import { createStadium, updateStadium, clearsWorld, glide, partying } from './stadium.js';
import { createPiste, worldOpts, paceAt, laneAt, centerAt } from './piste.js';
import { createLife, stepLife, moveNpcs, crashesUsed, skipTo } from './piste-life.js';

const READY_FRAC = 0.78; // Fahrer steht im Intro weit unten im Bild

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

export function createGame(opts = {}) {
  const g = {
    state: 'ready',
    skier: P.createSkier(), world: null, av: null,
    course: null, // Torlauf (Super-G, Slalom): Tore und Wertung (gates.js), in den anderen Modi null
    stadium: null, // Torlauf: Zielstadion (stadium.js)
    piste: null,  // Piste: die vorgerechnete Strecke (piste.js), in den anderen Modi null
    life: null,   // Piste: andere Fahrer, Sprung, Tore, Tempomessung (piste-life.js)
    onLife: null, // Rückruf der Piste (einmal gebunden wie onCourse)
    finTime: 0,   // Piste: Laufzeit beim Kreuzen der Ziellinie in s, 0 = nicht im Ziel
    yeti: null,   // Classic: Yeti-Spuren (yeti.js), nur in manchen Läufen
    summitT: -1,  // Classic: Laufzeit beim Erreichen der Everest-Höhe (HUD zeigt kurz „Everest“), < 0 = noch nicht
    track: createTrack(), particles: createParticles(),
    dist: 0, runT: 0, best: 0, newBest: false,
    runBest: 0, // Bestwert beim Start des Laufs: dort steht die Rekordlinie, auch wenn best beim Aufprall schon steigt
    marks: {}, runMarks: [], // Bestweiten der anderen je Modus (board.js) und der beim Start eingefrorene Satz für die Linien
    marksOn: loadMarksOn(),  // Namenslinien anzeigen (Einstellungen); die eigene rote Rekordlinie bleibt immer
    runTainted: false,       // Regler mitten im Lauf verstellt: zählt nicht für die Bestenliste (board.js)
    bestTime: 0, newBestTime: false, // Super-G: Bestzeit in Hundertstel, neue Bestzeit im Lauf
    bestSplits: [], splitRefT: 0,    // Zwischenzeiten des schnellsten eigenen Laufs und dessen Gesamtzeit (storage.js)
    seed: 0, fixedSeed: opts.fixedSeed ?? null,
    mode: DEFAULT_MODE, runMode: DEFAULT_MODE, intro: true, readyDelayMs: C.READY_AUTO_START_MS,
    rider: validRider(loadRider()), // Fahrer (riders.js), nur Aussehen und Spur
    readyT: 0, deadT: 0, deadCause: '',
    countT: 0, countBeeps: 0, finT: 0, pausedFrom: 'running', // Super-G: Countdown-Zeit und -Töne, Auslauf-Zeit, woher die Pause kam
    crashV: 0, crashX: 0, crashY: 0, crashPush: 0, // Tempo, Hindernis und Schub beim Aufprall (für die Splitter)
    stop: null, // Hockeystop nach dem Ziel (hockey.js): festgehaltener Anfang; im Zielstadion erst nach dem Gleiten
    // fogT: -1, // < 0 = kein Nebel; sonst verstrichene Zeit seit dem Hockeystop (render.js) — deaktiviert
    camX: 0, skierFrac: READY_FRAC, zoom: 1,
    viewWm: C.VIEW_W_M, viewHm: C.VIEW_W_M * C.VIEW_ASPECT,
    debug: !!opts.debug, lastGesture: '–', runs: 0,
    startAt: opts.startAt || 0, startLane: opts.startLane || 0, // Piste (?at=Meter&lane=Zweig): der Lauf beginnt dort, zum Prüfen einer Stelle; zählt wie Tuning
    trackAcc: 0, spawnAcc: 0, plowAcc: 0,
    onEvent: null, // Haken für den Ton (main.js): press, release, plow, crash, beep, gate, pole, fence, split, finish, summit,
    // auf der Piste dazu jump, land, trap, gates
    onCourse: null, // Rückruf des Torlaufs (einmal gebunden, keine Allokation pro Schritt)
    // Duell (duel.js): Start gesperrt (Lobby), Countdown aus der gemeinsamen Uhr, Zielweite, Sturzpause, Zeit vorbei,
    // Schonfrist nach der Weiterfahrt, Stürze im Lauf und Radius des letzten Hindernisses, Rückruf am Ziel, Pose des
    // Gegners (render.js zeichnet sie als Geist)
    hold: false, countClock: null, finishM: 0, respawnS: 0, raceOver: false, graceT: 0, crashes: 0, crashR: 0,
    onFinish: null, ghost: { on: false },
  };
  g.onCourse = (type, data) => courseEvent(g, type, data);
  g.onLife = (type, data) => lifeEvent(g, type, data);
  loadBests(g);
  reset(g, seedFor(g), true);
  return g;
}

export function hasAvalanche(g) {
  return g.mode === 'chase';
}

// Torlauf-Modi (Super-G, Slalom): Kurs mit Toren, Countdown, Zeitwertung (gates.js COURSES)
export function isCourse(g) {
  return !!courseOf(g.mode);
}

export function isDuel(g) {
  return g.mode === 'duel';
}

export function isPiste(g) {
  return g.mode === 'piste';
}

// Ein Torlauf fährt immer denselben Kurs (SG_SEED, SL_SEED), damit Bestzeiten vergleichbar sind, die Piste immer
// dieselbe Strecke (PISTE_SEED); ?seed= gilt für alle Modi.
function seedFor(g) {
  const spec = courseOf(g.mode);
  return g.fixedSeed ?? (spec ? cv(spec, 'seed') : isPiste(g) ? C.PISTE_SEED : randomSeed());
}

// Bestwerte des gewählten Modus: Meter (Classic, Lawine) und Bestzeit mit Zwischenzeiten (Super-G)
function loadBests(g) {
  g.best = loadBest(g.mode);
  g.bestTime = loadBestTime(g.mode);
  const ref = loadSplitRef(g.mode);
  g.bestSplits = ref.s;
  g.splitRefT = ref.t;
}

function emit(g, type, data) {
  if (g.onEvent) g.onEvent(type, data);
}

// intro = true: Kamerafahrt von unten (nur beim App-Start). Sonst direkt beim Fahrer.
export function reset(g, seed, intro) {
  g.seed = seed;
  g.skier = P.createSkier();
  const spec = courseOf(g.mode);
  // Torlauf: flache Pistenmitte, die bei 0 in der Mitte beginnt, und ein hindernisfreier Streifen um sie herum; im
  // Slalom etwas breiter, der Wald bleibt hinter dem Fangzaun
  g.world = spec
    ? createWorld(seed, {
      lane: { amp: cv(spec, 'laneAmp'), wave: cv(spec, 'laneWave'), amp2: 0, wave2: 97 }, phase: 0,
      pisteHalf: cv(spec, 'pisteHalf') + (spec.fence ? C.SL_FENCE_CLEAR_M : 0), startLine: false,
    })
    : isPiste(g) ? createWorld(seed, worldOpts(g.piste = createPiste(seed))) : createWorld(seed);
  if (!isPiste(g)) g.piste = null;
  g.life = g.piste ? createLife(g.piste) : null;
  g.finTime = 0;
  g.course = spec ? createCourse(seed, g.world, spec) : null;
  // Zielstadion: räumt seine Fläche in der Welt frei, bevor ensureView die ersten Zellen baut
  const sd = g.stadium = spec && spec.stadium ? createStadium(g.course) : null;
  if (sd) g.world.clear = (x, y, r) => clearsWorld(sd, x, y, r);
  g.av = createAvalanche(0);
  g.yeti = null;
  g.summitT = -1;
  clearTrack(g.track);
  clearParticles(g.particles);
  g.dist = 0; g.runT = 0; g.newBest = false; g.newBestTime = false;
  g.runBest = g.best;
  g.runMarks = runMarksFor(g);
  g.runTainted = false;
  g.readyT = 0; g.deadT = 0; g.deadCause = '';
  g.stop = null;
  g.countT = 0; g.countBeeps = 0; g.finT = 0;
  // g.fogT = -1; // Hockeystop deaktiviert
  g.camX = 0; g.zoom = 1;
  g.intro = !!intro;
  g.skierFrac = intro ? READY_FRAC : C.SKIER_SCREEN_Y_FRAC;
  g.readyDelayMs = intro ? C.READY_AUTO_START_MS : C.FRESH_START_MS;
  g.trackAcc = 0; g.spawnAcc = 0;
  // Duell: der Lauf wartet auf den gemeinsamen Countdown (beginCount), alles andere setzt duel.js vor dem Start
  g.hold = isDuel(g);
  g.countClock = null; g.finishM = 0; g.respawnS = 0; g.raceOver = false; g.graceT = 0; g.crashes = 0; g.crashR = 0;
  // Piste: Ziel und Weiterfahrt nach dem Sturz gehören zum Modus
  if (isPiste(g)) {
    g.finishM = C.PISTE_FINISH_M; g.respawnS = C.PISTE_CRASH_PAUSE_S;
    if (g.startAt > 0) { g.skier.y = g.startAt; g.skier.x = centerAt(g.piste, g.startAt, g.startLane); skipTo(g.life, g.startAt); g.runTainted = true; }
  }
  g.ghost.on = false;
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

// left: Simulationszeit, die in diesem Bild nach diesem Teilschritt noch folgt (main.js); das Duell rechnet damit
// den Zieldurchgang auf die Wanduhr um.
export function update(g, dt, left = 0) {
  switch (g.state) {
    case 'ready':
      g.readyT += dt;
      if (hasAvalanche(g) && C.AV_INTRO_M > 0) holdAvalanche(g.av, g.skier, 0, dt, topDist(g)); // schon vor dem Start im Bild
      // Der Torlauf wartet im Intro auf den Tipp: der gibt zugleich den Ton frei, sonst wäre der erste Countdown stumm.
      // Im Duell (hold) startet nur der gemeinsame Countdown (beginCount).
      if (!g.hold && g.readyT * 1000 >= g.readyDelayMs && !(isCourse(g) && g.intro)) launch(g);
      break;
    case 'count':
      g.countT = g.countClock ? g.countClock() : g.countT + dt; // Duell: gemeinsame Uhr statt Simulationszeit
      updateCamera(g, dt);
      countdown(g);
      break;
    case 'running':
      step(g, dt, left);
      break;
    case 'finished':
      coast(g, dt);
      break;
    case 'dead':
      g.deadT += dt;
      if (g.deadCause === 'avalanche') updateAvalanche(g.av, g.skier, g.runT, dt, topDist(g)); // rollt über den Fahrer
      updateParticles(g.particles, dt);
      // Piste: die Uhr läuft durch die Sturzpause (im Duell zählt duel.js die Wanduhr), die anderen fahren weiter
      if (isPiste(g) && g.respawnS > 0 && !g.raceOver) { g.runT += dt; moveNpcs(g.life, g.skier, dt); }
      if (g.respawnS > 0 && !g.raceOver && g.deadT >= g.respawnS) respawn(g); // Duell, Piste: weiter nach der Sturzpause
      break;
    default:
      break;
  }
  if (g.stadium) updateStadium(g.stadium, g, dt);
}

// Aus ready heraus: Torlauf und Duell in den Countdown, die anderen Modi sofort los.
function launch(g) {
  if (g.state !== 'ready') return;
  if (isCourse(g) || isDuel(g)) { g.state = 'count'; g.countT = 0; g.countBeeps = 0; } else start(g);
}

// Duell: Countdown aus einer gemeinsamen Uhr (duel.js). clock() liefert die Countdown-Zeit in s, 0 = erster Piepton,
// Go nach SG_COUNT_BEEPS · SG_COUNT_STEP_S. Kommt das Gerät zu spät, spielt nur der jüngste fällige Piepton.
export function beginCount(g, clock) {
  if (g.state !== 'ready') return false;
  g.hold = false;
  g.countClock = clock;
  g.countT = clock();
  g.countBeeps = Math.min(C.SG_COUNT_BEEPS, Math.max(0, Math.floor(g.countT / C.SG_COUNT_STEP_S)));
  g.state = 'count';
  return true;
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
  noteRecentMode(g.mode); // Reihenfolge der Modus-Vorschauen auf der Fresh-Seite (hud.js)
  loadBests(g);
  g.runBest = g.best;
  g.runMarks = runMarksFor(g);
  g.skier.v = C.START_SPEED_KMH / 3.6;
  g.runs++;
  // Erst hier würfeln, nicht in reset(): nur ein wirklich gestarteter Classic-Lauf zählt
  if (g.mode === 'classic') g.yeti = rollYeti(g.world);
}

// Endtempo je Modus: Super-G und Slalom haben ihren eigenen Regler. Auf der Piste gilt das Tempo aus Classic, nur
// die Zweige einer Gabelung sind steiler oder flacher (paceAt, dort auch der Hangabtrieb).
const maxKmh = (g) => (g.course ? cv(g.course.spec, 'maxKmh') : C.MAX_SPEED_KMH);

function step(g, dt, left) {
  const s = g.skier, L = g.life;
  g.runT += dt;
  const px = s.x, py = s.y; // Position vor dem Schritt: Super-G wertet Tor-, Zwischenzeit- und Ziellinie dazwischen
  // Hockeystop deaktiviert (Tim und Jürgen wollen ihn nicht) — auskommentiert statt gelöscht.
  // const wasHockey = s.hockeyT >= 0;
  // Piste: im Sprung steht die Flugbahn fest (piste-life.js), sonst Physik mit Tempo und Gefälle der Stelle
  if (L && L.air) { /* fliegt */ } else if (g.piste) { const pc = paceAt(g.piste, s.x, s.y); P.updateSkier(s, dt, pc.kmh, pc.g); } else P.updateSkier(s, dt, maxKmh(g));
  const lifeHit = L ? stepLife(L, s, px, py, dt, g.onLife) : null;
  if (g.course && g.course.spec.ramp) startBoost(g, s, dt);
  if (g.course && hasFence(g.course.spec) && fenceClamp(g.course, g.world, s, dt)) emit(g, 'fence', { v: s.v });
  // if (!wasHockey && s.hockeyT >= 0) hockeyStop(g);
  // if (g.fogT >= 0) {
  //   g.fogT += dt;
  //   if (g.fogT >= C.HOCKEY_FOG_IN_S + C.HOCKEY_FOG_HOLD_S + C.HOCKEY_FOG_OUT_S) g.fogT = -1;
  // }
  if (s.y - s.y0 > g.dist) g.dist = s.y - s.y0;
  updateCamera(g, dt);
  if (L && L.air) { g.track.pendingGap = true; updateParticles(g.particles, dt); } else advanceTrail(g, dt); // in der Luft keine Spur
  updateYeti(g.yeti, s, dt);
  if (g.summitT < 0 && g.mode === 'classic' && g.dist >= C.EVEREST_Y_M) { g.summitT = g.runT; emit(g, 'summit'); }

  // Duell: Zielweite gekreuzt, die Zeit wird auf die Linie interpoliert (wie die Ziellinie im Super-G). Der Rückruf
  // bekommt, wie viel Simulationszeit vor dem Ende des Bildes die Linie lag; duel.js rechnet auf die Wanduhr um.
  if (g.finishM > 0 && s.y >= g.finishM) {
    const late = (1 - crossFrac(py, s.y, g.finishM)) * dt; // so lange vor dem Ende des Schritts lag die Linie
    if (g.piste) { finishPiste(g, g.runT - late); return; }
    if (g.onFinish) g.onFinish(left + late);
    endRun(g, { duel: true });
    return;
  }
  // Schonfrist nach der Weiterfahrt (Duell): durch Hindernisse hindurch. Läuft sie ab, während der Fahrer noch in einem
  // steckt, hält sie, bis er frei ist; sonst käme genau dann der nächste Sturz.
  // Piste: dazu andere Fahrer und alles, was am Rand steht (lifeHit); im Sprung und kurz nach der Landung trifft man nichts
  let hit = L && (L.air || L.safeT > 0) ? null : checkCollision(g.world, s) || lifeHit;
  if (g.graceT > 0) { g.graceT = hit ? Math.max(C.STEP, g.graceT - dt) : Math.max(0, g.graceT - dt); hit = null; }
  if (hit) { die(g, hit.t === P.TREE ? 'tree' : hit.t === P.ROCK ? 'rock' : hit.t, hit); return; }
  if (hasAvalanche(g)) {
    if (g.dist < C.AV_INTRO_M) holdAvalanche(g.av, s, g.runT, dt, topDist(g)); // Startphase: sichtbar, harmlos
    else if (updateAvalanche(g.av, s, g.runT, dt, topDist(g))) { die(g, 'avalanche'); return; }
  }
  if (g.course && updateCourse(g.course, s, px, py, g.runT, dt, g.bestSplits, g.onCourse)) finish(g);
}

// Starthügel (Slalom): auf den ersten Metern zusätzlicher Hangabtrieb, zum Ende des steilen Stücks weich auf null.
// Wer quer steht, bekommt nichts davon (cos), das Endtempo des Modus gilt weiter.
function startBoost(g, s, dt) {
  const spec = g.course.spec, ramp = cv(spec, 'ramp');
  if (!(ramp > 0) || !(s.y < ramp)) return;
  const u = Math.max(0, s.y) / ramp;
  s.v = Math.min(maxKmh(g) / 3.6, s.v + cv(spec, 'boost') * (1 - u * u * (3 - 2 * u)) * Math.max(0, Math.cos(s.theta)) * dt);
}

// Kamera: x folgt weich; bei Tempo rückt der Fahrer nach oben und die Sicht zoomt heraus
function updateCamera(g, dt) {
  const s = g.skier;
  const k = lookahead(s.v);
  // Im Zielstadion (nach dem Ziel) rückt das Bild auf die Mitte des Runds: Zielbogen oben, Tribünen ringsum
  const arena = g.state === 'finished' ? g.stadium : null;
  const fracTarget = arena ? C.STAD_CAM_FRAC : C.SKIER_SCREEN_Y_FRAC + (C.CAM_Y_FRAC_FAST - C.SKIER_SCREEN_Y_FRAC) * k;
  const zoomTarget = 1 + (C.CAM_ZOOM_FAST - 1) * k;
  const ease = 1 - Math.exp(-dt / C.CAM_ZOOM_EASE_S);
  g.camX += ((arena ? arena.cx : s.x) - g.camX) * (1 - Math.exp(-dt / C.CAM_X_EASE_S));
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

// Nach dem Ziel (Torlauf und Duell): Hockeystop (hockey.js). Die Ski kommen schnell quer, der Fahrer rutscht in der
// alten Fahrtrichtung weiter und steht nach knapp einer Sekunde; Lage, Tempo und Stellung folgen geschlossen aus
// g.finT. Die Spur wird zur breiten Bremsspur (Pflug-Band quer zur Fahrt, siehe drawTrack); das normale Spray
// entfällt, den Schnee übernimmt die Wolke (hockey-view.js). Hindernisse zählen nicht mehr, der Lauf ist gewertet.
// Im Zielstadion (Torlauf) gleitet er vorher ins Rund (stadium.js glide), der Hockeystop beginnt so, dass er in der
// Mitte steht.
function coast(g, dt) {
  const s = g.skier, sd = g.stadium;
  g.finT += dt;
  if (sd && sd.gliding) {
    if (glide(sd, s, dt)) g.stop = startStop(s, g.finT);
    else {
      tickCourse(g.course, dt);
      fenceRelax(g.course, dt);
      if (s.y - s.y0 > g.dist) g.dist = s.y - s.y0;
      updateCamera(g, dt);
      advanceTrail(g, dt);
      return;
    }
  }
  const st = g.stop;
  const t = stopClock(st, g.finT), d = distAt(st, t);
  s.theta = headingAt(st, t);
  s.omega = 0;
  s.v = speedAt(st, t);
  s.x = st.x0 + Math.sin(st.dir) * d;
  s.y = st.y0 + Math.cos(st.dir) * d;
  s.brake = s.v > 0 ? C.STOP_DECEL_MIN + C.STOP_DECEL_K * s.v : 0; // der Ton kratzt, solange er rutscht
  s.carve = s.v > 0.5 ? 1 : 0;
  s.plowK *= Math.exp(-dt / C.PLOW_EASE_S);
  if (g.course) {
    tickCourse(g.course, dt); // Stangen schwingen aus, Hinweis läuft ab (im Duell gibt es keinen Kurs)
    if (hasFence(g.course.spec)) fenceRelax(g.course, dt); // die Beule im Fangzaun schwingt aus
  }
  if (s.y - s.y0 > g.dist && !g.piste) g.dist = s.y - s.y0; // Piste: im Auslauf bleibt es bei der Zielweite
  updateCamera(g, dt);
  g.trackAcc += s.v * dt;
  if (g.trackAcc >= C.TRACK_SPACING_M) {
    g.trackAcc = 0;
    pushTrack(g.track, s.x, s.y, Math.cos(st.dir), -Math.sin(st.dir), 1, 1);
  }
  updateParticles(g.particles, dt);
}

// Ein Tipp nach dem Ziel überspringt Hockeystop und Wolke: g.finT springt ans Ende, die Fresh-Seite kommt sofort.
// Die Schonfrist gegen Doppeltipps (freshReady) läuft ab dann, derselbe Tipp startet also keinen neuen Lauf.
// Im Zielstadion steht der Fahrer dann sofort quer in der Mitte des Runds.
function skipFinish(g) {
  if (g.state !== 'finished' || g.finT * 1000 >= overlayMs(g)) return false;
  const sd = g.stadium;
  if (sd) {
    if (sd.gliding) {
      const s = g.skier;
      sd.gliding = false;
      s.x = sd.cx; s.y = sd.yc; s.v = 0;
      g.stop = startStop(s, g.finT - 1); // der Stopp ist schon vorbei: keine Wolke, die Ski stehen quer
      g.track.pendingGap = true;
    }
    g.finT = g.stop.t0 + C.STAD_HOLD_S;
  } else g.finT = C.SG_FINISH_OVERLAY_MS / 1000;
  return true;
}

// Lauf gewertet, Fahrer in den Auslauf: Super-G nach dem Ziel, Duell am Ziel oder wenn die Zeit vorbei ist (duel.js).
// data geht mit dem finish-Ereignis an den Ton.
export function endRun(g, data) {
  if (g.state !== 'running' && g.state !== 'paused') return;
  const s = g.skier;
  g.state = 'finished';
  g.finT = 0;
  g.stop = g.stadium ? null : startStop(s); // Zielstadion: erst gleiten (coast)
  s.side = 0;
  s.plow = false;
  emit(g, 'finish', data);
}

// Ziel gekreuzt (Piste): die Weite ist die ganze Strecke, dazu zählt die Zeit. Die Bestzeit gilt nur unter Läufen,
// die unten angekommen sind; Fahrer in den Auslauf wie im Duell.
function finishPiste(g, time) {
  g.finTime = Math.max(0.01, Math.round(time * 100) / 100);
  g.dist = g.finishM;
  if (g.finishM > g.best) { g.best = g.finishM; g.newBest = true; saveBest(g.runMode, g.best); }
  const total = Math.round(g.finTime * 100);
  if (g.bestTime === 0 || total < g.bestTime) {
    g.bestTime = total;
    g.newBestTime = true;
    saveBestTime(g.runMode, total);
  }
  endRun(g, { piste: true, total: g.finTime, best: g.newBestTime });
}

// Ziel gekreuzt (Super-G): Zeit steht, Bestzeit und Zwischenzeiten des schnellsten Laufs speichern, Fahrer in den Auslauf
function finish(g) {
  const cs = g.course;
  const total = Math.round(cs.total * 100);
  if (g.bestTime === 0 || total < g.bestTime) {
    g.bestTime = total;
    g.newBestTime = true;
    saveBestTime(g.runMode, total);
  }
  if (g.splitRefT === 0 || total < g.splitRefT) {
    g.splitRefT = total;
    g.bestSplits = cs.splits.slice();
    saveSplitRef(g.runMode, total, g.bestSplits);
  }
  endRun(g, { total: cs.total, misses: cs.misses, best: g.newBestTime });
}

// Ereignisse aus dem Torlauf: Ton über den Haken, an einer berührten Stange stiebt Schnee
function courseEvent(g, type, data) {
  if (type === 'pole') burstAt(g, data.x, data.y, 10, 3);
  emit(g, type, data);
}

// Ereignisse der Piste (piste-life.js): bei der Landung stiebt Schnee, die Spur beginnt neu
function lifeEvent(g, type, data) {
  if (type === 'pole') burstAt(g, data.x, data.y, 10, 3);
  if (type === 'land') { burst(g, data.kind === 1 ? 26 : data.kind === 2 ? 6 : 14, 5); g.track.pendingGap = true; }
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
  g.crashes++;
  g.crashR = hit ? hit.r : 0;
  if (hit && hit.npc) hit.npc.down = 1.6; // der andere Fahrer sitzt kurz im Schnee
  if (g.life) {
    g.life.crashAt.push(Math.floor(g.dist));
    // die freien Stürze sind verbraucht (eine Torstrecke mit allen Toren gibt einen zurück)
    if (crashesUsed(g.life) > C.PISTE_FREE_CRASHES) g.raceOver = true;
  }
  const m = Math.floor(g.dist);
  // Nur Modi mit Meter-Wertung setzen einen Bestwert: der Super-G wertet Zeiten, das Duell zählt Siege
  if (MODES[g.runMode].board === 'm' && m > g.best) { g.best = m; g.newBest = true; saveBest(g.runMode, m); }
}

// Duell und Piste: nach der Sturzpause geht es weiter, seitlich neben dem Hindernis (vom Hindernis weg, Abstand aus beiden
// Radien plus Luft), notfalls auf der Korridor-Mitte, die immer frei ist. Schonfrist ohne Kollision, die Spur
// bekommt eine Lücke; die Zeit lief die ganze Sturzpause weiter (Wanduhr in duel.js).
function respawn(g) {
  const old = g.skier;
  const s = P.createSkier();
  const side = old.x >= g.crashX ? 1 : -1;
  s.y = old.y;
  s.y0 = old.y0;
  s.x = g.crashX + side * (C.SKIER_R + g.crashR + C.DUEL_RESPAWN_CLEAR_M);
  if (g.piste) {
    // Piste: zurück auf die Piste, in den Zweig, in dem er gestürzt ist, mit etwas Abstand zum Rand
    const a = laneAt(g.piste, old.x, s.y), m = Math.max(0, a.half - 1.5);
    s.x = Math.min(a.c + m, Math.max(a.c - m, s.x));
  } else if (checkCollision(g.world, s)) s.x = laneX(g.world, s.y);
  s.v = C.START_SPEED_KMH / 3.6;
  g.skier = s;
  g.graceT = C.DUEL_RESPAWN_GRACE_S;
  g.track.pendingGap = true;
  g.deadT = 0;
  g.deadCause = '';
  g.state = 'running';
  emit(g, 'respawn');
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
  skipFinish(g);
  if (g.state === 'ready' && !g.hold) launch(g);
  if (g.state === 'running' || g.state === 'count') P.press(g.skier, side); // im Countdown steht die Seite schon beim Go
  emit(g, 'press', side);
}
export function onRelease(g) {
  emit(g, 'release');
  P.release(g.skier);
}
export function onPlow(g, on) {
  if (on) g.lastGesture = 'plow';
  if (on) skipFinish(g);
  if (g.state === 'ready' && on && !g.hold) launch(g);
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
  // Duell: die gemeinsame Uhr lief weiter, der Countdown beginnt nicht von vorn
  if (g.pausedFrom === 'count') { g.state = 'count'; if (!g.countClock) { g.countT = 0; g.countBeeps = 0; } } else g.state = 'running';
}
// Ende eines Laufs: nach dem Aufprall (dead) oder nach dem Ziel (finished, Super-G). Bis zur Fresh-Seite dauert es
// nach dem Ziel etwas länger, der Fahrer läuft aus.
// Im Duell ist ein Sturz kein Ende, solange die Weiterfahrt noch kommt (respawnS) und die Zeit nicht vorbei ist
function ended(g) {
  return g.state === 'finished' || (g.state === 'dead' && !(g.respawnS > 0 && !g.raceOver));
}
function endedMs(g) {
  return (g.state === 'finished' ? g.finT : g.deadT) * 1000;
}
function overlayMs(g) {
  if (g.state !== 'finished') return C.DEATH_OVERLAY_MS;
  if (!g.stadium) return C.SG_FINISH_OVERLAY_MS;
  return g.stop ? (g.stop.t0 + C.STAD_HOLD_S) * 1000 : Infinity; // Zielstadion: erst gleiten, dann der Stopp
}
// Im Duell (hold) steht die Fresh-Seite mit der Lobby auch über dem wartenden Startbild
export function overlayReady(g) {
  return g.hold || (ended(g) && endedMs(g) >= overlayMs(g));
}
// Bewegt sich noch etwas im Bild? Sonst zeichnet main.js nur noch im Leerlauf (IDLE_FPS). Nach dem Ziel gleitet der
// Fahrer aus, bis er steht (Stangen schwingen, Hinweis läuft ab); nach dem Sturz fliegen Splitter und Partikel.
export function animating(g) {
  switch (g.state) {
    case 'running': case 'count': return true;
    case 'finished': return g.finT < C.STOP_CLOUD_S || g.skier.v > 0 || (!!g.stadium && partying(g.stadium)); // Hockeystop, Wolke, Konfetti
    case 'dead': return g.deadT < C.DEAD_SETTLE_S || (g.respawnS > 0 && !g.raceOver); // Duell: Geist fährt, Weiterfahrt kommt
    default: return false; // ready, paused: das Bild steht
  }
}
// Fresh darf, sobald die Fresh-Seite steht und die Schonfrist gegen Doppeltipps um ist (main.js nutzt es fürs Update)
export function freshReady(g) {
  return ended(g) && endedMs(g) >= overlayMs(g) + C.FRESH_GUARD_MS;
}
// Neustart mitten im Torlauf (Knopf oben rechts, hud.js): der Lauf zählt nicht, es geht mit dem Countdown von vorn
// los. Nur im Countdown, in der Fahrt oder in der Pause; im Duell würde es das Rennen zerreißen.
export function restart(g) {
  if (!isCourse(g) || !(g.state === 'count' || g.state === 'running' || g.state === 'paused')) return false;
  reset(g, seedFor(g), false);
  return true;
}
export function fresh(g) {
  if (skipFinish(g)) return; // Leertaste/Enter während des Hockeystops: erst zur Fresh-Seite
  if (freshReady(g)) reset(g, seedFor(g), false);
}
// Modus wechseln (auf der Fresh-Seite): Bestwerte gehören zum Modus. Bewusst nicht gespeichert, die App startet
// immer in Classic; gemerkt wird nur, dass er zuletzt gewählt war (Reihenfolge der Vorschauen).
export function selectMode(g, id) {
  if (!modeOn(id)) return false;
  g.mode = id;
  noteRecentMode(id);
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
// Welche Bestweiten der anderen als Linie im Schnee liegen: die BOARD_MARKS_N nächsten Weiten hinter dem eigenen Rekord
// (die Ziele; ohne Rekord ab 0 m, also die leichtesten) und die BOARD_MARKS_N nächsten davor (die Verfolger, die man auf
// dem Weg zum Rekord noch einmal überholt). Fest je Seite, fehlt eine Seite, füllt die andere nicht auf. Alle Linien
// liegen mindestens BOARD_MARKS_GAP_M auseinander; aus einem Klumpen bleibt die Weite, die dem Rekord näher liegt.
// Alle Weiten würden mit wachsender Spielerzahl den Hang zupflastern. Ergebnis Meter absteigend, wie drawMarks
// (render.js) es erwartet.
function runMarksFor(g) {
  if (!g.marksOn) return [];
  const all = [...(g.marks[g.mode] || [])].sort((a, b) => a.m - b.m);
  const out = [];
  const free = (m) => out.every((f) => Math.abs(f.m - m) >= C.BOARD_MARKS_GAP_M);
  let n = 0;
  for (const f of all) {
    if (n >= C.BOARD_MARKS_N) break;
    if (f.m > g.best && free(f.m)) { out.push(f); n++; }
  }
  n = 0;
  for (let i = all.length - 1; i >= 0 && n < C.BOARD_MARKS_N; i--) {
    if (all[i].m <= g.best && free(all[i].m)) { out.push(all[i]); n++; }
  }
  return out.sort((a, b) => b.m - a.m);
}

// Bestweiten der anderen (board.js), je Modus für die Linien im Schnee. Im Zustand ready sofort übernehmen (Intro und
// Wartephase zeigen sie), sonst erst beim nächsten Lauf, damit während der Fahrt nichts springt.
export function setMarks(g, byMode) {
  g.marks = byMode || {};
  if (g.state === 'ready') g.runMarks = runMarksFor(g);
}
// Einstellungen: Namenslinien an oder aus. Außerhalb eines Laufs sofort (hinter der Kachel sieht man den Hang), sonst
// ab dem nächsten Lauf wie bei setMarks.
export function setMarksOn(g, on) {
  g.marksOn = !!on;
  saveMarksOn(g.marksOn);
  if (g.state !== 'running' && g.state !== 'paused' && g.state !== 'count') g.runMarks = runMarksFor(g);
}
// Der Server kennt für den eigenen Namen mehr als dieses Gerät (Zweitgerät, gelöschte Daten): lokal übernehmen, damit
// „Bester Lauf“ und die rote Linie zur Bestenliste passen. Die Linie rückt erst beim nächsten Lauf.
// Im Super-G ist m die Gesamtzeit in Hundertstel; die Zwischenzeiten des fremden Laufs kennt der Server nicht, darum
// bleibt der Vergleich beim schnellsten Lauf auf diesem Gerät (storage.js).
// Piste: mit der vollen Weite kommt die Zeit t des Laufs in s mit, sie gilt als Bestzeit, wenn sie schneller ist.
export function adoptBest(g, mode, m, t = 0) {
  if (MODES[mode].tie === 't' && m >= C.PISTE_FINISH_M && t > 0) {
    const cs = Math.round(t * 100), cur = loadBestTime(mode);
    if (cur === 0 || cs < cur) {
      saveBestTime(mode, cs);
      if (g.mode === mode) { g.bestTime = cs; g.newBestTime = false; }
    }
  }
  if (lowerIsBetter(mode)) {
    const cur = loadBestTime(mode);
    if (!(m >= 1) || (cur > 0 && !(m < cur))) return;
    saveBestTime(mode, m);
    if (g.mode === mode) { g.bestTime = m; g.newBestTime = false; }
    return;
  }
  if (!(m > loadBest(mode))) return;
  saveBest(mode, m);
  if (g.mode === mode) { g.best = m; g.newBest = false; }
}
