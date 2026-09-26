// Raum eines Duells in der Firebase Realtime Database (REST + Stream über net.js), reine Logik ohne DOM: anlegen,
// beitreten, Felder schreiben, den Raum live spiegeln, Serverzeit schätzen. Was im Raum steht, legt duel.js fest;
// die Regeln stehen in tools/firebase-rules.json und prüfen dieselbe Form. Ohne Anmeldung ist der Code das Geheimnis:
// wer ihn kennt, darf alles im Raum schreiben, wie bei der Bestenliste.
import { C, VERSION } from './constants.js';

export const SV = { '.sv': 'timestamp' }; // Server-Zeitstempel, löst Firebase beim Schreiben auf
const codeRe = () => new RegExp('^[' + C.DUEL_CODE_CHARS + ']{' + C.DUEL_CODE_LEN + '}$');

export function randomCode() {
  const chars = C.DUEL_CODE_CHARS;
  const buf = new Uint32Array(C.DUEL_CODE_LEN);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
  else for (let i = 0; i < buf.length; i++) buf[i] = (Math.random() * 4294967296) >>> 0;
  let s = '';
  for (let i = 0; i < buf.length; i++) s += chars[buf[i] % chars.length];
  return s;
}

// Eingabe des Spielers: Großbuchstaben, alles andere fliegt raus; '' wenn kein gültiger Code
export function validCode(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  return codeRe().test(s) ? s : '';
}

// Ein Stream-Ereignis in den Spiegel einarbeiten: put ersetzt am Pfad (null löscht), patch schreibt jedes Kind
// einzeln (Schlüssel mit / sind Pfade). Pfad "/" mit null heißt: der Raum ist weg.
export function applyEvent(root, kind, path, data) {
  const segs = String(path || '/').split('/').filter(Boolean);
  if (kind === 'put' && segs.length === 0) return data === undefined ? null : data;
  const out = root && typeof root === 'object' ? root : {};
  if (kind === 'put') setPath(out, segs, data);
  else for (const [k, v] of Object.entries(data || {})) setPath(out, [...segs, ...k.split('/').filter(Boolean)], v);
  return out;
}
function setPath(obj, segs, value) {
  let node = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    if (!node[k] || typeof node[k] !== 'object') {
      if (value === null || value === undefined) return;
      node[k] = {};
    }
    node = node[k];
  }
  const last = segs[segs.length - 1];
  if (value === null || value === undefined) delete node[last]; else node[last] = value;
}

// Der Raum ist gültig, wenn er wie von duel.js angelegt aussieht; alles andere behandelt der Client wie „kein Raum“
export function validRoom(r) {
  return !!(r && typeof r === 'object' && typeof r.state === 'string' && typeof r.v === 'string'
    && typeof r.seed === 'number' && typeof r.target === 'number' && r.players && typeof r.players === 'object');
}

export function createRoom(net, { onChange = null, onStatus = null, debug = false } = {}) {
  let code = '', role = '', mirror = null, es = null;
  let offset = 0, offsetRtt = Infinity; // Serverzeit minus eigene Uhr, aus der Probe mit der kürzesten Laufzeit
  let lastEvent = 0, lastWriteOk = true;
  const warn = (...args) => { if (debug) console.warn('[room]', ...args); };
  const path = (sub) => `/rooms/${code}${sub ? '/' + sub : ''}.json`;
  const emit = () => { if (onChange) onChange(mirror); };
  const status = (s) => { if (onStatus) onStatus(s); };

  // Echo eines .sv-Zeitstempels gegen die eigene Uhr, halbe Laufzeit abgezogen
  function probe(t0, t1, serverTs) {
    if (typeof serverTs !== 'number') return;
    const rtt = t1 - t0;
    if (rtt < offsetRtt) { offsetRtt = rtt; offset = serverTs - (t0 + t1) / 2; }
  }
  const serverNow = () => Date.now() + offset;

  async function write(method, sub, body, silent) {
    const t0 = Date.now();
    const r = await net[method](path(sub), body, { silent });
    lastWriteOk = r.ok;
    if (!r.ok) warn(method, sub || '/', r.status);
    return { ...r, t0, t1: Date.now() };
  }

  function open() {
    close();
    lastEvent = Date.now();
    es = net.stream(path(''), {
      put: (d) => { mirror = applyEvent(mirror, 'put', d && d.path, d && d.data); lastEvent = Date.now(); emit(); },
      patch: (d) => { mirror = applyEvent(mirror, 'patch', d && d.path, d && d.data); lastEvent = Date.now(); emit(); },
      keepAlive: () => { lastEvent = Date.now(); },
      cancel: () => status('cancel'),
      error: () => status('error'),
      open: () => status('open'),
    });
  }
  function close() {
    if (es) es.close();
    es = null;
  }

  // Raum anlegen: freier oder verlassener Code (ts älter als die Lebensdauer), dann der ganze Raum per PUT. Das Echo
  // trägt die aufgelöste Serverzeit. 401 beim PUT heißt fast immer: die Regeln für /rooms sind noch nicht veröffentlicht.
  async function create(player, seed) {
    for (let tries = 0; tries < 5; tries++) {
      const c = randomCode();
      const got = await net.get(`/rooms/${c}.json`);
      if (!got.ok) return got.status === 401 ? 'rules' : 'error';
      const old = got.data;
      if (validRoom(old) && typeof old.ts === 'number' && old.ts > serverNow() - C.DUEL_ROOM_TTL_MS) continue;
      code = c; role = 'host';
      const body = {
        v: VERSION, ts: SV, round: 1, seed, target: C.DUEL_TARGET_DEFAULT_M, pause: C.DUEL_CRASH_PAUSE_S,
        state: 'lobby', startAt: 0,
        players: { host: { name: player.name, rider: player.rider, ready: true, v: VERSION, seen: SV } },
      };
      const r = await write('put', '', body, false);
      if (!r.ok) { code = ''; role = ''; return r.status === 401 ? 'rules' : 'error'; }
      probe(r.t0, r.t1, r.data && r.data.ts);
      mirror = validRoom(r.data) ? r.data : body;
      open();
      return 'ok';
    }
    return 'error';
  }

  // Beitreten: Raum muss da, gleich alt (Version) und in der Lobby sein; ein Gast, der sich in der letzten Minute
  // gemeldet hat, blockiert den Platz, außer er trägt denselben Namen (dann ist es derselbe Spieler nach einem Neuladen).
  async function join(c, player) {
    const got = await net.get(`/rooms/${c}.json`);
    if (!got.ok) return got.status === 401 ? 'rules' : 'error';
    const r0 = got.data;
    if (!validRoom(r0)) return 'missing';
    if (typeof r0.ts === 'number' && r0.ts < serverNow() - C.DUEL_ROOM_TTL_MS) return 'missing';
    if (r0.v !== VERSION) return 'version';
    const guest = r0.players.guest;
    const fresh = guest && typeof guest.seen === 'number' && guest.seen > serverNow() - C.DUEL_LOBBY_GONE_S * 1000;
    if (fresh && guest.name !== player.name) return 'full';
    if (r0.state !== 'lobby') return 'busy';
    code = c; role = 'guest';
    const me = { name: player.name, rider: player.rider, ready: false, v: VERSION, seen: SV };
    const r = await write('patch', 'players/guest', me, false);
    if (!r.ok) { code = ''; role = ''; return r.status === 401 ? 'rules' : 'error'; }
    probe(r.t0, r.t1, r.data && r.data.seen);
    mirror = r0;
    setPath(mirror, ['players', 'guest'], { ...me, seen: r.data && typeof r.data.seen === 'number' ? r.data.seen : serverNow() });
    open();
    return 'ok';
  }

  // Lebenszeichen der eigenen Rolle, zugleich eine Zeitprobe
  async function heartbeat() {
    if (!code) return;
    const r = await write('patch', `players/${role}`, { seen: SV }, false);
    if (r.ok) probe(r.t0, r.t1, r.data && r.data.seen);
  }

  function reset() {
    close();
    code = ''; role = ''; mirror = null;
  }

  return {
    create, join, heartbeat, reset, reopen: () => { if (code) open(); },
    patch: (sub, body, silent = false) => write('patch', sub, body, silent),
    set: (sub, value, silent = false) => write('put', sub, value, silent),
    remove: async () => { const r = await write('del', '', undefined, false); return r.ok; },
    leaveGuest: () => write('patch', '', { 'players/guest': null, 'live/guest': null }, true),
    serverNow,
    offset: () => offset,
    healthy: (now = Date.now()) => !!es && now - lastEvent < C.DUEL_STREAM_HEALTH_S * 1000 && lastWriteOk,
    streaming: () => !!es,
    data: () => mirror,
    code: () => code,
    role: () => role,
  };
}
