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
- **Fresh-Seite**: Meter und Laufzeit des letzten Laufs (unter einer Minute in Sekunden, sonst `1:34:07 Minuten`), Bestwert je Modus, Bestenliste (siehe unten), Moduswahl.
- **Fresh-Seite**: Meter und Laufzeit des letzten Laufs (unter einer Minute in Sekunden, sonst `1:34:07 Minuten`), Bestwert je Modus, Moduswahl.
- **Super-G**: Countdown mit drei kurzen und einem langen Piepton, ab dem langen läuft die Zeit. Beim App-Start wartet der Modus auf einen Tipp („Tippen zum Start“), nach Fresh zählt er von selbst. Das HUD zeigt die wirksame Zeit (Laufzeit plus Strafen), unter dem Fahrer erscheint kurz „Torfehler +3 s“ oder bei 250, 500 und 750 m die Differenz zur Bestzeit (grün schneller, rot langsamer). `P` pausiert auch den Countdown, der dann von vorn beginnt.
- Tastatur: `A`/`D` oder Pfeile, `P` Pause, `R`, Enter oder Leertaste Fresh (neuer Lauf). Auf dem iPhone gibt es keine Pause-Taste: anhalten heißt querstellen; beim Wechsel in den Hintergrund pausiert die App von selbst.
- **Tuning-Panel**: langer Druck auf das Versions-Label unten links. Werte bleiben gespeichert, „Standard“ setzt zurück.
- **Ton an/aus**: Schalter unten auf der Fresh-Seite, bleibt gespeichert.
- **Fahrer**: das Icon oben links auf der Fresh-Seite öffnet die Fahrerwahl: Ski (Standard), Snowboard oder Schlitten. Die Wahl bleibt gespeichert (`powder.rider`) und ändert nur Aussehen und Spur: das Snowboard zieht eine breite Linie und stellt sich bei beiden Daumen quer statt in den Pflug, der Schlitten zieht zwei Kufen und bremst mit den Füßen. Physik und Bestenliste sind für alle gleich. Die Fahrer stehen in `src/riders.js`, ihre Zeichnung in `src/render.js`.

## Modi

- **Classic**: freie Abfahrt, so weit es geht. Mit zwei Easter Eggs: eines taucht nur selten und an wechselnden Stellen auf (`src/yeti.js`, bewusst ohne Regler und ohne Debug-Anzeige), das andere wartet sehr weit unten (`EVEREST_*` in `src/constants.js`).
- **Chase**: eine Lawine hält ein Tempo (Pace), das mit der Laufzeit steigt (Standard 30 → 145 km/h in 90 Sekunden). Wer schneller ist, hält sie knapp über dem oberen Bildrand; wer langsamer wird, holt sie sich ins Bild. Gewertet wird das Tempo entlang der Ski (Regler „Schräg zählt Tempo“, Standard 100 %), nicht nur der Höhenverlust: wer schräg fährt und schneller als ihr Pace ist, bleibt sicher; bei 0 % zählt nur das Tempo hangabwärts. Wer langsamer als 40 km/h wird, etwa quergestellt, sieht sie nach 0,8 s am Bildrand erscheinen und heranrollen. Eine optionale Gnade beim Schuss (Regler „Gnade beim Schuss“, Standard 0 % = aus) lässt sie beim geraden Bergabfahren (bis 25° Fahrwinkel) nur einen Teil ihres Tempo-Vorsprungs ausspielen; je stärker die Kurve, desto weniger Gnade, ab 60° keine; der Schneepflug zählt nicht als Schuss. Bei 100 % gewinnt sie beim Schuss gar nicht mehr, das war in v0.10.0 zu leicht. Erwischt sie den Fahrer, zerspringt er wie beim Aufprall. Die Steuerung ist dieselbe wie in Classic.
- **Super-G**: Zeitfahren durch 21 Tore auf einer festen Strecke (fester Seed, `?seed=` überschreibt), Ziel nach 1000 m. Die Tore stehen ab 50 m alle 45 m abwechselnd links und rechts der Pistenmitte, abwechselnd rot und blau, mit 7,5 m Durchfahrt zwischen den beiden Stangen (Regler), die Tore stehen 10 m versetzt zur Pistenmitte (Regler). Gewertet wird beim Kreuzen der Torlinie: außen vorbei kostet 2 s Zeitstrafe (Regler), der Lauf geht weiter. Eine berührte Stange kostet 20 km/h (Regler), kein Sturz; sie kippt vom Fahrer weg, schwingt kurz hin und her und biegt sich dabei. Das Endtempo hat im Super-G einen eigenen Regler (bis 300 km/h, Standard 240), unabhängig vom Endtempo der anderen Modi. Die Piste ist 17 m je Seite (Regler) frei, außen stehen Bäume wie in Classic; wer sie trifft, hat keine Zeit („kein Ziel“). Nach dem Ziel gleitet der Fahrer aus, dann kommt die Fresh-Seite mit Gesamtzeit (Zeit plus Strafen), verpassten Toren und Bestzeit. Die Bestzeit und die Zwischenzeiten des besten Laufs bleiben gespeichert (`powder.besttime.superg`, `powder.bestsplits.superg`). Die Kurs-Regler (Torabstand, Torbreite, Torversatz, Pistenbreite) wirken ab dem nächsten Lauf und machen Zeiten untereinander unvergleichbar. Steuerung wie in Classic; die Tore und die Wertung stehen in `src/gates.js`.
- Die Lawine ist ein Schatten (`src/avalanche-view.js`): ein Schleier aus Schiefergrau, dessen Rand mit weichen dunklen Wülsten wogt, davor züngeln dünne Schattenfahnen. Je näher sie kommt, desto dämmriger wird das ganze Bild.

## Bestenliste

Die Fresh-Seite zeigt die fünf Besten des gewählten Modus (Rang, Name, Wert), der eigene Eintrag voll deckend;
liegt er außerhalb, steht er nach „…“ mit seinem Rang darunter. In Classic und Chase zählt die Weite in Metern, im
Super-G die Gesamtzeit (Zeit plus Strafen, schnellste zuerst); dort zählt nur ein Lauf bis ins Ziel, ein Sturz
davor meldet nichts. Beim ersten Sturz fragt die Seite einmal nach einem Namen (2 bis 12 Zeichen), ein Tipp auf den
eigenen Eintrag ändert ihn. Die Identität ist der Name: gleiche Namen teilen sich einen Eintrag (auch von einem zweiten
Gerät), ein Eintrag wird nur durch einen besseren überschrieben, und wer sich umbenennt, lässt den alten Eintrag stehen
(Aufräumen in der Firebase-Konsole). Die Bestweiten der anderen liegen als graue Namenslinien im Schnee, beim Start des
Laufs eingefroren; die eigene rote Rekordlinie bleibt. Im Super-G gibt es keine Namenslinien, Zeiten lassen sich nicht in
den Hang legen. Welche Modi eine Liste haben und wie sie werten, steht in `MODES` (`board: 'm'` oder `'time'`,
`src/modes.js`). Läufe mit Tuning, `?seed=` oder `?debug=1` zählen lokal, aber nicht online (Hinweis unter der Liste).
Offline zeigt die Liste den letzten bekannten Stand, ausstehende Bestwerte werden beim nächsten Start oder Lauf nachgeholt.

Ein Tipp auf die Liste (nicht auf die eigene Zeile, die ändert den Namen) öffnet die Detail-Kachel des gewählten Modus:
alle Einträge mit Rang, Name, Wert, Fahrzeit und Durchschnittstempo des besten Laufs, die Liste scrollt. In Classic
und Chase ist das Tempo Weite durch Laufzeit, im Super-G 1000 m durch die reine Fahrzeit ohne Strafen (Spalten
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
Die Testeinträge danach in der Konsole löschen. Nach einer Regeländerung (etwa ein neuer Modus) den Inhalt von
`tools/firebase-rules.json` erneut im Reiter „Regeln“ einfügen und veröffentlichen; bis dahin lehnt der Server Einträge
des neuen Modus ab.

Lokal ohne Firebase: `node tools/serve.js 8082 --board` startet einen Mock der Schnittstelle (`tools/board-mock.js`, mit
Beispielnamen), im Browser dann `?board=local`.

## Ton

Alles synthetisch über die Web Audio API (`src/audio.js`), keine Audiodateien. Der Ton beginnt mit der ersten Berührung, weil iOS ihn erst dann freigibt. Der Klingelschalter gilt wie bei nativen Spielen: auf lautlos bleibt die App stumm.

- **Wind**: Bergwind als ständiges Grundrauschen mit Böen und leisem Pfeifen, dazu Fahrtwind, der mit dem Tempo lauter und heller wird.
- **Ski**: Schneezischen mit dem Tempo, beim Carven tiefer und lauter. Antippen und Loslassen zischen kurz, Bremsen kratzt mit Rattern, der Schneepflug lauter und tiefer.
- **Lawine (Chase)**: Grollen, das mit der Nähe lauter und heller wird, Knacken und Zischen, sobald sie im Bild ist, Krachen, wenn sie nach dem Stillstand losbricht. Nach dem Erwischen klingt sie aus.
- **Aufprall**: kurzer dumpfer Schlag, am Baum mit knappem Knacken, am Fels mit Klonk, an der Lawine schwerer.
- **Super-G**: Pieptöne des Countdowns (der lange ist das Go), ein kurzes Schlagen des Fähnchens beim Durchfahren, ein doppelter Buzzer beim Torfehler, Klacken an der Stange, Doppelton im Ziel. Beim App-Start ist der Ton erst nach dem ersten Tipp frei, deshalb wartet der Modus dort auf den Tipp.
- Lautstärke gesamt und je Gruppe im Tuning-Panel, Abschnitt „Ton“.

## Lokal starten

```bash
node tools/serve.js
```

Dann `http://localhost:8080` öffnen. Liefert 8080 einen alten Server aus einem anderen Checkout aus (`curl -s localhost:8080/src/constants.js | grep VERSION`), `node tools/serve.js 8090` nehmen; im Browser-Preview von Claude Code heißt diese Konfiguration `powder-8090`. Auf dem iPhone im selben WLAN die angezeigte IP-Adresse öffnen.
Nützliche Parameter: `?debug=1` (Overlay mit fps, Hitboxen, Safe Lane), `?seed=42` (reproduzierbare Welt),
`?board=local` (Bestenliste gegen den Mock, siehe oben).

## Tuning

Alle Stellschrauben stehen in `src/constants.js`; die Liste `TUNABLES` dort bestimmt die Regler im Panel (Abschnitte „Fahren“, „Lawine (Chase)“: Tempo am Start und Ende, Anstiegsdauer, Lauerabstand, Stillstand-Schwelle und -Wartezeit, Fangabstand, Beben, Schräg zählt Tempo, Gnade beim Schuss, Gnade bis Winkel, volle Härte ab Winkel, Schuss schüttelt ab, „Super-G“: Torabstand, Torbreite, Torversatz, Piste frei je Seite, Zeitstrafe pro Tor, Stange kostet, Endtempo, „Schriftzug“: Deckkraft, Breite, Verwischen, und „Ton“: Lautstärke gesamt, Wind, Ski und Kurven, Lawine, Aufprall, Super-G).
Ändern sich die Standardwerte, den Schlüssel `KEY` in `src/tune.js` hochzählen, sonst bleiben alte Regler-Werte auf dem iPhone aktiv.

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
