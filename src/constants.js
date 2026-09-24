// Alle Stellschrauben des Spiels an einem Ort.
// Einheiten: Meter, Sekunden, Grad. Werte mit (Tuning) lassen sich im Spiel per Panel verstellen.
export const VERSION = '0.5.0';

export const C = {
  // Sicht (Hochkant): sichtbare Breite/Höhe in Metern, Fahrer bei 33 % Bildhöhe.
  // Bei Tempo rückt der Fahrer nach oben und die Kamera zoomt leicht heraus: mehr Vorausschau.
  VIEW_W_M: 40,
  VIEW_H_M: 86,
  SKIER_SCREEN_Y_FRAC: 0.33,
  CAM_Y_FRAC_FAST: 0.25,     // Fahrerposition bei vollem Tempo
  CAM_ZOOM_FAST: 1.15,       // (Tuning) Herauszoomen bei vollem Tempo, 1 = aus
  CAM_SPEED_REF_KMH: 160,    // ab hier volle Vorausschau
  CAM_ZOOM_EASE_S: 0.6,      // Zeitkonstante von Zoom und Fahrerposition
  MAX_DPR: 2,
  CAM_X_EASE_S: 0.15,

  // Loop
  STEP: 1 / 120,
  MAX_STEPS: 8,
  MAX_FRAME_MS: 100,

  // Lenkung: Antippen dreht sofort ein Stück, Halten dreht gleichmäßig weiter,
  // Loslassen schwingt zur Falllinie zurück.
  TURN_KICK_DEG: 15,       // (Tuning) Sofortdrehung beim Antippen
  TURN_RATE_DEG_S: 200,    // (Tuning) Drehrate beim Halten
  MAX_HEADING_DEG: 120,    // (Tuning) über quer (90°) hinaus leicht bergauf
  RETURN_S: 0.25,          // (Tuning) Zeitkonstante der Rückkehr zur Falllinie
  RETURN_MIN_DEG_S: 40,    // damit die Rückkehr auch bei kleinen Winkeln zügig endet

  // Tempo: der Start hat schon Fahrt, ohne Tippen wird man stetig schneller. Der Luftwiderstand
  // wächst quadratisch und hebt den Hangabtrieb beim Endtempo auf (weiche Annäherung statt Deckel).
  START_SPEED_KMH: 25,     // (Tuning) Anfahrt beim Start
  G_SLOPE: 5.0,            // (Tuning) Hangabtrieb in m/s²
  MAX_SPEED_KMH: 200,      // (Tuning) Endtempo im Freilauf

  // Bremsen: wächst mit dem Winkel (ab BRAKE_START_DEG, voll ab BRAKE_FULL_DEG)
  // und mit dem Tempo: Verzögerung = Anteil × (BRAKE_MIN + BRAKE_K × v).
  // Kurzer Tipp (≈35°) kostet kaum Tempo, Halten bremst hart bis zum Stillstand.
  BRAKE_K: 3.0,            // (Tuning) Bremskraft pro m/s Tempo
  BRAKE_MIN: 15,           // Grundbremsung in m/s², damit man wirklich zum Stehen kommt
  BRAKE_START_DEG: 25,     // (Tuning) darunter bremst nichts
  BRAKE_FULL_DEG: 65,      // (Tuning) ab hier volle Bremskraft

  SKIER_R: 0.45,

  // Lawine (nur Chase-Modus, wird noch überarbeitet)
  AV_START_GAP_M: 90,
  AV_BASE_MS: 16,
  AV_RAMP_PER_M: 0.006,
  AV_MAX_MS: 27,
  AV_MAX_GAP_M: 80,
  AV_RUBBER: true,
  AV_CATCH_M: 1.0,
  AV_VISIBLE_GAP_M: 45,
  AV_BLOBS: 9,

  // Welt
  CELL_M: 40,
  CULL_CELLS: 1,
  MIN_SPACING_M: 4.0,
  TREE_D0: 0.012,
  TREE_D1: 0.026,          // (Tuning) Dichte am Ende des Anstiegs
  RAMP_M: 8000,            // (Tuning) Dichte, Korridor und Felsanteil steigen über diese Strecke (Marathon)
  ROCK_FRAC0: 0.2,
  ROCK_FRAC1: 0.3,
  LANE_AMP: 12,
  LANE_WAVELENGTH: 300,
  LANE_HALF0: 3.0,
  LANE_HALF1: 1.75,
  START_CLEAR_M: 15,
  START_EASY_M: 100,
  START_EASY_FACTOR: 0.3,

  // Spur & Partikel
  TRACK_SPACING_M: 0.4,
  TRACK_CAP: 512,
  TRACK_WIDTH_MAX: 4,      // Spurbreite bei vollem Carve, Vielfaches der Grundbreite
  PARTICLE_POOL: 64,

  // Warnschnee (nur Chase-Modus)
  SNOW_POOL: 160,
  SNOW_MIN_SPEED: 140,
  SNOW_MAX_SPEED: 260,
  WHITEOUT_S: 0.6,

  // Zustände
  READY_AUTO_START_MS: 1200, // Intro beim App-Start: Kamerafahrt, dann los
  FRESH_START_MS: 500,       // nach Fresh: kurze Schonfrist, dann los
  DEATH_OVERLAY_MS: 700,
  FRESH_GUARD_MS: 300,

  // HUD
  HUD_LOCALE: 'de-DE',

  // Farben: Polarweiß mit leichtem Blaustich, Tannengrün, kühles Schiefergrau für Text und Fahrer
  BG: '#F5F9FD',
  INK: '#2E3A45',
  INK_LIGHT: '#3E4B57',
  TREE: '#2F4F3E',
  TREE_LIGHT: '#3E6650',
  TRUNK: '#2A2F33',
  ROCK: '#6A7580',
  ROCK_TOP: '#7E8994',
  SHADOW_RGB: '55,75,95',
  TRACK_RGB: '60,80,100',
  TRACK: 'rgba(60,80,100,0.16)',
  AVALANCHE: [46, 58, 69],
};

// Regler im Tuning-Panel (langer Druck auf das Versions-Label).
export const TUNABLES = [
  { key: 'TURN_KICK_DEG', label: 'Sofortdrehung', unit: '°', min: 0, max: 40, step: 1 },
  { key: 'TURN_RATE_DEG_S', label: 'Drehrate', unit: '°/s', min: 30, max: 300, step: 5 },
  { key: 'MAX_HEADING_DEG', label: 'Max. Winkel', unit: '°', min: 60, max: 150, step: 5 },
  { key: 'RETURN_S', label: 'Rückkehr', unit: 's', min: 0.05, max: 2, step: 0.05 },
  { key: 'BRAKE_K', label: 'Bremskraft', unit: '', min: 0.2, max: 6, step: 0.1 },
  { key: 'BRAKE_START_DEG', label: 'Bremsen ab', unit: '°', min: 0, max: 60, step: 5 },
  { key: 'BRAKE_FULL_DEG', label: 'Bremsen voll ab', unit: '°', min: 30, max: 120, step: 5 },
  { key: 'START_SPEED_KMH', label: 'Starttempo', unit: 'km/h', min: 0, max: 80, step: 5 },
  { key: 'G_SLOPE', label: 'Beschleunigung', unit: 'm/s²', min: 1, max: 10, step: 0.25 },
  { key: 'MAX_SPEED_KMH', label: 'Endtempo', unit: 'km/h', min: 60, max: 300, step: 10 },
  { key: 'CAM_ZOOM_FAST', label: 'Vorausschau bei Tempo', unit: '×', min: 1, max: 1.5, step: 0.05 },
  { key: 'TREE_D1', label: 'Dichte am Ende', unit: '/100 m²', min: 0.01, max: 0.045, step: 0.001, scale: 100, decimals: 1 },
  { key: 'RAMP_M', label: 'Anstieg bis', unit: 'm', min: 1000, max: 15000, step: 500 },
];
