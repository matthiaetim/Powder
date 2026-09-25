// Bestwert je Modus (Meter), Bestzeit (Super-G) und gewählter Modus im localStorage. Fällt still auf 0 bzw. '' zurück, wenn Speicher fehlt.
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

// Super-G: Bestzeit je Modus in ganzen Hundertstelsekunden (0 = keine) und die Zwischenzeiten des besten Laufs
// (Hundertstel, eine je SG_SPLITS_M), damit das HUD unterwegs den Vergleich zeigen kann.
const timeKey = (mode) => 'powder.besttime.' + mode;
const splitsKey = (mode) => 'powder.bestsplits.' + mode;

export function loadBestTime(mode) {
  try {
    const v = parseInt(localStorage.getItem(timeKey(mode)), 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function saveBestTime(mode, cs) {
  try {
    localStorage.setItem(timeKey(mode), String(cs));
  } catch {
    /* egal */
  }
}

export function loadBestSplits(mode) {
  try {
    const arr = JSON.parse(localStorage.getItem(splitsKey(mode)) || '[]');
    return Array.isArray(arr) ? arr.map((v) => (Number.isFinite(v) && v > 0 ? v : 0)) : [];
  } catch {
    return [];
  }
}

export function saveBestSplits(mode, arr) {
  try {
    localStorage.setItem(splitsKey(mode), JSON.stringify(arr));
  } catch {
    /* egal */
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

// Bestenliste (board.js): Spielername, letzter bekannter Stand der Listen und der eigene Upload-Stand je Modus.
const NAME_KEY = 'powder.name';
const BOARD_KEY = 'powder.board';
const BOARD_OWN_KEY = 'powder.board.own';

export function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* egal */
  }
}

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* egal */
  }
}

export const loadBoardCache = () => loadJson(BOARD_KEY);
export const saveBoardCache = (v) => saveJson(BOARD_KEY, v);
export const loadBoardOwn = () => loadJson(BOARD_OWN_KEY);
export const saveBoardOwn = (v) => saveJson(BOARD_OWN_KEY, v);
