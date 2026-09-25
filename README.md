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
- **Credit bei 333 m**: ein Schriftzug, wie in den Schnee gefräst, quer über die Korridor-Mitte. Wer darüberfährt, radiert ihn mit den Ski aus, bis zum nächsten Lauf. Deckkraft, Breite und Verwischen sind Regler im Tuning-Panel.
- **Fresh-Seite**: Meter und Laufzeit des letzten Laufs (unter einer Minute in Sekunden, sonst `1:34:07 Minuten`), Bestwert je Modus, Bestenliste (siehe unten), Moduswahl.
- Tastatur: `A`/`D` oder Pfeile, `P` Pause, `R`, Enter oder Leertaste Fresh (neuer Lauf). Auf dem iPhone gibt es keine Pause-Taste: anhalten heißt querstellen; beim Wechsel in den Hintergrund pausiert die App von selbst.
- **Tuning-Panel**: langer Druck auf das Versions-Label unten links. Werte bleiben gespeichert, „Standard“ setzt zurück.
- **Ton an/aus**: Schalter unten auf der Fresh-Seite, bleibt gespeichert.

## Modi

- **Classic**: freie Abfahrt, so weit es geht.
- **Chase**: eine Lawine hält ein Tempo (Pace), das mit der Laufzeit steigt (Standard 30 → 145 km/h in 90 Sekunden). Wer schneller ist, hält sie knapp über dem oberen Bildrand; wer langsamer wird, holt sie sich ins Bild. Gewertet wird das Tempo entlang der Ski (Regler „Schräg zählt Tempo“, Standard 100 %), nicht nur der Höhenverlust: wer schräg fährt und schneller als ihr Pace ist, bleibt sicher; bei 0 % zählt nur das Tempo hangabwärts. Wer langsamer als 40 km/h wird, etwa quergestellt, sieht sie nach 0,8 s am Bildrand erscheinen und heranrollen. Eine optionale Gnade beim Schuss (Regler „Gnade beim Schuss“, Standard 0 % = aus) lässt sie beim geraden Bergabfahren (bis 25° Fahrwinkel) nur einen Teil ihres Tempo-Vorsprungs ausspielen; je stärker die Kurve, desto weniger Gnade, ab 60° keine; der Schneepflug zählt nicht als Schuss. Bei 100 % gewinnt sie beim Schuss gar nicht mehr, das war in v0.10.0 zu leicht. Erwischt sie den Fahrer, zerspringt er wie beim Aufprall. Die Steuerung ist dieselbe wie in Classic.
- Die Lawine ist ein Schatten (`src/avalanche-view.js`): ein Schleier aus Schiefergrau, dessen Rand mit weichen dunklen Wülsten wogt, davor züngeln dünne Schattenfahnen. Je näher sie kommt, desto dämmriger wird das ganze Bild.

## Bestenliste

Die Fresh-Seite zeigt die fünf besten Weiten des gewählten Modus (Rang, Name, Meter), der eigene Eintrag voll deckend;
liegt er außerhalb, steht er nach „…“ mit seinem Rang darunter. Beim ersten Sturz fragt die Seite einmal nach einem
Namen (2 bis 12 Zeichen), ein Tipp auf den eigenen Eintrag ändert ihn. Die Identität ist der Name: gleiche Namen teilen
sich einen Eintrag (auch von einem zweiten Gerät), ein Eintrag wird nur nach oben überschrieben, und wer sich umbenennt,
lässt den alten Eintrag stehen (Aufräumen in der Firebase-Konsole). Die Bestweiten der anderen liegen als graue
Namenslinien im Schnee, beim Start des Laufs eingefroren; die eigene rote Rekordlinie bleibt. Läufe mit Tuning, `?seed=`
oder `?debug=1` zählen lokal, aber nicht online (Hinweis unter der Liste). Offline zeigt die Liste den letzten bekannten
Stand, ausstehende Bestweiten werden beim nächsten Start oder Sturz nachgeholt.

Technik: Firebase Realtime Database per REST (`src/board.js`, kein SDK). Die Datenbank-URL steht in `BOARD_URL`
(`src/constants.js`), leer heißt aus. Die Regeln (`tools/firebase-rules.json`) lassen nur gültige Einträge zu, nur nach
oben und ohne Löschen; sie prüfen Form und Richtung, nicht Ehrlichkeit. Wer die URL kennt, kann per Skript schreiben.

### Einrichtung

1. <https://console.firebase.google.com> → „Projekt hinzufügen“ → Name z. B. `powder` → Google Analytics deaktivieren → Erstellen.
2. „Build“ → „Realtime Database“ → „Datenbank erstellen“ → Standort Belgien (europe-west1) → „Im gesperrten Modus starten“.
3. Reiter „Regeln“ → Inhalt von `tools/firebase-rules.json` einfügen (alles ersetzen) → „Veröffentlichen“.
4. Reiter „Daten“ → URL oben kopieren (`https://….europe-west1.firebasedatabase.app`) → ohne Schluss-Slash in `BOARD_URL` eintragen → Version bumpen.
5. Firebase mailt regelmäßig „unsichere Regeln“, weil Schreiben ohne Anmeldung erlaubt ist. Das ist hier gewollt.

Regeln prüfen (`DB=https://…app`): ein gültiger `PUT` an `$DB/boards/classic/test.json` mit
`{"name":"Test","m":1234,"t":45.67,"ts":{".sv":"timestamp"},"v":"0.13.0"}` antwortet 200; derselbe mit `"m":1000`,
`"m":"1234"`, einem Feld mehr oder als `DELETE` antwortet 401 `Permission denied`. Den Testeintrag danach in der Konsole löschen.

Lokal ohne Firebase: `node tools/serve.js 8082 --board` startet einen Mock der Schnittstelle (`tools/board-mock.js`, mit
Beispielnamen), im Browser dann `?board=local`.

## Ton

Alles synthetisch über die Web Audio API (`src/audio.js`), keine Audiodateien. Der Ton beginnt mit der ersten Berührung, weil iOS ihn erst dann freigibt. Der Klingelschalter gilt wie bei nativen Spielen: auf lautlos bleibt die App stumm.

- **Wind**: Bergwind als ständiges Grundrauschen mit Böen und leisem Pfeifen, dazu Fahrtwind, der mit dem Tempo lauter und heller wird.
- **Ski**: Schneezischen mit dem Tempo, beim Carven tiefer und lauter. Antippen und Loslassen zischen kurz, Bremsen kratzt mit Rattern, der Schneepflug lauter und tiefer.
- **Lawine (Chase)**: Grollen, das mit der Nähe lauter und heller wird, Knacken und Zischen, sobald sie im Bild ist, Krachen, wenn sie nach dem Stillstand losbricht. Nach dem Erwischen klingt sie aus.
- **Aufprall**: kurzer dumpfer Schlag, am Baum mit knappem Knacken, am Fels mit Klonk, an der Lawine schwerer.
- Lautstärke gesamt und je Gruppe im Tuning-Panel, Abschnitt „Ton“.

## Lokal starten

```bash
node tools/serve.js
```

Dann `http://localhost:8080` öffnen. Auf dem iPhone im selben WLAN die angezeigte IP-Adresse öffnen.
Nützliche Parameter: `?debug=1` (Overlay mit fps, Hitboxen, Safe Lane), `?seed=42` (reproduzierbare Welt),
`?board=local` (Bestenliste gegen den Mock, siehe oben).

## Tuning

Alle Stellschrauben stehen in `src/constants.js`; die Liste `TUNABLES` dort bestimmt die Regler im Panel (Abschnitte „Fahren“, „Lawine (Chase)“: Tempo am Start und Ende, Anstiegsdauer, Lauerabstand, Stillstand-Schwelle und -Wartezeit, Fangabstand, Beben, Schräg zählt Tempo, Gnade beim Schuss, Gnade bis Winkel, volle Härte ab Winkel, Schuss schüttelt ab, und „Ton“: Lautstärke gesamt, Wind, Ski und Kurven, Lawine, Aufprall).
Ändern sich die Standardwerte, den Schlüssel `KEY` in `src/tune.js` hochzählen, sonst bleiben alte Regler-Werte auf dem iPhone aktiv.

## Deploy (GitHub Pages)

1. Version bumpen: `tools/bump.sh 0.2.0` (setzt `src/constants.js` und `sw.js`, sonst bleibt der alte Cache auf dem iPhone)
2. `git commit` und `git push`
3. Auf dem iPhone die App zweimal öffnen, das Versions-Label unten links zeigt den Stand

## Font

Playfair Display Italic (SIL Open Font License), Quelle: Google Fonts.
