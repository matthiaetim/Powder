// Eingabe: Finger runter = Halten (links/rechts), Finger hoch = Loslassen. Tastatur fürs Entwickeln.
export function createInput(canvas, h) {
  let active = null; // aktuell gedrückter Finger oder Taste

  function down(id, side) {
    if (active) return; // nur der erste Finger zählt
    active = { id, side };
    h.press(side);
  }

  function up(id) {
    if (!active || active.id !== id) return;
    active = null;
    h.release();
  }

  function cancelAll() {
    if (active) h.release();
    active = null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
    down(e.pointerId, e.clientX < window.innerWidth / 2 ? -1 : 1);
  });
  canvas.addEventListener('pointerup', (e) => up(e.pointerId));
  canvas.addEventListener('pointercancel', (e) => up(e.pointerId));

  const keySide = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const side = keySide[e.code];
    if (side) {
      e.preventDefault();
      down('k' + side, side);
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') h.pause();
    else if (e.code === 'KeyR' || e.code === 'Enter') h.fresh();
  });
  window.addEventListener('keyup', (e) => {
    const side = keySide[e.code];
    if (side) up('k' + side);
  });

  // iOS-Safari: kein Scrollen, kein Zoom, kein Kontextmenü.
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest && e.target.closest('#tune')) return; // Tuning-Panel darf scrollen
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  window.addEventListener('blur', cancelAll);

  return { cancelAll };
}
