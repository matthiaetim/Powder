// Tuning-Panel: Regler für Steuerung und Lawine, Werte überschreiben C live und bleiben gespeichert.
import { C, TUNABLES } from './constants.js';

const KEY = 'powder.tune.v14'; // Versionssprung verwirft alte Regler-Werte, wenn sich die Defaults ändern
const ROWS = TUNABLES.filter((t) => t.key); // ohne Zwischentitel
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

// Baut die Regler in das Panel-Element und hält Anzeige und C synchron. onChange bekommt den verstellten Regler
// (beim Zurücksetzen nichts).
export function createTunePanel(doc, panel, onChange) {
  const rows = doc.createElement('div');
  rows.className = 'tune-rows';
  const inputs = new Map();
  for (const t of TUNABLES) {
    if (t.heading) {
      const h = doc.createElement('div');
      h.className = 'tune-heading';
      h.textContent = t.heading;
      rows.append(h);
      continue;
    }
    const row = doc.createElement('label');
    row.className = 'tune-row';
    const head = doc.createElement('span');
    head.className = 'tune-label';
    const val = doc.createElement('span');
    val.className = 'tune-value';
    const input = doc.createElement('input');
    input.type = 'range';
    input.min = String(t.min);
    input.max = String(t.max);
    input.step = String(t.step);
    head.textContent = t.label;
    input.addEventListener('input', () => {
      C[t.key] = Number(input.value);
      val.textContent = fmt(t, C[t.key]);
      saveTune();
      if (onChange) onChange(t);
    });
    row.append(head, val, input);
    rows.append(row);
    inputs.set(t.key, { input, val, t });
  }
  const actions = doc.createElement('div');
  actions.className = 'tune-actions';
  const reset = doc.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Standard';
  const close = doc.createElement('button');
  close.type = 'button';
  close.textContent = 'Schließen';
  actions.append(reset, close);
  panel.append(rows, actions);

  function refresh() {
    for (const { input, val, t } of inputs.values()) {
      input.value = String(C[t.key]);
      val.textContent = fmt(t, C[t.key]);
    }
  }
  reset.addEventListener('click', () => { resetTune(); refresh(); if (onChange) onChange(); });
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
