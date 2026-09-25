// Zeichnet die Welt auf den Canvas. HUD und Overlays sind DOM (siehe hud.js).
import { C } from './constants.js';
import { TREE } from './physics.js';
import { forEachTrackPoint, forEachRecentTrackPoint } from './track.js';
import { drawAvalanche, makeAvSprites } from './avalanche-view.js';
import { laneX } from './world.js';

const TAU = Math.PI * 2;
const TREE_H = 3.2; // nominale Sprite-Höhe in Metern
const ROCK_H = 1.4;
const MARK_FONT = "italic 12px 'Playfair Display', Georgia, 'Times New Roman', serif"; // wie --font in styles.css
const SIGN_FONT_STACK = "'Playfair Display', Georgia, 'Times New Roman', serif"; // nur italic 400 liegt in fonts/
const SIGN_PAD_M = 0.3; // Rand des Offscreen-Canvas um den Schriftzug, für kursive Überhänge und das Relief

// Hockeystop deaktiviert (Tim und Jürgen wollen ihn nicht) — auskommentiert statt gelöscht.
// Organischer Blob-Umriss fürs Hockeystop-Nebelfeld, normiert auf ±0.5 um den Mittelpunkt (mit `size`
// multipliziert gezeichnet). Start- plus 7 Kurven-Tripel (je 2 Kontrollpunkte + Endpunkt).
// const FOG_BLOB = [
//   [0.0889, -0.5],
//   [-0.1333, -0.5], [-0.2778, -0.3636], [-0.2778, -0.1591],
//   [-0.4333, -0.1364], [-0.5, 0], [-0.4333, 0.1364],
//   [-0.5, 0.2727], [-0.3889, 0.4091], [-0.2111, 0.3864],
//   [-0.1444, 0.4773], [0.0111, 0.5], [0.1, 0.4091],
//   [0.2778, 0.4545], [0.4333, 0.3182], [0.3889, 0.1364],
//   [0.5, 0.0455], [0.4778, -0.1364], [0.3222, -0.2045],
//   [0.3, -0.3864], [0.2111, -0.5], [0.0889, -0.5],
// ];
//
// function fogBlobPath(ctx, cx, cy, size) {
//   ctx.beginPath();
//   ctx.moveTo(cx + FOG_BLOB[0][0] * size, cy + FOG_BLOB[0][1] * size);
//   for (let i = 1; i < FOG_BLOB.length; i += 3) {
//     const [x1, y1] = FOG_BLOB[i], [x2, y2] = FOG_BLOB[i + 1], [x3, y3] = FOG_BLOB[i + 2];
//     ctx.bezierCurveTo(cx + x1 * size, cy + y1 * size, cx + x2 * size, cy + y2 * size, cx + x3 * size, cy + y3 * size);
//   }
//   ctx.closePath();
// }
const nf = new Intl.NumberFormat(C.HUD_LOCALE);

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const R = {
    canvas, ctx, W: 0, H: 0, dpr: 1, S: 10, Sv: 10, sprites: null, spriteKey: '', list: [], skierMarker: { skier: true, y: 0 },
    frameMs: 16.7, paceMs: 0, trackPts: new Float32Array(C.TRACK_CAP * 7), snow: createSnow(), shards: { p: [], run: -1 },
    sign: { c: null, x: null, key: '', world: null, seen: 0, x0: 0, y0: 0, wM: 0, hM: 0, Q: 1 }, fontReady: false,
  };
  // Der Canvas stößt das Laden der Schrift nicht an, das HUD tut es beim Seitenstart. Bis sie da ist, würde der
  // Schriftzug in Georgia gebaut; fontReady steckt im Schlüssel und baut ihn dann einmal neu. Ein Fehler zählt
  // auch als fertig, sonst bliebe der Schlüssel ewig offen.
  if (document.fonts && document.fonts.load) {
    document.fonts.load(`italic 400 20px ${SIGN_FONT_STACK}`).catch(() => {}).then(() => { R.fontReady = true; });
  } else R.fontReady = true;
  return R;
}

export function resize(R) {
  const W = R.canvas.clientWidth || window.innerWidth;
  const H = R.canvas.clientHeight || window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, C.MAX_DPR);
  R.W = W; R.H = H; R.dpr = dpr;
  R.canvas.width = Math.round(W * dpr);
  R.canvas.height = Math.round(H * dpr);
  R.S = Math.min(W / C.VIEW_W_M, H / (C.VIEW_W_M * C.VIEW_ASPECT));
  const key = R.S.toFixed(3) + '@' + dpr;
  if (key !== R.spriteKey) {
    R.sprites = makeSprites(R.S, dpr);
    R.spriteKey = key;
  }
}

// ---------- Sprites (einmal vorgerendert) ----------

function makeCanvas(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  return [c, x];
}

function softEllipse(x, cx, cy, rx, ry, rgb, alpha) {
  x.save();
  x.translate(cx, cy);
  x.scale(rx, ry);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.55, `rgba(${rgb},${alpha * 0.55})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, 0, 1, 0, TAU);
  x.fill();
  x.restore();
}

function makeTree(S, dpr, v) {
  const H = TREE_H * S, Wd = 1.7 * S, pad = 1.8 * S;
  const w = Wd + pad * 2, h = H + pad * 2;
  const [c, x] = makeCanvas(w, h, dpr);
  const ax = w / 2, ay = pad + H; // Fußpunkt
  softEllipse(x, ax + 0.95 * S, ay - 0.1 * S, 1.2 * S, 0.5 * S, C.SHADOW_RGB, 0.3);
  const skew = [0.07, -0.05, 0.02][v] * S;
  const tiers = [[0.0, 0.62, 0.48], [0.28, 0.52, 0.42], [0.54, 0.4, 0.46]];
  for (const [y0f, wf, hf] of tiers) {
    const yb = ay - y0f * H, yt = yb - hf * H, half = (wf * Wd) / 2;
    x.fillStyle = C.TREE;
    x.beginPath(); x.moveTo(ax + skew, yt); x.lineTo(ax + half, yb); x.lineTo(ax - half, yb); x.closePath(); x.fill();
    x.fillStyle = C.TREE_LIGHT;
    x.beginPath(); x.moveTo(ax + skew, yt); x.lineTo(ax - half, yb); x.lineTo(ax + skew * 0.5, yb); x.closePath(); x.fill();
  }
  x.fillStyle = C.TRUNK;
  x.fillRect(ax - 0.07 * S, ay - 0.12 * S, 0.14 * S, 0.14 * S);
  return { img: c, w, h, ax, ay, nominal: TREE_H };
}

function makeRock(S, dpr, v) {
  const H = ROCK_H * 0.75 * S, Wd = ROCK_H * S, pad = 1.2 * S;
  const w = Wd + pad * 2, h = H + pad * 2;
  const [c, x] = makeCanvas(w, h, dpr);
  const ax = w / 2, ay = pad + H;
  softEllipse(x, ax + 0.6 * S, ay - 0.05 * S, 0.9 * S, 0.4 * S, C.SHADOW_RGB, 0.28);
  const jit = (i) => (((i * 7 + v * 13) % 5) - 2) * 0.03;
  const P = (px, py, i) => [ax - Wd / 2 + (px + jit(i)) * Wd, ay - H + (py + jit(i + 3)) * H];
  const outline = [[0.5, 0.12], [0.92, 0.35], [0.95, 0.8], [0.55, 1.0], [0.1, 0.85], [0.05, 0.4]];
  x.fillStyle = C.ROCK;
  x.beginPath();
  outline.forEach(([px, py], i) => { const [X, Y] = P(px, py, i); i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
  x.closePath(); x.fill();
  const top = [[0.5, 0.12], [0.92, 0.35], [0.55, 0.52], [0.1, 0.42]];
  x.fillStyle = C.ROCK_TOP;
  x.beginPath();
  top.forEach(([px, py], i) => { const [X, Y] = P(px, py, i); i ? x.lineTo(X, Y) : x.moveTo(X, Y); });
  x.closePath(); x.fill();
  return { img: c, w, h, ax, ay, nominal: ROCK_H };
}

function makeSprites(S, dpr) {
  return {
    trees: [0, 1, 2].map((v) => makeTree(S, dpr, v)),
    rocks: [0, 1, 2].map((v) => makeRock(S, dpr, v)),
    av: makeAvSprites(),
  };
}

// ---------- Frame ----------

export function draw(R, g, t) {
  const { ctx, W, H } = R;
  const s = g.skier;
  // Sichtmaßstab: Sprites sind für R.S vorgerendert, bei Tempo-Zoom werden sie etwas kleiner gezeichnet
  const S = R.Sv = R.S / g.zoom;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  ctx.fillStyle = C.BG;
  ctx.fillRect(0, 0, W, H);
  // Welt → Bildschirm: sx = x*S + ox, sy = y*S + oy
  let ox = W / 2 - g.camX * S;
  let oy = g.skierFrac * H - s.y * S;
  // Aufprall: das Bild wackelt kurz und klingt ab (nur die Darstellung, die Simulation steht)
  if (shattered(g)) {
    const k = Math.max(0, 1 - g.deadT / C.SHAKE_S);
    ox += Math.sin(g.deadT * 57) * k * k * C.SHAKE_PX;
    oy += Math.sin(g.deadT * 73 + 1.3) * k * k * C.SHAKE_PX * 0.8;
  } else if (g.mode === 'chase' && g.state === 'running' && g.av.threat > 0) {
    // Lawine im Bild: leichtes Beben, das mit der Nähe wächst
    const k = g.av.threat * g.av.threat * C.AV_RUMBLE_PX;
    ox += Math.sin(t * 47) * k;
    oy += Math.sin(t * 61 + 0.7) * k * 0.8;
  }
  drawMarks(R, g, ox, oy);
  drawSignature(R, g, ox, oy);
  drawTrack(R, g, ox, oy);
  drawWorld(R, g, ox, oy);
  // drawHockeyFog(R, g, ox, oy); // Hockeystop deaktiviert
  drawParticles(R, g, ox, oy);
  if (g.mode === 'chase') drawAvalanche(R, g, ox, oy, t);
  drawWhiteout(R, g);
  drawSnow(R, g, t);
  if (g.debug) drawDebug(R, g, ox, oy);
}

// ---------- Markierungen im Schnee ----------
// Alle MARK_M eine blaue Querlinie mit Meterzahl (Welt-y = Meter im HUD), der Bestwert des Modus beim Start des
// Laufs als rote Rekordlinie. Vor der Spur gezeichnet: Spur, Bäume und Fahrer liegen darüber.
function drawMarks(R, g, ox, oy) {
  const { ctx, Sv: S, W, H } = R;
  const y0 = -oy / S, y1 = (H - oy) / S;
  ctx.lineWidth = C.MARK_PX;
  ctx.font = MARK_FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  for (let k = Math.max(1, Math.ceil(y0 / C.MARK_M)); k * C.MARK_M <= y1; k++) {
    markLine(ctx, W, k * C.MARK_M * S + oy, nf.format(k * C.MARK_M) + ' m', C.MARK_RGBA);
  }
  const b = g.runBest;
  if (b > 0 && b >= y0 && b <= y1) markLine(ctx, W, b * S + oy, 'Rekord · ' + nf.format(b) + ' m', C.MARK_BEST_RGBA);
}

function markLine(ctx, W, sy, label, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  ctx.fillText(label, W - 8, sy - 3);
}

// ---------- Signatur im Schnee ----------
// Der Schriftzug (SIGN_TEXT) liegt bei SIGN_Y_M, zentriert auf der Korridor-Mitte, in einem Offscreen-Canvas in
// Welt-Koordinaten mit fester Auflösung Q px/m (wie die Sprites, unabhängig vom Tempo-Zoom). Darin sind die
// Lagen deckend gezeichnet, die Deckkraft SIGN_ALPHA kommt erst beim Einblenden dazu: so verdeckt die Füllung den
// Schatten dort, wo beide übereinanderliegen, und der Regler wirkt ohne Neuaufbau. Fährt der Skifahrer darüber,
// radieren seine Spurpunkte entlang beider Ski Striche hinein (destination-out), das geht nur auf einem
// Canvas mit Alpha. Gebunden an g.world: reset() legt eine neue Welt an, dann ist der Schriftzug wieder heil und
// steht auf der Korridor-Mitte der neuen Welt. Die echte Spur (drawTrack) liegt wie bisher darüber.
function signKey(R) {
  return [R.S.toFixed(3), R.dpr, R.fontReady ? 1 : 0, C.SIGN_TEXT, C.SIGN_WIDTH_FRAC, C.VIEW_W_M, C.SIGN_RELIEF_M].join('|');
}

function buildSignature(R, g) {
  const sg = R.sign;
  const text = C.SIGN_TEXT;
  const wM = C.VIEW_W_M * C.SIGN_WIDTH_FRAC;
  const Q = Math.min(R.S * R.dpr, C.SIGN_MAX_PX / (wM + 2 * SIGN_PAD_M));
  const c = sg.c || document.createElement('canvas');
  const x = sg.x || c.getContext('2d');
  // Schriftgröße aus einer Referenzmessung zurückrechnen, damit die Tinte genau wM breit wird (kursiv hängt über)
  const refPx = 200;
  x.font = `italic 400 ${refPx}px ${SIGN_FONT_STACK}`;
  const m0 = x.measureText(text);
  const refW = m0.actualBoundingBoxLeft + m0.actualBoundingBoxRight || m0.width || 1;
  const fontPx = ((wM * Q) / refW) * refPx;
  const font = `italic 400 ${fontPx}px ${SIGN_FONT_STACK}`;
  x.font = font;
  const m1 = x.measureText(text);
  const asc = m1.actualBoundingBoxAscent || fontPx * 0.8, desc = m1.actualBoundingBoxDescent || fontPx * 0.25;
  const pad = SIGN_PAD_M * Q;
  c.width = Math.ceil(wM * Q + 2 * pad); // setzt den Kontext zurück und löscht
  c.height = Math.ceil(asc + desc + 2 * pad);
  x.font = font;
  x.textAlign = 'center';
  x.textBaseline = 'alphabetic';
  const cx = c.width / 2, by = pad + asc, d = C.SIGN_RELIEF_M * Q;
  x.fillStyle = '#FFFFFF';
  x.fillText(text, cx + d, by + d); // Glanz: die beleuchtete Kante unten-rechts
  x.fillStyle = `rgb(${C.SHADOW_RGB})`;
  x.fillText(text, cx - d, by - d); // Schatten: die Kante im Licht-Schatten oben-links
  x.fillStyle = `rgb(${C.TRACK_RGB})`;
  x.fillText(text, cx, by);
  sg.c = c; sg.x = x; sg.Q = Q;
  sg.wM = c.width / Q; sg.hM = c.height / Q;
  sg.x0 = laneX(g.world, C.SIGN_Y_M) - sg.wM / 2;
  sg.y0 = C.SIGN_Y_M - sg.hM / 2;
  sg.key = signKey(R);
  sg.world = g.world;
  // Radierung aus dem Ringpuffer nachspielen: ein Neuaufbau mitten im Lauf (Schrift geladen, Regler gedreht,
  // Fenster geändert) darf den kaputt gefahrenen Schriftzug nicht heilen
  replayErase(sg, g.track, g.track.n);
  sg.seen = g.track.total;
}

// Die letzten count Spurpunkte als Segmente radieren; das Lücken-Flag steht am späteren Punkt (wie in drawTrack)
function replayErase(sg, tr, count) {
  let px = 0, py = 0, pnx = 0, pny = 0, pplow = 0, has = false;
  forEachRecentTrackPoint(tr, count, (x, y, nx, ny, w, gap, plow) => {
    if (has && !gap) eraseSegment(sg, px, py, pnx, pny, pplow, x, y, nx, ny, w, plow);
    px = x; py = y; pnx = nx; pny = ny; pplow = plow; has = true;
  });
}

// Ein Spursegment auf dem Offscreen-Canvas ausradieren: je Ski ein Strich in Spurbreite (Carve macht ihn breiter,
// der Pflug zählt wie in drawTrack als kräftiges Carve), darüber ein breiter, schwacher Strich für den
// aufgewirbelten Schnee. Alpha unter 1: mehrere Überfahrten summieren sich, eine allein verwischt nur.
function eraseSegment(sg, xa, ya, nxa, nya, pa, xb, yb, nxb, nyb, wb, pb) {
  const half = sg.hM / 2;
  if (Math.abs(ya - C.SIGN_Y_M) > half && Math.abs(yb - C.SIGN_Y_M) > half) return;
  const { x, Q } = sg;
  const carve = Math.max(wb, 0.6 * pb);
  const w = 0.12 * Q * (1 + (C.TRACK_WIDTH_MAX - 1) * carve) * C.SIGN_ERASE_WIDTH_K;
  x.globalCompositeOperation = 'destination-out';
  x.lineCap = 'round';
  for (let side = -1; side <= 1; side += 2) {
    const offA = side * (0.16 + C.PLOW_SPREAD_M * pa), offB = side * (0.16 + C.PLOW_SPREAD_M * pb);
    const ax = (xa + nxa * offA - sg.x0) * Q, ay = (ya + nya * offA - sg.y0) * Q;
    const bx = (xb + nxb * offB - sg.x0) * Q, by = (yb + nyb * offB - sg.y0) * Q;
    x.strokeStyle = `rgba(0,0,0,${C.SIGN_SPRAY_ALPHA})`;
    x.lineWidth = w + C.SIGN_SPRAY_W_M * Q;
    x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
    x.strokeStyle = `rgba(0,0,0,${C.SIGN_ERASE_ALPHA})`;
    x.lineWidth = w;
    x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
  }
  x.globalCompositeOperation = 'source-over';
}

// Jedes Bild, auch wenn der Schriftzug nicht im Bild ist: neue Spurpunkte seit dem letzten Bild radieren.
// Ein Punkt mehr, damit das erste neue Segment seinen Vorgänger hat.
function updateSignature(R, g) {
  const sg = R.sign, tr = g.track;
  if (sg.world !== g.world || sg.key !== signKey(R)) buildSignature(R, g);
  const fresh = Math.min(tr.total - sg.seen, tr.n);
  if (fresh > 0) replayErase(sg, tr, fresh + 1);
  sg.seen = tr.total;
}

function drawSignature(R, g, ox, oy) {
  updateSignature(R, g);
  const { ctx, Sv: S, H } = R, sg = R.sign;
  const sy = sg.y0 * S + oy, sh = sg.hM * S;
  if (sy + sh < 0 || sy > H) return;
  ctx.globalAlpha = C.SIGN_ALPHA;
  ctx.drawImage(sg.c, sg.x0 * S + ox, sy, sg.wM * S, sh);
  ctx.globalAlpha = 1;
}

function drawTrack(R, g, ox, oy) {
  const { ctx, Sv: S } = R;
  const tr = g.track;
  if (tr.n < 2) return;
  // Punkte einmal in Bildschirmkoordinaten sammeln: sx, sy, nx*S, ny*S, Carve, Lücke, Pflug
  const pts = R.trackPts;
  let n = 0;
  forEachTrackPoint(tr, (x, y, nx, ny, w, gap, plow) => {
    const i = n * 7;
    pts[i] = x * S + ox; pts[i + 1] = y * S + oy; pts[i + 2] = nx * S; pts[i + 3] = ny * S; pts[i + 4] = w; pts[i + 5] = gap ? 1 : 0; pts[i + 6] = plow;
    n++;
  });
  const base = Math.max(1, 0.12 * S);
  const buckets = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Schneepflug: zwischen den gespreizten Ski liegt eine breite, flache Bremsspur aus geschobenem Schnee
  ctx.lineWidth = 2 * (0.16 + C.PLOW_SPREAD_M) * S;
  ctx.strokeStyle = `rgba(${C.TRACK_RGB},0.07)`;
  ctx.beginPath();
  let band = false;
  for (let i = 1; i < n; i++) {
    const j = i * 7, k = j - 7;
    if (pts[j + 5] > 0 || pts[k + 1] < -20 || pts[j + 6] < 0.5) continue;
    ctx.moveTo(pts[k], pts[k + 1]);
    ctx.lineTo(pts[j], pts[j + 1]);
    band = true;
  }
  if (band) ctx.stroke();
  // Ski-Linien: Breite nach Carve (der Pflug zählt wie ein kräftiges Carve), Abstand nach Pflugstellung
  for (let b = 0; b < buckets; b++) {
    ctx.lineWidth = base * (1 + (C.TRACK_WIDTH_MAX - 1) * ((b + 0.5) / buckets));
    ctx.strokeStyle = `rgba(${C.TRACK_RGB},${(0.16 + (0.14 * b) / (buckets - 1)).toFixed(2)})`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      let any = false;
      for (let i = 1; i < n; i++) {
        const j = i * 7, k = j - 7;
        if (pts[j + 5] > 0 || pts[k + 1] < -20) continue;
        const wb = Math.min(buckets - 1, Math.floor(Math.max(pts[j + 4], 0.6 * pts[j + 6]) * buckets));
        if (wb !== b) continue;
        const offK = side * (0.16 + C.PLOW_SPREAD_M * pts[k + 6]);
        const offJ = side * (0.16 + C.PLOW_SPREAD_M * pts[j + 6]);
        ctx.moveTo(pts[k] + pts[k + 2] * offK, pts[k + 1] + pts[k + 3] * offK);
        ctx.lineTo(pts[j] + pts[j + 2] * offJ, pts[j + 1] + pts[j + 3] * offJ);
        any = true;
      }
      if (any) ctx.stroke();
    }
  }
}

function drawWorld(R, g, ox, oy) {
  const { ctx, Sv: S, H, list } = R;
  const spriteScale = S / R.S;
  list.length = 0;
  for (const cell of g.world.cells.values()) {
    const objs = cell.objs;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      const sy = o.y * S + oy;
      if (sy < -40 || sy > H + 40) continue;
      list.push(o);
    }
  }
  R.skierMarker.y = g.skier.y;
  list.push(R.skierMarker);
  list.sort((a, b) => a.y - b.y);
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o.skier) {
      if (shattered(g)) drawShards(R, g, ox, oy);
      else drawSkier(R, g, g.skier.x * S + ox, g.skier.y * S + oy);
      continue;
    }
    const sp = o.t === TREE ? R.sprites.trees[o.variant] : R.sprites.rocks[o.variant];
    const sc = (o.h / sp.nominal) * spriteScale;
    ctx.drawImage(sp.img, o.x * S + ox - sp.ax * sc, o.y * S + oy - sp.ay * sc, sp.w * sc, sp.h * sc);
  }
}

function drawSkier(R, g, sx, sy) {
  const { ctx, Sv: S } = R;
  const s = g.skier;
  ctx.save();
  // Schatten nach unten rechts
  ctx.fillStyle = `rgba(${C.SHADOW_RGB},0.22)`;
  ctx.beginPath();
  ctx.ellipse(sx + 0.35 * S, sy + 0.25 * S, 0.5 * S, 0.3 * S, 0, 0, TAU);
  ctx.fill();
  ctx.translate(sx, sy);
  ctx.rotate(-s.theta);
  skierShape(ctx, S, s);
  ctx.restore();
}

// Ski, Körper und Kopf um den Ursprung; Position und Drehung setzt der Aufrufer.
function skierShape(ctx, S, s) {
  // Ski: im Pflug laufen die Spitzen zusammen und die Enden spreizen nach außen
  const p = s.plowK;
  const tail = 0.16 + C.PLOW_SPREAD_M * p, tip = 0.16 - 0.11 * p;
  ctx.strokeStyle = C.INK;
  ctx.lineWidth = Math.max(1, 0.09 * S);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-tail * S, -0.85 * S); ctx.lineTo(-tip * S, 0.75 * S);
  ctx.moveTo(tail * S, -0.85 * S); ctx.lineTo(tip * S, 0.75 * S);
  ctx.stroke();
  // Körper, leicht in die Kurve gelegt, im Pflug etwas breiter und tiefer (geht in die Knie)
  const lean = Math.sin(s.theta * 0.5) * 0.15 * S * s.carve;
  ctx.fillStyle = C.INK;
  ctx.beginPath(); ctx.ellipse(lean, 0, (0.26 + 0.04 * p) * S, (0.42 - 0.04 * p) * S, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.INK_LIGHT;
  ctx.beginPath(); ctx.arc(lean * 1.3, -0.1 * S, 0.14 * S, 0, TAU); ctx.fill();
}

// ---------- Aufprall oder Lawine: der Fahrer zerspringt in Pixel ----------

function shattered(g) {
  return g.state === 'dead';
}

// Einmal pro Aufprall: den Fahrer offscreen zeichnen und in Pixel-Blöcke zerlegen. Jeder Block wird ein
// Splitter in Weltkoordinaten, der vom Hindernis weg (bei der Lawine: von oben, mit ihrem Schub) und etwas
// in Fahrtrichtung fliegt, sich dreht und hüpft.
function spawnShards(R, g) {
  const S = R.Sv, s = g.skier, sh = R.shards;
  sh.run = g.runs;
  sh.p.length = 0;
  const half = Math.ceil(S); // 1 m Radius fasst die Ski in jeder Richtung
  const q = 4;               // Offscreen-Pixel pro CSS-Pixel, zum Mitteln der Kanten
  const [c, x] = makeCanvas(half * 2, half * 2, q);
  x.translate(half, half);
  x.rotate(-s.theta);
  skierShape(x, S, s);
  const data = x.getImageData(0, 0, c.width, c.height).data;
  const b = Math.max(1, Math.round(C.SHATTER_STEP_PX * q)); // Rasterzelle in Offscreen-Pixeln
  const fx = Math.sin(s.theta), fy = Math.cos(s.theta); // Fahrtrichtung
  let nx = s.x - g.crashX, ny = s.y - g.crashY;        // weg vom Hindernis
  const nl = Math.hypot(nx, ny) || 1;
  nx /= nl; ny /= nl;
  const boost = 0.8 + 0.5 * Math.min(1, g.crashV / 30); // schneller Aufprall streut weiter
  for (let by = 0; by < c.height; by += b) {
    for (let bx = 0; bx < c.width; bx += b) {
      let a = 0, r = 0, gr = 0, bl = 0;
      for (let yy = by; yy < Math.min(by + b, c.height); yy++) {
        for (let xx = bx; xx < Math.min(bx + b, c.width); xx++) {
          const i = (yy * c.width + xx) * 4, al = data[i + 3];
          a += al; r += data[i] * al; gr += data[i + 1] * al; bl += data[i + 2] * al;
        }
      }
      if (a < b * b * 255 * 0.3) continue; // Block kaum bedeckt: kein Splitter
      const px = (bx + b / 2) / q - half, py = (by + b / 2) / q - half; // CSS-Pixel ab Fahrermitte
      const ang = Math.atan2(py, px) + (Math.random() - 0.5) * 1.2;
      const sp = C.SHATTER_SPEED * (0.3 + 0.7 * Math.random()) * boost;
      const carry = g.crashV * (0.04 + 0.12 * Math.random());
      const away = 0.5 + 2.5 * Math.random() + g.crashPush * (0.5 + Math.random());
      sh.p.push({
        x: s.x + px / S, y: s.y + py / S,
        vx: Math.cos(ang) * sp + fx * carry + nx * away,
        vy: Math.sin(ang) * sp + fy * carry + ny * away,
        spin: (Math.random() - 0.5) * 30,
        vz: 1 + 4.5 * Math.random(),
        size: C.SHATTER_PX / S,
        life: C.SHATTER_LIFE_S * (0.7 + 0.6 * Math.random()),
        color: `rgb(${Math.round(r / a)},${Math.round(gr / a)},${Math.round(bl / a)})`,
      });
    }
  }
}

// Höhe eines Splitters über dem Schnee in m: ein Sprung, dann ein kleiner Nachhüpfer.
function hop(vz, t) {
  const G = 20, t1 = (2 * vz) / G;
  if (t < t1) return vz * t - 0.5 * G * t * t;
  const u = t - t1, v2 = vz * 0.35;
  return Math.max(0, v2 * u - 0.5 * G * u * u);
}

// Splitter aus der Zeit seit dem Aufprall berechnen (kein Zustand pro Frame): Weg und Drehung
// laufen exponentiell aus, in der Luft werden sie größer und werfen Schatten nach unten rechts.
function drawShards(R, g, ox, oy) {
  const sh = R.shards;
  if (sh.run !== g.runs) spawnShards(R, g);
  const { ctx, Sv: S, dpr } = R;
  const t = Math.max(0, g.deadT - C.SHATTER_FREEZE_S);
  const k = C.SHATTER_DRAG;
  const f = (1 - Math.exp(-k * t)) / k; // zurückgelegter Weg je m/s Startgeschwindigkeit
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = `rgb(${C.SHADOW_RGB})`;
    for (const p of sh.p) {
      const a = Math.min(1, (p.life - t) / C.SHATTER_FADE_S);
      if (a <= 0) continue;
      const z = hop(p.vz, t);
      if (pass === 0 && z < 0.02) continue;
      const size = p.size * S * (1 + 0.5 * z);
      let x = (p.x + p.vx * f) * S + ox, y = (p.y + p.vy * f) * S + oy;
      if (pass === 0) { x += 0.6 * z * S; y += 0.45 * z * S; }
      const rot = p.spin * f, cs = Math.cos(rot) * dpr, sn = Math.sin(rot) * dpr;
      ctx.globalAlpha = pass === 0 ? a * 0.22 : a;
      if (pass === 1) ctx.fillStyle = p.color;
      ctx.setTransform(cs, sn, -sn, cs, x * dpr, y * dpr);
      ctx.fillRect(-size / 2, -size / 2, size, size);
    }
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ---------- Hockeystop: Nebel ----------
// Deaktiviert (Tim und Jürgen wollen ihn nicht) — auskommentiert statt gelöscht.
// Drei Phasen über g.fogT: HOCKEY_FOG_IN_S rein, HOCKEY_FOG_HOLD_S voll deckend, HOCKEY_FOG_OUT_S raus.
// Deckt den Fahrer selbst ab (Kern auf der Fahrerposition, nach S skaliert) und zusätzlich ein organischer
// Blob (FOG_BLOB) direkt darunter, HOCKEY_FOG_OFFSET_PX × HOCKEY_FOG_OFFSET_PX groß, mit echtem Weichzeichner.
// function hockeyFogAlpha(g) {
//   const t = g.fogT;
//   if (t < C.HOCKEY_FOG_IN_S) return t / C.HOCKEY_FOG_IN_S;
//   const hold = C.HOCKEY_FOG_IN_S + C.HOCKEY_FOG_HOLD_S;
//   if (t < hold) return 1;
//   return Math.max(0, 1 - (t - hold) / C.HOCKEY_FOG_OUT_S);
// }
//
// function drawHockeyFog(R, g, ox, oy) {
//   if (g.fogT < 0) return;
//   const a = hockeyFogAlpha(g);
//   if (a <= 0) return;
//   const { ctx, Sv: S } = R;
//   const sx = g.skier.x * S + ox, sy = g.skier.y * S + oy;
//   const base = 1.3 * S;
//   const rgb = '255,255,255';
//   // Kern direkt auf dem Fahrer, deckt ihn ab
//   softEllipse(ctx, sx, sy, base, base * 0.85, rgb, a * 0.95);
//   softEllipse(ctx, sx - 0.5 * S, sy + 0.1 * S, base * 0.6, base * 0.5, rgb, a * 0.6);
//   softEllipse(ctx, sx + 0.5 * S, sy + 0.15 * S, base * 0.6, base * 0.5, rgb, a * 0.6);
//   // Nebelfeld darunter: organischer Blob (FOG_BLOB), feste Größe HOCKEY_FOG_OFFSET_PX, echter Weichzeichner.
//   // Start knapp unter der sichtbaren Fahrer-Sprite (Ski-Spitzen enden bei ca. 0.75*S), sonst überlappt es den
//   // Fahrer statt klar darunter zu sitzen.
//   const size = C.HOCKEY_FOG_OFFSET_PX;
//   const bx = sx, by = sy + 0.75 * S + size / 2;
//   ctx.filter = `blur(${(size * 0.12).toFixed(1)}px)`;
//   ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(3)})`;
//   fogBlobPath(ctx, bx, by, size);
//   ctx.fill();
//   ctx.filter = 'none';
// }

function drawParticles(R, g, ox, oy) {
  const { ctx, Sv: S } = R;
  const ps = g.particles.p;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.life <= 0) continue;
    const a = p.life / p.max;
    ctx.fillStyle = p.tone ? `rgba(185,200,215,${(0.6 * a).toFixed(2)})` : `rgba(255,255,255,${(0.9 * a).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(p.x * S + ox, p.y * S + oy, p.r, 0, TAU);
    ctx.fill();
  }
}

function drawDebug(R, g, ox, oy) {
  const { ctx, Sv: S, H, W } = R;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(220,40,40,0.6)';
  for (const cell of g.world.cells.values()) {
    for (const o of cell.objs) {
      const sy = o.y * S + oy;
      if (sy < -40 || sy > H + 40) continue;
      ctx.beginPath(); ctx.arc(o.x * S + ox, sy, o.r * S, 0, TAU); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(40,120,220,0.8)';
  ctx.beginPath(); ctx.arc(g.skier.x * S + ox, g.skier.y * S + oy, C.SKIER_R * S, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,160,90,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const y0 = (0 - oy) / S, y1 = (H - oy) / S;
  for (let y = y0; y <= y1; y += 2) {
    const x = laneX(g.world, y) * S + ox;
    if (y === y0) ctx.moveTo(x, y * S + oy); else ctx.lineTo(x, y * S + oy);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220,40,40,0.8)';
  ctx.lineWidth = 1;
  const fy = g.av.frontY * S + oy;
  ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke();
}

// ---------- Warnschnee (Bildschirmraum) und White-out ----------

function createSnow() {
  const f = [];
  for (let i = 0; i < C.SNOW_POOL; i++) f.push({ x: 0, y: 0, vy: 0, drift: 0, phase: 0, r: 1, on: false });
  return { f, lastT: 0 };
}

// 0..1: wie stark es schneien soll.
function snowIntensity(g) {
  if (g.mode !== 'chase') return 0;
  if (g.state === 'dead') return g.deadCause === 'avalanche' ? 1 : 0;
  if (g.state === 'running' || g.state === 'paused') return g.av.near;
  return 0;
}

function drawSnow(R, g, t) {
  const { ctx, W, H } = R;
  const snow = R.snow;
  const dt = snow.lastT ? Math.min(0.05, Math.max(0, t - snow.lastT)) : 0;
  snow.lastT = t;
  const intensity = snowIntensity(g);
  const target = Math.round(C.SNOW_POOL * Math.pow(intensity, 1.3));
  const moving = g.state !== 'paused';
  let active = 0;
  ctx.beginPath();
  for (let i = 0; i < snow.f.length; i++) {
    const p = snow.f[i];
    if (!p.on) {
      if (active >= target || Math.random() > 0.12) continue;
      p.on = true;
      p.x = Math.random() * W;
      p.y = -10 - Math.random() * 60;
      p.vy = C.SNOW_MIN_SPEED + Math.random() * (C.SNOW_MAX_SPEED - C.SNOW_MIN_SPEED);
      p.drift = 10 + Math.random() * 25;
      p.phase = Math.random() * TAU;
      p.r = 1.5 + Math.random() * 2;
    }
    active++;
    if (moving) {
      p.y += p.vy * dt;
      p.x += Math.sin(t * 1.5 + p.phase) * p.drift * dt;
    }
    if (p.y > H + 10) { p.on = false; continue; }
    ctx.moveTo(p.x + p.r, p.y);
    ctx.arc(p.x, p.y, p.r, 0, TAU);
  }
  if (active === 0) return;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${C.TRACK_RGB},0.16)`;
  ctx.stroke();
}

function drawWhiteout(R, g) {
  if (g.state !== 'dead' || g.deadCause !== 'avalanche') return;
  const a = Math.min(1, Math.max(0, g.deadT - C.AV_WHITEOUT_DELAY_S) / C.WHITEOUT_S);
  if (a <= 0) return;
  R.ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
  R.ctx.fillRect(0, 0, R.W, R.H);
}

// ---------- Modus-Vorschau (kleine stille Szene für die Karten) ----------

export function drawModePreview(canvas, modeId) {
  const W = canvas.clientWidth || 130, H = canvas.clientHeight || 72;
  const dpr = Math.min(window.devicePixelRatio || 1, C.MAX_DPR);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const S = 5.5;
  ctx.fillStyle = C.BG;
  ctx.fillRect(0, 0, W, H);
  // Spur: leichte Schlangenlinie von oben bis zum Fahrer
  const sx = W * 0.5, sy = H * 0.62;
  ctx.strokeStyle = C.TRACK;
  ctx.lineWidth = 1.2;
  for (const off of [-1, 1]) {
    ctx.beginPath();
    for (let y = -4; y <= sy; y += 2) {
      const x = sx + Math.sin((y / H) * 4.5) * W * 0.09 + off;
      y < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const trees = [[0.16, 0.42, 0], [0.8, 0.3, 1], [0.66, 0.9, 2], [0.3, 0.98, 1], [0.9, 0.7, 0]];
  const sprites = [0, 1, 2].map((v) => makeTree(S, dpr, v));
  trees.forEach(([fx, fy, v]) => {
    const sp = sprites[v];
    ctx.drawImage(sp.img, fx * W - sp.ax, fy * H - sp.ay, sp.w, sp.h);
  });
  // Fahrer
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-0.25);
  ctx.strokeStyle = C.INK;
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.16 * S, -0.85 * S); ctx.lineTo(-0.16 * S, 0.75 * S);
  ctx.moveTo(0.16 * S, -0.85 * S); ctx.lineTo(0.16 * S, 0.75 * S);
  ctx.stroke();
  ctx.fillStyle = C.INK;
  ctx.beginPath(); ctx.ellipse(0, 0, 0.3 * S, 0.45 * S, 0, 0, TAU); ctx.fill();
  ctx.restore();
  if (modeId === 'chase') {
    // Schatten von oben, wie in avalanche-view.js: Dämmerung, Schleier aus Schiefergrau, wogender Rand, Fahnen
    const rgb = C.AVALANCHE.join(',');
    const fy = H * 0.36; // Vorderkante der Front
    ctx.fillStyle = `rgba(${rgb},0.08)`;
    ctx.fillRect(0, 0, W, H);
    const bodyY = fy - 2.6 * S;
    const g1 = ctx.createLinearGradient(0, 0, 0, bodyY);
    g1.addColorStop(0, `rgba(${rgb},0.66)`);
    g1.addColorStop(1, `rgba(${rgb},0.5)`);
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, bodyY);
    const sp = 2.6 * S, n = Math.ceil(W / sp) + 2;
    for (let i = 0; i < n; i++) {
      const r = 3.0 * S * (1 + 0.15 * Math.sin(i * 2.7));
      const bx = (i - 1) * sp + Math.sin(i * 1.3) * 0.6 * S;
      const by = fy - 2.0 * S + Math.cos(i * 2.1) * 0.4 * S;
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      rg.addColorStop(0, `rgba(${rgb},0.6)`);
      rg.addColorStop(0.45, `rgba(${rgb},0.35)`);
      rg.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = rg;
      ctx.fillRect(bx - r, by - r, r * 2, r * 2);
    }
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const ph = ((i * 53 + 17) % 100) / 100;
      const fx = ((i * 37 + 9) % 100) / 100 * W;
      const len = (1.0 + 3.0 * ph) * S;
      ctx.strokeStyle = `rgba(${rgb},${(0.35 * (1 - ph)).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 0.8 * S);
      ctx.lineTo(fx + Math.sin(i * 1.9) * 0.5 * S, fy + len);
      ctx.stroke();
    }
  }
}
