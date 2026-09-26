// Alle Stellschrauben des Spiels an einem Ort.
// Einheiten: Meter, Sekunden, Grad. Werte mit (Tuning) lassen sich im Spiel per Panel verstellen.
export const VERSION = '0.17.0';

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
  PLOW_SPREAD_M: 0.3,      // Schneepflug: so weit spreizt jedes Ski-Ende nach außen (Bild und Spur)
  BOARD_SLIP_DEG: 55,      // Snowboard (riders.js): so weit dreht beidseitiges Halten das Brett quer, statt Pflug
  PLOW_EASE_S: 0.12,       // Zeitkonstante, mit der die Ski in den Pflug gehen und zurück

  SKIER_R: 0.45,

  // Lawine (nur Chase): eine Front, die von oben nachrückt. Sie hält ein Tempo (Pace), das mit der Laufzeit
  // steigt: wer langsamer fährt, holt sie sich ins Bild, wer schneller ist, lässt sie AV_LURK_M über dem oberen
  // Bildrand lauern. Steht der Fahrer (unter AV_STALL_KMH für AV_STALL_S), kommt sie sofort an den Bildrand
  // und rollt mit Pace-Tempo auf ihn zu. Erwischt ist er, wenn die Front auf AV_CATCH_M heran ist.
  AV_PACE0_KMH: 30,          // (Tuning) Tempo der Lawine beim Start
  AV_PACE1_KMH: 145,         // (Tuning) Tempo am Ende des Anstiegs
  AV_RAMP_S: 90,             // (Tuning) Laufzeit in s, bis das Endtempo erreicht ist
  AV_LURK_M: 14,             // (Tuning) Lauerabstand über dem oberen Bildrand, solange der Fahrer schneller ist
  AV_FOLLOW_MS: 3,           // Nachrücken auf den Lauerabstand: so viel schneller als der Fahrer, in m/s
  AV_STALL_KMH: 40,          // (Tuning) darunter gilt der Fahrer als stehend
  AV_STALL_S: 0.8,           // (Tuning) so lange stehen, dann erscheint die Lawine am Bildrand
  AV_ENTER_M: 6,             // beim Erscheinen beginnt die Front so weit über dem Bildrand (die Schattenfahnen reichen 6 m vor)
  AV_CATCH_M: 0,             // (Tuning) Abstand, bei dem sie den Fahrer erwischt
  AV_START_GAP_M: 60,        // Abstand beim Start des Laufs
  AV_RUMBLE_PX: 0.5,         // (Tuning) Bildbeben in px, wenn sie nah ist
  // Schrägfahrt: die Front vergleicht ihren Pace nicht mit dem reinen Höhenverlust (Tempo × cos Winkel), sondern
  // mit Höhenverlust plus AV_DIAG_K des Rests bis zum vollen Tempo. Bei 1 zählt das Tempo entlang der Ski, wer
  // schneller als der Pace ist, ist also auch schräg sicher; bei 0 zählt nur der Höhenverlust (bis v0.11.1).
  // Gilt auch für die Stillstand-Schwelle. Kurven bremsen ohnehin über die Winkelbremse.
  AV_DIAG_K: 1,              // (Tuning) Anteil der Schrägfahrt, der als Tempo zählt
  // Gnade beim Schuss: fährt der Fahrer gerade bergab, spielt die Front nur den Anteil 1 - AV_MERCY_K ihres
  // Tempo-Vorsprungs aus. Bei 0 ist die Gnade aus und sie rollt immer mit vollem Pace (Verhalten bis v0.9.1);
  // bei 1 rollt sie beim Schuss AV_MERCY_KMH langsamer als er und fällt zurück (v0.10.0, zu leicht). Je stärker
  // die Kurve, desto weniger Gnade: voll bis AV_MERCY_DEG, keine ab AV_CURVE_DEG. Der Schneepflug zählt nicht als Schuss.
  AV_MERCY_K: 0,             // (Tuning) Stärke der Gnade, 0 = aus
  AV_MERCY_DEG: 25,          // (Tuning) bis zu diesem Fahrwinkel volle Gnade
  AV_CURVE_DEG: 60,          // (Tuning) ab diesem Fahrwinkel keine Gnade mehr
  AV_MERCY_KMH: 5,           // (Tuning) so viel langsamer als der Fahrer rollt sie beim Schuss
  AV_WHITEOUT_DELAY_S: 0.3,  // nach dem Erwischen: kurz die Front über dem Fahrer zeigen, dann Weiß

  // Ton (audio.js): Lautstärke gesamt und je Gruppe, 0..1. Fahrtwind und Schneezischen sind ab SND_SPEED_REF_KMH voll.
  SND_MASTER: 0.8,           // (Tuning) Lautstärke
  SND_WIND: 0.9,             // (Tuning) Bergwind und Fahrtwind
  SND_SKI: 0.85,             // (Tuning) Ski: Zischen, Kanten, Kratzen
  SND_AV: 0.5,               // (Tuning) Lawine
  SND_CRASH: 0.8,            // (Tuning) Aufprall
  SND_RACE: 0.7,             // (Tuning) Super-G: Countdown, Tore, Stangen, Ziel
  SND_SPEED_REF_KMH: 150,

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

  // Bestenliste (board.js): Firebase Realtime Database per REST ohne SDK. Leer = aus, die App läuft wie bisher.
  // Nur die Datenbank-URL ohne Pfad und Schluss-Slash, board.js hängt /boards.json an. Regeln: tools/firebase-rules.json,
  // Einrichtung: README. Die Namensgrenzen stehen in den Regeln noch einmal, beide Stellen zusammen ändern.
  BOARD_URL: 'https://powder-2d151-default-rtdb.europe-west1.firebasedatabase.app',
  BOARD_ROWS: 5,             // mehr passt auf dem iPhone SE nicht ohne Scrollen auf die Fresh-Seite
  BOARD_NAME_MIN: 2,
  BOARD_NAME_MAX: 12,        // länger sprengt die Zeile Rang | Name | Meter bei 16 px
  BOARD_MAX_M: 99999,        // Obergrenze der Regeln: darüber ist es kein Lauf mehr, sondern ein Skript
  BOARD_TIMEOUT_MS: 6000,    // hängender Abruf blockiert sonst das Nachholen; die Liste kommt dann aus dem Cache
  MARK_FRIEND_RGBA: 'rgba(20,20,15,0.35)', // Namenslinien fremder Bestweiten: blasse Tinte, die eigene bleibt rot
  BOARD_LABEL_GAP_PX: 22,    // Schilder sind 18 px hoch plus Schatten, sonst überlappen Weiten, die ~1 m auseinanderliegen

  // Farben: Polarweiß mit leichtem Blaustich, sattes Tannengrün mit braunem Stamm, Tinte wie --ink in styles.css
  // für Fahrer, Stangen und Schilder (Look nach dontlookup.app)
  BG: '#F5F9FD',
  BG_DIM: '#F4F3EF',         // Fresh-Seite: Papier-Schleier (styles.css, #ov-dead) über BG; färbt die iOS-Statusleiste mit
  INK: '#14140F',
  INK_LIGHT: '#2C2C25',
  BOARD_FILL: '#F4F3EF',     // Snowboard: Papier mit Tinte-Rand, damit sich das Brett vom Fahrer abhebt
  SLED_WOOD: '#9A6B45',      // Schlitten: Holz, etwas wärmer als TRUNK
  TREE: '#265A3A',
  TREE_LIGHT: '#357350',
  TRUNK: '#6B4F3B',
  ROCK: '#6A7580',
  ROCK_TOP: '#7E8994',
  SHADOW_RGB: '55,75,95',
  TRACK_RGB: '60,80,100',
  TRACK: 'rgba(60,80,100,0.16)',
  AVALANCHE: [46, 58, 69],
  // Super-G: Fähnchen der Tore abwechselnd rot und blau, gedeckt wie der Rest der Palette, mit hellerer Oberkante
  GATE_RED: '#C0342A',       // wie --slow in styles.css
  GATE_RED_LIGHT: '#D25A50',
  GATE_BLUE: '#3568B5',
  GATE_BLUE_LIGHT: '#5F8ACB',
  FINISH_RGBA: 'rgba(20,20,15,0.5)', // karierte Ziellinie

  // Markierungen im Schnee (render.js): alle MARK_M eine blaue Querlinie mit Meterzahl, der Bestwert des Modus
  // als rote Rekordlinie. Dünn in CSS-Pixeln, unabhängig vom Zoom; Spur, Bäume und Fahrer liegen darüber.
  MARK_M: 1000,
  MARK_PX: 1.5,
  MARK_RGBA: 'rgba(70,120,200,0.45)',
  MARK_BEST_RGBA: 'rgba(192,52,42,0.75)',

  // Signatur im Schnee (render.js/world.js): Credit bei SIGN_Y_M auf einem großen weißen Schild, zentriert auf der
  // Korridor-Mitte, in der Display-Schrift des HUD mit Tinte-Rand und hartem Versatz-Schatten wie die Buttons.
  // Das Schild liegt einmal gerendert in einem Offscreen-Canvas; fährt der Skifahrer darüber, radieren die
  // Ski es dort aus: der Credit ist zerkratzt und bleibt es bis zum nächsten Lauf. SIGN_BAND_M spannt
  // links und rechts der Mittellinie einen hindernisfreien Streifen auf (world.js).
  SIGN_TEXT: 'made by: DJ Tim Matthiä',
  SIGN_Y_M: 333,
  SIGN_WIDTH_FRAC: 0.86,     // (Tuning) Anteil von VIEW_W_M, den das Schild in der Breite füllt
  SIGN_BAND_M: 9,            // Hindernisfreier Streifen: SIGN_Y_M ± SIGN_BAND_M
  SIGN_ALPHA: 0.9,           // (Tuning) Deckkraft des Schilds; unter 1 scheint der Schnee leicht durch
  SIGN_PAD_M: 0.45,          // Innenrand der Platte um den Text
  SIGN_BORDER_M: 0.12,       // Tinte-Rand der Platte
  SIGN_SHADOW_M: 0.25,       // Versatz des harten Schattens nach unten-rechts
  SIGN_TILT_DEG: -1.5,       // leicht schief, wie die Zettel der Vorlage
  SIGN_ERASE_ALPHA: 0.6,     // (Tuning) Radierstärke je Überfahrt; unter 1 verwischt es, statt sauber auszuschneiden
  SIGN_ERASE_WIDTH_K: 1.5,   // Radierstrich als Vielfaches der Spurbreite
  SIGN_SPRAY_ALPHA: 0.2,     // breiter, schwacher zweiter Strich: der aufgewirbelte Schnee neben den Ski
  SIGN_SPRAY_W_M: 0.6,       // so viel breiter als der Radierstrich
  SIGN_MAX_PX: 2048,         // Deckel für die Breite des Offscreen-Canvas in Gerätepixeln

  // Super-G (nur superg; gates.js, game.js, render.js, hud.js): Zeitfahren bis SG_FINISH_M durch Tore, abwechselnd
  // rot und blau. Der Kurs ist fest (SG_SEED, ?seed= überschreibt), damit Bestzeiten vergleichbar bleiben. Tore
  // stehen ab SG_GATE_FIRST_M alle SG_GATE_SPACING_M abwechselnd links und rechts der Pistenmitte (Versatz
  // SG_GATE_OFFSET_M, davon zufällig 1 - SG_GATE_JITTER bis 1). Die Pistenmitte ist eine flache Sinuskurve
  // (SG_LANE_AMP_M, SG_LANE_WAVE_M): der Korridor der anderen Modi schwingt mit seiner 97-m-Komponente zu schnell,
  // mit Torversatz wären das Bögen über 45°. Die Piste ist SG_PISTE_HALF_M je Seite frei, außen stehen Bäume wie
  // in Classic (Aufprall beendet den Lauf ohne Zeit). Ein verpasstes Tor kostet SG_PENALTY_S, eine berührte Stange
  // SG_POLE_KMH Tempo, kein Sturz. Zwischenzeiten bei SG_SPLITS_M gegen die Bestzeit. Start mit Countdown
  // (SG_COUNT_BEEPS kurze Pieptöne im Abstand SG_COUNT_STEP_S, dann der lange = Go). Nach dem Ziel gleitet der
  // Fahrer aus (SG_COAST_DECEL zusätzlich zur Physik), dann kommt die Fresh-Seite.
  SG_FINISH_M: 1000,
  SG_SEED: 20260925,         // fester Kurs
  SG_GATE_FIRST_M: 50,
  SG_GATE_SPACING_M: 45,     // (Tuning) Abstand der Tore
  SG_GATE_WIDTH_M: 7.5,      // (Tuning) Durchfahrt zwischen den Stangen (am iPhone getunt, v0.16.2)
  SG_GATE_OFFSET_M: 10,      // (Tuning) Versatz der Tore zur Pistenmitte, abwechselnd links und rechts
  SG_GATE_JITTER: 0.5,       // zufälliger Anteil am Versatz: jedes Tor steht bei 50–100 % des vollen Versatzes
  SG_LAST_GATE_GAP_M: 30,    // so weit steht das letzte Tor mindestens vor dem Ziel
  SG_LANE_AMP_M: 8,          // Pistenmitte: Amplitude der Sinuskurve
  SG_LANE_WAVE_M: 400,       // Pistenmitte: Wellenlänge
  SG_PISTE_HALF_M: 17,       // (Tuning) freie Piste je Seite der Mitte, außerhalb Bäume und Felsen
  SG_PENALTY_S: 2,           // (Tuning) Zeitstrafe pro verpasstem Tor
  SG_POLE_KMH: 20,           // (Tuning) Tempoverlust beim Berühren einer Stange
  SG_MAX_SPEED_KMH: 240,     // (Tuning) Endtempo im Super-G, unabhängig von MAX_SPEED_KMH der anderen Modi
  SG_POLE_R: 0.12,           // Radius der Stange für die Berührung
  // Getroffene Stange (render.js): kippt um den Fußpunkt vom Fahrer weg, schwingt hin und her und klingt ab,
  // dabei biegt sie sich (Scherung, die Spitze wandert weiter als der Winkel allein)
  SG_POLE_WOBBLE_S: 1.1,     // so lange schwingt sie
  SG_POLE_WOBBLE_DEG: 60,    // erste Auslenkung
  SG_POLE_WOBBLE_HZ: 3.5,    // Schwingungen pro Sekunde
  SG_POLE_BEND: 0.5,         // Biegung je Bogenmaß Auslenkung, 0 = starre Stange
  SG_SPLITS_M: [250, 500, 750], // Zwischenzeiten
  SG_NOTE_S: 2,              // so lange stehen Zwischenzeit und Torfehler im HUD
  SG_COUNT_STEP_S: 0.6,      // Abstand der Pieptöne im Countdown
  SG_COUNT_BEEPS: 3,         // kurze Pieptöne vor dem Go
  SG_GO_SHOW_S: 0.6,         // so lange steht „Go“ im Bild
  SG_COAST_DECEL: 8,         // Auslauf nach dem Ziel: zusätzliche Verzögerung in m/s²
  SG_FINISH_OVERLAY_MS: 1200, // nach dem Ziel so lange Auslauf, dann die Fresh-Seite

  // Hockeystop deaktiviert (Tim und Jürgen wollen ihn nicht) — auskommentiert statt gelöscht, physics.js/
  // game.js/render.js haben die zugehörigen Blöcke ebenfalls auskommentiert.
  // HOCKEY_MIN_KMH: 70,        // (Tuning) ab diesem Tempo kann der Hockeystop auslösen
  // HOCKEY_HOLD_S: 0.45,       // (Tuning) so lange muss die Bremse dafür gehalten werden
  // HOCKEY_SNAP_T: 0.05,       // Ansprechzeit des Winkels beim Hockeystop (statt TURN_T)
  // HOCKEY_DECEL_T: 0.12,      // Zeitkonstante des Tempo-Abfalls beim Hockeystop
  // HOCKEY_DUR_S: 0.6,         // Sicherheitsdeckel: spätestens danach zurück zur normalen Physik
  // HOCKEY_FOG_OFFSET_PX: 100, // (Tuning) Größe (Breite und Höhe) des Nebelfelds unterhalb des Fahrers
  // HOCKEY_FOG_IN_S: 0.5,      // Einblendzeit
  // HOCKEY_FOG_HOLD_S: 1.0,    // so lange bleibt der Nebel voll stehen
  // HOCKEY_FOG_OUT_S: 0.5,     // Ausblendzeit
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
  // Hockeystop deaktiviert, siehe Kommentar bei den HOCKEY_*-Konstanten oben.
  // { heading: 'Hockeystop' },
  // { key: 'HOCKEY_MIN_KMH', label: 'Mindesttempo', unit: 'km/h', min: 20, max: 180, step: 5 },
  // { key: 'HOCKEY_HOLD_S', label: 'Haltezeit', unit: 's', min: 0.1, max: 1.5, step: 0.05 },
  // { key: 'HOCKEY_FOG_OFFSET_PX', label: 'Nebelgröße', unit: 'px', min: 0, max: 150, step: 5 },
  { heading: 'Lawine (Chase)' },
  { key: 'AV_PACE0_KMH', label: 'Tempo am Start', unit: 'km/h', min: 5, max: 120, step: 5 },
  { key: 'AV_PACE1_KMH', label: 'Tempo am Ende', unit: 'km/h', min: 20, max: 250, step: 5 },
  { key: 'AV_RAMP_S', label: 'Schneller bis Laufzeit', unit: 's', min: 30, max: 600, step: 10 },
  { key: 'AV_LURK_M', label: 'Lauert über dem Bild', unit: 'm', min: 0, max: 60, step: 2 },
  { key: 'AV_STALL_S', label: 'Kommt bei Stillstand nach', unit: 's', min: 0.3, max: 5, step: 0.1 },
  { key: 'AV_STALL_KMH', label: 'Stillstand unter', unit: 'km/h', min: 0, max: 80, step: 1 },
  { key: 'AV_CATCH_M', label: 'Erwischt ab Abstand', unit: 'm', min: 0, max: 6, step: 0.5 },
  { key: 'AV_RUMBLE_PX', label: 'Beben bei Nähe', unit: 'px', min: 0, max: 8, step: 0.5 },
  { key: 'AV_DIAG_K', label: 'Schräg zählt Tempo', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'AV_MERCY_K', label: 'Gnade beim Schuss', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'AV_MERCY_DEG', label: 'Gnade bis Winkel', unit: '°', min: 0, max: 60, step: 5 },
  { key: 'AV_CURVE_DEG', label: 'Volle Härte ab Winkel', unit: '°', min: 20, max: 95, step: 5 },
  { key: 'AV_MERCY_KMH', label: 'Schuss schüttelt ab', unit: 'km/h', min: 0, max: 30, step: 1 },
  { heading: 'Super-G' },
  { key: 'SG_GATE_SPACING_M', label: 'Torabstand', unit: 'm', min: 25, max: 80, step: 5 },
  { key: 'SG_GATE_WIDTH_M', label: 'Torbreite', unit: 'm', min: 4, max: 14, step: 0.5, decimals: 1 },
  { key: 'SG_GATE_OFFSET_M', label: 'Torversatz', unit: 'm', min: 0, max: 16, step: 1 },
  { key: 'SG_PISTE_HALF_M', label: 'Piste frei je Seite', unit: 'm', min: 12, max: 40, step: 1 },
  { key: 'SG_PENALTY_S', label: 'Zeitstrafe pro Tor', unit: 's', min: 0, max: 10, step: 0.5, decimals: 1 },
  { key: 'SG_POLE_KMH', label: 'Stange kostet', unit: 'km/h', min: 0, max: 30, step: 1 },
  { key: 'SG_MAX_SPEED_KMH', label: 'Endtempo', unit: 'km/h', min: 100, max: 300, step: 10 },
  { heading: 'Schriftzug' },
  { key: 'SIGN_ALPHA', label: 'Deckkraft', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'SIGN_WIDTH_FRAC', label: 'Breite', unit: '%', min: 0.4, max: 1, step: 0.02, scale: 100, decimals: 0 },
  { key: 'SIGN_ERASE_ALPHA', label: 'Verwischen beim Überfahren', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { heading: 'Ton' },
  { key: 'SND_MASTER', label: 'Lautstärke', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'SND_WIND', label: 'Wind', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'SND_SKI', label: 'Ski und Kurven', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'SND_AV', label: 'Lawine', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'SND_CRASH', label: 'Aufprall', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'SND_RACE', label: 'Super-G: Start und Tore', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
];
