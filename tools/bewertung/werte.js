// Marktwerte aller Karten aus den gelernten Gewichten (Feldspieler) und der xG-Rechnung (Torhüter).
// Einheit intern: Tordifferenz pro Spiel, die eine Karte gegenüber einer Ersatzkarte (Ersatzniveau) beisteuert.
// Jede Karte kommt in jeder Spielgröße etwa 9-mal pro Spiel dran (Spieldauer wächst mit der Aufstellung),
// deshalb sind die Werte aus 5-gegen-5 direkt auf 11 gegen 11 übertragbar (Annahme, wird stichprobenartig geprüft).
// Euro: Ersatzniveau = 0,5 Mio., darüber linear; eine durchschnittliche VfL-Karte = 5 Mio.
// node werte.js [gewichte.json]  → daten/marktwerte.json und Tabelle
const fs = require('fs');
const S = require('./sim'), M = require('./merkmale');
const W = JSON.parse(fs.readFileSync(process.argv[2] || __dirname + '/daten/gewichte.json', 'utf8'));
const w = Object.fromEntries(W.merkmale.map(m => [m.name, m.gelernt]));
const wPrior = Object.fromEntries(W.merkmale.map(m => [m.name, m.startwertTore]));
const val = (c, ww) => Object.entries(M.features(c)).reduce((s, [k, v]) => s + (ww[k] ?? 0) * v, 0);
const club = c => c.club || 'vfl';
const players = S.CARDS.players.map(c => ({ id: c.id, name: c.name, club: club(c), v: val(c, w), vPrior: val(c, wPrior) }));
const sorted = players.map(p => p.v).sort((a, b) => a - b);
const repl = sorted[Math.floor(sorted.length * 0.05)];   // Ersatzniveau: die schwächsten 5 %
const vflAvg = players.filter(p => p.club === 'vfl').reduce((s, p) => s + p.v, 0) / players.filter(p => p.club === 'vfl').length;
const perGoal = 4.5 / (vflAvg - repl);   // Mio. € je Tor Tordifferenz pro Spiel
const euro = v => Math.max(0.5, 0.5 + perGoal * (v - repl));
players.forEach(p => { p.mio = euro(p.v); });
// Torhüter: weniger Gegentore pro Spiel als der Durchschnitts-Torhüter (Schüsse pro Team und Spiel aus den Bot-Spielen)
let gkOut = [];
try {
  const T = JSON.parse(fs.readFileSync(__dirname + '/daten/torhueter.json', 'utf8'));
  const shotsPerGame = +(process.env.SCHUESSE || 5.2);
  const worst = Math.max(...T.map(t => t.xg));
  gkOut = T.map(t => ({ id: t.id, name: t.name, fields: t.fields, xg: t.xg, tore: (worst - t.xg) * shotsPerGame }));
  gkOut.forEach(g => { g.mio = Math.max(0.5, 0.5 + perGoal * g.tore); });
} catch (e) { }
fs.writeFileSync(__dirname + '/daten/marktwerte.json', JSON.stringify({ perGoal, repl, players: players.sort((a, b) => b.v - a.v), torhueter: gkOut }, null, 1));
const fmt = x => x.toFixed(1).replace('.', ',');
console.log('Rang  Karte                      Verein  Wert (Tore/Spiel)  Bauchgefühl  Mio. €');
const replP = players.map(p => p.vPrior).sort((a, b) => a - b)[Math.floor(players.length * 0.05)];
players.forEach((p, i) => console.log(String(i + 1).padStart(3), ' ', p.name.padEnd(26), p.club.padEnd(6), (p.v - repl).toFixed(2).padStart(8), (p.vPrior - replP).toFixed(2).padStart(12), fmt(p.mio).padStart(8)));
console.log('\nTorhüter'); gkOut.forEach(g => console.log(g.name.padEnd(26), g.fields.join('-'), g.tore.toFixed(2).padStart(6), fmt(g.mio).padStart(7)));
