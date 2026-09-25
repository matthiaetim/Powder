// Bestwert je Modus und gewählter Modus im localStorage. Fällt still auf 0 bzw. '' zurück, wenn Speicher fehlt.
const bestKey = (mode) => (mode === 'classic' || !mode ? 'powder.best' : 'powder.best.' + mode);

export function loadBest(mode) {
  try {
    const v = parseInt(localStorage.getItem(bestKey(mode)), 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function saveBest(mode, v) {
  try {
    localStorage.setItem(bestKey(mode), String(v));
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

// Ton an/aus (Schalter auf der Fresh-Seite). Standard: an.
const SOUND_KEY = 'powder.sound';

export function loadSoundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveSoundOn(on) {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    /* egal */
  }
}
