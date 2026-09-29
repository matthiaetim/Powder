// Slalom: Führung im Schnee. An jeder Kippstange liegt ein gesprühter Bogen wie an den Innenstangen des Super-G
// (gate-marks.js), feiner und kleiner: sein Scheitel berührt die Stange von innen, er zeigt also, auf welcher Seite
// der Schwung außen herumführt, und seine Enden liegen dort, wo der Fahrer zur nächsten Stange hinüberzieht. An den
// Zwischenzeit-Toren ein Fleck an der Stange und eine Linie nach außen, dorthin, wo das Tor zählt.
// Alles in der Farbe der Pistencrew (GM_RGB); wo die Ski darüberfahren, verwischt die Farbe (snow-scrub.js).
// Die Bögen sind je Seite einmal vorgerendert. Dazu gibt es eine gesprühte Ideallinie vom Start bis ins Ziel
// (gates.js guideX), Standard aus (SL_LINE_PX 0). Sie ist zu lang für ein Bild: sie liegt in Stücken von
// SL_LINE_TILE_M vor, die erst entstehen, wenn sie ins Bild kommen, dazu je Bild höchstens eines auf Vorrat. Die
// Stücke hängen nur an Kurs und Maßstab und überleben darum den Neustart.
import { C } from './constants.js';
import { guideX } from './gates.js';
import { makeMark } from './gate-marks.js';
import { scrubRect } from './snow-scrub.js';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const LINE_STEP_M = 0.25; // Stützpunkte der Linie, fein genug für die engsten Schwünge

// Bogen in Pixeln relativ zur Stange (Fußpunkt 0,0). mir: Seite, auf der der Fahrer vorbeifährt (1 rechts).
function arcStrokes(S, mir) {
  const rx = C.SL_ARC_W_M * S, ry = rx * C.SL_ARC_OVAL;
  const cx = -mir * rx + mir * C.SL_ARC_PX / 2; // Scheitel an der Stange, dann die Innenkante der Linie
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const c = (C.GM_ARC_FROM_DEG + (C.GM_ARC_TO_DEG - C.GM_ARC_FROM_DEG) * i / 48) * D2R; // 0° bergauf, 90° Scheitel
    pts.push([cx + mir * Math.sin(c) * rx, -Math.cos(c) * ry]);
  }
  return [{ pts, width: C.SL_ARC_PX }];
}

function splitStrokes(S, mir) {
  const dot = [];
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU; dot.push([Math.cos(a) * 0.45 * S, Math.sin(a) * 0.45 * S]); }
  const y = 0.2 * S;
  return [
    { pts: dot, width: C.SL_SPLIT_DOT_PX },
    { pts: [[mir * 0.8 * S, y], [mir * C.SL_SPLIT_LINE_M * S, y]], width: C.SL_SPLIT_LINE_PX },
  ];
}

function markSprites(R) {
  const key = [R.spriteKey, C.SL_ARC_PX, C.SL_ARC_W_M, C.SL_ARC_OVAL].join('|');
  if (R.slMarks && R.slMarks.key === key) return R.slMarks;
  const sp = { key, arc: {}, extra: {} };
  for (const mir of [-1, 1]) {
    sp.arc[mir] = makeMark(arcStrokes(R.S, mir), C.GM_RGB, mir > 0 ? 13 : 29, R.dpr);
    sp.extra[mir] = makeMark(splitStrokes(R.S, mir), C.GM_RGB, mir > 0 ? 43 : 47, R.dpr);
  }
  R.slMarks = sp;
  return sp;
}

// Ein Stück der Ideallinie von Welt-y y0 bis y1, Bezugspunkt (x0, y0)
function makeTile(R, cs, i, y0, y1) {
  const S = R.S, x0 = guideX(cs, y0);
  const pts = [];
  for (let y = y0; y < y1; y += LINE_STEP_M) pts.push([(guideX(cs, y) - x0) * S, (y - y0) * S]);
  pts.push([(guideX(cs, y1) - x0) * S, (y1 - y0) * S]);
  const sp = makeMark([{ pts, width: C.SL_LINE_PX }], C.GM_RGB, 71 + i * 13, R.dpr);
  sp.x0 = x0;
  sp.y0 = y0;
  return sp;
}

function tilesFor(R, g) {
  const key = [R.spriteKey, g.seed, C.SL_FINISH_M, C.SL_GATE_FIRST_M, C.SL_GATE_SPACING_M, C.SL_POLE_OFFSET_M, C.SL_LINE_CLEAR_M,
    C.SL_LINE_PX, C.SL_LINE_TILE_M, C.SL_LANE_AMP_M, C.SL_LANE_WAVE_M].join('|');
  if (!R.slLine || R.slLine.key !== key) R.slLine = { key, tiles: new Array(Math.ceil(C.SL_FINISH_M / C.SL_LINE_TILE_M)).fill(null) };
  return R.slLine.tiles;
}

// Zeichnen und verwischen; hinter dem Fahrer liegt die Spur, nur dort gibt es etwas zu verwischen
function put(R, g, ox, oy, sp, wx, wy, alpha, rails) {
  const { ctx, Sv: S } = R;
  const k = S / R.S;
  const r = { x: wx * S + ox - sp.ax * k, y: wy * S + oy - sp.ay * k, w: sp.w * k, h: sp.h * k };
  ctx.globalAlpha = alpha;
  ctx.drawImage(sp.img, r.x, r.y, r.w, r.h);
  ctx.globalAlpha = 1;
  if ((r.y - oy) / S <= g.skier.y + 1) scrubRect(R, g, ox, oy, r, rails);
}

// rails: Linien des Fahrers für das Verwischen (render.js railsOf)
export function drawGuide(R, g, ox, oy, rails) {
  const cs = g.course;
  if (!cs || !cs.guide) return;
  const { Sv: S, W, H } = R;
  const yTop = -oy / S, yBot = (H - oy) / S;

  if (C.SL_LINE_PX > 0) {
    const tiles = tilesFor(R, g), L = C.SL_LINE_TILE_M;
    const i0 = Math.max(0, Math.floor(yTop / L) - 1), i1 = Math.min(tiles.length - 1, Math.floor(yBot / L) + 1);
    const tile = (i) => tiles[i] || (tiles[i] = makeTile(R, cs, i, i * L, Math.min(cs.finishY, (i + 1) * L)));
    for (let i = i0; i <= i1; i++) {
      const sp = tile(i);
      put(R, g, ox, oy, sp, sp.x0, sp.y0, C.SL_LINE_ALPHA, rails);
    }
    // eines auf Vorrat, das nächste fehlende voraus: so steht die Linie, bevor der Fahrer ankommt
    for (let i = i1 + 1; i < tiles.length; i++) if (!tiles[i]) { tile(i); break; }
  }

  const sps = markSprites(R);
  const reach = (C.SL_ARC_W_M * C.SL_ARC_OVAL + 2) * S;
  for (const gt of cs.gates) {
    const sx = gt.x * S + ox, sy = gt.y * S + oy;
    if (sy + reach < 0 || sy - reach > H || sx < -W || sx > 2 * W) continue;
    const mir = gt.side > 0 ? 1 : -1;
    put(R, g, ox, oy, sps.arc[mir], gt.x, gt.y, C.GM_ARC_ALPHA, rails);
    if (gt.split >= 0) put(R, g, ox, oy, sps.extra[mir], gt.x, gt.y, 1, rails);
  }
}
