# Foot Cards

Fußball-Kartenspiel von Lukas und Simon. Hier liegen die spielbaren Testversionen und ihr Code.

**Spielen:** https://vflukas04.github.io/foot-cards/

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Startseite mit allen Spielen und Iterationen |
| `2decks/testtisch/` | Foot Cards 2Decks, Testtisch Regelstand 1.3 (eine Datei, nicht über `build.py` gebaut) |
| `challengers/iteration-2/` | Foot Cards Challengers, Iteration 2 – 4 Eigenschaften (aktuell) |
| `challengers/iteration-1/` | Foot Cards Challengers, Iteration 1 – Verteidiger zuerst |
| `challengers/*/index.html` | spielbare Seite (wird gebaut, nicht von Hand ändern) |
| `challengers/*/src/engine.js` | Regel-Engine: reine Spiellogik inkl. Bot |
| `challengers/*/src/cards.json` | Kartendaten |
| `challengers/*/src/template.html` | Oberfläche mit Platzhaltern `/*CARDS*/null`, `/*ENGINE*/`, `<!--PEERJS-->`, `/*P2P*/false` |
| `build.py` | baut aus `src/` die spielbaren Seiten |

## Ändern und bauen

1. Regeln in `src/engine.js`, Karten in `src/cards.json`, Aussehen in `src/template.html` ändern.
2. `python build.py` ausführen. Das erzeugt `index.html` in jedem Iterationsordner neu.
3. Committen und pushen. GitHub Pages veröffentlicht nach ein bis zwei Minuten.

Die Engine lässt sich auch ohne Browser testen, z. B. mit Node:

```js
const FC = require('./challengers/iteration-2/src/engine.js');
FC.setData(require('./challengers/iteration-2/src/cards.json'));
let st = FC.newGame({ mode: 'random' });
while (st.phase !== 'over') { const s = FC.actor(st); st = FC.apply(st, s, FC.botAct(st, s)); }
console.log(st.goals);
```

## Online-Modus

2Decks-Testtisch: Beide wählen denselben Spielnamen. Wer zuerst beitritt, hält den Spielstand (Fenster offen lassen); ebenfalls über PeerJS.


Die Verbindung läuft direkt zwischen zwei Browsern über PeerJS (kostenloser Vermittlungsserver von PeerJS). Der Spielstand liegt beim Spieler, der das Spiel angelegt hat. Regeln und Kartenmaterial liegen im gemeinsamen Google-Drive-Ordner „Foot Cards“.
