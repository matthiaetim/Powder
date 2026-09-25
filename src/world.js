// Unendlicher Hang aus 40-m-Zellen. Deterministisch pro Seed, mit unsichtbarem Safe-Lane-Korridor.
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

export function createWorld(seed) {
  const rng = mulberry32(seed);
  return { seed, cells: new Map(), phase: rng() * TAU, phase2: rng() * TAU, objCount: 0 };
}

// Mittellinie des garantiert freien Korridors.
export function laneX(w, y) {
  return C.LANE_AMP * Math.sin((TAU * y) / C.LANE_WAVELENGTH + w.phase) + 6 * Math.sin((TAU * y) / 97 + w.phase2);
}
function laneHalf(y) {
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

function genCell(w, cx, cy) {
  const rng = mulberry32(hash32(w.seed, cx, cy));
  const size = C.CELL_M;
  const x0 = cx * size;
  const y0 = cy * size;
  const yMid = y0 + size / 2;
  const total = Math.round(density(yMid) * size * size);
  const rf = rockFrac(yMid);
  const objs = [];
  const near = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const n = w.cells.get(key(cx + dx, cy + dy));
      if (n) near.push(n.objs);
    }
  }
  const minD2 = C.MIN_SPACING_M * C.MIN_SPACING_M;
  let attempts = total * 3;
  while (objs.length < total && attempts-- > 0) {
    const x = x0 + rng() * size;
    const y = y0 + rng() * size;
    const isRock = rng() < rf;
    const r = isRock ? 0.5 + rng() * 0.3 : 0.7 + rng() * 0.3;
    const variant = (rng() * 3) | 0;
    const h = isRock ? 0.8 + rng() * 0.6 : 2.0 + rng() * 1.2;
    if (x * x + y * y < C.START_CLEAR_M * C.START_CLEAR_M) continue;
    if (Math.abs(y - C.SIGN_Y_M) < C.SIGN_BAND_M) continue; // Schriftzug: kein Hindernis im ganzen Streifen
    if (Math.abs(x - laneX(w, y)) < laneHalf(y) + r) continue;
    let ok = true;
    for (let i = 0; i < objs.length && ok; i++) {
      const o = objs[i];
      const ddx = o.x - x, ddy = o.y - y;
      if (ddx * ddx + ddy * ddy < minD2) ok = false;
    }
    for (let k = 0; k < near.length && ok; k++) {
      const arr = near[k];
      for (let i = 0; i < arr.length; i++) {
        const o = arr[i];
        const ddx = o.x - x, ddy = o.y - y;
        if (ddx * ddx + ddy * ddy < minD2) { ok = false; break; }
      }
    }
    if (!ok) continue;
    objs.push({ t: isRock ? ROCK : TREE, x, y, r, variant, h });
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
  w.objCount = n;
}
