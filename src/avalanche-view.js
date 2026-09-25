// Die Lawine im Bild: das Licht geht weg. Über der Front liegt ein Schleier aus Schiefergrau, der Rand wogt
// mit weichen dunklen Wülsten, davor züngeln dünne Schattenfahnen. Je näher sie kommt, desto dämmriger wird
// das ganze Bild. Alles ist aus Zeit und Weg der Front berechnet (kein Zustand pro Bild), Pause und Fresh
// müssen nichts zurücksetzen.
import { C } from './constants.js';

const TAU = Math.PI * 2;
const frac = (v) => v - Math.floor(v);
const hash = (n) => frac(Math.sin(n * 12.9898 + 78.233) * 43758.5453); // deterministisches Rauschen 0..1

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

// Einmal vorgerendert: der dunkle Wulst, aus dem der wogende Rand des Schleiers besteht.
export function makeAvSprites() {
  return { blob: softDisc(C.AVALANCHE.join(','), 0.6, 0.35, 0.45) };
}

export function drawAvalanche(R, g, ox, oy, t) {
  const av = g.av, S = R.Sv;
  const fy = av.frontY * S + oy; // Vorderkante im Bild
  if (fy < -8 * S) return;       // die Schattenfahnen vor der Front reichen höchstens 6 m weit
  const { ctx, W, H } = R;
  const { blob } = R.sprites.av;
  const rgb = C.AVALANCHE.join(',');
  // Dämmerung: je näher die Front, desto dunkler das ganze Bild
  if (av.threat > 0) {
    ctx.fillStyle = `rgba(${rgb},${(0.2 * av.threat).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  // Schleier: deckt alles über der Front, nach oben hin dichter
  const bodyY = fy - 2.6 * S;
  if (bodyY > 0) {
    const grad = ctx.createLinearGradient(0, Math.max(0, bodyY - 20 * S), 0, bodyY);
    grad.addColorStop(0, `rgba(${rgb},0.66)`);
    grad.addColorStop(1, `rgba(${rgb},0.5)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, bodyY);
  }
  // Rand: weiche dunkle Wülste, die mit Zeit und Weg wogen
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
