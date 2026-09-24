// Zeichnet die Welt auf den Canvas. HUD und Overlays sind DOM (siehe hud.js).
import { C } from './constants.js';
import { TREE, jumpHeight } from './physics.js';
import { forEachTrackPoint } from './track.js';
import { avalancheVisibility } from './avalanche.js';
import { laneX } from './world.js';

const TAU = Math.PI * 2;
const TREE_H = 2.8; // nominale Sprite-Höhe in Metern
const ROCK_H = 1.4;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  return { canvas, ctx, W: 0, H: 0, dpr: 1, S: 10, sprites: null, spriteKey: '', list: [], skierMarker: { skier: true, y: 0 }, frameMs: 16.7 };
}

export function resize(R) {
  const W = R.canvas.clientWidth || window.innerWidth;
  const H = R.canvas.clientHeight || window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, C.MAX_DPR);
  R.W = W; R.H = H; R.dpr = dpr;
  R.canvas.width = Math.round(W * dpr);
  R.canvas.height = Math.round(H * dpr);
  R.S = Math.min(W / C.VIEW_W_M, H / C.VIEW_H_M);
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
  softEllipse(x, ax + 0.95 * S, ay - 0.1 * S, 1.2 * S, 0.5 * S, '70,60,80', 0.34);
  const skew = [0.07, -0.05, 0.02][v] * S;
  const tiers = [[0.0, 0.62, 0.48], [0.28, 0.52, 0.42], [0.54, 0.4, 0.46]];
  for (const [y0f, wf, hf] of tiers) {
    const yb = ay - y0f * H, yt = yb - hf * H, half = (wf * Wd) / 2;
    x.fillStyle = C.INK;
    x.beginPath(); x.moveTo(ax + skew, yt); x.lineTo(ax + half, yb); x.lineTo(ax - half, yb); x.closePath(); x.fill();
    x.fillStyle = C.INK_LIGHT;
    x.beginPath(); x.moveTo(ax + skew, yt); x.lineTo(ax - half, yb); x.lineTo(ax + skew * 0.5, yb); x.closePath(); x.fill();
  }
  x.fillStyle = C.INK;
  x.fillRect(ax - 0.07 * S, ay - 0.12 * S, 0.14 * S, 0.14 * S);
  return { img: c, w, h, ax, ay, nominal: TREE_H };
}

function makeRock(S, dpr, v) {
  const H = ROCK_H * 0.75 * S, Wd = ROCK_H * S, pad = 1.2 * S;
  const w = Wd + pad * 2, h = H + pad * 2;
  const [c, x] = makeCanvas(w, h, dpr);
  const ax = w / 2, ay = pad + H;
  softEllipse(x, ax + 0.6 * S, ay - 0.05 * S, 0.9 * S, 0.4 * S, '70,60,80', 0.3);
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

function makeBlob() {
  const n = 256;
  const [c, x] = makeCanvas(n, n, 1);
  const [r, g, b] = C.AVALANCHE;
  const grad = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.6)`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.35)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, n, n);
  return { img: c, w: n, h: n };
}

function makeSprites(S, dpr) {
  return {
    trees: [0, 1, 2].map((v) => makeTree(S, dpr, v)),
    rocks: [0, 1, 2].map((v) => makeRock(S, dpr, v)),
    blob: makeBlob(),
  };
}

// ---------- Frame ----------

export function draw(R, g, t) {
  const { ctx, W, H, S } = R;
  const s = g.skier;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  ctx.fillStyle = C.BG;
  ctx.fillRect(0, 0, W, H);
  // Welt → Bildschirm: sx = x*S + ox, sy = y*S + oy
  const ox = W / 2 - g.camX * S;
  const oy = g.skierFrac * H - s.y * S;
  drawTrack(R, g, ox, oy);
  drawWorld(R, g, ox, oy);
  drawParticles(R, g, ox, oy);
  drawAvalanche(R, g, ox, oy, t);
  if (g.debug) drawDebug(R, g, ox, oy);
}

function drawTrack(R, g, ox, oy) {
  const { ctx, S } = R;
  const tr = g.track;
  if (tr.n < 2) return;
  ctx.strokeStyle = C.TRACK;
  ctx.lineWidth = Math.max(1, 0.12 * S);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const off of [-0.16, 0.16]) {
    ctx.beginPath();
    let pen = false;
    forEachTrackPoint(tr, (x, y, nx, ny, w, gap) => {
      const px = (x + nx * off) * S + ox;
      const py = (y + ny * off) * S + oy;
      if (py < -20) { pen = false; return; }
      if (gap || !pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
    });
    ctx.stroke();
  }
}

function drawWorld(R, g, ox, oy) {
  const { ctx, S, H, list } = R;
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
    if (o.skier) { drawSkier(R, g, g.skier.x * S + ox, g.skier.y * S + oy); continue; }
    const sp = o.t === TREE ? R.sprites.trees[o.variant] : R.sprites.rocks[o.variant];
    const sc = o.h / sp.nominal;
    ctx.drawImage(sp.img, o.x * S + ox - sp.ax * sc, o.y * S + oy - sp.ay * sc, sp.w * sc, sp.h * sc);
  }
}

function drawSkier(R, g, sx, sy) {
  const { ctx, S } = R;
  const s = g.skier;
  const z = jumpHeight(s);
  const dead = g.state === 'dead';
  ctx.save();
  if (dead && g.deadCause === 'avalanche') ctx.globalAlpha = Math.max(0, 1 - g.deadT / 0.7);
  // Schatten (wandert beim Sprung nach unten rechts)
  ctx.fillStyle = 'rgba(70,60,80,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx + (0.35 + 0.9 * z) * S, sy + (0.25 + 0.7 * z) * S, 0.5 * S, 0.3 * S, 0, 0, TAU);
  ctx.fill();
  ctx.translate(sx, sy - z * 0.6 * S);
  ctx.rotate(-s.theta);
  const sc = 1 + 0.25 * z;
  ctx.scale(sc, sc);
  if (dead && g.deadCause !== 'avalanche') ctx.rotate(Math.min(g.deadT, 0.6) * 9);
  // Ski
  ctx.strokeStyle = C.INK;
  ctx.lineWidth = Math.max(1, 0.09 * S);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.16 * S, -0.85 * S); ctx.lineTo(-0.16 * S, 0.75 * S);
  ctx.moveTo(0.16 * S, -0.85 * S); ctx.lineTo(0.16 * S, 0.75 * S);
  ctx.stroke();
  // Körper, leicht in die Kurve gelegt
  const lean = Math.sin(s.thetaCarve * 0.5) * 0.15 * S;
  ctx.fillStyle = C.INK;
  ctx.beginPath(); ctx.ellipse(lean, 0, 0.26 * S, 0.42 * S, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = C.INK_LIGHT;
  ctx.beginPath(); ctx.arc(lean * 1.3, -0.1 * S, 0.14 * S, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawParticles(R, g, ox, oy) {
  const { ctx, S } = R;
  const ps = g.particles.p;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.life <= 0) continue;
    const a = p.life / p.max;
    ctx.fillStyle = p.tone ? `rgba(200,190,205,${(0.55 * a).toFixed(2)})` : `rgba(255,255,255,${(0.9 * a).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(p.x * S + ox, p.y * S + oy, p.r, 0, TAU);
    ctx.fill();
  }
}

function drawAvalanche(R, g, ox, oy, t) {
  const { ctx, W, S } = R;
  const av = g.av;
  const fy = av.frontY * S + oy;
  const vis = avalancheVisibility(av);
  if (vis <= 0) return;
  const r = 40 + 90 * vis;
  const [cr, cg, cb] = C.AVALANCHE;
  const top = fy - r * 0.5;
  if (top > 0) {
    ctx.fillStyle = `rgba(${cr},${cg},${cb},0.55)`;
    ctx.fillRect(0, 0, W, top);
  }
  const blob = R.sprites.blob;
  const n = C.AV_BLOBS;
  for (let i = 0; i < n; i++) {
    const bx = (i / (n - 1)) * W + Math.sin(t * 0.7 + i * 1.7) * 14;
    const by = fy + Math.sin(t * 1.1 + i * 2.3) * 12 - r * 0.2;
    const rr = r * (1 + 0.08 * Math.sin(t * 4.4 + i * 1.3));
    ctx.drawImage(blob.img, bx - rr, by - rr, rr * 2, rr * 2);
  }
}

function drawDebug(R, g, ox, oy) {
  const { ctx, S, H, W } = R;
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
