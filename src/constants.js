// Alle Stellschrauben des Spiels an einem Ort.
// Einheiten: Meter, Sekunden, Grad. Werte mit (Tuning) lassen sich im Spiel per Panel verstellen.
export const VERSION = '0.8.0';

export const C = {
  // Sicht (Hochkant): sichtbare Breite in Metern (Höhe folgt aus dem Seitenverhältnis), Fahrer bei 33 % Bildhöhe.
  // Enger als anfangs, nach dem Original: Hindernisse wirken größer und stehen seltener im Bild.
  // Bei Tempo rückt der Fahrer nach oben und die Kamera zoomt leicht heraus: mehr Vorausschau.
  VIEW_W_M: 30,              // (Tuning) Sichtbreite
  VIEW_ASPECT: 2.15,         // nominale Höhe = Breite × Seitenverhältnis (iPhone-Hochkant)
  SKIER_SCREEN_Y_FRAC: 0.33,
  CAM_Y_FRAC_FAST: 0.25,     // Fahrerposition bei vollem Tempo
  CAM_ZOOM_FAST: 1.20,       // (Tuning) Herauszoomen bei vollem Tempo, 1 = aus
  CAM_SPEED_REF_KMH: 160,    // ab hier volle Vorausschau
  CAM_ZOOM_EASE_S: 0.6,      // Zeitkonstante von Zoom und Fahrerposition
  MAX_DPR: 2,
  CAM_X_EASE_S: 0.25,        // Kamera folgt seitlich mit etwas Verzug: der Fahrer schwingt im Bild

  // Loop: Teilschritte von höchstens STEP, die genau bis zur Bildzeit reichen (main.js). Längere Aussetzer
  // werden auf MAX_FRAME_MS gekappt, MAX_STEPS deckelt die Schritte pro Bild.
  STEP: 1 / 120,
  MAX_STEPS: 12,
  MAX_FRAME_MS: 100,

  // Lenkung (nach dem Original vermessen): der Kurs schwingt weich auf einen Zielwinkel ein,
  // ohne Knick. Antippen setzt das Ziel auf TURN_TAP_DEG, Halten vertieft es stetig,
  // Loslassen setzt das Ziel auf die Falllinie. Ansprechzeit = Zeitkonstante des Einschwingens
  // (kritisch gedämpft): nach 2× Ansprechzeit sind rund 60 % des Weges geschafft.
  TURN_TAP_DEG: 45,        // (Tuning) Zielwinkel beim Antippen
  TURN_DEEPEN_DEG_S: 70,   // (Tuning) Vertiefung des Zielwinkels pro Sekunde Halten
  TURN_T: 0.08,            // (Tuning) Ansprechzeit in s bis TURN_T_SPEED_LO_KMH
  TURN_T_FAST: 0.08,       // (Tuning) Ansprechzeit bei TURN_T_SPEED_HI_KMH; gleich TURN_T heißt: kein Unterschied bei Tempo
  TURN_T_SPEED_LO_KMH: 50,
  TURN_T_SPEED_HI_KMH: 200,
  RETURN_T: 0.08,          // (Tuning) Ansprechzeit der Rückkehr zur Falllinie in s
  MAX_HEADING_DEG: 95,     // (Tuning) über quer (90°) hinaus leicht bergauf

  // Tempo: der Start hat schon Fahrt, ohne Tippen wird man stetig schneller. Der Luftwiderstand
  // wächst quadratisch und hebt den Hangabtrieb beim Endtempo auf (weiche Annäherung statt Deckel).
  START_SPEED_KMH: 25,     // (Tuning) Anfahrt beim Start
  G_SLOPE: 5.25,           // (Tuning) Hangabtrieb in m/s²
  MAX_SPEED_KMH: 190,      // (Tuning) Endtempo im Freilauf

  // Bremsen, drei Anteile:
  // 1. Drehen: jede Kursänderung kostet etwas Tempo, Verzögerung = TURN_BRAKE_K × |Drehrate| × v.
  //    Schwach eingestellt, damit Zickzack flüssig bleibt und vor allem der Winkel bremst.
  // 2. Winkel (Hauptbremse): wächst ab BRAKE_START_DEG bis BRAKE_FULL_DEG, Verzögerung = Anteil × (BRAKE_MIN + BRAKE_K × v).
  //    Sanfter als früher, damit Halten den Fahrer erst weit zur Seite zieht und dann quer zum Stehen bringt.
  // 3. Schneepflug (beide Daumen): geradeaus bremsen, bei hohem Tempo schwächer als Querstellen.
  TURN_BRAKE_K: 0.006,     // (Tuning) Bremsen durch Drehen
  BRAKE_K: 1.8,            // (Tuning) Bremskraft pro m/s Tempo (Winkelbremse)
  BRAKE_MIN: 10,           // Grundbremsung in m/s², damit man wirklich zum Stehen kommt
  BRAKE_START_DEG: 25,     // (Tuning) darunter bremst der Winkel nicht
  BRAKE_FULL_DEG: 95,      // (Tuning) ab hier volle Winkelbremse
  PLOW_MIN: 12,            // (Tuning) Schneepflug-Verzögerung in m/s²
  PLOW_K: 0.05,            // Schneepflug wächst nur schwach mit dem Tempo

  SKIER_R: 0.45,

  // Lawine (nur Chase): eine Front, die von oben nachrückt. Sie hält ein Tempo (Pace), das mit der Laufzeit
  // steigt: wer langsamer fährt, holt sie sich ins Bild, wer schneller ist, lässt sie AV_LURK_M über dem oberen
  // Bildrand lauern. Steht der Fahrer (unter AV_STALL_KMH für AV_STALL_S), kommt sie sofort an den Bildrand
  // und rollt mit Pace-Tempo auf ihn zu. Erwischt ist er, wenn die Front auf AV_CATCH_M heran ist.
  AV_STYLE: 1,               // (Tuning) Look: 1 Wolke, 2 Schatten, 3 Bruch (siehe avalanche-view.js)
  AV_PACE0_KMH: 30,          // (Tuning) Tempo der Lawine beim Start
  AV_PACE1_KMH: 140,         // (Tuning) Tempo am Ende des Anstiegs
  AV_RAMP_S: 180,            // (Tuning) Laufzeit in s, bis das Endtempo erreicht ist
  AV_LURK_M: 10,             // (Tuning) Lauerabstand über dem oberen Bildrand, solange der Fahrer schneller ist
  AV_FOLLOW_MS: 3,           // Nachrücken auf den Lauerabstand: so viel schneller als der Fahrer, in m/s
  AV_STALL_KMH: 6,           // (Tuning) darunter gilt der Fahrer als stehend
  AV_STALL_S: 1.5,           // (Tuning) so lange stehen, dann erscheint die Lawine am Bildrand
  AV_ENTER_M: 6,             // beim Erscheinen beginnt die Front so weit über dem Bildrand (Staub und Brocken reichen 7 m vor)
  AV_CATCH_M: 1.0,           // (Tuning) Abstand, bei dem sie den Fahrer erwischt
  AV_START_GAP_M: 60,        // Abstand beim Start des Laufs
  AV_RUMBLE_PX: 2,           // (Tuning) Bildbeben in px, wenn sie nah ist
  AV_WHITEOUT_DELAY_S: 0.3,  // nach dem Erwischen: kurz die Front über dem Fahrer zeigen, dann Weiß

  // Welt
  CELL_M: 40,
  CULL_CELLS: 1,
  MIN_SPACING_M: 4.0,
  TREE_D0: 0.010,
  TREE_D1: 0.017,          // (Tuning) Dichte am Ende des Anstiegs
  RAMP_M: 10000,           // (Tuning) Dichte, Korridor und Felsanteil steigen über diese Strecke (Marathon)
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

  // Aufprall an Baum oder Fels: der Fahrer zerspringt in Pixel-Splitter (nur Bild, siehe render.js)
  SHATTER_PX: 2,           // Kantenlänge eines Splitters in CSS-Pixeln
  SHATTER_STEP_PX: 1.25,   // Rasterabstand beim Zerlegen: enger als die Splittergröße gibt mehr Splitter
  SHATTER_FREEZE_S: 0.06,  // kurzer Standbild-Moment vor dem Zerspringen
  SHATTER_SPEED: 7,        // Wurfgeschwindigkeit der Splitter in m/s (zufällig 30–100 %)
  SHATTER_DRAG: 2.6,       // Abbremsen im Schnee pro Sekunde
  SHATTER_LIFE_S: 1.6,     // so lange liegen die Splitter im Mittel, dann verblassen sie
  SHATTER_FADE_S: 0.5,
  SHAKE_PX: 5,             // Bildwackeln beim Aufprall
  SHAKE_S: 0.4,

  // Warnschnee (nur Chase): setzt ein, sobald die Lawine ihren Lauerabstand verlässt
  SNOW_POOL: 160,
  SNOW_MIN_SPEED: 140,
  SNOW_MAX_SPEED: 260,
  WHITEOUT_S: 0.5,

  // Zustände
  READY_AUTO_START_MS: 1200, // Intro beim App-Start: Kamerafahrt, dann los
  FRESH_START_MS: 500,       // nach Fresh: kurze Schonfrist, dann los
  DEATH_OVERLAY_MS: 700,
  FRESH_GUARD_MS: 300,

  // HUD
  HUD_LOCALE: 'de-DE',
  HUD_TEXT_MS: 50,           // Tempo und Distanz höchstens 20× pro Sekunde in den DOM schreiben (Layout kostet pro Bild)

  // Farben: Polarweiß mit leichtem Blaustich, sattes Tannengrün mit braunem Stamm, kühles Schiefergrau für Text und Fahrer
  BG: '#F5F9FD',
  BG_DIM: '#9BA3AA',         // Fresh-Seite: Abdunklung (styles.css, #ov-dead) über BG; färbt die iOS-Statusleiste mit
  INK: '#2E3A45',
  INK_LIGHT: '#3E4B57',
  TREE: '#265A3A',
  TREE_LIGHT: '#357350',
  TRUNK: '#6B4F3B',
  ROCK: '#6A7580',
  ROCK_TOP: '#7E8994',
  SHADOW_RGB: '55,75,95',
  TRACK_RGB: '60,80,100',
  TRACK: 'rgba(60,80,100,0.16)',
  AVALANCHE: [46, 58, 69],
};

// Regler im Tuning-Panel (langer Druck auf das Versions-Label). Einträge mit heading sind Zwischentitel,
// names zeigt statt der Zahl einen Namen (1 = erster Name).
export const TUNABLES = [
  { heading: 'Fahren' },
  { key: 'TURN_TAP_DEG', label: 'Tipp-Winkel', unit: '°', min: 10, max: 80, step: 5 },
  { key: 'TURN_DEEPEN_DEG_S', label: 'Vertiefen beim Halten', unit: '°/s', min: 0, max: 150, step: 5 },
  { key: 'TURN_T', label: 'Ansprechzeit', unit: 's', min: 0.05, max: 0.4, step: 0.01 },
  { key: 'TURN_T_FAST', label: 'Ansprechzeit bei 200 km/h', unit: 's', min: 0.05, max: 0.4, step: 0.01 },
  { key: 'RETURN_T', label: 'Rückkehr', unit: 's', min: 0.05, max: 0.6, step: 0.01 },
  { key: 'MAX_HEADING_DEG', label: 'Max. Winkel', unit: '°', min: 60, max: 150, step: 5 },
  { key: 'TURN_BRAKE_K', label: 'Bremsen durch Drehen', unit: '', min: 0, max: 0.06, step: 0.002, decimals: 3 },
  { key: 'BRAKE_K', label: 'Bremsen durch Winkel', unit: '', min: 0.2, max: 6, step: 0.1 },
  { key: 'BRAKE_START_DEG', label: 'Winkelbremse ab', unit: '°', min: 0, max: 60, step: 5 },
  { key: 'BRAKE_FULL_DEG', label: 'Winkelbremse voll ab', unit: '°', min: 30, max: 120, step: 5 },
  { key: 'PLOW_MIN', label: 'Schneepflug', unit: 'm/s²', min: 0, max: 30, step: 1 },
  { key: 'START_SPEED_KMH', label: 'Starttempo', unit: 'km/h', min: 0, max: 80, step: 5 },
  { key: 'G_SLOPE', label: 'Beschleunigung', unit: 'm/s²', min: 1, max: 10, step: 0.25 },
  { key: 'MAX_SPEED_KMH', label: 'Endtempo', unit: 'km/h', min: 60, max: 300, step: 10 },
  { key: 'CAM_ZOOM_FAST', label: 'Vorausschau bei Tempo', unit: '×', min: 1, max: 1.5, step: 0.05 },
  { key: 'VIEW_W_M', label: 'Sichtbreite', unit: 'm', min: 22, max: 48, step: 1 },
  { key: 'TREE_D1', label: 'Dichte am Ende', unit: '/100 m²', min: 0.01, max: 0.045, step: 0.001, scale: 100, decimals: 1 },
  { key: 'RAMP_M', label: 'Anstieg bis', unit: 'm', min: 1000, max: 15000, step: 500 },
  { heading: 'Lawine (Chase)' },
  { key: 'AV_STYLE', label: 'Look', unit: '', min: 1, max: 3, step: 1, names: ['Wolke', 'Schatten', 'Bruch'] },
  { key: 'AV_PACE0_KMH', label: 'Tempo am Start', unit: 'km/h', min: 5, max: 120, step: 5 },
  { key: 'AV_PACE1_KMH', label: 'Tempo am Ende', unit: 'km/h', min: 20, max: 250, step: 5 },
  { key: 'AV_RAMP_S', label: 'Schneller bis Laufzeit', unit: 's', min: 30, max: 600, step: 10 },
  { key: 'AV_LURK_M', label: 'Lauert über dem Bild', unit: 'm', min: 0, max: 60, step: 2 },
  { key: 'AV_STALL_S', label: 'Kommt bei Stillstand nach', unit: 's', min: 0.3, max: 5, step: 0.1 },
  { key: 'AV_STALL_KMH', label: 'Stillstand unter', unit: 'km/h', min: 0, max: 40, step: 1 },
  { key: 'AV_CATCH_M', label: 'Erwischt ab Abstand', unit: 'm', min: 0, max: 6, step: 0.5 },
  { key: 'AV_RUMBLE_PX', label: 'Beben bei Nähe', unit: 'px', min: 0, max: 8, step: 0.5 },
];
