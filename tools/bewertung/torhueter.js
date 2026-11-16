// Torhüter-Bewertung: erwartete Gegentore pro Schuss (xG), wenn der Schütze seine Punkte bestmöglich verteilt
// und beide ihre Ecke optimal mischen (wie im Spiel). Gewichtet mit der Verteilung echter Schüsse aus Bot-Spielen.
const S = require('./sim'); const fs = require('fs');
const shots = JSON.parse(fs.readFileSync(__dirname + '/daten/schuesse.json', 'utf8'));
const dists = n => { const o = []; for (let a = 0; a <= n; a++) for (let b = 0; b <= n - a; b++) o.push([a, b, n - a - b]); return o; };
// bester Spielwert für n Punkte auf Feldern f (Schütze wählt die Verteilung mit der höchsten Torchance)
const best = (f, n) => n <= 0 ? S.FC.shotGame(f).v : Math.max(...dists(n).map(d => S.FC.shotGame(f.map((v, i) => v + d[i])).v));
const ded = (g, kind) => kind === 'Kopfball' ? (g.box || 0) : kind === 'Fernschuss' ? (g.dist == null ? 1 : g.dist) : (g.ovo || 0);
const gks = S.CARDS.gks;
// 1) Nur die Felder (ohne Eigenschaften): xG je Punktzahl
const rows = gks.map(g => ({ g, byN: Array.from({ length: 16 }, (_, n) => best(g.fields, n)) }));
// 2) Mit Eigenschaften, gewichtet nach echten Schüssen
for (const r of rows) {
  let sum = 0, sumF = 0; const byKind = {};
  for (const s of shots) { const n = Math.max(0, s.raw - ded(r.g, s.kind)); const v = best(r.g.fields, n); sum += v; sumF += best(r.g.fields, s.raw); (byKind[s.kind] = byKind[s.kind] || []).push(v); }
  r.xg = sum / shots.length; r.xgFelder = sumF / shots.length;
  r.kind = Object.fromEntries(Object.entries(byKind).map(([k, a]) => [k, a.reduce((x, y) => x + y, 0) / a.length]));
}
rows.sort((a, b) => a.xg - b.xg);
console.log('Torhüter            Felder   D/1g1/S/A   xG je Schuss (nur Felder → mit Eigenschaften)   Kopfball  Fern  ZO');
for (const r of rows) console.log(r.g.name.padEnd(22), r.g.fields.join('-').padEnd(7), [r.g.dist, r.g.ovo, r.g.box, r.g.aura].join('/').padEnd(10), r.xgFelder.toFixed(3), '→', r.xg.toFixed(3), '   ', ['Kopfball', 'Fernschuss', 'Schuss ZO'].map(k => r.kind[k].toFixed(2)).join('  '));
console.log('\nxG je Punktzahl (nur Felder), 3 bis 12 Punkte:');
console.log(''.padEnd(22), Array.from({ length: 10 }, (_, i) => String(i + 3).padStart(5)).join(''));
for (const r of rows) console.log(r.g.name.padEnd(22), r.byN.slice(3, 13).map(v => v.toFixed(2).padStart(5)).join(''));
// Rangfolge je Punktzahl: ändert sie sich?
const rank = n => rows.slice().sort((a, b) => a.byN[n] - b.byN[n]).map(r => r.g.name.split(' ').pop());
console.log('\nRangfolge (bester zuerst) bei 4, 7 und 10 Punkten:'); for (const n of [4, 7, 10]) console.log(n, rank(n).join(' > '));
fs.writeFileSync(__dirname + '/daten/torhueter.json', JSON.stringify(rows.map(r => ({ id: r.g.id, name: r.g.name, fields: r.g.fields, xg: r.xg, xgFelder: r.xgFelder, byN: r.byN, kind: r.kind })), null, 1));
