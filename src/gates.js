// Super-G und Slalom: der Torlauf (Kurs) und seine Wertung. Reines Modul ohne DOM, damit eine Node-Simulation ihn
// durchrechnen kann. Die Tore stehen abwechselnd links und rechts der Pistenmitte (laneX der Welt, im Torlauf
// eine flache Sinuskurve) und abwechselnd rot und blau. Im Super-G fährt man zwischen zwei Stangen durch, im Slalom
// steht je Tor nur eine Kippstange, an der man außen vorbeifährt (auf der von der Pistenmitte abgewandten Seite).
// Gewertet wird beim Kreuzen der Torlinie: die Position wird auf den Schnittpunkt interpoliert, damit die Wertung
// nicht vom Zeitschritt abhängt. Dasselbe gilt für Zwischenzeiten (an der Torlinie der Zeit-Tore) und Zielzeit. Alle
// Zeiten im HUD sind „wirksame“ Zeiten: Laufzeit plus bisherige Strafen, so springt die Uhr beim Torfehler sichtbar
// und die Zwischenzeit sagt, ob man den besten Lauf wirklich schlägt.
import { C } from './constants.js';
import { laneX, mulberry32 } from './world.js';

const SALT = 0x5347; // „SG“: eigener Zufallsstrom für die Tore, unabhängig von der Welt
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Torlauf-Modi: welche Konstanten (Namen in constants.js) für welchen Modus gelten. Gelesen wird immer frisch aus C
// (cv), so wirken die Regler im Tuning-Panel sofort und pro Schritt entsteht kein neues Objekt.
// single: nur eine Kippstange je Tor, außen vorbei; die Ideallinie dazu rechnet guideX.
// fence: Fangzaun am Pistenrand (fence.js). funnel: nur der Trichter zum Zielbogen auf den letzten Metern, ohne Zaun an
// der Strecke (fence.js fenceAt). rhythm: Abschnitte mit eigenem Torabstand und Versatz. ramp, boost: Starthügel
// (game.js startBoost). house: Starthaus (start-house.js). stadium: Zielstadion (stadium.js). atGate: das Stadion
// steht unter dem letzten Tor statt auf der Pistenmitte (createCourse, arenaX). ad: Name auf den Werbebanden.
// Der Super-G hat Starthaus und Stadion, aber keinen Starthügel: der Schub machte die Zeiten schneller, und das
// Stadion steht dort, wo jede Linie durchs letzte Tor ohnehin hinführt. So bleiben die Bestzeiten vergleichbar.
export const COURSES = {
  superg: {
    finishM: 'SG_FINISH_M', seed: 'SG_SEED', first: 'SG_GATE_FIRST_M', spacing: 'SG_GATE_SPACING_M',
    width: 'SG_GATE_WIDTH_M', offset: 'SG_GATE_OFFSET_M', jitter: 'SG_GATE_JITTER', lastGap: 'SG_LAST_GATE_GAP_M',
    laneAmp: 'SG_LANE_AMP_M', laneWave: 'SG_LANE_WAVE_M', pisteHalf: 'SG_PISTE_HALF_M', penalty: 'SG_PENALTY_S',
    poleKmh: 'SG_POLE_KMH', maxKmh: 'SG_MAX_SPEED_KMH', boardKmh: 'BOARD_SG_MAX_AVG_KMH',
    splitFirst: 'SG_SPLIT_FIRST', splitEvery: 'SG_SPLIT_EVERY', splitFreeLast: 'SG_SPLIT_FREE_LAST',
    rhythm: null, single: false, fence: false, funnel: 'SG_FUNNEL_M', ramp: null, boost: null, house: true,
    stadium: true, atGate: true, ad: 'SUPER-G',
  },
  slalom: {
    finishM: 'SL_FINISH_M', seed: 'SL_SEED', first: 'SL_GATE_FIRST_M', spacing: 'SL_GATE_SPACING_M',
    width: null, offset: 'SL_POLE_OFFSET_M', jitter: 'SL_GATE_JITTER', lastGap: 'SL_LAST_GATE_GAP_M',
    laneAmp: 'SL_LANE_AMP_M', laneWave: 'SL_LANE_WAVE_M', pisteHalf: 'SL_PISTE_HALF_M', penalty: 'SL_PENALTY_S',
    poleKmh: 'SL_POLE_KMH', maxKmh: 'SL_MAX_SPEED_KMH', boardKmh: 'BOARD_SL_MAX_AVG_KMH',
    splitFirst: 'SL_SPLIT_FIRST', splitEvery: 'SL_SPLIT_EVERY', splitFreeLast: 'SL_SPLIT_FREE_LAST',
    rhythm: 'SL_RHYTHM', single: true, fence: true, funnel: null, ramp: 'SL_START_RAMP_M', boost: 'SL_START_BOOST',
    house: true, stadium: true, atGate: false, ad: 'SLALOM',
  },
};
export const courseOf = (mode) => COURSES[mode] || null;
export const cv = (spec, key) => C[spec[key]];

// Rhythmus (Slalom, SL_RHYTHM): Faktoren [Abstand, Versatz] des Abschnitts, in dem y liegt; ohne Tabelle 1
function rhythmAt(spec, y) {
  const table = spec.rhythm ? C[spec.rhythm] : null;
  let sp = 1, off = 1;
  if (table) for (const [from, fs, fo] of table) if (y >= from) { sp = fs; off = fo; }
  return [sp, off];
}

// Anteil eines Schritts von prevY nach y bis zur Linie lineY (die Bewegung im Schritt ist geradlinig); ohne Vortrieb 1.
// Auch das Duell wertet seine Zielweite damit (game.js).
export function crossFrac(prevY, y, lineY) {
  const dy = y - prevY;
  return dy > 0 ? clamp((lineY - prevY) / dy, 0, 1) : 1;
}

export function createCourse(seed, w, spec = COURSES.superg) {
  const rng = mulberry32((seed ^ SALT) >>> 0);
  const gates = [];
  const finishY = cv(spec, 'finishM');
  const lastY = finishY - cv(spec, 'lastGap');
  // Kein Tor auf dem Schriftzug bei SIGN_Y_M: wer in den Streifen fiele, rückt darunter
  const bandLo = C.SIGN_Y_M - C.SIGN_BAND_M - 3, bandHi = C.SIGN_Y_M + C.SIGN_BAND_M + 3;
  const half = spec.single ? 0 : cv(spec, 'width') / 2;
  let side = rng() < 0.5 ? -1 : 1;
  let y = cv(spec, 'first'), prevOff = Infinity;
  for (let i = 0; y <= lastY; i++) {
    if (y > bandLo && y < bandHi) y = bandHi;
    const k = 1 - cv(spec, 'jitter') * rng();
    const [fSpace, offHere] = rhythmAt(spec, y);
    // Am Wechsel zweier Abschnitte zählt der kleinere Versatz: der Abstand zu dieser Stange stammt noch aus dem
    // alten Abschnitt, ein weiter Versatz nach engem Abstand (oder umgekehrt) gäbe einen Knick im Rhythmus
    const fOff = Math.min(offHere, prevOff);
    prevOff = offHere;
    const x = laneX(w, y) + side * cv(spec, 'offset') * fOff * k; // Tormitte; im Slalom steht hier die Kippstange
    const red = i % 2 === 0;
    // Render-Objekte je Tor, einmal angelegt: drawWorld sortiert sie mit dem Fahrer nach y
    // wob: Sekunden seit dem Treffer (-1 = steht), wdir: Richtung, in die sie kippt (render.js)
    const pole = (px, dir) => ({ pole: true, kipp: !!spec.single, x: px, y, red, dir, wob: -1, wdir: 1 });
    const poles = spec.single ? [pole(x, side)] : [pole(x - half, -1), pole(x + half, 1)];
    // Berührungspunkte: im Slalom die Kippstange, im Super-G je Seite ein Panel aus zwei Stangen (die innere an der
    // Durchfahrt, die äußere SG_FLAG_W_M weiter außen am Ende des Fähnchens). Reihenfolge: links innen, links außen,
    // rechts innen, rechts außen.
    const touch = spec.single
      ? [{ x, pole: poles[0], hit: false }]
      : [-1, 1].flatMap((sd, n) => [0, C.SG_FLAG_W_M].map((out) => ({ x: x + sd * (half + out), pole: poles[n], hit: false })));
    gates.push({
      i, y, x, half, red, single: !!spec.single,
      side,                   // Seite der Pistenmitte (1 rechts): die Innenstange ist die zur Mitte hin (render.js, Markierung)
      split: -1,              // Index der Zwischenzeit, die an diesem Tor genommen wird, sonst -1
      state: 0,               // 0 offen, 1 durchfahren, 2 verpasst
      touch, poles,
    });
    side = -side;
    y += cv(spec, 'spacing') * fSpace;
  }
  // Zwischenzeit-Tore: jedes splitEvery-te ab splitFirst, kurz vor dem Ziel keins mehr
  for (let n = cv(spec, 'splitFirst') - 1, i = 0; n < gates.length - cv(spec, 'splitFreeLast'); n += cv(spec, 'splitEvery')) gates[n].split = i++;
  return {
    gates, finishY, spec,
    guide: spec.single ? guideOf(gates, w, finishY) : null, // Slalom: Stützpunkte der Ideallinie (guideX)
    // Mitte von Zielbogen und Stadion (stadium.js, Trichter in fence.js): Super-G unter der Mitte des letzten Tors,
    // wer dort durchfährt und geradeaus weiter, trifft den Bogen; Slalom auf der Pistenmitte an der Ziellinie
    arenaX: spec.atGate && gates.length ? gates[gates.length - 1].x : laneX(w, finishY),
    fence: null,              // Beule im Fangzaun (fence.js), im Super-G nur am Trichter
    next: 0,                  // Index des nächsten offenen Tors
    misses: 0, penalty: 0,    // verpasste Tore und Strafe in s
    hits: 0,                  // berührte Stangen
    splits: [],               // wirksame Zwischenzeiten in Hundertstel
    finished: false, time: 0, total: 0, // Ziel: reine Laufzeit und Gesamtzeit (mit Strafen) in s
    note: null,               // HUD-Hinweis { kind: 'miss' | 'fast' | 'slow' | 'split', value, t }
    wobbling: [],             // getroffene Stangen, deren Schwingung noch läuft
  };
}

// Ideallinie (Slalom): vom Start durch einen Punkt außen neben jeder Kippstange (SL_LINE_CLEAR_M Abstand) bis ins
// Ziel. Zwischen zwei Stützpunkten läuft sie als halbe Kosinuswelle: an jeder Stange liegt der Scheitel des Schwungs,
// dort zeigt sie in die Falllinie, dazwischen wechselt sie weich die Seite. Nach der letzten Stange geradeaus.
function guideOf(gates, w, finishY) {
  const pts = [{ x: laneX(w, 0), y: 0 }];
  for (const gt of gates) pts.push({ x: gt.x + gt.side * C.SL_LINE_CLEAR_M, y: gt.y });
  pts.push({ x: pts[pts.length - 1].x, y: finishY });
  return pts;
}

// x der Ideallinie bei y (zwischen Start und Ziel), für das Bild (guide-line.js, start-house.js) und die Simulation
export function guideX(cs, y) {
  const pts = cs.guide;
  if (!pts) return 0;
  if (y <= pts[0].y) return pts[0].x;
  let lo = 0, hi = pts.length - 1;
  if (y >= pts[hi].y) return pts[hi].x;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid].y <= y) lo = mid; else hi = mid; }
  const a = pts[lo], b = pts[hi];
  const f = (y - a.y) / (b.y - a.y);
  return a.x + (b.x - a.x) * 0.5 * (1 - Math.cos(Math.PI * f));
}

// Zeit laufen lassen, ohne zu werten: HUD-Hinweis und schwingende Stangen. Läuft auch im Auslauf nach dem Ziel
// (game.js), damit eine kurz vor dem Ziel getroffene Stange nicht einfriert.
export function tickCourse(cs, dt) {
  if (cs.note) cs.note.t += dt;
  for (let i = cs.wobbling.length - 1; i >= 0; i--) {
    const p = cs.wobbling[i];
    p.wob += dt;
    if (p.wob >= C.SG_POLE_WOBBLE_S) { p.wob = -1; cs.wobbling.splice(i, 1); }
  }
}

// Zwischenzeit i an ihrem Tor: wirksame Zeit t (mit Strafen, ein verpasstes Zeit-Tor zählt schon mit) gegen die des
// besten Laufs. Der Hinweis ersetzt einen Torfehler-Hinweis im selben Tor, die Strafe steckt ja in der Zeit.
function split(cs, i, t, bestSplits, on) {
  const cs100 = Math.round(t * 100);
  cs.splits[i] = cs100;
  const best = bestSplits && bestSplits[i] > 0 ? bestSplits[i] : 0;
  const diff = best ? (cs100 - best) / 100 : 0;
  cs.note = best ? { kind: diff > 0 ? 'slow' : 'fast', value: diff, t: 0 } : { kind: 'split', value: t, t: 0 };
  if (on) on('split', { i, t, diff, best });
}

// Ein Physik-Schritt ist gelaufen: (prevX, prevY) ist die Position davor, s die danach, runT die Laufzeit nach
// dem Schritt. on(type, data) meldet gate (ok oder verpasst), pole (Berührung) und split (Zwischenzeit).
// Gibt true zurück, wenn das Ziel in diesem Schritt gekreuzt wurde.
export function updateCourse(cs, s, prevX, prevY, runT, dt, bestSplits, on) {
  tickCourse(cs, dt);
  if (cs.finished) return false;
  const at = (lineY) => crossFrac(prevY, s.y, lineY);

  // Torlinien in Reihenfolge werten, sobald der Fahrer sie erreicht hat
  while (cs.next < cs.gates.length && s.y >= cs.gates[cs.next].y) {
    const gt = cs.gates[cs.next];
    const f = at(gt.y);
    const xc = prevX + (s.x - prevX) * f;
    // Slalom: außen an der Kippstange vorbei (von der Pistenmitte weg), sonst zwischen den beiden Stangen durch
    const ok = gt.single ? (xc - gt.x) * gt.side >= 0 : Math.abs(xc - gt.x) <= gt.half;
    gt.state = ok ? 1 : 2;
    if (!ok) {
      const pen = cv(cs.spec, 'penalty');
      cs.misses++;
      cs.penalty += pen;
      cs.note = { kind: 'miss', value: pen, t: 0 };
    }
    if (on) on('gate', { ok, i: gt.i });
    if (gt.split >= 0) split(cs, gt.split, runT - dt * (1 - f) + cs.penalty, bestSplits, on);
    cs.next++;
  }

  // Stangen berühren: nur beim zuletzt gewerteten und beim nächsten Tor, je Berührungspunkt einmal (createCourse,
  // touch). Jede Berührung kostet Tempo; getroffen schwingt die Stange oder das Panel der Seite.
  const rr = C.SKIER_R + C.SG_POLE_R;
  for (let k = Math.max(0, cs.next - 1); k <= Math.min(cs.gates.length - 1, cs.next); k++) {
    const gt = cs.gates[k];
    if (Math.abs(gt.y - s.y) > 2) continue;
    for (let n = 0; n < gt.touch.length; n++) {
      const tp = gt.touch[n];
      if (tp.hit) continue;
      const px = tp.x;
      const ddx = px - s.x, ddy = gt.y - s.y;
      if (ddx * ddx + ddy * ddy >= rr * rr) continue;
      tp.hit = true;
      cs.hits++;
      s.v = Math.max(0, s.v - cv(cs.spec, 'poleKmh') / 3.6);
      // Stange kippt vom Fahrer weg und schwingt (render.js zeichnet sie nach wob und wdir)
      const pole = tp.pole;
      pole.wdir = s.x < px ? 1 : -1;
      if (pole.wob < 0) cs.wobbling.push(pole);
      pole.wob = 0;
      if (on) on('pole', { x: px, y: gt.y, kipp: gt.single });
    }
  }

  // Ziel
  if (s.y >= cs.finishY) {
    cs.time = runT - dt * (1 - at(cs.finishY));
    cs.total = cs.time + cs.penalty;
    cs.finished = true;
    cs.note = null;
    return true;
  }
  return false;
}
