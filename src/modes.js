// Spielmodi. Classic: freie Abfahrt. Lawine: die Lawine hält ein Tempo, das mit der Laufzeit steigt.
// Super-G: Zeitfahren durch Tore, Ziel nach 1000 m (gates.js). Duell: zwei Geräte, dieselbe Strecke, wer die Zielweite
// in kürzerer eigener Zeit erreicht, gewinnt (duel.js); ohne Bestenliste, dafür ein lokaler Siegzähler.
// desc: Kurztext für die Moduswahl auf der Fresh-Seite (hud.js), eine Zeile neben der Vorschau.
// board: Wertung in der Bestenliste (board.js). 'm' = Meter, mehr ist besser; 'time' = Gesamtzeit in Hundertstel,
// weniger ist besser. Die Firebase-Regeln (tools/firebase-rules.json) kennen dieselben Modi und Richtungen.
// Die id ist der Schlüssel in Datenbank und localStorage und bleibt deshalb stabil, auch wenn der Name sich
// ändert: der Modus Lawine hieß bis v0.19.3 Chase und heißt intern weiter 'chase'.
export const MODES = {
  classic: { id: 'classic', name: 'Classic', desc: 'So weit es geht.', soon: false, board: 'm' },
  chase: { id: 'chase', name: 'Lawine', desc: 'Fahr der Lawine davon.', soon: false, board: 'm' },
  superg: { id: 'superg', name: 'Super-G', desc: '21 Tore auf Zeit, 1000 m.', soon: false, board: 'time' },
  duel: { id: 'duel', name: 'Duell', desc: 'Zu zweit, live. Wer ist zuerst am Ziel?', soon: false, board: null },
};

export const MODE_ORDER = ['classic', 'chase', 'superg', 'duel'];
// Modi mit Bestenliste, in der Reihenfolge der Karten.
export const BOARD_MODES = MODE_ORDER.filter((id) => !!MODES[id].board);
// Zeitwertung: der kleinere Wert ist der bessere (Super-G).
export const lowerIsBetter = (mode) => MODES[mode] && MODES[mode].board === 'time';
export const DEFAULT_MODE = 'classic';
