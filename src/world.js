// Unendlicher Hang aus 40-m-Zellen. Deterministisch pro Seed, mit unsichtbarem Safe-Lane-Korridor.
// Super-G gibt der Welt eine flachere Korridor-Mitte (lane) und eine hindernisfreie Piste darum (pisteHalf) mit.
// Jede Zelle hängt nur von Seed, Zellkoordinate und Konstanten ab, nicht davon, in welcher Reihenfolge die Zellen
// entstehen: zwei Geräte mit gleichem Seed sehen exakt dieselben Bäume, egal wie breit ihre Sicht ist, wie sie
// fahren oder was zwischendurch verworfen wurde (Duell). Bis v0.21.0 wurde der Mindestabstand gegen die gerade
// vorhandenen Nachbarzellen geprüft, dadurch wichen rund 0,1 % der Hindernisse zwischen Geräten ab.
import { C } from './constants.js';
import { TREE, ROCK } from './physics.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

function hash32(seed, cx, cy) {
  let h = (seed ^ Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorld(seed, opts = {}) {
  const rng = mulberry32(seed);
  const phase = rng() * TAU, phase2 = rng() * TAU;
  return {
    seed, cells: new Map(), objCount: 0,
    raw: new Map(), // rohe Kandidaten je Zelle (rawCell), auch für Nachbarn, die noch nicht im Bild sind
    phase: opts.phase ?? phase, phase2,
    // Korridor-Mitte: zwei überlagerte Sinuswellen; Super-G nur die flache erste, damit die Tore fahrbar bleiben
    lane: opts.lane || { amp: C.LANE_AMP, wave: C.LANE_WAVELENGTH, amp2: 6, wave2: 97 },
    pisteHalf: opts.pisteHalf || 0, // > 0: so weit ist die Piste um die Mitte frei von Hindernissen (Super-G)
    cx0: NaN, cx1: NaN, cy0: NaN, cy1: NaN, // zuletzt sichergestellter Zellbereich (ensureCells)
  };
}

// Mittellinie des garantiert freien Korridors.
export function laneX(w, y) {
  const l = w.lane;
  return l.amp * Math.sin((TAU * y) / l.wave + w.phase) + l.amp2 * Math.sin((TAU * y) / l.wave2 + w.phase2);
}
export function laneHalf(y) {
  return lerp(C.LANE_HALF0, C.LANE_HALF1, clamp(y / C.RAMP_M, 0, 1));
}
function density(y) {
  const d = lerp(C.TREE_D0, C.TREE_D1, clamp(y / C.RAMP_M, 0, 1));
  return y < C.START_EASY_M ? d * C.START_EASY_FACTOR : d;
}
function rockFrac(y) {
  return lerp(C.ROCK_FRAC0, C.ROCK_FRAC1, clamp(y / C.RAMP_M, 0, 1));
}

const key = (cx, cy) => cx + ',' + cy;

// Rohe Kandidaten einer Zelle, nur aus Seed und Zellkoordinate: Mindestabstand allein innerhalb der Zelle. Erzeugt
// CELL_RAW_EXTRA-fach mehr als das Soll, weil genCell an den Zellgrenzen noch Kandidaten streicht; ohne den
// Überschuss läge die Dichte rund 4 % unter dem Soll.
function rawCell(w, cx, cy) {
  const k = key(cx, cy);
  const cached = w.raw.get(k);
  if (cached) return cached;
  const rng = mulberry32(hash32(w.seed, cx, cy));
  const size = C.CELL_M;
  const x0 = cx * size;
  const y0 = cy * size;
  const yMid = y0 + size / 2;
  const total = Math.round(density(yMid) * size * size);
  const cap = Math.ceil(total * C.CELL_RAW_EXTRA);
  const rf = rockFrac(yMid);
  const objs = [];
  const minD2 = C.MIN_SPACING_M * C.MIN_SPACING_M;
  let attempts = cap * 3;
  while (objs.length < cap && attempts-- > 0) {
    const x = x0 + rng() * size;
    const y = y0 + rng() * size;
    const isRock = rng() < rf;
    const r = isRock ? 0.5 + rng() * 0.3 : 0.7 + rng() * 0.3;
    const variant = (rng() * 3) | 0;
    const h = isRock ? 0.8 + rng() * 0.6 : 2.0 + rng() * 1.2;
    if (x * x + y * y < C.START_CLEAR_M * C.START_CLEAR_M) continue;
    if (Math.abs(y - C.SIGN_Y_M) < C.SIGN_BAND_M) continue; // Schriftzug: kein Hindernis im ganzen Streifen
    if (Math.abs(y - C.EVEREST_Y_M) < C.SIGN_BAND_M) continue; // Gipfelschild ebenso
    if (Math.abs(x - laneX(w, y)) < laneHalf(y) + r) continue;
    if (w.pisteHalf > 0 && Math.abs(x - laneX(w, y)) < w.pisteHalf + r) continue; // Super-G: freie Piste
    let ok = true;
    for (let i = 0; i < objs.length && ok; i++) {
      const o = objs[i];
      const ddx = o.x - x, ddy = o.y - y;
      if (ddx * ddx + ddy * ddy < minD2) ok = false;
    }
    if (!ok) continue;
    objs.push({ t: isRock ? ROCK : TREE, x, y, r, variant, h });
  }
  const cell = { cx, cy, total, objs };
  w.raw.set(k, cell);
  return cell;
}

// Fertige Zelle: die rohen Kandidaten, gekürzt um alles, was einem rohen Kandidaten eines Vorrang-Nachbarn zu nahe
// kommt. Vorrang haben die vier Nachbarn, die in der Reihenfolge (cy, cx) vor dieser Zelle liegen; die vier anderen
// weichen umgekehrt dieser Zelle aus. So hält jedes Paar benachbarter Zellen den Mindestabstand, und das Ergebnis
// hängt nicht davon ab, welche Nachbarn schon existieren. Gekappt wird auf das Soll der Zelle.
function genCell(w, cx, cy) {
  const raw = rawCell(w, cx, cy);
  const prior = [rawCell(w, cx - 1, cy - 1), rawCell(w, cx, cy - 1), rawCell(w, cx + 1, cy - 1), rawCell(w, cx - 1, cy)];
  const minD2 = C.MIN_SPACING_M * C.MIN_SPACING_M;
  const objs = [];
  for (let n = 0; n < raw.objs.length && objs.length < raw.total; n++) {
    const o = raw.objs[n];
    let ok = true;
    for (let k = 0; k < prior.length && ok; k++) {
      const arr = prior[k].objs;
      for (let i = 0; i < arr.length; i++) {
        const ddx = arr[i].x - o.x, ddy = arr[i].y - o.y;
        if (ddx * ddx + ddy * ddy < minD2) { ok = false; break; }
      }
    }
    if (ok) objs.push(o);
  }
  const cell = { cx, cy, objs };
  w.cells.set(key(cx, cy), cell);
  return cell;
}

// Erzeugt alle Zellen im (um eine Zelle erweiterten) Sichtbereich und wirft entfernte weg.
export function ensureCells(w, xMin, xMax, yMin, yMax) {
  const size = C.CELL_M;
  const cx0 = Math.floor(xMin / size) - 1;
  const cx1 = Math.floor(xMax / size) + 1;
  const cy0 = Math.floor(yMin / size) - 1;
  const cy1 = Math.floor(yMax / size) + 1;
  // Der Aufruf kommt aus jedem Physikschritt (game.js ensureView); solange der Zellbereich derselbe ist, gibt es
  // nichts zu tun, und die Schlüssel-Strings und die Iteration über alle Zellen entfallen
  if (cx0 === w.cx0 && cx1 === w.cx1 && cy0 === w.cy0 && cy1 === w.cy1) return;
  w.cx0 = cx0; w.cx1 = cx1; w.cy0 = cy0; w.cy1 = cy1;
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (!w.cells.has(key(cx, cy))) genCell(w, cx, cy);
    }
  }
  const m = C.CULL_CELLS;
  let n = 0;
  for (const [k, cell] of w.cells) {
    if (cell.cx < cx0 - m || cell.cx > cx1 + m || cell.cy < cy0 - m || cell.cy > cy1 + m) w.cells.delete(k);
    else n += cell.objs.length;
  }
  // Rohe Kandidaten eine Zelle weiter behalten: die Nachbarn der Randzellen brauchen sie beim nächsten Schritt
  const mr = m + 1;
  for (const [k, cell] of w.raw) {
    if (cell.cx < cx0 - mr || cell.cx > cx1 + mr || cell.cy < cy0 - mr || cell.cy > cy1 + mr) w.raw.delete(k);
  }
  w.objCount = n;
}
