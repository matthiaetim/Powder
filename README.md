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
- **Fresh-Seite**: Meter und Laufzeit des letzten Laufs (unter einer Minute in Sekunden, sonst `1:34:07 Minuten`), Bestwert je Modus, Moduswahl.
- Tastatur: `A`/`D` oder Pfeile, `P` Pause, `R`, Enter oder Leertaste Fresh (neuer Lauf). Auf dem iPhone gibt es keine Pause-Taste: anhalten heißt querstellen; beim Wechsel in den Hintergrund pausiert die App von selbst.
- **Tuning-Panel**: langer Druck auf das Versions-Label unten links. Werte bleiben gespeichert, „Standard“ setzt zurück.
- **Ton an/aus**: Schalter unten auf der Fresh-Seite, bleibt gespeichert.

## Modi

- **Classic**: freie Abfahrt, so weit es geht.
- **Chase**: eine Lawine hält ein Tempo (Pace), das mit der Laufzeit steigt (Standard 30 → 145 km/h in 90 Sekunden). Wer schneller ist, hält sie knapp über dem oberen Bildrand; wer langsamer wird, holt sie sich ins Bild. Wer langsamer als 40 km/h wird, etwa quergestellt, sieht sie nach 0,8 s am Bildrand erscheinen und heranrollen. Wer gerade bergab fährt (Schuss, bis 25° Fahrwinkel), ist vor ihr sicher: sie gewinnt dann nicht auf ihn und fällt langsam zurück. Je stärker die Kurve, desto mehr Tempo spielt sie aus, ab 60° ganz; der Schneepflug zählt nicht als Schuss. Erwischt sie den Fahrer, zerspringt er wie beim Aufprall. Die Steuerung ist dieselbe wie in Classic.
- Die Lawine ist ein Schatten (`src/avalanche-view.js`): ein Schleier aus Schiefergrau, dessen Rand mit weichen dunklen Wülsten wogt, davor züngeln dünne Schattenfahnen. Je näher sie kommt, desto dämmriger wird das ganze Bild.

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
Nützliche Parameter: `?debug=1` (Overlay mit fps, Hitboxen, Safe Lane), `?seed=42` (reproduzierbare Welt).

## Tuning

Alle Stellschrauben stehen in `src/constants.js`; die Liste `TUNABLES` dort bestimmt die Regler im Panel (Abschnitte „Fahren“, „Lawine (Chase)“: Tempo am Start und Ende, Anstiegsdauer, Lauerabstand, Stillstand-Schwelle und -Wartezeit, Fangabstand, Beben, Gnade bis Winkel, volle Härte ab Winkel, Schuss schüttelt ab, und „Ton“: Lautstärke gesamt, Wind, Ski und Kurven, Lawine, Aufprall).
Ändern sich die Standardwerte, den Schlüssel `KEY` in `src/tune.js` hochzählen, sonst bleiben alte Regler-Werte auf dem iPhone aktiv.

## Deploy (GitHub Pages)

1. Version bumpen: `tools/bump.sh 0.2.0` (setzt `src/constants.js` und `sw.js`, sonst bleibt der alte Cache auf dem iPhone)
2. `git commit` und `git push`
3. Auf dem iPhone die App zweimal öffnen, das Versions-Label unten links zeigt den Stand

## Font

Playfair Display Italic (SIL Open Font License), Quelle: Google Fonts.
