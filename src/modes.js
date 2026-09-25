// Spielmodi. Classic: freie Abfahrt. Chase: die Lawine hält ein Tempo, das mit der Laufzeit steigt.
// Super-G: Zeitfahren durch Tore, Ziel nach 1000 m (gates.js).
export const MODES = {
  classic: { id: 'classic', name: 'Classic', desc: 'Freie Abfahrt, so weit es geht.', soon: false },
  chase: { id: 'chase', name: 'Chase', desc: 'Fahr der Lawine davon.', soon: false },
  superg: { id: 'superg', name: 'Super-G', desc: 'Zeitfahren durch die Tore.', soon: false },
};

export const MODE_ORDER = ['classic', 'chase', 'superg'];
// Modi mit Bestenliste in Metern (board.js). Super-G wertet Zeiten, dafür gibt es noch keine Liste; die Firebase-Regeln
// (tools/firebase-rules.json) lassen ohnehin nur diese beiden zu.
export const BOARD_MODES = ['classic', 'chase'];
export const DEFAULT_MODE = 'classic';
