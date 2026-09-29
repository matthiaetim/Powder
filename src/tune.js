// Tuning-Panel: Regler für Steuerung und Lawine, Werte überschreiben C live und bleiben gespeichert.
import { C, TUNABLES } from './constants.js';

const KEY = 'powder.tune.v15'; // Versionssprung verwirft alte Regler-Werte, wenn sich die Defaults ändern
const ROWS = TUNABLES.filter((t) => t.key); // ohne Gruppentitel
const DEFAULTS = Object.fromEntries(ROWS.map((t) => [t.key, C[t.key]]));

export function loadTune() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const t of ROWS) if (typeof saved[t.key] === 'number') C[t.key] = saved[t.key];
  } catch { /* egal */ }
}

function saveTune() {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(ROWS.map((t) => [t.key, C[t.key]]))));
  } catch { /* egal */ }
}

export function resetTune() {
  for (const t of ROWS) C[t.key] = DEFAULTS[t.key];
  try { localStorage.removeItem(KEY); } catch { /* egal */ }
}

// Weicht ein Regler vom Standard ab, der das Spiel verändert? Regler mit visual (nur Bild) zählen nicht.
export function isTuned() {
  return ROWS.some((t) => !t.visual && C[t.key] !== DEFAULTS[t.key]);
}

// Anzeige eines Werts: Name aus names (1 = erster), sonst Zahl mit Einheit.
const fmt = (t, v) => {
  if (t.names) return t.names[Math.round(v) - 1] ?? String(v);
  const num = (v * (t.scale || 1)).toFixed(t.decimals ?? (t.step < 1 ? 2 : 0));
  return t.unit ? num + ' ' + t.unit : num;
};

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
  const close = el('button', 'tune-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Schließen');
  head.append(title, reset, close);

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
      input.type = 'range';
      input.min = String(t.min);
      input.max = String(t.max);
      input.step = String(t.step);
      input.addEventListener('input', () => {
        C[t.key] = Number(input.value);
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
    reset.disabled = !ROWS.some((x) => C[x.key] !== DEFAULTS[x.key]); // auch Bild-Regler zählen hier
  }

  function refresh() {
    for (const e of inputs) {
      e.input.value = String(C[e.t.key]);
      show(e);
    }
  }
  reset.addEventListener('click', () => { resetTune(); refresh(); if (onChange) onChange(); });
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
