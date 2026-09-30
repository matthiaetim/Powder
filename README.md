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
- **Super-G**: Countdown mit drei kurzen und einem langen Piepton, ab dem langen läuft die Zeit. Beim App-Start wartet der Modus auf einen Tipp („Tippen zum Start“), nach Fresh zählt er von selbst. Das HUD zeigt die wirksame Zeit (Laufzeit plus Strafen), unter dem Fahrer erscheint kurz „Torfehler +3 s“ oder an den Zeit-Toren (Tor 2, 5, 8, 11, 14 und 17, markiert mit Fleck und Linie im Schnee) die Differenz zum schnellsten eigenen Lauf (grün schneller, rot langsamer). `P` pausiert auch den Countdown, der dann von vorn beginnt.
- Tastatur: `A`/`D` oder Pfeile, `P` Pause, `R`, Enter oder Leertaste Fresh (neuer Lauf; im Duell öffnen sie die Lobby). Auf dem iPhone gibt es keine Pause-Taste: anhalten heißt querstellen; beim Wechsel in den Hintergrund pausiert die App von selbst.
- **Tuning-Panel**: langer Druck auf das Versions-Label unten links. Regler in farbigen Gruppen zum Aufklappen, geänderte Werte sind markiert. Werte bleiben gespeichert, „Standard“ setzt zurück, X schließt. „Kopieren“ schickt die abweichenden Werte als Text übers Teilen-Menü (oder in die Zwischenablage), zum Einfügen in den Chat mit Claude, der sie als neue Standards einträgt.
- **Ton an/aus**: Lautsprecher-Icon oben rechts auf der Fresh-Seite (Gegenstück zum Fahrer-Icon links), bleibt gespeichert.
- **Fahrer**: das Icon oben links auf der Fresh-Seite öffnet die Fahrerwahl: Ski (Standard), Snowboard oder Schlitten. Die Wahl bleibt gespeichert (`powder.rider`) und ändert nur Aussehen und Spur: das Snowboard zieht eine breite Linie und stellt sich bei beiden Daumen quer statt in den Pflug, der Schlitten zieht zwei Kufen und bremst mit den Füßen. Physik und Bestenliste sind für alle gleich. Die Fahrer stehen in `src/riders.js`, ihre Zeichnung in `src/render.js`.

## Modi

- **Classic**: freie Abfahrt, so weit es geht. Mit zwei Easter Eggs: eines taucht nur selten und an wechselnden Stellen auf (`src/yeti.js`, bewusst ohne Regler und ohne Debug-Anzeige), das andere wartet sehr weit unten (`EVEREST_*` in `src/constants.js`).
- **Piste** (Beta): nur sichtbar, wenn im Tuning-Panel unter „Piste“ der Schalter „Modus Piste (Beta) anzeigen“ an ist; dann steht der Modus mit rotem Beta-Etikett in der Moduswahl. Der Schalter bleibt bei „Standard“ und neuen Tuning-Schlüsseln stehen (eigener Speicher `powder.tune.keep`) und zählt nicht als Tuning. Als Beta ohne Online-Bestenliste. Geführte Abfahrt auf einer präparierten Piste bis ins Tal, Ziel nach 10.000 m. Die Strecke ist fest (`PISTE_SEED`, `?seed=` überschreibt), jeder Lauf fährt dieselbe. Auf der Piste steht nichts; daneben steht Wald in Gruppen mit Lichtungen, viele Bäume tragen Schnee auf den Ästen, talwärts mehr. Wer die Piste verlässt, fährt zwischen den Bäumen wie in Classic. Randstangen alle 12 m zeigen die Schwierigkeit der Stelle: blau, rot, schwarz, am rechten Rand mit orangefarbener Spitze.
  - **Tempo wie in Classic**: Hangabtrieb und Endtempo sind dieselben (`G_SLOPE`, `MAX_SPEED_KMH`), gebremst wird durch Schwünge. Nur die Zweige einer Gabelung weichen ab (siehe unten).
  - **Schwierigkeit in Wellen** wie das Profil einer Etappe (`PISTE_PROFILE`, Stufe 0 bis 10 je Meter): auf jede Schlüsselstelle folgt ein Raststück, jede Welle ist etwas höher als die davor. Schlüsselstellen bei 1100, 3700, 4700, 6400, 8700 und 9600 m, Rast bei 1400, 5700, 6950 und 9100 m; die 7000-m-Marke liegt auf einem Raststück. Die Stufe steuert drei Dinge: Breite der Piste (18 m im Raststück, 8 m an der Schlüsselstelle), Kurven (Schwenk 9° bis 26° aus der Falllinie, S-Kurve 420 bis 190 m lang) und Abstand des Waldes zum Rand (4 bis 0,6 m, ab Stufe 3,5 rückt er als Wand heran). Dazu werden die anderen Fahrer talwärts mehr. Alles als Regler im Abschnitt „Piste“, wirksam ab dem nächsten Lauf.
  - **Drei freie Stürze** (Regler): nach einem Treffer liegt der Fahrer 1 s (Regler), steht dann wieder auf der Piste (in dem Zweig, in dem er gestürzt ist) und ist 2,5 s geschützt (blinkt, wie im Duell). Die Uhr läuft durch die Sturzpause. Der vierte Sturz beendet den Lauf. Im HUD stehen die freien Stürze als Punkte unter den Metern, verbrauchte als Ring.
  - **Gabelungen** bei 2000, 3150, 4000, 6000 und 8000 m (`PISTE_FORKS`): die Piste teilt sich für 650 bis 950 m in zwei oder drei Zweige mit Wald dazwischen. Vor der Gabelung stehen die Richtungen als Schilder am oberen Bildrand (bei drei Wegen der mittlere in der Mitte mit Pfeil nach oben), in jedem Keil steht ein Wegweiser. Blau ist breit, flach und gemütlich (Endtempo 150 km/h, Regler), Schwarz schmal und steil (Endtempo 230 km/h, Regler, mehr Hangabtrieb) und frei von anderen Fahrern, Rot fährt wie die Hauptpiste. Dazu zwei besondere Zweige: der Funpark (3150 m, rechts, gelb ausgeschildert, die Alternative ist Rot) und der Slalom (4000 m, links als blauer Weg einer 3-Wege-Gabelung Slalom | Mittel | Steil). Kein Bonus für einen Zweig, nur ein anderes Fahren; der Slalom kann einen Sturz zurückgeben.
  - **Slalom-Zweig** (Regler „Slalom-Zweig“): 14 Kippstangen alle 13 m, davor und dahinter je eine gesprühte Linie. Die Uhr läuft von Linie zu Linie, jedes verpasste Tor legt 1,5 s drauf (Regler). Bleibt die Zeit unter 11 s (Regler), gibt es einen verbrauchten Sturz zurück, der Hinweis zeigt die Zeit. Wer von der Seite hereinfährt und die Startlinie verpasst, bekommt keine Zeit.
  - **Funpark** im eigenen Zweig ab 3300 m: kleiner Kicker, breiter Kicker, Wellenbahn, Steilkurve. Einzelne Kicker stehen auch sonst an der Strecke. Wer mit mindestens 30 km/h über die Kante fährt, springt von selbst: in der Luft lenkt man nicht und trifft nichts, gelandet wird immer auf der Piste, der Trick läuft von selbst und steht als Schild am Fahrer. Flugzeit und Höhe wachsen mit dem Tempo (breiter Kicker: 1,35 s bei 110 km/h, Regler). Die Wand der Steilkurve trägt herum, wer geradeaus weiterfährt: kein Sturz.
  - **Andere Fahrer**: langsamer als der Spieler, in ruhigen Bögen, oben selten (alle 330 m), unten häufiger (alle 120 m, Regler). Ein Zusammenstoß ist ein Sturz. Hinter ihnen liegt ihre Spur, dazu blasse Spuren früherer Fahrer im präparierten Schnee.
  - **Am Pistenrand**: Hütten mit Gästen (Stimmen, Kuhglocken und Polka, wenn man nah ist), Sessellift oben und Gondel weiter unten, unter denen man durchfährt (Seil und Kabinen liegen über dem Fahrer und verschieben sich mit der Höhe gegen den Schnee; man hört den Antrieb), Schneekanonen, deren Nebel kurz die Sicht nimmt, zwei Tempomessungen mit Anzeigetafel und Fotoblitz, ein Reh und ein Hase als Kulisse. Hütte, Gäste, Stützen, Schilder, Masten und Schneekanone sind Hindernisse.
  - **Torstrecken** (zweimal Super-G-Tore, einmal Slalomstangen): ein Angebot ohne Strafe. Wer alle Tore einer Strecke trifft, bekommt einen verbrauchten Sturz zurück (Regler).
  - **Ziehweg** ab 6900 m über die 7000-m-Marke: schmal, quer zum Hang, mit Fangnetz an beiden Rändern wie im Slalom: abprallen statt stürzen.
  - **Flutlicht** ab 7850 m: es wird dunkel (Regler „Dunkelheit im Flutlicht“, 0 = aus), Masten am Rand werfen Lichtkegel auf die Piste.
  - **Ziel**: Zielbogen der Talstation bei 10.000 m mit Hütte, Gästen und Gondel, Hockeystop, Fresh-Seite mit der Zeit, den Stürzen und dem Durchschnittstempo, dazu Tricks, fehlerfreie Torstrecken und das gemessene Tempo und der **Pistenplan**: die Strecke mit ihren Gabelungen, der gefahrene Weg kräftig, Kreuze an den Stürzen, ein Punkt an der Stelle, an der Schluss war. Gewertet werden die Meter; wer das Ziel erreicht, hat die volle Weite und dazu eine Zeit (`powder.best.piste`, `powder.besttime.piste`).
  - Was wo steht, legt `PISTE_LAYOUT` in `src/constants.js` fest. Die Strecke rechnet `src/piste.js` aus (reines Modul), was sich bewegt `src/piste-life.js` (reines Modul), das Bild `src/piste-view.js`; der Wald kommt über `forest` in `src/world.js`. Durchrechnen: `node tools/piste-sim.mjs 10` lässt die Bot-Fahrer aus dem Duell die Piste samt anderen Fahrern fahren und zeigt je Stufe, wie viele Läufe 7000 m und das Ziel erreichen (`--levels 2,3` nur diese Stufen, `--route hard` an jeder Gabelung der schwerere Zweig, `--set PISTE_HALF_HARD_M=3` probiert einen Wert aus). Sprünge, Fangnetz, Steilkurve und Dunkelheit kennt der Bot nicht; den Funpark-Zweig meidet er. Zum Prüfen einer Stelle im Browser: `?at=4000&lane=1` startet den Lauf bei 4000 m im mittleren Zweig (0 links, 1 Mitte oder rechts, 2 rechts bei drei Wegen); der Lauf zählt dann wie mit Tuning.
- **Lawine** (intern und in der Datenbank `chase`): die Lawine hält ein Tempo (Pace), das mit der Laufzeit steigt (Standard 30 → 145 km/h in 90 Sekunden). Wer schneller ist, hält sie knapp über dem oberen Bildrand; wer langsamer wird, holt sie sich ins Bild. Gewertet wird das Tempo entlang der Ski (Regler „Schräg zählt Tempo“, Standard 100 %), nicht nur der Höhenverlust: wer schräg fährt und schneller als ihr Pace ist, bleibt sicher; bei 0 % zählt nur das Tempo hangabwärts. Wer langsamer als 40 km/h wird, etwa quergestellt, sieht sie nach 0,8 s am Bildrand erscheinen und heranrollen. Eine optionale Gnade beim Schuss (Regler „Gnade beim Schuss“, Standard 0 % = aus) lässt sie beim geraden Bergabfahren (bis 25° Fahrwinkel) nur einen Teil ihres Tempo-Vorsprungs ausspielen; je stärker die Kurve, desto weniger Gnade, ab 60° keine; der Schneepflug zählt nicht als Schuss. Bei 100 % gewinnt sie beim Schuss gar nicht mehr, das war in v0.10.0 zu leicht. Erwischt sie den Fahrer, zerspringt er wie beim Aufprall. Die Steuerung ist dieselbe wie in Classic.
- **Super-G**: Zeitfahren durch 21 Tore auf einer festen Strecke (fester Seed, `?seed=` überschreibt), Ziel nach 1000 m. Die Tore stehen ab 50 m alle 45 m abwechselnd links und rechts der Pistenmitte, abwechselnd rot und blau, mit 7,5 m Durchfahrt zwischen den beiden Stangen (Regler), die Tore stehen 10 m versetzt zur Pistenmitte (Regler). Gewertet wird beim Kreuzen der Torlinie: außen vorbei kostet 2 s Zeitstrafe (Regler), der Lauf geht weiter. Eine berührte Stange kostet 20 km/h (Regler), kein Sturz; sie kippt vom Fahrer weg, schwingt kurz hin und her und biegt sich dabei. Das Endtempo hat im Super-G einen eigenen Regler (bis 300 km/h, Standard 240), unabhängig vom Endtempo der anderen Modi. Die Piste ist 17 m je Seite (Regler) frei, außen stehen Bäume wie in Classic; wer sie trifft, hat keine Zeit („kein Ziel“). Nach dem Ziel gleitet der Fahrer ins Zielstadion, dann kommt die Fresh-Seite mit Gesamtzeit (Zeit plus Strafen), verpassten Toren und Bestzeit. Die Bestzeit und die Zwischenzeiten des schnellsten Laufs auf dem Gerät bleiben gespeichert (`powder.besttime.superg`, `powder.splitref.superg`). Die Kurs-Regler (Torabstand, Torbreite, Torversatz, Pistenbreite) wirken ab dem nächsten Lauf und machen Zeiten untereinander unvergleichbar. Steuerung wie in Classic; die Tore und die Wertung stehen in `src/gates.js`.
  - **Starthaus und Zielstadion** wie im Slalom (siehe dort), aber so, dass die Zeiten der Bestenliste vergleichbar bleiben: kein Starthügel mit Schub, die Anfahrt ist dieselbe wie ohne Haus. Das Stadion steht nicht auf der Pistenmitte, sondern unter dem letzten Tor, und nur auf den letzten 30 m (`SG_FUNNEL_M`) läuft ein orangefarbener Fangzaun von den Pistenrändern trichterförmig auf den Zielbogen zu. Wer durchs letzte Tor und dann geradeaus fährt, kommt so immer durch den Bogen und berührt den Zaun nie; nachgerechnet mit einem Piloten, der die echte Physik vorausrechnet: 23,338 s mit und ohne Stadion (in der Pistenmitte hätte es je nach Linie 0,003 bis 0,014 s gekostet). Der Hockeystop aus gut 200 km/h braucht rund 22 m und passt ins Rund. Auf den Banden steht SUPER-G statt SLALOM.
- **Slalom**: Zeitfahren um 30 einzelne Kippstangen auf einer festen Strecke, Ziel nach 500 m. Je Tor steht nur eine Stange, abwechselnd rot und blau und links und rechts der Pistenmitte; gewertet ist das Tor, wenn man außen an ihr vorbeifährt (auf der von der Mitte abgewandten Seite). Die Stangen stehen im Grundmaß alle 15 m und 1,8 m neben der Mitte (Regler), der Rhythmus wechselt (`SL_RHYTHM`): eng (rund 11 m / 1,2 m), weit (rund 20 m / 2,6 m) und eine Vertikale mit drei Stangen fast in einer Linie. Führung im Schnee (`src/guide-line.js`): an jeder Stange ein fein gesprühter hellblauer Bogen wie an den Innenstangen des Super-G, die Ski verwischen ihn (Regler „Bogen an der Stange“). Eine durchgehende Ideallinie vom Start bis ins Ziel gibt es als Regler „Ideallinie“, Standard 0 = aus. Ein verpasstes Tor kostet 1,5 s (Regler), eine berührte Stange 5 km/h (Regler), sie klappt weg und schwingt zurück. Endtempo 80 km/h (Regler). Am Pistenrand, 9 m je Seite (Regler), steht ein orangefarbener Fangzaun (`src/fence.js`, `src/fence-view.js`, nach Jürgens Entwurf): wer hineinfährt, stürzt nicht, das Netz beult sich aus, schiebt zurück und kostet einmal je Anprall 15 % Tempo (Regler). Zwischenzeiten an Tor 9, 18 und 27 (Fleck und Linie im Schnee), Countdown, Neustart-Knopf, Hockeystop im Ziel und Fresh-Seite wie im Super-G; eigene Bestzeit (`powder.besttime.slalom`) und eigene Bestenliste. Durchgerechnet mit einem Piloten, der die echte Physik vorausrechnet: 24,7 s, im Schnitt 73 km/h. Mit 95 km/h Endtempo wären es 21,6 s und damit weniger als die 22,5 s, die die Bestenliste im Slalom annimmt: wer das Endtempo anhebt, muss auch `BOARD_SL_MAX_AVG_KMH` und die Regeln anheben.
  - **Starthaus und Starthügel** (`src/start-house.js`, Idee von Jürgen): oberhalb der Startlinie steht ein Blockhaus mit verschneitem Dach, Wimpelketten und zwei Fahnen, der Fahrer steht im offenen Tor. Über dem Tor läuft die Uhr, an der Startampel leuchtet mit jedem Piepton des Countdowns eine rote Lampe mehr, beim Go springt sie auf Grün und der Startbügel schwingt mit einem Klacken auf. Die ersten 20 m sind ein steiler Starthügel zwischen zwei Schneewällen mit gesprühten Winkeln: dort wirkt zusätzlicher Hangabtrieb (Regler „Starthügel Länge“ und „Starthügel Schub“, 0 = aus), am ersten Tor sind es 72 statt 62 km/h.
  - **Zielstadion** (`src/stadium.js`, `src/stadium-view.js`, Idee von Jürgen): bis zur Ziellinie bleibt es beim Fangzaun, der sich auf den letzten 18 m auf den Zielbogen verengt; vor der Linie steht kein Publikum, damit man sieht, wo das Ziel ist. Hinter dem aufgeblasenen Zielbogen mit Uhr liegt der Zielraum zwischen Werbebanden (`STAD_ADS`, dort lassen sich später echte Partner einsetzen), Stehplätzen und einer Tribüne mit rund 600 Fans, unten im Halbkreis geschlossen, dazu Videowand und Fahnen. Das Publikum wird lauter, je näher der Fahrer dem Ziel kommt; im Ziel gibt es Konfetti aus den Türmen des Bogens, Blitzlichter, Jubel mit Tröte und Kuhglocken, danach läuft zweimal La Ola um die Ränge. Der Fahrer gleitet ins Rund und macht den Hockeystop so, dass er in der Mitte steht; ein Tipp überspringt das. Bei neuer Bestzeit wird die Zeit auf der Videowand grün, darüber blinken Sterne. Die Lautstärke des Publikums hat einen eigenen Regler in den Einstellungen.
- Die Lawine ist eine weiße Staubwolke (`src/avalanche-view.js`): eine Front aus runden, von oben links beleuchteten Wülsten mit blaugrauen Schattenseiten. Der Körper brodelt, an der Vorderkante kugeln immer neue Ballen heraus, davor stiebt Staub über den Schnee. Je näher sie kommt, desto milchiger wird das ganze Bild, Pulverschnee in der Luft.

### Duell

zwei iPhones fahren live dieselbe Strecke (gleicher Seed, Classic-Gelände) gegeneinander. Wer „Duell“ wählt, eröffnet einen Raum mit einem Code aus vier Buchstaben; der andere tippt den Code in seiner App ein (Zeile „Code · Beitreten“) oder öffnet den geteilten Link (`?room=CODE`, landet auf dem iPhone in Safari, deshalb ist der Code der Hauptweg). Die Lobby zeigt beide Startnummern, der Host stellt die Zielweite (1.000 bis 10.000 m in 500-m-Schritten), der Gast tippt „Bereit“, der Host „Los“: beide bekommen den Super-G-Countdown. Gewertet wird die eigene Zeit ab dem gemeinsamen Go bis zur Zielweite, gemessen mit der Wanduhr: Netzlaufzeit und Bildrate spielen keine Rolle, eine Pause kostet Zeit. Der Gegner fährt als halbtransparenter Geist mit Namensschild mit; ist er außer Sicht, steht ein Schild am unteren (er liegt vorn) oder oberen Bildrand mit dem Abstand, das HUD zeigt Abstand oder seine Vorgabe. Ein Sturz beendet den Lauf nicht: nach der Sturzpause (Regler, im Duell gilt der Wert des Hosts) geht es neben dem Hindernis mit Starttempo weiter, Stürze werden gezählt. Wer zuerst im Ziel ist, wartet; der andere fährt weiter, bis er die Zeit unterbietet oder seine Uhr darüber liegt. Das Ergebnis zeigt Sieger, beide Zeiten, Stürze und den lokalen Zähler gegen diesen Namen (`powder.duel`); „Revanche“ startet mit neuer Strecke im selben Raum: der Gast tippt „Revanche?“, der Host „Revanche“ und dann „Los“ (ein Gast, der schon Revanche wollte, ist in der neuen Lobby gleich bereit). Wer nach dem Rennen aus der App fliegt, kommt mit dem Code wieder in den Raum. Im Duell stehen die Regler des Abschnitts „Fahren“ auf Standard, beide Geräte müssen dieselbe Version haben, die Bestenliste bleibt außen vor. Technik: ein Raum unter `/rooms/CODE` in derselben Firebase-Datenbank wie die Bestenliste (`src/room.js`, `src/duel.js`, `src/duel-card.js`), Positionen fünfmal pro Sekunde per `PATCH`, Lesen live per Event-Stream; Räume werden nicht aufgeräumt, nach zwei Stunden ohne Statuswechsel dürfen sie überschrieben werden. Jeder Platz trägt die `uid` seines Geräts, nur der Host ändert den Raum (siehe „Schutz vor Vandalismus“).

**Gegen den Bot** (ab v0.26.0): Der Knopf „Gegen Bot“ in der Duell-Kachel startet dasselbe Duell gegen einen Fahrer, der auf dem eigenen Gerät mitfährt, ohne Internet und ohne Namen. In der Lobby sitzt der Bot auf Startnummer 2, darunter stehen sechs Stufen zur Wahl: Anfänger, Hobby, Fortgeschritten, Profi, Weltcup, Legende; die gewählte Stufe bleibt gespeichert (`powder.bot.level`). Der Bot fährt mit derselben Physik durch dieselbe Strecke und lenkt wie ein Spieler über Halten und Loslassen, er stürzt an denselben Bäumen und liegt dieselbe Sturzpause. Jede Stufe fährt ihr eigenes Rennen, unabhängig vom Spieler. Zwei Unterschiede zum Duell gegen Menschen: eine Pause (auch der Wechsel in den Hintergrund) hält Uhr und Bot an, und Siege werden nicht gezählt. Richtwerte über 1.000 m (Mittel aus 60 Strecken, freie Schussfahrt ohne Hindernisse 24,4 s): Anfänger 57,5 s, Hobby 49,2 s, Fortgeschritten 41,5 s, Profi 35,1 s, Weltcup 29,5 s, Legende 26,6 s; die Legende stürzt nicht, die anderen im Schnitt 0,1 bis 0,6 Mal je Rennen. Technik: `src/bot.js` (Fahrer: probiert im Takt seiner Reaktionszeit Fahrwinkel aus, rechnet jeden mit der echten Physik voraus und nimmt den besten), `src/bot-room.js` (Raum im Speicher mit der Schnittstelle von `src/room.js`, so bleibt `src/duel.js` für beide Gegner dasselbe); die Stufen stehen als `BOT_LEVELS` in `src/constants.js`.

## Bestenliste

Die Fresh-Seite zeigt die fünf Besten des gewählten Modus (Rang, Name, Wert), der eigene Eintrag voll deckend;
liegt er außerhalb, steht er nach „…“ mit seinem Rang darunter. In Classic und Lawine zählt die Weite in Metern, in der
Piste ebenfalls, aber wer das Ziel erreicht, steht mit 10.000 m über allen anderen und wird nach Zeit sortiert (die
Liste zeigt bei ihnen die Zeit statt der Meter, `tie: 't'` in `MODES`; solange die Piste Beta ist, steht sie mit
`online: false` nicht in der Online-Bestenliste, Bestwert und Bestzeit bleiben auf dem Gerät); im
Super-G und im Slalom die Gesamtzeit (Zeit plus Strafen, schnellste zuerst); dort zählt nur ein Lauf bis ins Ziel, ein Sturz
davor meldet nichts. Beim ersten Sturz fragt die Seite einmal nach einem Namen (2 bis 12 Zeichen), ein Tipp auf den
eigenen Eintrag ändert ihn. Ein Eintrag gehört dem Gerät, das ihn angelegt hat (anonymes Konto, siehe unten), und
wird nur durch einen besseren desselben Geräts überschrieben. Ist ein Name schon von einem anderen Gerät belegt, steht
unter der Liste „Name gehört einem anderen Gerät“ und es wird nichts gesendet, bis ein anderer Name gewählt ist.
Einträge von vor v0.27.0 haben noch keinen Besitzer: das Gerät, das denselben Lauf (Wert und Fahrzeit) gespeichert
hat, holt ihn sich beim nächsten Start automatisch. Wer Safari-Daten löscht, bekommt ein neues Konto und kann seine
alten Einträge nicht mehr ändern. Wer sich umbenennt, lädt seinen Bestwert unter dem neuen
Namen hoch, der alte Eintrag bleibt auf dem Server (Aufräumen in der Firebase-Konsole). Angezeigt wird derselbe Lauf
(gleicher Wert und gleiche Fahrzeit auf die Hundertstel) nur einmal, auf seinem ursprünglichen Platz und unter dem
neuesten Namen, auf dem eigenen Gerät unter dem eigenen. Die Bestweiten der anderen liegen als graue Namenslinien im Schnee, beim Start des
Laufs eingefroren; die eigene rote Rekordlinie bleibt. Im Super-G und im Slalom gibt es keine Namenslinien, Zeiten lassen sich nicht in
den Hang legen, in der Piste haben die Ankommer keine, sie lägen alle auf der Ziellinie. Welche Modi eine Liste haben und wie sie werten, steht in `MODES` (`board: 'm'` oder `'time'`,
`src/modes.js`). Läufe mit Tuning, `?seed=` oder `?debug=1` zählen lokal, aber nicht online (Hinweis unter der Liste);
der Regler „Auflösung“ ist ausgenommen, er ändert nur das Bild.
Offline zeigt die Liste den letzten bekannten Stand, ausstehende Bestwerte werden beim nächsten Start oder Lauf nachgeholt.

Ein Tipp auf die Liste (nicht auf die eigene Zeile, die ändert den Namen) öffnet die Detail-Kachel des gewählten Modus:
alle Einträge mit Rang, Name, Wert, Fahrzeit und Durchschnittstempo des besten Laufs, die Liste scrollt. In Classic
und Lawine ist das Tempo Weite durch Laufzeit, im Super-G 1000 m (im Slalom 500 m) durch die reine Fahrzeit ohne Strafen (Spalten
„Gesamt“ und „Fahrzeit“). Beides kommt aus den Feldern `m` und `t`, die Datenbank bleibt unverändert.

Technik: Firebase Realtime Database per REST (`src/board.js`, kein SDK). Die Datenbank-URL steht in `BOARD_URL`
(`src/constants.js`), leer heißt aus. Ein Eintrag hat die Felder `name`, `m`, `t`, `ts`, `v`, `uid`; `m` sind Meter, im
Super-G und im Slalom die Gesamtzeit in Hundertstel (`2712` = 27,12 s), `t` ist die Laufzeit in Sekunden, dort die reine
Fahrzeit ohne Strafen, `uid` das Konto des Geräts. In der Piste ist `m` höchstens 10000 und `t` die Laufzeit samt
Sturzpausen; bei gleichem `m` nehmen die Regeln nur eine kürzere oder gleiche Zeit an.

### Schutz vor Vandalismus (ab v0.27.0)

Jedes Gerät meldet sich beim ersten Kontakt anonym bei Firebase an (`src/auth.js`, REST ohne SDK, Web-API-Schlüssel in
`AUTH_KEY`), das Token hängt `src/net.js` an jeden Aufruf. Die Regeln (`tools/firebase-rules.json`) lassen dann zu:

- Bestenliste lesen darf jeder; schreiben nur angemeldet, nur in eigene Einträge (`uid`) oder in einen Altbestand ohne
  `uid` mit unverändertem Namen, nur in Richtung besser, ohne Löschen, `ts` muss die Serverzeit sein.
- Plausibilität: in Classic und Lawine höchstens 150 km/h im Schnitt (`m ≤ t · 41,66`), in der Piste höchstens
  200 km/h (`m ≤ t · 55,56`), im Super-G mindestens 19,46 s, im Slalom mindestens 22,5 s Fahrzeit und Gesamtzeit
  nicht unter der Fahrzeit (`BOARD_MAX_AVG_KMH`, `BOARD_PISTE_MAX_AVG_KMH`, `BOARD_SG_MAX_AVG_KMH`,
  `BOARD_SL_MAX_AVG_KMH`). Ein neuer Modus mit Bestenliste muss in den Regeln stehen, sonst
  lehnt die Datenbank seine Einträge ab: nach jeder Änderung an `tools/firebase-rules.json` die Regeln in der
  Firebase-Konsole neu veröffentlichen. Die App blendet ältere
  Einträge, die das verletzen, selbst aus.
- Duell-Räume: lesen und schreiben nur angemeldet; Raumfelder, Löschen und „Los“ nur durch den Host, einen Platz nur
  sein Gerät (der Host darf beim Gast „bereit“ setzen), einen fremden Gast-Platz erst nach 60 s ohne Lebenszeichen,
  Positionen nur das Gerät des Platzes.
- Gesperrte Geräte: steht unter `/banned/<uid>` ein Wert, darf dieses Konto nichts mehr schreiben.

Ganz verhindern lässt sich Schummeln nicht, die App läuft auf dem Gerät des Spielers: wer will, kann einen plausiblen
Fantasiewert unter eigenem Namen eintragen. Fremde Einträge und fremde Duelle sind aber geschützt, und ein Störer ist
schnell entfernt:

1. Firebase-Konsole → Realtime Database → Daten → `boards` → Modus → Eintrag → Papierkorb. Die `uid` des Eintrags vorher
   kopieren.
2. Sperren: auf der obersten Ebene der Daten ein Kind `banned` anlegen (falls nicht da) und darunter die `uid` mit dem
   Wert `true`. Ein neues Konto kann er sich nur mit gelöschten Safari-Daten holen, das kostet ihn seine eigenen Einträge.

Konten und Sicherheit: für das Google-Konto des Firebase-Projekts und die GitHub-Konten beider Entwickler
Zwei-Faktor-Anmeldung einschalten; ein Push auf `main` ist ein Deploy. Das Projekt im kostenlosen Spark-Tarif lassen,
dann kann eine Flut von Schreibzugriffen nichts kosten, sie stößt nur an die Grenzen.

Regeln testen: `tools/rules-test.mjs` spielt 60 Fälle (erlaubte Wege der App und Angriffe) gegen den Firebase-Emulator,
Anleitung im Kopf der Datei (braucht Java). Die App lässt sich ebenfalls gegen den Emulator starten:
`?board=http%3A%2F%2F127.0.0.1%3A9000%3Fns%3Ddemo-powder&auth=http://127.0.0.1:9099/`, ein Duell-Bot dazu mit
`node tools/duel-bot.js 'http://127.0.0.1:9000?ns=demo-powder' CODE --auth http://127.0.0.1:9099/`.

### Einrichtung

1. <https://console.firebase.google.com> → „Projekt hinzufügen“ → Name z. B. `powder` → Google Analytics deaktivieren → Erstellen.
2. „Build“ → „Realtime Database“ → „Datenbank erstellen“ → Standort Belgien (europe-west1) → „Im gesperrten Modus starten“.
3. Links „Sicherheit“ → „Authentication“ (oder „Nach Produkten suchen“) → „Jetzt starten“ → Reiter „Anmeldemethode“
   → „Anonym“ → aktivieren. „Automatische Bereinigung“ **aus** lassen: sie löscht Konten nach 30 Tagen, dann verlöre
   jedes Gerät den Besitz seiner Einträge. Speichern.
4. Links „Einstellungen“ → „Projekteinstellungen“ → „Allgemein“. Steht dort kein Web-API-Schlüssel, unter „Meine Apps“
   mit `</>` eine Web-App registrieren (ohne Firebase Hosting); der Code-Block zeigt dann `apiKey: "AIza…"`. Den Wert in
   `AUTH_KEY` eintragen. Der Schlüssel ist öffentlich (er steht in jeder Web-App), kein Geheimnis.
5. Reiter „Daten“ der Realtime Database → URL oben kopieren (`https://….europe-west1.firebasedatabase.app`) → ohne
   Schluss-Slash in `BOARD_URL` eintragen → Version bumpen, pushen, warten bis die Version live ist.
6. Erst dann Reiter „Regeln“ → Inhalt von `tools/firebase-rules.json` einfügen (alles ersetzen) → „Veröffentlichen“.
   Ältere App-Versionen ohne Anmeldung können ab da nichts mehr schreiben; sie holen sich das Update beim nächsten Öffnen.

Nach einer Regeländerung (etwa ein neuer Modus) den Inhalt von `tools/firebase-rules.json` erneut im Reiter „Regeln“
einfügen und veröffentlichen; bis dahin lehnt der Server Einträge des neuen Modus ab.

Ein Duell lokal testen: derselbe Mock-Server bedient auch `/rooms` (`tools/room-mock.js`, mit Event-Stream), im Browser
`?board=local`; als Gegner tritt `node tools/duel-bot.js http://localhost:8082 CODE --name Jo --crash 300` dem Raum bei,
meldet sich bereit und fährt beim Start mit; `--host` eröffnet stattdessen einen Raum. Ein zweites Browser-Fenster unter
`http://127.0.0.1:8082/?board=local&room=CODE` hat einen eigenen localStorage (eigener Name) und zeigt die Lobby als Gast,
fährt aber nicht mit, weil das unfokussierte Fenster pausiert.

Lokal ohne Firebase: `node tools/serve.js 8082 --board` startet einen Mock der Schnittstelle (`tools/board-mock.js`, mit
Beispielnamen, und `tools/auth-mock.js` für die Anmeldung), im Browser dann `?board=local`. Die Mocks prüfen Besitz und
Plausibilität wie die Regeln.

## Ton

Alles synthetisch über die Web Audio API (`src/audio.js`), keine Audiodateien. Der Ton beginnt mit der ersten Berührung, weil iOS ihn erst dann freigibt. Der Klingelschalter gilt wie bei nativen Spielen: auf lautlos bleibt die App stumm.

- **Wind**: Bergwind als ständiges Grundrauschen mit Böen und leisem Pfeifen, dazu Fahrtwind, der mit dem Tempo lauter und heller wird.
- **Ski**: Schneezischen mit dem Tempo, beim Carven tiefer und lauter. Antippen und Loslassen zischen kurz, Bremsen kratzt mit Rattern, der Schneepflug lauter und tiefer.
- **Lawine**: Grollen, das mit der Nähe lauter und heller wird, Knacken und Zischen, sobald sie im Bild ist, Krachen, wenn sie nach dem Stillstand losbricht. Nach dem Erwischen klingt sie aus.
- **Aufprall**: kurzer dumpfer Schlag, am Baum mit knappem Knacken, am Fels mit Klonk, an der Lawine schwerer.
- **Super-G und Slalom**: Pieptöne des Countdowns (der lange ist das Go), ein kurzes Schlagen des Fähnchens beim Durchfahren, ein doppelter Buzzer beim Torfehler, Klacken an der Stange (die Kippstange im Slalom klackt kürzer und heller), im Slalom (und am Trichter vor dem Super-G-Ziel) ein dumpfes Fangen mit Rascheln am Fangzaun, Doppelton im Ziel (Countdown und Zielton auch im Duell). Beim App-Start ist der Ton erst nach dem ersten Tipp frei, deshalb wartet der Modus dort auf den Tipp.
- Lautstärke gesamt und je Gruppe in den Einstellungen (Zahnrad) und im Tuning-Panel, Abschnitt „Ton“. Beide
  verstellen dieselben Werte; sie zählen nicht als Tuning, ein Lauf mit leiserem Ton kommt also in die Bestenliste.
- **App verlassen**: Beim Schließen, beim App-Wechsel, beim Sperren und beim Tab-Wechsel geht der Ton in 20 ms auf null und wird erst danach angehalten, beim Zurückkommen blendet er weich wieder ein. Ein harter Stopp klang auf dem iPhone beim Schließen verzerrt, weil iOS den Rest im Ausgabepuffer kurz in Schleife spielt.

## Einstellungen

Das Zahnrad links neben dem Ton-Icon öffnet auf der Fresh-Seite die Kachel „Einstellungen“ (`src/settings.js`):

- **Anonyme Spielstatistik senden**: ein Häkchen, am Anfang aus (Opt-in). Gespeichert als `powder.stats.ok`; gesendet
  wird noch nichts, die Erhebung selbst kommt in einer späteren Version und fragt dann dieses Häkchen ab.
- **Sprache**: Deutsch, Englisch (Union Jack), Spanisch, Japanisch als Auswahlzeile mit Flagge; ein Tipp öffnet die
  Auswahl des iPhones (unsichtbares natives `select` über der Zeile). Ohne Wahl gilt die Sprache des Geräts, sofern die
  App sie kennt, sonst Deutsch. Alle Texte stehen in `src/i18n.js` (`t('schlüssel')`), statische Texte in `index.html`
  tragen `data-t`, `data-t-ph` oder `data-t-aria`. Zahlen folgen der Sprache (6.978 m, 6,978 m; 41,27 s, 41.27 s).
  Das Tuning-Panel bleibt deutsch. Neue Texte immer in allen vier Sprachen anlegen.
- **Name**: derselbe Name wie im Feld der Bestenliste (Bestenliste und Duell), mit dem Hinweis, wenn er einem anderen
  Gerät gehört. **Namenslinien im Schnee**: die Bestweiten der anderen an oder aus (`powder.marks`, `g.marksOn` in
  `src/game.js`), die eigene rote Rekordlinie bleibt. Beides nur mit Datenbank.
- **Ton**: die Lautstärken aus dem Tuning-Abschnitt „Ton“ als Regler, dazu „Standard“. Diese Regler tragen in
  `TUNABLES` das Flag `user`: eigener Speicher (`powder.settings.tune`, nur was vom Standard abweicht), der einen neuen
  `KEY` in `src/tune.js` übersteht, und „Standard“ im Tuning-Panel lässt sie in Ruhe.

## Lokal starten

```bash
node tools/serve.js
```

Dann `http://localhost:8080` öffnen. Liefert 8080 einen alten Server aus einem anderen Checkout aus (`curl -s localhost:8080/src/constants.js | grep VERSION`), `node tools/serve.js 8090` nehmen; im Browser-Preview von Claude Code heißt diese Konfiguration `powder-8090`. Auf dem iPhone im selben WLAN die angezeigte IP-Adresse öffnen.
Nützliche Parameter: `?debug=1` (Overlay mit fps, Zeit für Rechnen, Zeichnen und HUD als Mittel/Maximum je Sekunde,
Leerlauf-Anteil, Hitboxen, Safe Lane), `?seed=42` (reproduzierbare Welt),
`?board=local` (Bestenliste und Duell-Räume gegen die Mocks, siehe oben), `?room=CODE` (öffnet direkt die Duell-Lobby dieses Raums).

## Tuning

Alle Stellschrauben stehen in `src/constants.js`; die Liste `TUNABLES` dort bestimmt die Regler im Panel (Abschnitte „Fahren“, „Lawine“: Tempo am Start und Ende, Anstiegsdauer, Lauerabstand, Stillstand-Schwelle und -Wartezeit, Fangabstand, Beben, Schräg zählt Tempo, Gnade beim Schuss, Gnade bis Winkel, volle Härte ab Winkel, Schuss schüttelt ab, „Super-G“: Torabstand, Torbreite, Torversatz, Piste frei je Seite, Zeitstrafe pro Tor, Stange kostet, Endtempo, „Piste“: Schalter Modus Piste (Beta) anzeigen, Pistenbreite gesamt (Faktor auf Piste und Zweige, Funpark, Torstrecken und Ziehweg behalten ihr Maß), Freie Stürze, Sturzpause, Breite im Raststück und an der Schlüsselstelle, Endtempo Schwarz und Blau (Gabelung), Andere Fahrer: Häufigkeit (Faktor, 0 = leere Piste), am Start alle und im Tal alle, Flugzeit breiter Kicker, Alle Tore: Stürze zurück, Slalom-Zweig: Zeit unter und Strafe pro Tor, Dunkelheit im Flutlicht, Schwenk und Kurvenlänge an der Schlüsselstelle, Waldabstand im Raststück und an der Schlüsselstelle, Walddichte, „Slalom“: Torabstand, Stangenversatz, Piste frei je Seite, Zeitstrafe pro Tor, Stange kostet, Endtempo, Starthügel Länge, Starthügel Schub, Tempo nach Zaun, Bogen an der Stange, Ideallinie, „Duell“: Sturzpause, Geist-Verzögerung, „Bild“: Auflösung (Deckel für die Pixeldichte, Standard 2; kleiner ist weicher, aber schneller, und zählt nicht als Tuning für die Bestenliste), „Schriftzug“: Deckkraft, Breite, Verwischen, und „Ton“: Lautstärke gesamt, Wind, Ski und Kurven, Lawine, Aufprall, Rennen, Publikum).
Vom iPhone übernehmen: im Panel „Kopieren“, den Text in den Chat mit Claude einfügen. Jede Zeile hat die Form `KEY: Rohwert, // Gruppe: Regler = Anzeige, Standard alt` und passt so direkt in `C` in `src/constants.js`.
Ändern sich die Standardwerte, den Schlüssel `KEY` in `src/tune.js` hochzählen, sonst bleiben alte Regler-Werte auf dem iPhone aktiv.
Regler mit `user: true` (Abschnitt „Ton“) stehen auch in den Einstellungen und werden getrennt gespeichert (siehe „Einstellungen“).
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
