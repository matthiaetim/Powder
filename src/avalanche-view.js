// Die Lawine im Bild, drei Looks (C.AV_STYLE): 1 Wolke, 2 Schatten, 3 Bruch. Alles ist aus Zeit und Weg
// der Front berechnet (kein Zustand pro Bild), Pause und Fresh müssen nichts zurücksetzen.
import { C } from './constants.js';

const TAU = Math.PI * 2;
const frac = (v) => v - Math.floor(v);
const hash = (n) => frac(Math.sin(n * 12.9898 + 78.233) * 43758.5453); // deterministisches Rauschen 0..1
const TONES = ['#FFFFFF', '#D3DDE6', '#B9C7D2'];

function softDisc(rgb, a0, a1, mid) {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, `rgba(${rgb},${a0})`);
  grad.addColorStop(mid, `rgba(${rgb},${a1})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, n, n);
  return c;
}

// Einmal vorgerendert: weißer Wulst, sein Schatten, dunkler Wulst.
export function makeAvSprites() {
  return {
    puff: softDisc('255,255,255', 1, 1, 0.62),
    shade: softDisc(C.SHADOW_RGB, 0.32, 0.18, 0.5),
    blob: softDisc(C.AVALANCHE.join(','), 0.6, 0.35, 0.45),
  };
}

export function drawAvalanche(R, g, ox, oy, t) {
  const av = g.av, S = R.Sv;
  const fy = av.frontY * S + oy; // Vorderkante im Bild
  if (fy < -8 * S) return;       // was vor der Front liegt, reicht höchstens 7 m weit
  const style = Math.round(C.AV_STYLE);
  if (style === 2) drawSchatten(R, av, fy, S, t);
  else if (style === 3) drawBruch(R, av, fy, S, t);
  else drawWolke(R, av, fy, S, t);
}

// 1 Wolke: eine weiße Schneewolke quillt über den Bildrand. Die Wolke ist heller als der Schnee, Kontur
// geben die weichen Schatten der Wülste nach unten rechts und der Bodenschatten; davor spritzt Staub.
function drawWolke(R, av, fy, S, t) {
  const { ctx, W } = R;
  const { puff, shade } = R.sprites.av;
  const gy = fy - 0.6 * S;
  const grad = ctx.createLinearGradient(0, gy, 0, gy + 3.2 * S);
  grad.addColorStop(0, `rgba(${C.SHADOW_RGB},0.22)`);
  grad.addColorStop(1, `rgba(${C.SHADOW_RGB},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, gy, W, 3.2 * S);
  const sp = 3.0 * S, n = Math.ceil(W / sp) + 2;
  const lobe = (i, row) => {
    const seed = i * 7.31 + row * 3.7;
    const ph = t * (0.7 + 0.5 * hash(seed)) + hash(seed + 1) * TAU + av.roll * 0.08;
    const r = (row ? 2.0 : 2.6) * S * (1 + 0.16 * Math.sin(ph));
    const x = (i - 1 + (row ? 0.5 : 0)) * sp + Math.sin(ph * 0.6) * 0.5 * S;
    const y = fy - (row ? 3.6 : 1.2) * S - r * 0.3 + Math.cos(ph) * 0.3 * S;
    return [x, y, r];
  };
  // Schatten der vorderen Wülste, dann der Wolkenkörper darüber, dann die Wülste selbst
  for (let i = 0; i < n; i++) {
    const [x, y, r] = lobe(i, 0);
    ctx.drawImage(shade, x - r * 1.1 + 0.5 * S, y - r * 1.1 + 0.6 * S, r * 2.2, r * 2.2);
  }
  // Körper: weiß, nach oben hin leicht getönt, damit die Masse gegen den Schnee steht
  const bodyY = fy - 3 * S;
  if (bodyY > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, bodyY);
    const tint = ctx.createLinearGradient(0, Math.max(0, bodyY - 24 * S), 0, bodyY);
    tint.addColorStop(0, `rgba(${C.TRACK_RGB},0.16)`);
    tint.addColorStop(1, `rgba(${C.TRACK_RGB},0)`);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, bodyY);
  }
  for (let row = 1; row >= 0; row--) {
    for (let i = 0; i < n; i++) {
      const [x, y, r] = lobe(i, row);
      ctx.drawImage(puff, x - r, y - r, r * 2, r * 2);
    }
  }
  // Staub: Wölkchen, die vor der Front herausspritzen, wachsen und verwehen
  for (let i = 0; i < 12; i++) {
    const ph = frac(t * (0.35 + 0.3 * hash(i * 3.3)) + hash(i * 5.1));
    const x = hash(i * 2.7) * W + Math.sin(t * 0.8 + i) * 0.6 * S;
    const y = fy + (0.3 + 5 * ph) * S;
    const r = (0.4 + 1.0 * ph) * S;
    ctx.globalAlpha = (1 - ph) * 0.85;
    ctx.drawImage(puff, x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

// 2 Schatten: das Licht geht weg. Über der Front liegt ein Schleier aus Schiefergrau, der Rand wogt mit
// weichen dunklen Wülsten, davor züngeln dünne Schattenfahnen. Je näher, desto dämmriger das ganze Bild.
function drawSchatten(R, av, fy, S, t) {
  const { ctx, W, H } = R;
  const { blob } = R.sprites.av;
  const rgb = C.AVALANCHE.join(',');
  if (av.threat > 0) {
    ctx.fillStyle = `rgba(${rgb},${(0.2 * av.threat).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  const bodyY = fy - 2.6 * S;
  if (bodyY > 0) {
    const grad = ctx.createLinearGradient(0, Math.max(0, bodyY - 20 * S), 0, bodyY);
    grad.addColorStop(0, `rgba(${rgb},0.66)`);
    grad.addColorStop(1, `rgba(${rgb},0.5)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, bodyY);
  }
  const sp = 2.6 * S, n = Math.ceil(W / sp) + 2;
  for (let i = 0; i < n; i++) {
    const ph = t * (0.8 + 0.5 * hash(i * 1.9)) + hash(i * 4.1) * TAU + av.roll * 0.1;
    const r = 3.0 * S * (1 + 0.15 * Math.sin(ph));
    const x = (i - 1) * sp + Math.sin(ph * 0.5) * 0.6 * S;
    const y = fy - 2.0 * S + Math.cos(ph) * 0.4 * S;
    ctx.drawImage(blob, x - r, y - r, r * 2, r * 2);
  }
  // Fahnen: dünne Schattenstreifen, die vor der Front nach unten züngeln
  ctx.lineWidth = Math.max(1, 0.12 * S);
  ctx.lineCap = 'round';
  for (let i = 0; i < 18; i++) {
    const ph = frac(t * (0.45 + 0.4 * hash(i * 1.7)) + hash(i * 4.4));
    const x = hash(i * 2.2) * W + Math.sin(t * 0.7 + i) * 0.5 * S;
    const len = (1.0 + 5.0 * ph) * S;
    ctx.strokeStyle = `rgba(${rgb},${(0.35 * (1 - ph)).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(x, fy - 0.8 * S);
    ctx.lineTo(x + Math.sin(ph * 6 + i) * 0.5 * S, fy + len);
    ctx.stroke();
  }
}

// 3 Bruch: der Hang bricht als flache Platte ab. Die Kante ist eine Treppe aus Rasterzellen, die mit dem
// Weg neu bröckelt; davor rollen Brocken heraus, drehen sich, bleiben liegen und werden überrollt (wie die
// Splitter beim Aufprall in render.js).
function drawBruch(R, av, fy, S, t) {
  const { ctx, W, dpr } = R;
  const cell = 1.0;                         // Rasterzelle in m
  const step = Math.max(2, cell * S);
  const cols = Math.ceil(W / step) + 1;
  const k = Math.floor(av.roll / cell);     // die Kante bröckelt mit jedem Rasterschritt Weg
  ctx.fillStyle = '#E3EAF0';
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  for (let c = 0; c < cols; c++) {
    const h = hash(c * 1.3 + k * 0.37) * 2 + hash(c * 0.61 + (k >> 2) * 0.11 + 5.5) * 2; // 0..4 m
    const y = fy - Math.floor(h / cell) * cell * S;
    ctx.lineTo(c * step, y);
    ctx.lineTo((c + 1) * step, y);
  }
  ctx.lineTo(W + 10, -10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(${C.TRACK_RGB},0.28)`;
  ctx.lineWidth = 1;
  ctx.stroke();
  const N = 40;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < N; i++) {
      const D = 2.5 + 4.5 * hash(i * 1.1);             // so weit rollt der Brocken vor die Kante (m)
      const L = D + 3;                                 // Zykluslänge in m Weg der Front
      const u = frac(av.roll / L + hash(i * 2.3)) * L; // Weg der Front seit dem Losbrechen
      const d = D * (1 - Math.exp(-u / 1.2));          // vorgerollter Weg: schnell los, dann liegen bleiben
      const rel = d - u;                               // Lage vor der aktuellen Kante (negativ = überrollt)
      if (rel < -3) continue;
      const size = (0.45 + 0.75 * hash(i * 3.7)) * S;
      const x = hash(i * 5.3) * W;
      const y = fy + rel * S;
      const rot = (d / (0.6 + hash(i * 7.7))) * (hash(i * 9.1) > 0.5 ? 1 : -1);
      const cs = Math.cos(rot) * dpr, sn = Math.sin(rot) * dpr;
      if (pass === 0) {
        ctx.fillStyle = `rgba(${C.SHADOW_RGB},0.22)`;
        ctx.setTransform(cs, sn, -sn, cs, (x + 0.35 * S) * dpr, (y + 0.45 * S) * dpr);
      } else {
        ctx.fillStyle = TONES[i % 3];
        ctx.setTransform(cs, sn, -sn, cs, x * dpr, y * dpr);
      }
      ctx.fillRect(-size / 2, -size / 2, size, size);
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
