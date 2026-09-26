// Netzkern für die Firebase Realtime Database per REST ohne SDK (board.js, room.js): eine Basis-URL, fetch mit
// Timeout, JSON-Aufrufe und der Live-Stream (Server-Sent Events). Ohne URL ist alles aus (enabled false), die App
// läuft dann wie ohne Netz. fetchFn und EventSourceImpl lassen sich für Node-Tests austauschen.
import { C } from './constants.js';

export function createNet(url, { fetchFn = null, timeoutMs = C.BOARD_TIMEOUT_MS, EventSourceImpl = null } = {}) {
  const base = String(url || '').replace(/\/+$/, '');
  const doFetch = fetchFn || (typeof fetch === 'function' ? (...args) => fetch(...args) : null);
  const ES = EventSourceImpl || (typeof EventSource === 'function' ? EventSource : null);
  const enabled = base.length > 0 && !!doFetch;

  // Der Timeout gilt bis zu den Antwort-Headern; ein hängender Abruf blockiert sonst alles Weitere
  async function request(path, init) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      return await doFetch(base + path, { cache: 'no-store', ...init, signal: ctl.signal });
    } finally {
      clearTimeout(timer);
    }
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
  // schließen, sonst verbindet EventSource endlos neu.
  function stream(path, handlers = {}) {
    if (!enabled || !ES) return null;
    const es = new ES(base + path);
    const on = (name, fn) => es.addEventListener(name, (e) => {
      let d = null;
      try { d = JSON.parse(e.data); } catch { /* keep-alive trägt null */ }
      fn(d);
    });
    if (handlers.put) on('put', handlers.put);
    if (handlers.patch) on('patch', handlers.patch);
    if (handlers.keepAlive) on('keep-alive', handlers.keepAlive);
    on('cancel', (d) => { es.close(); if (handlers.cancel) handlers.cancel(d); });
    on('auth_revoked', (d) => { es.close(); if (handlers.cancel) handlers.cancel(d); });
    if (handlers.error) es.addEventListener('error', () => handlers.error());
    if (handlers.open) es.addEventListener('open', () => handlers.open());
    return { close: () => es.close(), get state() { return es.readyState; } };
  }

  return {
    enabled, base, request, stream,
    get: (path) => call('GET', path),
    put: (path, body, o) => call('PUT', path, body, o),
    patch: (path, body, o) => call('PATCH', path, body, o),
    del: (path, o) => call('DELETE', path, undefined, o),
  };
}
