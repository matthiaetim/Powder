// Super-G: gesprühte Markierung an den Innenstangen, wie die Pistencrew sie mit Farbe in den Schnee sprüht. Die
// Innenstange ist die zur Pistenmitte hin, um sie zieht der Fahrer den Schwung. Um sie liegt ein ovaler Bogen
// (GM_ARC_*): sein Scheitel zeigt zur Toröffnung, und die Innenkante der Sprühlinie berührt die Stange, der Bogen
// liegt also zur Pistenmitte hin, etwas blasser (GM_ARC_ALPHA). An den Zwischenzeit-Toren (gates.js, split) kommen
// ein Fleck an der Stange und eine waagerechte Linie zur Außenstange dazu. Alles bleibt blau: ob man schneller ist,
// zeigt nur der Hinweis unter dem Fahrer, im Schnee blinkt nichts.
// Alles einmal als Sprite vorgerendert (je Seite), gezeichnet unter der Spur; wo die Ski darüberfahren, verwischt die
// Farbe wie beim Schriftzug bei 333 m (snow-scrub.js).
import { C } from './constants.js';
import { mulberry32 } from './world.js';
import { scrubRect } from './snow-scrub.js';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

function makeCanvas(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  return [c, x];
}

// Sprühstrich wie mit der Airbrush in Paint: entlang der Punkte viele kleine Tupfer, gestreut über die Strichbreite,
// zur Mitte hin dichter, mit schwankender Deckkraft
function spray(x, pts, width, rgb, seed) {
  const R = mulberry32(seed);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 3));
    for (let k = 0; k < n; k++) {
      const f = k / n, px = ax + (bx - ax) * f, py = ay + (by - ay) * f;
      for (let d = 0; d < 7; d++) {
        const a = R() * TAU, rr = Math.sqrt(R()) * (width / 2) * (0.6 + 0.6 * R());
        x.fillStyle = `rgba(${rgb},${(0.2 + 0.45 * R() * (1 - rr / width)).toFixed(2)})`;
        x.beginPath();
        x.arc(px + Math.cos(a) * rr, py + Math.sin(a) * rr, 1.2 * (0.5 + R()), 0, TAU);
        x.fill();
      }
    }
  }
}

// Striche in Pixeln relativ zur Innenstange (Fußpunkt 0,0): [{ pts, width }]. mir: Richtung zur Toröffnung (1 rechts).
function arcStrokes(S, mir) {
  const rx = C.GM_ARC_W_M * S, ry = rx * C.GM_ARC_OVAL;
  const cx = -mir * rx + mir * C.GM_SPRAY_PX / 2; // Scheitel an der Stange, dann die Innenkante der Linie
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const c = (C.GM_ARC_FROM_DEG + (C.GM_ARC_TO_DEG - C.GM_ARC_FROM_DEG) * i / 60) * D2R; // 0° bergauf, 90° Scheitel
    pts.push([cx + mir * Math.sin(c) * rx, -Math.cos(c) * ry]);
  }
  return [{ pts, width: C.GM_SPRAY_PX }];
}

function splitStrokes(S, mir, gateW) {
  const dot = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU; dot.push([Math.cos(a) * 0.45 * S, Math.sin(a) * 0.45 * S]); }
  const y = 0.2 * S;
  return [
    { pts: dot, width: C.GM_DOT_PX },
    { pts: [[mir * 0.8 * S, y], [mir * (gateW - 0.8) * S, y]], width: C.GM_LINE_PX },
  ];
}

// Sprite aus Strichen: Maße aus den Punkten, Fußpunkt der Stange bei (ax, ay)
function makeMark(strokes, rgb, seed, dpr) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [px, py] of s.pts) {
    const m = s.width / 2 + 3;
    x0 = Math.min(x0, px - m); y0 = Math.min(y0, py - m); x1 = Math.max(x1, px + m); y1 = Math.max(y1, py + m);
  }
  const [c, x] = makeCanvas(x1 - x0, y1 - y0, dpr);
  x.translate(-x0, -y0);
  strokes.forEach((s, i) => spray(x, s.pts, s.width, rgb, seed + i * 101));
  return { img: c, w: x1 - x0, h: y1 - y0, ax: -x0, ay: -y0 };
}

// Sprites je Maßstab und Torbreite (Regler): arc[mir], extra[mir]
function spritesFor(R, gateW) {
  const key = R.spriteKey + '|' + gateW;
  if (R.gateMarks && R.gateMarks.key === key) return R.gateMarks;
  const sp = { key, arc: {}, extra: {} };
  for (const mir of [-1, 1]) {
    sp.arc[mir] = makeMark(arcStrokes(R.S, mir), C.GM_RGB, mir > 0 ? 11 : 23, R.dpr);
    sp.extra[mir] = makeMark(splitStrokes(R.S, mir, gateW), C.GM_RGB, mir > 0 ? 37 : 41, R.dpr);
  }
  R.gateMarks = sp;
  return sp;
}


// rails: Linien des Fahrers für das Verwischen (render.js railsOf)
export function drawGateMarks(R, g, ox, oy, rails) {
  const cs = g.course;
  if (!cs) return;
  const { ctx, Sv: S, W, H } = R;
  const sps = spritesFor(R, C.SG_GATE_WIDTH_M);
  const k = S / R.S;
  const reach = (C.GM_ARC_W_M * C.GM_ARC_OVAL + 2) * S;
  for (const gt of cs.gates) {
    const pole = gt.poles[gt.side > 0 ? 0 : 1];
    const sx = pole.x * S + ox, sy = pole.y * S + oy;
    if (sy + reach < 0 || sy - reach > H || sx < -W || sx > 2 * W) continue;
    const mir = gt.side > 0 ? 1 : -1;
    const layers = gt.split >= 0 ? [[sps.arc[mir], C.GM_ARC_ALPHA], [sps.extra[mir], 1]] : [[sps.arc[mir], C.GM_ARC_ALPHA]];
    for (const [sp, alpha] of layers) {
      const r = { x: sx - sp.ax * k, y: sy - sp.ay * k, w: sp.w * k, h: sp.h * k };
      ctx.globalAlpha = alpha;
      ctx.drawImage(sp.img, r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1;
      scrubRect(R, g, ox, oy, r, rails);
    }
  }
  ctx.globalAlpha = 1;
}
