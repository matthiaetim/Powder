// Anonyme Anmeldung bei Firebase per REST ohne SDK (net.js hängt das Token an jeden Aufruf). Jedes Gerät bekommt beim
// ersten Schreiben ein eigenes Konto; seine uid steht in den Einträgen der Bestenliste und im Duell-Platz, und die Regeln
// (tools/firebase-rules.json) lassen nur ihren Besitzer schreiben. So kann niemand fremde Einträge überschreiben.
// Der Refresh-Token bleibt im localStorage: dasselbe Gerät ist nach einem Neustart dasselbe Konto. Gelöschte
// Safari-Daten heißen neues Konto, die alten Einträge gehören dann niemandem mehr, der sie ändern kann.
import { C } from './constants.js';
import { loadJson, saveJson } from './storage.js';

// prefix: 'https://' für Google, beim Emulator 'http://127.0.0.1:9099/', beim Mock des Dev-Servers dessen Origin mit '/'
export function createAuth({ key = C.AUTH_KEY, prefix = C.AUTH_PREFIX, fetchFn = null, timeoutMs = C.BOARD_TIMEOUT_MS } = {}) {
  const doFetch = fetchFn || (typeof fetch === 'function' ? (...args) => fetch(...args) : null);
  const enabled = !!key && !!doFetch;
  const storeKey = 'powder.auth.' + key; // je Schlüssel, damit Mock und echte Datenbank sich nicht mischen
  let s = loadJson(storeKey) || {};
  let pending = null;

  async function post(url, body, type) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await doFetch(url, { method: 'POST', headers: { 'Content-Type': type }, body, signal: ctl.signal });
      return { status: res.status, data: await res.json().catch(() => null) };
    } catch {
      return { status: 0, data: null }; // offline oder Timeout
    } finally {
      clearTimeout(timer);
    }
  }

  function keep(uid, id, refresh, expiresS) {
    s = { uid, id, refresh, exp: Date.now() + (Number(expiresS) || 3600) * 1000 };
    saveJson(storeKey, s);
    return id;
  }

  async function signUp() {
    const r = await post(`${prefix}identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(key)}`,
      JSON.stringify({ returnSecureToken: true }), 'application/json');
    const d = r.data;
    if (r.status !== 200 || !d || !d.idToken || !d.localId) return '';
    return keep(d.localId, d.idToken, d.refreshToken, d.expiresIn);
  }

  // Abgelehntes Refresh (400: Konto gelöscht oder gesperrt) heißt neues Konto; ohne Netz bleibt es beim alten
  async function refresh() {
    const r = await post(`${prefix}securetoken.googleapis.com/v1/token?key=${encodeURIComponent(key)}`,
      'grant_type=refresh_token&refresh_token=' + encodeURIComponent(s.refresh), 'application/x-www-form-urlencoded');
    const d = r.data;
    if (r.status === 200 && d && d.id_token) return keep(d.user_id || s.uid, d.id_token, d.refresh_token || s.refresh, d.expires_in);
    if (r.status >= 400 && r.status < 500) return signUp();
    return '';
  }

  // Gültiges Token oder '' (aus, offline). Parallele Aufrufe teilen sich eine Anfrage.
  function token() {
    if (!enabled) return Promise.resolve('');
    if (s.id && s.exp - Date.now() > C.AUTH_EARLY_S * 1000) return Promise.resolve(s.id);
    if (!pending) pending = (s.refresh ? refresh() : signUp()).finally(() => { pending = null; });
    return pending;
  }

  return {
    enabled,
    token,
    uid: () => s.uid || '',
    // Server hat das Token abgelehnt (abgelaufen, widerrufen): beim nächsten Mal erneuern
    invalidate: () => { s = { ...s, id: '', exp: 0 }; },
  };
}
