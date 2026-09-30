// Prüft tools/firebase-rules.json im Firebase-Emulator: erlaubte Wege der App und Angriffe (fremde Einträge, Fantasiewerte,
// fremde Duell-Plätze). Braucht Java und die Emulatoren für Datenbank und Anmeldung:
//   cd tools && npx firebase-tools emulators:start --only database,auth --project demo-powder
//   node tools/rules-test.mjs
// Lädt die Regeln selbst in den Emulator und leert ihn vorher. Jede Zeile „ok“ heißt: Antwort wie erwartet.
import fs from 'fs';
const DB = 'http://127.0.0.1:9000', NS = 'ns=demo-powder', AUTH = 'http://127.0.0.1:9099';
const rules = fs.readFileSync(new URL('./firebase-rules.json', import.meta.url), 'utf8');
const admin = { Authorization: 'Bearer owner' };
async function req(method, path, body, token, headers = {}) {
  const url = `${DB}${path}.json?${NS}${token ? '&auth=' + token : ''}`;
  const r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return r.status;
}
async function user() {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' });
  const d = await r.json();
  return { uid: d.localId, tok: d.idToken };
}
let fail = 0;
async function expect(label, want, p) {
  const st = await p;
  const ok = want === 'ok' ? st === 200 || st === 204 : st === 401 || st === 403;
  if (!ok) fail++;
  console.log((ok ? 'ok   ' : 'FEHL ') + label + ' → ' + st);
}
const SV = { '.sv': 'timestamp' };
let r = await fetch(`${DB}/.settings/rules.json?${NS}`, { method: 'PUT', headers: admin, body: rules });
console.log('Regeln geladen', r.status, r.status !== 200 ? await r.text() : '');
await fetch(`${DB}/.json?${NS}`, { method: 'PUT', headers: admin, body: 'null' });
const A = await user(), B = await user(), V = await user();
const e = (u, o = {}) => ({ name: 'Tim', m: 500, t: 30, ts: SV, v: '0.27.0', uid: u.uid, ...o });

console.log('— Bestenliste');
await expect('lesen ohne Anmeldung', 'ok', req('GET', '/boards'));
await expect('schreiben ohne Anmeldung', 'deny', req('PUT', '/boards/classic/tim', { ...e(A), uid: undefined }));
await expect('A legt tim an', 'ok', req('PUT', '/boards/classic/tim', e(A), A.tok));
await expect('V überschreibt tim (höher)', 'deny', req('PUT', '/boards/classic/tim', e(V, { m: 900, t: 60, name: 'Tim doof' }), V.tok));
await expect('V setzt fremde uid', 'deny', req('PUT', '/boards/classic/tim', e(A, { m: 900, t: 60 }), V.tok));
await expect('A verbessert', 'ok', req('PUT', '/boards/classic/tim', e(A, { m: 800, t: 40 }), A.tok));
await expect('A verschlechtert', 'deny', req('PUT', '/boards/classic/tim', e(A, { m: 700, t: 40 }), A.tok));
await expect('Peter: 99999 m in 1894,72 s', 'deny', req('PUT', '/boards/classic/peter', e(V, { name: 'Peter', m: 99999, t: 1894.72 }), V.tok));
await expect('knapp plausibel 150 km/h', 'ok', req('PUT', '/boards/classic/vv', e(V, { name: 'VV', m: 4166, t: 100 }), V.tok));
await expect('t = 0', 'deny', req('PUT', '/boards/classic/vw', e(V, { name: 'VW', m: 10, t: 0 }), V.tok));
await expect('ts zurückdatiert', 'deny', req('PUT', '/boards/chase/vx', e(V, { name: 'VX', ts: 1000 }), V.tok));
await expect('Zusatzfeld', 'deny', req('PUT', '/boards/chase/vy', e(V, { name: 'VY', x: 1 }), V.tok));
await expect('Super-G 10 s', 'deny', req('PUT', '/boards/superg/vz', e(V, { name: 'VZ', m: 1000, t: 10 }), V.tok));
await expect('Super-G Gesamt < Fahrzeit', 'deny', req('PUT', '/boards/superg/vz', e(V, { name: 'VZ', m: 2000, t: 25 }), V.tok));
await expect('Super-G echt 25,05 s', 'ok', req('PUT', '/boards/superg/vz', e(V, { name: 'VZ', m: 2505, t: 25.05 }), V.tok));
await expect('Slalom 20 s', 'deny', req('PUT', '/boards/slalom/vz', e(V, { name: 'VZ', m: 2000, t: 20 }), V.tok));
await expect('Slalom echt 33,4 s mit einer Strafe', 'ok', req('PUT', '/boards/slalom/vz', e(V, { name: 'VZ', m: 3540, t: 33.4 }), V.tok));
await expect('Slalom langsamer als der Bestand', 'deny', req('PUT', '/boards/slalom/vz', e(V, { name: 'VZ', m: 3600, t: 34 }), V.tok));
await expect('Piste 6420 m', 'ok', req('PUT', '/boards/piste/vz', e(V, { name: 'VZ', m: 6420, t: 330.2 }), V.tok));
await expect('Piste im Ziel in 7:35,6', 'ok', req('PUT', '/boards/piste/vz', e(V, { name: 'VZ', m: 10000, t: 455.6 }), V.tok));
await expect('Piste im Ziel, langsamer als der Bestand', 'deny', req('PUT', '/boards/piste/vz', e(V, { name: 'VZ', m: 10000, t: 470 }), V.tok));
await expect('Piste im Ziel, schneller', 'ok', req('PUT', '/boards/piste/vz', e(V, { name: 'VZ', m: 10000, t: 402.18 }), V.tok));
await expect('Piste weiter als das Ziel', 'deny', req('PUT', '/boards/piste/vw', e(V, { name: 'VW', m: 10001, t: 500 }), V.tok));
await expect('Piste im Ziel in 2:50 (212 km/h)', 'deny', req('PUT', '/boards/piste/vw', e(V, { name: 'VW', m: 10000, t: 170 }), V.tok));
await expect('Piste 3000 m in 60 s (180 km/h)', 'ok', req('PUT', '/boards/piste/vu', e(V, { name: 'VU', m: 3000, t: 60 }), V.tok));
await expect('unbekannter Modus', 'deny', req('PUT', '/boards/riesenslalom/vz', e(V, { name: 'VZ', m: 3540, t: 33.4 }), V.tok));
await expect('löschen durch Besitzer', 'deny', req('DELETE', '/boards/classic/tim', undefined, A.tok));
// Altbestand ohne uid, wie vor v0.27.0
await fetch(`${DB}/boards/classic/luki.json?${NS}`, { method: 'PUT', headers: admin, body: JSON.stringify({ name: 'Luki', m: 8195, t: 553.22, ts: 1, v: '0.26.0' }) });
await expect('V übernimmt Altbestand mit anderem Namen', 'deny', req('PUT', '/boards/classic/luki', e(V, { name: 'Luki doof', m: 8195, t: 553.22 }), V.tok));
await expect('B holt sich Altbestand (gleicher Lauf)', 'ok', req('PUT', '/boards/classic/luki', e(B, { name: 'Luki', m: 8195, t: 553.22 }), B.tok));
await expect('danach V nicht mehr', 'deny', req('PUT', '/boards/classic/luki', e(V, { name: 'Luki', m: 9000, t: 553.22 }), V.tok));
await fetch(`${DB}/banned/${V.uid}.json?${NS}`, { method: 'PUT', headers: admin, body: 'true' });
await expect('gesperrtes Gerät schreibt', 'deny', req('PUT', '/boards/classic/neu', e(V, { name: 'Neu' }), V.tok));
await expect('banned lesen', 'deny', req('GET', '/banned', undefined, A.tok));
await expect('banned schreiben', 'deny', req('PUT', `/banned/${A.uid}`, null, A.tok));
await fetch(`${DB}/banned.json?${NS}`, { method: 'DELETE', headers: admin });

console.log('— Duell-Räume');
const room = (u) => ({ v: '0.27.0', ts: SV, round: 1, seed: 5, target: 1000, pause: 1, state: 'lobby', startAt: 0,
  players: { host: { name: 'Host', rider: 'ski', ready: true, v: '0.27.0', seen: SV, uid: u.uid } } });
const guest = (u) => ({ name: 'Gast', rider: 'board', ready: false, v: '0.27.0', seen: SV, uid: u.uid });
await expect('A eröffnet Raum', 'ok', req('PUT', '/rooms/ABCD', room(A), A.tok));
await expect('lesen ohne Anmeldung', 'deny', req('GET', '/rooms/ABCD'));
await expect('/rooms auflisten', 'deny', req('GET', '/rooms', undefined, V.tok));
await expect('V überschreibt Raum', 'deny', req('PUT', '/rooms/ABCD', room(V), V.tok));
await expect('V löscht Raum', 'deny', req('DELETE', '/rooms/ABCD', undefined, V.tok));
await expect('V ändert state', 'deny', req('PATCH', '/rooms/ABCD', { state: 'race' }, V.tok));
await expect('B tritt bei', 'ok', req('PUT', '/rooms/ABCD/players/guest', guest(B), B.tok));
await expect('V verdrängt frischen Gast', 'deny', req('PUT', '/rooms/ABCD/players/guest', guest(V), V.tok));
await expect('V schreibt Position des Gasts', 'deny', req('PATCH', '/rooms/ABCD/live/guest', { t: 1, x: 0, y: 5 }, V.tok));
await expect('B bereit', 'ok', req('PATCH', '/rooms/ABCD/players/guest', { ready: true }, B.tok));
await expect('B eigene Position', 'ok', req('PATCH', '/rooms/ABCD/live/guest', { t: 1, x: 0, y: 5, at: SV }, B.tok));
await expect('B Position des Hosts', 'deny', req('PATCH', '/rooms/ABCD/live/host', { t: 1, x: 0, y: 5 }, B.tok));
await expect('B ändert state', 'deny', req('PATCH', '/rooms/ABCD', { state: 'race' }, B.tok));
await expect('B übernimmt Host-Platz', 'deny', req('PATCH', '/rooms/ABCD/players/host', { name: 'Haha' }, B.tok));
await expect('A: Los (state, Gast nicht bereit)', 'ok', req('PATCH', '/rooms/ABCD', { state: 'count', startAt: 5, ts: SV, 'players/guest/ready': false }, A.tok));
await expect('A eigene Position', 'ok', req('PATCH', '/rooms/ABCD/live/host', { t: 1, x: 0, y: 5, at: SV }, A.tok));
await expect('A fälscht Position des Gasts', 'deny', req('PATCH', '/rooms/ABCD/live/guest', { t: 2, x: 0, y: 900 }, A.tok));
await expect('A setzt eigene uid in Gast-Platz', 'deny', req('PATCH', '/rooms/ABCD/players/guest', { uid: 'fremd' }, A.tok));
await expect('A Revanche (Positionen löschen)', 'ok', req('PATCH', '/rooms/ABCD', { state: 'lobby', round: 2, seed: 7, startAt: 0, ts: SV, 'live/host': null, 'live/guest': null, 'players/guest/ready': false }, A.tok));
await expect('B Herzschlag', 'ok', req('PATCH', '/rooms/ABCD/players/guest', { seen: SV }, B.tok));
await expect('B geht', 'ok', req('PATCH', '/rooms/ABCD', { 'players/guest': null, 'live/guest': null }, B.tok));
await expect('V tritt dem freien Platz bei', 'ok', req('PUT', '/rooms/ABCD/players/guest', guest(V), V.tok));
await fetch(`${DB}/rooms/ABCD/players/guest/seen.json?${NS}`, { method: 'PUT', headers: admin, body: String(Date.now() - 120000) });
await expect('B verdrängt verwaisten Gast', 'ok', req('PUT', '/rooms/ABCD/players/guest', guest(B), B.tok));
await expect('A löscht Raum', 'ok', req('DELETE', '/rooms/ABCD', undefined, A.tok));
await fetch(`${DB}/rooms/EFGH.json?${NS}`, { method: 'PUT', headers: admin, body: JSON.stringify({ ...room(A), ts: Date.now() - 7300000, players: { host: { ...room(A).players.host, seen: 1 } } }) });
await expect('V übernimmt verlassenen Raum', 'ok', req('PUT', '/rooms/EFGH', room(V), V.tok));
await expect('Raum mit fremder Host-uid', 'deny', req('PUT', '/rooms/JKLM', room(A), V.tok));
await expect('abgelaufenes/falsches Token', 'deny', req('PUT', '/boards/classic/zz', e(A, { name: 'ZZ' }), 'kaputt'));
console.log(fail ? `${fail} FEHLER` : 'alles wie erwartet');
process.exitCode = fail ? 1 : 0;
