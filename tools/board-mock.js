// Mock der Firebase-REST-Schnittstelle für die Bestenliste, nur zum lokalen Testen: node tools/serve.js 8082 --board,
// im Browser ?board=local. Hält die Einträge im Speicher (Neustart = Ausgangsstand) und prüft wie
// tools/firebase-rules.json: Schreiben nur angemeldet (auth-mock.js) und nur in eigene Einträge (uid) oder in einen
// Altbestand ohne uid mit gleichem Namen; nur classic/chase/superg/slalom, Schlüssel a-z0-9- mit 2 bis 24 Zeichen, genau die
// sechs Felder, m ganz 1..99999 und nie schlechter als der Bestand (Meter nie kleiner, Zeit im Super-G und Slalom in Hundertstel nie
// größer), plausibles Tempo, kein Löschen. Antwortet wie Firebase: 200 mit Echo, 401 Permission denied.
const MODES = ['classic', 'chase', 'superg', 'slalom'];
const TIME_MODES = ['superg', 'slalom'];
const MIN_T = { superg: 19.46, slalom: 22.5 }; // schnellste denkbare Fahrzeit (Regeln)
const FIELDS = ['name', 'm', 't', 'ts', 'v', 'uid'];
const { uidOf } = require('./auth-mock.js');

function seed(rows) {
  const out = {};
  let ts = Date.now() - (rows.length + 1) * 86400000;
  for (const [name, m, t] of rows) out[name.toLowerCase()] = { name, m, t, ts: (ts += 86400000), v: '0.13.0' };
  return out;
}
const boards = {
  classic: seed([['Luki', 4321, 263.27], ['Mia', 2890, 191.02], ['Jonas', 1750, 120.1], ['Ela', 980, 25.4], ['Tom', 640, 17.9], ['Ida', 150, 6.2]]),
  chase: seed([['Luki', 2210, 85.3], ['Mia', 1430, 38.8], ['Tom', 510, 15.1]]),
  slalom: seed([['Luki', 3342, 33.42], ['Mia', 3688, 34.88], ['Jonas', 3915, 37.15], ['Tom', 4630, 40.3]]),
  superg: seed([['Luki', 2712, 27.12], ['Mia', 2980, 26.8], ['Jonas', 3350, 30.5], ['Ela', 4120, 35.2], ['Tom', 5205, 43.05], ['Ida', 6890, 62.9]]),
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function send(res, status, body) {
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body === undefined ? null : body));
}
const denied = (res) => send(res, 401, { error: 'Permission denied' });

// Prüft einen Eintrag wie die Regeln; liefert den zu speichernden Eintrag (Server-Zeit aufgelöst) oder null.
function accept(mode, key, data, existing, uid) {
  if (!uid || !MODES.includes(mode)) return null;
  if (existing && existing.uid !== uid && (existing.uid || !data || data.name !== existing.name)) return null;
  if (!data || data.uid !== uid) return null;
  if (!/^[a-z0-9-]+$/.test(key) || key.length < 2 || key.length > 24) return null;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const keys = Object.keys(data);
  if (keys.length !== FIELDS.length || FIELDS.some((f) => !(f in data))) return null;
  const { name, m, t, v } = data;
  let { ts } = data;
  if (typeof name !== 'string' || name.length < 2 || name.length > 12) return null;
  if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > 99999) return null;
  if (existing && (TIME_MODES.includes(mode) ? m > existing.m : m < existing.m)) return null;
  if (typeof t !== 'number' || t <= 0 || t > 86400) return null;
  if (TIME_MODES.includes(mode) ? t < MIN_T[mode] || m < t * 100 - 1 : m > t * 41.66) return null;
  if (!(ts && typeof ts === 'object' && ts['.sv'] === 'timestamp')) return null; // Regeln: ts == now
  ts = Date.now();
  if (typeof v !== 'string' || v.length > 16) return null;
  return { name, m, t, ts, v, uid };
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw));
  });
}

// true, wenn die Anfrage zur Bestenliste gehörte und beantwortet wurde; sonst liefert serve.js die Datei aus.
function handle(req, res) {
  const path = new URL(req.url, 'http://x').pathname;
  const hit = path.match(/^\/boards(?:\/([^/]+))?(?:\/([^/]+))?\.json$/);
  if (!hit) return false;
  const mode = hit[1], key = hit[2] && decodeURIComponent(hit[2]);
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return true; }
  if (req.method === 'GET') {
    send(res, 200, !mode ? boards : !key ? boards[mode] : (boards[mode] || {})[key]);
    return true;
  }
  if (req.method === 'PUT' && mode && key) {
    readBody(req).then((raw) => {
      let data;
      try { data = JSON.parse(raw); } catch { send(res, 400, { error: 'Invalid data; couldn\'t parse JSON object' }); return; }
      const entry = accept(mode, key, data, boards[mode] && boards[mode][key], uidOf(req));
      if (!entry) { denied(res); return; }
      boards[mode][key] = entry;
      console.log(`[board] ${mode}/${key} ← ${entry.name} ${entry.m}${TIME_MODES.includes(mode) ? ' Hundertstel' : ' m'}`);
      send(res, 200, entry);
    });
    return true;
  }
  denied(res); // DELETE, PATCH, POST: die Regeln lassen nur PUT auf einen Eintrag zu
  return true;
}

module.exports = { handle };
