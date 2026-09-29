// Torlauf: das Zielstadion im Bild (Lage, Publikum und Stimmung: stadium.js), Idee und erste Fassung von Jürgen.
// Drei Schichten, damit der Fahrer richtig dazwischen liegt (render.js draw):
//   drawStadiumGround  auf dem Schnee, unter der Spur: Schatten des Zielbogens, Schriftzug im Zielraum
//   drawStadium        nach der Spur, vor dem Fahrer: Tribüne, Werbebanden, Publikum, Videowand, Fahnen
//   drawStadiumOver    über dem Fahrer: Zielbogen mit Uhr, Blitzlichter, Konfetti
// Alles Feste ist vorgerendert (je Maßstab, Schrift und Sprache): die Ränge mit den Banden als ein Bild, die Fans
// als Atlas aus FAN_LOOKS Typen in drei Haltungen, der Zielbogen als Sprite. Die Bilder entstehen verteilt auf
// mehrere Bilder, bevor das Stadion in Sicht kommt (STAD_BUILD_AT_M), damit im Lauf nichts ruckt. Je Bild gezeichnet
// werden nur die Fans (ein drawImage je Fan: sie hüpfen, reißen die Arme hoch, La Ola läuft um die Ränge), Uhren,
// Fahnen, Blitzlichter und Konfetti.
// Die Tribüne steigt nach außen an: jede Reihe steht STAD_TRIB_RISE_M höher und rückt im Bild entsprechend nach oben,
// wie Bäume und Stangen nach oben stehen. Die Banden liegen als Band um den Zielraum, die Schrift zur Mitte hin.
import { C } from './constants.js';
import { t, getLang } from './i18n.js';
import { firstAt, olaLift, FAN_LOOKS, FLAG_LOOKS } from './stadium.js';
import { clockText } from './start-house.js';
import { scrubRect } from './snow-scrub.js';

const TAU = Math.PI * 2;
const FONT = "'Luckiest Guy', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
const MAX_PX = 2400;            // Deckel für die Kantenlänge des Bilds der Ränge in Gerätepixeln
const TOP_M = 2.2;              // so weit reicht das Bild der Ränge über die Ziellinie nach oben (höchste Reihe)
const EDGE_M = 1.4;             // Rand um die Ränge für Schatten und Kontur
const POSES = 3;                // Arme unten, Arme zum Jubeln hoch, Arme gestreckt (La Ola)
const FAN_W = 1.1, FAN_H = 1.9, FAN_AY = 1.72; // Zelle eines Fans im Atlas und sein Fußpunkt, in m
const FLAG_W = 1.3, FLAG_H = 1.4;              // Zelle einer Fahne, Fußpunkt unten links (die Hand)
const LEG_W = 0.95, BEAM_H = 1.15;             // Zielbogen: Breite der Türme, Höhe des Querstücks
const WALL = { w: 5.6, h: 3.0, leg: 1.3, gap: 0.5, y: -1.2 }; // Videowand links oberhalb der Tribüne
const MASTS = { n: 3, gap: 1.6, h: 5.2, y: -1.2 };           // Fahnenmasten rechts gegenüber
const LOGO = { y: 11, px: 2.7, text: 'POWDER' };              // Schriftzug im Zielraum, m hinter der Linie
const FLAG_COLORS = [[C.GATE_RED, C.BOARD_FILL], [C.GATE_BLUE, C.BOARD_FILL], [C.SH_LED, C.INK], [C.TREE, C.BOARD_FILL]];

function makeCanvas(wPx, hPx) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(wPx));
  c.height = Math.max(1, Math.ceil(hPx));
  return [c, c.getContext('2d')];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

function fitText(ctx, text, cx, cy, maxW, px) {
  ctx.font = `${px}px ${FONT}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) ctx.font = `${(px * maxW) / w}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

// ---------- Vorgerenderte Bilder ----------

// Band um den Zielraum zwischen den Abständen r0 und r1 zur Mitte: links gerade von der Ziellinie bis zur Mitte des
// Runds, unten der Halbkreis, rechts wieder hoch. q: Pixel je m, (u0, v0): Bildpunkt der Mitte auf der Ziellinie,
// dz: um so viele m nach oben gerückt (Höhe der Reihe).
function band(x, q, u0, v0, r0, r1, dz) {
  const B = C.STAD_BOWL_M, top = v0 - dz * q, cy = v0 + (B - dz) * q;
  x.beginPath();
  x.moveTo(u0 - r1 * q, top);
  x.lineTo(u0 - r1 * q, cy);
  x.arc(u0, cy, r1 * q, Math.PI, 0, true);
  x.lineTo(u0 + r1 * q, top);
  x.lineTo(u0 + r0 * q, top);
  x.lineTo(u0 + r0 * q, cy);
  x.arc(u0, cy, r0 * q, 0, Math.PI, false);
  x.lineTo(u0 - r0 * q, top);
  x.closePath();
}

function buildBase(R, st) {
  const E = st.tribOut + EDGE_M, B = C.STAD_BOWL_M;
  const wM = 2 * E, hM = TOP_M + B + E;
  const q = Math.min(R.S * R.dpr, MAX_PX / Math.max(wM, hM)); // Gerätepixel je m
  const [c, x] = makeCanvas(wM * q, hM * q);
  const u0 = E * q, v0 = TOP_M * q;
  const ol = Math.max(1.5, 0.09 * q), sh = 0.24 * q;
  x.lineJoin = 'round';

  // Stehplätze: festgetretener Schnee zwischen Bande und Tribüne
  band(x, q, u0, v0, st.fin + C.STAD_WALL_M, st.tribIn, 0);
  x.fillStyle = `rgba(${C.SHADOW_RGB},0.09)`; x.fill();

  // Tribüne: erst der Unterbau mit harter Schattenkante, darauf die Stufen, jede höher und im Bild weiter oben
  x.save(); x.translate(sh, sh);
  band(x, q, u0, v0, st.tribIn, st.tribOut, 0); x.fillStyle = C.INK; x.fill();
  x.restore();
  band(x, q, u0, v0, st.tribIn, st.tribOut, 0);
  x.fillStyle = C.INK_LIGHT; x.fill();
  x.strokeStyle = C.INK; x.lineWidth = ol; x.stroke();
  for (let r = 0; r < C.STAD_TRIB_ROWS; r++) {
    const d0 = st.tribIn + r * C.STAD_TRIB_ROW_M, z = (r + 1) * C.STAD_TRIB_RISE_M;
    // Von innen nach außen: die höhere Reihe rückt im Bild weiter nach oben und deckt unten im Rund den Rand der
    // Reihe davor zu. Unter der obersten Reihe bleibt der Unterbau als Rückwand der Tribüne stehen.
    band(x, q, u0, v0, d0, d0 + C.STAD_TRIB_ROW_M, z);
    x.fillStyle = r % 2 ? C.STAD_STEP_DARK : C.STAD_STEP; x.fill();
    x.strokeStyle = 'rgba(20,20,15,0.35)'; x.lineWidth = Math.max(1, 0.04 * q); x.stroke();
  }
  // Gänge: Treppen in der Tribüne, heller als die Stufen. Jede Stufe der Treppe liegt auf ihrer Reihe, also so
  // weit nach oben gerückt wie diese. a: Richtung nach außen (0 rechts, π/2 unten, π links), (px, py): Bildpunkt,
  // von dem aus der Abstand zur Mitte zählt.
  const stair = (px, py, a) => {
    const wd = 1.0 * q, len = C.STAD_TRIB_ROW_M * q;
    for (let r = 0; r < C.STAD_TRIB_ROWS; r++) {
      const d = (st.tribIn + r * C.STAD_TRIB_ROW_M) * q, z = (r + 1) * C.STAD_TRIB_RISE_M * q;
      x.save();
      x.translate(px + d * Math.cos(a), py + d * Math.sin(a) - z);
      x.rotate(a);
      x.fillStyle = r % 2 ? C.STAD_STEP : C.BOARD_FILL;
      x.fillRect(0, -wd / 2, len + 0.5, wd);
      x.strokeStyle = 'rgba(20,20,15,0.3)'; x.lineWidth = Math.max(1, 0.04 * q);
      x.strokeRect(0, -wd / 2, len + 0.5, wd);
      x.restore();
    }
  };
  for (let v = 0.55; v < B; v += C.STAD_AISLE_M) {
    stair(u0, v0 + v * q, Math.PI);
    stair(u0, v0 + v * q, 0);
  }
  for (const k of [0.25, 0.5, 0.75]) stair(u0, v0 + B * q, k * Math.PI);

  // Werbebanden: Band um den Zielraum, Tafel an Tafel, die Schrift zur Mitte hin
  const r0 = st.fin, r1 = st.fin + C.STAD_WALL_M, rm = (r0 + r1) / 2;
  x.save(); x.translate(sh, sh);
  band(x, q, u0, v0, r0, r1, 0); x.fillStyle = C.INK; x.fill();
  x.restore();
  const nS = Math.max(1, Math.round(B / C.STAD_PANEL_M)), lS = B / nS;           // Tafeln je Gerade
  const nA = Math.max(1, Math.round((Math.PI * rm) / C.STAD_PANEL_M)), lA = Math.PI / nA; // Tafeln im Rund
  const cy = v0 + B * q;
  let n = 0;
  const panel = (path, tx, ty, rot, lenM) => {
    const [ad, bg, fg] = C.STAD_ADS[n++ % C.STAD_ADS.length], text = ad ?? st.ad;
    path(); x.fillStyle = bg; x.fill();
    x.strokeStyle = C.INK; x.lineWidth = ol; x.stroke();
    x.save();
    x.translate(tx, ty); x.rotate(rot);
    x.fillStyle = fg;
    fitText(x, text, 0, 0.04 * q, (lenM - 0.6) * q, C.STAD_WALL_M * 0.66 * q);
    x.restore();
  };
  for (let i = 0; i < nS; i++) { // links abwärts
    const a = v0 + i * lS * q;
    panel(() => { x.beginPath(); x.rect(u0 - r1 * q, a, C.STAD_WALL_M * q, lS * q); }, u0 - rm * q, a + (lS * q) / 2, Math.PI / 2, lS);
  }
  for (let i = 0; i < nA; i++) { // unten herum, von links nach rechts
    const a1 = Math.PI - i * lA, a0 = a1 - lA, am = (a0 + a1) / 2;
    panel(() => { x.beginPath(); x.arc(u0, cy, r1 * q, a1, a0, true); x.arc(u0, cy, r0 * q, a0, a1, false); x.closePath(); },
      u0 + rm * q * Math.cos(am), cy + rm * q * Math.sin(am), am - Math.PI / 2, lA * rm);
  }
  for (let i = nS - 1; i >= 0; i--) { // rechts aufwärts
    const a = v0 + i * lS * q;
    panel(() => { x.beginPath(); x.rect(u0 + r0 * q, a, C.STAD_WALL_M * q, lS * q); }, u0 + rm * q, a + (lS * q) / 2, -Math.PI / 2, lS);
  }
  return { img: c, q, u0, v0 };
}

// Ein Fan: Beine, Jacke, Kopf mit Bommelmütze, Arme je Haltung. Fußpunkt unten in der Mitte der Zelle.
function drawFan(x, S, look, pose) {
  const jackets = C.STAD_JACKETS;
  const jacket = jackets[look % jackets.length], cap = jackets[(look * 5 + 3) % jackets.length];
  const skin = C.STAD_SKIN[look % C.STAD_SKIN.length];
  const Z = (m) => -m * S;
  const ol = Math.max(0.7, 0.045 * S);
  x.lineJoin = 'round';
  x.lineCap = 'round';
  // Arme hinter dem Körper: Ärmel in der Jackenfarbe, Handschuh in der Farbe der Mütze
  const arm = (side) => {
    const sx = side * 0.24 * S, sz = Z(0.72);
    const [hx, hz] = pose === 0 ? [side * 0.33 * S, Z(0.34)] : pose === 1 ? [side * 0.5 * S, Z(1.22)] : [side * 0.22 * S, Z(1.42)];
    x.strokeStyle = C.INK; x.lineWidth = 0.17 * S + 2 * ol;
    x.beginPath(); x.moveTo(sx, sz); x.lineTo(hx, hz); x.stroke();
    x.strokeStyle = jacket; x.lineWidth = 0.17 * S;
    x.beginPath(); x.moveTo(sx, sz); x.lineTo(hx, hz); x.stroke();
    x.fillStyle = cap; x.strokeStyle = C.INK; x.lineWidth = ol;
    x.beginPath(); x.arc(hx, hz, 0.1 * S, 0, TAU); x.fill(); x.stroke();
  };
  arm(-1); arm(1);
  x.fillStyle = C.INK;
  x.fillRect(-0.19 * S, Z(0.16), 0.38 * S, 0.16 * S);
  roundRect(x, -0.27 * S, Z(0.8), 0.54 * S, 0.66 * S, 0.14 * S);
  x.fillStyle = jacket; x.fill();
  x.strokeStyle = C.INK; x.lineWidth = ol; x.stroke();
  // Kopf und Mütze
  x.beginPath(); x.arc(0, Z(0.98), 0.18 * S, 0, TAU);
  x.fillStyle = skin; x.fill(); x.stroke();
  x.beginPath(); x.arc(0, Z(1.0), 0.19 * S, Math.PI * 1.02, Math.PI * 1.98); x.closePath();
  x.fillStyle = cap; x.fill(); x.stroke();
  x.beginPath(); x.arc(0, Z(1.22), 0.07 * S, 0, TAU);
  x.fillStyle = C.BOARD_FILL; x.fill(); x.stroke();
}

function buildFans(R) {
  const S = R.S * R.dpr, cw = Math.ceil(FAN_W * S), ch = Math.ceil(FAN_H * S);
  const [c, x] = makeCanvas(cw * FAN_LOOKS, ch * POSES);
  for (let look = 0; look < FAN_LOOKS; look++) {
    for (let pose = 0; pose < POSES; pose++) {
      x.save();
      x.translate(look * cw + cw / 2, pose * ch + FAN_AY * S);
      drawFan(x, S, look, pose);
      x.restore();
    }
  }
  // Fahnen: zwei Streifen am Stock, zwei Bilder für das Wehen
  const fw = Math.ceil(FLAG_W * S), fh = Math.ceil(FLAG_H * S);
  const [fc, fx] = makeCanvas(fw * FLAG_LOOKS, fh * 2);
  for (let look = 0; look < FLAG_LOOKS; look++) {
    for (let fr = 0; fr < 2; fr++) {
      const [a, b] = FLAG_COLORS[look % FLAG_COLORS.length];
      const ox = look * fw + 0.12 * S, oy = fr * fh + fh - 0.05 * S;
      fx.strokeStyle = C.INK; fx.lineWidth = Math.max(1, 0.06 * S); fx.lineCap = 'round'; fx.lineJoin = 'round';
      fx.beginPath(); fx.moveTo(ox, oy); fx.lineTo(ox + 0.1 * S, oy - 1.25 * S); fx.stroke();
      const x0 = ox + 0.1 * S, y0 = oy - 1.25 * S, L = 0.95 * S, Hh = 0.55 * S, sg = fr ? 1 : -1;
      const edge = (k) => { // Kante bei k·Höhe, gewellt
        const pts = [];
        for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push([x0 + u * L, y0 + k * Hh + Math.sin(u * 4 + fr * 2) * 0.07 * S * u * sg]); }
        return pts;
      };
      const stripe = (k0, k1, col) => {
        fx.beginPath();
        for (const [px, py] of edge(k0)) fx.lineTo(px, py);
        for (const [px, py] of edge(k1).reverse()) fx.lineTo(px, py);
        fx.closePath(); fx.fillStyle = col; fx.fill();
      };
      stripe(0, 0.5, a); stripe(0.5, 1, b);
      fx.beginPath();
      for (const [px, py] of edge(0)) fx.lineTo(px, py);
      for (const [px, py] of edge(1).reverse()) fx.lineTo(px, py);
      fx.closePath(); fx.lineWidth = Math.max(0.8, 0.045 * S); fx.stroke();
    }
  }
  return { img: c, cw, ch, flags: fc, fw, fh };
}

// Zielbogen: aufgeblasener Bogen in Torrot mit Nähten, auf dem Querstück das Wort für Ziel links und rechts der Uhr
function buildArch(R, st) {
  const S = R.S, H = C.STAD_ARCH_H_M, half = st.fin + LEG_W, pad = 0.7;
  const w = 2 * (half + pad) * S, h = (H + 2 * pad) * S;
  const [c, x] = makeCanvas(w * R.dpr, h * R.dpr);
  x.scale(R.dpr, R.dpr);
  const ax = w / 2, ay = (H + pad) * S;
  const X = (m) => ax + m * S, Z = (m) => ay - m * S;
  const ol = Math.max(1.4, 0.09 * S), sh = 0.24 * S, r = 0.55 * S;
  const shape = (dx, dy) => {
    x.beginPath();
    x.moveTo(X(-half) + dx, Z(0) + dy);
    x.lineTo(X(-half) + dx, Z(H) + r + dy);
    x.quadraticCurveTo(X(-half) + dx, Z(H) + dy, X(-half) + r + dx, Z(H) + dy);
    x.lineTo(X(half) - r + dx, Z(H) + dy);
    x.quadraticCurveTo(X(half) + dx, Z(H) + dy, X(half) + dx, Z(H) + r + dy);
    x.lineTo(X(half) + dx, Z(0) + dy);
    x.lineTo(X(st.fin) + dx, Z(0) + dy);
    x.lineTo(X(st.fin) + dx, Z(H - BEAM_H) + r * 0.6 + dy);
    x.quadraticCurveTo(X(st.fin) + dx, Z(H - BEAM_H) + dy, X(st.fin) - r * 0.6 + dx, Z(H - BEAM_H) + dy);
    x.lineTo(X(-st.fin) + r * 0.6 + dx, Z(H - BEAM_H) + dy);
    x.quadraticCurveTo(X(-st.fin) + dx, Z(H - BEAM_H) + dy, X(-st.fin) + dx, Z(H - BEAM_H) + r * 0.6 + dy);
    x.lineTo(X(-st.fin) + dx, Z(0) + dy);
    x.closePath();
  };
  x.lineJoin = 'round';
  shape(sh, sh); x.fillStyle = C.INK; x.fill();
  shape(0, 0); x.fillStyle = C.GATE_RED; x.fill();
  x.save();
  shape(0, 0); x.clip();
  // Glanz oben und an den linken Flanken (Licht von oben links), Schatten unter dem Querstück
  x.fillStyle = C.GATE_RED_LIGHT;
  x.fillRect(X(-half), Z(H), 2 * half * S, 0.26 * S);
  x.fillRect(X(-half), Z(H), 0.24 * S, H * S);
  x.fillRect(X(st.fin), Z(H - BEAM_H), 0.24 * S, (H - BEAM_H) * S);
  x.fillStyle = 'rgba(20,20,15,0.18)';
  x.fillRect(X(-st.fin), Z(H - BEAM_H) - 0.2 * S, 2 * st.fin * S, 0.2 * S);
  // Nähte der Luftkammern
  x.strokeStyle = 'rgba(20,20,15,0.22)'; x.lineWidth = Math.max(0.8, 0.04 * S);
  x.beginPath();
  for (let m = -st.fin + 1.2; m < st.fin; m += 1.4) { x.moveTo(X(m), Z(H)); x.lineTo(X(m), Z(H - BEAM_H)); }
  for (let z = 0.9; z < H - BEAM_H; z += 0.95) {
    x.moveTo(X(-half), Z(z)); x.lineTo(X(-st.fin), Z(z));
    x.moveTo(X(st.fin), Z(z)); x.lineTo(X(half), Z(z));
  }
  x.stroke();
  x.restore();
  shape(0, 0); x.strokeStyle = C.INK; x.lineWidth = ol; x.stroke();
  // Uhr in der Mitte, die Ziffern kommen je Bild dazu
  const cw = 3.0, chh = 0.74, cz = H - BEAM_H / 2;
  x.fillStyle = C.INK;
  roundRect(x, X(-cw / 2), Z(cz + chh / 2), cw * S, chh * S, 0.14 * S); x.fill();
  x.fillStyle = C.BOARD_FILL;
  const word = t('sign.finish').toUpperCase(), sideW = st.fin - cw / 2 - 0.5;
  for (const side of [-1, 1]) fitText(x, word, X(side * (cw / 2 + 0.25 + sideW / 2)), Z(cz) + 0.05 * S, sideW * S, 0.72 * S);
  return { img: c, w, h, ax, ay, clock: { w: cw, h: chh, z: cz } };
}

// Bilder je Maßstab, Schrift und Sprache. all: alles sofort (das Stadion ist schon im Bild), sonst je Aufruf ein Teil.
function assets(R, st, all) {
  const key = [R.spriteKey, R.fontReady ? 1 : 0, getLang(), C.STAD_FIN_HALF_M, C.STAD_BOWL_M, st.ad].join('|');
  if (!R.stadium || R.stadium.key !== key) R.stadium = { key, fans: null, base: null, arch: null };
  const A = R.stadium;
  const steps = [['fans', () => buildFans(R)], ['arch', () => buildArch(R, st)], ['base', () => buildBase(R, st)]];
  for (const [name, make] of steps) {
    if (A[name]) continue;
    A[name] = make();
    if (!all) break;
  }
  return A.fans && A.base && A.arch ? A : null;
}

// Ist das Stadion im Bild? Sonst nur vorbauen, sobald der Fahrer nahe genug ist.
function inView(R, st, oy) {
  const S = R.Sv;
  return (st.fy - C.STAD_ARCH_H_M - 3) * S + oy < R.H && (st.y1 + 1) * S + oy > 0;
}
function ready(R, g, oy) {
  const st = g.stadium;
  if (!st) return null;
  const seen = inView(R, st, oy);
  if (!seen && g.skier.y < st.fy - C.STAD_BUILD_AT_M) return null;
  const A = assets(R, st, seen);
  return seen ? A : null;
}

// ---------- Schichten ----------

// Auf dem Schnee, unter der Spur. rails: Linien des Fahrers für das Verwischen (render.js railsOf)
export function drawStadiumGround(R, g, ox, oy, rails) {
  if (!ready(R, g, oy)) return;
  const st = g.stadium;
  const { ctx, Sv: S } = R;
  const cx = st.cx * S + ox, fy = st.fy * S + oy;
  // Schatten des Zielbogens: fällt schräg nach rechts unten auf den Schnee
  ctx.fillStyle = `rgba(${C.SHADOW_RGB},0.16)`;
  ctx.beginPath();
  ctx.moveTo(cx - st.fin * S, fy + 0.2 * S); ctx.lineTo(cx + st.fin * S, fy + 0.2 * S);
  ctx.lineTo(cx + st.fin * S, fy + 1.5 * S); ctx.lineTo(cx - (st.fin - 1.3) * S, fy + 1.5 * S);
  ctx.closePath(); ctx.fill();
  // Schriftzug im Zielraum, wie gesprüht; die Ski verwischen ihn
  const ly = (st.fy + LOGO.y) * S + oy, px = LOGO.px * S;
  ctx.save();
  ctx.translate(cx, ly);
  ctx.rotate(-0.035);
  ctx.fillStyle = `rgba(${C.GM_RGB},0.4)`;
  fitText(ctx, LOGO.text, 0, 0, (2 * st.fin - 2) * S, px);
  ctx.restore();
  if (st.fy + LOGO.y - LOGO.px <= g.skier.y + 1) {
    scrubRect(R, g, ox, oy, { x: cx - st.fin * S, y: ly - px, w: 2 * st.fin * S, h: 2 * px }, rails);
  }
}

function drawFlagMasts(R, st, ox, oy, time) {
  const { ctx, Sv: S } = R;
  const cols = [C.GATE_RED, C.SH_LED, C.GATE_BLUE];
  for (let i = 0; i < MASTS.n; i++) {
    const mx = (st.cx + st.fin + C.STAD_WALL_M + 1.6 + i * MASTS.gap) * S + ox, my = (st.fy + MASTS.y) * S + oy;
    const topY = my - MASTS.h * S;
    ctx.fillStyle = `rgba(${C.SHADOW_RGB},0.2)`;
    ctx.beginPath(); ctx.ellipse(mx + 0.4 * S, my, 0.6 * S, 0.2 * S, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.INK;
    ctx.fillRect(mx - 0.06 * S, topY, 0.12 * S, MASTS.h * S);
    ctx.beginPath(); ctx.arc(mx, topY, 0.13 * S, 0, TAU); ctx.fill();
    // Fahne: weht nach rechts, die Welle wächst zum freien Ende
    const L = 1.5 * S, Hh = 1.0 * S, n = 8, ph = i * 1.3;
    const wv = (u) => Math.sin(time * 4.5 - u * 4.5 + ph) * 0.16 * S * u;
    ctx.beginPath();
    for (let k = 0; k <= n; k++) { const u = k / n; ctx.lineTo(mx + 0.06 * S + u * L, topY + 0.2 * S + wv(u)); }
    for (let k = n; k >= 0; k--) { const u = k / n; ctx.lineTo(mx + 0.06 * S + u * L, topY + 0.2 * S + Hh + wv(u)); }
    ctx.closePath();
    ctx.fillStyle = cols[i % cols.length]; ctx.fill();
    ctx.strokeStyle = C.INK; ctx.lineWidth = Math.max(0.9, 0.05 * S); ctx.lineJoin = 'round'; ctx.stroke();
  }
}

// Videowand: zeigt die laufende Zeit, im Ziel die Gesamtzeit; bei neuer Bestzeit blinken Sterne
function drawVideoWall(R, g, st, ox, oy) {
  const { ctx, Sv: S } = R;
  const x1 = (st.cx - st.fin - C.STAD_WALL_M - WALL.gap) * S + ox, x0 = x1 - WALL.w * S;
  const fy = (st.fy + WALL.y) * S + oy, top = fy - (WALL.leg + WALL.h) * S;
  const ol = Math.max(1.4, 0.09 * S), sh = 0.24 * S;
  ctx.fillStyle = `rgba(${C.SHADOW_RGB},0.2)`;
  ctx.beginPath(); ctx.ellipse((x0 + x1) / 2 + 0.8 * S, fy, (WALL.w / 2 + 0.6) * S, 0.5 * S, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.INK;
  for (const k of [0.14, 0.86]) ctx.fillRect(x0 + k * WALL.w * S - 0.12 * S, fy - WALL.leg * S - 0.1 * S, 0.24 * S, WALL.leg * S + 0.1 * S);
  roundRect(ctx, x0 + sh, top + sh, WALL.w * S, WALL.h * S, 0.3 * S); ctx.fill();
  roundRect(ctx, x0, top, WALL.w * S, WALL.h * S, 0.3 * S); ctx.fill();
  const m = 0.28 * S;
  const gr = ctx.createLinearGradient(0, top, 0, top + WALL.h * S);
  gr.addColorStop(0, '#22344F'); gr.addColorStop(1, '#101B2C');
  ctx.fillStyle = gr;
  roundRect(ctx, x0 + m, top + m, WALL.w * S - 2 * m, WALL.h * S - 2 * m, 0.16 * S); ctx.fill();
  const best = g.state === 'finished' && g.newBestTime;
  const mx = (x0 + x1) / 2, my = top + WALL.h * S * (best ? 0.6 : 0.52);
  ctx.fillStyle = best ? C.SH_LAMP_GREEN : C.SH_LED;
  fitText(ctx, clockText(g), mx, my, WALL.w * S - 2 * m - 0.6 * S, 1.5 * S);
  if (best) {
    // drei Sterne über der Zeit, sie pulsieren nacheinander
    for (let i = -1; i <= 1; i++) {
      const k = 0.75 + 0.25 * Math.sin(st.t * 7 + i * 1.4);
      star(ctx, mx + i * 1.4 * S, top + WALL.h * S * 0.24, 0.42 * S * k, C.SH_LED);
    }
  }
  // Glanz auf dem Glas
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(x0 + m, top + m); ctx.lineTo(x0 + WALL.w * S * 0.45, top + m); ctx.lineTo(x0 + WALL.w * S * 0.2, top + WALL.h * S - m); ctx.lineTo(x0 + m, top + WALL.h * S - m);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.INK; ctx.lineWidth = ol;
  roundRect(ctx, x0, top, WALL.w * S, WALL.h * S, 0.3 * S); ctx.stroke();
}

function star(ctx, x, y, r, col) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
}

// Nach der Spur, vor dem Fahrer
export function drawStadium(R, g, ox, oy, time) {
  const A = ready(R, g, oy);
  if (!A) return;
  const st = g.stadium;
  const { ctx, Sv: S, W, H } = R;
  const k = S / R.S;
  // Ränge und Banden
  const b = A.base, bs = S / b.q; // Bildpixel je Pixel des vorgerenderten Bilds
  ctx.drawImage(b.img, st.cx * S + ox - b.u0 * bs, st.fy * S + oy - b.v0 * bs, b.img.width * bs, b.img.height * bs);
  drawVideoWall(R, g, st, ox, oy);
  drawFlagMasts(R, st, ox, oy, time);

  // Publikum: von hinten nach vorn. Jeder Fan hüpft in seinem eigenen Takt, mit der Stimmung höher; ab einer
  // gewissen Stimmung reißt er dabei die Arme hoch. La Ola hebt die Fans der Reihe nach aus den Sitzen.
  const F = st.fans, f = A.fans;
  const cw = f.cw / R.dpr, ch = f.ch / R.dpr, fw = f.fw / R.dpr, fh = f.fh / R.dpr;
  const yTop = -oy / S - 0.5, yBot = (H - oy) / S + FAN_H + 2;
  const hype = st.hype, flagFrame = Math.floor(st.t * 5);
  for (let i = firstAt(st, yTop), n = firstAt(st, yBot); i < n; i++) {
    const p = F[i];
    const sx = p.x * S + ox;
    if (sx < -cw || sx > W + cw) continue;
    const beat = Math.sin(TAU * (st.t * (1.5 + 1.1 * p.keen) + p.ph));
    const lift = olaLift(st, p);
    const jump = Math.max(0, beat) * (0.03 + 0.3 * hype * p.keen) + lift * 0.4;
    const pose = lift > 0.3 ? 2 : hype * p.keen > 0.4 && beat > 0 ? 1 : 0;
    const sy = (p.y - p.z - jump) * S + oy;
    ctx.drawImage(f.img, p.look * f.cw, pose * f.ch, f.cw, f.ch, sx - (cw / 2) * k, sy - FAN_AY * S, cw * k, ch * k);
    if (p.flag >= 0) {
      // Fahne in der rechten Hand, sie schwenkt mit der Stimmung
      const sway = Math.sin(st.t * (2 + 3 * hype) + p.ph * TAU) * (0.1 + 0.25 * hype);
      ctx.save();
      ctx.translate(sx + 0.3 * S, sy - 0.85 * S);
      ctx.rotate(sway);
      ctx.drawImage(f.flags, p.flag * f.fw, ((flagFrame + i) % 2) * f.fh, f.fw, f.fh, -0.12 * S, -fh * k + 0.05 * S, fw * k, fh * k);
      ctx.restore();
    }
  }
}

// Über dem Fahrer
export function drawStadiumOver(R, g, ox, oy) {
  const A = ready(R, g, oy);
  if (!A) return;
  const st = g.stadium;
  const { ctx, Sv: S, W, H } = R;
  const k = S / R.S;
  const cx = st.cx * S + ox, fy = st.fy * S + oy;
  // Zielbogen mit laufender Uhr
  const a = A.arch;
  ctx.drawImage(a.img, cx - a.ax * k, fy - a.ay * k, a.w * k, a.h * k);
  ctx.fillStyle = C.SH_LED;
  fitText(ctx, clockText(g), cx, fy - a.clock.z * S + 0.05 * S, (a.clock.w - 0.4) * S, a.clock.h * 0.82 * S);

  // Blitzlichter im Publikum: kurzes Aufblitzen mit vier Strahlen
  for (const fl of st.flashes) {
    const u = fl.t / C.STAD_FLASH_S, al = 1 - u;
    const sx = fl.x * S + ox, sy = (fl.y - fl.z) * S + oy;
    if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;
    const r = (fl.big ? 0.55 : 0.32) * S * (0.6 + 0.4 * (1 - u));
    ctx.fillStyle = `rgba(255,255,255,${(0.95 * al).toFixed(2)})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const an = (i * Math.PI) / 4, rr = i % 2 ? r * 0.22 : r;
      ctx.lineTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  // Konfetti: Papierstücke, die sich im Fallen drehen; am Boden bleiben sie flach liegen
  const cols = C.STAD_CONFETTI_RGB;
  for (const p of st.confetti) {
    const sx = p.x * S + ox, sy = (p.y - p.z) * S + oy;
    if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
    const w = 0.24 * S, h = 0.13 * S * (p.land ? 1 : 0.35 + 0.65 * Math.abs(Math.cos(p.ph)));
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.spin);
    ctx.fillStyle = cols[p.c % cols.length];
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
}
