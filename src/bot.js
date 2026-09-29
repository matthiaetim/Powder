// Bot-Gegner im Duell (duel.js, bot-room.js): ein zweiter Fahrer, der auf dem eigenen Gerät mitfährt. Er fährt mit
// derselben Physik (physics.js) durch dieselbe Welt (world.js, gleicher Seed) und lenkt wie ein Spieler nur über
// Halten und Loslassen; er stürzt an denselben Bäumen und liegt dann dieselbe Sturzpause. Reine Logik ohne DOM und
// ohne Uhr: duel.js treibt ihn mit der Rennzeit (advanceBot), seine Zeit ist die Simulationszeit ab dem Go.
// Lenkung: im Takt seiner Reaktionszeit probiert er eine Handvoll Wege aus („so lange auf diesen Fahrwinkel, dann
// zurück in die Falllinie“), rechnet jeden mit der echten Physik ein Stück voraus (rollout) und nimmt den billigsten:
// kein Aufprall, viel Strecke, nicht über dem Wunschtempo, Abstand zu Hindernissen, nicht zu weit vom freien
// Korridor. Den Fahrwinkel hält er wie ein Spieler durch Tippen im Takt (steer). Die Stufen (BOT_LEVELS)
// unterscheiden sich in Wunschtempo, Vorausschau, Reaktionszeit, Tipp-Takt, Sicherheitsabstand, Bindung an den
// Korridor und darin, wie viele Hindernisse er erst im letzten Moment sieht: daraus entstehen echte Stürze.
import { C } from './constants.js';
import * as P from './physics.js';
import { createWorld, ensureCells, laneX, mulberry32 } from './world.js';
import { checkCollision } from './collision.js';

export const botLevel = (n) => C.BOT_LEVELS[Math.min(C.BOT_LEVELS.length, Math.max(1, Math.round(n) || 1)) - 1];

export function createBot({ seed, level, target, pause }) {
  const b = {
    level, p: botLevel(level), seed, target, pause,
    world: createWorld(seed),
    s: P.createSkier(),
    t: 0, state: 'run', // run | down (liegt nach dem Sturz) | done
    upAt: 0, grace: 0, crashes: 0, fin: 0, done: false, hit: null,
    plan: { th: 0, until: 0 }, thinkAt: 0,
    ctl: { side: 0, at: -1 }, rollCtl: { side: 0, at: -1 }, // gedrückte Seite und wann sie zuletzt wechselte
    near: [], // Hindernisse im Blick, je Denkschritt neu gesammelt
    prev: { t: 0, x: 0, y: 0, th: 0, v: 0 },
    roll: P.createSkier(), // Arbeitskopie für die Vorausrechnung, ohne Allokation je Versuch
  };
  b.s.v = C.START_SPEED_KMH / 3.6;
  view(b);
  return b;
}

function view(b) {
  const s = b.s;
  ensureCells(b.world, s.x - C.BOT_VIEW_SIDE_M, s.x + C.BOT_VIEW_SIDE_M, s.y - C.BOT_VIEW_BACK_M, s.y + C.BOT_VIEW_AHEAD_M);
}

// Bis zur Rennzeit t rechnen, in denselben Schritten wie das Spiel. Nach einer langen Unterbrechung holt er in
// Portionen auf (BOT_MAX_STEPS je Aufruf), damit kein Bild hängt. true, wenn er t erreicht hat.
export function advanceBot(b, t) {
  let n = 0;
  while (!b.done && b.t < t && n++ < C.BOT_MAX_STEPS) step(b, C.STEP);
  return b.done || b.t >= t;
}

// Der Gegner ist über der Zeit (der Spieler war schneller im Ziel): Lauf vorbei, keine Zielzeit
export function stopBot(b) {
  if (b.done) return;
  b.done = true;
  b.state = 'done';
  b.s.v = 0;
}

function step(b, dt) {
  const s = b.s, pv = b.prev;
  pv.t = b.t; pv.x = s.x; pv.y = s.y; pv.th = s.theta; pv.v = s.v;
  b.t += dt;
  if (b.state === 'down') {
    if (b.t >= b.upAt) respawn(b);
    return;
  }
  if (b.t >= b.thinkAt) think(b);
  steer(s, b.ctl, b.t < b.plan.until ? b.plan.th : 0, b.t, b.p.tapS);
  const py = s.y;
  P.updateSkier(s, dt);
  if (s.y >= b.target) {
    b.fin = Math.max(0.01, Math.round((b.t - (1 - (b.target - py) / (s.y - py)) * dt) * 100) / 100);
    b.done = true;
    b.state = 'done';
    return;
  }
  view(b);
  // Schonfrist wie beim Spieler (game.js step): hält, solange er am Ende noch in einem Hindernis steckt
  let hit = checkCollision(b.world, s);
  if (b.grace > 0) { b.grace = hit ? Math.max(C.STEP, b.grace - dt) : Math.max(0, b.grace - dt); hit = null; }
  if (hit) crash(b, hit);
}

function crash(b, hit) {
  const s = b.s;
  b.state = 'down';
  b.upAt = b.t + b.pause;
  b.hit = hit;
  b.crashes++;
  s.v = 0; s.side = 0; s.plow = false;
}

// Weiterfahrt wie beim Spieler (game.js respawn): neben dem Hindernis, notfalls auf der Korridor-Mitte
function respawn(b) {
  const old = b.s, hit = b.hit;
  const s = P.createSkier();
  const side = old.x >= hit.x ? 1 : -1;
  s.y = old.y;
  s.x = hit.x + side * (C.SKIER_R + hit.r + C.DUEL_RESPAWN_CLEAR_M);
  if (checkCollision(b.world, s)) s.x = laneX(b.world, s.y);
  s.v = C.START_SPEED_KMH / 3.6;
  b.s = s;
  b.grace = C.DUEL_RESPAWN_GRACE_S;
  b.state = 'run';
  b.plan.th = 0; b.plan.until = 0;
  b.ctl.side = 0; b.ctl.at = -1;
  b.thinkAt = b.t; // sofort neu orientieren
}

// ---------- Lenkung ----------

// Sieht er dieses Hindernis rechtzeitig? Ein fester Anteil je Stufe (miss) fällt ihm erst auf, wenn es nur noch
// BOT_LATE_S entfernt ist. Fest je Hindernis und Rennen, nicht je Blick gewürfelt: sonst sähe er es im nächsten
// Moment doch.
function overlooked(b, o) {
  if (b.p.miss <= 0) return false;
  const h = (b.seed ^ Math.imul(Math.floor(o.x * 16), 374761393) ^ Math.imul(Math.floor(o.y * 16), 668265263) ^ Math.imul(b.level, 40503)) >>> 0;
  return mulberry32(h)() < b.p.miss;
}

function gather(b, reach) {
  const s = b.s, near = b.near;
  const late = Math.max(C.BOT_LATE_MIN_M, s.v * C.BOT_LATE_S);
  near.length = 0;
  for (const cell of b.world.cells.values()) {
    const objs = cell.objs;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      const dy = o.y - s.y;
      if (dy < -C.BOT_VIEW_BACK_M || dy > reach) continue;
      if (Math.abs(o.x - s.x) > C.BOT_SIDE_MIN_M + C.BOT_SIDE_K * Math.max(0, dy)) continue;
      if (dy > late && overlooked(b, o)) continue;
      near.push(o);
    }
  }
  near.sort(byY); // rollout geht sie der Reihe nach durch und lässt liegen, was schon hinter ihm ist
}
const byY = (a, b) => a.y - b.y;

// Fahrwinkel th halten, mit den Mitteln des Spielers: Seite halten zieht den Kurs auf 45° und tiefer, Loslassen
// zurück in die Falllinie. Liegt das Ziel zwischen Kurs und Falllinie, reicht Loslassen, sonst drückt er zur Seite
// des Ziels. Die Eingabe wechselt höchstens alle tapS: schneller tippt auch ein Spieler nicht.
function steer(s, ctl, th, t, tapS) {
  const err = th - s.theta;
  let want = ctl.side;
  if (Math.abs(err) > C.BOT_DEAD_RAD) {
    const dir = err > 0 ? 1 : -1;
    const soft = s.theta * dir < 0 && Math.abs(th) <= Math.abs(s.theta) && Math.abs(err) < C.BOT_SOFT_RAD;
    want = soft ? 0 : dir;
  } else if (th === 0) want = 0;
  if (want !== ctl.side && t - ctl.at >= tapS) { ctl.side = want; ctl.at = t; }
  if (ctl.side !== 0) P.press(s, ctl.side); else P.release(s);
}

// Einen Weg vorausrechnen: so lange (hold) auf den Fahrwinkel th, dann Falllinie. Liefert die Kosten, kleiner ist
// besser. Gleicher Schritt und gleiche Lenkung wie in der Fahrt, damit die Vorhersage stimmt.
function rollout(b, th, hold) {
  const p = b.p, c = b.roll, ctl = b.rollCtl, near = b.near;
  Object.assign(c, b.s);
  ctl.side = b.ctl.side; ctl.at = b.ctl.at - b.t;
  const dt = C.STEP, H = p.lookS;
  const vWish = p.kmh / 3.6;
  const y0 = c.y;
  let cost = 0, grace = b.grace, i0 = 0;
  for (let t = 0; t < H; t += dt) {
    steer(c, ctl, t < hold ? th : 0, t, p.tapS);
    const ax = c.x, ay = c.y;
    P.updateSkier(c, dt);
    if (c.v > vWish) cost += C.BOT_W_SPEED * (c.v - vWish) * (c.v - vWish) * dt;
    if (grace > 0) { grace -= dt; continue; }
    // Abstand jedes Hindernisses zur Strecke dieses Schritts, nicht nur zum Endpunkt
    const bx = c.x - ax, by = c.y - ay, len2 = bx * bx + by * by;
    while (i0 < near.length && near[i0].y < ay - C.BOT_PASS_M) i0++;
    for (let i = i0; i < near.length; i++) {
      const o = near[i];
      if (o.y > c.y + C.BOT_PASS_M) break;
      let f = len2 > 0 ? ((o.x - ax) * bx + (o.y - ay) * by) / len2 : 0;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      const dx = o.x - (ax + bx * f), dy = o.y - (ay + by * f);
      const d = Math.sqrt(dx * dx + dy * dy) - C.SKIER_R - o.r;
      if (d < C.BOT_HIT_PAD_M) return cost + C.BOT_W_HIT * (2 - t / H) - (c.y - y0); // früher Aufprall ist schlimmer
      if (d < p.margin) { const k = 1 - d / p.margin; cost += C.BOT_W_NEAR * k * k * dt; }
    }
  }
  cost -= c.y - y0;
  cost += p.lane * Math.abs(c.x - laneX(b.world, c.y));
  cost += C.BOT_W_HEAD * Math.abs(c.theta); // am Ende quer zu stehen ist kein guter Ausgangspunkt
  return cost;
}

function think(b) {
  const p = b.p, s = b.s;
  b.thinkAt = b.t + p.thinkS;
  gather(b, s.v * p.lookS + C.BOT_REACH_PAD_M);
  // Der laufende Plan zählt als Vorschlag mit einem kleinen Bonus, sonst flattert er zwischen gleich guten Wegen
  const left = Math.max(0, b.plan.until - b.t);
  let bestTh = left > 0 ? b.plan.th : 0, bestHold = left;
  let best = rollout(b, bestTh, bestHold) - C.BOT_W_KEEP;
  const tryPlan = (th, hold) => {
    const c = rollout(b, th, hold);
    if (c < best) { best = c; bestTh = th; bestHold = hold; }
  };
  if (left > 0) tryPlan(0, 0);
  const degs = C.BOT_HEAD_DEG, holds = C.BOT_HOLDS_S;
  for (let i = 0; i < degs.length; i++) {
    const th = degs[i] * Math.PI / 180;
    for (let k = 0; k < holds.length; k++) {
      const hold = Math.min(holds[k], p.lookS);
      tryPlan(-th, hold);
      tryPlan(th, hold);
      if (holds[k] >= p.lookS) break;
    }
  }
  b.plan.th = bestTh;
  b.plan.until = b.t + bestHold;
}

// ---------- Ausgabe ----------

// Pose zur Rennzeit t für den Geist, zwischen den letzten beiden Schritten gemittelt (der Geist ruckelt sonst im
// Takt der Schritte gegen den Fahrer)
export function botPose(b, t, out = {}) {
  const s = b.s, a = b.prev;
  const span = b.t - a.t;
  const f = b.state !== 'run' || span <= 0 ? 1 : Math.min(1, Math.max(0, (t - a.t) / span));
  out.x = a.x + (s.x - a.x) * f;
  out.y = a.y + (s.y - a.y) * f;
  out.th = a.th + (s.theta - a.th) * f;
  out.v = b.state === 'run' ? a.v + (s.v - a.v) * f : 0;
  return out;
}

// Stand in der Form, die ein echter Gegner in den Raum schreibt (duel.js sendLive)
export function botLive(b, at) {
  const s = b.s;
  return {
    t: Math.round(b.t * 100) / 100, x: Math.round(s.x * 100) / 100, y: Math.round(Math.min(s.y, b.target) * 100) / 100,
    th: Math.round(s.theta * 1000) / 1000, v: b.state === 'run' ? Math.round(s.v * 100) / 100 : 0,
    c: b.crashes, done: b.done ? 1 : 0, fin: b.fin, p: 0, at,
  };
}
