// Tuning-Panel: Regler für Steuerung und Lawine, Werte überschreiben C live und bleiben gespeichert.
import { C, TUNABLES, VERSION } from './constants.js';

const KEY = 'powder.tune.v18'; // Versionssprung verwirft alte Regler-Werte, wenn sich die Defaults ändern
const ROWS = TUNABLES.filter((t) => t.key); // ohne Gruppentitel
const DEFAULTS = Object.fromEntries(ROWS.map((t) => [t.key, C[t.key]]));
// Regler, die auch in den Einstellungen stehen (user, der Ton): eigener Speicher, der KEY-Sprünge überlebt. Dort steht
// nur, was vom Standard abweicht, sonst verdeckte ein gespeicherter alter Standard einen neuen.
const USER_KEY = 'powder.settings.tune';
const USER_ROWS = ROWS.filter((t) => t.user);
// Schalter mit keep (Beta-Modi): eigener Speicher, damit „Standard“ und KEY-Sprünge sie nicht zurücksetzen
const KEEP_KEY = 'powder.tune.keep';
const KEEP_ROWS = ROWS.filter((t) => t.keep);
const DEV_ROWS = ROWS.filter((t) => !t.user && !t.keep);

export function loadTune() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const t of DEV_ROWS) if (typeof saved[t.key] === 'number') C[t.key] = saved[t.key];
    const mine = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
    for (const t of USER_ROWS) if (typeof mine[t.key] === 'number') C[t.key] = mine[t.key];
    const kept = JSON.parse(localStorage.getItem(KEEP_KEY) || '{}');
    for (const t of KEEP_ROWS) if (typeof kept[t.key] === 'number') C[t.key] = kept[t.key];
  } catch { /* egal */ }
}

function saveTune() {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(DEV_ROWS.map((t) => [t.key, C[t.key]]))));
    localStorage.setItem(USER_KEY, JSON.stringify(Object.fromEntries(USER_ROWS
      .filter((t) => C[t.key] !== DEFAULTS[t.key]).map((t) => [t.key, C[t.key]]))));
    localStorage.setItem(KEEP_KEY, JSON.stringify(Object.fromEntries(KEEP_ROWS.map((t) => [t.key, C[t.key]]))));
  } catch { /* egal */ }
}

// „Standard“ im Tuning-Panel: nur die Entwickler-Regler, die Wahl des Spielers in den Einstellungen bleibt
export function resetTune() {
  for (const t of DEV_ROWS) C[t.key] = DEFAULTS[t.key];
  try { localStorage.removeItem(KEY); } catch { /* egal */ }
}

// Einstellungen (hud.js): einen Spieler-Regler setzen oder alle auf Standard
export function setUserTune(key, v) {
  if (!USER_ROWS.some((t) => t.key === key)) return;
  C[key] = v;
  saveTune();
}
export function resetUserTune() {
  for (const t of USER_ROWS) C[t.key] = DEFAULTS[t.key];
  saveTune();
}
export const userTunables = () => USER_ROWS;
export const userTuned = () => USER_ROWS.some((t) => C[t.key] !== DEFAULTS[t.key]);

// Weicht ein Regler vom Standard ab, der das Spiel verändert? Regler mit visual (nur Bild), user (Ton, Wahl des
// Spielers) oder keep (Beta-Schalter) zählen nicht.
export function isTuned() {
  return ROWS.some((t) => !t.visual && !t.user && !t.keep && C[t.key] !== DEFAULTS[t.key]);
}

// Anzeige eines Werts: Name aus names (1 = erster), sonst Zahl mit Einheit.
const fmt = (t, v) => {
  if (t.onoff) return v ? 'An' : 'Aus';
  if (t.names) return t.names[Math.round(v) - 1] ?? String(v);
  const num = (v * (t.scale || 1)).toFixed(t.decimals ?? (t.step < 1 ? 2 : 0));
  return t.unit ? num + ' ' + t.unit : num;
};

// Abweichende Regler als Text zum Einfügen in den Chat mit Claude, der sie als neue Standards in constants.js
// überträgt. Rohwerte wie in C (nicht die skalierte Anzeige), damit sie 1:1 in die Konstanten passen; Name und
// Standard stehen als Kommentar dabei, damit man die Zeilen auch ohne Panel lesen kann.
export function tuneReport() {
  const lines = [];
  let group = '';
  for (const t of TUNABLES) {
    if (t.heading) { group = t.heading; continue; }
    if (t.keep || C[t.key] === DEFAULTS[t.key]) continue;
    lines.push(`${t.key}: ${C[t.key]}, // ${group}: ${t.label} = ${fmt(t, C[t.key])}, Standard ${DEFAULTS[t.key]}`);
  }
  const head = `Powder v${VERSION} Tuning`;
  return lines.length ? [head, ...lines].join('\n') : head + '\nAlle Regler stehen auf Standard.';
}

// Auf dem iPhone öffnet sich das Teilen-Menü, so geht der Text direkt an die Claude-App; ohne Teilen-Funktion
// (Desktop) landet er in der Zwischenablage. Liefert false, wenn beides scheitert oder abgebrochen wurde.
async function sendReport(doc, text) {
  const nav = doc.defaultView && doc.defaultView.navigator;
  if (nav && nav.share) {
    try { await nav.share({ text }); return true; } catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  try { await nav.clipboard.writeText(text); return true; } catch { /* alter Weg unten */ }
  const ta = doc.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  doc.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = doc.execCommand('copy'); } catch { /* egal */ }
  ta.remove();
  return ok;
}

const OPEN_KEY = 'powder.tune.open'; // welche Gruppe zuletzt offen war, reine Bequemlichkeit

// TUNABLES in Gruppen zerlegen: jeder heading-Eintrag beginnt eine neue.
function groups() {
  const out = [];
  for (const t of TUNABLES) {
    if (t.heading) out.push({ heading: t.heading, tone: t.tone || 'ink', rows: [] });
    else if (out.length) out[out.length - 1].rows.push(t);
    else out.push({ heading: 'Allgemein', tone: 'ink', rows: [t] });
  }
  return out;
}

// Baut die Regler in das Panel-Element und hält Anzeige und C synchron. onChange bekommt den verstellten Regler
// (beim Zurücksetzen nichts). Kopf mit Titel, „Standard“ und X bleibt stehen, darunter scrollen die Gruppen. Immer nur eine Gruppe ist offen, sonst wird die Liste auf dem iPhone
// wieder so lang wie vorher.
export function createTunePanel(doc, panel, onChange) {
  const el = (tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  const head = el('div', 'tune-head');
  const title = el('div', 'tune-title', 'Tuning');
  const reset = el('button', 'tune-reset', 'Standard');
  reset.type = 'button';
  const copy = el('button', 'tune-copy', 'Kopieren');
  copy.type = 'button';
  const close = el('button', 'tune-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Schließen');
  head.append(title, copy, reset, close);

  const body = el('div', 'tune-rows');
  const inputs = [];
  const sections = [];
  let openName = '';
  try { openName = localStorage.getItem(OPEN_KEY) || ''; } catch { /* egal */ }

  for (const g of groups()) {
    const sec = el('section', 'tune-group');
    sec.dataset.tone = g.tone;
    const bar = el('button', 'tune-bar');
    bar.type = 'button';
    const name = el('span', 'tune-bar-name', g.heading);
    const badge = el('span', 'tune-badge');
    const chev = el('span', 'tune-chev', '›');
    bar.append(name, badge, chev);
    const list = el('div', 'tune-list');
    const own = [];
    for (const t of g.rows) {
      const row = el('label', 'tune-row');
      const val = el('span', 'tune-value');
      const input = doc.createElement('input');
      if (t.onoff) {
        input.type = 'checkbox';
        row.classList.add('tune-switch');
      } else {
        input.type = 'range';
        input.min = String(t.min);
        input.max = String(t.max);
        input.step = String(t.step);
      }
      input.addEventListener(t.onoff ? 'change' : 'input', () => {
        C[t.key] = t.onoff ? (input.checked ? 1 : 0) : Number(input.value);
        show(entry);
        saveTune();
        if (onChange) onChange(t);
      });
      row.append(el('span', 'tune-label', t.label), val, input);
      list.append(row);
      const entry = { input, val, row, t, sec: null };
      own.push(entry);
      inputs.push(entry);
    }
    const s = { sec, bar, badge, own, heading: g.heading };
    for (const e of own) e.sec = s;
    bar.addEventListener('click', () => setOpen(sec.classList.contains('open') ? '' : g.heading));
    sec.append(bar, list);
    body.append(sec);
    sections.push(s);
  }
  panel.append(head, body);

  function setOpen(heading) {
    for (const s of sections) {
      const open = s.heading === heading;
      s.sec.classList.toggle('open', open);
      s.bar.setAttribute('aria-expanded', String(open));
    }
    try { localStorage.setItem(OPEN_KEY, heading); } catch { /* egal */ }
  }

  // Wert anzeigen und markieren, ob er vom Standard abweicht; die Gruppe zählt ihre geänderten Regler.
  function show(e) {
    e.val.textContent = fmt(e.t, C[e.t.key]);
    e.row.classList.toggle('changed', C[e.t.key] !== DEFAULTS[e.t.key]);
    const n = e.sec.own.filter((x) => C[x.t.key] !== DEFAULTS[x.t.key]).length;
    e.sec.badge.textContent = n ? String(n) : '';
    e.sec.badge.hidden = !n;
    reset.disabled = !DEV_ROWS.some((x) => C[x.key] !== DEFAULTS[x.key]); // auch Bild-Regler zählen hier, der Ton nicht
  }

  function refresh() {
    for (const e of inputs) {
      if (e.t.onoff) e.input.checked = !!C[e.t.key];
      else e.input.value = String(C[e.t.key]);
      show(e);
    }
  }
  reset.addEventListener('click', () => { resetTune(); refresh(); if (onChange) onChange(); });
  let copyTimer = 0;
  copy.addEventListener('click', async () => {
    const ok = await sendReport(doc, tuneReport());
    copy.textContent = ok ? 'Kopiert' : 'Fehler';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copy.textContent = 'Kopieren'; }, C.TUNE_COPY_NOTE_S * 1000);
  });
  setOpen(openName);
  refresh();
  return { refresh, closeButton: close };
}

// Duell: die fairen Regler (fair: true, Fahrphysik, Sicht, Welt) stehen für die Dauer des Duells auf Standard, sonst
// führe ein getuntes Gerät eine andere Welt oder ein anderes Tempo. Der Storage bleibt unberührt, restoreTune stellt
// die gespeicherten Werte zurück.
const FAIR = ROWS.filter((t) => t.fair);
let held = null;
export function suspendTune() {
  if (held) return;
  held = Object.fromEntries(FAIR.map((t) => [t.key, C[t.key]]));
  for (const t of FAIR) C[t.key] = DEFAULTS[t.key];
}
export function restoreTune() {
  if (!held) return;
  for (const t of FAIR) C[t.key] = held[t.key];
  held = null;
}
export const tuneSuspended = () => !!held;
