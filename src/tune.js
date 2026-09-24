// Tuning-Panel: Regler für die Steuerung, Werte überschreiben C live und bleiben gespeichert.
import { C, TUNABLES } from './constants.js';

const KEY = 'powder.tune.v2'; // Versionssprung verwirft alte Regler-Werte, wenn sich die Defaults ändern
const DEFAULTS = Object.fromEntries(TUNABLES.map((t) => [t.key, C[t.key]]));

export function loadTune() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const t of TUNABLES) if (typeof saved[t.key] === 'number') C[t.key] = saved[t.key];
  } catch { /* egal */ }
}

function saveTune() {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(TUNABLES.map((t) => [t.key, C[t.key]]))));
  } catch { /* egal */ }
}

export function resetTune() {
  for (const t of TUNABLES) C[t.key] = DEFAULTS[t.key];
  try { localStorage.removeItem(KEY); } catch { /* egal */ }
}

export function isTuned() {
  return TUNABLES.some((t) => C[t.key] !== DEFAULTS[t.key]);
}

const fmt = (t, v) => (t.step < 1 ? v.toFixed(2) : String(Math.round(v)));

// Baut die Regler in das Panel-Element und hält Anzeige und C synchron.
export function createTunePanel(doc, panel, onChange) {
  const rows = doc.createElement('div');
  rows.className = 'tune-rows';
  const inputs = new Map();
  for (const t of TUNABLES) {
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
      val.textContent = fmt(t, C[t.key]) + ' ' + t.unit;
      saveTune();
      if (onChange) onChange();
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
      val.textContent = fmt(t, C[t.key]) + ' ' + t.unit;
    }
  }
  reset.addEventListener('click', () => { resetTune(); refresh(); if (onChange) onChange(); });
  refresh();
  return { refresh, closeButton: close };
}
