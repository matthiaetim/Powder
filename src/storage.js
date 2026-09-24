// Bestwert im localStorage. Fällt still auf 0 zurück, wenn Speicher nicht verfügbar ist.
const KEY = 'powder.best';

export function loadBest() {
  try {
    const v = parseInt(localStorage.getItem(KEY), 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function saveBest(v) {
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    /* privater Modus o. ä. */
  }
}

const MODE_KEY = 'powder.mode';

export function loadMode() {
  try {
    return localStorage.getItem(MODE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveMode(id) {
  try {
    localStorage.setItem(MODE_KEY, id);
  } catch {
    /* egal */
  }
}
