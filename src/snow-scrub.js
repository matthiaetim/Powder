// Farbe im Schnee verwischt unter den Ski, wie der Schriftzug bei SIGN_Y_M (render.js): wo die Spur über eine
// gesprühte Markierung läuft, wird die Farbe wieder zu Schnee. Die Markierungen liegen direkt auf dem Schnee, deshalb
// genügt es, in jedem Bild die Spur im Bereich der Markierung in Schneefarbe (C.BG) nachzuziehen: je Ski ein Strich in
// Spurbreite mit SIGN_ERASE_ALPHA, dazu ein breiter, schwacher Strich für den aufgewirbelten Schnee
// (SIGN_SPRAY_W_M, SIGN_SPRAY_ALPHA), dieselben Werte wie beim Schriftzug. Der Ringpuffer der Spur reicht weit genug
// zurück (TRACK_CAP Punkte), hinter dem Fahrer ist ohnehin nur ein kurzes Stück im Bild.
// Aufruf gleich nach dem Zeichnen der Markierung und vor der Spur; rect begrenzt auf die Markierung (Bildpixel),
// damit nichts anderes mitverwischt wird. rails: Linien des Fahrers (render.js railsOf).
import { C } from './constants.js';
import { forEachTrackPoint } from './track.js';

const BG_RGB = (() => {
  const n = parseInt(C.BG.slice(1), 16);
  return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
})();

export function scrubRect(R, g, ox, oy, rect, rails) {
  const tr = g.track;
  if (tr.n < 2 || rect.w <= 0 || rect.h <= 0) return;
  const { ctx, Sv: S } = R;
  const y0 = (rect.y - oy) / S - 1, y1 = (rect.y + rect.h - oy) / S + 1; // Welt-y mit Rand für die Strichbreite
  const sprayW = C.SIGN_SPRAY_W_M * S;
  let px = 0, py = 0, pnx = 0, pny = 0, pplow = 0, has = false, any = false;
  forEachTrackPoint(tr, (x, y, nx, ny, w, gap, plow) => {
    if (has && !gap && ((py >= y0 && py <= y1) || (y >= y0 && y <= y1))) {
      if (!any) {
        any = true;
        ctx.save();
        ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
        ctx.lineCap = 'round';
      }
      const carve = Math.max(w, 0.6 * plow);
      const lw = Math.max(1, 0.12 * S) * (1 + (C.TRACK_WIDTH_MAX - 1) * carve) * C.SIGN_ERASE_WIDTH_K * rails.w;
      for (const side of rails.sides) {
        const offA = side * (rails.gauge + C.PLOW_SPREAD_M * pplow), offB = side * (rails.gauge + C.PLOW_SPREAD_M * plow);
        const ax = (px + pnx * offA) * S + ox, ay = (py + pny * offA) * S + oy;
        const bx = (x + nx * offB) * S + ox, by = (y + ny * offB) * S + oy;
        ctx.strokeStyle = `rgba(${BG_RGB},${C.SIGN_SPRAY_ALPHA})`;
        ctx.lineWidth = lw + sprayW;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = `rgba(${BG_RGB},${C.SIGN_ERASE_ALPHA})`;
        ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
    }
    px = x; py = y; pnx = nx; pny = ny; pplow = plow; has = true;
  });
  if (any) ctx.restore();
}
