// Super-G: der Torlauf (Kurs) und seine Wertung. Reines Modul ohne DOM, damit eine Node-Simulation ihn
// durchrechnen kann. Die Tore stehen abwechselnd links und rechts der Pistenmitte (laneX der Welt, in Super-G
// eine flache Sinuskurve) und abwechselnd rot und blau. Gewertet wird beim Kreuzen der Torlinie: die Position
// wird auf den Schnittpunkt interpoliert, damit die Wertung nicht vom Zeitschritt abhängt. Dasselbe gilt für
// Zwischenzeiten und Zielzeit. Alle Zeiten im HUD sind „wirksame“ Zeiten: Laufzeit plus bisherige Strafen, so
// springt die Uhr beim Torfehler sichtbar und die Zwischenzeit sagt, ob man den besten Lauf wirklich schlägt.
import { C } from './constants.js';
import { laneX, mulberry32 } from './world.js';

const SALT = 0x5347; // „SG“: eigener Zufallsstrom für die Tore, unabhängig von der Welt
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function createCourse(seed, w) {
  const rng = mulberry32((seed ^ SALT) >>> 0);
  const gates = [];
  const finishY = C.SG_FINISH_M;
  const lastY = finishY - C.SG_LAST_GATE_GAP_M;
  // Kein Tor auf dem Schriftzug bei SIGN_Y_M: wer in den Streifen fiele, rückt darunter
  const bandLo = C.SIGN_Y_M - C.SIGN_BAND_M - 3, bandHi = C.SIGN_Y_M + C.SIGN_BAND_M + 3;
  const half = C.SG_GATE_WIDTH_M / 2;
  let side = rng() < 0.5 ? -1 : 1;
  let y = C.SG_GATE_FIRST_M;
  for (let i = 0; y <= lastY; i++) {
    if (y > bandLo && y < bandHi) y = bandHi;
    const k = 1 - C.SG_GATE_JITTER * rng();
    const x = laneX(w, y) + side * C.SG_GATE_OFFSET_M * k;
    const red = i % 2 === 0;
    gates.push({
      i, y, x, half, red,
      state: 0,               // 0 offen, 1 durchfahren, 2 verpasst
      hitL: false, hitR: false, // Stange schon berührt (zählt je Stange einmal)
      // zwei Render-Objekte je Tor, einmal angelegt: drawWorld sortiert sie mit dem Fahrer nach y
      poles: [{ pole: true, x: x - half, y, red, dir: -1 }, { pole: true, x: x + half, y, red, dir: 1 }],
    });
    side = -side;
    y += C.SG_GATE_SPACING_M;
  }
  return {
    gates, finishY,
    next: 0,                  // Index des nächsten offenen Tors
    misses: 0, penalty: 0,    // verpasste Tore und Strafe in s
    hits: 0,                  // berührte Stangen
    splits: [], splitNext: 0, // wirksame Zwischenzeiten in Hundertstel, Index der nächsten Marke
    finished: false, time: 0, total: 0, // Ziel: reine Laufzeit und Gesamtzeit (mit Strafen) in s
    note: null,               // HUD-Hinweis { kind: 'miss' | 'fast' | 'slow' | 'split', value, t }
  };
}

// Ein Physik-Schritt ist gelaufen: (prevX, prevY) ist die Position davor, s die danach, runT die Laufzeit nach
// dem Schritt. on(type, data) meldet gate (ok oder verpasst), pole (Berührung) und split (Zwischenzeit).
// Gibt true zurück, wenn das Ziel in diesem Schritt gekreuzt wurde.
export function updateCourse(cs, s, prevX, prevY, runT, dt, bestSplits, on) {
  if (cs.finished) return false;
  if (cs.note) cs.note.t += dt;
  const dy = s.y - prevY;
  // Anteil des Schritts bis zur Linie lineY (Bewegung im Schritt ist geradlinig)
  const at = (lineY) => (dy > 0 ? clamp((lineY - prevY) / dy, 0, 1) : 1);

  // Torlinien in Reihenfolge werten, sobald der Fahrer sie erreicht hat
  while (cs.next < cs.gates.length && s.y >= cs.gates[cs.next].y) {
    const gt = cs.gates[cs.next];
    const f = at(gt.y);
    const xc = prevX + (s.x - prevX) * f;
    const ok = Math.abs(xc - gt.x) <= gt.half;
    gt.state = ok ? 1 : 2;
    if (!ok) {
      cs.misses++;
      cs.penalty += C.SG_PENALTY_S;
      cs.note = { kind: 'miss', value: C.SG_PENALTY_S, t: 0 };
    }
    if (on) on('gate', { ok, i: gt.i });
    cs.next++;
  }

  // Stangen berühren: nur beim zuletzt gewerteten und beim nächsten Tor, je Stange einmal
  const rr = C.SKIER_R + C.SG_POLE_R;
  for (let k = Math.max(0, cs.next - 1); k <= Math.min(cs.gates.length - 1, cs.next); k++) {
    const gt = cs.gates[k];
    if (Math.abs(gt.y - s.y) > 2) continue;
    for (let side = 0; side < 2; side++) {
      const key = side === 0 ? 'hitL' : 'hitR';
      if (gt[key]) continue;
      const px = side === 0 ? gt.x - gt.half : gt.x + gt.half;
      const ddx = px - s.x, ddy = gt.y - s.y;
      if (ddx * ddx + ddy * ddy >= rr * rr) continue;
      gt[key] = true;
      cs.hits++;
      s.v = Math.max(0, s.v - C.SG_POLE_KMH / 3.6);
      if (on) on('pole', { x: px, y: gt.y });
    }
  }

  // Zwischenzeiten: wirksame Zeit (mit Strafen) gegen die des besten Laufs
  const marks = C.SG_SPLITS_M;
  while (cs.splitNext < marks.length && s.y >= marks[cs.splitNext]) {
    const i = cs.splitNext;
    const t = runT - dt * (1 - at(marks[i])) + cs.penalty;
    const cs100 = Math.round(t * 100);
    cs.splits.push(cs100);
    const best = bestSplits && bestSplits[i] > 0 ? bestSplits[i] : 0;
    const diff = best ? (cs100 - best) / 100 : 0;
    cs.note = best ? { kind: diff > 0 ? 'slow' : 'fast', value: diff, t: 0 } : { kind: 'split', value: t, t: 0 };
    if (on) on('split', { i, t, diff, best });
    cs.splitNext++;
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
