# Powder – Ski Simulator

Privater Nachbau des minimalistischen iOS-Ski-Spiels *Powder – Alpine Simulator* (2014) als Web-App für das iPhone.
Plain HTML + JavaScript + Canvas, kein Framework, kein Build.

## Spielen

- **Tippen** links/rechts: der Kurs schwingt weich auf den Tipp-Winkel ein, ganz kurze Tipps geben kleine Kurven. Bei hohem Tempo spricht der Fahrer etwas träger an (Gewicht auf den Skiern).
- **Halten**: der Winkel vertieft sich stetig bis über quer zum Hang, dann steht man.
- **Loslassen**: der Fahrer schwingt ohne Knick zurück zur Falllinie.
- Der Start hat schon Fahrt, ohne Eingabe wird man stetig schneller bis zum Endtempo. Kurze Tipps kosten kaum Tempo, Halten bremst hart, quer zum Hang bleibt man stehen.
- Bei hohem Tempo rückt der Fahrer im Bild nach oben und die Sicht zoomt leicht heraus (mehr Vorausschau).
- Tastatur: `A`/`D` oder Pfeile, `P` Pause, `R` Fresh
- **Tuning-Panel**: langer Druck auf das Versions-Label unten links. Werte bleiben gespeichert, „Standard“ setzt zurück.

## Lokal starten

```bash
node tools/serve.js
```

Dann `http://localhost:8080` öffnen. Auf dem iPhone im selben WLAN die angezeigte IP-Adresse öffnen.
Nützliche Parameter: `?debug=1` (Overlay mit fps, Hitboxen, Safe Lane), `?seed=42` (reproduzierbare Welt).

## Tuning

Alle Stellschrauben stehen in `src/constants.js`; die Liste `TUNABLES` dort bestimmt die Regler im Panel.
Ändern sich die Standardwerte, den Schlüssel `KEY` in `src/tune.js` hochzählen, sonst bleiben alte Regler-Werte auf dem iPhone aktiv.

## Deploy (GitHub Pages)

1. Version bumpen: `tools/bump.sh 0.2.0` (setzt `src/constants.js` und `sw.js`, sonst bleibt der alte Cache auf dem iPhone)
2. `git commit` und `git push`
3. Auf dem iPhone die App zweimal öffnen, das Versions-Label unten links zeigt den Stand

## Font

Playfair Display Italic (SIL Open Font License), Quelle: Google Fonts.
