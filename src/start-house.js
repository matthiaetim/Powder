// Torlauf: Starthaus (Slalom und Super-G) und Starthügel (nur Slalom, der Schub auf dem steilen Stück: game.js
// startBoost) im Bild, Idee von Jürgen.
// Das Starthaus steht wie Bäume und Stangen vom Fußpunkt nach oben, knapp oberhalb der Startlinie auf der Pistenmitte,
// der Fahrer steht im offenen Tor: ein Blockhaus mit verschneitem Satteldach, roten Ortgängen und dem Schild „Start“
// im Giebel, daneben zwei Fahnenmasten mit Wimpelketten. Über dem Tor läuft die Uhr, rechts steht die Startampel:
// mit jedem Piepton des Countdowns leuchtet eine rote Lampe mehr, beim Go springt sie auf Grün und der rot-weiße
// Startbügel vor dem Tor schwingt auf.
// Alles Feste liegt einmal vorgerendert in einem Sprite (je Maßstab, Schrift und Sprache), nur Uhr, Lampen, Bügel
// und Fahnen werden je Bild gezeichnet.
// Der Starthügel (die ersten SL_START_RAMP_M) ist eine Rinne zwischen zwei Schneewällen, oben bläulich schattiert;
// gesprühte Winkel zeigen talwärts und rücken auseinander, wie der Fahrer schneller wird. Die Ski verwischen sie.
import { C } from './constants.js';
import { laneX } from './world.js';
import { cv, guideX } from './gates.js';
import { t, getLang, sep } from './i18n.js';
import { makeMark } from './gate-marks.js';
import { scrubRect } from './snow-scrub.js';

const TAU = Math.PI * 2;
const FONT = "'Luckiest Guy', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
// Maße in m, Höhen über dem Schnee
const HOUSE_W = 6.4, WALL_H = 3.3, DOOR_W = 2.8, DOOR_H = 2.5, ROOF_H = 2.1, EAVE = 0.6, SNOW_H = 0.5;
const FOOT_Y = -0.5;                 // Front des Hauses knapp oberhalb der Startlinie
const WAND_Y = 0.1, WAND_Z = 0.5;    // Startbügel: steht knapp vor der Linie, in Schienbeinhöhe
const MAST_X = 6.4, MAST_H = 5.4;    // Fahnenmasten links und rechts
const LIGHT_X = HOUSE_W / 2 + 1.25;  // Startampel rechts neben dem Tor
const CLOCK_W = 2.5, CLOCK_H = 0.6, CLOCK_Z = DOOR_H + 0.12;
const RAMP_HALF = 4.2;               // halbe Breite der Rinne
const BUNTING = [C.GATE_RED, C.SH_LED, C.GATE_BLUE];

function makeCanvas(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  return [c, x];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
}

// Text in die Breite einpassen (die Sprachen sind verschieden lang)
function fitText(ctx, text, cx, cy, maxW, px) {
  ctx.font = `${px}px ${FONT}`;
  const w = ctx.measureText(text).width;
  if (w > maxW) ctx.font = `${(px * maxW) / w}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy);
}

// ---------- Starthaus: das Feste ----------

function buildHouse(R) {
  const S = R.S;
  const left = MAST_X + 1.4, top = MAST_H + 0.9, bottom = 1.2;
  const w = 2 * left * S, h = (top + bottom) * S;
  const [c, x] = makeCanvas(w, h, R.dpr);
  const ax = left * S, ay = top * S;
  const X = (m) => ax + m * S, Z = (m) => ay - m * S;
  const ol = Math.max(1.2, 0.09 * S), sh = 0.22 * S;
  x.lineJoin = 'round';
  x.lineCap = 'round';

  // weicher Schatten nach rechts wie bei den Bäumen
  const gr = x.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, `rgba(${C.SHADOW_RGB},0.3)`);
  gr.addColorStop(1, `rgba(${C.SHADOW_RGB},0)`);
  x.save();
  x.translate(X(1.6), ay + 0.15 * S);
  x.scale((HOUSE_W / 2 + 1.8) * S, 0.85 * S);
  x.fillStyle = gr;
  x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill();
  x.restore();

  // Fahnenmasten mit Kugel, dahinter beginnt die Wimpelkette
  for (const side of [-1, 1]) {
    const mx = X(side * MAST_X);
    x.fillStyle = C.INK;
    x.fillRect(mx - 0.06 * S, Z(MAST_H), 0.12 * S, MAST_H * S);
    x.beginPath(); x.arc(mx, Z(MAST_H), 0.14 * S, 0, TAU); x.fill();
  }
  // Wimpelketten vom Mast zur Traufe, leicht durchhängend
  for (const side of [-1, 1]) {
    const x0 = X(side * MAST_X), z0 = MAST_H - 0.5, x1 = X(side * (HOUSE_W / 2 + EAVE - 0.1)), z1 = WALL_H + 0.25;
    const at = (u) => { const sag = 4 * u * (1 - u) * 0.7; return [x0 + (x1 - x0) * u, Z(z0 + (z1 - z0) * u - sag)]; };
    x.strokeStyle = C.INK; x.lineWidth = Math.max(0.8, 0.04 * S);
    x.beginPath();
    for (let i = 0; i <= 16; i++) { const [px, py] = at(i / 16); if (i) x.lineTo(px, py); else x.moveTo(px, py); }
    x.stroke();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const [px, py] = at((i + 0.5) / n), wv = 0.2 * S, hv = 0.34 * S;
      x.fillStyle = BUNTING[i % BUNTING.length];
      x.beginPath(); x.moveTo(px - wv, py); x.lineTo(px + wv, py); x.lineTo(px, py + hv); x.closePath(); x.fill();
      x.strokeStyle = C.INK; x.lineWidth = Math.max(0.6, 0.03 * S); x.stroke();
    }
  }

  // Wand: Blockhaus aus Bohlen, harte Schattenkante wie bei den Schildern
  const wl = X(-HOUSE_W / 2), wt = Z(WALL_H), ww = HOUSE_W * S, wh = WALL_H * S;
  x.fillStyle = C.INK; x.fillRect(wl + sh, wt + sh, ww, wh);
  const logs = 9;
  for (let i = 0; i < logs; i++) {
    x.fillStyle = i % 2 ? C.SH_WOOD : C.SH_WOOD_LIGHT;
    x.fillRect(wl, wt + (i * wh) / logs, ww, wh / logs + 0.5);
  }
  x.strokeStyle = 'rgba(20,20,15,0.22)'; x.lineWidth = Math.max(0.7, 0.035 * S);
  x.beginPath();
  for (let i = 1; i < logs; i++) { x.moveTo(wl, wt + (i * wh) / logs); x.lineTo(wl + ww, wt + (i * wh) / logs); }
  x.stroke();
  // Eckbalken
  x.fillStyle = C.SH_WOOD_DARK;
  x.fillRect(wl, wt, 0.32 * S, wh);
  x.fillRect(wl + ww - 0.32 * S, wt, 0.32 * S, wh);

  // Fenster mit warmem Licht
  for (const side of [-1, 1]) {
    const fx = X(side * (DOOR_W / 2 + (HOUSE_W - DOOR_W) / 4) - 0.45), fz = Z(2.05), fs = 0.9 * S;
    x.fillStyle = C.SH_WOOD_DARK; x.fillRect(fx - 0.1 * S, fz - 0.1 * S, fs + 0.2 * S, fs + 0.2 * S);
    x.fillStyle = C.SH_LED; x.fillRect(fx, fz, fs, fs);
    x.fillStyle = 'rgba(255,255,255,0.45)'; x.fillRect(fx, fz, fs * 0.45, fs);
    x.strokeStyle = C.INK; x.lineWidth = Math.max(0.8, 0.05 * S);
    x.beginPath(); x.moveTo(fx + fs / 2, fz); x.lineTo(fx + fs / 2, fz + fs); x.moveTo(fx, fz + fs / 2); x.lineTo(fx + fs, fz + fs / 2); x.stroke();
    x.strokeRect(fx, fz, fs, fs);
    // Schnee auf dem Fensterbrett
    x.fillStyle = C.SH_SNOW;
    roundRect(x, fx - 0.16 * S, fz + fs - 0.02 * S, fs + 0.32 * S, 0.2 * S, 0.1 * S); x.fill();
    x.lineWidth = Math.max(0.7, 0.04 * S); x.stroke();
  }

  // Tor: dunkler Innenraum, hinten dunkler, unten die Kante der Startrampe aus hellem Holz
  const dl = X(-DOOR_W / 2), dt = Z(DOOR_H), dw = DOOR_W * S, dh = DOOR_H * S;
  x.fillStyle = C.SH_WOOD_DARK; x.fillRect(dl - 0.18 * S, dt - 0.18 * S, dw + 0.36 * S, dh + 0.18 * S);
  const dg = x.createLinearGradient(0, dt, 0, dt + dh);
  dg.addColorStop(0, '#15100C'); dg.addColorStop(1, C.SH_DOOR);
  x.fillStyle = dg; x.fillRect(dl, dt, dw, dh);
  x.fillStyle = C.SH_WOOD_LIGHT; x.fillRect(dl, Z(0.22), dw, 0.22 * S);
  x.strokeStyle = C.INK; x.lineWidth = ol;
  x.strokeRect(dl, dt, dw, dh);
  x.strokeRect(wl, wt, ww, wh);

  // Uhr über dem Tor: schwarzes Gehäuse, die Ziffern kommen je Bild dazu
  x.fillStyle = C.INK;
  roundRect(x, X(-CLOCK_W / 2), Z(CLOCK_Z + CLOCK_H), CLOCK_W * S, CLOCK_H * S, 0.12 * S); x.fill();

  // Giebel aus senkrechten Brettern
  const rz = WALL_H - 0.05, rl = X(-HOUSE_W / 2 - EAVE), rr = X(HOUSE_W / 2 + EAVE), pk = Z(rz + ROOF_H);
  const gable = () => { x.beginPath(); x.moveTo(rl, Z(rz)); x.lineTo(ax, pk); x.lineTo(rr, Z(rz)); x.closePath(); };
  x.fillStyle = C.INK;
  x.beginPath(); x.moveTo(rl + sh, Z(rz) + sh); x.lineTo(ax + sh, pk + sh); x.lineTo(rr + sh, Z(rz) + sh); x.closePath(); x.fill();
  gable(); x.fillStyle = C.SH_WOOD; x.fill();
  x.save();
  gable(); x.clip();
  x.strokeStyle = 'rgba(20,20,15,0.2)'; x.lineWidth = Math.max(0.7, 0.035 * S);
  x.beginPath();
  for (let m = -HOUSE_W / 2 - EAVE; m <= HOUSE_W / 2 + EAVE; m += 0.45) { x.moveTo(X(m), Z(rz)); x.lineTo(X(m), pk); }
  x.stroke();
  x.restore();
  // Ortgänge: rote Balken entlang der Dachschrägen
  x.strokeStyle = C.INK; x.lineWidth = 0.42 * S + 2 * ol;
  x.beginPath(); x.moveTo(rl, Z(rz)); x.lineTo(ax, pk); x.lineTo(rr, Z(rz)); x.stroke();
  x.strokeStyle = C.GATE_RED; x.lineWidth = 0.42 * S;
  x.beginPath(); x.moveTo(rl, Z(rz)); x.lineTo(ax, pk); x.lineTo(rr, Z(rz)); x.stroke();
  x.strokeStyle = C.GATE_RED_LIGHT; x.lineWidth = 0.14 * S;
  x.beginPath(); x.moveTo(rl, Z(rz + 0.12)); x.lineTo(ax, pk - 0.12 * S); x.stroke();
  // Schnee auf dem Dach: dicke Auflage mit runder Kuppe und Wülsten an den Traufen, rechts im Schatten
  const snow = () => {
    const e = 0.28 * S, th = SNOW_H * S;
    x.beginPath();
    x.moveTo(rl - e, Z(rz) + 0.12 * S);
    x.quadraticCurveTo(rl - e - 0.2 * S, Z(rz) - th * 0.6, rl + 0.2 * S, Z(rz) - th * 1.1);
    x.quadraticCurveTo(ax - 1.2 * S, pk - th * 0.4, ax, pk - th * 1.25);
    x.quadraticCurveTo(ax + 1.2 * S, pk - th * 0.4, rr - 0.2 * S, Z(rz) - th * 1.1);
    x.quadraticCurveTo(rr + e + 0.2 * S, Z(rz) - th * 0.6, rr + e, Z(rz) + 0.12 * S);
    x.quadraticCurveTo(rr - 0.1 * S, Z(rz) - 0.05 * S, rr - 0.35 * S, Z(rz) - 0.3 * S);
    x.lineTo(ax, pk - 0.22 * S);
    x.lineTo(rl + 0.35 * S, Z(rz) - 0.3 * S);
    x.quadraticCurveTo(rl + 0.1 * S, Z(rz) - 0.05 * S, rl - e, Z(rz) + 0.12 * S);
    x.closePath();
  };
  snow(); x.fillStyle = C.SH_SNOW; x.fill();
  x.save();
  snow(); x.clip();
  x.fillStyle = C.SH_SNOW_SHADE;
  x.beginPath(); x.moveTo(ax, pk - SNOW_H * S * 1.4); x.lineTo(rr + S, Z(rz) - SNOW_H * S * 1.4); x.lineTo(rr + S, Z(rz) + S); x.lineTo(ax + 0.5 * S, Z(rz) + S); x.closePath(); x.fill();
  x.restore();
  snow(); x.strokeStyle = C.INK; x.lineWidth = ol; x.stroke();

  // Schild im Giebel
  const pw = 3.1, ph = 0.9, pz = rz + 0.32;
  x.save();
  x.translate(ax, Z(pz + ph / 2));
  x.rotate(-0.02);
  x.fillStyle = C.INK; roundRect(x, (-pw / 2) * S + sh * 0.6, (-ph / 2) * S + sh * 0.6, pw * S, ph * S, 0.16 * S); x.fill();
  x.fillStyle = C.BOARD_FILL; roundRect(x, (-pw / 2) * S, (-ph / 2) * S, pw * S, ph * S, 0.16 * S); x.fill();
  x.strokeStyle = C.INK; x.lineWidth = ol; x.stroke();
  x.fillStyle = C.GATE_RED;
  fitText(x, t('sign.start').toUpperCase(), 0, 0.05 * S, (pw - 0.4) * S, ph * 0.74 * S);
  x.restore();

  // Startampel: Pfosten und Gehäuse, die Lampen kommen je Bild dazu
  const lx = X(LIGHT_X);
  x.fillStyle = C.INK;
  x.fillRect(lx - 0.07 * S, Z(1.2), 0.14 * S, 1.2 * S);
  roundRect(x, lx - 0.36 * S + sh * 0.5, Z(3.3) + sh * 0.5, 0.72 * S, 2.2 * S, 0.16 * S); x.fill();
  roundRect(x, lx - 0.36 * S, Z(3.3), 0.72 * S, 2.2 * S, 0.16 * S); x.fill();
  // Pfosten des Startbügels links vor dem Tor
  x.fillStyle = C.SH_WOOD_DARK;
  const py = Z(WAND_Z + 0.25) + (WAND_Y - FOOT_Y) * S;
  x.fillRect(X(-DOOR_W / 2 - 0.1), py, 0.2 * S, (WAND_Z + 0.3) * S);
  x.strokeStyle = C.INK; x.lineWidth = Math.max(0.8, 0.05 * S);
  x.strokeRect(X(-DOOR_W / 2 - 0.1), py, 0.2 * S, (WAND_Z + 0.3) * S);
  return { img: c, w, h, ax, ay };
}

function houseFor(R) {
  const key = R.spriteKey + '|' + (R.fontReady ? 1 : 0) + '|' + getLang();
  if (!R.startHouse || R.startHouse.key !== key) R.startHouse = { key, sp: buildHouse(R) };
  return R.startHouse.sp;
}

// Laufzeit wie das HUD: mit Strafen, nach dem Ziel die Gesamtzeit, vor dem Go 0,00
export function clockText(g) {
  const cs = g.course;
  const running = g.state === 'running' || (g.state === 'paused' && g.pausedFrom === 'running');
  const v = cs.finished ? cs.total : running ? g.runT + cs.penalty : 0;
  const m = Math.floor(v / 60), s = v - m * 60;
  const ss = s.toFixed(2).replace('.', sep());
  return m > 0 ? `${m}:${s < 10 ? '0' : ''}${ss}` : ss;
}

// Wimpel am Mast: weht nach rechts, Wellen laufen hindurch
function pennant(ctx, x, y, S, col, time, ph) {
  const L = 1.5 * S, Hh = 0.75 * S, n = 8;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = i / n, wv = Math.sin(time * 5 - u * 5 + ph) * 0.12 * S * u;
    ctx.lineTo(x + u * L, y + wv + u * Hh * 0.5);
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n, wv = Math.sin(time * 5 - u * 5 + ph) * 0.12 * S * u;
    ctx.lineTo(x + u * L, y + Hh + wv - u * Hh * 0.5);
  }
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = C.INK; ctx.lineWidth = Math.max(0.8, 0.05 * S); ctx.lineJoin = 'round'; ctx.stroke();
}

// Starthaus: vor dem Fahrer gezeichnet (es steht oberhalb der Linie, er davor)
export function drawStartHouse(R, g, ox, oy, time) {
  const cs = g.course;
  if (!cs || !cs.spec.house) return;
  const { ctx, Sv: S, H, W } = R;
  if ((FOOT_Y - MAST_H - 1) * S + oy > H || (FOOT_Y + 1.5) * S + oy < 0) return;
  const cx = laneX(g.world, 0) * S + ox, fy = FOOT_Y * S + oy;
  if (cx < -(MAST_X + 2) * S || cx > W + (MAST_X + 2) * S) return;
  const sp = houseFor(R), k = S / R.S;
  ctx.drawImage(sp.img, cx - sp.ax * k, fy - sp.ay * k, sp.w * k, sp.h * k);
  const X = (m) => cx + m * S, Z = (m) => fy - m * S;

  // Wimpel an den Masten
  pennant(ctx, X(-MAST_X) + 0.06 * S, Z(MAST_H - 0.25), S, C.GATE_RED, time, 0);
  pennant(ctx, X(MAST_X) + 0.06 * S, Z(MAST_H - 0.25), S, C.GATE_BLUE, time, 1.7);

  // Uhr
  ctx.fillStyle = C.SH_LED;
  fitText(ctx, clockText(g), cx, Z(CLOCK_Z + CLOCK_H / 2) + 0.04 * S, (CLOCK_W - 0.3) * S, CLOCK_H * 0.8 * S);

  // Startampel: drei rote Lampen zählen mit den Pieptönen hoch, beim Go Grün
  const go = g.state === 'running' || g.state === 'finished' || (g.state === 'paused' && g.pausedFrom === 'running');
  const counting = g.state === 'count' || (g.state === 'paused' && g.pausedFrom === 'count');
  const reds = counting ? Math.min(C.SG_COUNT_BEEPS, g.countBeeps) : 0;
  const lx = X(LIGHT_X);
  const lamp = (z, on, col) => {
    const ly = Z(z), r = 0.2 * S;
    if (on) {
      const gl = ctx.createRadialGradient(lx, ly, r * 0.4, lx, ly, r * 2.6);
      gl.addColorStop(0, col + 'AA'); gl.addColorStop(1, col + '00');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(lx, ly, r * 2.6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = on ? col : C.SH_LAMP_OFF;
    ctx.beginPath(); ctx.arc(lx, ly, r, 0, TAU); ctx.fill();
    if (on) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(lx - r * 0.3, ly - r * 0.3, r * 0.32, 0, TAU); ctx.fill(); }
  };
  for (let i = 0; i < 3; i++) lamp(3.0 - i * 0.5, !go && reds > i, C.SH_LAMP_RED);
  lamp(1.45, go, C.SH_LAMP_GREEN);

  // Startbügel vor dem Tor in Schienbeinhöhe; schwingt beim Go um sein linkes Ende talwärts auf
  const open = go ? Math.min(1, g.runT / C.SH_WAND_OPEN_S) : 0;
  const e = open * open * (3 - 2 * open);
  const barL = (DOOR_W + 0.2) * S, hx = X(-DOOR_W / 2), hy = (WAND_Y - WAND_Z) * S + oy;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(e * 1.4);
  const bh = Math.max(3, 0.18 * S);
  ctx.fillStyle = C.INK; ctx.fillRect(1.5, -bh / 2 + 1.5, barL, bh);
  for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? C.BOARD_FILL : C.GATE_RED; ctx.fillRect((i * barL) / 7, -bh / 2, barL / 7 + 0.5, bh); }
  ctx.strokeStyle = C.INK; ctx.lineWidth = Math.max(1, 0.05 * S);
  ctx.strokeRect(0, -bh / 2, barL, bh);
  ctx.restore();
}

// ---------- Starthügel: unter der Spur, auf dem Schnee ----------

function chevron(R) {
  if (R.startChev && R.startChev.key === R.spriteKey) return R.startChev.sp;
  const S = R.S;
  const sp = makeMark([{ pts: [[-1.5 * S, 0], [0, 1.0 * S], [1.5 * S, 0]], width: C.GM_SPRAY_PX * 0.7 }], C.GM_RGB, 97, R.dpr);
  R.startChev = { key: R.spriteKey, sp };
  return sp;
}

// rails: Linien des Fahrers für das Verwischen (render.js railsOf)
export function drawStartRamp(R, g, ox, oy, rails) {
  const cs = g.course;
  if (!cs || !cs.spec.ramp) return;
  const L = cv(cs.spec, 'ramp');
  const { ctx, Sv: S, H } = R;
  if (!(L > 0) || (L + 3) * S + oy < 0 || -2 * S + oy > H) return;
  const w = g.world;
  const cx = (y) => laneX(w, y) * S + ox, sy = (y) => y * S + oy;
  // die Rinne läuft unten trichterförmig in die Piste aus
  const half = (u) => RAMP_HALF + (u > 0.65 ? ((u - 0.65) / 0.35) ** 2 * 1.8 : 0);
  const N = 24;
  // Schattierung: oben am stärksten
  const grad = ctx.createLinearGradient(0, sy(0), 0, sy(L));
  for (let i = 0; i <= 6; i++) { const u = i / 6; grad.addColorStop(u, `rgba(${C.SH_RAMP_RGB},${(0.24 * (1 - u) * (1 - u)).toFixed(3)})`); }
  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) { const u = i / N; ctx.lineTo(cx(u * L) - half(u) * S, sy(u * L)); }
  for (let i = N; i >= 0; i--) { const u = i / N; ctx.lineTo(cx(u * L) + half(u) * S, sy(u * L)); }
  ctx.closePath(); ctx.fill();
  // Schneewälle: Schatten rechts daneben (Sonne oben links), weißer Wall, feine Kontur außen; sie laufen unten aus
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const line = (off, from = 0) => {
      ctx.beginPath();
      for (let i = Math.round(from * N); i <= N; i++) { const u = i / N; ctx.lineTo(cx(u * L) + (side * half(u) + off) * S, sy(u * L)); }
    };
    const fade = ctx.createLinearGradient(0, sy(0), 0, sy(L));
    fade.addColorStop(0, `rgba(${C.SHADOW_RGB},0.2)`); fade.addColorStop(0.7, `rgba(${C.SHADOW_RGB},0.12)`); fade.addColorStop(1, `rgba(${C.SHADOW_RGB},0)`);
    ctx.strokeStyle = fade; ctx.lineWidth = 0.55 * S;
    line(0.32); ctx.stroke();
    const white = ctx.createLinearGradient(0, sy(0), 0, sy(L));
    white.addColorStop(0, C.SH_SNOW); white.addColorStop(0.75, C.SH_SNOW); white.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = white; ctx.lineWidth = 0.6 * S;
    line(0); ctx.stroke();
    const ink = ctx.createLinearGradient(0, sy(0), 0, sy(L));
    ink.addColorStop(0, 'rgba(20,20,15,0.32)'); ink.addColorStop(0.8, 'rgba(20,20,15,0.18)'); ink.addColorStop(1, 'rgba(20,20,15,0)');
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, 0.06 * S);
    line(side * 0.3); ctx.stroke();
  }
  // Winkel: auf dem Weg zur ersten Stange (gates.js guideX), talwärts immer weiter auseinander und blasser
  const sp = chevron(R), k = S / R.S, n = C.SH_CHEVRONS;
  for (let i = 0; i < n; i++) {
    const y = 2.2 + (L - 4) * Math.pow(i / Math.max(1, n - 1), 1.6);
    const r = { x: (cs.guide ? guideX(cs, y) * S + ox : cx(y)) - sp.ax * k, y: sy(y) - sp.ay * k, w: sp.w * k, h: sp.h * k };
    ctx.globalAlpha = 0.9 - 0.5 * (i / n);
    ctx.drawImage(sp.img, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
    if (y <= g.skier.y + 1) scrubRect(R, g, ox, oy, r, rails);
  }
}
