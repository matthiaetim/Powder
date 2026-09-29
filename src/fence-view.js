// Slalom: der orangefarbene Fangzaun am Pistenrand (Wand und Beule: fence.js), nach Jürgens Entwurf. Von oben als Band
// mit Rautenmuster auf Pfosten, die wie Bäume und Stangen nach oben stehen; er folgt der Pistenmitte (laneX). Das Netz
// liegt in Stücken von Pfosten zu Pfosten; nur dort, wo der Fahrer drinhängt, wird es feiner geteilt, damit es sich
// nach außen beulen kann (weicher Buckel über ±SL_NET_BULGE_M, Tiefe aus fence.js). Die Pfosten geben halb so weit
// nach. Textur einmal je Maßstab vorgerendert, gezeichnet vor dem Fahrer: wer im Netz hängt, liegt davor.
import { C } from './constants.js';
import { laneX } from './world.js';
import { halfAt } from './fence.js';

const FINE = 4;       // so viele Stücke je Pfostenfeld im Bereich der Beule
const POST_H_M = 1.2;
const AFTER_M = 150;  // ohne Zielstadion steht der Zaun so weit hinter dem Ziel weiter, der Auslauf bleibt eingefasst

function makeCanvas(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  return [c, x];
}

// Netz: halbdurchsichtiges Orange mit Rauten, kräftige Ober- und Unterkante
function makeNet(S, dpr) {
  const w = C.SL_FENCE_POST_M * S, h = C.SL_FENCE_NET_M * S;
  const [c, x] = makeCanvas(w, h, dpr);
  x.fillStyle = `rgba(${C.FENCE_NET_RGB},0.32)`; x.fillRect(0, 0, w, h);
  x.strokeStyle = C.FENCE_NET; x.lineWidth = Math.max(0.8, 0.05 * S);
  const step = Math.max(4, 0.35 * S);
  x.beginPath();
  for (let u = -h; u < w + h; u += step) { x.moveTo(u, 0); x.lineTo(u + h, h); x.moveTo(u + h, 0); x.lineTo(u, h); }
  x.stroke();
  x.strokeStyle = C.FENCE_EDGE; x.lineWidth = Math.max(1.2, 0.09 * S);
  x.beginPath(); x.moveTo(0, 0.5); x.lineTo(w, 0.5); x.moveTo(0, h - 0.5); x.lineTo(w, h - 0.5); x.stroke();
  return c;
}

function netFor(R) {
  const key = R.spriteKey + '|' + C.SL_FENCE_POST_M + '|' + C.SL_FENCE_NET_M;
  if (!R.fence || R.fence.key !== key) R.fence = { key, net: makeNet(R.S, R.dpr) };
  return R.fence.net;
}

// Ein Stück Netz von a nach b, wPx breit nach links der Laufrichtung, aus der Textur der Ausschnitt u0..u1 (Anteil
// der Länge), mit hartem Schatten nach unten rechts
function piece(ctx, img, u0, u1, ax, ay, bx, by, wPx, shadow) {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 0.5) return;
  const nx = (-(by - ay) / len) * wPx, ny = ((bx - ax) / len) * wPx;
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.moveTo(ax + 2, ay + 2); ctx.lineTo(bx + 2, by + 2); ctx.lineTo(bx + nx + 2, by + ny + 2); ctx.lineTo(ax + nx + 2, ay + ny + 2);
  ctx.closePath(); ctx.fill();
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(Math.atan2(by - ay, bx - ax));
  const sx = u0 * img.width, sw = Math.max(1, (u1 - u0) * img.width);
  ctx.drawImage(img, sx, 0, sw, img.height, 0, 0, len + 0.5, wPx);
  ctx.restore();
}

export function drawFence(R, g, ox, oy) {
  const cs = g.course;
  if (!cs || !cs.spec.fence) return;
  const { ctx, Sv: S, H } = R;
  const net = netFor(R);
  const w = g.world, P = C.SL_FENCE_POST_M;
  // Mit Zielstadion endet der Zaun an den Türmen des Zielbogens, dahinter stehen die Banden
  const yEnd = cs.spec.stadium ? cs.finishY : cs.finishY + AFTER_M;
  const yTop = Math.max(-40, -oy / S - 2), yBot = Math.min(yEnd, (H - oy) / S + POST_H_M + 1);
  if (yBot <= yTop) return;
  // Beule: weicher Buckel um die Lage des Fahrers, nur auf seiner Seite
  const f = cs.fence, B = C.SL_NET_BULGE_M;
  const live = !!f && f.depth !== 0;
  const bulge = (y, side) => {
    if (!live || f.side !== side) return 0;
    const u = (y - f.y) / B;
    return Math.abs(u) < 1 ? f.depth * 0.5 * (1 + Math.cos(Math.PI * u)) : 0;
  };
  const pt = (y, side) => [(laneX(w, y) + side * (halfAt(cs, y) + bulge(y, side))) * S + ox, y * S + oy];
  const nw = C.SL_FENCE_NET_M * S, shadow = `rgba(${C.SHADOW_RGB},0.16)`;
  for (let ya = Math.floor(yTop / P) * P; ya < yBot; ya += P) {
    for (const side of [-1, 1]) {
      const n = live && f.side === side && ya + P > f.y - B && ya < f.y + B ? FINE : 1;
      for (let k = 0; k < n; k++) {
        const u0 = k / n, u1 = (k + 1) / n;
        const [ax, ay] = pt(Math.min(yEnd, ya + u0 * P), side), [bx, by] = pt(Math.min(yEnd, ya + u1 * P), side);
        if (side < 0) piece(ctx, net, u0, u1, ax, ay, bx, by, nw, shadow);
        else piece(ctx, net, 1 - u1, 1 - u0, bx, by, ax, ay, nw, shadow);
      }
    }
  }
  // Pfosten obendrauf, sie geben halb so weit nach wie das Netz
  const pw = Math.max(2, 0.12 * S), ph = POST_H_M * S;
  ctx.fillStyle = C.INK;
  for (let ya = Math.floor(yTop / P) * P; ya < yBot; ya += P) {
    for (const side of [-1, 1]) {
      const px = (laneX(w, ya) + side * (halfAt(cs, ya) + C.SL_FENCE_NET_M / 2 + 0.5 * bulge(ya, side))) * S + ox, py = ya * S + oy;
      ctx.fillRect(px - pw / 2, py - ph, pw, ph);
    }
  }
}
