# Marktwert-Turnier (Lukas)

Stand 19.11.2026. Eigener Modus in Iteration 3, neben dem Turnier mit Draft. In der Übersicht: „Marktwert-Turnier“, an einem Gerät oder online mit Spielcode.

## Ablauf
- **Drei Vorrunden**, jede mit einem neuen Kader. Der Kader einer Runde wird nicht mitgenommen.

  | Runde | Spiel | Kader | offen zu Beginn | Budget | Siegerbonus |
  |---|---|---|---|---|---|
  | 1 | 5 gegen 5 | 4 Feldspieler + Torhüter | 3 Fünftligisten | 18 Mio. | 1,5 Mio. für Runde 2 |
  | 2 | 7 gegen 7 | 6 Feldspieler + Torhüter | 3 aus dem Vereinsstapel | 48 Mio. | 2,3 Mio. für Runde 3 |
  | 3 | 9 gegen 9 | 8 Feldspieler + Torhüter | 3 Nationalspieler | 80 Mio. | 2,0 Mio. fürs Finale |

- **Finale** 11 gegen 11. Jeder wählt aus seinen drei Kadern 10 Feldspieler, mindestens einen aus jeder Runde, und einen seiner drei Torhüter. Jede Karte kostet wieder ihren Marktwert, Budget 85 Mio. (plus Siegerbonus).
- **Turniersieger** ist der Sieger des Finales. Bei Remis zählen die Siege in den Vorrunden, dann deren Tordifferenz.
- Keine Auswechselspieler (erste Version).

## Markt
- **Drei Stapel:** Fünftligisten (Flutlicht, Ascheplatz), Vereinsstapel (VfL, Schalke), Nationalmannschaften (Männer und Frauen). In jeder Runde darf jeder Stapel genannt werden.
- **Ein Zug:** Wer dran ist, nennt einen Stapel. Davon werden 3 Karten aufgedeckt, mit den 3 offenen liegen 6 aus. Er kauft eine Karte zum Marktwert, danach kauft der andere eine. Am Ende des Zugs bleiben die 3 neuesten Karten liegen, die übrigen kommen unter ihren Stapel. Dann ist der andere dran.
- Beide kaufen in jedem Zug genau eine Karte, deshalb sind beide Kader gleichzeitig voll.
- **Torhüter:** Die Torhüter der Runden-Stufe liegen von Anfang an offen. Statt eines Feldspielers darf man einen Torhüter kaufen, genau einen pro Runde. Kann sich jemand keinen Torhüter leisten, auch nicht mit Verkauf, springt Platzwart Paule ein (höchstens 0,5 Mio.).
- **Wer anfängt:** Runde 1 zufällig, danach der Verlierer des letzten Spiels, bei Remis der andere als in der Runde davor.
- **Restgeld** verfällt.

## Zwangsverkauf
- Wer kaufen muss und sich nichts leisten kann, muss verkaufen. Der Gegner wählt den Spieler aus, der zum vollen Marktwert auf den Markt geht. Danach kauft man zwei Karten. Die gerade verkaufte Karte darf man nicht sofort zurückkaufen.
- Der Gegner darf nur einen Spieler wählen, dessen Verkauf reicht, damit danach zwei Karten bezahlbar sind. Nur wenn kein einzelner Spieler reicht, wählt er zwei, die zusammen reichen. Dann kauft man drei.
- Torhüter werden nicht verkauft.
- Reicht auch kein Verkauf (sehr selten), kauft man die billigste passende Karte trotzdem. Das Minus wird vom nächsten Budget abgezogen.

## Marktwerte
`src/marktwerte.json`, erzeugt aus `tools/bewertung/ergebnisse` mit `python3 tools/turnier/marktwerte-export.py`. Danach `python3 build.py`. Karten ohne Wert kosten 5 Mio. Ändern sich Karten, die Marktwerte in `tools/bewertung` neu berechnen und exportieren.

## Werkzeuge
- `tools/turnier/durchlauf.js`: Turniere Bot gegen Bot, prüft den Ablauf.
- `tools/turnier/kadergroesse.js`: Spiele mit 4 bis 10 Feldspielern im Vergleich (Tore, Remis, leere Aktionen).

## Offen
- Budgets und Siegerbonus sind Startwerte. Nach den ersten Partien anpassen (`MWT_ROUNDS`, `MWT_FINAL` in `engine.js`).
- Der Bot kauft einfach und nennt selten höhere Stapel. Er dient nur zum Testen.
