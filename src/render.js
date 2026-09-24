// Zeichnet die Welt auf den Canvas. HUD und Overlays sind DOM (siehe hud.js).
import { C } from './constants.js';
import { TREE } from './physics.js';
import { forEachTrackPoint } from './track.js';
import { avalancheVisibility } from './avalanche.js';
import { laneX } from './world.js';

const TAU = Math.PI * 2;
const TREE_H = 2.8; // nominale Sprite-Höhe in Metern
const ROCK_H = 1.4;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  return { canvas, ctx, W: 0, H: 0, dpr: 1, S: 10, sprites: null, spriteKey: '', list: [], skierMarker: { skier: true, y: 0 }, frameMs: 16.7, trackPts: new Float32Array(C.TRACK_CAP * 6), snow: createSnow() };
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
  if (g.mode === 'chase') drawAvalanche(R, g, ox, oy, t);
  drawWhiteout(R, g);
  drawSnow(R, g, t);
  if (g.debug) drawDebug(R, g, ox, oy);
}

function drawTrack(R, g, ox, oy) {
  const { ctx, S } = R;
  const tr = g.track;
  if (tr.n < 2) return;
  // Punkte einmal in Bildschirmkoordinaten sammeln: sx, sy, nx*S, ny*S, Carve, Lücke
  const pts = R.trackPts;
  let n = 0;
  forEachTrackPoint(tr, (x, y, nx, ny, w, gap) => {
    const i = n * 6;
    pts[i] = x * S + ox; pts[i + 1] = y * S + oy; pts[i + 2] = nx * S; pts[i + 3] = ny * S; pts[i + 4] = w; pts[i + 5] = gap ? 1 : 0;
    n++;
  });
  const base = Math.max(1, 0.12 * S);
  const buckets = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let b = 0; b < buckets; b++) {
    ctx.lineWidth = base * (1 + (C.TRACK_WIDTH_MAX - 1) * ((b + 0.5) / buckets));
    ctx.strokeStyle = `rgba(58,51,64,${(0.18 + (0.14 * b) / (buckets - 1)).toFixed(2)})`;
    for (const off of [-0.16, 0.16]) {
      ctx.beginPath();
      let any = false;
      for (let i = 1; i < n; i++) {
        const j = i * 6, k = j - 6;
        if (pts[j + 5] > 0 || pts[k + 1] < -20) continue;
        const wb = Math.min(buckets - 1, Math.floor(pts[j + 4] * buckets));
        if (wb !== b) continue;
        ctx.moveTo(pts[k] + pts[k + 2] * off, pts[k + 1] + pts[k + 3] * off);
        ctx.lineTo(pts[j] + pts[j + 2] * off, pts[j + 1] + pts[j + 3] * off);
        any = true;
      }
      if (any) ctx.stroke();
    }
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
  const dead = g.state === 'dead';
  ctx.save();
  if (dead && g.deadCause === 'avalanche') ctx.globalAlpha = Math.max(0, 1 - g.deadT / 0.7);
  // Schatten nach unten rechts
  ctx.fillStyle = 'rgba(70,60,80,0.25)';
  ctx.beginPath();
  ctx.ellipse(sx + 0.35 * S, sy + 0.25 * S, 0.5 * S, 0.3 * S, 0, 0, TAU);
  ctx.fill();
  ctx.translate(sx, sy);
  ctx.rotate(-s.theta);
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
  const lean = Math.sin(s.theta * 0.5) * 0.15 * S * s.carve;
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
  if (g.state === 'running' || g.state === 'paused') return avalancheVisibility(g.av);
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
  ctx.strokeStyle = 'rgba(58,51,64,0.16)';
  ctx.stroke();
}

function drawWhiteout(R, g) {
  if (g.state !== 'dead' || g.deadCause !== 'avalanche') return;
  const a = Math.min(1, g.deadT / C.WHITEOUT_S);
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
    // Schneewand von oben: weiche weiße Wolke mit leichtem Schatten darunter
    const g1 = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    g1.addColorStop(0, 'rgba(58,51,64,0.16)');
    g1.addColorStop(1, 'rgba(58,51,64,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H * 0.5);
    for (let i = 0; i < 7; i++) {
      const bx = (i / 6) * W, by = H * 0.08 + Math.sin(i * 2.1) * 4, r = 12 + (i % 3) * 3;
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(bx - r, by - r, r * 2, r * 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(58,51,64,0.18)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const fx = ((i * 37) % 100) / 100 * W, fy = H * 0.15 + ((i * 53) % 100) / 100 * H * 0.55, r = 1 + (i % 3) * 0.6;
      ctx.moveTo(fx + r, fy);
      ctx.arc(fx, fy, r, 0, TAU);
    }
    ctx.fill();
    ctx.stroke();
  }
}
