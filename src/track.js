// Skispur als Ringpuffer: x, y, Normale (nx, ny), Carve-Stärke, Lücken-Flag, Pflugstellung.
import { C } from './constants.js';

const F = 7;

// total zählt alle je gepushten Punkte durch: head allein sagt nicht, ob seit dem letzten Bild 0 oder genau cap
// Punkte dazukamen. Der Renderer merkt sich total und holt sich nur die neuen Punkte (Radieren des Schriftzugs).
export function createTrack() {
  return { cap: C.TRACK_CAP, n: 0, head: 0, total: 0, data: new Float32Array(C.TRACK_CAP * F), pendingGap: true };
}

export function clearTrack(t) {
  t.n = 0;
  t.head = 0;
  t.total = 0;
  t.pendingGap = true;
}

export function pushTrack(t, x, y, nx, ny, w, plow) {
  const i = t.head * F;
  const d = t.data;
  d[i] = x; d[i + 1] = y; d[i + 2] = nx; d[i + 3] = ny; d[i + 4] = w; d[i + 5] = t.pendingGap ? 1 : 0; d[i + 6] = plow;
  t.pendingGap = false;
  t.head = (t.head + 1) % t.cap;
  t.total++;
  if (t.n < t.cap) t.n++;
}

// Älteste zuerst.
export function forEachTrackPoint(t, fn) {
  forEachRecentTrackPoint(t, t.n, fn);
}

// Nur die letzten count Punkte, älteste zuerst (auf die Füllung gekappt).
export function forEachRecentTrackPoint(t, count, fn) {
  const m = Math.min(count, t.n);
  const start = (t.head - m + t.cap) % t.cap;
  const d = t.data;
  for (let k = 0; k < m; k++) {
    const i = ((start + k) % t.cap) * F;
    fn(d[i], d[i + 1], d[i + 2], d[i + 3], d[i + 4], d[i + 5] > 0, d[i + 6]);
  }
}
