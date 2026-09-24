// Eingabe: Pointer Events (Touch/Maus) und Tastatur → Tipp, Halten, Doppeltipp, Sprung, Pause, Fresh.
import { C } from './constants.js';

export function createInput(canvas, h) {
  let active = null;   // aktuell gedrückter Finger/Taste
  let lastTap = null;  // letzter kurzer Tipp (für Doppeltipp)
  const now = () => performance.now();

  function down(id, side, x, y, allowDouble) {
    if (active) return; // nur der erste Finger zählt
    const t = now();
    if (allowDouble && lastTap && t - lastTap.t < C.DOUBLE_TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < C.DOUBLE_TAP_PX) {
      active = { id, consumed: true };
      const base = lastTap.base;
      lastTap = null;
      h.doubleTap(base);
      return;
    }
    active = { id, side, t0: t, x0: x, y0: y, base: h.getBase(), consumed: false, moved: false };
    h.press(side);
  }

  function move(id, x, y) {
    if (!active || active.id !== id || active.consumed) return;
    if (Math.hypot(x - active.x0, y - active.y0) > C.TAP_MAX_MOVE_PX) active.moved = true;
  }

  function up(id, cancelled) {
    if (!active || active.id !== id) return;
    const a = active;
    active = null;
    if (a.consumed) return;
    const dur = now() - a.t0;
    if (!cancelled && dur < C.TAP_MAX_MS && !a.moved) {
      h.tap(a.side, a.base);
      lastTap = { t: now(), x: a.x0, y: a.y0, base: a.base };
    } else {
      h.release();
      lastTap = null;
    }
  }

  function cancelAll() {
    if (active && !active.consumed) h.release();
    active = null;
    lastTap = null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
    const side = e.clientX < window.innerWidth / 2 ? -1 : 1;
    down(e.pointerId, side, e.clientX, e.clientY, true);
  });
  canvas.addEventListener('pointermove', (e) => move(e.pointerId, e.clientX, e.clientY));
  canvas.addEventListener('pointerup', (e) => up(e.pointerId, false));
  canvas.addEventListener('pointercancel', (e) => up(e.pointerId, true));

  const keySide = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const side = keySide[e.code];
    if (side) {
      e.preventDefault();
      down('k' + side, side, side < 0 ? 0 : window.innerWidth, 0, false);
      return;
    }
    switch (e.code) {
      case 'Space': case 'KeyW': case 'ArrowUp':
        e.preventDefault(); h.jump(); break;
      case 'KeyP': case 'Escape':
        h.pause(); break;
      case 'KeyR': case 'Enter':
        h.fresh(); break;
      default: break;
    }
  });
  window.addEventListener('keyup', (e) => {
    const side = keySide[e.code];
    if (side) up('k' + side, false);
  });

  // iOS-Safari: kein Scrollen, kein Zoom, kein Kontextmenü.
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  window.addEventListener('blur', cancelAll);

  return { cancelAll };
}
