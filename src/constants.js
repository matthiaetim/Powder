// Alle Stellschrauben des Spiels an einem Ort.
// Einheiten: Meter, Sekunden, Grad. Werte mit (Tuning) lassen sich im Spiel per Panel verstellen.
export const VERSION = '0.27.5';

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
  MAX_DPR: 2,                // (Tuning) Auflösung: Deckel für devicePixelRatio; 3 wäre am iPhone volle Schärfe bei mehr als
                             // doppelter Zeichenfläche, unter 2 wird das Bild weicher, aber schneller (Regler „Bild“)
  CAM_X_EASE_S: 0.25,        // Kamera folgt seitlich mit etwas Verzug: der Fahrer schwingt im Bild

  // Loop: Teilschritte von höchstens STEP, die genau bis zur Bildzeit reichen (main.js). Längere Aussetzer
  // werden auf MAX_FRAME_MS gekappt, MAX_STEPS deckelt die Schritte pro Bild.
  STEP: 1 / 120,
  MAX_STEPS: 12,
  MAX_FRAME_MS: 100,
  // Leerlauf: bewegt sich nichts im Bild (Fresh-Seite, Pause, Intro), zeichnet main.js nur noch mit IDLE_FPS statt
  // mit Bildrate; das spart Wärme und Akku, und ein warmes iPhone drosselt später weniger. Nach dem Sturz sind
  // Splitter (höchstens 2,7 s), Partikel und Whiteout nach DEAD_SETTLE_S durch, dann steht das Bild.
  IDLE_FPS: 10,
  DEAD_SETTLE_S: 3,

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

  // Lawine (nur im Modus Lawine): eine Front, die von oben nachrückt. Sie hält ein Tempo (Pace), das mit der Laufzeit
  // steigt: wer langsamer fährt, holt sie sich ins Bild, wer schneller ist, lässt sie AV_LURK_M über dem oberen
  // Bildrand lauern. Steht der Fahrer (unter AV_STALL_KMH für AV_STALL_S), kommt sie sofort an den Bildrand
  // und rollt mit Pace-Tempo auf ihn zu. Erwischt ist er, wenn die Front auf AV_CATCH_M heran ist.
  AV_PACE0_KMH: 30,          // (Tuning) Tempo der Lawine beim Start
  AV_PACE1_KMH: 145,         // (Tuning) Tempo am Ende des Anstiegs
  AV_RAMP_S: 90,             // (Tuning) Laufzeit in s, bis das Endtempo erreicht ist
  AV_LURK_M: 14,             // (Tuning) Lauerabstand über dem oberen Bildrand, solange der Fahrer schneller ist
  AV_FOLLOW_MS: 3,           // Nachrücken auf den Lauerabstand: so viel schneller als der Fahrer, in m/s
  AV_STALL_KMH: 40,          // (Tuning) darunter gilt der Fahrer als stehend
  AV_STALL_S: 0.3,           // (Tuning) so lange stehen, dann erscheint die Lawine am Bildrand
  AV_ENTER_M: 6,             // beim Erscheinen beginnt die Front so weit über dem Bildrand (der Staub stiebt 6 m vor)
  AV_CATCH_M: 0,             // (Tuning) Abstand, bei dem sie den Fahrer erwischt
  AV_START_GAP_M: 60,        // Abstand beim Start des Laufs
  // Startphase: damit man sieht, wovor man flieht, wartet die Front auf dem Startbildschirm AV_INTRO_OUT_M über dem
  // Bildrand, rollt beim Losfahren in AV_INTRO_ENTER_S herein (bremst dabei ab) und fährt dann AV_INTRO_IN_M im Bild
  // mit, bis der Fahrer AV_INTRO_M weit ist. Erwischen kann sie in dieser Zeit nicht. Danach gelten die Regeln oben,
  // und weil der Fahrer dann schneller ist als ihr Pace, rutscht sie von selbst aus dem Bild.
  AV_INTRO_M: 40,            // (Tuning) so weit fährt sie am Start sichtbar mit, 0 = aus (Verhalten bis v0.24.12)
  AV_INTRO_IN_M: 5,          // (Tuning) so weit ragt ihre Front dabei über den oberen Bildrand ins Bild
  AV_INTRO_ENTER_S: 1,       // (Tuning) so lange rollt sie beim Losfahren herein, 0 = steht sofort im Bild
  AV_INTRO_OUT_M: 8,         // Wartestellung über dem Bildrand: der Staub stiebt bis 7,5 m vor die Front
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
  AV_MERCY_K: 0.5,           // (Tuning) Stärke der Gnade, 0 = aus
  AV_MERCY_DEG: 25,          // (Tuning) bis zu diesem Fahrwinkel volle Gnade
  AV_CURVE_DEG: 65,          // (Tuning) ab diesem Fahrwinkel keine Gnade mehr
  AV_MERCY_KMH: 27,          // (Tuning) so viel langsamer als der Fahrer rollt sie beim Schuss
  AV_WHITEOUT_DELAY_S: 0.3,  // nach dem Erwischen: kurz die Front über dem Fahrer zeigen, dann Weiß

  // Ton (audio.js): Lautstärke gesamt und je Gruppe, 0..1. Fahrtwind und Schneezischen sind ab SND_SPEED_REF_KMH voll.
  SND_MASTER: 0.8,           // (Tuning) Lautstärke
  SND_WIND: 0.6,             // (Tuning) Bergwind und Fahrtwind
  SND_SKI: 0.8,              // (Tuning) Ski: Zischen, Kanten, Kratzen
  SND_AV: 0.5,               // (Tuning) Lawine
  SND_CRASH: 0.75,           // (Tuning) Aufprall
  SND_RACE: 0.65,            // (Tuning) Super-G: Countdown, Tore, Stangen, Ziel
  SND_SPEED_REF_KMH: 150,
  // App verlassen (audio.js): iOS hält die Seite beim Schließen an und spielt den letzten Rest im Ausgabepuffer kurz in
  // Schleife, das klingt verzerrt. Darum geht der Ausgang beim ersten Anzeichen fürs Verlassen schnell auf null, erst
  // danach wird der Ton angehalten; beim Zurückkommen blendet er weich wieder ein.
  SND_LEAVE_FADE_S: 0.02,    // Ausblenden: kurz genug, um vor dem Anhalten fertig zu sein, lang genug gegen Knacken
  SND_LEAVE_STOP_S: 0.12,    // danach wird der Ton angehalten
  SND_BACK_FADE_S: 0.3,      // Einblenden beim Zurückkommen

  // Welt
  CELL_M: 40,
  CULL_CELLS: 1,
  WORLD_CULL_M: 1,         // Reserve in m, wenn render.js die Welt aufs Bild beschneidet (Rundung, Schattenrand)
  CELL_RAW_EXTRA: 1.15,    // rohe Kandidaten je Zelle über Soll: an den Zellgrenzen fallen Konflikte mit Vorrang-Nachbarn weg (world.js)
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
  // Startlinie (world.js): wer nach dem Start einfach geradeaus beschleunigt, darf auf den ersten START_LINE_M nichts
  // treffen. Gestrichen wird nur, was die Linie x = 0 bis auf START_LINE_HALF_M an die Hindernismitte plus Radius
  // berührt, also nur echte Treffer mit einem halben Meter Luft; eine sichtbare Schneise soll es nicht geben.
  // Nicht im Super-G, dort sind Piste und Kurs fest.
  START_LINE_M: 50,
  START_LINE_HALF_M: 1.0,
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

  // Warnschnee (nur im Modus Lawine): setzt ein, sobald die Lawine ihren Lauerabstand verlässt
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
  // Plausibilität (Regeln und sanitizeBoards): ein Lauf ist nie schneller als dieser Schnitt. Classic und Lawine
  // starten mit START_SPEED_KMH und kurven um Bäume, echte Bestwerte liegen bei 70 bis 105 km/h. Im Super-G geht es
  // steil bergab (echt bis 144 km/h), dort gilt fast das Endtempo. Die Regeln tragen die Werte in m/s und s.
  BOARD_MAX_AVG_KMH: 150,
  BOARD_SG_MAX_AVG_KMH: 185,

  // Anmeldung (auth.js): anonymes Firebase-Konto je Gerät per REST ohne SDK. Die uid steht in jedem Eintrag und jedem
  // Duell-Platz, die Regeln lassen nur ihren Besitzer schreiben. AUTH_KEY ist der Web-API-Schlüssel des Projekts
  // (Firebase-Konsole, Projekteinstellungen); er ist öffentlich und kein Geheimnis. Leer = ohne Anmeldung, dann lehnen
  // die neuen Regeln jedes Schreiben ab.
  AUTH_KEY: 'AIzaSyBCnhy5JU77IGhwnn98tr8QUdHxj_C5nLg',
  AUTH_PREFIX: 'https://',   // vor identitytoolkit.googleapis.com/…; Emulator und Mock setzen ihren Host davor
  AUTH_EARLY_S: 300,         // Token (1 h gültig) so lange vor Ablauf erneuern, damit kein Aufruf mit altem Token läuft
  MARK_FRIEND_RGBA: 'rgba(20,20,15,0.35)', // Namenslinien fremder Bestweiten: blasse Tinte, die eigene bleibt rot
  BOARD_MARKS_N: 5,          // Namenslinien im Schnee: je so viele Weiten hinter und vor dem eigenen Rekord (game.js runMarksFor)
  BOARD_MARKS_GAP_M: 150,    // Mindestabstand zwischen zwei Namenslinien, sonst kleben die Ziele aufeinander
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
  // Lawine im Bild (avalanche-view.js): eine weiße Staubwolke, Licht von oben links wie beim Relief der Bäume.
  // AV_LIT_RGB ist der Übergang vom Glanz zur Schattenseite eines Wulstes, AV_SHADE_RGB färbt Schattenseiten, die
  // Rinnen zwischen den Wülsten und den Bodenschatten vor der Front. AV_CORE_RGB ist das Wolkeninnere, das zwischen
  // den Wülsten durchscheint, AV_FAR_RGB dasselbe weit hinten am oberen Bildrand (ferner Dunst, heller). AV_HAZE_RGB
  // ist der Pulverschnee in der Luft: bei Nähe (threat 1) liegt er mit AV_HAZE_ALPHA über dem ganzen Bild.
  AV_LIT_RGB: '228,237,245',
  AV_SHADE_RGB: '118,142,166',
  AV_CORE_RGB: '196,210,223',
  AV_FAR_RGB: '222,231,239',
  AV_HAZE_RGB: '168,186,204',
  AV_HAZE_ALPHA: 0.22,
  // Super-G: Fähnchen der Tore abwechselnd rot und blau, gedeckt wie der Rest der Palette, mit hellerer Oberkante
  GATE_RED: '#C0342A',       // wie --slow in styles.css
  GATE_RED_LIGHT: '#D25A50',
  GATE_BLUE: '#3568B5',
  GATE_BLUE_LIGHT: '#5F8ACB',
  FINISH_RGBA: 'rgba(20,20,15,0.5)', // karierte Ziellinie

  // Markierungen im Schnee (render.js): alle MARK_M eine blaue Querlinie mit Meterzahl, der Bestwert des Modus
  // als rote Rekordlinie. Alle Linien (Meter, Rekord, Super-G-Start, Namen der Bestenliste) sind wie mit der
  // Spraydose auf den Schnee gesprüht: ein MARK_SPRAY_PX breites, gerades Band aus Farbpunkten, nie ganz deckend und
  // fest im Schnee wie die Bäume. In CSS-Pixeln, unabhängig vom Zoom; Spur, Bäume und Fahrer liegen darüber.
  MARK_M: 1000,
  MARK_SPRAY_PX: 4,          // (Tuning) Breite des Sprühbands
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
  SIGN_ALPHA: 0.8,           // (Tuning) Deckkraft des Schilds; unter 1 scheint der Schnee leicht durch
  SIGN_PAD_M: 0.45,          // Innenrand der Platte um den Text
  SIGN_BORDER_M: 0.12,       // Tinte-Rand der Platte
  SIGN_SHADOW_M: 0.25,       // Versatz des harten Schattens nach unten-rechts
  SIGN_TILT_DEG: -1.5,       // leicht schief, wie die Zettel der Vorlage
  SIGN_ERASE_ALPHA: 0.6,     // (Tuning) Radierstärke je Überfahrt; unter 1 verwischt es, statt sauber auszuschneiden
  SIGN_ERASE_WIDTH_K: 1.5,   // Radierstrich als Vielfaches der Spurbreite
  SIGN_SPRAY_ALPHA: 0.2,     // breiter, schwacher zweiter Strich: der aufgewirbelte Schnee neben den Ski
  SIGN_SPRAY_W_M: 0.6,       // so viel breiter als der Radierstrich
  SIGN_MAX_PX: 2048,         // Deckel für die Breite des Offscreen-Canvas in Gerätepixeln
  SIGN_BUILD_AHEAD_M: 150,   // Schilder weit unten (Everest) erst bauen, wenn der Fahrer so nah ist; weiter als die Sicht

  // Tuning-Panel (tune.js): so lange zeigt der Kopier-Knopf „Kopiert“, bevor er wieder normal heißt
  TUNE_COPY_NOTE_S: 1.5,

  // Easter Egg (Classic): Gipfelschild bei der Höhe des Mount Everest, gleiche Machart wie der Credit (render.js),
  // mit Gipfelkreuz; beim Überfahren zeigt das HUD kurz „Everest“ statt der Meter, dazu ein kleiner Dreiklang.
  EVEREST_Y_M: 8848,
  EVEREST_WIDTH_FRAC: 0.7,   // kleiner als der Credit, der Text ist kürzer und wäre sonst riesig
  EVEREST_HUD_S: 2.5,

  // Easter Egg (Classic, yeti.js): Yeti-Spuren. Bewusst ohne Regler und ohne Anzeige im Debug-Overlay, der Zufall
  // soll auch für die Entwickler eine Überraschung bleiben.
  YETI_EVERY_MIN: 2,         // frühestens jeder 2. Classic-Lauf …
  YETI_EVERY_MAX: 3,         // … spätestens jeder 3.
  YETI_Y_MIN: 1000,          // Spanne, in der die Spur liegt; weit, damit sie Fahrer jeder Weite treffen kann,
  YETI_Y_MAX: 10000,         // frühe Stellen sind wahrscheinlicher (createYeti)
  YETI_EARLY: 3,             // so viele Zufallszahlen, von denen die kleinste den Beginn setzt; mehr = früher
  YETI_LEN_MIN_M: 50,        // Länge der Spur entlang des Wegs
  YETI_LEN_MAX_M: 75,
  YETI_STRIDE_M: 1.8,        // Abstand zweier Abdrücke, größer als ein Mensch
  YETI_GAIT_M: 0.4,          // seitlicher Versatz jedes Fußes von der Laufmitte
  YETI_FOOT_L_M: 0.8,        // Abdruck: Länge und Breite ohne Zehen
  YETI_FOOT_W_M: 0.4,
  YETI_ALPHA: 0.32,          // Deckkraft eines frischen Abdrucks, etwa wie eine kräftige Skispur
  YETI_WIPE_PER_M: 0.6,      // Verwischen je Meter Fahrt über einem Abdruck; eine Überfahrt ist rund 1 m, wie SIGN_ERASE_ALPHA

  // Super-G (nur superg; gates.js, game.js, render.js, hud.js): Zeitfahren bis SG_FINISH_M durch Tore, abwechselnd
  // rot und blau. Der Kurs ist fest (SG_SEED, ?seed= überschreibt), damit Bestzeiten vergleichbar bleiben. Tore
  // stehen ab SG_GATE_FIRST_M alle SG_GATE_SPACING_M abwechselnd links und rechts der Pistenmitte (Versatz
  // SG_GATE_OFFSET_M, davon zufällig 1 - SG_GATE_JITTER bis 1). Die Pistenmitte ist eine flache Sinuskurve
  // (SG_LANE_AMP_M, SG_LANE_WAVE_M): der Korridor der anderen Modi schwingt mit seiner 97-m-Komponente zu schnell,
  // mit Torversatz wären das Bögen über 45°. Die Piste ist SG_PISTE_HALF_M je Seite frei, außen stehen Bäume wie
  // in Classic (Aufprall beendet den Lauf ohne Zeit). Ein verpasstes Tor kostet SG_PENALTY_S, eine berührte Stange
  // SG_POLE_KMH Tempo, kein Sturz. Zwischenzeiten an jedem SG_SPLIT_EVERY-ten Tor (SG_SPLIT_*) gegen den besten Lauf. Start mit Countdown
  // (SG_COUNT_BEEPS kurze Pieptöne im Abstand SG_COUNT_STEP_S, dann der lange = Go). Nach dem Ziel macht der
  // Fahrer einen Hockeystop (STOP_*), dann kommt die Fresh-Seite.
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
  SG_FLAG_W_M: 0.9,          // Breite des Fähnchens; an seinem äußeren Ende steht die zweite Stange des Panels
  // Getroffene Stange (render.js): kippt um den Fußpunkt vom Fahrer weg, schwingt hin und her und klingt ab,
  // dabei biegt sie sich (Scherung, die Spitze wandert weiter als der Winkel allein)
  SG_POLE_WOBBLE_S: 1.1,     // so lange schwingt sie
  SG_POLE_WOBBLE_DEG: 60,    // erste Auslenkung
  SG_POLE_WOBBLE_HZ: 3.5,    // Schwingungen pro Sekunde
  SG_POLE_BEND: 0.5,         // Biegung je Bogenmaß Auslenkung, 0 = starre Stange
  // Zwischenzeiten beim Durchfahren eines Tors: ab Tor SG_SPLIT_FIRST (gezählt ab 1) jedes SG_SPLIT_EVERY-te, die
  // letzten SG_SPLIT_FREE_LAST Tore ohne. Bei 21 Toren sind das Tor 2, 5, 8, 11, 14 und 17.
  SG_SPLIT_FIRST: 2,
  SG_SPLIT_EVERY: 3,
  SG_SPLIT_FREE_LAST: 2,
  SG_NOTE_S: 2,              // so lange stehen Zwischenzeit und Torfehler im HUD
  SG_COUNT_STEP_S: 1,        // Abstand der Pieptöne im Countdown: echte Sekunden, 3 – 2 – 1 – Go dauert 3 s
  SG_COUNT_BEEPS: 3,         // kurze Pieptöne vor dem Go
  SG_GO_SHOW_S: 0.6,         // so lange steht „Go“ im Bild

  // Markierung an den Innenstangen (gate-marks.js): gesprühter ovaler Bogen, Scheitel an der Stange, Winkel wie auf
  // dem Kompass (0° bergauf, 90° Scheitel zur Toröffnung, 180° talwärts). An den Zwischenzeit-Toren dazu Fleck und
  // Linie zur Außenstange. Alles bleibt blau, die Zwischenzeit ändert daran nichts (ab v0.24.11, vorher leuchtete es
  // grün oder rot auf).
  GM_RGB: '58,210,252',      // #3ad2fc
  GM_ARC_FROM_DEG: 17,       // Bogen beginnt bergauf …
  GM_ARC_TO_DEG: 172,        // … und läuft talwärts aus
  GM_ARC_W_M: 2.5,           // halbe Breite des Ovals (Scheitel bis Mitte)
  GM_ARC_OVAL: 2.0,          // Höhe zu Breite
  GM_SPRAY_PX: 9,            // Strichbreite des Bogens
  GM_ARC_ALPHA: 0.75,        // Deckkraft des Bogens: blasser als Fleck und Linie, die das Zeit-Tor zeigen
  GM_DOT_PX: 16,             // Fleck an der Stange (Zwischenzeit-Tor)
  GM_LINE_PX: 8,             // Linie zur Außenstange (Zwischenzeit-Tor)
  SG_FINISH_OVERLAY_MS: 2200, // nach dem Ziel so lange Hockeystop und Wolke, dann die Fresh-Seite (Tipp springt hin)

  // Hockeystop nach dem Ziel (Super-G und Duell; hockey.js, hockey-view.js, game.js coast): der Fahrer reißt die Ski
  // quer zu der Seite, zu der er lehnt (Zeitkonstante STOP_TURN_S), rutscht in der alten Fahrtrichtung weiter und
  // bremst mit STOP_DECEL_MIN + STOP_DECEL_K · v bis zum Stand (bei 110 km/h rund 0,9 s). Aus der Kante stiebt eine
  // Wolke aus Lawinen-Wülsten talwärts, je größer, je schneller er ins Ziel kam (voll bei STOP_REF_KMH).
  STOP_TURN_S: 0.07,
  STOP_DECEL_MIN: 15,        // m/s², damit er auch aus wenig Tempo sichtbar abrupt steht
  STOP_DECEL_K: 2,           // 1/s, der Anteil, der mit dem Tempo wächst
  STOP_REF_KMH: 110,
  STOP_CLOUD_S: 3,           // so lange bewegt sich die Wolke, danach zeichnet main.js im Leerlauf

  // Duell (duel.js, room.js, duel-card.js, render.js, hud.js): zwei Geräte fahren dieselbe Welt (Seed aus dem Raum),
  // gewertet wird die eigene Wanduhr-Zeit ab dem gemeinsamen Go bis zur Zielweite; die Netzlaufzeit spielt so keine
  // Rolle. Die Räume liegen in derselben Firebase-Datenbank wie die Bestenliste (BOARD_URL, Pfad /rooms/CODE), die
  // Regeln in tools/firebase-rules.json nennen dieselben Grenzen: beide Stellen zusammen ändern.
  DUEL_TARGET_MIN_M: 1000,
  DUEL_TARGET_MAX_M: 10000,
  DUEL_TARGET_STEP_M: 500,
  DUEL_TARGET_DEFAULT_M: 1000,
  DUEL_CRASH_PAUSE_S: 1,       // (Tuning) Sturzpause: so lange liegt der Fahrer, dann geht es neben dem Hindernis weiter; im Duell gilt der Wert des Hosts
  DUEL_RESPAWN_GRACE_S: 2.5,   // (Tuning) Schonfrist: nach der Weiterfahrt fährt der Fahrer so lange durch Hindernisse, sonst folgt oft gleich der
                               // nächste Sturz; gilt je Gerät und auch für den Bot. Steckt er am Ende noch in einem Hindernis, hält sie, bis er frei ist
  DUEL_GRACE_BLINK_HZ: 5,      // so oft je Sekunde blinkt der Fahrer in der Schonfrist
  DUEL_GRACE_WARN_S: 0.5,      // in dieser letzten Spanne der Schonfrist blinkt er doppelt so schnell: der Schutz endet gleich
  DUEL_GRACE_DIM_ALPHA: 0.25,  // Deckkraft im blassen Takt des Blinkens
  DUEL_RESPAWN_CLEAR_M: 0.3,   // Abstand zum Hindernis beim Weiterfahren, zusätzlich zu beiden Radien
  DUEL_GHOST_DELAY_S: 0,       // (Tuning) Geist-Verzögerung: der Gegner wird bei der eigenen Rennzeit minus dieser Spanne gezeigt, dann sind seine Proben da
  DUEL_GHOST_EXTRAP_S: 1,      // fehlen Proben, wird der Geist so lange mit seinem Tempo fortgeschrieben, dann bleibt er stehen
  DUEL_GHOST_ALPHA: 0.45,      // Deckkraft des Geists
  DUEL_SEND_MS: 200,           // Sende-Takt der eigenen Position (5 Hz)
  DUEL_HEARTBEAT_MS: 10000,    // Lebenszeichen in Lobby und Ergebnis
  DUEL_COUNT_LEAD_MS: 3500,    // Vorlauf vom „Los“ des Hosts bis zum Go: deckt den Countdown (1,8 s) und die Netzlaufzeit
  DUEL_STALE_S: 4,             // so lange ohne Probe des Gegners: Geist blass, Schild mit „…“
  DUEL_GONE_S: 30,             // so lange ohne Lebenszeichen im Rennen: der Gegner gilt als weg, der andere gewinnt
  DUEL_LOBBY_GONE_S: 60,       // in der Lobby: so lange ohne Lebenszeichen, dann ist der Platz wieder frei
  DUEL_STREAM_HEALTH_S: 45,    // der eigene Stream gilt als gesund, wenn in dieser Spanne ein Ereignis oder keep-alive kam
  DUEL_ROOM_TTL_MS: 7200000,   // Raum so lange ohne Statuswechsel: gilt als verlassen und darf überschrieben werden (wie die Regeln)
  DUEL_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ', // ohne I und O, die verwechselt man mit 1 und 0 (Regeln: [A-HJ-NP-Z])
  DUEL_CODE_LEN: 4,
  DUEL_EDGE_PAD_PX: 10,        // Abstand des Randschilds („Jo +37 m“) vom Bildrand
  DUEL_HUD_CLEAR_PX: 175,      // so viel Platz lässt das untere Randschild rechts für das HUD frei

  // Bot-Gegner im Duell (bot.js, bot-room.js, duel.js): fährt auf dem eigenen Gerät mit derselben Physik durch
  // dieselbe Welt, ohne Netz. Sechs Stufen, je Stufe:
  //   kmh     Wunschtempo: darüber bremst er durch Schwünge
  //   lookS   Vorausschau in s: so weit rechnet er seine Eingaben voraus
  //   thinkS  Reaktionszeit in s: so oft entscheidet er neu
  //   tapS    Tipp-Takt in s: schneller wechselt er die Eingabe nicht
  //   margin  Sicherheitsabstand in m, den er zu Hindernissen halten will
  //   lane    Bindung an den freien Korridor (Kosten je m Abstand): hoch = bleibt auf der sicheren Linie
  //   miss    Anteil der Hindernisse, die er erst BOT_LATE_S davor sieht: daraus entstehen seine Stürze
  BOT_LEVELS: [
    { name: 'Anfänger', kmh: 72, lookS: 1.2, thinkS: 0.3, tapS: 0.14, margin: 1.6, lane: 0.6, miss: 0.04 },
    { name: 'Hobby', kmh: 86, lookS: 1.3, thinkS: 0.22, tapS: 0.12, margin: 1.4, lane: 0.4, miss: 0.03 },
    { name: 'Fortgeschritten', kmh: 102, lookS: 1.4, thinkS: 0.16, tapS: 0.1, margin: 1.2, lane: 0.25, miss: 0.024 },
    { name: 'Profi', kmh: 122, lookS: 1.5, thinkS: 0.12, tapS: 0.08, margin: 1.0, lane: 0.15, miss: 0.016 },
    { name: 'Weltcup', kmh: 144, lookS: 1.6, thinkS: 0.08, tapS: 0.06, margin: 0.8, lane: 0.1, miss: 0.008 },
    { name: 'Legende', kmh: 160, lookS: 1.8, thinkS: 0.05, tapS: 0.05, margin: 0.6, lane: 0.08, miss: 0 },
  ],
  BOT_LEVEL_DEFAULT: 3,
  BOT_HEAD_DEG: [5, 10, 16, 24, 34, 48, 70], // Fahrwinkel, die er je Seite durchprobiert …
  BOT_HOLDS_S: [0.2, 0.45, 0.9, 2],          // … und wie lange er sie hält, bevor es zurück in die Falllinie geht
  BOT_DEAD_RAD: 0.03,          // so genau hält er den Fahrwinkel (knapp 2°), darunter ändert er die Eingabe nicht
  BOT_SOFT_RAD: 0.25,          // bis zu diesem Abstand (rund 14°) lässt er zum Aufrichten nur los, darüber lenkt er gegen
  BOT_LATE_S: 0.12,            // ein übersehenes Hindernis fällt ihm erst so kurz davor auf, meist zu spät …
  BOT_LATE_MIN_M: 2,           // … spätestens aber in diesem Abstand
  BOT_REACH_PAD_M: 6,          // so viel weiter als die Vorausschau sammelt er Hindernisse ein
  BOT_HIT_PAD_M: 0.1,          // so knapp vorbei zählt in der Vorausrechnung schon als Aufprall
  BOT_PASS_M: 4,               // Hindernisse weiter als das vor oder hinter ihm prüft ein Schritt der Vorausrechnung nicht
  BOT_W_HIT: 1000,             // Kosten eines Aufpralls in der Vorausrechnung, in Metern Strecke
  BOT_W_NEAR: 60,              // Kosten je s dicht am Hindernis (innerhalb margin)
  BOT_W_SPEED: 0.6,            // Kosten je s und (m/s)² über dem Wunschtempo
  BOT_W_HEAD: 2,               // Kosten je rad Schräglage am Ende der Vorausschau
  BOT_W_KEEP: 0.3,             // Bonus für den laufenden Plan, gegen Flattern
  BOT_VIEW_SIDE_M: 60,         // Welt des Bots: so weit um ihn herum entstehen Zellen
  BOT_VIEW_BACK_M: 6,
  BOT_VIEW_AHEAD_M: 130,
  BOT_SIDE_MIN_M: 8,           // Blickfeld: Hindernisse seitlich bis hierhin …
  BOT_SIDE_K: 0.6,             // … plus so viel je m voraus zählen zur Vorausrechnung
  BOT_MAX_STEPS: 600,          // höchstens so viele Schritte je Bild nachholen (5 s), etwa nach dem Hintergrund

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

// Regler im Tuning-Panel (langer Druck auf das Versions-Label). Einträge mit heading beginnen eine aufklappbare
// Gruppe, tone wählt deren Farbe (styles.css, .tune-group[data-tone]). names zeigt statt der Zahl einen Namen (1 = erster Name). visual: der Regler ändert nur das Bild, nicht das Spiel,
// und macht Läufe deshalb nicht ungültig für die Bestenliste (tune.js isTuned, hud.js). fair: im Duell steht der Regler
// auf Standard (tune.js), weil er Welt, Sicht oder Fahrphysik ändert und beide Geräte dieselbe Strecke gleich schnell
// fahren müssen. user: der Regler steht auch in den Einstellungen für jeden Spieler (hud.js, Ton), zählt nie als
// Tuning und wird eigens gespeichert, damit ein neuer KEY in tune.js die Wahl des Spielers nicht verwirft.
export const TUNABLES = [
  { heading: 'Fahren', tone: 'blue' },
  { key: 'TURN_TAP_DEG', label: 'Tipp-Winkel', unit: '°', min: 10, max: 80, step: 5, fair: true },
  { key: 'TURN_DEEPEN_DEG_S', label: 'Vertiefen beim Halten', unit: '°/s', min: 0, max: 150, step: 5, fair: true },
  { key: 'TURN_T', label: 'Ansprechzeit', unit: 's', min: 0.05, max: 0.4, step: 0.01, fair: true },
  { key: 'TURN_T_FAST', label: 'Ansprechzeit bei 200 km/h', unit: 's', min: 0.05, max: 0.4, step: 0.01, fair: true },
  { key: 'RETURN_T', label: 'Rückkehr', unit: 's', min: 0.05, max: 0.6, step: 0.01, fair: true },
  { key: 'MAX_HEADING_DEG', label: 'Max. Winkel', unit: '°', min: 60, max: 150, step: 5, fair: true },
  { key: 'TURN_BRAKE_K', label: 'Bremsen durch Drehen', unit: '', min: 0, max: 0.06, step: 0.002, decimals: 3, fair: true },
  { key: 'BRAKE_K', label: 'Bremsen durch Winkel', unit: '', min: 0.2, max: 6, step: 0.1, fair: true },
  { key: 'BRAKE_START_DEG', label: 'Winkelbremse ab', unit: '°', min: 0, max: 60, step: 5, fair: true },
  { key: 'BRAKE_FULL_DEG', label: 'Winkelbremse voll ab', unit: '°', min: 30, max: 120, step: 5, fair: true },
  { key: 'PLOW_MIN', label: 'Schneepflug', unit: 'm/s²', min: 0, max: 30, step: 1, fair: true },
  { key: 'START_SPEED_KMH', label: 'Starttempo', unit: 'km/h', min: 0, max: 80, step: 5, fair: true },
  { key: 'G_SLOPE', label: 'Beschleunigung', unit: 'm/s²', min: 1, max: 10, step: 0.25, fair: true },
  { key: 'MAX_SPEED_KMH', label: 'Endtempo', unit: 'km/h', min: 60, max: 300, step: 10, fair: true },
  { key: 'CAM_ZOOM_FAST', label: 'Vorausschau bei Tempo', unit: '×', min: 1, max: 1.5, step: 0.05, fair: true },
  { key: 'VIEW_W_M', label: 'Sichtbreite', unit: 'm', min: 22, max: 48, step: 1, fair: true },
  { key: 'TREE_D1', label: 'Dichte am Ende', unit: '/100 m²', min: 0.01, max: 0.045, step: 0.001, scale: 100, decimals: 1, fair: true },
  { key: 'RAMP_M', label: 'Anstieg bis', unit: 'm', min: 1000, max: 15000, step: 500, fair: true },
  // Hockeystop deaktiviert, siehe Kommentar bei den HOCKEY_*-Konstanten oben.
  // { heading: 'Hockeystop' },
  // { key: 'HOCKEY_MIN_KMH', label: 'Mindesttempo', unit: 'km/h', min: 20, max: 180, step: 5 },
  // { key: 'HOCKEY_HOLD_S', label: 'Haltezeit', unit: 's', min: 0.1, max: 1.5, step: 0.05 },
  // { key: 'HOCKEY_FOG_OFFSET_PX', label: 'Nebelgröße', unit: 'px', min: 0, max: 150, step: 5 },
  { heading: 'Lawine', tone: 'red' },
  { key: 'AV_PACE0_KMH', label: 'Tempo am Start', unit: 'km/h', min: 5, max: 120, step: 5 },
  { key: 'AV_PACE1_KMH', label: 'Tempo am Ende', unit: 'km/h', min: 20, max: 250, step: 5 },
  { key: 'AV_RAMP_S', label: 'Schneller bis Laufzeit', unit: 's', min: 30, max: 600, step: 10 },
  { key: 'AV_LURK_M', label: 'Lauert über dem Bild', unit: 'm', min: 0, max: 60, step: 2 },
  { key: 'AV_STALL_S', label: 'Kommt bei Stillstand nach', unit: 's', min: 0.3, max: 5, step: 0.1 },
  { key: 'AV_STALL_KMH', label: 'Stillstand unter', unit: 'km/h', min: 0, max: 80, step: 1 },
  { key: 'AV_INTRO_M', label: 'Im Bild beim Start für', unit: 'm', min: 0, max: 100, step: 5 },
  { key: 'AV_INTRO_IN_M', label: 'Ragt beim Start ins Bild', unit: 'm', min: 0, max: 15, step: 1 },
  { key: 'AV_INTRO_ENTER_S', label: 'Rollt beim Start herein in', unit: 's', min: 0, max: 3, step: 0.1 },
  { key: 'AV_CATCH_M', label: 'Erwischt ab Abstand', unit: 'm', min: 0, max: 6, step: 0.5 },
  { key: 'AV_RUMBLE_PX', label: 'Beben bei Nähe', unit: 'px', min: 0, max: 8, step: 0.5 },
  { key: 'AV_DIAG_K', label: 'Schräg zählt Tempo', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'AV_MERCY_K', label: 'Gnade beim Schuss', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'AV_MERCY_DEG', label: 'Gnade bis Winkel', unit: '°', min: 0, max: 60, step: 5 },
  { key: 'AV_CURVE_DEG', label: 'Volle Härte ab Winkel', unit: '°', min: 20, max: 95, step: 5 },
  { key: 'AV_MERCY_KMH', label: 'Schuss schüttelt ab', unit: 'km/h', min: 0, max: 30, step: 1 },
  { heading: 'Super-G', tone: 'green' },
  { key: 'SG_GATE_SPACING_M', label: 'Torabstand', unit: 'm', min: 25, max: 80, step: 5 },
  { key: 'SG_GATE_WIDTH_M', label: 'Torbreite', unit: 'm', min: 4, max: 14, step: 0.5, decimals: 1 },
  { key: 'SG_GATE_OFFSET_M', label: 'Torversatz', unit: 'm', min: 0, max: 16, step: 1 },
  { key: 'SG_PISTE_HALF_M', label: 'Piste frei je Seite', unit: 'm', min: 12, max: 40, step: 1 },
  { key: 'SG_PENALTY_S', label: 'Zeitstrafe pro Tor', unit: 's', min: 0, max: 10, step: 0.5, decimals: 1 },
  { key: 'SG_POLE_KMH', label: 'Stange kostet', unit: 'km/h', min: 0, max: 30, step: 1 },
  { key: 'SG_MAX_SPEED_KMH', label: 'Endtempo', unit: 'km/h', min: 100, max: 300, step: 10 },
  { heading: 'Duell', tone: 'orange' },
  { key: 'DUEL_CRASH_PAUSE_S', label: 'Sturzpause', unit: 's', min: 0.5, max: 5, step: 0.1, decimals: 1 },
  { key: 'DUEL_RESPAWN_GRACE_S', label: 'Schonfrist', unit: 's', min: 0, max: 5, step: 0.1, decimals: 1 },
  { key: 'DUEL_GHOST_DELAY_S', label: 'Geist-Verzögerung', unit: 's', min: 0, max: 1, step: 0.05 },
  { heading: 'Bild', tone: 'teal' },
  { key: 'MAX_DPR', label: 'Auflösung', unit: '×', min: 1, max: 3, step: 0.5, decimals: 1, visual: true },
  { key: 'MARK_SPRAY_PX', label: 'Sprühlinie', unit: 'px', min: 2, max: 12, step: 1, visual: true },
  { heading: 'Schriftzug', tone: 'yellow' },
  { key: 'SIGN_ALPHA', label: 'Deckkraft', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'SIGN_WIDTH_FRAC', label: 'Breite', unit: '%', min: 0.4, max: 1, step: 0.02, scale: 100, decimals: 0 },
  { key: 'SIGN_ERASE_ALPHA', label: 'Verwischen beim Überfahren', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { heading: 'Ton', tone: 'violet' },
  { key: 'SND_MASTER', label: 'Lautstärke', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0, user: true },
  { key: 'SND_WIND', label: 'Wind', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0, user: true },
  { key: 'SND_SKI', label: 'Ski und Kurven', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0, user: true },
  { key: 'SND_AV', label: 'Lawine', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0, user: true },
  { key: 'SND_CRASH', label: 'Aufprall', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0, user: true },
  { key: 'SND_RACE', label: 'Super-G: Start und Tore', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0, user: true },
];
