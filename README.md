# Powder – Ski Simulator

Privater Nachbau des minimalistischen iOS-Ski-Spiels *Powder – Alpine Simulator* (2014) als Web-App für das iPhone.
Plain HTML + JavaScript + Canvas, kein Framework, kein Build.

## Spielen

- **Tippen** links/rechts: kleine Richtungsänderung
- **Halten**: tiefer Carving-Schwung (bremst)
- **Doppeltipp**: Sprung (überspringt Felsen, nicht Bäume)
- Tastatur: `A`/`D` oder Pfeile, `Space` Sprung, `P` Pause, `R` Fresh

## Lokal starten

```bash
node tools/serve.js
```

Dann `http://localhost:8080` öffnen. Auf dem iPhone im selben WLAN die angezeigte IP-Adresse öffnen.
Nützliche Parameter: `?debug=1` (Overlay mit fps, Hitboxen, Safe Lane), `?seed=42` (reproduzierbare Welt).

## Tuning

Alle Stellschrauben stehen in `src/constants.js`.

## Deploy (GitHub Pages)

1. Version bumpen: `tools/bump.sh 0.2.0` (setzt `src/constants.js` und `sw.js`, sonst bleibt der alte Cache auf dem iPhone)
2. `git commit` und `git push`
3. Auf dem iPhone die App zweimal öffnen, das Versions-Label unten links zeigt den Stand

## Font

Playfair Display Italic (SIL Open Font License), Quelle: Google Fonts.
