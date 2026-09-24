// Eingabe: Finger runter = Halten (links/rechts), Finger hoch = Loslassen, beide Seiten = Schneepflug.
// Alle Finger werden verfolgt: fällt einer weg, übernimmt der verbleibende sofort. Tastatur fürs Entwickeln.
export function createInput(canvas, h) {
  const held = new Map(); // id → Seite (-1/1) aller gedrückten Finger und Tasten
  let mode = 0;           // 0 = nichts, -1/1 = Seite, 2 = Schneepflug

  function apply() {
    let hasL = false, hasR = false;
    for (const side of held.values()) { if (side < 0) hasL = true; else hasR = true; }
    const next = hasL && hasR ? 2 : hasL ? -1 : hasR ? 1 : 0;
    if (next === mode) return;
    const prev = mode;
    mode = next;
    if (prev === 2) h.plow(false);
    if (next === 2) h.plow(true);
    else if (next === 0) h.release();
    else h.press(next);
  }

  function down(id, side) {
    held.set(id, side);
    apply();
  }

  function up(id) {
    if (!held.delete(id)) return;
    apply();
  }

  function cancelAll() {
    held.clear();
    apply();
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
