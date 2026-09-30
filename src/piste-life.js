// Piste: alles, was sich im Lauf bewegt oder etwas merkt. Reines Modul ohne DOM wie piste.js, damit die
// Node-Simulation (tools/piste-sim.mjs) dieselben anderen Fahrer bekommt wie das Spiel.
// - Andere Fahrer: erscheinen ein Stück vor dem Spieler, fahren langsamer als er in ruhigen Bögen ihren Zweig hinab
//   und weichen den Kickern aus. Ein Zusammenstoß ist ein Sturz.
// - Sprung: wer über die Kante eines Kickers fährt, fliegt auf einer festen Bahn zu einem Landepunkt auf der Piste.
//   In der Luft lenkt man nicht und trifft nichts, der Trick läuft von selbst.
// - Torstrecken: Tore und Stangen sind ein Angebot. Gezählt wird beim Kreuzen der Torlinie; wer alle trifft, bekommt
//   einen verbrauchten Sturz zurück (PISTE_GATE_REWARD). Im Slalom-Zweig läuft stattdessen die Uhr von Linie zu Linie,
//   verpasste Tore kosten Strafsekunden, unter PISTE_SLALOM_LIMIT_S gibt es den Sturz zurück.
// - Tempomessung mit Foto, Fangnetz am Ziehweg, Wand der Steilkurve, Dinge am Pistenrand, an denen man stürzt, Tiere.
// game.js ruft stepLife nach jedem Physikschritt; zurück kommt das Hindernis, an dem der Fahrer hängt, oder null.
import { C } from './constants.js';
import { laneAt, laneOf, centerAt, halfAt, bankAt, netAt, KICK_BIG, KICK_ROLL } from './piste.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };

export function createLife(p) {
  const of = (k) => p.feats.filter((f) => f.k === k);
  return {
    p, t: 0,
    ni: 0, npcs: [],   // nächster Fahrer, der noch nicht erschienen ist, und die gerade sichtbaren
    ti: 0, hi: 0,      // Zeiger in p.trig und p.hits, beide nach y sortiert
    air: null,         // Flug: { t, T, x0, y0, x1, y1, z, lip, kind, trick }
    safeT: 0,          // nach der Landung so lange kein Zusammenstoß
    crashAt: [], bonus: 0, // Meter jedes Sturzes; zurückgewonnene Stürze
    secs: p.gates.map((sec) => ({ sec, hit: 0, t0: -1, time: 0, poles: poles(sec) })), // t0: Start der Slalom-Uhr, time: Ergebnis
    gateRuns: 0,       // Torstrecken, in denen alle Tore getroffen wurden
    slalomOk: 0,       // Slalom-Zweige unter der Zeit
    secrets: 0,        // Geheimwege in diesem Lauf gefunden
    note: { key: '', a: 0, b: 0, kind: '', dec: 0, t: 99 }, // Hinweis im HUD (hud.js setzt den Text; dec: Nachkommastellen von a)
    trick: null, trickT: 99, tricks: 0,
    trapT: -1, trapKmh: p.traps.map(() => 0), topKmh: 0, flashT: 99,
    route: p.forks.map(() => -1), // gewählter Zweig je Gabelung, −1 = noch nicht dort
    netT: 0, bankK: 0,
    huts: of('hut'), cannons: of('cannon'),
    deer: of('deer').map((f) => ({ pv: true, k: 'deer', f, x: f.x, y: f.y, run: -1 })),
    hares: of('hare').map((f) => ({ pv: true, k: 'hare', f, x: f.x, y: f.y, t: -1 })),
  };
}

// Stangen einer Torstrecke in der Form, die render.js für Torstangen zeichnet (samt Schwingen nach einem Treffer)
function poles(sec) {
  const out = [];
  for (const gt of sec.gates) {
    if (sec.single) out.push({ pole: true, kipp: true, x: gt.x, y: gt.y, red: gt.red, dir: 1, wob: -1, wdir: 1 });
    else for (const dir of [-1, 1]) out.push({ pole: true, kipp: false, x: gt.x + dir * C.SG_GATE_WIDTH_M / 2, y: gt.y, red: gt.red, dir, wob: -1, wdir: 1 });
  }
  return out;
}

// Lauf beginnt mitten auf der Strecke (?at=, game.js): Auslöser oberhalb überspringen, sonst feuerten sie alle im
// ersten Schritt (etwa beide Linien einer Tempomessung auf einmal)
export function skipTo(L, y) {
  while (L.ti < L.p.trig.length && L.p.trig[L.ti].y < y) L.ti++;
}

// Verbrauchte Stürze: die zurückgewonnenen zählen nicht mehr
export const crashesUsed = (L) => Math.max(0, L.crashAt.length - L.bonus);

function note(L, key, kind, a = 0, b = 0, dec = 0) {
  const n = L.note;
  n.key = key; n.kind = kind; n.a = a; n.b = b; n.dec = dec; n.t = 0;
}

// Ein Schritt nach der Physik. px, py: Lage vor dem Schritt. emit(type, data) meldet Ereignisse für den Ton.
export function stepLife(L, s, px, py, dt, emit) {
  L.t += dt; L.trickT += dt; L.flashT += dt; L.note.t += dt;
  if (L.safeT > 0) L.safeT -= dt;
  for (const st of L.secs) for (const po of st.poles) if (po.wob >= 0) { po.wob += dt; if (po.wob >= C.SG_POLE_WOBBLE_S) po.wob = -1; }
  if (L.air) fly(L, s, dt, emit);
  else edges(L, s, dt, emit);
  triggers(L, s, px, py, dt, emit);
  moveNpcs(L, s, dt);
  animals(L, s, dt);
  if (L.air) return null;
  touchPoles(L, s, emit);
  if (L.safeT > 0) return null;
  return npcHit(L, s) || staticHit(L, s);
}

// ---------- Sprung ----------

function launch(L, s, k, emit) {
  const kind = k.kind;
  const base = kind === KICK_BIG ? C.PISTE_AIR_BIG_S : kind === KICK_ROLL ? C.PISTE_AIR_ROLL_S : C.PISTE_AIR_SMALL_S;
  const f = clamp(s.v / (C.PISTE_AIR_REF_KMH / 3.6), C.PISTE_AIR_K_MIN, C.PISTE_AIR_K_MAX);
  const T = base * f;
  // Landepunkt: geradeaus weiter, aber immer auf der Piste (mit Abstand zum Rand)
  const y1 = s.y + Math.max(2, s.v * Math.cos(s.theta) * T);
  const xf = s.x + s.v * Math.sin(s.theta) * T;
  const a = laneAt(L.p, xf, y1);
  const m = Math.max(0, a.half - C.PISTE_LAND_EDGE_M);
  const x1 = clamp(xf, a.c - m, a.c + m);
  L.air = { t: 0, T, x0: s.x, y0: s.y, x1, y1, z: C.PISTE_AIR_Z_M[kind] * f, lip: k.h, kind, trick: k.trick };
  s.theta = Math.atan2(x1 - s.x, y1 - s.y);
  s.omega = 0;
  if (k.trick) { L.trick = k.trick; L.trickT = -T; L.tricks++; }
  emit('jump', { kind, v: s.v });
}

function fly(L, s, dt, emit) {
  const a = L.air;
  a.t += dt;
  const u = Math.min(1, a.t / a.T);
  s.x = lerp(a.x0, a.x1, u);
  s.y = lerp(a.y0, a.y1, u);
  s.omega = 0; s.carve = 0; s.brake = 0;
  if (u < 1) return;
  L.air = null;
  L.safeT = C.PISTE_LAND_SAFE_S;
  s.holdT = 0; // ein gehaltener Daumen wirkt ab der Landung wie ein neuer Tipp
  emit('land', { kind: a.kind, v: s.v });
}

// Haltung in der Luft für das Bild: Höhe, Drehung um die Hochachse, Stauchung längs (Überschlag von oben gesehen),
// Ski gekreuzt oder gespreizt
export function airPose(L, out) {
  const a = L.air;
  const u = Math.min(1, a.t / a.T), tr = a.trick;
  out.z = 4 * a.z * u * (1 - u) + a.lip * (1 - u);
  out.rot = tr ? tr[1] * TAU * smooth(u) : 0;
  out.flip = tr && tr[2] ? Math.cos(TAU * tr[2] * smooth(u)) : 1;
  const mid = u > 0.18 && u < 0.82;
  out.cross = !!(tr && tr[3] && mid);
  out.spread = !!(tr && tr[4] && mid);
  return out;
}

// ---------- Ränder: Fangnetz am Ziehweg, Wand der Steilkurve ----------

function edges(L, s, dt, emit) {
  const p = L.p;
  L.netT = Math.max(0, L.netT - dt);
  L.bankK = 0;
  const a = laneAt(p, s.x, s.y);
  const net = netAt(p, s.y, a.lane), bank = net ? null : bankAt(p, s.y);
  if (!net && !bank) return;
  const dx = s.x - a.c, side = dx < 0 ? -1 : 1;
  if (net) {
    // wie der Fangzaun im Slalom (fence.js): eintauchen, zurückfedern, einmal je Anprall etwas Tempo weg
    const h = a.half - C.SKIER_R - 0.05;
    let pen = Math.abs(dx) - h;
    if (pen <= 0) return;
    pen = Math.min(pen, C.SL_NET_GIVE_M);
    pen = Math.max(0, pen - C.SL_NET_SPRING * pen * dt);
    s.x = a.c + side * (h + pen);
    if (Math.sign(s.theta) === side) { s.theta *= Math.exp(-dt / C.SL_NET_DAMP_S); s.omega = 0; }
    if (L.netT > 0) return;
    L.netT = C.SL_FENCE_BUMP_S;
    s.v *= C.PISTE_PATH_KEEP;
    emit('fence', { v: s.v });
    return;
  }
  if (bank.lane !== a.lane || bank.side !== side || bank.w <= 0.05) return; // die Wand steht nur im Funpark-Zweig
  let pen = Math.abs(dx) - a.half;
  if (pen <= 0) return;
  // die Wand trägt den Fahrer um die Kurve: er kommt nicht über sie hinaus und verliert kein Tempo
  pen = Math.min(pen, bank.w);
  pen = Math.max(0, pen - C.PISTE_BANK_SPRING * pen * dt);
  s.x = a.c + side * (a.half + pen);
  if (Math.sign(s.theta) === side) { s.theta *= Math.exp(-dt / 0.25); s.omega = 0; }
  L.bankK = pen / C.PISTE_BANK_W_M;
}

// ---------- Linien quer zur Fahrt ----------

function triggers(L, s, px, py, dt, emit) {
  const p = L.p, T = p.trig;
  while (L.ti < T.length && T[L.ti].y <= s.y) {
    const tr = T[L.ti++];
    const dy = s.y - py, f = dy > 0 ? clamp((tr.y - py) / dy, 0, 1) : 1;
    const xc = px + (s.x - px) * f;
    if (tr.type === 'kick') {
      const k = tr.f;
      if (!L.air && Math.abs(xc - k.x) <= k.w / 2 && s.v >= C.PISTE_JUMP_MIN_KMH / 3.6) launch(L, s, k, emit);
    } else if (tr.type === 'gate') {
      gate(L, tr.f, tr.i, xc, emit);
    } else if (tr.type === 'trap0') {
      if (laneOf(p, xc, tr.y) === tr.f.lane) L.trapT = L.t - (1 - f) * dt;
    } else if (tr.type === 'trap1') {
      if (L.trapT < 0) continue;
      const kmh = (C.PISTE_TRAP_M / Math.max(0.05, L.t - (1 - f) * dt - L.trapT)) * 3.6;
      L.trapT = -1;
      L.trapKmh[tr.f.n] = kmh;
      if (kmh > L.topKmh) L.topKmh = kmh;
      L.flashT = 0;
      note(L, 'piste.speed', 'split', Math.round(kmh));
      emit('trap', { kmh });
    } else if (tr.type === 'fork') {
      const l = L.route[tr.f.n] = laneOf(p, s.x, s.y);
      // Geheimweg gefunden: Hinweis, Ton, und game.js merkt ihn sich für den Pistenplan
      if (tr.f.secret && l === 1) { L.secrets++; note(L, 'piste.secret', 'fast'); emit('secret', { y0: tr.f.y0 }); }
    } else if (tr.type === 'sl0') {
      if (laneOf(p, xc, tr.y) === tr.f.lane) L.secs[tr.f.n].t0 = L.t - (1 - f) * dt;
    } else if (tr.type === 'sl1') {
      slalomFinish(L, tr.f, L.t - (1 - f) * dt, emit);
    }
  }
}

function gate(L, sec, i, xc, emit) {
  const st = L.secs[sec.n], gt = sec.gates[i], n = sec.gates.length;
  if (laneOf(L.p, xc, gt.y) !== sec.lane) return; // im anderen Zweig unterwegs
  const ok = !L.air && (sec.single ? (xc - gt.x) * gt.side > 0 && Math.abs(xc - gt.x) < 7 : Math.abs(xc - gt.x) < C.SG_GATE_WIDTH_M / 2);
  if (ok) {
    st.hit++;
    emit('gate', { ok: true });
    if (i < n - 1) note(L, 'piste.gate', 'split', st.hit, n);
  }
  if (i < n - 1) return;
  if (st.hit < n) { if (st.hit > 0) note(L, 'piste.gate', 'split', st.hit, n); return; }
  L.gateRuns++;
  if (sec.timed) return; // im Slalom-Zweig entscheidet die Uhr an der Ziellinie
  const back = refund(L);
  note(L, back ? 'piste.gatesBonus' : 'piste.gatesAll', 'fast', n);
  emit('gates', { bonus: back });
}

// Einen verbrauchten Sturz zurückgeben, wenn es einen gibt
function refund(L) {
  const back = C.PISTE_GATE_REWARD > 0 && crashesUsed(L) > 0;
  if (back) L.bonus += Math.min(crashesUsed(L), Math.round(C.PISTE_GATE_REWARD));
  return back;
}

// Ziellinie des Slalom-Zweigs: Zeit seit der Startlinie plus Strafe je verpasstem Tor; unter der Grenze gibt es den
// Sturz zurück. Ohne Startlinie (von der Seite hereingefahren) zählt nichts.
function slalomFinish(L, sec, now, emit) {
  const st = L.secs[sec.n];
  if (st.t0 < 0) return;
  const n = sec.gates.length, miss = n - st.hit;
  st.time = now - st.t0 + miss * C.PISTE_SLALOM_PENALTY_S;
  st.t0 = -1;
  const ok = st.time <= C.PISTE_SLALOM_LIMIT_S;
  const shown = Math.round(st.time * 10) / 10;
  if (ok) {
    L.slalomOk++;
    const back = refund(L);
    note(L, back ? 'piste.slalomBonus' : 'piste.slalomOk', 'fast', shown, miss, 1);
    emit('gates', { bonus: back });
  } else {
    note(L, 'piste.slalomSlow', 'slow', shown, miss, 1);
    emit('slalomSlow', {});
  }
}

function touchPoles(L, s, emit) {
  const rr = C.SKIER_R + C.SG_POLE_R;
  for (const st of L.secs) {
    if (s.y < st.sec.y - 3 || s.y > st.sec.y1 + 3) continue;
    for (const po of st.poles) {
      if (po.wob >= 0 || Math.abs(po.y - s.y) > rr) continue;
      const dy = po.y - s.y;
      for (const tx of po.kipp ? [po.x] : [po.x, po.x + po.dir * C.SG_FLAG_W_M]) {
        const dx = tx - s.x;
        if (dx * dx + dy * dy >= rr * rr) continue;
        po.wob = 0;
        po.wdir = dx >= 0 ? 1 : -1; // vom Fahrer weg
        emit('pole', { x: tx, y: po.y, kipp: po.kipp });
        break;
      }
    }
  }
}

// ---------- Andere Fahrer ----------

// Linie eines Fahrers: die Mitte seines Zweigs, seitlich versetzt, mit ruhigen Bögen; um Kicker herum
export function npcX(p, d, y) {
  const c = centerAt(p, y, d.lane), h = halfAt(p, y, d.lane);
  const room = Math.max(0, h - 1.4), amp = Math.min(d.amp, room * 0.5);
  let x = c + d.off * (room - amp) + amp * Math.sin((TAU * (y - d.y0)) / d.wave + d.ph);
  for (const k of p.kicks) {
    const dy = Math.abs(y - (k.y - k.L / 2));
    if (dy > k.L / 2 + 14) continue;
    const reach = k.w / 2 + 1.3, ddx = x - k.x;
    if (Math.abs(ddx) >= reach) continue;
    x += ((ddx < 0 ? -reach : reach) - ddx) * smooth(1 - (dy - k.L / 2 - 2) / 12);
  }
  return x;
}

function place(p, o) {
  o.x = npcX(p, o.d, o.y);
  o.th = Math.atan((npcX(p, o.d, o.y + 0.4) - npcX(p, o.d, o.y - 0.4)) / 0.8);
}

export function moveNpcs(L, s, dt) {
  const p = L.p, defs = p.npcs;
  while (L.ni < defs.length && defs[L.ni].y0 <= s.y + C.PISTE_NPC_AHEAD_M) {
    const d = defs[L.ni++];
    if (d.y0 < s.y + 30) continue; // zu nah, etwa nach einem weiten Flug: gar nicht erst erscheinen
    const o = { pv: true, k: 'npc', d, x: 0, y: d.y0, th: 0, r: C.PISTE_NPC_R, vy: d.v, down: 0 };
    place(p, o);
    L.npcs.push(o);
  }
  for (let i = L.npcs.length - 1; i >= 0; i--) {
    const o = L.npcs[i];
    if (o.down > 0) o.down -= dt; // nach einem Zusammenstoß sitzt er kurz im Schnee
    else { o.y += o.d.v * dt; place(p, o); }
    if (o.y - s.y > 140 || s.y - o.y > C.PISTE_NPC_BEHIND_M || o.y > p.finishY - 60) L.npcs.splice(i, 1);
  }
}

function npcHit(L, s) {
  const rr = C.SKIER_R + C.PISTE_NPC_R;
  for (const o of L.npcs) {
    const dx = o.x - s.x, dy = o.y - s.y;
    if (dx * dx + dy * dy >= rr * rr) continue;
    return { x: o.x, y: o.y, r: o.r, t: 'rider', npc: o }; // game.js setzt ihn beim Sturz in den Schnee
  }
  return null;
}

// ---------- Dinge am Pistenrand ----------

function staticHit(L, s) {
  const H = L.p.hits;
  // der Zeiger läuft nur vorwärts; der Fahrer kann quer zum Hang ein Stück bergauf rutschen, darum großzügig
  while (L.hi < H.length && H[L.hi].y < s.y - 8) L.hi++;
  for (let i = L.hi; i < H.length && H[i].y <= s.y + 3; i++) {
    const o = H[i], rr = C.SKIER_R + o.r, dx = o.x - s.x, dy = o.y - s.y;
    if (dx * dx + dy * dy < rr * rr) return { x: o.x, y: o.y, r: o.r, t: o.f };
  }
  return null;
}

// ---------- Tiere ----------

function animals(L, s, dt) {
  for (const d of L.deer) {
    if (d.run < 0) {
      const dx = d.x - s.x, dy = d.y - s.y;
      if (dy < 40 && dx * dx + dy * dy < C.PISTE_DEER_FLEE_M * C.PISTE_DEER_FLEE_M) d.run = 0;
      continue;
    }
    if (d.run > 4) continue;
    d.run += dt;
    d.x += d.f.side * 8.5 * dt; // weg von der Piste in den Wald
    d.y += 2.5 * dt;
  }
  for (const h of L.hares) {
    if (h.t < 0) { if (s.y > h.f.y - C.PISTE_HARE_AT_M && s.y < h.f.y) h.t = 0; continue; }
    h.t += dt;
  }
}

// ---------- Ton ----------

// Wie nah sind Hütte, Lift und Schneekanone? Je 0..1 (audio.js)
export function ambience(L, s, out) {
  const p = L.p;
  let hut = 0, lift = 0, cannon = 0;
  for (const f of L.huts) {
    if (Math.abs(f.y - s.y) > C.PISTE_HUT_HEAR_M) continue;
    hut = Math.max(hut, 1 - Math.hypot(f.x - s.x, f.y - s.y) / C.PISTE_HUT_HEAR_M);
  }
  for (const f of p.lifts) {
    if (Math.abs(f.y - s.y) > 160) continue;
    const d = Math.abs((s.x - f.x) * f.nx + (s.y - f.y) * f.ny); // Abstand zur Trasse
    lift = Math.max(lift, 1 - d / C.PISTE_LIFT_HEAR_M);
  }
  for (const f of L.cannons) {
    if (Math.abs(f.y - s.y) > 40) continue;
    cannon = Math.max(cannon, 1 - Math.hypot(f.x - s.x, f.y - s.y) / 40);
  }
  out.hut = Math.max(0, hut); out.lift = Math.max(0, lift); out.cannon = Math.max(0, cannon);
  return out;
}
