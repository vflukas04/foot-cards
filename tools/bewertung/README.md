# Bewertungssystem: Marktwerte für alle Karten

Stand 16.11.2026, Regeln von Iteration 3 (inkl. „Ballgewinn stoppt Steilpass“), Bots wie im Spiel.

## Ergebnisse
- `ergebnisse/marktwerte.csv`: alle 126 Feldspieler, Wert in Toren pro Spiel über Ersatzniveau und in Mio. €
- `ergebnisse/torhueter.csv`: alle Torhüter
- `ergebnisse/gewichte.csv`: Wert jeder Aktion je Zone (vor/hinter „/“), der Werte und Token – Bauchgefühl und gelernt

## Verfahren
1. **Merkmale** (`merkmale.js`): jede Aktion je Zonen-Klasse (links und rechts zusammengefasst: außen offensiv, ZO, ZM, außen defensiv, ZD), vor und hinter dem „/“, Angriff und Abwehr getrennt; dazu Tempo, Präsenz, Assist, Kopfball, Schuss, Token und zwei Kombinationen (Schusswert × Schuss-Optionen, Tempo × Steilpass/Sprint).
2. **Bauchgefühl** (`startwerte.js`): Startwerte, vor den Simulationen festgelegt. Bezug „--“ = 0, Schuss in ZO vor „/“ = 10.
3. **Testkarten** (`testkarten.js`, `lauf.js`): 3000 gebaute, realistische Karten, 60.000 Spiele 5 gegen 5 (plus Torhüter).
4. **Lernen** (`auswerten.js`): Wie viel trägt jedes Merkmal zur Tordifferenz bei? Ridge-Regression zum Bauchgefühl hin. Erklärt auf neuen Spielen 18 % der Streuung der Tordifferenz (Bauchgefühl allein: 11 %; der Rest ist Würfel- und Kartenglück).
5. **Tauschtest** (`alle.js`, `tausch.js`): jede echte Karte gegen dieselbe Vergleichskarte (Adi Waku Menga), 800 Grundkader mit gleichen Zufallszahlen. Ergebnis ± ca. 0,13 Tore pro Spiel (95 %).
6. **Abgleich**: Formel und Tauschtest stimmen gut überein (Korrelation 0,96). Die Formel ist etwas zu vorsichtig (Faktor 1,23, in `werte.js` eingerechnet).
7. **5 gegen 5 → 11 gegen 11**: Stichprobe mit 10 Karten, Korrelation 0,99, Steigung 0,97. Die Werte lassen sich übertragen, weil jede Karte in jeder Spielgröße etwa 9-mal pro Spiel drankommt.
8. **Torhüter** (`schuesse.js`, `torhueter.js`): erwartete Gegentore pro Schuss mit der xG-Rechnung, gewichtet mit 3117 echten Schüssen aus Bot-Spielen (Art und Punktzahl), inkl. Distanz, 1 gegen 1 und Strafraumbeherrschung. Ausstrahlung ist noch nicht eingerechnet.
9. **Euro** (`werte.js`): Ersatzniveau (schwächste 5 %) = 0,5 Mio., darüber linear; durchschnittliche VfL-Karte = 5 Mio. Torhüter mit demselben Euro-pro-Tor-Satz (5,2 Schüsse pro Team und Spiel).

## Neue Karte bewerten oder bauen
Karte im Format von `cards.json` anlegen, dann `werte.js` mit der Formel rechnen lassen (Quelle „Formel“). Für eine genaue Zahl den Tauschtest laufen lassen: `node tausch.js <neue-id> c25 2000`.

## Einschränkungen
- Alles hängt an den Bots. Wo die Bots schwach spielen, wird eine Aktion unterschätzt. Am deutlichsten bei Optionen hinter dem „/“: Sie kommen teils negativ heraus, obwohl sie freiwillig sind. Das spricht dafür, dass der Bot sie zu oft und zu teuer nutzt.
- Bewertet wird die Karte im Durchschnitt über viele Mannschaften. Zusammenspiel in einer bestimmten Mannschaft (z. B. Flankengeber + Kopfballspieler) ist nur über die Werte eingerechnet.

## Neu rechnen
```
node pool.js
node lauf.js 0 30000 daten/l5-a.jsonl 5 & node lauf.js 30000 30000 daten/l5-b.jsonl 5
node auswerten.js daten/pool.json daten/l5-a.jsonl daten/l5-b.jsonl
node alle.js 0 2 800 daten/alle-0.jsonl c25 5 & node alle.js 1 2 800 daten/alle-1.jsonl c25 5
node schuesse.js 300 && node torhueter.js
node werte.js
```
Laufzeit auf 2 Kernen: etwa 15 Minuten (Testkarten) plus 50 Minuten (Tauschtest).

## Mannschaftstest (25.11.)
Frage: Sind Mannschaften mit gleichem Gesamtmarktwert gleich stark, egal wie sie zusammengesetzt sind? `mannschaften.js` (7 gegen 7, 6 Feldspieler mit zusammen 36 Mio., gleicher Torhüter), Auswertung `mannschaften-auswertung.js`.
- Teil A: 11 gezielt gebaute Mannschaftstypen, je 600 Spiele gegen zufällige gleich teure Gegner.
- Teil B: 300 zufällige gleich teure Mannschaften, je 60 Spiele. Karteneffekte werden nur aus den (zufälligen) Gegnern geschätzt, damit sie die Stärke der eigenen Mannschaft unabhängig vorhersagen.
- Ergebnis: Gleich teure Mannschaften streuen um etwa 2,8 Mio. (Standardabweichung). Mindestens ein Drittel davon sind einzeln falsch bewertete Karten, vor allem Lückenfüller am Mindestpreis von 0,5 Mio. (Lutz Luftloch, Rudi Rumpelfuß) und die teuersten Karten (etwas zu teuer). Der Rest hängt bei zufälligen Mannschaften mit keinem geprüften Merkmal zusammen. Gezielt einseitige Mannschaften (nur Abwehr, mehrere Mittelfeldschützen, Stars mit Lückenfüllern) schneiden schlechter ab, als ihre Karten erwarten lassen.
