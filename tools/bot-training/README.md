# Bot-Training

Stand 16.11.2026.

## Bot-Stufen im Spiel
- **Normal:** der bisherige Bot.
- **Leicht:** trifft 40 % seiner Spielentscheidungen zufällig. Gegen „Normal“: −0,49 Tore pro Spiel, 28 % Siege, 28 % Remis (300 Kaderpaare, beide Seiten gespielt).

Einstellbar unter „Spielmodus → Bot-Stärke“. Im Code: `FC.newGame({ botLevel: 'leicht' })`, auch je Seite: `botLevel: { A: 'leicht', B: 'normal' }`.

## Vergleich zweier Bots
`node duell.js <stufe X> <stufe Y> [kaderpaare]` – gleiche Kader, beide Seiten getauscht, Ergebnis als Tordifferenz aus Sicht von X.

## Versuche für eine starke Stufe (bisher ohne gesicherten Erfolg)
1. **Werte aus dem Bewertungssystem plus trainierte Stellschrauben** (Kosten fürs Erschöpfen und für Token, Zielzonen, Zufallsanteil; Koordinatensuche gegen „Normal“): im Training +0,09, auf neuen Kadern +0,03 ± 0,06 Tore pro Spiel. Einzige klare Richtung: Der Bot sollte seltener für Optionen hinter dem „/“ bezahlen (Kosten fürs Erschöpfen von 1,5 auf 4,5).
2. **Vorausschau** (`vorausschau.js`): pro Entscheidung 16 kurze Verläufe über 8 Züge mit neu gemischten Stapeln. Zwei Testreihen widersprechen sich (+0,22 ± 0,12 und −0,06 ± 0,11, je 300 Kaderpaare), zusammen etwa +0,07 ± 0,08. Kostet rund 1 Sekunde Rechenzeit pro Spiel.

Deutung: Es gibt im Spiel wenige Entscheidungen, und Karten und Würfel streuen stark. Ein besserer Bot gewinnt deshalb nur knapp häufiger. Das passt zum Challengers-Grundsatz, macht es aber schwer, eine deutlich stärkere Stufe zu bauen. Naheliegende nächste Schritte: längere Vorausschau mit mehr Verläufen nur in Schlüsselmomenten (Abwehr bei Torgefahr), oder aus echten Partien im Spielarchiv lernen, wie ihr entscheidet.

## Stapel berücksichtigen (17.11.)
Der Bot schaut beim Weiterspielen (Querpass, Dribbling …) nicht auf seinen Stapel, die Zielzone folgt einer festen Rangfolge. Test (`stapel-test.js`): Zielzone zusätzlich danach wählen, wie gut die restlichen Stapelkarten in die Zone passen. Ergebnis mit λ = 1: +0,10 ± 0,08 und +0,02 ± 0,08 Tore pro Spiel (je 600 Kaderpaare), zusammen etwa +0,06 ± 0,06. Kleiner Vorteil, statistisch nicht gesichert.
