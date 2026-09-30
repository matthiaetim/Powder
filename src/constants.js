// Alle Stellschrauben des Spiels an einem Ort.
// Einheiten: Meter, Sekunden, Grad. Werte mit (Tuning) lassen sich im Spiel per Panel verstellen.
export const VERSION = '0.27.10';

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
  SND_RACE: 0.65,            // (Tuning) Rennen (Super-G, Slalom, Duell): Countdown, Tore, Stangen, Ziel
  SND_CROWD: 0.6,            // (Tuning) Publikum im Zielstadion (Slalom): Raunen, Kuhglocken, Jubel
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
  BOARD_SL_MAX_AVG_KMH: 80,  // Slalom: schneller als sein Endtempo (SL_MAX_SPEED_KMH) geht es nicht
  BOARD_PISTE_MAX_AVG_KMH: 200, // Piste: präparierte Strecke ohne Bäume, dazu die steilen schwarzen Zweige (PISTE_BLACK_KMH)

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

  // Piste (nur piste; piste.js, piste-life.js, piste-view.js, world.js, game.js, render.js, hud.js): geführte Abfahrt
  // auf einer präparierten Piste bis zur Talstation bei PISTE_FINISH_M. Die Strecke ist fest (PISTE_SEED, ?seed=
  // überschreibt), damit man sie kennenlernt und die Bestenliste fair bleibt. Auf der Piste steht kein Baum, daneben
  // steht Wald in Gruppen mit Lichtungen; wer die Piste verlässt, fährt wie in Classic zwischen den Bäumen. Gefahren
  // wird mit der Physik aus Classic (G_SLOPE, MAX_SPEED_KMH), nur die Zweige einer Gabelung sind steiler oder flacher.
  // Ein Sturz ist nicht das Ende: nach PISTE_CRASH_PAUSE_S geht es auf der Piste weiter (Schonfrist wie im Duell,
  // DUEL_RESPAWN_GRACE_S), die Uhr läuft durch. PISTE_FREE_CRASHES Stürze sind frei, der nächste beendet den Lauf.
  // Gewertet werden die Meter; wer das Ziel erreicht, steht über allen anderen und wird nach Zeit sortiert.
  // Der Modus ist ein Entwurf (Beta): in der Moduswahl steht er nur, wenn PISTE_ON im Tuning-Panel an ist (modes.js
  // modeOn). Der Schalter überlebt „Standard“ und neue Tuning-Schlüssel und zählt nicht als Tuning (tune.js, keep).
  PISTE_ON: 0,               // (Tuning) 1 = Piste in der Moduswahl
  PISTE_FINISH_M: 10000,
  PISTE_SEED: 20260930,      // feste Strecke
  PISTE_FREE_CRASHES: 3,     // (Tuning) so viele Stürze sind frei
  PISTE_CRASH_PAUSE_S: 1,    // (Tuning) so lange liegt der Fahrer nach einem Sturz
  // Schwierigkeit in Wellen wie das Profil einer Etappe (Tim, 30.09.2026): [Meter, Stufe 0..10], dazwischen weich
  // verbunden. Auf jede Schlüsselstelle folgt ein Raststück, jede Welle ist etwas höher als die davor. Die schwerste
  // Stelle vor dem Hobby-Ziel (7000 m) liegt bei 6400 m, danach führt ein Raststück über die Marke; die höchste Welle
  // ist der Zielhang. Die Stufe steuert Breite, Kurven und Waldabstand (PISTE_*_EASY bei Stufe 0, PISTE_*_HARD bei
  // Stufe 10), dazu die Zahl der anderen Fahrer. Das Tempo bleibt überall das aus Classic (Tim, 30.09.2026).
  PISTE_PROFILE: [
    [0, 0.8], [600, 1.2], [1100, 3.0], [1400, 1.4], [2500, 3.4], [3300, 2.4], [3700, 4.4], [4200, 3.4], [4700, 5.4],
    [5700, 2.4], [6400, 6.8], [6950, 3.0], [7300, 5.2], [7700, 4.4], [8700, 8.2], [9100, 5.4], [9600, 9.6], [10000, 4.0],
  ],
  PISTE_HALF_EASY_M: 9,      // (Tuning) halbe Pistenbreite im Raststück
  PISTE_HALF_HARD_M: 4,      // (Tuning) halbe Pistenbreite an der Schlüsselstelle
  // (Tuning) Faktor auf die Breite der ganzen Piste samt Zweigen der Gabelungen. Funpark, Torstrecken und Ziehweg
  // behalten ihre festen Maße, weil ihre Bauten darauf stehen.
  PISTE_WIDTH_K: 1,
  PISTE_EDGE_EASY_M: 4,      // (Tuning) so weit bleibt der Wald im Raststück vom Pistenrand weg
  PISTE_EDGE_HARD_M: 0.6,    // (Tuning) und so weit an der Schlüsselstelle
  // Kurven: die Piste schwenkt um PISTE_TURN_*_DEG aus der Falllinie, eine volle S-Kurve ist PISTE_WAVE_*_M lang.
  // PISTE_WAVE_JITTER streckt oder staucht die Kurven abschnittsweise, damit sie nicht im Takt kommen.
  PISTE_TURN_EASY_DEG: 9,
  PISTE_TURN_HARD_DEG: 26,   // (Tuning) Schwenk an der Schlüsselstelle
  PISTE_WAVE_EASY_M: 420,
  PISTE_WAVE_HARD_M: 190,    // (Tuning) Länge einer S-Kurve an der Schlüsselstelle
  PISTE_WAVE_JITTER: 0.25,
  PISTE_HOME_M: 500,         // die Piste zieht mit dieser Länge zur Hangmitte zurück, sonst wandert sie seitlich davon
  PISTE_STEP_M: 1,           // Raster der vorgerechneten Strecke (piste.js)
  PISTE_PAD_M: 400,          // so weit reicht die Strecke über Start und Ziel hinaus (Anlauf, Auslauf)
  // Wald neben der Piste (world.js): Baumgruppen mit Lichtungen dazwischen. Ein weiches Zufallsmuster mit Flecken von
  // PISTE_GROVE_M entscheidet, wo Wald steht; PISTE_GROVE_FILL ist der Anteil der Fläche. An Schlüsselstellen rückt
  // der Wald als Wand an den Pistenrand (Schneise), ab Stufe PISTE_WALL_FROM, voll ab PISTE_WALL_FULL.
  PISTE_FOREST_D: 0.07,      // (Tuning) Bäume je m² im Wald
  PISTE_SPACING_M: 2.4,      // Mindestabstand der Bäume, enger als in Classic (MIN_SPACING_M): es soll Wald sein
  PISTE_ROCK_FRAC: 0.12,
  PISTE_GROVE_M: 26,
  PISTE_GROVE_FILL: 0.5,
  PISTE_WALL_FROM: 3.5,
  PISTE_WALL_FULL: 6,
  PISTE_WALL_M: 12,          // so tief steht die Wand aus Wald neben der Schneise
  PISTE_SNOW_P0: 0.35,       // Anteil der Bäume mit Schnee auf den Ästen am Start …
  PISTE_SNOW_P1: 0.9,        // … und im Tal
  PISTE_FINISH_CLEAR_M: 26,  // um das Ziel bleibt der Hang so weit frei (Auslauf und Talstation)

  // Gabelungen: [Meter, Länge, Farbe links, Farbe rechts] mit 0 blau, 1 rot, 2 schwarz. Die Piste teilt sich über
  // PISTE_FORK_RAMP_M in zwei Zweige, deren Mitten 2 × PISTE_FORK_SEP_M auseinanderliegen, und läuft am Ende ebenso
  // wieder zusammen; dazwischen steht Wald. Je Farbe: Stufe (Wald, Fahrer), halbe Breite, Waldabstand, eigene
  // Schlenker (Ausschlag, Wellenlänge), Endtempo und Gefälle als Faktor auf G_SLOPE. Blau ist breit, flach und
  // gemütlich, Schwarz schmal, steil und frei von anderen Fahrern, Rot liegt dazwischen und fährt wie die Hauptpiste.
  PISTE_FORKS: [[2000, 900, 0, 1], [4000, 900, 1, 2], [6000, 850, 0, 2], [8000, 950, 1, 2]],
  PISTE_FORK_SEP_M: 27,
  PISTE_FORK_RAMP_M: 150,
  PISTE_LANE_LEVEL: [1.2, 5, 8],
  PISTE_LANE_HALF_M: [8.5, 6, 5],
  PISTE_LANE_EDGE_M: [4, 2, 0.8],
  PISTE_LANE_WIG_M: [2, 3, 5],
  PISTE_LANE_WAVE_M: [260, 170, 120],
  PISTE_BLACK_KMH: 230,      // (Tuning) Endtempo im schwarzen Zweig
  PISTE_BLACK_G: 1.35,       // Gefälle im schwarzen Zweig als Faktor auf G_SLOPE
  PISTE_BLUE_KMH: 150,       // (Tuning) Endtempo im blauen Zweig
  PISTE_BLUE_G: 0.75,
  // Was an der Strecke steht, von oben nach unten. y in m; side −1 links, 1 rechts, 0 Mitte; lane 'L' oder 'R' legt
  // es in den linken oder rechten Zweig einer Gabelung. Arten: lift (Sessellift oder Gondel kreuzt über der Piste),
  // kicker (klein am Rand, big: breit mit weitem Flug), hut (Hütte mit Gästen), deer und hare (Tiere, nur Kulisse),
  // gates (Torstrecke: sg = Super-G-Tore, sl = Slalomstangen; ein Angebot ohne Strafe), trap (Tempomessung mit Foto),
  // park (Funpark: kleiner und breiter Kicker, Wellenbahn, Steilkurve), cannon (Schneekanone), ziehweg (schmaler
  // Weg quer zum Hang mit Fangnetz).
  PISTE_LAYOUT: [
    { k: 'lift', y: 760, type: 'chair', dir: 1 },
    { k: 'kicker', y: 950, side: -1 },
    { k: 'hut', y: 1420, side: 1, name: 'alm' },
    { k: 'deer', y: 1560, side: -1 },
    { k: 'kicker', y: 1750, side: 1 },
    { k: 'gates', y: 2260, lane: 'R', type: 'sg', n: 5 },
    { k: 'hare', y: 2520, lane: 'L' },
    { k: 'trap', y: 3060, side: 1 },
    { k: 'park', y: 3300 },
    { k: 'cannon', y: 3850, side: -1 },
    { k: 'gates', y: 4290, lane: 'L', type: 'sl', n: 8 },
    { k: 'kicker', y: 5020, side: -1 },
    { k: 'lift', y: 5230, type: 'gondola', dir: -1 },
    { k: 'cannon', y: 5460, side: 1 },
    { k: 'hut', y: 5720, side: -1, name: 'jause' },
    { k: 'kicker', y: 6400, lane: 'L', side: 1 },
    { k: 'deer', y: 6610, lane: 'L', side: -1 },
    { k: 'ziehweg', y: 6900, len: 260, dx: -34 },
    { k: 'gates', y: 7400, type: 'sg', n: 5 },
    { k: 'kicker', y: 7760, big: true, side: 0 },
    { k: 'kicker', y: 8460, lane: 'L', side: -1 },
    { k: 'hare', y: 8600, lane: 'L' },
    { k: 'trap', y: 9040, side: -1 },
    { k: 'hut', y: 9140, side: 1, name: 'einkehr' },
    { k: 'lift', y: 9330, type: 'gondola', dir: 1 },
  ],
  // Kicker: Breite, Länge der Rampe und Höhe der Kante in m [klein, breit, Welle der Wellenbahn]. Wer mit mindestens
  // PISTE_JUMP_MIN_KMH über die Kante fährt, springt von selbst: PISTE_AIR_*_S in der Luft bei PISTE_AIR_REF_KMH,
  // mit dem Tempo zwischen PISTE_AIR_K_MIN und PISTE_AIR_K_MAX mal so lang und so hoch. In der Luft lenkt man nicht
  // und trifft nichts, gelandet wird immer auf der Piste; danach PISTE_LAND_SAFE_S ohne Zusammenstoß.
  PISTE_KICK_W_M: [3.2, 9.5, 8],
  PISTE_KICK_L_M: [4.2, 7.5, 2.4],
  PISTE_KICK_H_M: [0.9, 1.9, 0.5],
  PISTE_AIR_SMALL_S: 0.75,
  PISTE_AIR_BIG_S: 1.35,     // (Tuning) Flugzeit am breiten Kicker
  PISTE_AIR_ROLL_S: 0.3,
  PISTE_AIR_Z_M: [1.5, 3.4, 0.45], // Scheitelhöhe des Flugs bei PISTE_AIR_REF_KMH
  PISTE_AIR_REF_KMH: 110,
  PISTE_AIR_K_MIN: 0.7,
  PISTE_AIR_K_MAX: 1.25,
  PISTE_JUMP_MIN_KMH: 30,
  PISTE_LAND_SAFE_S: 0.4,
  PISTE_LAND_EDGE_M: 1.6,    // so weit vom Pistenrand landet man mindestens
  PISTE_TRICK_SHOW_S: 1.1,   // so lange steht der Name des Tricks nach der Landung noch am Fahrer
  // Tricks [Schlüssel in i18n, Drehungen um die Hochachse, Überschläge, Ski gekreuzt, Ski gespreizt]
  PISTE_TRICKS_SMALL: [['t360', 1, 0, 0, 0], ['grab', 0, 0, 1, 0], ['spread', 0, 0, 0, 1], ['t180', 0.5, 0, 0, 0]],
  PISTE_TRICKS_BIG: [['backflip', 0, 1, 0, 0], ['t720', 2, 0, 0, 0], ['t360grab', 1, 0, 1, 0], ['frontflip', 0, -1, 0, 0], ['cork', 2, 1, 0, 0]],
  // Funpark (Layout: park): ab dem Schild PISTE_PARK_LEN_M lang und PISTE_PARK_HALF_M je Seite breit. Darin, vom
  // Schild aus gemessen: kleiner Kicker, breiter Kicker, drei Wellen, dann die Steilkurve, in der die Piste um
  // PISTE_BANK_DX_M zur Seite springt. Die Wand der Steilkurve fängt auf, wer geradeaus weiterfährt: kein Sturz.
  PISTE_PARK_LEN_M: 330,
  PISTE_PARK_HALF_M: 11.5,
  PISTE_PARK_AT_M: [50, 110, 170, 250], // kleiner Kicker, breiter Kicker, erste Welle, Beginn der Steilkurve
  PISTE_ROLL_GAP_M: 13,
  PISTE_BANK_LEN_M: 56,
  PISTE_BANK_DX_M: 16,
  PISTE_BANK_W_M: 3.4,       // so breit ist die Wand an ihrer höchsten Stelle
  PISTE_BANK_SPRING: 5,      // 1/s: so schnell trägt die Wand den Fahrer zurück auf die Piste
  // Ziehweg: halbe Breite, Fangnetz an beiden Rändern wie im Slalom (fence.js): abprallen statt stürzen
  PISTE_PATH_HALF_M: 4.2,
  PISTE_PATH_KEEP: 0.9,      // Tempo, das beim Anprall ans Netz bleibt
  // Torstrecken: Abstand der Tore und Versatz zur Mitte [Super-G-Tore, Slalomstangen]. Die Tore sind ein Angebot:
  // verpasste kosten nichts. Wer alle Tore einer Strecke trifft, bekommt PISTE_GATE_REWARD verbrauchte Stürze zurück.
  PISTE_GATE_GAP_M: [45, 13],
  PISTE_GATE_OFF_M: [5.5, 1.6],
  PISTE_GATE_HALF_M: [11.5, 7.5], // so breit ist die Piste an einer Torstrecke mindestens
  PISTE_GATE_REWARD: 1,      // (Tuning)
  PISTE_NOTE_S: 2,           // so lange steht ein Hinweis im HUD (Tor 2/5, Tempo, Sturz zurück)
  // Tempomessung: zwei gesprühte Linien im Abstand PISTE_TRAP_M, die Tafel dahinter zeigt das gemessene Tempo. An
  // der zweiten Linie blitzt der Fotopunkt.
  PISTE_TRAP_M: 20,
  PISTE_TRAP_BOARD_M: 46,    // so weit hinter der ersten Linie steht die Tafel
  PISTE_TRAP_RGBA: 'rgba(255,122,26,0.75)',
  PISTE_FLASH_S: 0.3,
  // Andere Fahrer: einer alle PISTE_NPC_GAP0_M am Start, unten alle PISTE_NPC_GAP1_M (± PISTE_NPC_JITTER). Sie fahren
  // langsamer als der Spieler in ruhigen Bögen und erscheinen PISTE_NPC_AHEAD_M vor ihm. Ein Zusammenstoß ist ein
  // Sturz. In einer Gabelung nimmt jeder einen Zweig, in den schwarzen fährt keiner.
  // PISTE_NPC_K teilt beide Abstände: 2 heißt doppelt so viele Fahrer, 0 eine leere Piste.
  PISTE_NPC_GAP0_M: 330,     // (Tuning)
  PISTE_NPC_GAP1_M: 120,     // (Tuning)
  PISTE_NPC_K: 1,            // (Tuning)
  PISTE_NPC_JITTER: 0.35,
  PISTE_NPC_KMH: [38, 62],
  PISTE_NPC_AHEAD_M: 90,
  PISTE_NPC_BEHIND_M: 45,
  PISTE_NPC_FROM_M: 260,     // davor ist die Piste leer
  PISTE_NPC_R: 0.45,
  PISTE_NPC_TRAIL_M: 42,     // so lang ist die Spur hinter einem anderen Fahrer
  PISTE_NPC_COLORS: ['#C0342A', '#3568B5', '#FFD84A', '#FF7A1A', '#2FB457', '#5F8ACB', '#D25A50'],
  // Spuren früherer Fahrer im präparierten Schnee: je Zweig PISTE_OLD_TRACKS blasse Linien, in Stücken von
  // PISTE_OLD_TRACK_M mal da, mal nicht
  PISTE_OLD_TRACKS: 3,
  PISTE_OLD_TRACK_M: 160,
  PISTE_OLD_TRACK_ALPHA: 0.075,
  // Lift: das Seil hängt PISTE_LIFT_H_M hoch, Stützen stehen neben der Piste. Im Bild liegen Seil und Sessel über
  // allem und verschieben sich mit der Höhe gegen den Boden (PISTE_LIFT_PARALLAX je m Höhe), das gibt die Tiefe.
  PISTE_LIFT_H_M: 8.5,
  PISTE_LIFT_HALF_M: 2.3,    // halber Abstand der beiden Seile
  PISTE_LIFT_GAP_M: 11,      // Abstand der Sessel
  PISTE_LIFT_MS: 2.4,        // Tempo des Seils in m/s
  PISTE_LIFT_PARALLAX: 0.03,
  PISTE_LIFT_PYLON_M: 46,    // Abstand der Stützen
  PISTE_LIFT_ANGLE_DEG: 34,  // so schräg quert die Trasse die Falllinie (0 = waagrecht im Bild)
  // Flutlicht: ab PISTE_NIGHT_FROM_M wird es über PISTE_NIGHT_FADE_M dunkel, Masten am Pistenrand alle
  // PISTE_MAST_M werfen Lichtkegel auf die Piste.
  PISTE_NIGHT_FROM_M: 7850,
  PISTE_NIGHT_FADE_M: 350,
  PISTE_NIGHT_ALPHA: 0.62,   // (Tuning) Deckkraft der Dunkelheit
  PISTE_NIGHT_RGB: '14,24,56',
  PISTE_MAST_M: 24,
  PISTE_MAST_H_M: 7.5,
  PISTE_LIGHT_M: [11, 11],   // Lichtkegel auf dem Schnee: halbe Breite, halbe Länge
  // Schneekanone: bläst quer über die Piste, im Nebel sieht man kurz wenig
  PISTE_CANNON_PUFFS: 22,
  PISTE_CANNON_REACH_M: 19,
  // Ton an der Strecke: Hütte (Stimmen, Glocken, Musik) und Lift (Brummen, Klacken) ab diesem Abstand hörbar
  PISTE_HUT_HEAR_M: 60,
  PISTE_LIFT_HEAR_M: 45,
  // Tiere (nur Kulisse): das Reh flieht, wenn der Fahrer näher als PISTE_DEER_FLEE_M kommt, der Hase quert die Piste
  PISTE_DEER_FLEE_M: 24,
  PISTE_HARE_AT_M: 65,
  // Farben der Bauten
  PISTE_WOOD: '#A9764B', PISTE_WOOD_DARK: '#7D5636', PISTE_WOOD_LIGHT: '#C08D5E',
  PISTE_STEEL: '#8793A0', PISTE_STEEL_DARK: '#5C6875', PISTE_GLASS: '#BFD9EE', PISTE_FACE: '#C3D2E2',
  PISTE_YELLOW: '#FFD84A', PISTE_GREEN: '#2FB457', PISTE_PAPER: '#F4F3EF',
  PISTE_LAMP: '#FFF3B8', PISTE_LAMP_RGB: '255,236,160',
  // Piste im Bild (render.js): präparierter Schnee, etwas heller als der Hang, mit feinen Rillen in der Falllinie
  // (Cord). Randstangen alle PISTE_POLE_M in der Farbe der Schwierigkeit: blau bis PISTE_BLUE_TO, rot bis
  // PISTE_RED_TO, darüber schwarz; rechts mit orangefarbener Spitze wie auf echten Pisten.
  PISTE_SNOW: '#FFFFFF',
  PISTE_CORD_RGBA: 'rgba(60,80,100,0.075)',
  PISTE_CORD_M: 0.45,        // Abstand der Rillen
  PISTE_POLE_M: 12,
  PISTE_POLE_H_M: 1.5,
  PISTE_BLUE_TO: 3.5,
  PISTE_RED_TO: 6.5,
  PISTE_BLACK: '#14140F',
  PISTE_POLE_TIP: '#FF7A1A',
  SNOW_CAP: '#FFFFFF',       // Schnee auf Ästen und Felsen, Schattenseite wie beim Starthaus
  SNOW_CAP_SHADE: '#CFDDEA',

  // Super-G (nur superg; gates.js, game.js, render.js, hud.js): Zeitfahren bis SG_FINISH_M durch Tore, abwechselnd
  // rot und blau. Der Kurs ist fest (SG_SEED, ?seed= überschreibt), damit Bestzeiten vergleichbar bleiben. Tore
  // stehen ab SG_GATE_FIRST_M alle SG_GATE_SPACING_M abwechselnd links und rechts der Pistenmitte (Versatz
  // SG_GATE_OFFSET_M, davon zufällig 1 - SG_GATE_JITTER bis 1). Die Pistenmitte ist eine flache Sinuskurve
  // (SG_LANE_AMP_M, SG_LANE_WAVE_M): der Korridor der anderen Modi schwingt mit seiner 97-m-Komponente zu schnell,
  // mit Torversatz wären das Bögen über 45°. Die Piste ist SG_PISTE_HALF_M je Seite frei, außen stehen Bäume wie
  // in Classic (Aufprall beendet den Lauf ohne Zeit). Ein verpasstes Tor kostet SG_PENALTY_S, eine berührte Stange
  // SG_POLE_KMH Tempo, kein Sturz. Zwischenzeiten an jedem SG_SPLIT_EVERY-ten Tor (SG_SPLIT_*) gegen den besten Lauf. Start mit Countdown
  // (SG_COUNT_BEEPS kurze Pieptöne im Abstand SG_COUNT_STEP_S, dann der lange = Go) im Starthaus, aber ohne den
  // Starthügel des Slaloms: sein Schub machte die Zeiten schneller als die der Bestenliste. Im Ziel wartet das
  // Zielstadion wie im Slalom, dort macht der Fahrer den Hockeystop (STOP_*), dann kommt die Fresh-Seite.
  SG_FINISH_M: 1000,
  SG_SEED: 20260925,         // fester Kurs
  SG_GATE_FIRST_M: 50,
  SG_GATE_SPACING_M: 45,     // (Tuning) Abstand der Tore
  SG_GATE_WIDTH_M: 7.5,      // (Tuning) Durchfahrt zwischen den Stangen (am iPhone getunt, v0.16.2)
  SG_GATE_OFFSET_M: 10,      // (Tuning) Versatz der Tore zur Pistenmitte, abwechselnd links und rechts
  SG_GATE_JITTER: 0.5,       // zufälliger Anteil am Versatz: jedes Tor steht bei 50–100 % des vollen Versatzes
  SG_LAST_GATE_GAP_M: 30,    // so weit steht das letzte Tor mindestens vor dem Ziel
  // Trichter zum Zielbogen: im Super-G gibt es keinen Fangzaun an der Strecke, nur auf den letzten SG_FUNNEL_M läuft
  // das Netz von den Pistenrändern auf den Zielbogen zu. Nie länger als SG_LAST_GATE_GAP_M, sonst stünde es am letzten
  // Tor. Länger als im Slalom (STAD_FUNNEL_M), bei gut 200 km/h ist die Strecke sonst in einem Wimpernschlag vorbei.
  SG_FUNNEL_M: 30,
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
  // Slalom (nur slalom; gates.js COURSES wählt die Werte, Ablauf wie im Super-G: Countdown, Torwertung, Zwischenzeiten,
  // Ziel mit Hockeystop): kurz und eng, SL_FINISH_M mit einzelnen Kippstangen, abwechselnd rot und blau und links und
  // rechts der Pistenmitte. Gewertet ist das Tor, wenn der Fahrer außen an der Stange vorbeifährt. Die Stangen stehen
  // weit genug auseinander, dass man richtig wedeln muss (bei Jürgens Entwurf standen sie fast in einer Linie); der
  // Rhythmus wechselt zwischen eng, normal und weit. Eigener fester Kurs und eigene Bestenliste (Zeit).
  SL_FINISH_M: 500,
  SL_SEED: 20260929,         // fester Kurs
  SL_GATE_FIRST_M: 40,
  SL_GATE_SPACING_M: 15,     // (Tuning) Grundabstand der Tore, SL_RHYTHM staucht oder streckt ihn je Abschnitt
  SL_POLE_OFFSET_M: 1.8,     // (Tuning) Grundabstand der Stange zur Pistenmitte, je Abschnitt mal SL_RHYTHM
  // Rhythmus: Abschnitte ab Meter y mit Faktoren auf Torabstand und Stangenversatz. Abstand und Versatz wachsen
  // zusammen, damit der Fahrwinkel in jedem Abschnitt ähnlich bleibt: eng (ab 110 m und ab 345 m, rund 11 m / 1,2 m)
  // heißt schnelle kurze Schwünge, weit (ab 165 m und ab 395 m, rund 20 m / 2,6 m) lange runde Bögen. Vertikale (ab
  // 225 m): Stangen fast in einer Linie, ein kurzer schneller Durchschlupf. Im Streifen um das Schild bei SIGN_Y_M
  // stehen keine Tore (createCourse). Die Regler verschieben alles mit. Durchgerechnet mit einem Piloten, der die
  // echte Physik vorausrechnet: 30 Tore, 31,7 s mit Starthügel, im Schnitt 62 km/h, nie unter 46 km/h; mit Jürgens Werten (12 m /
  // 0,6 m) 30,2 s bei 66 km/h, mit 2 m Versatz auf 12 m Abstand dagegen 40 s bei 51 km/h.
  SL_RHYTHM: [
    [0, 1, 1], [110, 0.75, 0.65], [165, 1.35, 1.5], [225, 0.6, 0.2], [250, 1, 1],
    [345, 0.75, 0.65], [395, 1.35, 1.5], [455, 1, 1],
  ],
  SL_GATE_JITTER: 0.1,       // zufälliger Anteil am Versatz, klein: der Rhythmus soll gleichmäßig bleiben
  SL_LAST_GATE_GAP_M: 20,    // so weit steht das letzte Tor mindestens vor dem Ziel
  SL_LANE_AMP_M: 6,          // Pistenmitte: Amplitude der Sinuskurve
  SL_LANE_WAVE_M: 300,       // Pistenmitte: Wellenlänge
  SL_PISTE_HALF_M: 9,        // (Tuning) freie Piste je Seite der Mitte, dort steht der Fangzaun
  SL_PENALTY_S: 1.5,         // (Tuning) Zeitstrafe pro verpasstem Tor (am iPhone getunt, v0.27.8)
  SL_POLE_KMH: 5,            // (Tuning) Tempoverlust beim Berühren einer Stange
  SL_MAX_SPEED_KMH: 80,      // (Tuning) Endtempo im Slalom, sonst sind die engen Tore nicht fahrbar
                             // Mehr nur zusammen mit BOARD_SL_MAX_AVG_KMH und den Regeln: mit 95 km/h schafft der Pilot
                             // 21,55 s, die Liste nimmt nur Zeiten ab 22,5 s an
  // Zwischenzeiten wie im Super-G an einem Tor, aber seltener: die Tore folgen im Sekundentakt, der Hinweis stünde
  // sonst dauernd im Bild
  SL_SPLIT_FIRST: 9,
  SL_SPLIT_EVERY: 9,
  SL_SPLIT_FREE_LAST: 3,
  // Kippstange (render.js): dicker als die Super-G-Stange, damit man sie sieht, in der Torfarbe mit Tinte-Rand,
  // hellem Streifen und Gelenk am Fuß. Getroffen klappt sie weiter um als das Super-G-Panel.
  SL_POLE_W_M: 0.28,
  SL_POLE_WOBBLE_DEG: 80,
  // Führung im Schnee (guide-line.js): an jeder Stange ein gesprühter Bogen wie an den Super-G-Innenstangen, feiner
  // gesprüht und kleiner, weil die Stangen dichter stehen. Farbe GM_RGB; die Ski verwischen ihn (snow-scrub.js). An
  // den Zwischenzeit-Toren dazu Fleck und Linie nach außen. Eine durchgehende Ideallinie (gates.js guideX) gibt es
  // als Regler, Standard aus: Tim fand Bögen und Linie zusammen zu viel Farbe im Schnee (29.09.2026).
  SL_LINE_CLEAR_M: 0.9,      // Abstand der Ideallinie zur Stange: SKIER_R + SG_POLE_R sind 0,57 m, der Rest ist Luft
  SL_LINE_PX: 0,             // (Tuning) Strichbreite der Ideallinie, 0 = aus
  SL_LINE_ALPHA: 0.5,        // Deckkraft der Ideallinie: blasser als die Bögen, sie soll führen, nicht dominieren
  SL_LINE_TILE_M: 10,        // die Linie wird in Stücken dieser Länge vorgerendert, je Bild höchstens eines neu
  SL_ARC_W_M: 1.4,           // Bogen an der Stange: halbe Breite des Ovals (Super-G 2,5)
  SL_ARC_OVAL: 2.2,          // Höhe zu Breite: gut 6 m hoch, die engsten Stangen stehen 9 m auseinander
  SL_ARC_PX: 4,              // (Tuning) Strichbreite des Bogens (Super-G 9; am iPhone getunt, v0.27.8)
  SL_SPLIT_LINE_M: 4,        // Zwischenzeit-Tor: Linie von der Stange nach außen
  SL_SPLIT_DOT_PX: 11,       // Fleck an der Stange und Linie, feiner als im Super-G (GM_DOT_PX, GM_LINE_PX)
  SL_SPLIT_LINE_PX: 5,
  // Fangzaun (fence.js, fence-view.js, nach Jürgens Entwurf): orangefarbenes Netz auf Pfosten am Pistenrand
  // (Innenkante bei SL_PISTE_HALF_M). Wer hineinfährt, prallt ab: kein Sturz, etwas Tempo weg, er rutscht entlang.
  // Das Netz ist elastisch und beult sich dort aus, wo der Fahrer drinhängt; die Beule wandert mit ihm und schwingt
  // danach zurück. Die Bäume rücken um SL_FENCE_CLEAR_M nach außen.
  SL_FENCE_NET_M: 0.55,      // Breite des Netzes im Bild
  SL_FENCE_POST_M: 3,        // Abstand der Pfosten
  SL_FENCE_CLEAR_M: 3,       // so weit bleibt der Wald hinter der Innenkante frei
  SL_FENCE_KEEP: 0.85,       // (Tuning) Tempo, das beim Anprall bleibt
  SL_FENCE_BUMP_S: 0.4,      // nach einem Anprall so lange kein weiterer Tempoverlust, sonst bremste jedes Entlangrutschen
  SL_NET_GIVE_M: 0.9,        // so tief gibt das Netz höchstens nach
  SL_NET_SPRING: 3,          // 1/s: so schnell drückt es den Fahrer zurück
  SL_NET_DAMP_S: 0.15,       // so schnell klingt die Fahrt nach außen im Netz ab
  SL_NET_BULGE_M: 2.5,       // halbe Länge der Beule entlang des Zauns
  SL_NET_K: 180,             // Rückschwingen nach dem Loslassen: Federkonstante (etwa 2 Hz) …
  SL_NET_D: 9,               // … und Dämpfung (zwei, drei kleine Nachschwinger)
  // Starthügel (nur Slalom; game.js startBoost, start-house.js): die ersten SL_START_RAMP_M sind steiler, dort wirkt
  // zusätzlicher Hangabtrieb, oben SL_START_BOOST, zum Ende weich auf null. Davor steht das Starthaus.
  SL_START_RAMP_M: 20,       // (Tuning) Länge des Starthügels, 0 = aus
  SL_START_BOOST: 10,        // (Tuning) zusätzlicher Hangabtrieb oben am Starthügel in m/s²
  // Starthaus im Bild (start-house.js): Holzhaus mit verschneitem Dach knapp oberhalb der Startlinie, der Fahrer
  // steht im offenen Tor. Über dem Tor die Startampel (die Lampen folgen dem Countdown) und die Uhr, vor dem Tor der
  // Startbügel, der beim Go aufschwingt.
  SH_WAND_OPEN_S: 0.18,      // so schnell schwingt der Startbügel auf
  SH_CHEVRONS: 6,            // gesprühte Winkel auf dem Starthügel, talwärts weiter auseinander
  SH_WOOD: '#A9764B', SH_WOOD_DARK: '#7D5636', SH_WOOD_LIGHT: '#C08D5E', SH_DOOR: '#2E221A',
  SH_SNOW: '#FFFFFF', SH_SNOW_SHADE: '#DCE6F0',
  SH_LED: '#FFD84A',         // Ziffern der Uhren (Starthaus, Zielbogen, Videowand), wie --mark
  SH_LAMP_RED: '#E5392E', SH_LAMP_GREEN: '#2FB457', SH_LAMP_OFF: '#4A4A52',
  SH_RAMP_RGB: '120,150,185', // Schattierung des Starthügels

  // Zielstadion (Slalom und Super-G; stadium.js, stadium-view.js, nach Jürgens Entwurf): der Fangzaun verengt sich auf
  // den letzten STAD_FUNNEL_M (Super-G: SG_FUNNEL_M) auf den Zielbogen, hinter der Ziellinie liegt der Zielraum zwischen
  // Werbebanden, Stehplätzen und Tribünen, unten im Halbkreis geschlossen. Vor der Linie steht kein Publikum: man soll
  // sehen, wo das Ziel ist.
  STAD_FIN_HALF_M: 7,        // halbe Breite von Zielbogen und Zielraum (Innenkante der Bande)
  STAD_FUNNEL_M: 18,         // so weit vor dem Ziel beginnt der Trichter …
  STAD_FUNNEL_END_M: 3,      // … und so weit vor dem Ziel ist er zu
  STAD_BOWL_M: 26,           // Mitte des Runds hinter der Ziellinie: dort steht der Fahrer nach dem Hockeystop; der
                             // Stopp aus 240 km/h (SG_MAX_SPEED_KMH) braucht gut 24 m, er passt also noch hinein
  STAD_AIM_S: 0.3,           // Auslauf: so schnell richtet er sich auf die Mitte aus
  STAD_GLIDE_DECEL: 2,       // m/s²: so viel Tempo verliert er beim Gleiten
  STAD_GLIDE_MIN: 9,         // m/s: langsamer gleitet niemand ins Rund
  STAD_CAM_FRAC: 0.56,       // Fahrerposition im Bild nach dem Ziel: Zielbogen und Rund sind beide zu sehen
  STAD_HOLD_S: 2.4,          // so lange nach Beginn des Hockeystops kommt die Fresh-Seite (Tipp springt hin)
  STAD_PARTY_S: 5,           // so lange nach dem Ziel mindestens volle Bildrate (Konfetti), danach Leerlauf
  STAD_WALL_M: 0.9,          // Höhe der Werbebanden
  STAD_PANEL_M: 4.2,         // Länge einer Werbetafel
  STAD_ROWS: 2,              // Stehplatzreihen an der Bande
  STAD_ROW_M: 0.8,
  STAD_TRIB_GAP_M: 0.5,      // zwischen Stehplätzen und Tribüne
  STAD_TRIB_ROWS: 4,         // mehr passt mit Banden und Stehplätzen nicht in die Sichtbreite
  STAD_TRIB_ROW_M: 0.85,
  STAD_TRIB_RISE_M: 0.32,    // so viel höher steht jede Reihe der Tribüne
  STAD_SPACING_M: 0.82,      // Abstand der Fans in einer Reihe
  STAD_EMPTY_P: 0.08,        // Anteil freier Plätze
  STAD_FLAG_P: 0.05,         // Anteil mit Fahne
  STAD_AISLE_M: 9,           // alle so viele Meter ein Gang in der Tribüne
  STAD_ARCH_H_M: 4.2,        // Höhe des Zielbogens
  STAD_HYPE_M: 120,          // ab dieser Entfernung zum Ziel wird das Publikum lauter
  STAD_PEAK_S: 2,            // so lange nach dem Ziel volle Stimmung
  STAD_OLA_AFTER_S: 1.6,     // La Ola: so lange nach dem Ziel beginnt die erste Welle …
  STAD_OLA_PAUSE_S: 0.5,     // … mit dieser Pause folgt die nächste
  STAD_OLA_S: 2.2,           // so lange läuft eine Welle um die Ränge
  STAD_OLA_W: 0.09,          // Breite der Welle als Anteil der Ränge
  STAD_OLA_N: 2,             // so viele Wellen
  STAD_FLASH_BASE: 1,        // Blitzlichter pro Sekunde: immer, mit der Stimmung, im Ziel
  STAD_FLASH_HYPE: 12,
  STAD_FLASH_FINISH: 60,
  STAD_FLASH_S: 0.16,
  STAD_CONFETTI: 200,        // Stücke aus den Türmen des Zielbogens
  STAD_BUILD_AT_M: 150,      // so weit vor dem Ziel entstehen die Bilder des Stadions, verteilt auf mehrere Bilder
  // Farben: die Palette des Spiels, damit das Stadion nicht bunter wird als der Rest
  STAD_JACKETS: ['#C0342A', '#3568B5', '#265A3A', '#FFD84A', '#FF7A1A', '#14140F', '#F4F3EF', '#7E8994', '#D25A50', '#5F8ACB', '#357350', '#6B4F3B'],
  STAD_SKIN: ['#F2C9A5', '#E0A97E', '#B87B52', '#8A5A3B'],
  STAD_CONFETTI_RGB: ['#C0342A', '#3568B5', '#FFD84A', '#FF7A1A', '#2FB457', '#F4F3EF'],
  STAD_STEP: '#D9E2EC', STAD_STEP_DARK: '#B9C6D4', // Stufen der Tribüne
  // Werbebanden: [Text, Grund, Schrift]; später lassen sich hier echte Partner einsetzen. Text null: der Name des
  // Torlaufs (gates.js COURSES, ad), SLALOM oder SUPER-G
  STAD_ADS: [
    ['POWDER', '#F4F3EF', '#C0342A'], ['FRESH', '#14140F', '#FFD84A'], [null, '#3568B5', '#F4F3EF'],
    ['HOPP HOPP', '#FFD84A', '#14140F'], ['POWDER', '#C0342A', '#F4F3EF'],
  ],
  FENCE_NET: '#FF7A1A',      // Netz
  FENCE_NET_RGB: '255,122,26',
  FENCE_EDGE: '#E8620C',     // Ober- und Unterkante
  SG_FINISH_OVERLAY_MS: 2200, // ohne Zielstadion (Duell): nach dem Ziel so lange Hockeystop und Wolke, dann die Fresh-Seite (Tipp springt hin)

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
// Tuning und wird eigens gespeichert, damit ein neuer KEY in tune.js die Wahl des Spielers nicht verwirft. keep: ein
// Schalter des Entwicklers (Beta-Modi), eigener Speicher wie user, aber nur im Tuning-Panel; „Standard“ lässt ihn
// stehen und er zählt nie als Tuning. onoff: Schalter statt Regler, Werte 0 und 1.
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
  { heading: 'Slalom', tone: 'green' },
  { key: 'SL_GATE_SPACING_M', label: 'Torabstand', unit: 'm', min: 8, max: 30, step: 1 },
  { key: 'SL_POLE_OFFSET_M', label: 'Stangenversatz', unit: 'm', min: 0, max: 6, step: 0.1, decimals: 1 },
  { key: 'SL_PISTE_HALF_M', label: 'Piste frei je Seite', unit: 'm', min: 6, max: 30, step: 1 },
  { key: 'SL_PENALTY_S', label: 'Zeitstrafe pro Tor', unit: 's', min: 0, max: 10, step: 0.5, decimals: 1 },
  { key: 'SL_POLE_KMH', label: 'Stange kostet', unit: 'km/h', min: 0, max: 30, step: 1 },
  { key: 'SL_MAX_SPEED_KMH', label: 'Endtempo', unit: 'km/h', min: 40, max: 160, step: 5 },
  { key: 'SL_START_RAMP_M', label: 'Starthügel Länge', unit: 'm', min: 0, max: 40, step: 2 },
  { key: 'SL_START_BOOST', label: 'Starthügel Schub', unit: 'm/s²', min: 0, max: 20, step: 1 },
  { key: 'SL_FENCE_KEEP', label: 'Tempo nach Zaun', unit: '%', min: 0.3, max: 1, step: 0.05, scale: 100, decimals: 0 },
  { key: 'SL_ARC_PX', label: 'Bogen an der Stange', unit: 'px', min: 2, max: 12, step: 1, visual: true },
  { key: 'SL_LINE_PX', label: 'Ideallinie', unit: 'px', min: 0, max: 10, step: 1, visual: true },
  { heading: 'Piste', tone: 'blue' },
  { key: 'PISTE_ON', label: 'Modus Piste (Beta) anzeigen', min: 0, max: 1, step: 1, onoff: true, keep: true },
  { key: 'PISTE_WIDTH_K', label: 'Pistenbreite gesamt', unit: '×', min: 0.5, max: 1.6, step: 0.05, decimals: 2 },
  { key: 'PISTE_FREE_CRASHES', label: 'Freie Stürze', unit: '', min: 0, max: 9, step: 1 },
  { key: 'PISTE_CRASH_PAUSE_S', label: 'Sturzpause', unit: 's', min: 0.5, max: 5, step: 0.1, decimals: 1 },
  { key: 'PISTE_HALF_EASY_M', label: 'Breite im Raststück', unit: 'm', min: 5, max: 14, step: 0.5, decimals: 1 },
  { key: 'PISTE_HALF_HARD_M', label: 'Breite an der Schlüsselstelle', unit: 'm', min: 2, max: 10, step: 0.5, decimals: 1 },
  { key: 'PISTE_BLACK_KMH', label: 'Endtempo Schwarz (Gabelung)', unit: 'km/h', min: 150, max: 300, step: 5 },
  { key: 'PISTE_BLUE_KMH', label: 'Endtempo Blau (Gabelung)', unit: 'km/h', min: 80, max: 200, step: 5 },
  { key: 'PISTE_NPC_K', label: 'Andere Fahrer: Häufigkeit', unit: '×', min: 0, max: 3, step: 0.1, decimals: 1 },
  { key: 'PISTE_NPC_GAP0_M', label: 'Andere Fahrer am Start alle', unit: 'm', min: 60, max: 800, step: 10 },
  { key: 'PISTE_NPC_GAP1_M', label: 'Andere Fahrer im Tal alle', unit: 'm', min: 40, max: 400, step: 10 },
  { key: 'PISTE_AIR_BIG_S', label: 'Flugzeit breiter Kicker', unit: 's', min: 0.6, max: 2.5, step: 0.05, decimals: 2 },
  { key: 'PISTE_GATE_REWARD', label: 'Alle Tore: Stürze zurück', unit: '', min: 0, max: 1, step: 1 },
  { key: 'PISTE_NIGHT_ALPHA', label: 'Dunkelheit im Flutlicht', unit: '%', min: 0, max: 0.85, step: 0.05, scale: 100, decimals: 0, visual: true },
  { key: 'PISTE_TURN_HARD_DEG', label: 'Schwenk an der Schlüsselstelle', unit: '°', min: 10, max: 45, step: 1 },
  { key: 'PISTE_WAVE_HARD_M', label: 'Kurvenlänge an der Schlüsselstelle', unit: 'm', min: 100, max: 400, step: 10 },
  { key: 'PISTE_EDGE_EASY_M', label: 'Waldabstand im Raststück', unit: 'm', min: 0, max: 10, step: 0.5, decimals: 1 },
  { key: 'PISTE_EDGE_HARD_M', label: 'Waldabstand an der Schlüsselstelle', unit: 'm', min: 0, max: 6, step: 0.2, decimals: 1 },
  { key: 'PISTE_FOREST_D', label: 'Walddichte', unit: '/100 m²', min: 0.01, max: 0.1, step: 0.005, scale: 100, decimals: 1 },
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
  { key: 'SND_RACE', label: 'Rennen: Start und Tore', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0, user: true },
  { key: 'SND_CROWD', label: 'Publikum', unit: '%', min: 0, max: 1, step: 0.05, scale: 100, decimals: 0, user: true },
];
