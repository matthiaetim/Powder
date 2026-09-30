// Spielmodi. Classic: freie Abfahrt. Lawine: die Lawine hält ein Tempo, das mit der Laufzeit steigt.
// Super-G: Zeitfahren durch Tore, Ziel nach 1000 m (gates.js). Slalom: dasselbe kurz und eng, 500 m um einzelne
// Kippstangen. Duell: zwei Geräte, dieselbe Strecke, wer die Zielweite
// in kürzerer eigener Zeit erreicht, gewinnt (duel.js); ohne Bestenliste, dafür ein lokaler Siegzähler.
// Piste: geführte Abfahrt auf fester Strecke bis ins Tal (piste.js), Stürze kosten nur Zeit, bis die freien
// verbraucht sind.
// desc: Kurztext für die Moduswahl auf der Fresh-Seite (hud.js), eine Zeile neben der Vorschau.
// board: Wertung in der Bestenliste (board.js). 'm' = Meter, mehr ist besser; 'time' = Gesamtzeit in Hundertstel,
// weniger ist besser. tie: 't' (Piste): bei gleichen Metern entscheidet die kürzere Laufzeit, das trifft alle, die
// das Ziel erreichen. Die Firebase-Regeln (tools/firebase-rules.json) kennen dieselben Modi und Richtungen.
// Die id ist der Schlüssel in Datenbank und localStorage und bleibt deshalb stabil, auch wenn der Name sich
// ändert: der Modus Lawine hieß bis v0.19.3 Chase und heißt intern weiter 'chase'.
export const MODES = {
  classic: { id: 'classic', name: 'Classic', desc: 'So weit es geht.', soon: false, board: 'm' },
  piste: { id: 'piste', name: 'Piste', desc: 'Geführt bis ins Tal, 10.000 m.', soon: false, board: 'm', tie: 't' },
  chase: { id: 'chase', name: 'Lawine', desc: 'Fahr der Lawine davon.', soon: false, board: 'm' },
  superg: { id: 'superg', name: 'Super-G', desc: '21 Tore auf Zeit, 1000 m.', soon: false, board: 'time' },
  slalom: { id: 'slalom', name: 'Slalom', desc: '30 Tore im Rhythmus, 500 m.', soon: false, board: 'time' },
  duel: { id: 'duel', name: 'Duell', desc: 'Zu zweit, live. Wer ist zuerst am Ziel?', soon: false, board: null },
};

export const MODE_ORDER = ['classic', 'piste', 'chase', 'superg', 'slalom', 'duel'];
// Modi mit Bestenliste, in der Reihenfolge der Karten.
export const BOARD_MODES = MODE_ORDER.filter((id) => !!MODES[id].board);
// Zeitwertung: der kleinere Wert ist der bessere (Super-G, Slalom). Genau diese Modi sind Torläufe (gates.js COURSES).
export const lowerIsBetter = (mode) => MODES[mode] && MODES[mode].board === 'time';
export const DEFAULT_MODE = 'classic';
