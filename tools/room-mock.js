// Mock der Firebase-REST-Schnittstelle für Duell-Räume (/rooms), nur zum lokalen Testen: node tools/serve.js 8082 --board
// lädt ihn zusammen mit dem Bestenlisten-Mock, im Browser ?board=local. Hält die Räume im Speicher (Neustart = leer),
// versteht GET/PUT/PATCH/DELETE in jeder Tiefe (null löscht, PATCH-Schlüssel mit / sind Mehrfach-Pfade), löst
// {'.sv':'timestamp'} auf, antwortet auf ?print=silent mit 204 und streamt bei Accept: text/event-stream wie Firebase
// (erst put mit dem ganzen Knoten, dann put je Änderung mit relativem Pfad, keep-alive alle 30 s). Regeln wie in
// tools/firebase-rules.json: Code aus vier Buchstaben, ein ganzer Raum nur frei, verlassen oder beim Löschen, Feldformen;
// Verstöße antworten 401 Permission denied, /rooms.json ist nicht lesbar.
const rooms = {};
const subs = []; // offene Streams: { res, segs }
const CODE_RE = /^[A-HJ-NP-Z]{4}$/;
const TTL_MS = 7200000;
const ROOM_KEYS = ['v', 'ts', 'round', 'seed', 'target', 'pause', 'state', 'startAt', 'players', 'live'];
const ROOM_REQUIRED = ['v', 'ts', 'round', 'seed', 'target', 'pause', 'state', 'startAt', 'players'];
const STATES = ['lobby', 'count', 'race', 'done'];
const RIDERS = ['ski', 'board', 'sled'];
const PLAYER_KEYS = ['name', 'rider', 'ready', 'v', 'seen'];
const LIVE_KEYS = ['t', 'x', 'y', 'th', 'v', 'c', 'done', 'fin', 'p', 'at'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function send(res, status, body) {
  if (status === 204) { res.writeHead(204, CORS); res.end(); return; }
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body === undefined ? null : body));
}
const denied = (res) => send(res, 401, { error: 'Permission denied' });
function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw));
  });
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => isNum(v) && v % 1 === 0;
const getAt = (obj, segs) => segs.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);

// {'.sv':'timestamp'} in jeder Tiefe durch die Serverzeit ersetzen
function resolveSv(v) {
  if (!v || typeof v !== 'object') return v;
  if (v['.sv'] === 'timestamp') return Date.now();
  const out = Array.isArray(v) ? [] : {};
  for (const [k, x] of Object.entries(v)) out[k] = resolveSv(x);
  return out;
}
// Firebase kennt keine leeren Knoten: leere Objekte verschwinden
function prune(v) {
  if (!v || typeof v !== 'object') return v === null ? undefined : v;
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    const p = prune(x);
    if (p !== undefined) out[k] = p;
  }
  return Object.keys(out).length ? out : undefined;
}
// Kopierendes Schreiben an segs (relativ zu rooms); null löscht
function withWrite(root, segs, value) {
  const out = { ...root };
  let node = out;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    node[k] = node[k] && typeof node[k] === 'object' ? { ...node[k] } : {};
    node = node[k];
  }
  const last = segs[segs.length - 1];
  if (value === null || value === undefined) delete node[last]; else node[last] = value;
  return out;
}

// Ein ganzer Raum wie die Regeln: Form, nicht Ehrlichkeit
function validRoom(r) {
  if (!r || typeof r !== 'object') return false;
  for (const k of ROOM_REQUIRED) if (!(k in r)) return false;
  for (const k of Object.keys(r)) if (!ROOM_KEYS.includes(k)) return false;
  if (typeof r.v !== 'string' || r.v.length > 16) return false;
  if (!isNum(r.ts) || r.ts > Date.now()) return false;
  if (!isInt(r.round) || r.round < 1 || r.round > 999) return false;
  if (!isInt(r.seed) || r.seed < 0 || r.seed > 4294967295) return false;
  if (!isNum(r.target) || r.target % 500 !== 0 || r.target < 1000 || r.target > 10000) return false;
  if (!isNum(r.pause) || r.pause < 0 || r.pause > 10) return false;
  if (!STATES.includes(r.state)) return false;
  if (!isNum(r.startAt) || r.startAt < 0) return false;
  if (!r.players || typeof r.players !== 'object') return false;
  for (const [role, p] of Object.entries(r.players)) {
    if (role !== 'host' && role !== 'guest') return false;
    if (!p || typeof p !== 'object') return false;
    for (const k of Object.keys(p)) if (!PLAYER_KEYS.includes(k)) return false;
    if (typeof p.name !== 'string' || p.name.length < 2 || p.name.length > 12) return false;
    if (!RIDERS.includes(p.rider)) return false;
    if (typeof p.ready !== 'boolean') return false;
    if (typeof p.v !== 'string' || p.v.length > 16) return false;
    if (p.seen !== undefined && (!isNum(p.seen) || p.seen > Date.now())) return false;
  }
  if (r.live !== undefined) {
    if (!r.live || typeof r.live !== 'object') return false;
    for (const [role, l] of Object.entries(r.live)) {
      if (role !== 'host' && role !== 'guest') return false;
      if (!l || typeof l !== 'object') return false;
      for (const [k, v] of Object.entries(l)) {
        if (!LIVE_KEYS.includes(k) || !isNum(v)) return false;
        if (k === 'at' && v > Date.now()) return false;
      }
    }
  }
  return true;
}

function push(sub, event, path, data) {
  try { sub.res.write(`event: ${event}\ndata: ${JSON.stringify({ path, data: data === undefined ? null : data })}\n\n`); } catch { /* weg */ }
}
// Nach einem Write alle Abonnenten versorgen: liegt der Write im abonnierten Knoten, put mit relativem Pfad; liegt er
// darüber, put des ganzen abonnierten Knotens
function broadcast(segs) {
  for (const sub of subs) {
    const S = sub.segs;
    if (segs.length >= S.length && S.every((k, i) => segs[i] === k)) {
      push(sub, 'put', '/' + segs.slice(S.length).join('/'), getAt(rooms, segs));
    } else if (S.length > segs.length && segs.every((k, i) => S[i] === k)) {
      push(sub, 'put', '/', getAt(rooms, S));
    }
  }
}

function subscribe(req, res, segs) {
  res.writeHead(200, { ...CORS, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
  const sub = { res, segs };
  subs.push(sub);
  push(sub, 'put', '/', getAt(rooms, segs));
  const timer = setInterval(() => { try { res.write('event: keep-alive\ndata: null\n\n'); } catch { /* weg */ } }, 30000);
  req.on('close', () => {
    clearInterval(timer);
    const i = subs.indexOf(sub);
    if (i >= 0) subs.splice(i, 1);
  });
}

// Ein Write (schon aufgelöst) gegen die Regeln prüfen, übernehmen, verteilen, antworten
function commit(res, segs, writes, silent, method) {
  const code = segs[0];
  let next = rooms;
  for (const [wsegs, value] of writes) next = withWrite(next, wsegs, value);
  const oldRoom = rooms[code];
  const newRoom = prune(next[code]);
  const whole = method === 'PUT' && segs.length === 1;
  if (whole && newRoom !== undefined && oldRoom && !(oldRoom.ts < Date.now() - TTL_MS)) { denied(res); return; }
  if (newRoom !== undefined && !validRoom(newRoom)) { denied(res); return; }
  if (newRoom === undefined) delete rooms[code]; else rooms[code] = newRoom;
  for (const [wsegs] of writes) broadcast(wsegs);
  const what = writes.map(([w, v]) => w.join('/') + (v === null || v === undefined ? ' gelöscht' : ' ← ' + JSON.stringify(v).slice(0, 60))).join(', ');
  console.log(`[room] ${method} ${what}`);
  if (silent) { send(res, 204); return; }
  if (method === 'PATCH') { send(res, 200, Object.fromEntries(writes.map(([w, v]) => [w.slice(segs.length).join('/'), v]))); return; }
  send(res, 200, getAt(rooms, segs) ?? null);
}

// true, wenn die Anfrage zu den Räumen gehörte und beantwortet wurde; sonst liefert serve.js die Datei aus.
function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const hit = url.pathname.match(/^\/rooms(?:\/(.*?))?\.json$/);
  if (!hit) return false;
  const segs = (hit[1] || '').split('/').filter(Boolean).map(decodeURIComponent);
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return true; }
  if (!segs[0] || !CODE_RE.test(segs[0])) { denied(res); return true; } // /rooms.json: nicht lesbar, wie die Regeln
  const silent = url.searchParams.get('print') === 'silent';
  if (req.method === 'GET') {
    if ((req.headers.accept || '').includes('text/event-stream')) subscribe(req, res, segs);
    else send(res, 200, getAt(rooms, segs) ?? null);
    return true;
  }
  if (req.method === 'DELETE') { commit(res, segs, [[segs, null]], silent, 'DELETE'); return true; }
  if (req.method === 'PUT' || req.method === 'PATCH') {
    readBody(req).then((raw) => {
      let data;
      try { data = JSON.parse(raw); } catch { send(res, 400, { error: 'Invalid data; couldn\'t parse JSON object' }); return; }
      data = resolveSv(data);
      if (req.method === 'PUT') { commit(res, segs, [[segs, data]], silent, 'PUT'); return; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) { send(res, 400, { error: 'Invalid data; PATCH braucht ein Objekt' }); return; }
      commit(res, segs, Object.entries(data).map(([k, v]) => [[...segs, ...k.split('/').filter(Boolean)], v]), silent, 'PATCH');
    });
    return true;
  }
  denied(res);
  return true;
}

module.exports = { handle };
