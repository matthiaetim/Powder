// Alle Stellschrauben des Spiels an einem Ort.
// Einheiten: Meter, Sekunden, Grad. Tuning passiert nur hier.
export const VERSION = '0.1.0';

export const C = {
  // Sicht (Hochkant): sichtbare Breite/Höhe in Metern, Fahrer bei 33 % Bildhöhe
  VIEW_W_M: 40,
  VIEW_H_M: 86,
  SKIER_SCREEN_Y_FRAC: 0.33,
  MAX_DPR: 2,
  CAM_X_EASE_S: 0.15,

  // Loop
  STEP: 1 / 120,
  MAX_STEPS: 8,
  MAX_FRAME_MS: 100,

  // Eingabe
  TAP_MAX_MS: 180,
  TAP_MAX_MOVE_PX: 12,
  DOUBLE_TAP_MS: 260,
  DOUBLE_TAP_PX: 60,

  // Lenkung
  TAP_TURN_DEG: 14,
  BASE_MAX_DEG: 45,
  TAP_EASE_S: 0.08,
  HOLD_RATE_MIN_DEG_S: 40,
  HOLD_RATE_MAX_DEG_S: 120,
  HOLD_RAMP_MS: 700,
  CARVE_MAX_DEG: 55,
  MAX_HEADING_DEG: 75,
  CARVE_RELEASE_S: 0.5,
  HOLD_COMMIT_FRAC: 0.3,
  FALL_LINE_PULL_DEG_S: 0,

  // Tempo
  G_SLOPE: 4.5,
  DRAG_QUAD: 0.0057,
  EDGE_DRAG: 0.15,
  SCRUB_K: 0.15,

  // Sprung
  JUMP_AIR_S: 0.55,
  JUMP_COOLDOWN_S: 0.9,
  AIR_TURN_FACTOR: 0.2,
  LAND_SPEED_FACTOR: 0.97,
  JUMP_CLEARS_TREES: false,

  SKIER_R: 0.45,

  // Lawine
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
  TREE_D1: 0.030,
  RAMP_M: 3000,
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
  PARTICLE_POOL: 64,

  // Zustände
  READY_AUTO_START_MS: 1200,
  DEATH_OVERLAY_MS: 700,
  FRESH_GUARD_MS: 300,

  // HUD
  HUD_LOCALE: 'de-DE',

  // Farben
  BG: '#F4EFF3',
  INK: '#3A3340',
  INK_LIGHT: '#4A4252',
  ROCK: '#5A5262',
  ROCK_TOP: '#6A6273',
  TRACK: 'rgba(58,51,64,0.18)',
  AVALANCHE: [58, 51, 64],
};
