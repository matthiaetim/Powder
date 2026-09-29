// Bestwert je Modus (Meter), Bestzeit (Super-G), Name, Fahrer, Ton, Duell-Zähler, Bot-Stufe und die zuletzt gespielten Modi im
// localStorage. Fällt still auf 0 bzw. '' zurück, wenn Speicher fehlt. Der gewählte Modus selbst wird bewusst nicht
// gespeichert (game.js).
import { C } from './constants.js';

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

// Super-G: Bestzeit je Modus in ganzen Hundertstelsekunden (0 = keine) und die Zwischenzeiten des schnellsten
// eigenen Laufs mit seiner Gesamtzeit, damit das HUD unterwegs den Vergleich zeigen kann. Die Zwischenzeiten stehen
// seit v0.24.11 unter eigenem Schlüssel: davor wurden sie an Metermarken genommen, nicht an Toren, und passen nicht
// mehr. Sie hängen nicht an der Bestzeit: eine vom Server übernommene Bestzeit hat keine Zwischenzeiten, verglichen
// wird dann weiter gegen den schnellsten Lauf auf diesem Gerät.
const timeKey = (mode) => 'powder.besttime.' + mode;
const splitsKey = (mode) => 'powder.splitref.' + mode;

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

// { t: Gesamtzeit des Laufs in Hundertstel (0 = keiner), s: seine Zwischenzeiten }
export function loadSplitRef(mode) {
  try {
    const ref = JSON.parse(localStorage.getItem(splitsKey(mode)) || '{}');
    const t = Number.isFinite(ref.t) && ref.t > 0 ? ref.t : 0;
    const s = t && Array.isArray(ref.s) ? ref.s.map((v) => (Number.isFinite(v) && v > 0 ? v : 0)) : [];
    return { t, s };
  } catch {
    return { t: 0, s: [] };
  }
}

export function saveSplitRef(mode, t, s) {
  try {
    localStorage.setItem(splitsKey(mode), JSON.stringify({ t, s }));
  } catch {
    /* egal */
  }
}

// Ton an/aus (Icon oben rechts auf der Fresh-Seite). Standard: an.
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

export function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

export function saveJson(key, value) {
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

// Fahrer (riders.js), gewählt auf der Fresh-Seite. Bleibt gespeichert wie der Ton; ohne Eintrag der Skifahrer.
const RIDER_KEY = 'powder.rider';

export function loadRider() {
  try {
    return localStorage.getItem(RIDER_KEY) || '';
  } catch {
    return '';
  }
}

export function saveRider(id) {
  try {
    localStorage.setItem(RIDER_KEY, id);
  } catch {
    /* egal */
  }
}

// Yeti-Spuren (yeti.js): so viele Classic-Läufe noch bis zur nächsten Spur. 0 = noch nie gewürfelt.
const YETI_KEY = 'powder.yeti';

export function loadYetiIn() {
  try {
    const v = parseInt(localStorage.getItem(YETI_KEY), 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

export function saveYetiIn(n) {
  try {
    localStorage.setItem(YETI_KEY, String(n));
  } catch {
    /* egal */
  }
}

// Duell gegen den Bot (duel.js, bot.js): nur die zuletzt gewählte Stufe, Siege gegen den Bot werden nicht gezählt
const BOT_LEVEL_KEY = 'powder.bot.level';
export function loadBotLevel() {
  try {
    const v = parseInt(localStorage.getItem(BOT_LEVEL_KEY), 10);
    return v >= 1 && v <= C.BOT_LEVELS.length ? v : C.BOT_LEVEL_DEFAULT;
  } catch {
    return C.BOT_LEVEL_DEFAULT;
  }
}
export function saveBotLevel(v) {
  try {
    localStorage.setItem(BOT_LEVEL_KEY, String(v));
  } catch {
    /* egal */
  }
}

// Duell (duel.js): Siege, Niederlagen und Unentschieden je Gegner, Schlüssel wie in der Bestenliste (nameKey des
// Gegnernamens), damit „Jo“ und „jo“ derselbe Gegner sind.
const DUEL_KEY = 'powder.duel';

export const loadDuelTally = () => loadJson(DUEL_KEY) || {};

export function bumpDuelTally(key, name, result) {
  if (!key || !['w', 'l', 'd'].includes(result)) return;
  const all = loadDuelTally();
  const e = all[key] && typeof all[key] === 'object' ? all[key] : { w: 0, l: 0, d: 0 };
  e.name = name;
  e[result] = (e[result] || 0) + 1;
  all[key] = e;
  saveJson(DUEL_KEY, all);
}

// Zuletzt gewählte oder gefahrene Modi, der jüngste vorn (hud.js zeigt die zwei jüngsten neben Classic). Der gewählte
// Modus selbst bleibt ungespeichert, die App startet in Classic; nur die Reihenfolge der Vorschauen merkt sich das.
const RECENT_KEY = 'powder.recent';

export function loadRecentModes() {
  const arr = loadJson(RECENT_KEY);
  return Array.isArray(arr) ? arr.filter((id) => typeof id === 'string') : [];
}

export function noteRecentMode(id) {
  const arr = loadRecentModes();
  if (arr[0] === id) return;
  saveJson(RECENT_KEY, [id, ...arr.filter((m) => m !== id)].slice(0, 6));
}

// Einstellungen (hud.js): Sprache (i18n.js, '' = noch nicht gewählt) und die Einwilligung in die anonyme
// Spielstatistik. Die Einwilligung ist aus, bis der Spieler sie selbst einschaltet (Opt-in, § 25 TDDDG).
const LANG_KEY = 'powder.lang';
const STATS_OK_KEY = 'powder.stats.ok';

export function loadLang() {
  try {
    return localStorage.getItem(LANG_KEY) || '';
  } catch {
    return '';
  }
}

export function saveLang(id) {
  try {
    localStorage.setItem(LANG_KEY, id);
  } catch {
    /* egal */
  }
}

export function loadStatsOk() {
  try {
    return localStorage.getItem(STATS_OK_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveStatsOk(on) {
  try {
    localStorage.setItem(STATS_OK_KEY, on ? '1' : '0');
  } catch {
    /* egal */
  }
}

// Namenslinien der anderen im Schnee (Einstellungen, game.js): an, bis der Spieler sie ausschaltet
const MARKS_KEY = 'powder.marks';

export function loadMarksOn() {
  try {
    return localStorage.getItem(MARKS_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveMarksOn(on) {
  try {
    localStorage.setItem(MARKS_KEY, on ? '1' : '0');
  } catch {
    /* egal */
  }
}
