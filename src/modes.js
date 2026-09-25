// Spielmodi. Classic: freie Abfahrt. Chase: die Lawine hält ein Tempo, das mit der Laufzeit steigt.
// Super-G: Zeitfahren durch Tore, Ziel nach 1000 m (gates.js).
// board: Wertung in der Bestenliste (board.js). 'm' = Meter, mehr ist besser; 'time' = Gesamtzeit in Hundertstel,
// weniger ist besser. Die Firebase-Regeln (tools/firebase-rules.json) kennen dieselben Modi und Richtungen.
export const MODES = {
  classic: { id: 'classic', name: 'Classic', desc: 'Freie Abfahrt, so weit es geht.', soon: false, board: 'm' },
  chase: { id: 'chase', name: 'Chase', desc: 'Fahr der Lawine davon.', soon: false, board: 'm' },
  superg: { id: 'superg', name: 'Super-G', desc: 'Zeitfahren durch die Tore.', soon: false, board: 'time' },
};

export const MODE_ORDER = ['classic', 'chase', 'superg'];
// Modi mit Bestenliste, in der Reihenfolge der Karten.
export const BOARD_MODES = MODE_ORDER.filter((id) => !!MODES[id].board);
// Zeitwertung: der kleinere Wert ist der bessere (Super-G).
export const lowerIsBetter = (mode) => MODES[mode] && MODES[mode].board === 'time';
export const DEFAULT_MODE = 'classic';
