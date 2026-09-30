// Piste: die feste Strecke des Modus Piste. Reines Modul ohne DOM, damit eine Node-Simulation sie durchrechnen kann
// (tools/piste-sim.mjs). Die Strecke wird einmal je Lauf im Raster PISTE_STEP_M vorgerechnet: Stufe der
// Schwierigkeit (PISTE_PROFILE), dazu je Zweig (bis zu NL, von links nach rechts) Mitte, halbe Breite, Waldabstand,
// Stufe und Farbe. nl sagt je Meter, wie viele Zweige es gibt; die übrigen Tabellen tragen dort eine Kopie des
// letzten, damit jede Abfrage mit jedem Zweig-Index gültig bleibt. Alles hängt nur am Seed und an den Konstanten, die Piste ist also bei jedem
// Lauf dieselbe; Regler wirken ab dem nächsten Lauf.
// Die Mitte entsteht aus der Richtung der Piste: sie schwenkt in S-Kurven aus der Falllinie, an Schlüsselstellen
// weiter und in kürzeren Kurven. Aufsummiert ergibt das die Linie; ein schwacher Zug zur Hangmitte hält sie davon
// ab, seitlich davonzuwandern. Ziehweg und Steilkurve versetzen sie zusätzlich zur Seite.
// Der Wald daneben (worldOpts, für world.js) steht in Gruppen mit Lichtungen: ein weiches Zufallsmuster entscheidet,
// wo Bäume stehen. An Schlüsselstellen rückt er als Wand an den Rand (Schneise), im Raststück weicht er zurück.
// Was an der Strecke steht (PISTE_LAYOUT), wird hier zu festen Dingen mit Ort ausgerechnet: feats (alles, was im
// Bild steht, nach y sortiert), hits (Kreise, an denen man stürzt), trig (Linien quer zur Fahrt, die etwas auslösen:
// Absprung, Tor, Tempomessung), clears (Flächen ohne Bäume), npcs (andere Fahrer). Was sich im Lauf bewegt oder
// merkt, steht in piste-life.js, das Bild in piste-view.js.
import { C } from './constants.js';
import { mulberry32 } from './world.js';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const SALT = 0x5049; // „PI“: eigener Zufallsstrom für die Strecke, unabhängig von den Bäumen
const SALT_F = 0x464b; // und einer für alles, was an ihr steht
const ROW_M = 40; // freie Flächen sind in Streifen dieser Höhe einsortiert (clearAt)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
const ease = (t) => (1 - Math.cos(Math.PI * clamp(t, 0, 1))) / 2;
// 1 zwischen a und b, davor und dahinter über r weich auf 0
const plat = (y, a, b, r) => smooth((y - (a - r)) / r) * (1 - smooth((y - b) / r));

// Arten der Zweige einer Gabelung (PISTE_FORKS): die drei Farben, dazu Funpark (fährt wie rot) und Slalom (wie blau)
export const BLUE = 0, RED = 1, BLACK = 2, PARK = 3, SLALOM = 4;
export const gradeOfKind = (k) => (k === PARK ? RED : k === SLALOM ? BLUE : k);
export const NL = 3; // höchstens so viele Zweige nebeneinander
export const KICK_SMALL = 0, KICK_BIG = 1, KICK_ROLL = 2;

// Stufe 0..10 bei Meter y: die Stützpunkte des Profils weich verbunden, davor und dahinter der Randwert
export function profileAt(y, table = C.PISTE_PROFILE) {
  if (y <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [b, lb] = table[i];
    if (y <= b) {
      const [a, la] = table[i - 1];
      return lerp(la, lb, ease((y - a) / (b - a)));
    }
  }
  return table[table.length - 1][1];
}

const gradeOf = (lv) => (lv < C.PISTE_BLUE_TO ? BLUE : lv < C.PISTE_RED_TO ? RED : BLACK);

export function createPiste(seed) {
  const step = C.PISTE_STEP_M, pad = C.PISTE_PAD_M, fin = C.PISTE_FINISH_M;
  const y0 = -pad, n = Math.ceil((fin + 2 * pad) / step) + 1;
  const f32 = () => new Float32Array(n), u8 = () => new Uint8Array(n);
  const lanes = (mk) => Array.from({ length: NL }, mk);
  const p = {
    seed, step, y0, n, finishY: fin,
    level: f32(), ramp: f32(), nl: u8(),
    // je Zweig (0 links … NL−1 rechts): Mitte, halbe Breite, Waldabstand, Stufe, Farbe
    cx: lanes(f32), half: lanes(f32), edge: lanes(f32), lv: lanes(f32), grade: lanes(u8),
    forks: [], feats: [], hits: [], trig: [], clears: [], clearRows: new Map(), npcs: [], lifts: [], banks: [], paths: [],
    gates: [], kicks: [], traps: [], tracks: [],
  };
  const rng = mulberry32((seed ^ SALT) >>> 0);
  // Kurvenlänge abschnittsweise gestreckt oder gestaucht: Zufallswerte alle 300 m, dazwischen weich
  const KNOT = 300;
  const knots = Array.from({ length: Math.ceil((fin + 2 * pad) / KNOT) + 2 }, () => rng() * 2 - 1);
  const jitter = (y) => {
    const u = (y - y0) / KNOT, i = Math.floor(u);
    return lerp(knots[i], knots[i + 1], ease(u - i));
  };
  const rf = mulberry32((seed ^ SALT_F) >>> 0);
  const lay = C.PISTE_LAYOUT;
  // 'L', 'M', 'R' im Layout: linker, mittlerer, rechter Zweig der Gabelung
  const laneIdx = (it, fk) => (it.lane === 'R' ? fk.lanes - 1 : it.lane === 'M' ? 1 : 0);

  // Gabelungen, Zonen mit eigener Breite und seitliche Versätze stehen fest, bevor die Tabellen entstehen
  for (const [fy, len, ...kinds] of C.PISTE_FORKS) {
    p.forks.push({
      y0: fy, y1: fy + len, kinds, grades: kinds.map(gradeOfKind), lanes: kinds.length, ph: kinds.map(() => rf() * TAU),
      tipY: fy, signs: [], n: p.forks.length,
    });
  }
  const forkAt = (y) => { for (const f of p.forks) if (y >= f.y0 && y <= f.y1) return f; return null; };
  // Versätze (detours) gelten für alle Zweige (lane −1) oder nur einen: die Steilkurve des Funparks versetzt nur ihn
  // und wandert vor dem Ende seines Zweigs (back0 bis back1) wieder zurück, sonst trüge ein Zweig-Index den Versatz
  // in jede spätere Gabelung. Der Ziehweg versetzt die ganze Piste, der Zug zur Hangmitte holt sie zurück.
  const zones = [], detours = [];
  for (const it of lay) {
    const fk = forkAt(it.y), lane = fk ? laneIdx(it, fk) : -1;
    if (it.k === 'park') {
      const y1 = it.y + C.PISTE_PARK_AT_M[3] + C.PISTE_BANK_LEN_M;
      const back0 = Math.max(y1 + 10, fk.y1 - C.PISTE_FORK_RAMP_M - 60);
      detours.push({ y0: it.y + C.PISTE_PARK_AT_M[3], y1, dx: C.PISTE_BANK_DX_M, lane, back0, back1: back0 + 80 });
    } else if (it.k === 'gates') {
      const ti = it.type === 'sl' ? 1 : 0;
      zones.push({ y0: it.y - 50, y1: it.y + (it.n - 1) * C.PISTE_GATE_GAP_M[ti] + 40, half: C.PISTE_GATE_HALF_M[ti], ramp: 50, lane });
    } else if (it.k === 'kicker' && it.big) {
      zones.push({ y0: it.y - 60, y1: it.y + 110, half: C.PISTE_KICK_W_M[KICK_BIG] / 2 + 3.5, ramp: 50, lane });
    } else if (it.k === 'ziehweg') {
      zones.push({ y0: it.y, y1: it.y + it.len, half: C.PISTE_PATH_HALF_M, ramp: 50, lane: -1, force: true, lv: 6, edge: 1.3 });
      detours.push({ y0: it.y, y1: it.y + it.len, dx: it.dx, lane: -1, back0: 0, back1: 0 }); // ohne Rückkehr
      p.paths.push({ y0: it.y - 25, y1: it.y + it.len + 25 });
    }
  }

  let x = 0, phase = rng() < 0.5 ? 0 : Math.PI; // die erste Kurve geht mal nach links, mal nach rechts: fest je Seed
  for (let i = 0; i < n; i++) {
    const y = y0 + i * step;
    const lv = profileAt(y), L = lv / 10;
    p.level[i] = lv;
    const fk = forkAt(y), nl = fk ? fk.lanes : 1;
    const k = fk ? plat(y, fk.y0 + C.PISTE_FORK_RAMP_M, fk.y1 - C.PISTE_FORK_RAMP_M, C.PISTE_FORK_RAMP_M) : 0;
    p.ramp[i] = k;
    p.nl[i] = nl;
    const gap = nl === 2 ? 2 * C.PISTE_FORK_SEP_M : C.PISTE_FORK_GAP3_M;
    for (let l = 0; l < NL; l++) {
      const ll = Math.min(l, nl - 1); // Zweige, die es hier nicht gibt, kopieren den letzten
      let c = x, h = lerp(C.PISTE_HALF_EASY_M, C.PISTE_HALF_HARD_M, L) * C.PISTE_WIDTH_K, e = lerp(C.PISTE_EDGE_EASY_M, C.PISTE_EDGE_HARD_M, L);
      for (const d of detours) if (d.lane < 0 || d.lane === ll) c += d.dx * (smooth((y - d.y0) / (d.y1 - d.y0)) - (d.back1 > d.back0 ? smooth((y - d.back0) / (d.back1 - d.back0)) : 0));
      let lvl = lv, grade = gradeOf(lv);
      if (fk) {
        const g = fk.kinds[ll];
        c += (ll - (nl - 1) / 2) * gap * k + C.PISTE_LANE_WIG_M[g] * Math.sin((TAU * y) / C.PISTE_LANE_WAVE_M[g] + fk.ph[ll]) * k;
        h = lerp(h, C.PISTE_LANE_HALF_M[g] * C.PISTE_WIDTH_K, k);
        e = lerp(e, C.PISTE_LANE_EDGE_M[g], k);
        lvl = lerp(lvl, C.PISTE_LANE_LEVEL[g], k);
        grade = fk.grades[ll];
      }
      for (const z of zones) {
        if (z.lane >= 0 && z.lane !== ll) continue;
        const kz = plat(y, z.y0, z.y1, z.ramp);
        if (kz <= 0) continue;
        h = z.force ? lerp(h, z.half, kz) : Math.max(h, lerp(h, z.half, kz));
        if (z.lv != null) lvl = lerp(lvl, z.lv, kz);
        if (z.edge != null) e = lerp(e, z.edge, kz);
      }
      p.cx[l][i] = c; p.half[l][i] = h; p.edge[l][i] = e; p.lv[l][i] = lvl; p.grade[l][i] = grade;
    }
    if (y < 0) continue; // oberhalb des Starts läuft die Piste gerade
    // gerade Anfahrt und gerader Zieleinlauf: die Kurven blenden weich ein und vor dem Ziel wieder aus
    const kc = smooth((y - 20) / 80) * (1 - smooth((y - (fin - 90)) / 70));
    const turn = lerp(C.PISTE_TURN_EASY_DEG, C.PISTE_TURN_HARD_DEG, L) * D2R;
    const wave = lerp(C.PISTE_WAVE_EASY_M, C.PISTE_WAVE_HARD_M, L) * (1 + C.PISTE_WAVE_JITTER * jitter(y));
    x += (Math.tan(turn * Math.sin(phase) * kc) - x / C.PISTE_HOME_M) * step;
    phase += (TAU / wave) * step;
  }
  build(p, rf, forkAt, laneIdx);
  return p;
}

// ---------- Abfragen ----------

// Wert aus einer der Tabellen bei Meter y, zwischen den Rasterpunkten gerade verbunden
function at(p, arr, y) {
  const u = clamp((y - p.y0) / p.step, 0, p.n - 1), i = Math.min(p.n - 2, Math.floor(u));
  return arr[i] + (arr[i + 1] - arr[i]) * (u - i);
}
const row = (p, y) => clamp(Math.round((y - p.y0) / p.step), 0, p.n - 1);

export const centerAt = (p, y, lane = 0) => at(p, p.cx[lane], y);
export const halfAt = (p, y, lane = 0) => at(p, p.half[lane], y);
export const edgeAt = (p, y, lane = 0) => at(p, p.edge[lane], y);
export const levelAt = (p, y) => at(p, p.level, y);
export const gradeAt = (p, y, lane = 0) => p.grade[lane][row(p, y)];
export const lanesAt = (p, y) => p.nl[row(p, y)];
export const forkedAt = (p, y) => p.nl[row(p, y)] > 1;

// In welchem Zweig liegt x? Außerhalb der Gabelungen immer 0, sonst der, dessen Rand am nächsten ist (auf der Piste
// negativer Abstand): so gehört der Wald zwischen zwei Zweigen zum näheren, auch wenn die Zweige verschieden breit sind.
export function laneOf(p, x, y) {
  const n = p.nl[row(p, y)];
  if (n === 1) return 0;
  let best = 0, bd = Infinity;
  for (let l = 0; l < n; l++) {
    const d = Math.abs(x - at(p, p.cx[l], y)) - at(p, p.half[l], y);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

// Der Zweig, der x am nächsten liegt, mit Mitte, halber Breite, Waldabstand, Stufe und Farbe. Ohne out ein geteiltes
// Objekt (keine Allokation je Schritt): sofort auslesen.
const LANE = { lane: 0, c: 0, half: 0, edge: 0, lv: 0, grade: 0 };
export function laneAt(p, x, y, out = LANE) {
  const l = laneOf(p, x, y);
  out.lane = l;
  out.c = at(p, p.cx[l], y); out.half = at(p, p.half[l], y); out.edge = at(p, p.edge[l], y); out.lv = at(p, p.lv[l], y);
  out.grade = p.grade[l][row(p, y)];
  return out;
}

// Liegt der Punkt auf der präparierten Piste?
export function onPiste(p, x, y) {
  const a = laneAt(p, x, y);
  return Math.abs(x - a.c) <= a.half;
}

// Endtempo in km/h und Hangabtrieb in m/s² an dieser Stelle: überall wie in Classic, nur im schwarzen Zweig einer
// Gabelung steiler und schneller, im blauen flacher und langsamer. Über die Länge der Gabelung weich ein und aus.
const PACE = { kmh: 0, g: 0 };
export function paceAt(p, x, y, out = PACE) {
  out.kmh = C.MAX_SPEED_KMH; out.g = C.G_SLOPE;
  const k = at(p, p.ramp, y);
  if (k <= 0) return out;
  const g = p.grade[laneOf(p, x, y)][row(p, y)];
  if (g === BLACK) { out.kmh = lerp(out.kmh, C.PISTE_BLACK_KMH, k); out.g *= lerp(1, C.PISTE_BLACK_G, k); }
  else if (g === BLUE) { out.kmh = lerp(out.kmh, C.PISTE_BLUE_KMH, k); out.g *= lerp(1, C.PISTE_BLUE_G, k); }
  return out;
}

// Steilkurve bei y: Zweig, Seite der Wand und ihre Breite dort, oder null
const BANK = { lane: 0, side: 0, w: 0 };
export function bankAt(p, y) {
  for (const b of p.banks) {
    if (y < b.y0 || y > b.y1) continue;
    BANK.lane = b.lane; BANK.side = b.side;
    BANK.w = Math.sin(Math.PI * (y - b.y0) / (b.y1 - b.y0)) * C.PISTE_BANK_W_M;
    return BANK;
  }
  return null;
}

// Ziehweg: steht bei y das Fangnetz an beiden Rändern?
export function netAt(p, y) {
  for (const z of p.paths) if (y >= z.y0 && y <= z.y1) return true;
  return false;
}

// 0..1: wie dunkel es bei y ist (Flutlicht)
export const nightAt = (y) => smooth((y - C.PISTE_NIGHT_FROM_M) / C.PISTE_NIGHT_FADE_M);

// ---------- Wald ----------

function hash01(seed, ix, iy) {
  let h = (seed ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Weiches Zufallsmuster 0..1 mit Flecken der Größe g
function noise(seed, x, y, g) {
  const u = x / g, v = y / g, ix = Math.floor(u), iy = Math.floor(v);
  const fx = smooth(u - ix), fy = smooth(v - iy);
  const a = hash01(seed, ix, iy), b = hash01(seed, ix + 1, iy), c = hash01(seed, ix, iy + 1), d = hash01(seed, ix + 1, iy + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
}

// Wie viel Wald steht bei (x, y)? 0 = Lichtung, 1 = dichter Wald
export function groveAt(p, x, y) {
  const g = C.PISTE_GROVE_M;
  const v = 0.65 * noise(p.seed ^ 0x77, x, y, g) + 0.35 * noise(p.seed ^ 0x1234, x, y, g * 0.45);
  const thr = 0.5 + (0.5 - C.PISTE_GROVE_FILL) * 0.8;
  let m = smooth((v - thr + 0.07) / 0.14);
  const a = laneAt(p, x, y);
  const d = Math.abs(x - a.c) - a.half - a.edge; // Abstand zum freien Streifen
  // Raststück: neben der Piste öffnet sich der Wald zur Lichtung
  const open = 1 - smooth((a.lv - 1.5) / 2);
  m *= 1 - 0.7 * open * (1 - smooth((d - 10) / 15));
  // Schlüsselstelle: der Wald steht als Wand am Rand, die Piste wird zur Schneise
  const wall = smooth((a.lv - C.PISTE_WALL_FROM) / Math.max(0.1, C.PISTE_WALL_FULL - C.PISTE_WALL_FROM));
  return Math.max(m, wall * (1 - smooth((d - C.PISTE_WALL_M * 0.5) / (C.PISTE_WALL_M * 0.5))));
}

// Frei von Bäumen: die Piste samt Waldabstand, der Hang um das Ziel und die Flächen um alles, was an der Strecke steht
export function clearAt(p, x, y, r) {
  const a = laneAt(p, x, y);
  const dx = Math.abs(x - a.c);
  if (dx < a.half + a.edge + r) return true;
  if (y > p.finishY - 15 && y < p.finishY + 80 && Math.abs(x - at(p, p.cx[0], y)) < C.PISTE_FINISH_CLEAR_M + r) return true;
  const list = p.clearRows.get(Math.floor(y / ROW_M));
  if (list) for (const c of list) if (x + r > c.x0 && x - r < c.x1 && y + r > c.y0 && y - r < c.y1) return true;
  return false;
}

// Einstellungen für createWorld (world.js): Mitte der Piste als Korridor-Mitte, dazu der Wald
export function worldOpts(p) {
  return {
    center: (y) => centerAt(p, y),
    startLine: false,
    forest: {
      density: C.PISTE_FOREST_D, spacing: C.PISTE_SPACING_M, rockFrac: C.PISTE_ROCK_FRAC,
      mask: (x, y) => groveAt(p, x, y),
      blocked: (x, y, r) => clearAt(p, x, y, r),
      // Schnee auf den Ästen: 0 keiner, 1 etwas, 2 viel; talwärts tragen mehr Bäume Schnee
      snow: (y, rng) => (rng() < lerp(C.PISTE_SNOW_P0, C.PISTE_SNOW_P1, clamp(y / p.finishY, 0, 1)) ? (rng() < 0.5 ? 1 : 2) : 0),
    },
  };
}

// ---------- Was an der Strecke steht ----------

function build(p, rf, forkAt, laneIdx) {
  const fin = p.finishY;
  const cAt = (l, y) => at(p, p.cx[l], y), hAt = (l, y) => at(p, p.half[l], y), eAt = (l, y) => at(p, p.edge[l], y);
  const add = (f) => { f.pv = true; p.feats.push(f); return f; }; // pv: piste-view.js zeichnet es
  const hit = (x, y, r, f) => { p.hits.push({ x, y, r, f }); };
  const clear = (x0, x1, y0, y1) => { p.clears.push({ x0, x1, y0, y1 }); };
  const trig = (y, type, f, i = 0) => { p.trig.push({ y, type, f, i }); };
  // x im Abstand out außerhalb des Pistenrands, auf der Seite side des Zweigs l
  const sideX = (l, y, side, out) => cAt(l, y) + side * (hAt(l, y) + out);
  // Abstand zum nächsten Pistenrand, negativ auf der Piste
  const outside = (x, y) => { let d = Infinity; for (let l = 0; l < NL; l++) d = Math.min(d, Math.abs(x - cAt(l, y)) - hAt(l, y)); return d; };
  const laneFor = (it) => { const fk = forkAt(it.y); return fk ? laneIdx(it, fk) : 0; };

  function kicker(y, l, kind, x) {
    const tricks = kind === KICK_BIG ? C.PISTE_TRICKS_BIG : C.PISTE_TRICKS_SMALL;
    const f = add({
      k: 'kicker', x, y, lane: l, kind, w: C.PISTE_KICK_W_M[kind], L: C.PISTE_KICK_L_M[kind], h: C.PISTE_KICK_H_M[kind],
      trick: kind === KICK_ROLL ? null : tricks[Math.floor(rf() * tricks.length)],
    });
    p.kicks.push(f);
    trig(y, 'kick', f);
    return f;
  }
  const edgeKick = (y, l, side, kind) => kicker(y, l, kind, cAt(l, y) + side * Math.max(0, hAt(l, y) - C.PISTE_KICK_W_M[kind] / 2 - 1.2));

  function hut(x, y, side, name, w, trim) {
    add({ k: 'hut', x, y, name, w, trim });
    for (const dx of [-w / 2 + 1.3, 0, w / 2 - 1.3]) hit(x + dx, y - 1.1, 1.5, 'hut');
    clear(x - w / 2 - 6, x + w / 2 + 6, y - 9, y + 9);
    add({ k: 'umbrella', x: x - side * 3, y: y + 3.2 });
    const guests = [[-1.6, 3.6, 1, 0], [-4.1, 4.1, 3, 1], [1.4, 5.6, 4, 2]];
    for (const [dx, dy, col, hat] of guests) {
      add({ k: 'person', x: x + side * dx, y: y + dy, col, hat });
      hit(x + side * dx, y + dy, 0.35, 'person');
    }
    add({ k: 'rack', x: x + (side > 0 ? 1.2 : -3.1), y: y + 2.4, n: 6 });
  }

  function lift(y, type, dir) {
    const a = C.PISTE_LIFT_ANGLE_DEG * D2R, dx = dir * Math.cos(a), dy = Math.sin(a);
    const x = cAt(0, y);
    const lf = { k: 'lift', x, y, dx, dy, nx: -dy, ny: dx, type, h: C.PISTE_LIFT_H_M, half: C.PISTE_LIFT_HALF_M, n: p.lifts.length, pylons: [] };
    p.lifts.push(lf);
    for (const s of [-1, 1]) {
      let t = s * (hAt(0, y) + 4) / Math.abs(dx);
      for (let j = 0; j < 3; j++) {
        // neben der Piste: die Trasse läuft schräg, die Piste schwenkt, also nachrücken, bis die Stütze frei steht
        for (let q = 0; q < 60 && outside(x + dx * t, y + dy * t) < 3.5; q++) t += s * 1.5;
        const px = x + dx * t, py = y + dy * t;
        const f = add({ k: 'pylon', x: px, y: py, lift: lf });
        lf.pylons.push(f);
        hit(px, py, 0.55, 'pylon');
        clear(px - 2.2, px + 2.2, py - 2.2, py + 2.2);
        t += s * C.PISTE_LIFT_PYLON_M;
      }
    }
  }

  // Tipp je Gabelung: dort trennen sich die Zweige sichtbar, ein Stück dahinter steht in jedem Keil ein Wegweiser
  // mit den beiden Zweigen links und rechts von ihm
  for (const f of p.forks) {
    let y = f.y0;
    while (y < f.y1 && (cAt(1, y) - hAt(1, y)) - (cAt(0, y) + hAt(0, y)) < 3) y += 1;
    f.tipY = y;
    const sy = y + 5;
    for (let w = 0; w < f.lanes - 1; w++) {
      const sx = (cAt(w, sy) + hAt(w, sy) + cAt(w + 1, sy) - hAt(w + 1, sy)) / 2;
      f.signs.push(add({ k: 'forksign', x: sx, y: sy, fork: f, wedge: w }));
      hit(sx, sy, 0.35, 'sign');
      clear(sx - 2.5, sx + 2.5, sy - 2.5, sy + 3);
    }
    trig(f.y0 + C.PISTE_FORK_RAMP_M, 'fork', f);
  }

  for (const it of C.PISTE_LAYOUT) {
    const y = it.y, l = laneFor(it), side = it.side || 0;
    if (it.k === 'kicker') {
      if (it.big) kicker(y, l, KICK_BIG, cAt(l, y)); else edgeKick(y, l, side || 1, KICK_SMALL);
    } else if (it.k === 'hut') {
      const w = 7.2;
      hut(sideX(l, y, side, Math.max(eAt(l, y), 1.5) + w / 2 + 2.2), y, side, it.name, w, C.GATE_RED);
    } else if (it.k === 'lift') {
      lift(y, it.type, it.dir);
    } else if (it.k === 'cannon') {
      const x = sideX(l, y, side, 1.4);
      add({ k: 'cannon', x, y, side, lane: l });
      hit(x, y, 0.6, 'cannon');
      clear(x - 2.2, x + 2.2, y - 2.2, y + 2.2);
    } else if (it.k === 'trap') {
      const yb = y + C.PISTE_TRAP_BOARD_M, xb = sideX(l, yb, side, 5.2), yc = y + C.PISTE_TRAP_M + 2, xc = sideX(l, yc, -side, 1.4);
      const tp = { k: 'trap', y, y1: y + C.PISTE_TRAP_M, lane: l, n: p.traps.length };
      p.traps.push(tp);
      add({ k: 'board', x: xb, y: yb, trap: tp });
      for (const dx of [-2.2, 2.2]) hit(xb + dx, yb, 0.25, 'sign');
      clear(xb - 4.6, xb + 4.6, yb - 3, yb + 3);
      add({ k: 'camera', x: xc, y: yc, trap: tp });
      hit(xc, yc, 0.22, 'sign');
      clear(xc - 1.6, xc + 1.6, yc - 1.6, yc + 1.6);
      trig(tp.y, 'trap0', tp);
      trig(tp.y1, 'trap1', tp);
    } else if (it.k === 'gates') {
      const ti = it.type === 'sl' ? 1 : 0, gap = C.PISTE_GATE_GAP_M[ti], off = C.PISTE_GATE_OFF_M[ti];
      const sec = { k: 'gates', single: ti === 1, timed: !!it.timed, y, y1: y + (it.n - 1) * gap, lane: l, n: p.gates.length, gates: [] };
      const first = rf() < 0.5 ? -1 : 1;
      for (let i = 0; i < it.n; i++) {
        const gy = y + i * gap, s = i % 2 ? -first : first;
        sec.gates.push({ y: gy, x: cAt(l, gy) + s * off, side: s, red: i % 2 === 0 });
        trig(gy, 'gate', sec, i);
      }
      // Slalom auf Zeit: Startlinie vor dem ersten Tor, Ziellinie hinter dem letzten (piste-life.js stoppt die Uhr)
      if (sec.timed) { trig(y - C.PISTE_SLALOM_LINE_M, 'sl0', sec); trig(sec.y1 + C.PISTE_SLALOM_LINE_M, 'sl1', sec); }
      p.gates.push(sec);
    } else if (it.k === 'park') {
      // im Funpark-Zweig; das Schild ist der Wegweiser der Gabelung
      const [a0, a1, a2, a3] = C.PISTE_PARK_AT_M;
      kicker(y + a0, l, KICK_SMALL, cAt(l, y + a0) - 6.5);
      kicker(y + a1, l, KICK_BIG, cAt(l, y + a1) + 3);
      for (let j = 0; j < 3; j++) { const yr = y + a2 + j * C.PISTE_ROLL_GAP_M; kicker(yr, l, KICK_ROLL, cAt(l, yr) - 5); }
      // Steilkurve: der Zweig springt zur Seite, die Wand steht außen, wo man geradeaus hinauskäme
      const b = { y0: y + a3 - 6, y1: y + a3 + C.PISTE_BANK_LEN_M + 12, side: C.PISTE_BANK_DX_M > 0 ? -1 : 1, lane: l };
      p.banks.push(b);
      let lo = Infinity, hi = -Infinity;
      for (let yy = b.y0; yy <= b.y1; yy += 2) { const ex = cAt(l, yy) + b.side * hAt(l, yy); lo = Math.min(lo, ex); hi = Math.max(hi, ex); }
      clear(lo - C.PISTE_BANK_W_M - 2.5, hi + C.PISTE_BANK_W_M + 2.5, b.y0 - 2, b.y1 + 2);
    } else if (it.k === 'deer') {
      const x = sideX(l, y, side, 3.2);
      add({ k: 'deer', x, y, side, n: p.feats.length });
      clear(x - 2.5, x + 2.5, y - 2.5, y + 2.5);
    } else if (it.k === 'hare') {
      add({ k: 'hare', x: cAt(l, y), y, lane: l, n: p.feats.length });
    }
  }

  // Flutlicht: Masten abwechselnd links und rechts, in einer Gabelung am äußeren Zweig je Seite
  // (hinter dem Ziel am Rand des Platzes vor der Talstation)
  let alt = 1;
  for (let y = C.PISTE_NIGHT_FROM_M + 40; y <= fin + 70; y += C.PISTE_MAST_M) {
    const last = NL - 1, split = p.nl[row(p, y)] > 1 && cAt(last, y) - cAt(0, y) > 8;
    for (const [l, side] of split ? [[0, -1], [last, 1]] : [[0, alt]]) {
      if (Math.abs(y - fin) < 10) continue; // dort steht der Zielbogen
      const plaza = y > fin + 5;
      // immer am äußeren Rand: wo sich die Zweige einer Gabelung noch überdecken, stünde er sonst im anderen Zweig
      let outer = side > 0 ? -Infinity : Infinity;
      for (let q = 0; q < NL; q++) outer = side > 0 ? Math.max(outer, cAt(q, y) + hAt(q, y)) : Math.min(outer, cAt(q, y) - hAt(q, y));
      const x = plaza ? cAt(0, y) + side * 22 : outer + side * 1.2;
      add({ k: 'mast', x, y, dir: -side, tx: plaza ? cAt(0, y) + side * 9 : cAt(l, y + 3.5), ty: y + 3.5 });
      hit(x, y, 0.22, 'mast');
      clear(x - 1.3, x + 1.3, y - 1.3, y + 1.3);
    }
    alt = -alt;
  }

  // Talstation: Zielbogen, dahinter die Hütte mit Gästen und die Gondel. Nach dem Ziel zählt kein Zusammenstoß mehr.
  const cf = cAt(0, fin);
  add({ k: 'arch', x: cf, y: fin, half: Math.min(hAt(0, fin), 9) + 1 });
  add({ k: 'hut', x: cf + 15.5, y: fin + 34, name: 'tal', w: 9, trim: C.GATE_BLUE });
  add({ k: 'umbrella', x: cf - 13, y: fin + 41 });
  add({ k: 'rack', x: cf + 8.4, y: fin + 37.4, n: 7 });
  for (let i = 0; i < 16; i++) {
    const left = i < 11;
    add({ k: 'person', x: left ? cf - 19 + rf() * 9 : cf + 9 + rf() * 9, y: left ? fin + 14 + rf() * 32 : fin + 37 + rf() * 6, col: i % 7, hat: i % 3 });
  }
  lift(fin + 62, 'gondola', -1);

  // Andere Fahrer: von oben nach unten dichter. In einer Gabelung nimmt jeder einen blauen oder roten Zweig; in den
  // schwarzen, den Funpark und den Slalom fährt keiner. Nicht auf dem Ziehweg und vor dem Ziel.
  const quiet = [];
  for (const it of C.PISTE_LAYOUT) {
    if (it.k === 'ziehweg') quiet.push([it.y - 130, it.y + it.len + 30]);
  }
  const rn = mulberry32((p.seed ^ 0x4e50) >>> 0);
  const [v0, v1] = C.PISTE_NPC_KMH;
  for (let y = C.PISTE_NPC_FROM_M; C.PISTE_NPC_K > 0 && y < fin - 220;) {
    const gap = lerp(C.PISTE_NPC_GAP0_M, C.PISTE_NPC_GAP1_M, y / fin) * (1 + C.PISTE_NPC_JITTER * (rn() * 2 - 1)) / C.PISTE_NPC_K;
    const fk = forkAt(y), pick = rn();
    const open = fk ? fk.kinds.map((kd, i) => i).filter((i) => fk.kinds[i] === BLUE || fk.kinds[i] === RED) : [0];
    const lane = open.length ? open[Math.floor(pick * open.length)] : -1;
    const d = {
      y0: y, lane, off: rn() * 2 - 1, amp: 1 + rn() * 2.2, wave: 34 + rn() * 40, ph: rn() * TAU,
      v: lerp(v0, v1, rn()) / 3.6, col: Math.floor(rn() * C.PISTE_NPC_COLORS.length), board: rn() < 0.25, n: p.npcs.length,
    };
    if (lane >= 0 && !quiet.some(([a, b]) => y > a && y < b)) p.npcs.push(d);
    y += Math.max(20, gap);
  }

  // Spuren früherer Fahrer: je Linie Ausschlag (Anteil der halben Breite), Wellenlänge, Phase und ein eigener Würfel
  for (let i = 0; i < C.PISTE_OLD_TRACKS; i++) p.tracks.push({ a: 0.35 + rf() * 0.5, wave: 38 + rf() * 55, ph: rf() * TAU, seed: Math.floor(rf() * 1e9) });

  const byY = (a, b) => a.y - b.y;
  p.feats.sort(byY); p.hits.sort(byY); p.trig.sort(byY);
  for (const c of p.clears) {
    for (let r = Math.floor(c.y0 / ROW_M); r <= Math.floor(c.y1 / ROW_M); r++) {
      const list = p.clearRows.get(r);
      if (list) list.push(c); else p.clearRows.set(r, [c]);
    }
  }
}

// Liegt die Spur i früherer Fahrer im Zweig lane bei y gerade im Schnee? In Stücken von PISTE_OLD_TRACK_M mal ja,
// mal nein.
export function oldTrackOn(p, i, lane, y) {
  return hash01(p.tracks[i].seed, Math.floor(y / C.PISTE_OLD_TRACK_M), lane) < 0.55;
}
