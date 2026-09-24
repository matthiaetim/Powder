// Spielmodi. Chase kommt als nächster Schritt; bis dahin ist die Karte ausgegraut.
export const MODES = {
  classic: { id: 'classic', name: 'Classic', desc: 'Fahr der Lawine davon.', soon: false },
  chase: { id: 'chase', name: 'Chase', desc: 'Die Lawine ist immer im Bild.', soon: true },
};

export const MODE_ORDER = ['classic', 'chase'];
export const DEFAULT_MODE = 'classic';
