# Powder – Regeln für Claude Code

Web-Nachbau des Ski-Spiels *Powder* fürs iPhone. Plain HTML, JavaScript, Canvas. Kein Framework, kein Build, keine
Abhängigkeiten. Alles Wichtige zum Spiel und zur Steuerung steht in der [README](README.md), diese Datei regelt nur,
wie hier gearbeitet wird. Zwei Entwickler arbeiten mit eigenem Rechner und eigener Claude-Code-Session am selben Repo.

## Sprache und Stil

- Deutsch: Antworten, Commit-Messages, Kommentare im Code, Regler-Namen, README.
- Kommentare erklären, warum etwas so ist, nicht was die Zeile tut. Einheiten sind Meter, Sekunden, Grad, km/h nur
  in Konstanten und Anzeige.
- Alle Stellschrauben stehen in `src/constants.js`. Neue Zahlen nicht im Code verstreuen, sondern dort mit Kommentar
  anlegen. Was der Spieler im Tuning-Panel verstellen soll, kommt zusätzlich in die Liste `TUNABLES`.
- Kein Framework, kein Bundler, keine npm-Pakete einführen. Die App muss als statische Dateien über GitHub Pages laufen.

## Git: beide pushen direkt auf `main`

Es gibt keine Pull Requests und keinen Review-Schritt. Beide Entwickler haben Schreibrecht und pushen direkt auf
`main`. Damit das nicht kracht, gilt vor jedem Push, ohne Ausnahme:

1. `git fetch origin` und prüfen, ob `origin/main` neue Commits hat.
2. Wenn ja: die eigenen Commits mit `git rebase origin/main` darauf setzen. Aus einem Worktree heraus wird mit
   `git push origin HEAD:main` gepusht.
3. Gibt es beim Rebase einen Konflikt: **anhalten und den Entwickler darauf hinweisen**, welche Dateien und Stellen
   betroffen sind und was der andere dort geändert hat. Konflikte nur mit Absprache des Entwicklers lösen, nie still
   eine Seite verwerfen.
4. Nie `git push --force` auf `main`. Nie einen Commit des anderen umschreiben oder zurücksetzen.
5. Pushen nur, wenn der Entwickler es ausdrücklich sagt („Push“). Vorher lokal committen, den Stand kurz
   beschreiben und den Push anbieten.

Der Verlauf auf `main` ist linear, ein Commit pro Version. Wer zwischendurch experimentiert, macht das auf einem
Branch oder in einem Worktree und bringt am Ende einen sauberen Versions-Commit auf `main`.

## Versionen und Deploy

Die App wird über GitHub Pages direkt aus `main` ausgeliefert: <https://matthiaetim.github.io/Powder/>. Ein Push
auf `main` ist damit ein Deploy, der Pages-Build braucht ein bis drei Minuten.

- Jede Änderung an App-Dateien (`index.html`, `styles.css`, `src/`, `sw.js`, `icons/`, `manifest.webmanifest`) bekommt
  eine neue Versionsnummer. Ohne Bump bleibt auf dem iPhone der alte Service-Worker-Cache aktiv und die Änderung kommt
  nie an. Nur Repo-Dateien wie README oder CLAUDE.md brauchen keinen Bump.
- Version setzen mit `tools/bump.sh X.Y.Z`, das schreibt `src/constants.js` und `sw.js`. Patch für Feinschliff und
  Tuning, Minor für neue Funktionen.
- **Vor dem Bump die Nummer gegen `origin/main` prüfen** (`git show origin/main:src/constants.js | grep VERSION`).
  Der andere Entwickler kann die nächste Nummer schon vergeben haben, dann die darauffolgende nehmen. Zwei
  verschiedene Stände mit derselben Nummer erkennt der Service Worker nicht als Update.
- Commit-Message: erste Zeile `vX.Y.Z: Kurzbeschreibung`, darunter Stichpunkte, was sich für den Spieler ändert.
- Nach dem Push prüfen, ob es live ist:
  `curl -s https://matthiaetim.github.io/Powder/src/constants.js | grep VERSION`
- Auf dem iPhone die App danach neu laden oder zweimal öffnen, das Versions-Label unten links zeigt den Stand.

## Tuning-Panel

Langer Druck auf das Versions-Label öffnet ein verstecktes Panel mit Reglern. Es bleibt bewusst im Spiel, auch in
Versionen, die mit anderen geteilt werden. Nicht entfernen und nicht „aufräumen“ vorschlagen.

- Getunt wird am iPhone. Die abgelesenen Werte werden dann als Standard in `src/constants.js` eingetragen.
- Ändern sich Standardwerte bestehender Regler, den Schlüssel `KEY` in `src/tune.js` hochzählen (`v10` → `v11`),
  sonst bleiben alte gespeicherte Regler-Werte auf dem iPhone aktiv. Ein neuer Regler allein braucht das nicht,
  er startet mit seinem Standard.
- Erleichterungen in der Spielmechanik, etwa bei der Lawine, kommen als Regler mit Standard aus, nicht als festes
  Verhalten.

## Lokal testen

- Server: `node tools/serve.js 8080`, dann `http://localhost:8080`. Im Browser-Preview von Claude Code steht die
  Konfiguration `powder` in `.claude/launch.json`.
- Port 8080 kann von einem alten Server aus einem anderen Checkout belegt sein, der eine alte Version ausliefert.
  Vor dem Test `curl -s localhost:8080/src/constants.js | grep VERSION` mit der eigenen `src/constants.js`
  vergleichen. Weicht es ab, einen anderen Port nehmen; im Preview gibt es dafür die Konfiguration `powder-8090`.
- Nützliche Parameter: `?debug=1` (Overlay mit fps, Hitboxen, Lawinen-Werten), `?seed=42` (reproduzierbare Welt).
- Bestenliste ohne Firebase testen: `node tools/serve.js 8082 --board` startet den Mock der Datenbank-Schnittstelle
  (`tools/board-mock.js`, Preview-Konfiguration `powder-board`), im Browser dann `?board=local`. Die echte
  Datenbank steht in `BOARD_URL` (`src/constants.js`), die Regeln in `tools/firebase-rules.json`, Anleitung in der README.
- Spielmechanik, die sich nicht im Browser prüfen lässt, per kleiner Node-Simulation gegen die Module in `src/`
  durchrechnen (sie sind reine ES-Module) und die Zahlen in der Antwort zeigen.

## Icons

Die PNGs in `icons/` werden aus `icons/icon.svg` gerendert, es gibt kein Skript dafür:
`qlmanage -t -s 512 -o <ordner> icons/icon.svg` liefert `<ordner>/icon.svg.png`, entsprechend für 192 und 180.
iOS lädt das Home-Screen-Icon nur beim Hinzufügen. Nach einer Icon-Änderung muss die App vom Home-Bildschirm entfernt
und neu hinzugefügt werden, sonst sieht man das alte Icon.
