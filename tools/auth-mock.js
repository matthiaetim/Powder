// Mock der anonymen Firebase-Anmeldung (auth.js), nur zum lokalen Testen zusammen mit board-mock.js und room-mock.js:
// node tools/serve.js 8082 --board, im Browser ?board=local. signUp vergibt eine neue uid, token erneuert sie. Das Token
// ist einfach "mock-<uid>", die beiden anderen Mocks lesen daraus die uid (uidOf), wie Firebase aus ?auth=.
let next = 1;
const newUid = () => 'mock' + String(next++).padStart(4, '0') + Math.random().toString(36).slice(2, 8);

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

// uid aus ?auth= einer Datenbank-Anfrage, '' ohne gültiges Token
function uidOf(req) {
  const tok = new URL(req.url, 'http://x').searchParams.get('auth') || '';
  return /^mock-[a-z0-9]+$/.test(tok) ? tok.slice(5) : '';
}

function handle(req, res) {
  const path = new URL(req.url, 'http://x').pathname;
  if (req.method !== 'POST') return false;
  if (path === '/identitytoolkit.googleapis.com/v1/accounts:signUp') {
    const uid = newUid();
    console.log(`[auth] neues Gerät ${uid}`);
    send(res, 200, { localId: uid, idToken: 'mock-' + uid, refreshToken: 'r-' + uid, expiresIn: '3600' });
    return true;
  }
  if (path === '/securetoken.googleapis.com/v1/token') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const r = new URLSearchParams(raw).get('refresh_token') || '';
      if (!/^r-[a-z0-9]+$/.test(r)) { send(res, 400, { error: { message: 'INVALID_REFRESH_TOKEN' } }); return; }
      const uid = r.slice(2);
      send(res, 200, { user_id: uid, id_token: 'mock-' + uid, refresh_token: r, expires_in: '3600' });
    });
    return true;
  }
  return false;
}

module.exports = { handle, uidOf };
