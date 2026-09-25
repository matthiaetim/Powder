# Powder – Ski Simulator

Privater Nachbau des minimalistischen iOS-Ski-Spiels *Powder – Alpine Simulator* (2014) als Web-App für das iPhone.
Plain HTML + JavaScript + Canvas, kein Framework, kein Build.

## Spielen

- **Tippen** links/rechts: der Kurs schwingt weich auf den Tipp-Winkel ein, ganz kurze Tipps geben kleine Kurven.
- **Halten**: der Winkel vertieft sich stetig bis knapp über quer (95°). Ab etwa 25° bremst der Winkel, je querer, desto stärker, quer zum Hang bis zum Stillstand.
- **Loslassen**: der Fahrer schwingt ohne Knick zurück zur Falllinie.
- **Beide Daumen**: Schneepflug, bremst geradeaus. Bei hohem Tempo schwächer als Querstellen. Hebt man einen Daumen, lenkt der andere.
- **Bremsen**: vor allem der Winkel bremst, jede Kursänderung kostet zusätzlich etwas Tempo.
- Der Start hat schon Fahrt, ohne Eingabe wird man stetig schneller bis zum Endtempo. Kurze Tipps kosten kaum Tempo, Halten bremst hart, quer zum Hang bleibt man stehen.
- Bei hohem Tempo rückt der Fahrer im Bild nach oben und die Sicht zoomt leicht heraus (mehr Vorausschau).
- **Fresh-Seite**: Meter und Laufzeit des letzten Laufs (unter einer Minute in Sekunden, sonst `1:34:07 Minuten`), Bestwert je Modus, Moduswahl.
- Tastatur: `A`/`D` oder Pfeile, `P` Pause, `R` Fresh. Auf dem iPhone gibt es keine Pause-Taste: anhalten heißt querstellen; beim Wechsel in den Hintergrund pausiert die App von selbst.
- **Tuning-Panel**: langer Druck auf das Versions-Label unten links. Werte bleiben gespeichert, „Standard“ setzt zurück.

## Modi

- **Classic**: freie Abfahrt, so weit es geht.
- **Chase**: eine Lawine hält ein Tempo (Pace), das mit der Laufzeit steigt (Standard 30 → 140 km/h in drei Minuten). Wer schneller ist, hält sie knapp über dem oberen Bildrand; wer langsamer wird, holt sie sich ins Bild. Wer stehen bleibt (querstellen und halten), sieht sie nach 1,5 s am Bildrand erscheinen und heranrollen. Erwischt sie den Fahrer, zerspringt er wie beim Aufprall. Die Steuerung ist dieselbe wie in Classic.
- Drei Looks der Lawine stehen im Tuning zur Wahl (`src/avalanche-view.js`): **Wolke** (weiße Schneewolke mit Schattenrand und Staub), **Schatten** (Schleier aus Schiefergrau mit Fahnen, das Bild dämmert), **Bruch** (Platte mit Pixel-Bruchkante, rollende Brocken wie die Splitter beim Aufprall).

## Lokal starten

```bash
node tools/serve.js
```

Dann `http://localhost:8080` öffnen. Auf dem iPhone im selben WLAN die angezeigte IP-Adresse öffnen.
Nützliche Parameter: `?debug=1` (Overlay mit fps, Hitboxen, Safe Lane), `?seed=42` (reproduzierbare Welt).

## Tuning

Alle Stellschrauben stehen in `src/constants.js`; die Liste `TUNABLES` dort bestimmt die Regler im Panel (Abschnitte „Fahren“ und „Lawine (Chase)“: Look, Tempo am Start und Ende, Anstiegsdauer, Lauerabstand, Stillstand-Schwelle und -Wartezeit, Fangabstand, Beben).
Ändern sich die Standardwerte, den Schlüssel `KEY` in `src/tune.js` hochzählen, sonst bleiben alte Regler-Werte auf dem iPhone aktiv.

## Deploy (GitHub Pages)

1. Version bumpen: `tools/bump.sh 0.2.0` (setzt `src/constants.js` und `sw.js`, sonst bleibt der alte Cache auf dem iPhone)
2. `git commit` und `git push`
3. Auf dem iPhone die App zweimal öffnen, das Versions-Label unten links zeigt den Stand

## Font

Playfair Display Italic (SIL Open Font License), Quelle: Google Fonts.
