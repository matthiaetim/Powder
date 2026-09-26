# Powder – Ski Simulator

Privater Nachbau des minimalistischen iOS-Ski-Spiels *Powder – Alpine Simulator* (2014) als Web-App für das iPhone.
Plain HTML + JavaScript + Canvas, kein Framework, kein Build.

## Spielen

- **Tippen** links/rechts: der Kurs schwingt weich auf den Tipp-Winkel ein, ganz kurze Tipps geben kleine Kurven.
- **Halten**: der Winkel vertieft sich stetig bis knapp über quer (95°). Ab etwa 25° bremst der Winkel, je querer, desto stärker, quer zum Hang bis zum Stillstand.
- **Loslassen**: der Fahrer schwingt ohne Knick zurück zur Falllinie.
- **Beide Daumen**: Schneepflug, bremst geradeaus. Bei hohem Tempo schwächer als Querstellen. Hebt man einen Daumen, lenkt der andere. Die Ski gehen sichtbar in den Pflug, hinterlassen eine breite Bremsspur, Schnee spritzt an beiden Seiten, und es kratzt hörbar.
- **Bremsen**: vor allem der Winkel bremst, jede Kursänderung kostet zusätzlich etwas Tempo.
- Der Start hat schon Fahrt, ohne Eingabe wird man stetig schneller bis zum Endtempo. Kurze Tipps kosten kaum Tempo, Halten bremst hart, quer zum Hang bleibt man stehen.
- Bei hohem Tempo rückt der Fahrer im Bild nach oben und die Sicht zoomt leicht heraus (mehr Vorausschau).
- **Markierungen im Schnee**: alle 1000 m eine dünne blaue Linie mit Meterzahl, der bisherige Bestwert des Modus als rote Rekordlinie, die Bestweiten der anderen aus der Bestenliste als graue Namenslinien (alle beim Start des Laufs eingefroren).
- **Credit bei 333 m**: ein großes Schild quer über der Korridor-Mitte, weiße Platte mit Tinte-Rand und hartem Schatten. Wer darüberfährt, zerkratzt es mit den Ski, bis zum nächsten Lauf. Deckkraft, Breite und Verwischen sind Regler im Tuning-Panel.
- **Fresh-Seite**: Meter, Laufzeit (unter einer Minute in Sekunden, sonst `1:34:07 Minuten`) und Durchschnittstempo des letzten Laufs, im Super-G Zeit, Tore und Durchschnittstempo ohne Strafzeit; Bestwert je Modus, Bestenliste (siehe unten), Moduswahl: unter „Fresh“ stehen drei Vorschauen, links immer Classic, daneben die zwei zuletzt gewählten oder gefahrenen Modi (ohne solche die nächsten vorhandenen). Die gewählte ist gelb, ein Tipp darauf startet den Lauf, ein Tipp auf eine andere wählt sie. „Modus auswählen“ öffnet die Kachel „Modus“ mit allen Modi und dem eigenen Bestwert, ein Tipp auf eine Zeile wählt.
- **Super-G**: Countdown mit drei kurzen und einem langen Piepton, ab dem langen läuft die Zeit. Beim App-Start wartet der Modus auf einen Tipp („Tippen zum Start“), nach Fresh zählt er von selbst. Das HUD zeigt die wirksame Zeit (Laufzeit plus Strafen), unter dem Fahrer erscheint kurz „Torfehler +3 s“ oder bei 250, 500 und 750 m die Differenz zur Bestzeit (grün schneller, rot langsamer). `P` pausiert auch den Countdown, der dann von vorn beginnt.
- Tastatur: `A`/`D` oder Pfeile, `P` Pause, `R`, Enter oder Leertaste Fresh (neuer Lauf; im Duell öffnen sie die Lobby). Auf dem iPhone gibt es keine Pause-Taste: anhalten heißt querstellen; beim Wechsel in den Hintergrund pausiert die App von selbst.
- **Tuning-Panel**: langer Druck auf das Versions-Label unten links. Werte bleiben gespeichert, „Standard“ setzt zurück.
- **Ton an/aus**: Lautsprecher-Icon oben rechts auf der Fresh-Seite (Gegenstück zum Fahrer-Icon links), bleibt gespeichert.
- **Fahrer**: das Icon oben links auf der Fresh-Seite öffnet die Fahrerwahl: Ski (Standard), Snowboard oder Schlitten. Die Wahl bleibt gespeichert (`powder.rider`) und ändert nur Aussehen und Spur: das Snowboard zieht eine breite Linie und stellt sich bei beiden Daumen quer statt in den Pflug, der Schlitten zieht zwei Kufen und bremst mit den Füßen. Physik und Bestenliste sind für alle gleich. Die Fahrer stehen in `src/riders.js`, ihre Zeichnung in `src/render.js`.

## Modi

- **Classic**: freie Abfahrt, so weit es geht. Mit zwei Easter Eggs: eines taucht nur selten und an wechselnden Stellen auf (`src/yeti.js`, bewusst ohne Regler und ohne Debug-Anzeige), das andere wartet sehr weit unten (`EVEREST_*` in `src/constants.js`).
- **Lawine** (intern und in der Datenbank `chase`): die Lawine hält ein Tempo (Pace), das mit der Laufzeit steigt (Standard 30 → 145 km/h in 90 Sekunden). Wer schneller ist, hält sie knapp über dem oberen Bildrand; wer langsamer wird, holt sie sich ins Bild. Gewertet wird das Tempo entlang der Ski (Regler „Schräg zählt Tempo“, Standard 100 %), nicht nur der Höhenverlust: wer schräg fährt und schneller als ihr Pace ist, bleibt sicher; bei 0 % zählt nur das Tempo hangabwärts. Wer langsamer als 40 km/h wird, etwa quergestellt, sieht sie nach 0,8 s am Bildrand erscheinen und heranrollen. Eine optionale Gnade beim Schuss (Regler „Gnade beim Schuss“, Standard 0 % = aus) lässt sie beim geraden Bergabfahren (bis 25° Fahrwinkel) nur einen Teil ihres Tempo-Vorsprungs ausspielen; je stärker die Kurve, desto weniger Gnade, ab 60° keine; der Schneepflug zählt nicht als Schuss. Bei 100 % gewinnt sie beim Schuss gar nicht mehr, das war in v0.10.0 zu leicht. Erwischt sie den Fahrer, zerspringt er wie beim Aufprall. Die Steuerung ist dieselbe wie in Classic.
- **Super-G**: Zeitfahren durch 21 Tore auf einer festen Strecke (fester Seed, `?seed=` überschreibt), Ziel nach 1000 m. Die Tore stehen ab 50 m alle 45 m abwechselnd links und rechts der Pistenmitte, abwechselnd rot und blau, mit 7,5 m Durchfahrt zwischen den beiden Stangen (Regler), die Tore stehen 10 m versetzt zur Pistenmitte (Regler). Gewertet wird beim Kreuzen der Torlinie: außen vorbei kostet 2 s Zeitstrafe (Regler), der Lauf geht weiter. Eine berührte Stange kostet 20 km/h (Regler), kein Sturz; sie kippt vom Fahrer weg, schwingt kurz hin und her und biegt sich dabei. Das Endtempo hat im Super-G einen eigenen Regler (bis 300 km/h, Standard 240), unabhängig vom Endtempo der anderen Modi. Die Piste ist 17 m je Seite (Regler) frei, außen stehen Bäume wie in Classic; wer sie trifft, hat keine Zeit („kein Ziel“). Nach dem Ziel gleitet der Fahrer aus, dann kommt die Fresh-Seite mit Gesamtzeit (Zeit plus Strafen), verpassten Toren und Bestzeit. Die Bestzeit und die Zwischenzeiten des besten Laufs bleiben gespeichert (`powder.besttime.superg`, `powder.bestsplits.superg`). Die Kurs-Regler (Torabstand, Torbreite, Torversatz, Pistenbreite) wirken ab dem nächsten Lauf und machen Zeiten untereinander unvergleichbar. Steuerung wie in Classic; die Tore und die Wertung stehen in `src/gates.js`.
- Die Lawine ist eine weiße Staubwolke (`src/avalanche-view.js`): eine Front aus runden, von oben links beleuchteten Wülsten mit blaugrauen Schattenseiten. Der Körper brodelt, an der Vorderkante kugeln immer neue Ballen heraus, davor stiebt Staub über den Schnee. Je näher sie kommt, desto milchiger wird das ganze Bild, Pulverschnee in der Luft.

### Duell

zwei iPhones fahren live dieselbe Strecke (gleicher Seed, Classic-Gelände) gegeneinander. Wer „Duell“ wählt, eröffnet einen Raum mit einem Code aus vier Buchstaben; der andere tippt den Code in seiner App ein (Zeile „Code · Beitreten“) oder öffnet den geteilten Link (`?room=CODE`, landet auf dem iPhone in Safari, deshalb ist der Code der Hauptweg). Die Lobby zeigt beide Startnummern, der Host stellt die Zielweite (1.000 bis 10.000 m in 500-m-Schritten), der Gast tippt „Bereit“, der Host „Los“: beide bekommen den Super-G-Countdown. Gewertet wird die eigene Zeit ab dem gemeinsamen Go bis zur Zielweite, gemessen mit der Wanduhr: Netzlaufzeit und Bildrate spielen keine Rolle, eine Pause kostet Zeit. Der Gegner fährt als halbtransparenter Geist mit Namensschild mit; ist er außer Sicht, steht ein Schild am unteren (er liegt vorn) oder oberen Bildrand mit dem Abstand, das HUD zeigt Abstand oder seine Vorgabe. Ein Sturz beendet den Lauf nicht: nach der Sturzpause (Regler, im Duell gilt der Wert des Hosts) geht es neben dem Hindernis mit Starttempo weiter, Stürze werden gezählt. Wer zuerst im Ziel ist, wartet; der andere fährt weiter, bis er die Zeit unterbietet oder seine Uhr darüber liegt. Das Ergebnis zeigt Sieger, beide Zeiten, Stürze und den lokalen Zähler gegen diesen Namen (`powder.duel`); „Revanche“ startet mit neuer Strecke im selben Raum. Im Duell stehen die Regler des Abschnitts „Fahren“ auf Standard, beide Geräte müssen dieselbe Version haben, die Bestenliste bleibt außen vor. Technik: ein Raum unter `/rooms/CODE` in derselben Firebase-Datenbank wie die Bestenliste (`src/room.js`, `src/duel.js`, `src/duel-card.js`), Positionen fünfmal pro Sekunde per `PATCH`, Lesen live per Event-Stream; Räume werden nicht aufgeräumt, nach zwei Stunden ohne Statuswechsel dürfen sie überschrieben werden. Die Regeln in `tools/firebase-rules.json` müssen nach v0.22.0 einmal neu veröffentlicht werden, sonst meldet die Lobby „Die Regeln für Räume fehlen“.

## Bestenliste

Die Fresh-Seite zeigt die fünf Besten des gewählten Modus (Rang, Name, Wert), der eigene Eintrag voll deckend;
liegt er außerhalb, steht er nach „…“ mit seinem Rang darunter. In Classic und Lawine zählt die Weite in Metern, im
Super-G die Gesamtzeit (Zeit plus Strafen, schnellste zuerst); dort zählt nur ein Lauf bis ins Ziel, ein Sturz
davor meldet nichts. Beim ersten Sturz fragt die Seite einmal nach einem Namen (2 bis 12 Zeichen), ein Tipp auf den
eigenen Eintrag ändert ihn. Die Identität ist der Name: gleiche Namen teilen sich einen Eintrag (auch von einem zweiten
Gerät), ein Eintrag wird nur durch einen besseren überschrieben, und wer sich umbenennt, lässt den alten Eintrag stehen
(Aufräumen in der Firebase-Konsole). Die Bestweiten der anderen liegen als graue Namenslinien im Schnee, beim Start des
Laufs eingefroren; die eigene rote Rekordlinie bleibt. Im Super-G gibt es keine Namenslinien, Zeiten lassen sich nicht in
den Hang legen. Welche Modi eine Liste haben und wie sie werten, steht in `MODES` (`board: 'm'` oder `'time'`,
`src/modes.js`). Läufe mit Tuning, `?seed=` oder `?debug=1` zählen lokal, aber nicht online (Hinweis unter der Liste);
der Regler „Auflösung“ ist ausgenommen, er ändert nur das Bild.
Offline zeigt die Liste den letzten bekannten Stand, ausstehende Bestwerte werden beim nächsten Start oder Lauf nachgeholt.

Ein Tipp auf die Liste (nicht auf die eigene Zeile, die ändert den Namen) öffnet die Detail-Kachel des gewählten Modus:
alle Einträge mit Rang, Name, Wert, Fahrzeit und Durchschnittstempo des besten Laufs, die Liste scrollt. In Classic
und Lawine ist das Tempo Weite durch Laufzeit, im Super-G 1000 m durch die reine Fahrzeit ohne Strafen (Spalten
„Gesamt“ und „Fahrzeit“). Beides kommt aus den Feldern `m` und `t`, die Datenbank bleibt unverändert.

Technik: Firebase Realtime Database per REST (`src/board.js`, kein SDK). Die Datenbank-URL steht in `BOARD_URL`
(`src/constants.js`), leer heißt aus. Ein Eintrag hat die Felder `name`, `m`, `t`, `ts`, `v`; `m` sind Meter, im Super-G
die Gesamtzeit in Hundertstel (`2712` = 27,12 s), `t` ist die Laufzeit in Sekunden, im Super-G die reine Fahrzeit ohne
Strafen. Die Regeln (`tools/firebase-rules.json`) lassen nur gültige Einträge zu, nur in Richtung besser (Meter nie
kleiner, Super-G-Zeit nie größer) und ohne Löschen; sie prüfen Form und Richtung, nicht Ehrlichkeit. Wer die URL kennt,
kann per Skript schreiben.

### Einrichtung

1. <https://console.firebase.google.com> → „Projekt hinzufügen“ → Name z. B. `powder` → Google Analytics deaktivieren → Erstellen.
2. „Build“ → „Realtime Database“ → „Datenbank erstellen“ → Standort Belgien (europe-west1) → „Im gesperrten Modus starten“.
3. Reiter „Regeln“ → Inhalt von `tools/firebase-rules.json` einfügen (alles ersetzen) → „Veröffentlichen“.
4. Reiter „Daten“ → URL oben kopieren (`https://….europe-west1.firebasedatabase.app`) → ohne Schluss-Slash in `BOARD_URL` eintragen → Version bumpen.
5. Firebase mailt regelmäßig „unsichere Regeln“, weil Schreiben ohne Anmeldung erlaubt ist. Das ist hier gewollt.

Regeln prüfen (`DB=https://…app`): ein gültiger `PUT` an `$DB/boards/classic/test.json` mit
`{"name":"Test","m":1234,"t":45.67,"ts":{".sv":"timestamp"},"v":"0.13.0"}` antwortet 200; derselbe mit `"m":1000`,
`"m":"1234"`, einem Feld mehr oder als `DELETE` antwortet 401 `Permission denied`. Für den Super-G entsprechend
`$DB/boards/superg/test.json` mit `"m":2712`: ein zweiter `PUT` mit `"m":2600` antwortet 200, mit `"m":2800` 401.
Für die Duell-Räume (ab v0.22.0): ein gültiger `PUT` an `$DB/rooms/TEST.json` (Felder wie in `src/room.js` `create`)
antwortet 200, derselbe noch einmal 401 (Raum belegt), `PATCH` mit `{"target":1234}` 401 und mit `{"target":1500}` 200,
`PATCH` an `…/live/host.json?print=silent` 204, `GET $DB/rooms.json` 401 (Räume sind nicht aufzählbar), `DELETE` 200.
Die Testeinträge danach in der Konsole löschen. Nach einer Regeländerung (etwa ein neuer Modus) den Inhalt von
`tools/firebase-rules.json` erneut im Reiter „Regeln“ einfügen und veröffentlichen; bis dahin lehnt der Server Einträge
des neuen Modus ab.

Ein Duell lokal testen: derselbe Mock-Server bedient auch `/rooms` (`tools/room-mock.js`, mit Event-Stream), im Browser
`?board=local`; als Gegner tritt `node tools/duel-bot.js http://localhost:8082 CODE --name Jo --crash 300` dem Raum bei,
meldet sich bereit und fährt beim Start mit; `--host` eröffnet stattdessen einen Raum. Ein zweites Browser-Fenster unter
`http://127.0.0.1:8082/?board=local&room=CODE` hat einen eigenen localStorage (eigener Name) und zeigt die Lobby als Gast,
fährt aber nicht mit, weil das unfokussierte Fenster pausiert.

Lokal ohne Firebase: `node tools/serve.js 8082 --board` startet einen Mock der Schnittstelle (`tools/board-mock.js`, mit
Beispielnamen), im Browser dann `?board=local`.

## Ton

Alles synthetisch über die Web Audio API (`src/audio.js`), keine Audiodateien. Der Ton beginnt mit der ersten Berührung, weil iOS ihn erst dann freigibt. Der Klingelschalter gilt wie bei nativen Spielen: auf lautlos bleibt die App stumm.

- **Wind**: Bergwind als ständiges Grundrauschen mit Böen und leisem Pfeifen, dazu Fahrtwind, der mit dem Tempo lauter und heller wird.
- **Ski**: Schneezischen mit dem Tempo, beim Carven tiefer und lauter. Antippen und Loslassen zischen kurz, Bremsen kratzt mit Rattern, der Schneepflug lauter und tiefer.
- **Lawine**: Grollen, das mit der Nähe lauter und heller wird, Knacken und Zischen, sobald sie im Bild ist, Krachen, wenn sie nach dem Stillstand losbricht. Nach dem Erwischen klingt sie aus.
- **Aufprall**: kurzer dumpfer Schlag, am Baum mit knappem Knacken, am Fels mit Klonk, an der Lawine schwerer.
- **Super-G**: Pieptöne des Countdowns (der lange ist das Go), ein kurzes Schlagen des Fähnchens beim Durchfahren, ein doppelter Buzzer beim Torfehler, Klacken an der Stange, Doppelton im Ziel (Countdown und Zielton auch im Duell). Beim App-Start ist der Ton erst nach dem ersten Tipp frei, deshalb wartet der Modus dort auf den Tipp.
- Lautstärke gesamt und je Gruppe im Tuning-Panel, Abschnitt „Ton“.

## Lokal starten

```bash
node tools/serve.js
```

Dann `http://localhost:8080` öffnen. Liefert 8080 einen alten Server aus einem anderen Checkout aus (`curl -s localhost:8080/src/constants.js | grep VERSION`), `node tools/serve.js 8090` nehmen; im Browser-Preview von Claude Code heißt diese Konfiguration `powder-8090`. Auf dem iPhone im selben WLAN die angezeigte IP-Adresse öffnen.
Nützliche Parameter: `?debug=1` (Overlay mit fps, Zeit für Rechnen, Zeichnen und HUD als Mittel/Maximum je Sekunde,
Leerlauf-Anteil, Hitboxen, Safe Lane), `?seed=42` (reproduzierbare Welt),
`?board=local` (Bestenliste und Duell-Räume gegen die Mocks, siehe oben), `?room=CODE` (öffnet direkt die Duell-Lobby dieses Raums).

## Tuning

Alle Stellschrauben stehen in `src/constants.js`; die Liste `TUNABLES` dort bestimmt die Regler im Panel (Abschnitte „Fahren“, „Lawine“: Tempo am Start und Ende, Anstiegsdauer, Lauerabstand, Stillstand-Schwelle und -Wartezeit, Fangabstand, Beben, Schräg zählt Tempo, Gnade beim Schuss, Gnade bis Winkel, volle Härte ab Winkel, Schuss schüttelt ab, „Super-G“: Torabstand, Torbreite, Torversatz, Piste frei je Seite, Zeitstrafe pro Tor, Stange kostet, Endtempo, „Duell“: Sturzpause, Geist-Verzögerung, „Bild“: Auflösung (Deckel für die Pixeldichte, Standard 2; kleiner ist weicher, aber schneller, und zählt nicht als Tuning für die Bestenliste), „Schriftzug“: Deckkraft, Breite, Verwischen, und „Ton“: Lautstärke gesamt, Wind, Ski und Kurven, Lawine, Aufprall, Super-G).
Ändern sich die Standardwerte, den Schlüssel `KEY` in `src/tune.js` hochzählen, sonst bleiben alte Regler-Werte auf dem iPhone aktiv.
Regler mit `fair: true` (der ganze Abschnitt „Fahren“) stehen während eines Duells auf Standard (`suspendTune` in `src/tune.js`), damit beide Geräte dieselbe Welt gleich schnell fahren; danach gelten wieder die gespeicherten Werte.

## Deploy (GitHub Pages)

1. Version bumpen: `tools/bump.sh 0.2.0` (setzt `src/constants.js` und `sw.js`, sonst bleibt der alte Cache auf dem iPhone)
2. `git commit` und `git push`
3. Auf dem iPhone die App zweimal öffnen, das Versions-Label unten links zeigt den Stand

## Fonts

Der Look folgt seit v0.16.0 dem Spiel [Don't Look Up](https://www.dontlookup.app): Papier und Tinte, harte
Versatz-Schatten, ungleiche Ecken. Alle Schriften liegen in `fonts/` und werden selbst gehostet:

- Luckiest Guy (Apache License 2.0), Quelle: Google Fonts. Display-Schrift für Zahlen, Titel, Buttons und die
  Schilder im Schnee (Meter-, Namens- und Rekordlinien, Start, Ziel, Credit). Die
  Referenz nutzt „FGD Marsipan“ (kostenpflichtig, fgdesigners.com) mit Luckiest Guy als Fallback; wer Marsipan kauft,
  legt sie in `fonts/` und trägt sie in `styles.css` vor Luckiest Guy ein.
- Nunito, variabel 400 bis 800 (SIL Open Font License), Quelle: Google Fonts. Textschrift.
