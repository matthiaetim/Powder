// Die Schneewolke des Hockeystops (hockey.js): aus der vorderen Kante der quergestellten Ski schießt ein Fächer aus
// Wülsten in Fahrtrichtung, steigt auf, bläht sich, driftet auseinander und vergeht; darunter stiebt feiner Staub
// über den Schnee. Wülste und Staub sind dieselben Sprites wie bei der Lawine (avalanche-view.js), so wirkt der
// Schnee wie aus einem Guss. Wie dort ist alles aus der Zeit berechnet (g.finT), jede Wolke aus festen Zufallszahlen
// je Index: Bild für Bild dieselbe, kein Zustand, eine Pause hält sie an.
import { C } from './constants.js';
import { lobeAt, dustAt } from './avalanche-view.js';
import { stopTime, speedAt, distAt, stopClock } from './hockey.js';

const frac = (v) => v - Math.floor(v);
const hash = (n) => frac(Math.sin(n * 12.9898 + 78.233) * 43758.5453);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const LOBES = 44;       // Wülste der Wolke
const DUSTS = 18;       // Staubwölkchen darunter
const FAN = 2.2;        // Fächer in Fahrtrichtung, Breite in rad (±63°)
const EDGE_M = 0.5;     // die Wolke entsteht so weit vor der Fahrermitte, an der Kante der Ski
const SKI_HALF_M = 0.8; // und über die Länge der quergestellten Ski verteilt

export function drawHockey(R, g, ox, oy) {
  const st = g.stop;
  if (!st || stopClock(st, g.finT) >= C.STOP_CLOUD_S) return;
  const f = clamp(st.v0 / (C.STOP_REF_KMH / 3.6), 0, 1.3); // Größe nach Tempo im Ziel
  if (f < 0.05) return;
  const { ctx, Sv: S, dpr } = R;
  const spr = R.sprites.av;
  const t = stopClock(st, g.finT), T = stopTime(st);
  const fx = Math.sin(st.dir), fy = Math.cos(st.dir); // Fahrtrichtung
  const qx = fy, qy = -fx;                             // quer dazu, entlang der Ski

  // Ursprung eines Teilchens: Kante der Ski zu dem Zeitpunkt, an dem es losstiebt (te), dort, wo er da war
  const origin = (te, u) => {
    const d = distAt(st, te) + EDGE_M;
    return [st.x0 + fx * d + qx * u * SKI_HALF_M, st.y0 + fy * d + qy * u * SKI_HALF_M];
  };

  ctx.imageSmoothingEnabled = false; // die Sprites sind selbst weich, siehe drawCloud in avalanche-view.js

  // Staub: flach über dem Schnee, weiter und länger als die Wülste
  for (let i = 0; i < DUSTS; i++) {
    const h = (k) => hash(i * 3.17 + k * 0.71 + 41.3);
    const te = T * Math.pow(h(1), 1.2), age = t - te, life = 1.6 + 1.0 * h(2);
    if (age <= 0 || age >= life) continue;
    // Der Schnee nimmt den Schwung des Fahrers beim Losstieben mit (sonst überholt er seine eigene Wolke), dazu
    // der Tritt aus der Kante; beides bremst die Luft (k).
    const carry = (0.4 + 0.6 * h(7)) * speedAt(st, te);
    const ang = st.dir + (h(3) - 0.5) * FAN * 1.2;
    const k = 1.8, run = ((carry + (4 + 6 * h(4)) * f) * (1 - Math.exp(-k * age))) / k;
    const [x0, y0] = origin(te, h(5) * 2 - 1);
    const x = x0 + Math.sin(ang) * run, y = y0 + Math.cos(ang) * run;
    const r = (0.8 + 1.2 * h(6)) * (0.6 + 0.4 * f) * (0.6 + 1.8 * (1 - Math.exp(-1.5 * age)));
    ctx.globalAlpha = 0.55 * Math.min(1, age / 0.1) * Math.max(0, 1 - age / life);
    dustAt(ctx, spr, x * S + ox, y * S + oy, r * S, dpr);
  }

  // Wülste: früh viele und weite (das Aufreißen bei vollem Tempo), später kürzere, weil er langsamer wird.
  // Hinten (oben im Bild) zuerst, wie die Bäume, damit vordere Wülste über hinteren liegen.
  const lobes = [];
  for (let i = 0; i < LOBES; i++) {
    const h = (k) => hash(i * 7.31 + k * 1.93 + 0.5);
    const te = T * Math.pow(h(1), 1.6), age = t - te, life = 1.1 + 1.0 * h(2);
    if (age <= 0 || age >= life) continue;
    const carry = (0.4 + 0.6 * h(9)) * speedAt(st, te);
    const ang = st.dir + (h(3) - 0.5) * FAN;
    const k = 2.2, run = ((carry + (3 + 6 * h(4)) * f) * (1 - Math.exp(-k * age))) / k;
    const [x0, y0] = origin(te, h(5) * 2 - 1);
    const x = x0 + Math.sin(ang) * run, y = y0 + Math.cos(ang) * run;
    // Aufwirbeln: der Wulst steigt schnell hoch und sackt langsam wieder ab (im Bild nach oben versetzt)
    const lift = (0.4 + 0.9 * h(6)) * f * (1 - Math.exp(-4 * age)) * Math.exp(-0.5 * age);
    const r = (0.35 + 0.8 * h(7)) * (0.55 + 0.45 * f) * (0.5 + 1.5 * (1 - Math.exp(-2.2 * age)));
    const hold = 0.35 * life;
    const a = Math.min(1, age / 0.06) * Math.pow(age < hold ? 1 : Math.max(0, 1 - (age - hold) / (life - hold)), 1.2);
    lobes.push({ sx: x * S + ox, sy: (y - lift) * S + oy, r: r * S, a, v: Math.floor(h(8) * 4), key: y });
  }
  lobes.sort((p, q) => p.key - q.key);
  for (const l of lobes) {
    ctx.globalAlpha = l.a;
    lobeAt(ctx, spr, l.v, l.sx, l.sy, l.r, dpr);
  }
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
}
