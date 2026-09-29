// Netzkern für die Firebase Realtime Database per REST ohne SDK (board.js, room.js): eine Basis-URL, fetch mit
// Timeout, JSON-Aufrufe und der Live-Stream (Server-Sent Events). Ohne URL ist alles aus (enabled false), die App
// läuft dann wie ohne Netz. fetchFn und EventSourceImpl lassen sich für Node-Tests austauschen. auth (auth.js) hängt
// an jeden Aufruf das Token des anonymen Kontos; die Regeln lassen ohne Token nur Lesen der Bestenliste zu.
// Die URL darf eine Abfrage tragen (Emulator: ?ns=projekt), sie geht an jeden Aufruf mit.
import { C } from './constants.js';

export function createNet(url, { fetchFn = null, timeoutMs = C.BOARD_TIMEOUT_MS, EventSourceImpl = null, auth = null } = {}) {
  const [base0, baseQuery = ''] = String(url || '').split('?');
  const base = base0.replace(/\/+$/, '');
  const doFetch = fetchFn || (typeof fetch === 'function' ? (...args) => fetch(...args) : null);
  const ES = EventSourceImpl || (typeof EventSource === 'function' ? EventSource : null);
  const enabled = base.length > 0 && !!doFetch;
  const authOn = !!(auth && auth.enabled);

  // Pfad (evtl. schon mit ?print=silent) plus Abfrage der Basis-URL plus Token
  function full(path, token) {
    const extra = [baseQuery, token ? 'auth=' + encodeURIComponent(token) : ''].filter(Boolean).join('&');
    return base + path + (extra ? (path.includes('?') ? '&' : '?') + extra : '');
  }

  // Abgelaufenes oder widerrufenes Token antwortet 401 wie eine Regelverletzung, nur mit anderem Text
  async function tokenRejected(res) {
    if (res.status !== 401 || typeof res.clone !== 'function') return false;
    const body = await res.clone().json().catch(() => null);
    return !!(body && typeof body.error === 'string' && /token/i.test(body.error));
  }

  // Der Timeout gilt bis zu den Antwort-Headern; ein hängender Abruf blockiert sonst alles Weitere
  async function once(path, init, token) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await doFetch(full(path, token), { cache: 'no-store', ...init, signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
  }
  async function request(path, init) {
    if (!authOn) return once(path, init, '');
    const res = await once(path, init, await auth.token());
    if (!(await tokenRejected(res))) return res;
    auth.invalidate();
    return once(path, init, await auth.token());
  }

  // JSON-Aufruf: { ok, status, data }. silent hängt print=silent an, dann antwortet Firebase mit 204 ohne Echo;
  // das spart bei den Positions-Updates im Duell das Zurücklesen. Netzfehler und Timeout: ok false, status 0.
  async function call(method, path, body, { silent = false } = {}) {
    const q = silent ? (path.includes('?') ? '&' : '?') + 'print=silent' : '';
    try {
      const res = await request(path + q, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = res.status === 204 ? null : await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: null, error: err };
    }
  }

  // Live-Stream eines Pfads (REST-Streaming; EventSource setzt Accept: text/event-stream selbst). put und patch
  // tragen { path, data } relativ zum Pfad, keep-alive kommt alle 30 s. cancel heißt: kein Leserecht mehr, dann
  // schließen, sonst verbindet EventSource endlos neu. auth_revoked kommt, wenn das Token abläuft (nach einer Stunde):
  // dann mit frischem Token neu verbinden, das erste put liefert wieder den ganzen Knoten. Das Token holt sich der
  // Stream selbst, er steht also erst kurz nach dem Aufruf.
  function stream(path, handlers = {}) {
    if (!enabled || !ES) return null;
    let es = null, closed = false;
    const on = (src, name, fn) => src.addEventListener(name, (e) => {
      let d = null;
      try { d = JSON.parse(e.data); } catch { /* keep-alive trägt null */ }
      fn(d);
    });
    async function connect() {
      const token = authOn ? await auth.token() : '';
      if (closed) return;
      const src = new ES(full(path, token));
      es = src;
      if (handlers.put) on(src, 'put', handlers.put);
      if (handlers.patch) on(src, 'patch', handlers.patch);
      if (handlers.keepAlive) on(src, 'keep-alive', handlers.keepAlive);
      on(src, 'cancel', (d) => { src.close(); if (handlers.cancel) handlers.cancel(d); });
      on(src, 'auth_revoked', () => {
        src.close();
        if (!authOn) { if (handlers.cancel) handlers.cancel(null); return; }
        auth.invalidate();
        connect();
      });
      if (handlers.error) src.addEventListener('error', () => handlers.error());
      if (handlers.open) src.addEventListener('open', () => handlers.open());
    }
    connect();
    return { close: () => { closed = true; if (es) es.close(); }, get state() { return es ? es.readyState : 0; } };
  }

  // Eigene uid für Einträge und Duell-Plätze, '' ohne Anmeldung oder offline
  async function whoami() {
    if (!authOn) return '';
    await auth.token();
    return auth.uid();
  }

  return {
    enabled, base, request, stream, whoami,
    uid: () => (authOn ? auth.uid() : ''), // zuletzt bekannte uid, ohne Anfrage
    get: (path) => call('GET', path),
    put: (path, body, o) => call('PUT', path, body, o),
    patch: (path, body, o) => call('PATCH', path, body, o),
    del: (path, o) => call('DELETE', path, undefined, o),
  };
}
