// Bestenliste: Bestweiten aller Spieler in einer Firebase Realtime Database, per REST ohne SDK (fetch).
// Die reine Logik (Schlüssel, Sortierung, Rang, Zulässigkeit) ist exportiert und ohne DOM testbar; createBoard hält
// Cache, Namen und Upload-Stand, spricht mit dem Server und reicht die Linien an game.js weiter (setMarks).
import { C, VERSION } from './constants.js';
import { MODE_ORDER } from './modes.js';
import { isTuned } from './tune.js';
import { loadBest, loadName, saveName, loadBoardCache, saveBoardCache, loadBoardOwn, saveBoardOwn } from './storage.js';
import { setMarks, adoptBest } from './game.js';

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

const emptyBoards = () => Object.fromEntries(MODE_ORDER.map((mode) => [mode, {}]));

// Server- oder Cache-JSON (auch null: leere Datenbank) → je Modus nur plausible Einträge. Was die Regeln nicht
// durchlassen würden, fliegt auch hier raus, damit ein alter Cache oder ein fremder Eintrag nichts kaputt macht.
export function sanitizeBoards(raw) {
  const out = emptyBoards();
  if (!raw || typeof raw !== 'object') return out;
  for (const mode of MODE_ORDER) {
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

// Rangfolge: Meter absteigend, bei Gleichstand wer früher da war (ts), dann der Schlüssel, damit die Liste stabil bleibt.
export function sortEntries(byKey) {
  return Object.entries(byKey || {})
    .map(([key, e]) => ({ key, ...e }))
    .sort((a, b) => b.m - a.m || a.ts - b.ts || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

// Zwei Stände vereinen: je Modus und Schlüssel der Eintrag mit mehr Metern, bei Gleichstand der aus b.
export function mergeBoards(a, b) {
  const out = emptyBoards();
  for (const mode of MODE_ORDER) {
    const A = (a && a[mode]) || {}, B = (b && b[mode]) || {};
    for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = A[key], y = B[key];
      out[mode][key] = !x ? y : !y ? x : y.m >= x.m ? y : x;
    }
  }
  return out;
}

// Ansicht für die Fresh-Seite: die ersten rows Einträge und der eigene mit Rang, falls er auf dem Server steht.
export function viewFor(boards, mode, ownKey, rows = C.BOARD_ROWS) {
  const list = sortEntries(boards && boards[mode]);
  const top = list.slice(0, rows).map((e, i) => ({ rank: i + 1, key: e.key, name: e.name, m: e.m, own: !!ownKey && e.key === ownKey }));
  const idx = ownKey ? list.findIndex((e) => e.key === ownKey) : -1;
  const own = idx >= 0 ? { rank: idx + 1, key: ownKey, name: list[idx].name, m: list[idx].m } : null;
  return { top, own, ownInTop: idx >= 0 && idx < rows, total: list.length };
}

// Fremde Bestweiten für die Linien im Schnee, Meter absteigend (render.js zeichnet sie von unten nach oben).
export function friendMarks(boards, mode, ownKey) {
  return sortEntries(boards && boards[mode]).filter((e) => e.key !== ownKey).map((e) => ({ name: e.name, m: e.m }));
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
  for (const mode of MODE_ORDER) {
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
    if (g) setMarks(g, Object.fromEntries(MODE_ORDER.map((mode) => [mode, friendMarks(boards, mode, key())])));
  }

  // Server kennt für den eigenen Namen mehr als dieses Gerät (Zweitgerät, gelöschte Safari-Daten): übernehmen
  function adoptFromServer() {
    const k = key();
    if (!k || !g) return;
    for (const mode of MODE_ORDER) {
      const e = boards[mode][k];
      if (e && e.m > loadBest(mode)) adoptBest(g, mode, e.m);
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
    if (boards[mode][k] && boards[mode][k].m >= o.m) { o.sentAs = k; saveBoardOwn(own); return; } // steht schon drüber
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
    await Promise.all(MODE_ORDER.map((mode) => flushMode(mode)));
  }

  // Lauf zu Ende (hud.js beim Übergang nach dead): zulässigen Bestwert vormerken, Liste laden, Ausstehendes senden.
  function onRunEnd(game) {
    verdict = runVerdict(game);
    const mode = game.runMode;
    const m = Math.floor(game.dist);
    if (!verdict && m >= 1 && MODE_ORDER.includes(mode) && m > ((own[mode] && own[mode].m) || 0)) {
      own[mode] = { m, t: Math.round(game.runT * 100) / 100, sentAs: null };
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
