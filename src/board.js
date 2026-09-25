// Bestenliste: Bestwerte aller Spieler in einer Firebase Realtime Database, per REST ohne SDK (fetch).
// Die reine Logik (Schlüssel, Sortierung, Rang, Zulässigkeit) ist exportiert und ohne DOM testbar; createBoard hält
// Cache, Namen und Upload-Stand, spricht mit dem Server und reicht die Linien an game.js weiter (setMarks).
// Das Feld m ist je Modus etwas anderes (modes.js): Meter in Classic und Chase, mehr ist besser; im Super-G die
// Gesamtzeit in Hundertstel, weniger ist besser. Alle Vergleiche laufen über better(), nie direkt über m.
import { C, VERSION } from './constants.js';
import { BOARD_MODES, lowerIsBetter } from './modes.js';
import { isTuned } from './tune.js';
import { loadName, saveName, loadBoardCache, saveBoardCache, loadBoardOwn, saveBoardOwn } from './storage.js';
import { setMarks, adoptBest } from './game.js';

// Ist der Wert a im Modus echt besser als b?
export const better = (mode, a, b) => (lowerIsBetter(mode) ? a < b : a > b);

// Schlüssel eines Eintrags: der Name klein und auf a-z0-9- reduziert, Umlaute ausgeschrieben. Nur ASCII, damit der
// Regex in den Firebase-Regeln sicher greift und der Pfad ohne Kodierung auskommt. Identität ist der Name: gleicher
// Schlüssel, gleicher Eintrag, auch von einem zweiten Gerät oder nach gelöschten Safari-Daten.
const TRANSLIT = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
export function nameKey(name) {
  const k = String(name ?? '').trim().normalize('NFC').toLowerCase()
    .replace(/[äöüß]/g, (ch) => TRANSLIT[ch])
    .replace(/[^a-z0-9-]/g, '');
  return k.length >= C.BOARD_NAME_MIN ? k : '';
}

// Anzeigename: getrimmt, Mehrfach-Leerzeichen zusammengezogen, BOARD_NAME_MIN..MAX Zeichen und mit brauchbarem Schlüssel.
export function validName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < C.BOARD_NAME_MIN || name.length > C.BOARD_NAME_MAX) return '';
  return nameKey(name) ? name : '';
}

const emptyBoards = () => Object.fromEntries(BOARD_MODES.map((mode) => [mode, {}]));

// Server- oder Cache-JSON (auch null: leere Datenbank) → je Modus nur plausible Einträge. Was die Regeln nicht
// durchlassen würden, fliegt auch hier raus, damit ein alter Cache oder ein fremder Eintrag nichts kaputt macht.
export function sanitizeBoards(raw) {
  const out = emptyBoards();
  if (!raw || typeof raw !== 'object') return out;
  for (const mode of BOARD_MODES) {
    const src = raw[mode];
    if (!src || typeof src !== 'object') continue;
    for (const [key, e] of Object.entries(src)) {
      if (!e || typeof e !== 'object' || typeof e.name !== 'string') continue;
      const name = e.name.trim().slice(0, C.BOARD_NAME_MAX);
      if (!name || !Number.isInteger(e.m) || e.m < 1 || e.m > C.BOARD_MAX_M) continue;
      out[mode][key] = { name, m: e.m, t: typeof e.t === 'number' && e.t >= 0 ? e.t : 0, ts: typeof e.ts === 'number' ? e.ts : 0 };
    }
  }
  return out;
}

// Rangfolge: der bessere Wert zuerst (Meter absteigend, Zeiten aufsteigend), bei Gleichstand wer früher da war (ts),
// dann der Schlüssel, damit die Liste stabil bleibt.
export function sortEntries(byKey, mode) {
  const sign = lowerIsBetter(mode) ? 1 : -1;
  return Object.entries(byKey || {})
    .map(([key, e]) => ({ key, ...e }))
    .sort((a, b) => sign * (a.m - b.m) || a.ts - b.ts || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

// Zwei Stände vereinen: je Modus und Schlüssel der bessere Eintrag, bei Gleichstand der aus b.
export function mergeBoards(a, b) {
  const out = emptyBoards();
  for (const mode of BOARD_MODES) {
    const A = (a && a[mode]) || {}, B = (b && b[mode]) || {};
    for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = A[key], y = B[key];
      out[mode][key] = !x ? y : !y ? x : better(mode, x.m, y.m) ? x : y;
    }
  }
  return out;
}

// Ansicht für die Fresh-Seite: die ersten rows Einträge und der eigene mit Rang, falls er auf dem Server steht.
export function viewFor(boards, mode, ownKey, rows = C.BOARD_ROWS) {
  const list = sortEntries(boards && boards[mode], mode);
  const top = list.slice(0, rows).map((e, i) => ({ rank: i + 1, key: e.key, name: e.name, m: e.m, own: !!ownKey && e.key === ownKey }));
  const idx = ownKey ? list.findIndex((e) => e.key === ownKey) : -1;
  const own = idx >= 0 ? { rank: idx + 1, key: ownKey, name: list[idx].name, m: list[idx].m } : null;
  return { top, own, ownInTop: idx >= 0 && idx < rows, total: list.length };
}

// Fremde Bestweiten für die Linien im Schnee, Meter absteigend (render.js zeichnet sie von unten nach oben).
// Zeiten lassen sich nicht als Linie in den Hang legen: im Super-G bleibt der Schnee ohne Namenslinien.
export function friendMarks(boards, mode, ownKey) {
  if (lowerIsBetter(mode)) return [];
  return sortEntries(boards && boards[mode], mode).filter((e) => e.key !== ownKey).map((e) => ({ name: e.name, m: e.m }));
}

// Was ein beendeter Lauf für die Liste wert ist: Meter beim Sturz, im Super-G die Gesamtzeit in Hundertstel, aber nur
// nach dem Zieleinlauf (ein Sturz vor dem Ziel hat keine Zeit). 0 = nichts zu melden. Dazu t für den Eintrag:
// die Laufzeit in Sekunden, im Super-G die reine Fahrzeit ohne Strafen (Strafe = m/100 − t).
export function runScore(g) {
  if (lowerIsBetter(g.runMode)) {
    const cs = g.course;
    if (g.state !== 'finished' || !cs || !cs.finished) return { m: 0, t: 0 };
    return { m: Math.round(cs.total * 100), t: Math.round(cs.time * 100) / 100 };
  }
  return { m: Math.floor(g.dist), t: Math.round(g.runT * 100) / 100 };
}

// Zählt der Lauf für die Bestenliste? Debug und fester Seed sind Entwicklerwerkzeuge, Tuning verändert Physik und
// Baumdichte. runTainted: Regler mitten im Lauf verstellt, auch wenn sie vor dem Sturz wieder auf Standard stehen.
export function runVerdict(g) {
  if (g.debug) return 'debug';
  if (g.fixedSeed != null) return 'seed';
  if (g.runTainted || isTuned()) return 'tuned';
  return '';
}

const VERDICT_TEXT = {
  debug: 'Im Debug-Modus, zählt nicht für die Bestenliste',
  seed: 'Mit festem Seed, zählt nicht für die Bestenliste',
  tuned: 'Mit Tuning, zählt nicht für die Bestenliste',
};
export function verdictText(verdict) {
  return VERDICT_TEXT[verdict] || '';
}

// Eigener Upload-Stand je Modus: bester zulässiger Lauf und unter welchem Schlüssel er auf dem Server liegt
// (sentAs null = steht noch aus: kein Name, Netzfehler oder inzwischen umbenannt).
function normalizeOwn(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const mode of BOARD_MODES) {
    const o = raw[mode];
    if (o && Number.isInteger(o.m) && o.m >= 1) {
      out[mode] = { m: o.m, t: typeof o.t === 'number' ? o.t : 0, sentAs: typeof o.sentAs === 'string' ? o.sentAs : null };
    }
  }
  return out;
}

export function createBoard({ url = '', g = null, fetchFn = null, debug = false } = {}) {
  const base = String(url || '').replace(/\/+$/, '');
  const doFetch = fetchFn || (typeof fetch === 'function' ? (...args) => fetch(...args) : null);
  const enabled = base.length > 0 && !!doFetch;
  const listeners = [];
  const sentNow = emptyBoards(); // in dieser Sitzung erfolgreich gesendet: ein älterer GET darf das nicht zurückdrehen
  const busy = {};
  let boards = sanitizeBoards((loadBoardCache() || {}).boards);
  let own = normalizeOwn(loadBoardOwn());
  let name = validName(loadName());
  let verdict = '';
  let fetched = false; // in dieser Sitzung schon einmal erfolgreich geladen
  let failed = false;  // letzter Abruf fehlgeschlagen (offline): die Liste ist der letzte bekannte Stand

  const warn = (...args) => { if (debug) console.warn('[board]', ...args); };
  const emit = () => { for (const fn of listeners) fn(); };
  const key = () => nameKey(name);

  function pushMarks() {
    if (g) setMarks(g, Object.fromEntries(BOARD_MODES.map((mode) => [mode, friendMarks(boards, mode, key())])));
  }

  // Server kennt für den eigenen Namen mehr als dieses Gerät (Zweitgerät, gelöschte Safari-Daten): übernehmen,
  // adoptBest vergleicht selbst mit dem lokalen Bestwert des Modus
  function adoptFromServer() {
    const k = key();
    if (!k || !g) return;
    for (const mode of BOARD_MODES) {
      const e = boards[mode][k];
      if (e) adoptBest(g, mode, e.m);
    }
  }

  function saveCache() {
    saveBoardCache({ at: Date.now(), boards });
  }

  async function request(path, init) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), C.BOARD_TIMEOUT_MS);
    try {
      return await doFetch(base + path, { cache: 'no-store', ...init, signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function load() {
    if (!enabled) return false;
    try {
      const res = await request('/boards.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      boards = mergeBoards(sanitizeBoards(await res.json()), sentNow);
      fetched = true;
      failed = false;
      saveCache();
      adoptFromServer();
      pushMarks();
      emit();
      return true;
    } catch (err) {
      failed = true;
      warn('laden', err);
      return false;
    }
  }

  async function flushMode(mode) {
    const k = key();
    const o = own[mode];
    if (!k || !o || o.sentAs === k || busy[mode]) return;
    if (boards[mode][k] && !better(mode, o.m, boards[mode][k].m)) { o.sentAs = k; saveBoardOwn(own); return; } // Server hat schon so gut oder besser
    busy[mode] = true;
    try {
      const body = { name, m: o.m, t: o.t, ts: { '.sv': 'timestamp' }, v: VERSION };
      const res = await request(`/boards/${mode}/${encodeURIComponent(k)}.json`, { method: 'PUT', body: JSON.stringify(body) });
      if (res.ok) {
        const echo = await res.json().catch(() => null);
        const e = sanitizeBoards({ [mode]: { [k]: echo } })[mode][k] || { name, m: o.m, t: o.t, ts: Date.now() };
        sentNow[mode][k] = e;
        boards = mergeBoards(boards, { [mode]: { [k]: e } });
        o.sentAs = k;
        saveBoardOwn(own);
        saveCache();
        pushMarks();
        emit();
      } else if (res.status >= 400 && res.status < 500) {
        // Regeln lehnen ab: der Server hat schon mehr oder die Form stimmt nicht. Wiederholen bringt nichts.
        o.sentAs = k;
        saveBoardOwn(own);
        warn('senden abgelehnt', res.status, await res.text().catch(() => ''));
      } else warn('senden', res.status);
    } catch (err) {
      warn('senden', err); // Netz oder Timeout: bleibt vorgemerkt
    } finally {
      busy[mode] = false;
    }
  }

  // Ausstehende Bestweiten senden, sobald ein Name da ist. Läuft beim Start, beim Sturz und nach dem Speichern des Namens.
  async function flush() {
    if (!enabled) return;
    await Promise.all(BOARD_MODES.map((mode) => flushMode(mode)));
  }

  // Lauf zu Ende (hud.js beim Übergang nach dead oder finished): zulässigen Bestwert vormerken, Liste laden,
  // Ausstehendes senden.
  function onRunEnd(game) {
    verdict = runVerdict(game);
    const mode = game.runMode;
    const { m, t } = runScore(game);
    const cur = own[mode] ? own[mode].m : 0;
    if (!verdict && m >= 1 && m <= C.BOARD_MAX_M && BOARD_MODES.includes(mode) && (!cur || better(mode, m, cur))) {
      own[mode] = { m, t, sentAs: null };
      saveBoardOwn(own);
    }
    return Promise.all([load(), flush()]);
  }

  function setName(raw) {
    const n = validName(raw);
    if (!n) return false;
    if (n !== name) {
      name = n;
      saveName(n);
      pushMarks();
      adoptFromServer();
      flush();
      emit();
    }
    return true;
  }

  if (enabled) {
    pushMarks(); // Linien im ersten Lauf aus dem Cache, auch offline
    load();
    flush();
  }

  return {
    enabled,
    name: () => name,
    setName,
    view: (mode) => viewFor(boards, mode, key()),
    lastVerdict: () => verdict,
    stale: () => failed && !fetched,
    onChange: (fn) => { listeners.push(fn); },
    load,
    flush,
    onRunEnd,
  };
}
