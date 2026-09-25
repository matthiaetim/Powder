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

  // Namensfeld der Bestenliste (hud.js): Tippen darf nicht lenken, Enter nicht Fresh auslösen, Escape nicht pausieren.
  const inField = (t) => !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'));
  const keySide = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 };
  window.addEventListener('keydown', (e) => {
    if (e.repeat || inField(e.target)) return;
    const side = keySide[e.code];
    if (side) {
      e.preventDefault();
      down('k' + side, side);
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') h.pause();
    else if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') {
      // preventDefault: kein Scrollen durch die Leertaste, und ein noch fokussierter Button (z. B. Fresh nach
      // Mausklick) löst nicht zusätzlich seinen eigenen click aus, sonst käme Fresh doppelt.
      e.preventDefault();
      h.fresh();
    }
  });
  window.addEventListener('keyup', (e) => {
    const side = keySide[e.code];
    if (side) up('k' + side);
  });

  // iOS-Safari: kein Scrollen, kein Zoom, kein Kontextmenü.
  document.addEventListener('touchmove', (e) => {
    if (e.target.closest && e.target.closest('#tune, .board-own')) return; // Tuning-Panel darf scrollen, Namensfeld bleibt nativ
    e.preventDefault();
  }, { passive: false });
  // Keine Lupe: Doppeltipp + Halten stoppt iOS nur über abgebrochenes touchstart, CSS und pointerdown reichen nicht.
  // Ein einziger nativer Tipp (z. B. auf Fresh) reicht, damit der nächste Halte-Tipp die Lupe öffnet, daher überall
  // außer im Tuning-Panel (Regler, Scrollen) und im Namensfeld der Bestenliste (Fokus und Tastatur brauchen den nativen
  // Tipp). Pointer-Events kommen trotzdem, click nicht mehr: Buttons siehe onTap in hud.js.
  const noNative = (e) => { if (!e.target.closest?.('#tune, .board-own')) e.preventDefault(); };
  document.addEventListener('touchstart', noNative, { passive: false });
  document.addEventListener('touchend', noNative, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => { if (!e.target.closest?.('.board-own')) e.preventDefault(); });
  window.addEventListener('blur', cancelAll);

  return { cancelAll };
}
