// Fahrer (Avatar), gewählt über das Icon oben links auf der Fresh-Seite. Rein optisch: Physik, Steuerung und
// Bestenliste sind für alle gleich, sonst wären Weiten zwischen den Fahrern nicht vergleichbar.
// Wie jeder Fahrer aussieht und welche Spur er zieht, steht in render.js (riderShape, drawTrack).
export const RIDERS = {
  ski: { id: 'ski', name: 'Ski' },
  board: { id: 'board', name: 'Snowboard' },
  sled: { id: 'sled', name: 'Schlitten' },
};

export const RIDER_ORDER = ['ski', 'board', 'sled'];
export const DEFAULT_RIDER = 'ski';
export const validRider = (id) => (RIDERS[id] ? id : DEFAULT_RIDER);
