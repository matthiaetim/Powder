// Zielstadion (Slalom; stadium-view.js zeichnet es), Idee und erste Fassung von Jürgen. Bis zur Ziellinie bleibt die
// Piste beim Fangzaun, der sich auf den letzten Metern trichterförmig auf den Zielbogen verengt (fence.js halfAt). Erst
// hinter der Linie beginnt das Stadion: ein Zielraum von STAD_FIN_HALF_M je Seite zwischen Werbebanden, dahinter
// Stehplätze und Tribünen, unten geschlossen durch einen Halbkreis um (cx, yc). Der Fahrer gleitet nach dem Ziel
// hinein (glide) und macht den Hockeystop so, dass er in der Mitte des Runds steht (game.js coast, hockey.js).
// Reines Modul ohne DOM wie gates.js: Lage, Publikum, Stimmung (hype), La Ola, Blitzlichter und Konfetti. Eigener
// Zufallsstrom, Welt und Tore bleiben unberührt. Bäume und Felsen im Stadion räumt die Welt weg (clearsWorld).
import { C } from './constants.js';
import { laneX, mulberry32 } from './world.js';

const SALT = 0x5354; // „ST“
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const FAN_LOOKS = 12; // Fan-Typen (Jacke, Mütze; stadium-view.js baut sie)
export const FLAG_LOOKS = 4; // Fahnen in den Farben des Spiels

// Maße der Ränge, von innen nach außen: Bande, Stehplätze, Tribüne
export function rings() {
  const fin = C.STAD_FIN_HALF_M;
  const standIn = fin + C.STAD_WALL_M + 0.45;
  const tribIn = standIn + C.STAD_ROWS * C.STAD_ROW_M + C.STAD_TRIB_GAP_M;
  const tribOut = tribIn + C.STAD_TRIB_ROWS * C.STAD_TRIB_ROW_M;
  return { fin, standIn, tribIn, tribOut };
}

export function createStadium(cs, w) {
  const fy = cs.finishY, rg = rings();
  const st = {
    fy, cx: laneX(w, fy), // ab der Ziellinie läuft alles gerade
    yc: fy + C.STAD_BOWL_M, // Mittelpunkt des Runds, dort steht der Fahrer am Ende
    ...rg,
    y1: fy + C.STAD_BOWL_M + rg.tribOut + 1,
    fans: [],
    t: 0, hype: 0, finT: -1,
    olaOn: false, ola: 0, // La Ola: läuft gerade, Lage der Welle entlang der Ränge (−Breite bis 1 + Breite)
    olaN: 0, olaWait: C.STAD_OLA_AFTER_S, // gelaufene Wellen, Zeit bis zur nächsten
    gliding: true,        // Auslauf: gleiten bis zum Hockeystop
    flashes: [], confetti: [],
  };
  buildCrowd(st, (cs.gates.length * 7919 + Math.round(fy)) >>> 0);
  return st;
}

// Welt (world.js): Hindernisse im Stadion und im Trichter davor weglassen
export function clearsWorld(st, x, y, r) {
  if (y < st.fy - C.STAD_FUNNEL_M - 6 || y > st.y1 + 3) return false;
  if (y > st.yc) return Math.hypot(x - st.cx, y - st.yc) < st.tribOut + 4.5 + r; // Bäume ragen nach oben ins Bild
  return Math.abs(x - st.cx) < st.tribOut + 2.5 + r + (y < st.fy ? 4 : 0); // vor dem Ziel schwingt die Piste noch
}

// Lage entlang der Ränge für La Ola: 0 oben links, abwärts, unten herum, 1 oben rechts. side −1 links, 1 rechts,
// 0 im Rund (a: Winkel, 0 = rechts, π/2 = unten, π = links).
function alongOf(st, side, y, a) {
  const straight = C.STAD_BOWL_M, arc = Math.PI * st.standIn, total = 2 * straight + arc;
  if (side < 0) return (y - st.fy) / total;
  if (side > 0) return (straight + arc + (st.yc - y)) / total;
  return (straight + (Math.PI - a) * st.standIn) / total;
}

function buildCrowd(st, seed) {
  const rng = mulberry32((seed ^ SALT) >>> 0);
  const F = st.fans;
  // z: Höhe der Reihe über dem Schnee, die Tribüne steigt nach außen an; row: Reihe von innen
  const add = (x, y, z, row, side, a) => {
    if (rng() < C.STAD_EMPTY_P) return;
    const flag = rng() < C.STAD_FLAG_P ? (rng() * FLAG_LOOKS) | 0 : -1;
    F.push({ x, y, z, row, look: (rng() * FAN_LOOKS) | 0, ph: rng(), flag, u: alongOf(st, side, y, a), keen: 0.6 + 0.4 * rng() });
  };
  const rows = [];
  for (let r = 0; r < C.STAD_ROWS; r++) rows.push({ d: st.standIn + (r + 0.5) * C.STAD_ROW_M, z: 0, gap: C.STAD_SPACING_M, trib: false });
  for (let r = 0; r < C.STAD_TRIB_ROWS; r++) {
    rows.push({ d: st.tribIn + (r + 0.5) * C.STAD_TRIB_ROW_M, z: (r + 1) * C.STAD_TRIB_RISE_M, gap: C.STAD_SPACING_M, trib: true });
  }
  rows.forEach((rw, n) => {
    // gerade Ränge links und rechts, ab der Ziellinie; Gänge in der Tribüne alle STAD_AISLE_M
    for (const side of [-1, 1]) {
      for (let y = st.fy + 0.6 + rng() * 0.3; y < st.yc; y += rw.gap * (0.92 + 0.16 * rng())) {
        if (rw.trib && (y - st.fy) % C.STAD_AISLE_M < 1.1) continue;
        add(st.cx + side * (rw.d + (rng() - 0.5) * 0.12), y, rw.z, n, side, 0);
      }
    }
    // das Rund: dieselben Reihen im Halbkreis, Gänge bei 45°, 90° und 135°
    const step = rw.gap / rw.d;
    for (let a = step / 2; a < Math.PI; a += step * (0.92 + 0.16 * rng())) {
      if (rw.trib && [0.25, 0.5, 0.75].some((k) => Math.abs(a - k * Math.PI) * rw.d < 0.65)) continue;
      const rr = rw.d + (rng() - 0.5) * 0.12;
      add(st.cx + rr * Math.cos(a), st.yc + rr * Math.sin(a), rw.z, n, 0, a);
    }
  });
  // Zeichenreihenfolge: von hinten nach vorn, bei gleicher Höhe im Bild die äußere Reihe zuletzt
  F.sort((a, b) => a.y - b.y || a.row - b.row);
}

// Index des ersten Fans mit y >= y (fans ist nach y sortiert)
export function firstAt(st, y) {
  const F = st.fans;
  let lo = 0, hi = F.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (F[m].y < y) lo = m + 1; else hi = m; }
  return lo;
}

// Halbe Breite des Zielraums bei y (ab der Ziellinie): gerade, unten der Halbkreis
export function arenaHalf(st, y) {
  if (y <= st.yc) return st.fin;
  const dy = y - st.yc;
  return Math.sqrt(Math.max(0, st.fin * st.fin - dy * dy));
}

// Wie weit der Hockeystop aus dem Tempo v rutscht (hockey.js distAt bis zum Stand, hier ohne dessen Zustand)
export function stopDist(v) {
  const a = C.STOP_DECEL_MIN, b = C.STOP_DECEL_K;
  if (!(v > 0)) return 0;
  const T = Math.log(1 + (b * v) / a) / b;
  return ((v + a / b) / b) * (1 - Math.exp(-b * T)) - (a / b) * T;
}

// Auslauf nach dem Ziel, ein Schritt: der Fahrer richtet sich auf die Mitte des Runds aus und gleitet, etwas gebremst,
// aber nie langsamer als STAD_GLIDE_MIN, sonst käme ein langsamer Zieleinlauf nie an. Gibt true zurück, sobald der
// Rest genau für den Hockeystop reicht: dann übernimmt hockey.js.
export function glide(st, s, dt) {
  const dx = st.cx - s.x, dy = st.yc - s.y;
  const rest = Math.hypot(dx, dy);
  if (rest <= stopDist(s.v) + 0.05 || dy <= 0.3) { st.gliding = false; return true; }
  const aim = Math.atan2(dx, dy);
  s.theta += (aim - s.theta) * (1 - Math.exp(-dt / C.STAD_AIM_S));
  s.omega = 0;
  s.v = Math.max(Math.min(s.v, C.STAD_GLIDE_MIN), s.v - C.STAD_GLIDE_DECEL * dt);
  if (s.v < C.STAD_GLIDE_MIN) s.v = Math.min(C.STAD_GLIDE_MIN, s.v + 6 * dt);
  s.carve = Math.min(1, Math.abs(s.theta) / (Math.PI / 2));
  s.plowK *= Math.exp(-dt / C.PLOW_EASE_S);
  s.brake = 0;
  s.x += s.v * Math.sin(s.theta) * dt;
  s.y += s.v * Math.cos(s.theta) * dt;
  // Banden: der Zielraum ist eine Wand
  const h = arenaHalf(st, s.y) - C.SKIER_R - 0.05;
  if (Math.abs(s.x - st.cx) > h) s.x = st.cx + Math.sign(s.x - st.cx) * h;
  return false;
}

// Ein Schritt: Stimmung, La Ola, Blitzlichter und Konfetti
export function updateStadium(st, g, dt) {
  if (g.state === 'paused') return; // Pause: auch das Publikum steht
  const s = g.skier;
  st.t += dt;
  const finished = g.state === 'finished';
  if (finished && st.finT < 0) { st.finT = 0; celebrate(st); } else if (finished) st.finT += dt;
  // Stimmung: wächst mit der Nähe zum Ziel, im Ziel voll, danach bleibt sie hoch; vor dem Start und nach einem
  // Sturz ist es still
  let target = 0;
  if (finished) target = st.finT < C.STAD_PEAK_S ? 1 : 0.75;
  else if (g.state === 'running') target = 0.1 + 0.6 * Math.pow(clamp(1 - (st.fy - s.y) / C.STAD_HYPE_M, 0, 1), 2);
  st.hype += (target - st.hype) * (1 - Math.exp(-dt / (target > st.hype ? 0.35 : 1.2)));
  // La Ola: läuft nach dem Ziel um die Ränge, STAD_OLA_N Mal
  if (st.olaOn) {
    st.ola += dt / C.STAD_OLA_S;
    if (st.ola > 1 + C.STAD_OLA_W) { st.olaOn = false; st.olaN++; st.olaWait = C.STAD_OLA_PAUSE_S; }
  } else if (finished && st.olaN < C.STAD_OLA_N) {
    st.olaWait -= dt;
    if (st.olaWait <= 0) { st.olaOn = true; st.ola = -C.STAD_OLA_W; }
  }
  spawnFlashes(st, s, dt);
  for (let i = st.flashes.length - 1; i >= 0; i--) { st.flashes[i].t += dt; if (st.flashes[i].t >= C.STAD_FLASH_S) st.flashes.splice(i, 1); }
  stepConfetti(st.confetti, dt);
}

// Wie weit die Welle einen Fan gerade hochreißt, 0..1
export function olaLift(st, f) {
  if (!st.olaOn) return 0;
  const d = Math.abs(f.u - st.ola) / C.STAD_OLA_W;
  return d < 1 ? 0.5 * (1 + Math.cos(Math.PI * d)) : 0;
}

function spawnFlashes(st, s, dt) {
  if (s.y < st.fy - 60 || !st.fans.length) return;
  const burst = st.finT >= 0 && st.finT < 1.2 ? C.STAD_FLASH_FINISH * (1 - st.finT / 1.2) : 0;
  let n = (C.STAD_FLASH_BASE + C.STAD_FLASH_HYPE * st.hype + burst) * dt;
  while (n > 0) {
    if (n < 1 && Math.random() > n) break;
    n -= 1;
    if (st.flashes.length >= 60) break;
    const p = st.fans[(Math.random() * st.fans.length) | 0];
    st.flashes.push({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y, z: p.z + 1.2 + Math.random() * 0.2, t: 0, big: Math.random() < 0.25 });
  }
}

// Im Ziel: Konfetti aus den beiden Türmen des Zielbogens, schräg nach innen über den Zielraum
function celebrate(st) {
  for (const side of [-1, 1]) {
    const x0 = st.cx + side * (st.fin + 0.4), n = C.STAD_CONFETTI / 2;
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 1.2, sp = 5 + Math.random() * 9;
      st.confetti.push({
        x: x0, y: st.fy + 0.3, z: C.STAD_ARCH_H_M,
        vx: -side * sp * Math.cos(a) * 0.8, vy: sp * Math.sin(a) + 3 + Math.random() * 6, vz: 3 + Math.random() * 6,
        spin: Math.random() * TAU, spinV: (Math.random() - 0.5) * 22, ph: Math.random() * TAU,
        c: (Math.random() * 6) | 0, land: false,
      });
    }
  }
}

// Flugbahn mit Luftwiderstand; Konfetti flattert langsam herab und bleibt am Boden liegen
function stepConfetti(arr, dt) {
  const damp = Math.exp(-dt * 1.6);
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p.land) continue;
    p.vz = Math.max(-1.1, p.vz - 9.8 * dt);
    p.vx *= damp; p.vy *= damp;
    p.ph += dt * 7;
    p.x += (p.vx + Math.sin(p.ph) * 0.6) * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.spin += p.spinV * dt;
    if (p.z <= 0) { p.z = 0; p.land = true; }
  }
}

// Fliegt noch Konfetti oder läuft die Welle? Dann zeichnet main.js mit voller Bildrate weiter (game.js animating).
export function partying(st) {
  return st.finT >= 0 && (st.gliding || st.finT < C.STAD_PARTY_S || st.olaOn || st.olaN < C.STAD_OLA_N);
}
