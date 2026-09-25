// Spielmodi. Classic: freie Abfahrt. Chase: die Lawine hält ein Tempo, das mit der Laufzeit steigt.
export const MODES = {
  classic: { id: 'classic', name: 'Classic', desc: 'Freie Abfahrt, so weit es geht.', soon: false },
  chase: { id: 'chase', name: 'Chase', desc: 'Fahr der Lawine davon.', soon: false },
};

export const MODE_ORDER = ['classic', 'chase'];
export const DEFAULT_MODE = 'classic';
