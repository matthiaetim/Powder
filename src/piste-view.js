// Piste im Bild (piste.js liefert die Strecke, piste-life.js, was sich bewegt). Drei Schichten, die render.js aufruft:
// - drawPisteGround: alles, was im Schnee liegt. Präparierte Fläche mit Rillen (in einer Gabelung zwei Zweige),
//   Spuren früherer und anderer Fahrer, gesprühte Linien, Wand der Steilkurve, Fangnetz, Schatten des Lifts.
// - pushPisteItems / drawPisteItem: alles, was steht, nach y einsortiert zwischen Bäumen und Fahrer: Randstangen,
//   Kicker, Hütten, Gäste, Wegweiser, Stützen, Flutlichtmasten, Tore, andere Fahrer, Tiere.
// - drawPisteOver: alles, was über dem Fahrer liegt. Nebel der Schneekanone, Seil und Sessel des Lifts (mit der Höhe
//   gegen den Boden verschoben, das gibt die Tiefe), Dunkelheit mit Lichtkegeln, Blitz des Fotopunkts, Name des
//   Tricks, Wegweiser am Bildrand vor einer Gabelung.
// Stehende Dinge werden wie die Bäume einmal je Maßstab vorgerendert (sprite) und nur noch eingesetzt.
// drawPistePlan zeichnet den Pistenplan für die Fresh-Seite (hud.js).
import { C } from './constants.js';
import { t as tr, num, getLang } from './i18n.js';
import { centerAt, halfAt, gradeAt, bankAt, netAt, nightAt, oldTrackOn, profileAt, KICK_BIG, KICK_ROLL } from './piste.js';
import { airPose, npcX } from './piste-life.js';

const TAU = Math.PI * 2;
const FONT = "'Luckiest Guy', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
const ROW_M = 2;        // Raster, in dem die Pistenränder fürs Bild abgetastet werden
const HARE_S = 2.8;     // so lange braucht der Hase über die Piste
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
const gradeCol = (g) => [C.GATE_BLUE, C.GATE_RED, C.PISTE_BLACK][g];
function hash(n) {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------- Bausteine ----------

function soft(x, cx, cy, rx, ry, a, rgb = C.SHADOW_RGB) {
  x.save(); x.translate(cx, cy); x.scale(rx, ry);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.55})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore();
}

function rr(x, X, Y, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(X, Y, w, h, r); else x.rect(X, Y, w, h); }

// Schild: Platte mit Tinte-Rand und hartem Versatz-Schatten, leicht schief; draw zeichnet den Inhalt um die Mitte
function plate(x, cx, cy, w, h, o = {}) {
  const sh = o.sh == null ? 2.5 : o.sh;
  x.save(); x.translate(cx, cy); x.rotate(((o.tilt == null ? -1.5 : o.tilt) * Math.PI) / 180);
  x.fillStyle = C.INK; rr(x, -w / 2 + sh, -h / 2 + sh, w, h, o.r || 5); x.fill();
  x.fillStyle = o.fill || C.PISTE_PAPER; rr(x, -w / 2, -h / 2, w, h, o.r || 5); x.fill();
  x.strokeStyle = C.INK; x.lineWidth = o.lw || 1.5; x.stroke();
  if (o.draw) o.draw(x, w, h);
  x.restore();
}

function label(x, text, cx, cy, px, col, align = 'center') {
  x.font = `${px}px ${FONT}`; x.fillStyle = col || C.INK; x.textAlign = align; x.textBaseline = 'middle';
  x.fillText(text, cx, cy + px * 0.06);
}

// Text, der höchstens maxW breit wird: notfalls kleiner
function fitLabel(x, text, cx, cy, px, maxW, col, align) {
  x.font = `${px}px ${FONT}`;
  const w = x.measureText(text).width;
  label(x, text, cx, cy, w > maxW ? (px * maxW) / w : px, col, align);
}

function arrow(x, cx, cy, len, ang, col, lw) {
  x.save(); x.translate(cx, cy); x.rotate(ang);
  x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(-len / 2, 0); x.lineTo(len / 2, 0); x.moveTo(len / 2 - len * 0.32, -len * 0.26); x.lineTo(len / 2, 0); x.lineTo(len / 2 - len * 0.32, len * 0.26); x.stroke();
  x.restore();
}

function disc(x, cx, cy, r, col) {
  x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  x.strokeStyle = C.INK; x.lineWidth = Math.max(1, r * 0.16); x.stroke();
}

// Vorrat an vorgerenderten Bildern; neu bei anderem Maßstab, geladener Schrift oder anderer Sprache (Texte auf Schildern)
function cache(R) {
  const key = R.spriteKey + '|' + (R.fontReady ? 1 : 0) + '|' + getLang();
  if (!R.pv || R.pv.key !== key) R.pv = { key, m: new Map(), tiles: new Map(), night: null };
  return R.pv;
}

// Bild eines Dings, einmal gebaut. Fläche in m um den Fußpunkt (links, rechts, oben, unten); draw(x, S) zeichnet mit
// dem Fußpunkt im Ursprung.
function sprite(R, key, l, r, up, down, draw) {
  const pv = R.pv; // drawPisteGround hat den Vorrat für dieses Bild geprüft (cache)
  let sp = pv.m.get(key);
  if (sp) return sp;
  const S = R.S, w = (l + r) * S, h = (up + down) * S;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * R.dpr)); c.height = Math.max(1, Math.ceil(h * R.dpr));
  const x = c.getContext('2d');
  x.scale(R.dpr, R.dpr); x.translate(l * S, up * S);
  x.lineJoin = 'round'; x.lineCap = 'round';
  draw(x, S);
  sp = { c, w, h, ax: l * S, ay: up * S };
  pv.m.set(key, sp);
  return sp;
}

function blit(R, sp, wx, wy, ox, oy) {
  const k = R.Sv / R.S;
  R.ctx.drawImage(sp.c, wx * R.Sv + ox - sp.ax * k, wy * R.Sv + oy - sp.ay * k, sp.w * k, sp.h * k);
}

// ---------- Formen (Fußpunkt im Ursprung, S px je m) ----------

function kickerShape(x, S, w, L, h, col) {
  const xl = -w / 2 * S, xr = w / 2 * S, top = -L * S, lip = -h * S, tw = w * 0.4 * S;
  soft(x, 0.9 * S, 0.15 * S, (w / 2 + 1.2) * S, 0.8 * S, 0.36);
  x.fillStyle = '#B4C6D9'; x.beginPath(); x.moveTo(tw, top); x.lineTo(xr, lip); x.lineTo(xr + 0.55 * S, 0); x.lineTo(tw + 0.3 * S, top + 0.2 * S); x.closePath(); x.fill();
  const g = x.createLinearGradient(0, top, 0, lip);
  g.addColorStop(0, C.BG); g.addColorStop(0.35, '#E4EDF6'); g.addColorStop(1, '#FFFFFF');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(-tw, top); x.lineTo(tw, top); x.lineTo(xr, lip); x.lineTo(xl, lip); x.closePath(); x.fill();
  x.strokeStyle = `rgba(${C.SHADOW_RGB},0.22)`; x.lineWidth = 1;
  x.beginPath(); for (let i = 1; i < 6; i++) { const u = i / 6; x.moveTo(-tw + 2 * tw * u, top); x.lineTo(xl + (xr - xl) * u, lip); } x.stroke();
  x.strokeStyle = `rgba(${C.SHADOW_RGB},0.45)`; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-tw, top); x.lineTo(xl, lip); x.stroke();
  x.fillStyle = C.PISTE_FACE; x.beginPath(); x.moveTo(xl, lip); x.lineTo(xr, lip); x.lineTo(xr + 0.55 * S, 0); x.quadraticCurveTo(0, 0.45 * S, xl, 0); x.closePath(); x.fill();
  x.fillStyle = '#A9BCD1'; x.beginPath(); x.moveTo(xr - w * 0.22 * S, lip); x.lineTo(xr, lip); x.lineTo(xr + 0.55 * S, 0); x.quadraticCurveTo(xr - w * 0.1 * S, 0.2 * S, xr - w * 0.3 * S, 0.3 * S); x.closePath(); x.fill();
  x.strokeStyle = col; x.lineWidth = Math.max(3, 0.3 * S); x.lineCap = 'butt';
  x.beginPath(); x.moveTo(xl, lip); x.lineTo(xr, lip); x.stroke(); x.lineCap = 'round';
}

// Welle der Wellenbahn: ein flacher Buckel quer zur Fahrt
function rollerShape(x, S, w, d) {
  const xl = -w / 2 * S, xr = w / 2 * S;
  x.fillStyle = `rgba(${C.SHADOW_RGB},0.13)`; x.beginPath(); x.moveTo(xl, 0); x.quadraticCurveTo(0, -0.5 * S, xr, 0); x.quadraticCurveTo(0.4 * S, d * 0.9 * S, xl, 0); x.closePath(); x.fill();
  x.fillStyle = '#FFFFFF'; x.beginPath(); x.moveTo(xl, 0); x.quadraticCurveTo(0, -0.5 * S, xr, 0); x.quadraticCurveTo(0, -d * 1.4 * S, xl, 0); x.closePath(); x.fill();
  x.strokeStyle = `rgba(${C.SHADOW_RGB},0.3)`; x.lineWidth = 1.2; x.beginPath(); x.moveTo(xl, 0); x.quadraticCurveTo(0, -0.5 * S, xr, 0); x.stroke();
}

function hutShape(x, S, Wm, name, trim) {
  const wall = 2.9, roof = 2.2, eave = 0.7;
  const X = (m) => m * S, Z = (m) => -m * S, ol = Math.max(1.2, 0.09 * S), sh = 0.22 * S;
  soft(x, X(1.8), 0.15 * S, (Wm / 2 + 2) * S, 0.9 * S, 0.3);
  x.fillStyle = C.INK; x.fillRect(X(-Wm / 2) + sh, Z(wall) + sh, Wm * S, wall * S);
  x.fillStyle = C.PISTE_WOOD; x.fillRect(X(-Wm / 2), Z(wall), Wm * S, wall * S);
  x.strokeStyle = 'rgba(20,20,15,0.22)'; x.lineWidth = Math.max(0.7, 0.035 * S);
  x.beginPath(); for (let m = 0.45; m < wall; m += 0.45) { x.moveTo(X(-Wm / 2), Z(m)); x.lineTo(X(Wm / 2), Z(m)); } x.stroke();
  x.strokeStyle = C.INK; x.lineWidth = ol; x.strokeRect(X(-Wm / 2), Z(wall), Wm * S, wall * S);
  x.fillStyle = C.PISTE_WOOD_DARK; x.fillRect(X(-0.6), Z(2.1), 1.2 * S, 2.1 * S); x.strokeRect(X(-0.6), Z(2.1), 1.2 * S, 2.1 * S);
  for (const m of [-Wm / 3, Wm / 3]) {
    x.fillStyle = C.PISTE_YELLOW; x.fillRect(X(m - 0.6), Z(2.0), 1.2 * S, 1.0 * S); x.strokeStyle = C.INK; x.lineWidth = ol; x.strokeRect(X(m - 0.6), Z(2.0), 1.2 * S, 1.0 * S);
    x.beginPath(); x.moveTo(X(m), Z(2.0)); x.lineTo(X(m), Z(1.0)); x.stroke();
    x.fillStyle = C.GATE_RED; x.fillRect(X(m - 0.75), Z(0.98), 1.5 * S, 0.22 * S); x.strokeRect(X(m - 0.75), Z(0.98), 1.5 * S, 0.22 * S);
  }
  const rz = wall - 0.05, rl = X(-Wm / 2 - eave), rrx = X(Wm / 2 + eave), pk = Z(rz + roof);
  x.fillStyle = C.INK; x.beginPath(); x.moveTo(rl + sh, Z(rz) + sh); x.lineTo(sh, pk + sh); x.lineTo(rrx + sh, Z(rz) + sh); x.closePath(); x.fill();
  x.fillStyle = C.PISTE_WOOD_LIGHT; x.beginPath(); x.moveTo(rl, Z(rz)); x.lineTo(0, pk); x.lineTo(rrx, Z(rz)); x.closePath(); x.fill();
  x.strokeStyle = C.INK; x.lineWidth = 0.4 * S + 2 * ol; x.beginPath(); x.moveTo(rl, Z(rz)); x.lineTo(0, pk); x.lineTo(rrx, Z(rz)); x.stroke();
  x.strokeStyle = trim; x.lineWidth = 0.4 * S; x.beginPath(); x.moveTo(rl, Z(rz)); x.lineTo(0, pk); x.lineTo(rrx, Z(rz)); x.stroke();
  x.fillStyle = C.PISTE_WOOD_DARK; x.fillRect(X(1.6), Z(rz + roof + 0.5), 0.7 * S, 1.6 * S); x.strokeStyle = C.INK; x.lineWidth = ol; x.strokeRect(X(1.6), Z(rz + roof + 0.5), 0.7 * S, 1.6 * S);
  const th = 0.5 * S, e = 0.28 * S;
  const snow = () => {
    x.beginPath(); x.moveTo(rl - e, Z(rz) + 0.12 * S);
    x.quadraticCurveTo(rl - e - 0.2 * S, Z(rz) - th * 0.6, rl + 0.2 * S, Z(rz) - th * 1.1);
    x.quadraticCurveTo(-1.2 * S, pk - th * 0.4, 0, pk - th * 1.25);
    x.quadraticCurveTo(1.2 * S, pk - th * 0.4, rrx - 0.2 * S, Z(rz) - th * 1.1);
    x.quadraticCurveTo(rrx + e + 0.2 * S, Z(rz) - th * 0.6, rrx + e, Z(rz) + 0.12 * S);
    x.quadraticCurveTo(rrx - 0.1 * S, Z(rz) - 0.05 * S, rrx - 0.35 * S, Z(rz) - 0.3 * S);
    x.lineTo(0, pk - 0.22 * S); x.lineTo(rl + 0.35 * S, Z(rz) - 0.3 * S);
    x.quadraticCurveTo(rl + 0.1 * S, Z(rz) - 0.05 * S, rl - e, Z(rz) + 0.12 * S); x.closePath();
  };
  snow(); x.fillStyle = C.SNOW_CAP; x.fill();
  x.save(); snow(); x.clip(); x.fillStyle = C.SH_SNOW_SHADE; x.beginPath(); x.moveTo(0, pk - th * 1.4); x.lineTo(rrx + S, Z(rz) - th * 1.4); x.lineTo(rrx + S, Z(rz) + S); x.lineTo(0.5 * S, Z(rz) + S); x.closePath(); x.fill(); x.restore();
  snow(); x.strokeStyle = C.INK; x.lineWidth = ol; x.stroke();
  x.fillStyle = C.SNOW_CAP; rr(x, X(1.5), Z(rz + roof + 0.75), 0.9 * S, 0.35 * S, 0.15 * S); x.fill(); x.stroke();
  for (let i = 0; i < 4; i++) soft(x, X(2.0 + i * 0.5), Z(rz + roof + 1.3 + i * 0.85), (0.5 + i * 0.22) * S, (0.4 + i * 0.16) * S, 0.22 - i * 0.04, '120,135,150');
  if (name) {
    const pw = 3.0 * S, ph = 0.85 * S;
    plate(x, 0, Z(rz + 0.75), pw, ph, { sh: sh * 0.6, r: 0.16 * S, lw: ol, tilt: -1.2, draw: (c) => fitLabel(c, name, 0, 0, ph * 0.72, pw * 0.86, C.GATE_RED) });
  }
}

const SKIN = '#E0A97E';
function personShape(x, S, col, hat) {
  x.fillStyle = `rgba(${C.SHADOW_RGB},0.18)`; x.beginPath(); x.ellipse(0.2 * S, 0, 0.35 * S, 0.14 * S, 0, 0, TAU); x.fill();
  x.strokeStyle = C.INK; x.lineWidth = Math.max(1.4, 0.16 * S); x.beginPath(); x.moveTo(-0.12 * S, 0); x.lineTo(-0.1 * S, -0.7 * S); x.moveTo(0.12 * S, 0); x.lineTo(0.1 * S, -0.7 * S); x.stroke();
  x.fillStyle = col; rr(x, -0.28 * S, -1.45 * S, 0.56 * S, 0.85 * S, 0.16 * S); x.fill(); x.strokeStyle = C.INK; x.lineWidth = Math.max(0.8, 0.05 * S); x.stroke();
  x.fillStyle = SKIN; x.beginPath(); x.arc(0, -1.66 * S, 0.2 * S, 0, TAU); x.fill(); x.stroke();
  x.fillStyle = hat; x.beginPath(); x.arc(0, -1.7 * S, 0.21 * S, Math.PI, 0); x.fill();
}

function umbrellaShape(x, S) {
  soft(x, 0.7 * S, 0, 1.4 * S, 0.45 * S, 0.26);
  x.strokeStyle = C.INK; x.lineWidth = Math.max(1.4, 0.12 * S); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -2.5 * S); x.stroke();
  const cols = [C.GATE_RED, C.PISTE_PAPER, C.GATE_RED, C.PISTE_PAPER, C.GATE_RED];
  for (let i = 0; i < 5; i++) {
    const a = -1.6 * S + i * 0.64 * S, b = a + 0.64 * S;
    x.fillStyle = cols[i]; x.beginPath(); x.moveTo(0, -3.1 * S); x.lineTo(a, -2.2 * S); x.lineTo(b, -2.2 * S); x.closePath(); x.fill();
  }
  x.strokeStyle = C.INK; x.lineWidth = Math.max(1, 0.08 * S); x.beginPath(); x.moveTo(0, -3.1 * S); x.lineTo(-1.6 * S, -2.2 * S); x.lineTo(1.6 * S, -2.2 * S); x.closePath(); x.stroke();
}

function rackShape(x, S, n) {
  const cols = [C.GATE_RED, C.GATE_BLUE, C.PISTE_YELLOW, C.PISTE_POLE_TIP, C.PISTE_GREEN];
  for (let i = 0; i < n; i++) {
    const ax = i * 0.32 * S, lean = (i % 2 ? 0.06 : -0.04) * S;
    x.strokeStyle = C.INK; x.lineWidth = Math.max(1.6, 0.17 * S); x.beginPath(); x.moveTo(ax, 0); x.lineTo(ax + lean, -1.7 * S); x.stroke();
    x.strokeStyle = cols[i % cols.length]; x.lineWidth = Math.max(1, 0.09 * S); x.beginPath(); x.moveTo(ax, -0.1 * S); x.lineTo(ax + lean, -1.62 * S); x.stroke();
  }
}

// Schneekanone: Dreibein mit gelber Turbine, die nach +x bläst
function cannonShape(x, S) {
  soft(x, 0.9 * S, 0, 1.6 * S, 0.5 * S, 0.3);
  x.strokeStyle = C.INK; x.lineWidth = Math.max(2, 0.2 * S);
  x.beginPath(); x.moveTo(-0.9 * S, 0); x.lineTo(0, -2.6 * S); x.lineTo(0.9 * S, 0); x.moveTo(0, -2.6 * S); x.lineTo(0, -3.3 * S); x.stroke();
  x.save(); x.translate(0.2 * S, -3.9 * S); x.rotate(-0.12);
  x.fillStyle = C.INK; rr(x, -1.35 * S + 2.5, -0.85 * S + 2.5, 2.9 * S, 1.7 * S, 0.5 * S); x.fill();
  x.fillStyle = C.PISTE_YELLOW; rr(x, -1.35 * S, -0.85 * S, 2.9 * S, 1.7 * S, 0.5 * S); x.fill(); x.strokeStyle = C.INK; x.lineWidth = Math.max(1.2, 0.1 * S); x.stroke();
  x.fillStyle = C.INK; x.beginPath(); x.ellipse(1.5 * S, 0, 0.32 * S, 0.8 * S, 0, 0, TAU); x.fill();
  x.fillStyle = C.PISTE_STEEL; x.beginPath(); x.ellipse(1.5 * S, 0, 0.18 * S, 0.55 * S, 0, 0, TAU); x.fill();
  x.fillStyle = C.INK; x.fillRect(-0.9 * S, -0.2 * S, 1.4 * S, 0.12 * S); x.fillRect(-0.9 * S, 0.1 * S, 1.4 * S, 0.12 * S);
  x.restore();
}

// Flutlichtmast: der Ausleger mit der Lampe zeigt nach dir (zur Piste)
function mastShape(x, S, dir) {
  const top = -C.PISTE_MAST_H_M * S;
  soft(x, 0.5 * S, 0, 0.8 * S, 0.3 * S, 0.3);
  x.strokeStyle = C.INK; x.lineWidth = Math.max(2.4, 0.26 * S); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, top); x.lineTo(dir * 1.3 * S, top - 0.2 * S); x.stroke();
  x.fillStyle = C.INK; rr(x, dir * 1.3 * S - 0.7 * S, top - 0.55 * S, 1.4 * S, 0.7 * S, 0.15 * S); x.fill();
  x.fillStyle = C.PISTE_LAMP; rr(x, dir * 1.3 * S - 0.52 * S, top - 0.18 * S, 1.04 * S, 0.28 * S, 0.1 * S); x.fill();
}

function posts(x, S, xs, h, col, w) {
  for (const m of xs) {
    soft(x, m * S + 0.4 * S, 0, 0.6 * S, 0.2 * S, 0.26);
    x.strokeStyle = C.INK; x.lineWidth = w * S + 2; x.beginPath(); x.moveTo(m * S, 0); x.lineTo(m * S, -h * S); x.stroke();
    if (col) { x.strokeStyle = col; x.lineWidth = w * S; x.beginPath(); x.moveTo(m * S, 0); x.lineTo(m * S, -h * S); x.stroke(); }
  }
}

// Tafel der Tempomessung ohne die Zahl (die kommt je Bild dazu, drawBoard)
function boardShape(x, S) {
  posts(x, S, [-2.2, 2.2], 3, null, 0.24);
  plate(x, 0, -4.1 * S, 7.4 * S, 3.6 * S, { fill: C.INK, sh: 0.25 * S, tilt: 0, r: 0.5 * S, draw: (c, w, h) => {
    fitLabel(c, tr('piste.trap'), 0, -h * 0.3, 0.85 * S, w * 0.8, C.PISTE_PAPER);
    label(c, 'km/h', w * 0.31, h * 0.2, 0.75 * S, C.PISTE_YELLOW);
  } });
}

function cameraShape(x, S) {
  soft(x, 0.4 * S, 0, 0.6 * S, 0.2 * S, 0.26);
  x.strokeStyle = C.INK; x.lineWidth = Math.max(2, 0.2 * S); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -2.2 * S); x.stroke();
  x.fillStyle = C.INK; rr(x, -0.7 * S, -3.1 * S, 1.4 * S, 0.95 * S, 0.18 * S); x.fill();
  x.fillStyle = C.PISTE_GLASS; x.beginPath(); x.arc(0.25 * S, -2.62 * S, 0.3 * S, 0, TAU); x.fill();
}

// Wegweiser im Keil der Gabelung: links und rechts je ein Schild mit Pfeil, Punkt in der Pistenfarbe und Namen
function forkSignShape(x, S, fk) {
  soft(x, 0.8 * S, 0, 1.6 * S, 0.5 * S, 0.3);
  x.strokeStyle = C.INK; x.lineWidth = 0.34 * S + 2.4; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -5.4 * S); x.stroke();
  x.strokeStyle = C.PISTE_WOOD; x.lineWidth = 0.34 * S; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -5.4 * S); x.stroke();
  const pw = 8.4 * S, ph = 2.1 * S, px = 1.15 * S;
  const [gl, gr] = fk.grades;
  plate(x, -pw / 2 - 0.25 * S, -4.3 * S, pw, ph, { tilt: -2, sh: 0.25 * S, r: 0.5 * S, draw: (c, w) => {
    arrow(c, -w / 2 + 0.95 * S, 0, 1.1 * S, Math.PI, gradeCol(gl), 0.26 * S);
    disc(c, -w / 2 + 2.4 * S, 0, 0.55 * S, gradeCol(gl));
    fitLabel(c, tr('piste.fork.' + gl), -w / 2 + 3.2 * S, 0, px, w - 3.5 * S, C.INK, 'left');
  } });
  plate(x, pw / 2 + 0.25 * S, -3.4 * S, pw, ph, { tilt: 1.5, sh: 0.25 * S, r: 0.5 * S, draw: (c, w) => {
    arrow(c, w / 2 - 0.95 * S, 0, 1.1 * S, 0, gradeCol(gr), 0.26 * S);
    disc(c, w / 2 - 2.4 * S, 0, 0.55 * S, gradeCol(gr));
    fitLabel(c, tr('piste.fork.' + gr), w / 2 - 3.2 * S, 0, px, w - 3.5 * S, C.INK, 'right');
  } });
}

function parkSignShape(x, S) {
  posts(x, S, [-2.1, 2.1], 3.4, null, 0.22);
  plate(x, 0, -2.8 * S, 5.6 * S, 1.7 * S, { fill: C.INK, sh: 0, tilt: -1.5, r: 0.4 * S, draw: (c, w) => fitLabel(c, tr('piste.park'), 0, 0, 1.05 * S, w * 0.86, C.PISTE_YELLOW) });
}

// Zielbogen der Talstation: zwei rote Pfosten, darüber das Schild
function archShape(x, S, half) {
  posts(x, S, [-half, half], 5, C.GATE_RED, 0.5);
  plate(x, 0, -5 * S, (2 * half + 0.8) * S, 2.4 * S, { fill: C.PISTE_PAPER, sh: 0.25 * S, tilt: 0, r: 0.5 * S, draw: (c, w) => fitLabel(c, tr('piste.station') + ' · ' + num(C.PISTE_FINISH_M) + ' m', 0, 0, 1.25 * S, w * 0.9, C.GATE_RED) });
}

// Sessel am Seil: Aufhängung im Ursprung, n Plätze, zufällig besetzt; back: die Fahrgäste sitzen mit dem Rücken zu uns
function chairShape(x, S, n, seed, back) {
  const w = (0.62 * n + 0.3) * S, hang = 2.3 * S;
  const cols = C.PISTE_NPC_COLORS;
  x.strokeStyle = C.INK; x.lineWidth = Math.max(1.4, 0.13 * S);
  x.beginPath(); x.moveTo(0, 0); x.lineTo(0, hang * 0.45); x.lineTo(-w / 2, hang * 0.62); x.lineTo(-w / 2, hang); x.moveTo(0, hang * 0.45); x.lineTo(w / 2, hang * 0.62); x.lineTo(w / 2, hang); x.stroke();
  x.fillStyle = C.INK; x.fillRect(-0.22 * S, -0.12 * S, 0.44 * S, 0.24 * S);
  for (let i = 0; i < n; i++) {
    const px = -w / 2 + (0.3 + 0.62 * i + 0.16) * S, py = hang;
    if (hash(seed * 31 + i) < 0.25) continue;
    const col = cols[Math.floor(hash(seed * 17 + i * 7) * cols.length)];
    x.strokeStyle = C.INK; x.lineWidth = Math.max(1.2, 0.12 * S);
    x.beginPath(); x.moveTo(px - 0.1 * S, py); x.lineTo(px - 0.12 * S, py + 0.75 * S); x.moveTo(px + 0.1 * S, py); x.lineTo(px + 0.12 * S, py + 0.75 * S); x.stroke();
    x.lineWidth = Math.max(1, 0.08 * S); x.beginPath(); x.moveTo(px - 0.12 * S, py + 0.55 * S); x.lineTo(px - 0.16 * S, py + 1.25 * S); x.moveTo(px + 0.12 * S, py + 0.55 * S); x.lineTo(px + 0.16 * S, py + 1.25 * S); x.stroke();
    x.fillStyle = col; rr(x, px - 0.25 * S, py - 0.75 * S, 0.5 * S, 0.8 * S, 0.14 * S); x.fill(); x.strokeStyle = C.INK; x.lineWidth = Math.max(0.8, 0.05 * S); x.stroke();
    x.fillStyle = back ? C.INK_LIGHT : SKIN; x.beginPath(); x.arc(px, py - 0.92 * S, 0.19 * S, 0, TAU); x.fill(); x.stroke();
    x.fillStyle = C.INK_LIGHT; x.beginPath(); x.arc(px, py - 0.96 * S, 0.2 * S, Math.PI, 0); x.fill();
  }
  x.strokeStyle = C.INK; x.lineWidth = Math.max(2, 0.2 * S); x.beginPath(); x.moveTo(-w / 2, hang); x.lineTo(w / 2, hang); x.stroke();
  x.strokeStyle = C.GATE_RED; x.lineWidth = Math.max(1.4, 0.12 * S); x.beginPath(); x.moveTo(-w / 2 - 0.05 * S, hang + 0.3 * S); x.lineTo(w / 2 + 0.05 * S, hang + 0.3 * S); x.stroke();
}

function gondolaShape(x, S, col) {
  const w = 2.3 * S, h = 2.1 * S, hang = 1.5 * S, sh = 0.18 * S;
  x.strokeStyle = C.INK; x.lineWidth = Math.max(1.6, 0.16 * S); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, hang); x.stroke();
  x.fillStyle = C.INK; x.fillRect(-0.3 * S, -0.12 * S, 0.6 * S, 0.24 * S);
  x.fillStyle = C.INK; rr(x, -w / 2 + sh, hang + sh, w, h, 0.45 * S); x.fill();
  x.fillStyle = col; rr(x, -w / 2, hang, w, h, 0.45 * S); x.fill(); x.strokeStyle = C.INK; x.lineWidth = Math.max(1.2, 0.09 * S); x.stroke();
  x.fillStyle = C.PISTE_GLASS; rr(x, -w / 2 + 0.22 * S, hang + 0.3 * S, w - 0.44 * S, 0.95 * S, 0.2 * S); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(0, hang + 0.3 * S); x.lineTo(0, hang + 1.25 * S); x.stroke();
  x.fillStyle = C.INK_LIGHT; x.beginPath(); x.arc(-0.5 * S, hang + 0.95 * S, 0.2 * S, Math.PI, 0); x.arc(0.55 * S, hang + 0.95 * S, 0.2 * S, Math.PI, 0); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(-w / 2 + 0.3 * S, hang + 1.55 * S, w - 0.6 * S, 0.14 * S);
}

// Anderer Fahrer von oben, Fahrtrichtung +y: wie der Spieler, aber mit bunter Jacke
function npcShape(x, S, col, board) {
  x.strokeStyle = C.INK; x.lineCap = 'round';
  if (board) {
    x.fillStyle = C.BOARD_FILL; x.lineWidth = Math.max(1, 0.07 * S);
    rr(x, -0.15 * S, -0.8 * S, 0.3 * S, 1.6 * S, 0.15 * S); x.fill(); x.stroke();
  } else {
    x.lineWidth = Math.max(1, 0.09 * S);
    x.beginPath(); x.moveTo(-0.16 * S, -0.85 * S); x.lineTo(-0.16 * S, 0.75 * S); x.moveTo(0.16 * S, -0.85 * S); x.lineTo(0.16 * S, 0.75 * S); x.stroke();
  }
  x.fillStyle = col; x.beginPath(); x.ellipse(0, 0, (board ? 0.2 : 0.26) * S, 0.42 * S, 0, 0, TAU); x.fill();
  x.lineWidth = Math.max(0.8, 0.05 * S); x.stroke();
  x.fillStyle = C.INK_LIGHT; x.beginPath(); x.arc(0, (board ? 0.04 : -0.1) * S, 0.14 * S, 0, TAU); x.fill();
}

// ---------- Boden ----------

export function drawPisteGround(R, g, ox, oy, t) {
  cache(R);
  surface(R, g, ox, oy);
  const p = g.piste, L = g.life, { ctx, Sv: S, H } = R;
  const y0 = -oy / S, y1 = (H - oy) / S;
  banks(R, p, ox, oy, y0, y1);
  oldTracks(R, p, ox, oy, y0, y1);
  // gesprühte Linien: Tempomessung, Beginn einer Torstrecke, Landezone hinter einem Kicker
  for (const tp of p.traps) {
    for (const y of [tp.y, tp.y1]) if (y > y0 - 1 && y < y1 + 1) sprayAcross(R, p, tp.lane, y, ox, oy, C.PISTE_TRAP_RGBA);
  }
  for (const sec of p.gates) {
    const y = sec.y - 14;
    if (y > y0 - 1 && y < y1 + 1) sprayAcross(R, p, sec.lane, y, ox, oy, `rgba(${C.GM_RGB},0.7)`);
  }
  for (const k of p.kicks) {
    if (k.kind === KICK_ROLL) continue;
    const y = k.y + (k.kind === KICK_BIG ? 24 : 10);
    if (y > y0 - 1 && y < y1 + 1) sprayBand(R, (k.x - k.w / 2) * S + ox, (k.x + k.w / 2) * S + ox, y * S + oy, `rgba(${C.GM_RGB},0.7)`);
  }
  if (L) npcTrails(R, p, L, ox, oy, y0);
  nets(R, p, ox, oy, y0, y1);
  for (const lf of p.lifts) if (Math.abs(lf.y - (y0 + y1) / 2) < 130) liftShadow(R, lf, ox, oy, t);
}

// Präparierter Schnee: ein heller Streifen zwischen den Rändern, darauf feine Rillen in der Falllinie (Cord). Die
// Rillen liegen fest im Schnee (Welt-x), jede beginnt und endet genau am Pistenrand. Die Ränder werden alle ROW_M
// abgetastet und gerade verbunden, Fläche und Rillen nutzen dieselben Punkte. In einer Gabelung gibt es zwei Zweige;
// der rechte wird dort, wo beide sich noch überdecken, am rechten Rand des linken abgeschnitten, damit nichts doppelt
// liegt.
function surface(R, g, ox, oy) {
  const p = g.piste;
  const { ctx, Sv: S, W, H } = R;
  const ya = Math.floor((-oy / S) / ROW_M) * ROW_M - ROW_M, n = Math.ceil(H / S / ROW_M) + 4;
  const buf = R.pvRows && R.pvRows.length >= 4 * n ? R.pvRows : (R.pvRows = new Float32Array(4 * n + 64));
  let forked = false;
  for (let j = 0; j < n; j++) {
    const y = ya + j * ROW_M;
    const c0 = centerAt(p, y, 0), h0 = halfAt(p, y, 0), c1 = centerAt(p, y, 1), h1 = halfAt(p, y, 1);
    const r0 = c0 + h0;
    buf[4 * j] = Math.min(c0 - h0, c1 - h1); buf[4 * j + 1] = r0;
    buf[4 * j + 2] = Math.max(c1 - h1, r0); buf[4 * j + 3] = Math.max(c1 + h1, r0);
    if (buf[4 * j + 3] > r0 + 0.01) forked = true;
  }
  for (let l = 0; l < (forked ? 2 : 1); l++) {
    const a = 2 * l, b = a + 1;
    let lo = Infinity, hi = -Infinity;
    ctx.fillStyle = C.PISTE_SNOW;
    ctx.beginPath();
    for (let j = 0; j < n; j++) {
      const X = buf[4 * j + a] * S + ox, Y = (ya + j * ROW_M) * S + oy;
      if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      if (buf[4 * j + a] < lo) lo = buf[4 * j + a];
      if (buf[4 * j + b] > hi) hi = buf[4 * j + b];
    }
    for (let j = n - 1; j >= 0; j--) ctx.lineTo(buf[4 * j + b] * S + ox, (ya + j * ROW_M) * S + oy);
    ctx.closePath();
    ctx.fill();
    // Rillen: je Linie die Abschnitte suchen, in denen sie zwischen den Rändern liegt
    const gap = C.PISTE_CORD_M;
    const xa = Math.max(lo, -ox / S), xb = Math.min(hi, (W - ox) / S);
    ctx.strokeStyle = C.PISTE_CORD_RGBA;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = Math.ceil(xa / gap); k * gap <= xb; k++) {
      const x = k * gap, sx = Math.round((x * S + ox) * R.dpr) / R.dpr + 0.5 / R.dpr;
      let inside = false;
      for (let j = 0; j < n; j++) {
        const Lj = buf[4 * j + a], Rj = buf[4 * j + b];
        const now = x > Lj && x < Rj;
        if (now === inside) continue;
        // Übergang zwischen j-1 und j: dort kreuzt die Linie den linken oder rechten Rand
        let y = ya + j * ROW_M;
        if (j > 0) {
          const Lp = buf[4 * (j - 1) + a], Rp = buf[4 * (j - 1) + b];
          const left = x <= Lp || x <= Lj;
          const e0 = left ? Lp : Rp, e1 = left ? Lj : Rj;
          const f = e1 !== e0 ? clamp((x - e0) / (e1 - e0), 0, 1) : 0;
          y = ya + (j - 1 + f) * ROW_M;
        }
        if (now) ctx.moveTo(sx, y * S + oy); else ctx.lineTo(sx, y * S + oy);
        inside = now;
      }
      if (inside) ctx.lineTo(sx, (ya + (n - 1) * ROW_M) * S + oy);
    }
    ctx.stroke();
  }
}

// Steilkurve: eine Schneewand außen am Pistenrand, in der Mitte am höchsten; oben eine rote Kante
function banks(R, p, ox, oy, y0, y1) {
  const { ctx, Sv: S } = R;
  for (const b of p.banks) {
    if (b.y1 < y0 - 4 || b.y0 > y1 + 4) continue;
    const pts = [];
    for (let y = b.y0; y <= b.y1 + 0.01; y += 1.5) {
      const u = Math.sin(Math.PI * (y - b.y0) / (b.y1 - b.y0));
      pts.push([(centerAt(p, y) + b.side * halfAt(p, y)) * S + ox, y * S + oy, u * C.PISTE_BANK_W_M * S * b.side, u * 2.3 * S]);
    }
    const path = (fx, fy, gx, gy) => {
      ctx.beginPath();
      pts.forEach(([x, y, w, h], i) => { const X = x + w * fx, Y = y - h * fy; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      for (let i = pts.length - 1; i >= 0; i--) { const [x, y, w, h] = pts[i]; ctx.lineTo(x + w * gx, y - h * gy); }
      ctx.closePath();
    };
    ctx.fillStyle = `rgba(${C.SHADOW_RGB},0.16)`; path(1, 0, 1.3, -0.2); ctx.fill();     // Schatten hinter der Wand
    ctx.fillStyle = '#E4EDF6'; path(0, 0, 1, 1); ctx.fill();                              // Flanke vom Fuß bis zur Kante
    ctx.fillStyle = '#FFFFFF'; path(0, 0, 0.45, 0.45); ctx.fill();                         // unten im Licht
    ctx.strokeStyle = C.GATE_RED; ctx.lineWidth = Math.max(2.5, 0.26 * S); ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y, w, h], i) => { if (i) ctx.lineTo(x + w, y - h); else ctx.moveTo(x + w, y - h); });
    ctx.stroke();
  }
}

// Spuren früherer Fahrer: blasse Doppellinien in ruhigen Bögen, in Stücken mal da, mal nicht
function oldTracks(R, p, ox, oy, y0, y1) {
  const { ctx, Sv: S } = R;
  ctx.strokeStyle = `rgba(${C.TRACK_RGB},${C.PISTE_OLD_TRACK_ALPHA})`;
  ctx.lineWidth = Math.max(1, 0.1 * S);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const split = centerAt(p, (y0 + y1) / 2, 1) - centerAt(p, (y0 + y1) / 2, 0) > 1;
  ctx.beginPath();
  for (let l = 0; l < (split ? 2 : 1); l++) {
    for (let i = 0; i < p.tracks.length; i++) {
      const tk = p.tracks[i];
      for (const off of [-0.16, 0.16]) {
        let pen = false;
        for (let y = Math.floor(y0 / 1.5) * 1.5 - 1.5; y <= y1 + 1.5; y += 1.5) {
          if (y < 30 || y > p.finishY - 30 || netAt(p, y) || !oldTrackOn(p, i, l, y)) { pen = false; continue; }
          const x = centerAt(p, y, l) + tk.a * Math.max(0, halfAt(p, y, l) - 1.6) * Math.sin((TAU * y) / tk.wave + tk.ph + 1.7 * l) + off;
          if (pen) ctx.lineTo(x * S + ox, y * S + oy); else ctx.moveTo(x * S + ox, y * S + oy);
          pen = true;
        }
      }
    }
  }
  ctx.stroke();
}

// Spur hinter jedem anderen Fahrer, so lang wie PISTE_NPC_TRAIL_M
function npcTrails(R, p, L, ox, oy, y0) {
  const { ctx, Sv: S } = R;
  ctx.strokeStyle = `rgba(${C.TRACK_RGB},0.13)`;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const o of L.npcs) {
    const from = Math.max(y0 - 2, o.y - C.PISTE_NPC_TRAIL_M);
    if (from >= o.y) continue;
    ctx.lineWidth = Math.max(1, (o.d.board ? 0.26 : 0.1) * S);
    ctx.beginPath();
    for (const off of o.d.board ? [0] : [-0.16, 0.16]) {
      let first = true;
      for (let y = from; ; y += 1) {
        const yy = Math.min(y, o.y), X = (npcX(p, o.d, yy) + off) * S + ox, Y = yy * S + oy;
        if (first) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        first = false;
        if (y >= o.y) break;
      }
    }
    ctx.stroke();
  }
}

// Fangnetz am Ziehweg: orangefarbenes Band außen an beiden Rändern, Pfosten alle SL_FENCE_POST_M
function nets(R, p, ox, oy, y0, y1) {
  const { ctx, Sv: S } = R;
  for (const z of p.paths) {
    const a = Math.max(z.y0, y0 - 2), b = Math.min(z.y1, y1 + 2);
    if (b <= a) continue;
    const nw = C.SL_FENCE_NET_M * S;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let y = a; ; y += 2) {
        const yy = Math.min(y, b), X = (centerAt(p, yy) + side * halfAt(p, yy)) * S + ox + side * nw / 2, Y = yy * S + oy;
        if (y === a) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        if (y >= b) break;
      }
      ctx.lineCap = 'butt';
      ctx.strokeStyle = C.FENCE_EDGE; ctx.lineWidth = nw + Math.max(2, 0.16 * S); ctx.stroke();
      ctx.strokeStyle = '#FFB37A'; ctx.lineWidth = nw; ctx.stroke();
      ctx.fillStyle = C.INK;
      const pw = Math.max(2, 0.12 * S), ph = 1.2 * S, P = C.SL_FENCE_POST_M;
      for (let y = Math.ceil(a / P) * P; y <= b; y += P) {
        const X = (centerAt(p, y) + side * halfAt(p, y)) * S + ox + side * nw / 2;
        ctx.fillRect(X - pw / 2, y * S + oy - ph, pw, ph);
      }
    }
  }
}

// Sprühlinie quer über einen Zweig
function sprayAcross(R, p, lane, y, ox, oy, color) {
  const c = centerAt(p, y, lane), h = halfAt(p, y, lane) - 0.4;
  sprayBand(R, (c - h) * R.Sv + ox, (c + h) * R.Sv + ox, y * R.Sv + oy, color);
}

// Ein Stück gesprühte Linie von x0 bis x1 (Bildschirm) wie die Meterlinien in render.js: ein Band aus Farbpunkten,
// in der Mitte dicht, einmal je Farbe als Kachel vorgerendert
const TILE_PX = 256, BAND_PX = 5;
function sprayBand(R, x0, x1, sy, color) {
  const pv = R.pv, ctx = R.ctx;
  let tile = pv.tiles.get(color);
  if (!tile) {
    const h = Math.ceil(BAND_PX * 1.6);
    const c = document.createElement('canvas');
    c.width = TILE_PX * R.dpr; c.height = 2 * h * R.dpr;
    const x = c.getContext('2d');
    x.scale(R.dpr, R.dpr);
    x.fillStyle = color;
    for (let i = 0; i < TILE_PX * BAND_PX * 0.8; i++) {
      const g1 = hash(i * 3 + 1) + hash(i * 3 + 2) + hash(i * 3 + 3) - 1.5; // grob glockenförmig um 0
      x.globalAlpha = 0.45 + 0.55 * hash(i * 5 + 11);
      x.beginPath(); x.arc(hash(i * 7 + 5) * TILE_PX, h + g1 * BAND_PX * 0.75, 0.5 + 0.6 * hash(i * 11 + 3), 0, TAU); x.fill();
    }
    tile = { c, h };
    pv.tiles.set(color, tile);
  }
  if (x1 <= 0 || x0 >= R.W || x1 - x0 < 2) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, sy - tile.h, x1 - x0, 2 * tile.h); ctx.clip();
  for (let x = x0 - (((x0 % TILE_PX) + TILE_PX) % TILE_PX); x < x1; x += TILE_PX) ctx.drawImage(tile.c, x, sy - tile.h, TILE_PX, 2 * tile.h);
  ctx.restore();
}

// ---------- Lift ----------

// Punkt in der Höhe h über dem Boden: im Bild nach oben versetzt und vom Bildmittelpunkt weg gestreckt. Das
// verschiebt Seil und Sessel beim Fahren gegen den Schnee darunter, wie beim Blick von oben auf etwas Hohes.
function lifted(R, sx, sy, h, out) {
  const kz = 1 + h * C.PISTE_LIFT_PARALLAX, cx = R.W / 2, cy = R.H * 0.45;
  out[0] = cx + (sx - cx) * kz;
  out[1] = cy + (sy - h * R.Sv - cy) * kz;
  out[2] = kz;
  return out;
}
const PT = [0, 0, 1], PT2 = [0, 0, 1];

// Lage der Sessel entlang des Seils: je Seite alle PISTE_LIFT_GAP_M, die eine Seite fährt bergauf, die andere bergab
function eachChair(lf, t, fn) {
  const gap = C.PISTE_LIFT_GAP_M, ph = (t * C.PISTE_LIFT_MS) % gap;
  for (const side of [-1, 1]) {
    for (let i = -8; i <= 8; i++) {
      const tt = i * gap + (side > 0 ? ph : gap - ph) + (side > 0 ? 0 : gap / 2);
      fn(lf.x + lf.nx * side * lf.half + lf.dx * tt, lf.y + lf.ny * side * lf.half + lf.dy * tt, side, i);
    }
  }
}

function liftShadow(R, lf, ox, oy, t) {
  const { ctx, Sv: S, W, H } = R;
  const off = 3.2, far = 110;
  ctx.strokeStyle = `rgba(${C.SHADOW_RGB},0.1)`; ctx.lineWidth = 2;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const bx = lf.x + lf.nx * side * lf.half + off, by = lf.y + lf.ny * side * lf.half;
    ctx.moveTo((bx - lf.dx * far) * S + ox, (by - lf.dy * far) * S + oy);
    ctx.lineTo((bx + lf.dx * far) * S + ox, (by + lf.dy * far) * S + oy);
  }
  ctx.stroke();
  const sp = R.pv.m.get('shadow') || sprite(R, 'shadow', 1.8, 1.8, 0.8, 0.8, (x, s) => soft(x, 0, 0, 1.7 * s, 0.7 * s, 0.26));
  eachChair(lf, t, (x, y) => {
    const sx = (x + off) * S + ox, sy = y * S + oy;
    if (sx < -40 || sx > W + 40 || sy < -30 || sy > H + 30) return;
    blit(R, sp, x + off, y, ox, oy);
  });
}

function liftOver(R, lf, ox, oy, t) {
  const { ctx, Sv: S, W, H } = R;
  const far = 110;
  ctx.strokeStyle = C.INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const bx = lf.x + lf.nx * side * lf.half, by = lf.y + lf.ny * side * lf.half;
    lifted(R, (bx - lf.dx * far) * S + ox, (by - lf.dy * far) * S + oy, lf.h, PT);
    lifted(R, (bx + lf.dx * far) * S + ox, (by + lf.dy * far) * S + oy, lf.h, PT2);
    ctx.moveTo(PT[0], PT[1]); ctx.lineTo(PT2[0], PT2[1]);
  }
  ctx.stroke();
  const k0 = S / R.S;
  eachChair(lf, t, (x, y, side, i) => {
    lifted(R, x * S + ox, y * S + oy, lf.h, PT);
    if (PT[0] < -60 || PT[0] > W + 60 || PT[1] < -90 || PT[1] > H + 20) return;
    const v = ((i % 4) + 4) % 4, up = side > 0;
    const key = lf.type === 'gondola' ? (up ? 'gondolaR' : 'gondolaB') : CHAIR_KEYS[up ? 1 : 0][v];
    const sp = R.pv.m.get(key) || (lf.type === 'gondola'
      ? sprite(R, key, 1.6, 1.6, 0.3, 4, (c, s) => gondolaShape(c, s, up ? C.GATE_RED : C.GATE_BLUE))
      : sprite(R, key, 2, 2, 0.3, 4, (c, s) => chairShape(c, s, 4, 40 + v * 7 + (up ? 0 : 3), up)));
    const k = k0 * PT[2];
    ctx.drawImage(sp.c, PT[0] - sp.ax * k, PT[1] - sp.ay * k, sp.w * k, sp.h * k);
  });
}

const CHAIR_KEYS = [[0, 1, 2, 3].map((v) => 'chairF' + v), [0, 1, 2, 3].map((v) => 'chairB' + v)];

// Stütze: der Fuß steht im Schnee, der Kopf mit dem Querträger liegt in Seilhöhe (siehe lifted)
function pylon(R, f, ox, oy) {
  const { ctx: x, Sv: S } = R;
  const lf = f.lift, ax = f.x * S + ox, ay = f.y * S + oy;
  lifted(R, ax, ay, lf.h, PT);
  const tx = PT[0], ty = PT[1], q = S * PT[2];
  soft(x, ax + 0.8 * S, ay, 1.3 * S, 0.45 * S, 0.3);
  x.lineCap = 'round';
  x.strokeStyle = C.INK; x.lineWidth = Math.max(4, 0.5 * S) + 2.4; x.beginPath(); x.moveTo(ax, ay); x.lineTo(tx, ty); x.stroke();
  x.strokeStyle = C.PISTE_STEEL; x.lineWidth = Math.max(4, 0.5 * S); x.beginPath(); x.moveTo(ax, ay); x.lineTo(tx, ty); x.stroke();
  x.strokeStyle = '#A9B4C0'; x.lineWidth = Math.max(1.2, 0.14 * S); x.beginPath(); x.moveTo(ax - 0.1 * S, ay - 0.2 * S); x.lineTo(tx - 0.1 * S, ty + 0.2 * S); x.stroke();
  const bx = ax + (tx - ax) * 0.14, by = ay + (ty - ay) * 0.14;
  x.fillStyle = C.PISTE_YELLOW; x.fillRect(bx - 0.32 * S, by - 0.25 * S, 0.64 * S, 0.5 * S); x.strokeStyle = C.INK; x.lineWidth = 1.2; x.strokeRect(bx - 0.32 * S, by - 0.25 * S, 0.64 * S, 0.5 * S);
  const ax0 = tx - lf.nx * lf.half * q, ay0 = ty - lf.ny * lf.half * q, ax1 = tx + lf.nx * lf.half * q, ay1 = ty + lf.ny * lf.half * q;
  x.strokeStyle = C.INK; x.lineWidth = Math.max(3, 0.34 * q) + 2.4; x.beginPath(); x.moveTo(ax0, ay0); x.lineTo(ax1, ay1); x.stroke();
  x.strokeStyle = C.PISTE_STEEL_DARK; x.lineWidth = Math.max(3, 0.34 * q); x.beginPath(); x.moveTo(ax0, ay0); x.lineTo(ax1, ay1); x.stroke();
  for (const [cx, cy] of [[ax0, ay0], [ax1, ay1]]) {
    for (const u of [-0.7, 0, 0.7]) {
      x.fillStyle = C.INK; x.beginPath(); x.arc(cx + lf.dx * u * q, cy + lf.dy * u * q, 0.24 * q, 0, TAU); x.fill();
      x.fillStyle = C.PISTE_YELLOW; x.beginPath(); x.arc(cx + lf.dx * u * q, cy + lf.dy * u * q, 0.1 * q, 0, TAU); x.fill();
    }
  }
}

// ---------- Stehende Dinge ----------

function lowerBound(arr, y) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].y < y) lo = m + 1; else hi = m; }
  return lo;
}

// Alles im Bild in die Liste der stehenden Dinge einsortieren (render.js sortiert sie mit Bäumen und Fahrer nach y)
export function pushPisteItems(R, g, oy, list) {
  const p = g.piste, L = g.life, S = R.Sv;
  const y0 = -oy / S - 2, y1 = (R.H - oy) / S + 11; // hohe Dinge ragen von unterhalb des Bildrands herein
  edgePoles(R, p, y0, y1, list);
  const F = p.feats;
  for (let i = lowerBound(F, y0); i < F.length && F[i].y <= y1; i++) {
    if (F[i].k !== 'deer' && F[i].k !== 'hare') list.push(F[i]);
  }
  if (!L) return;
  for (const st of L.secs) {
    if (st.sec.y1 < y0 || st.sec.y > y1) continue;
    for (const po of st.poles) if (po.y >= y0 && po.y <= y1) list.push(po);
  }
  for (const o of L.npcs) if (o.y >= y0 && o.y <= y1) list.push(o);
  for (const d of L.deer) if (d.run < 4 && d.y >= y0 && d.y <= y1) list.push(d);
  for (const h of L.hares) if (h.t >= 0 && h.t < HARE_S) { hareAt(p, h); list.push(h); }
}

// Randstangen alle PISTE_POLE_M in der Farbe des Zweigs; die Marker kommen aus einem Vorrat, damit pro Bild nichts
// Neues entsteht. In einer Gabelung stehen auch an den Innenrändern Stangen, sobald Wald dazwischen ist. Keine am
// Fangnetz, keine an der Wand der Steilkurve und keine hinter dem Ziel.
function edgePoles(R, p, y0, y1, list) {
  const gap = C.PISTE_POLE_M;
  const pool = R.edgePool || (R.edgePool = []);
  let n = 0;
  const put = (x, y, grade, right) => {
    const o = pool[n] || (pool[n] = { edge: true, x: 0, y: 0, grade: 0, right: false });
    n++;
    o.x = x; o.y = y; o.grade = grade; o.right = right;
    list.push(o);
  };
  for (let k = Math.max(0, Math.ceil(y0 / gap)); k * gap <= Math.min(y1, p.finishY - gap); k++) {
    const y = k * gap;
    if (netAt(p, y)) continue;
    const c0 = centerAt(p, y, 0), h0 = halfAt(p, y, 0) - 0.3, c1 = centerAt(p, y, 1), h1 = halfAt(p, y, 1) - 0.3;
    const g0 = gradeAt(p, y, 0), g1 = gradeAt(p, y, 1), bank = bankAt(p, y), bs = bank ? bank.side : 0;
    if (bs !== -1) put(Math.min(c0 - h0, c1 - h1), y, g0, false);
    if (bs !== 1) put(Math.max(c0 + h0, c1 + h1), y, g1, true);
    if (c1 - h1 - (c0 + h0) > 2.5) { put(c0 + h0, y, g0, true); put(c1 - h1, y, g1, false); }
  }
}

function hareAt(p, h) {
  const u = h.t / HARE_S, y = h.f.y + 4 * u, l = h.f.lane;
  const c = centerAt(p, y, l), w = halfAt(p, y, l) + 3;
  h.x = lerp(c - w, c + w, u); h.y = y;
}

const HATS = () => [C.INK, C.GATE_RED, C.PISTE_YELLOW];

// Bilder der stehenden Dinge: je Art der Schlüssel im Vorrat und der Bau (Fläche um den Fußpunkt, Form). Der
// Schlüssel wird einmal je Ding gemerkt (o.sk), im Bild wird dann nur noch nachgeschlagen und eingesetzt.
const SPRITES = {
  kicker: {
    key: (o) => 'kicker' + o.kind,
    make: (R, o, key) => (o.kind === KICK_ROLL
      ? sprite(R, key, o.w / 2 + 0.6, o.w / 2 + 0.6, 3.4, 2.4, (x, s) => rollerShape(x, s, o.w, 2.2))
      : sprite(R, key, o.w / 2 + 2.6, o.w / 2 + 2.6, o.L + 0.4, 1.4, (x, s) => kickerShape(x, s, o.w, o.L, o.h, o.kind === KICK_BIG ? C.GATE_RED : C.GATE_BLUE))),
  },
  hut: {
    key: (o) => 'hut' + o.name + o.w,
    make: (R, o, key) => sprite(R, key, o.w / 2 + 3.2, o.w / 2 + 4.4, 10.2, 1.6, (x, s) => hutShape(x, s, o.w, tr('hut.' + o.name), o.trim)),
  },
  person: {
    key: (o) => 'person' + o.col + '.' + o.hat,
    make: (R, o, key) => sprite(R, key, 0.7, 0.9, 2.1, 0.3, (x, s) => personShape(x, s, C.PISTE_NPC_COLORS[o.col % C.PISTE_NPC_COLORS.length], HATS()[o.hat % 3])),
  },
  umbrella: { key: () => 'umbrella', make: (R, o, key) => sprite(R, key, 1.9, 2.4, 3.3, 0.6, umbrellaShape) },
  rack: { key: (o) => 'rack' + o.n, make: (R, o, key) => sprite(R, key, 0.4, o.n * 0.32 + 0.4, 1.9, 0.2, (x, s) => rackShape(x, s, o.n)) },
  // die Turbine bläst über die Piste: links am Rand nach rechts, rechts am Rand gespiegelt
  cannon: { key: (o) => 'cannon' + o.side, make: (R, o, key) => sprite(R, key, 2.8, 2.8, 5.2, 0.7, (x, s) => { if (o.side > 0) x.scale(-1, 1); cannonShape(x, s); }) },
  board: { key: () => 'board', make: (R, o, key) => sprite(R, key, 4.4, 4.6, 6.4, 0.5, boardShape) },
  camera: { key: () => 'camera', make: (R, o, key) => sprite(R, key, 1.2, 1.2, 3.4, 0.4, cameraShape) },
  forksign: { key: (o) => 'fork' + o.fork.n, make: (R, o, key) => sprite(R, key, 9.3, 9.5, 6.4, 0.7, (x, s) => forkSignShape(x, s, o.fork)) },
  parksign: { key: () => 'park', make: (R, o, key) => sprite(R, key, 3.4, 3.6, 4.2, 0.4, parkSignShape) },
  mast: { key: (o) => 'mast' + o.dir, make: (R, o, key) => sprite(R, key, 2.3, 2.4, C.PISTE_MAST_H_M + 1, 0.5, (x, s) => mastShape(x, s, o.dir)) },
  arch: { key: (o) => 'arch' + o.half.toFixed(1), make: (R, o, key) => sprite(R, key, o.half + 1.6, o.half + 2, 6.8, 0.5, (x, s) => archShape(x, s, o.half)) },
};

export function drawPisteItem(R, g, o, ox, oy) {
  const S = R.Sv, L = g.life, ctx = R.ctx;
  const def = SPRITES[o.k];
  if (def) {
    const key = o.sk || (o.sk = def.key(o));
    blit(R, R.pv.m.get(key) || def.make(R, o, key), o.x, o.y, ox, oy);
    // Tafel der Tempomessung: die gemessene Zahl; Fotopunkt: der Blitz
    if (o.k === 'board') {
      const kmh = L ? L.trapKmh[o.trap.n] : 0;
      label(ctx, kmh > 0 ? num(Math.round(kmh)) : '– –', o.x * S + ox - 0.6 * S, o.y * S + oy - 3.65 * S, 1.9 * S, C.PISTE_YELLOW);
    } else if (o.k === 'camera' && L && L.flashT < C.PISTE_FLASH_S * 0.6) star(ctx, o.x * S + ox + 0.9 * S, o.y * S + oy - 3.2 * S, 1.1 * S);
    return;
  }
  if (o.k === 'pylon') pylon(R, o, ox, oy);
  else if (o.k === 'npc') npc(R, o, ox, oy);
  else if (o.k === 'deer') deer(R, o, ox, oy);
  else if (o.k === 'hare') hare(R, o, ox, oy);
}

function star(x, cx, cy, r) {
  x.save(); x.translate(cx, cy); x.fillStyle = C.PISTE_YELLOW; x.strokeStyle = C.INK; x.lineWidth = 1.2; x.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, q = (i % 2 ? 0.45 : 1) * r; if (i) x.lineTo(Math.cos(a) * q, Math.sin(a) * q); else x.moveTo(Math.cos(a) * q, Math.sin(a) * q); }
  x.closePath(); x.fill(); x.stroke(); x.restore();
}

function npc(R, o, ox, oy) {
  const { ctx, Sv: S } = R;
  const sx = o.x * S + ox, sy = o.y * S + oy;
  ctx.fillStyle = `rgba(${C.SHADOW_RGB},0.2)`;
  ctx.beginPath(); ctx.ellipse(sx + 0.3 * S, sy + 0.22 * S, 0.45 * S, 0.3 * S, 0, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(o.down > 0 ? 1.3 : -o.th); // nach einem Zusammenstoß liegt er quer
  npcShape(ctx, S, C.PISTE_NPC_COLORS[o.d.col], o.d.board);
  ctx.restore();
}

// Reh von der Seite: steht am Waldrand und schaut zur Piste, auf der Flucht dreht es sich um und die Beine wirbeln
function deer(R, d, ox, oy) {
  const { ctx: x, Sv: S } = R;
  const sx = d.x * S + ox, sy = d.y * S + oy, run = d.run >= 0;
  const face = run ? d.f.side : -d.f.side; // +1 = schaut nach rechts
  x.save(); x.translate(sx, sy); x.scale(face, 1);
  if (run) x.globalAlpha = clamp((3.2 - d.run) / 1.2, 0, 1);
  x.fillStyle = `rgba(${C.SHADOW_RGB},0.2)`; x.beginPath(); x.ellipse(0.2 * S, 0, 0.8 * S, 0.22 * S, 0, 0, TAU); x.fill();
  const hop = run ? Math.abs(Math.sin(d.run * 11)) * 0.25 * S : 0, sw = run ? Math.sin(d.run * 22) * 0.25 * S : 0;
  x.translate(0, -hop);
  x.strokeStyle = '#6B4F3B'; x.lineWidth = Math.max(1.4, 0.12 * S); x.lineCap = 'round';
  x.beginPath();
  x.moveTo(-0.5 * S, -0.75 * S); x.lineTo(-0.55 * S - sw, 0); x.moveTo(-0.35 * S, -0.75 * S); x.lineTo(-0.3 * S + sw, 0);
  x.moveTo(0.35 * S, -0.75 * S); x.lineTo(0.3 * S - sw, 0); x.moveTo(0.5 * S, -0.75 * S); x.lineTo(0.55 * S + sw, 0);
  x.stroke();
  x.fillStyle = '#9A6B45'; x.beginPath(); x.ellipse(0, -0.95 * S, 0.72 * S, 0.36 * S, 0, 0, TAU); x.fill();
  x.lineWidth = Math.max(2, 0.22 * S); x.strokeStyle = '#9A6B45'; x.beginPath(); x.moveTo(0.55 * S, -1.1 * S); x.lineTo(0.8 * S, -1.65 * S); x.stroke();
  x.beginPath(); x.ellipse(0.92 * S, -1.72 * S, 0.24 * S, 0.16 * S, 0.2, 0, TAU); x.fill();
  x.strokeStyle = '#6B4F3B'; x.lineWidth = Math.max(1, 0.07 * S);
  x.beginPath(); x.moveTo(0.78 * S, -1.85 * S); x.lineTo(0.68 * S, -2.2 * S); x.moveTo(0.86 * S, -1.87 * S); x.lineTo(0.92 * S, -2.22 * S); x.stroke();
  x.fillStyle = C.PISTE_PAPER; x.beginPath(); x.ellipse(-0.7 * S, -1.0 * S, 0.12 * S, 0.16 * S, 0, 0, TAU); x.fill();
  x.restore();
}

function hare(R, h, ox, oy) {
  const { ctx: x, Sv: S } = R;
  const sx = h.x * S + ox, sy = h.y * S + oy, z = Math.abs(Math.sin(h.t * 9)) * 0.4 * S;
  x.fillStyle = `rgba(${C.SHADOW_RGB},0.2)`; x.beginPath(); x.ellipse(sx + 0.1 * S, sy, 0.35 * S, 0.12 * S, 0, 0, TAU); x.fill();
  x.save(); x.translate(sx, sy - z);
  x.fillStyle = '#B9A58C'; x.strokeStyle = C.INK; x.lineWidth = Math.max(0.8, 0.04 * S);
  x.beginPath(); x.ellipse(0, -0.25 * S, 0.34 * S, 0.22 * S, 0, 0, TAU); x.fill(); x.stroke();
  x.beginPath(); x.ellipse(0.32 * S, -0.42 * S, 0.16 * S, 0.14 * S, 0, 0, TAU); x.fill(); x.stroke();
  x.beginPath(); x.ellipse(0.3 * S, -0.68 * S, 0.05 * S, 0.17 * S, -0.2, 0, TAU); x.fill(); x.stroke();
  x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(-0.34 * S, -0.28 * S, 0.09 * S, 0, TAU); x.fill();
  x.restore();
}

// ---------- Über dem Fahrer ----------

export function drawPisteOver(R, g, ox, oy, t) {
  const p = g.piste, L = g.life, s = g.skier, { ctx, Sv: S, W, H } = R;
  const y0 = -oy / S, y1 = (H - oy) / S, mid = (y0 + y1) / 2;
  if (L) for (const f of L.cannons) if (f.y > y0 - 8 && f.y < y1 + 8) plume(R, f, ox, oy, t);
  for (const lf of p.lifts) if (Math.abs(lf.y - mid) < 130) liftOver(R, lf, ox, oy, t);
  const dark = nightAt(s.y);
  if (dark > 0.01 && C.PISTE_NIGHT_ALPHA > 0) night(R, p, ox, oy, y0, y1, dark);
  if (!L) return;
  if (L.flashT < C.PISTE_FLASH_S) {
    ctx.fillStyle = `rgba(255,255,255,${(0.55 * (1 - L.flashT / C.PISTE_FLASH_S)).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Name des Tricks am Fahrer, solange er fliegt und kurz danach
  if (L.trick && L.trickT < C.PISTE_TRICK_SHOW_S && g.state === 'running') {
    const z = L.air ? airPose(L, POSE).z : 0;
    const text = tr('trick.' + L.trick[0]);
    ctx.font = `13px ${FONT}`;
    const w = ctx.measureText(text).width + 16;
    const cx = clamp(s.x * S + ox + 4.2 * S, w / 2 + 6, W - w / 2 - 6);
    plate(ctx, cx, s.y * S + oy - z * S - 2.4 * S, w, 22, { fill: C.PISTE_YELLOW, tilt: -4, sh: 2, r: 6, draw: (c) => label(c, text, 0, 0, 13, C.INK) });
  }
  // Vor einer Gabelung: die beiden Schilder am oberen Bildrand, bis sich die Zweige trennen
  for (const f of p.forks) {
    if (s.y < f.y0 - 260 || s.y > f.tipY || g.state !== 'running') continue;
    const top = R.safeTop + 30;
    forkTag(ctx, 10, top, f.grades[0], false);
    forkTag(ctx, W - 10, top, f.grades[1], true);
  }
}
const POSE = { z: 0, rot: 0, flip: 1, cross: false, spread: false };

function forkTag(ctx, edge, top, grade, right) {
  const text = tr('piste.fork.' + grade);
  ctx.font = `14px ${FONT}`;
  const w = ctx.measureText(text).width + 62, h = 28, cx = right ? edge - w / 2 : edge + w / 2;
  plate(ctx, cx, top + h / 2, w, h, { tilt: right ? 1.5 : -1.5, sh: 2.5, r: 7, draw: (c) => {
    const d = right ? 1 : -1;
    arrow(c, d * (w / 2 - 13), 0, 13, right ? 0 : Math.PI, gradeCol(grade), 3);
    disc(c, d * (w / 2 - 34), 0, 8, gradeCol(grade));
    label(c, text, d * (w / 2 - 47), 0, 14, C.INK, right ? 'right' : 'left');
  } });
}

// Nebel der Schneekanone: Wolken, die von der Düse quer über die Piste treiben, größer und blasser werden
function plume(R, f, ox, oy, t) {
  const { ctx, Sv: S } = R;
  const N = C.PISTE_CANNON_PUFFS, dir = -f.side;
  const white = R.pv.m.get('puff') || sprite(R, 'puff', 1, 1, 1, 1, (x, s) => soft(x, 0, 0, s, s, 1, '255,255,255'));
  const shade = R.pv.m.get('puffShade') || sprite(R, 'puffShade', 1, 1, 1, 1, (x, s) => soft(x, 0, 0, s, s, 1, C.AV_SHADE_RGB));
  const k = S / R.S;
  for (let i = 0; i < N; i++) {
    const u = (i / N + t * 0.22) % 1;
    const jx = hash(i * 13 + 1) - 0.5, jy = hash(i * 29 + 5) - 0.5;
    const px = f.x + dir * (1.8 + u * C.PISTE_CANNON_REACH_M + jx * 1.5), py = f.y - 3.8 + u * 3.4 + jy * (0.6 + u * 4.2) * 1.6;
    const r = (0.9 + u * 2.4 + hash(i * 7) * 0.6) * R.S * k, a = Math.min(1, u * 8) * (0.5 - u * 0.24);
    ctx.globalAlpha = a * 0.5;
    ctx.drawImage(shade.c, (px + 0.35) * S + ox - r, (py + 0.4) * S + oy - r * 0.8, 2 * r, 1.6 * r);
    ctx.globalAlpha = a;
    ctx.drawImage(white.c, px * S + ox - r, py * S + oy - r * 0.8, 2 * r, 1.6 * r);
  }
  ctx.globalAlpha = 1;
}

// Dunkelheit mit Lichtkegeln: klein gerechnet (ein Achtel der Auflösung) und weich vergrößert, das kostet fast nichts
// und die Ränder der Kegel werden von selbst weich. Aus der dunklen Fläche wird unter jedem Mast ein Oval herausgenommen.
const NIGHT_DIV = 8;
function night(R, p, ox, oy, y0, y1, dark) {
  const { ctx, Sv: S, W, H } = R;
  const pv = R.pv;
  const cw = Math.ceil(W / NIGHT_DIV), ch = Math.ceil(H / NIGHT_DIV);
  if (!pv.night || pv.night.width !== cw || pv.night.height !== ch) { pv.night = document.createElement('canvas'); pv.night.width = cw; pv.night.height = ch; }
  const x = pv.night.getContext('2d');
  x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, cw, ch);
  x.fillStyle = `rgba(${C.PISTE_NIGHT_RGB},${(C.PISTE_NIGHT_ALPHA * dark).toFixed(3)})`;
  x.fillRect(0, 0, cw, ch);
  x.globalCompositeOperation = 'destination-out';
  const [lw, lh] = C.PISTE_LIGHT_M, F = p.feats, q = 1 / NIGHT_DIV;
  const i0 = lowerBound(F, y0 - lh - 6);
  for (let i = i0; i < F.length && F[i].y <= y1 + lh; i++) {
    const f = F[i];
    if (f.k !== 'mast') continue;
    x.save(); x.translate((f.tx * S + ox) * q, (f.ty * S + oy) * q); x.scale(lw * S * q, lh * S * q);
    const gr = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore();
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(pv.night, 0, 0, W, H);
  // die Lampen selbst leuchten
  const glow = R.pv.m.get('glow') || sprite(R, 'glow', 1, 1, 1, 1, (c, s) => soft(c, 0, 0, s, s, 0.6, C.PISTE_LAMP_RGB));
  const k = S / R.S;
  ctx.globalAlpha = dark;
  for (let i = i0; i < F.length && F[i].y <= y1 + 10; i++) {
    const f = F[i];
    if (f.k !== 'mast') continue;
    const hx = (f.x + f.dir * 1.3) * S + ox, hy = (f.y - C.PISTE_MAST_H_M + 0.3) * S + oy, r = 3 * R.S * k;
    ctx.drawImage(glow.c, hx - r, hy - r * 0.75, 2 * r, 1.5 * r);
  }
  ctx.globalAlpha = 1;
}

// ---------- Pistenplan (Fresh-Seite) ----------

// Die Strecke von links (Start) nach rechts (Talstation): unten das Profil der Schwierigkeit wie bei einer Etappe,
// darüber die Piste mit ihren Gabelungen in den Farben der Zweige. Der gefahrene Weg ist kräftig, der andere Zweig
// blass; Kreuze markieren die Stürze, der Punkt die Stelle, an der Schluss war.
export function drawPistePlan(canvas, g) {
  const W = canvas.clientWidth || 280, H = canvas.clientHeight || 64;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const x = canvas.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  x.lineCap = 'round'; x.lineJoin = 'round';
  const L = g.life, fin = C.PISTE_FINISH_M, pad = 9;
  const X = (m) => pad + (clamp(m, 0, fin) / fin) * (W - 2 * pad);
  const base = H - 3, line = 25, amp = 9, profH = H - line - amp - 10;
  // Profil (nur, wenn die Höhe dafür reicht)
  if (profH >= 8) {
    x.fillStyle = 'rgba(20,20,15,0.10)';
    x.beginPath(); x.moveTo(X(0), base);
    for (let m = 0; m <= fin; m += 50) x.lineTo(X(m), base - (profileAt(m) / 10) * profH);
    x.lineTo(X(fin), base); x.closePath(); x.fill();
  }
  const end = g.state === 'finished' && g.finTime > 0 ? fin : Math.min(fin, g.dist);
  // Strecke: Abschnitte der Hauptpiste in ihrer Farbe, dazwischen die Gabelungen als Auge
  const seg = (a, b, y, col, on) => {
    x.globalAlpha = on ? 1 : 0.3;
    x.strokeStyle = col; x.lineWidth = 4;
    x.beginPath(); x.moveTo(X(a), y); x.lineTo(X(b), y); x.stroke();
  };
  const forks = C.PISTE_FORKS;
  let from = 0;
  const main = (a, b) => {
    for (let m = a; m < b; m += 100) {
      const e = Math.min(b, m + 100), gr = profileAt((m + e) / 2);
      seg(m, e, line, gradeCol(gr < C.PISTE_BLUE_TO ? 0 : gr < C.PISTE_RED_TO ? 1 : 2), true);
    }
  };
  forks.forEach(([fy, len, gl, gr], i) => {
    main(from, fy);
    const took = L ? L.route[i] : -1;
    for (const [lane, grade, dy] of [[0, gl, -amp], [1, gr, amp]]) {
      const on = took < 0 || took === lane;
      x.globalAlpha = on ? 1 : 0.3;
      x.strokeStyle = gradeCol(grade); x.lineWidth = 4;
      const xa = X(fy), xb = X(fy + len), r = Math.min(8, (xb - xa) / 3);
      x.beginPath(); x.moveTo(xa, line); x.lineTo(xa + r, line + dy); x.lineTo(xb - r, line + dy); x.lineTo(xb, line); x.stroke();
    }
    from = fy + len;
  });
  main(from, fin);
  x.globalAlpha = 1;
  // Zeichen an der Strecke: Hütte, Lift, Funpark, Tore
  for (const it of C.PISTE_LAYOUT) {
    const cx = X(it.y), cy = line - amp - 10;
    x.fillStyle = C.INK; x.strokeStyle = C.INK; x.lineWidth = 1.3;
    if (it.k === 'hut') { x.beginPath(); x.moveTo(cx - 4, cy + 1); x.lineTo(cx, cy - 4); x.lineTo(cx + 4, cy + 1); x.closePath(); x.fill(); x.fillRect(cx - 3, cy + 1, 6, 3.5); }
    else if (it.k === 'lift') { x.beginPath(); x.moveTo(cx - 5, cy - 3); x.lineTo(cx + 5, cy + 1); x.stroke(); x.fillRect(cx - 1.5, cy - 0.5, 3.5, 4); }
    else if (it.k === 'park') { x.beginPath(); x.moveTo(cx - 4, cy + 4); x.lineTo(cx + 4, cy + 4); x.lineTo(cx + 4, cy - 2); x.closePath(); x.fill(); }
    else if (it.k === 'gates') { x.beginPath(); x.moveTo(cx - 2, cy + 4); x.lineTo(cx - 2, cy - 4); x.stroke(); x.fillStyle = C.GATE_RED; x.fillRect(cx - 2, cy - 4, 6, 4); }
  }
  // Ziel: kleine Flagge
  x.strokeStyle = C.INK; x.lineWidth = 1.5; x.beginPath(); x.moveTo(X(fin), line + 5); x.lineTo(X(fin), line - 12); x.stroke();
  x.fillStyle = C.INK; x.fillRect(X(fin) - 7, line - 12, 7, 5);
  if (!L) return;
  const laneY = (m) => {
    for (let i = 0; i < forks.length; i++) {
      const [fy, len] = forks[i];
      if (m > fy && m < fy + len && L.route[i] >= 0) return line + (L.route[i] ? amp : -amp) * smooth(Math.min(m - fy, fy + len - m) / (len * 0.12));
    }
    return line;
  };
  x.strokeStyle = C.GATE_RED; x.lineWidth = 2;
  for (const m of L.crashAt) {
    const cx = X(m), cy = laneY(m);
    x.beginPath(); x.moveTo(cx - 3.5, cy - 3.5); x.lineTo(cx + 3.5, cy + 3.5); x.moveTo(cx + 3.5, cy - 3.5); x.lineTo(cx - 3.5, cy + 3.5); x.stroke();
  }
  x.fillStyle = C.PISTE_YELLOW; x.strokeStyle = C.INK; x.lineWidth = 2;
  x.beginPath(); x.arc(X(end), laneY(end), 5, 0, TAU); x.fill(); x.stroke();
}
