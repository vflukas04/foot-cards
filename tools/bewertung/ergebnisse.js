// Schreibt die Ergebnis-Tabellen (ergebnisse/*.csv) aus daten/gewichte.json und daten/marktwerte.json.
// node ergebnisse.js   (nach werte.js)
const fs = require('fs');
const W = require('./daten/gewichte.json'), M = require('./daten/marktwerte.json');
const de = (x, d = 1) => x.toFixed(d).replace('.', ',');
const out = (f, rows) => fs.writeFileSync(__dirname + '/ergebnisse/' + f, rows.map(r => r.join(';')).join('\n') + '\n');
const t = W.toreProWertpunkt;
out('gewichte.csv', [['Merkmal', 'Bauchgefühl (Wertpunkte)', 'gelernt (Wertpunkte)', '95-%-Spanne ±', 'Testkarten mit Merkmal'],
  ...W.merkmale.slice().sort((a, b) => a.name.localeCompare(b.name)).map(m => [m.name, String(m.startwert).replace('.', ','), de(m.gelernt / t), de(1.96 * m.se / t), m.karten])]);
out('marktwerte.csv', [['Rang', 'Karte', 'Verein', 'Wert (Tore pro Spiel über Ersatzniveau)', 'Formel', 'Quelle', 'Mio. €'],
  ...M.players.map((p, i) => [i + 1, p.name, p.club, de(p.v - M.repl, 2), de(p.formel - M.repl, 2), p.quelle, de(p.mio, 2)])]);
out('torhueter.csv', [['Torhüter', 'Felder', 'xG je Schuss', 'Gegentore pro Spiel weniger als der schwächste', 'Mio. €'],
  ...M.torhueter.slice().sort((a, b) => b.mio - a.mio).map(g => [g.name, g.fields.join('-'), de(g.xg, 2), de(g.tore, 2), de(g.mio, 2)])]);
console.log('ergebnisse/*.csv geschrieben');
