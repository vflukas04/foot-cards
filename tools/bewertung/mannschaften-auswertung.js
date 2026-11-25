// Auswertung Mannschaftstest: Wie stark streuen Mannschaften mit gleichem Marktwert, und liegt das an einzelnen Karten oder an der Mischung?
// node mannschaften-auswertung.js
const fs = require('fs');
const S = require('./sim'), MW = require('./daten/marktwerte.json');
const { P, mio } = require('./mannschaften');
const name = id => S.FC.card(id).name;
const read = f => fs.readFileSync(__dirname + '/daten/' + f, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const Z = fs.readdirSync(__dirname + '/daten').filter(f => /^mannschaften-zufall-\d+\.jsonl$/.test(f)).flatMap(read);
const ids = Object.keys(P), ix = Object.fromEntries(ids.map((id, i) => [id, i])), n = ids.length;
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
// 1) Streuung der Mannschaftsstärke über das Zufallsrauschen hinaus
const teams = Z.map(t => { const gd = t.games.map(g => g.a - g.b), m = mean(gd); return { A: t.A, m, v: mean(gd.map(x => (x - m) ** 2)) / gd.length, games: t.games }; });
const varM = mean(teams.map(t => (t.m - mean(teams.map(x => x.m))) ** 2)), noise = mean(teams.map(t => t.v));
const trueSd = Math.sqrt(Math.max(0, varM - noise));
console.log(`${teams.length} Zufallsmannschaften, je ${teams[0].games.length} Spiele. Streuung der Ergebnisse ${Math.sqrt(varM).toFixed(3)} Tore, davon Rauschen ${Math.sqrt(noise).toFixed(3)}.`);
console.log(`Echte Stärkeunterschiede bei gleichem Marktwert: ${trueSd.toFixed(3)} Tore pro Spiel = ${(trueSd * MW.perGoal).toFixed(1)} Mio. (Standardabweichung)`);
// 2) Karteneffekte nur aus den Gegnern (zufällig, unabhängig von der eigenen Mannschaft): (Tordiff − Mannschaftsmittel) = −Σ Gegnerkarten e
const XtX = Array.from({ length: n }, () => new Float64Array(n)), Xty = new Float64Array(n);
for (const t of teams) for (const g of t.games) {
  const y = (g.a - g.b) - t.m, xs = g.B.map(id => ix[id]).filter(i => i != null);
  for (const i of xs) { Xty[i] -= y; for (const j of xs) XtX[i][j] += 1; }
}
const lam = 200; for (let i = 0; i < n; i++) XtX[i][i] += lam;
function solve(A, b) { const N = b.length, M = A.map((r, i) => [...r, b[i]]); for (let c = 0; c < N; c++) { let p = c; for (let r = c + 1; r < N; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; for (let r = 0; r < N; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= N; k++) M[r][k] -= f * M[c][k]; } } return M.map((r, i) => r[N] / r[i]); }
const e = solve(XtX.map(r => Array.from(r)), Array.from(Xty));
const cnt = new Float64Array(n); for (const t of teams) for (const g of t.games) for (const id of g.B) if (ix[id] != null) cnt[ix[id]]++;
const resSd = Math.sqrt(mean(teams.flatMap(t => t.games.map(g => (g.a - g.b - t.m) ** 2))));
const se = i => resSd / Math.sqrt(cnt[i] + lam);
// 3) Wie viel der Mannschaftsunterschiede erklären die Karteneffekte (vorhergesagt, nicht an der eigenen Mannschaft gelernt)?
const pred = teams.map(t => t.A.reduce((a, id) => a + (e[ix[id]] || 0), 0));
const mT = mean(teams.map(t => t.m)), mP = mean(pred);
const cov = mean(teams.map((t, i) => (t.m - mT) * (pred[i] - mP))), vP = mean(pred.map(p => (p - mP) ** 2));
const explained = cov * cov / vP;   // durch Karteneffekte erklärte Varianz (Rauschen der Vorhersage verdünnt nur)
console.log(`Davon erklärt durch einzeln falsch bewertete Karten: ${(100 * Math.min(1, explained / Math.max(1e-9, varM - noise))).toFixed(0)} % (Korrelation Vorhersage/Ergebnis ${(cov / Math.sqrt(vP * varM)).toFixed(2)}).`);
const mixVar = Math.max(0, varM - noise - explained);
console.log(`Rest (Mischung, Zusammenspiel): ${Math.sqrt(mixVar).toFixed(3)} Tore = ${(Math.sqrt(mixVar) * MW.perGoal).toFixed(1)} Mio. Standardabweichung.`);
// 4) Karten, die im Mannschaftsverbund deutlich mehr oder weniger bringen als ihr Marktwert sagt
const rows = ids.map((id, i) => ({ id, e: e[i], se: se(i), z: e[i] / se(i) })).sort((a, b) => b.e - a.e);
const fmt = r => `${name(r.id).padEnd(28)} ${mio[r.id].toFixed(1).padStart(5)} Mio.  Abweichung ${(r.e * MW.perGoal >= 0 ? '+' : '') + (r.e * MW.perGoal).toFixed(1)} Mio. (±${(1.96 * r.se * MW.perGoal).toFixed(1)})`;
console.log('\nUnterbewertet (bringen im Team mehr):'); rows.slice(0, 8).forEach(r => console.log('  ' + fmt(r)));
console.log('Überbewertet (bringen im Team weniger):'); rows.slice(-8).reverse().forEach(r => console.log('  ' + fmt(r)));
console.log(`Deutlich (|z| > 2.5): ${rows.filter(r => Math.abs(r.z) > 2.5).length} von ${rows.length} Karten`);
// 5) Hängt der Rest an Mannschaftsmerkmalen? Korrelation des Rests mit Profilen
const res = teams.map((t, i) => t.m - mT - (pred[i] - mP) * cov / vP);
const feats = { 'Angriff minus Abwehr': A => A.reduce((a, id) => a + P[id].off - P[id].def, 0), 'Streuung der Marktwerte': A => Math.sqrt(mean(A.map(id => (mio[id] - 6) ** 2))),
  'Tempo': A => A.reduce((a, id) => a + P[id].tempo, 0), 'Präsenz': A => A.reduce((a, id) => a + P[id].praesenz, 0), 'Kopfball': A => A.reduce((a, id) => a + P[id].kopf, 0),
  'Flanken': A => A.reduce((a, id) => a + P[id].flanke, 0), 'Schüsse aus dem Mittelfeld': A => A.reduce((a, id) => a + P[id].zmSchuss, 0), 'Optionen hinter dem Strich': A => A.reduce((a, id) => a + P[id].opt2, 0), 'Token': A => A.reduce((a, id) => a + P[id].token, 0) };
console.log('\nZusammenhang des Rests mit Mannschaftsmerkmalen (Korrelation; |r| > 0,11 ist bei 300 Mannschaften auffällig):');
for (const [k, f] of Object.entries(feats)) { const x = teams.map(t => f(t.A)), mx = mean(x), r = mean(x.map((v, i) => (v - mx) * res[i])) / Math.sqrt(mean(x.map(v => (v - mx) ** 2)) * mean(res.map(v => v * v))); console.log('  ' + k.padEnd(30) + r.toFixed(2)); }
// 6) Mannschaftstypen aus Teil A: Ergebnis gegen das, was die Karteneffekte vorhersagen
try {
  console.log('\nMannschaftstypen (je 36 Mio.): Ergebnis gegen Zufallsgegner | davon durch einzelne Karten erklärt');
  for (const t of read('mannschaften-typen.jsonl')) {
    const gd = t.games.map(g => g.a - g.b), m = mean(gd), s = Math.sqrt(mean(gd.map(x => (x - m) ** 2)) / gd.length), p = t.A.reduce((a, id) => a + (e[ix[id]] || 0), 0);
    console.log(`  ${t.typ.padEnd(42)} ${(m >= 0 ? '+' : '') + m.toFixed(2)} ± ${(1.96 * s).toFixed(2)} Tore (${(m * MW.perGoal).toFixed(1)} Mio.) | Karten: ${(p >= 0 ? '+' : '') + p.toFixed(2)}`);
  }
} catch (err) { }
// 7) Nachgeschaut: Karteneffekt nach Preisklasse und Rest gegen Einseitigkeit, Rollenhäufung, Lückenfüller
{
  const corr = (x, y) => { const mx = mean(x), my = mean(y); return mean(x.map((v, i) => (v - mx) * (y[i] - my))) / Math.sqrt(mean(x.map(v => (v - mx) ** 2)) * mean(y.map(v => (v - my) ** 2))); };
  console.log('\nKarteneffekt nach Marktwert (Mittel der Abweichung):');
  for (const [lo, hi] of [[0, 0.6], [0.6, 3], [3, 5], [5, 7], [7, 9], [9, 12], [12, 30]]) { const r = rows.filter(x => mio[x.id] >= lo && mio[x.id] < hi); console.log(`  ${lo}–${hi} Mio.: ${r.length} Karten, ${(mean(r.map(x => x.e)) * MW.perGoal).toFixed(2)} Mio.`); }
  const imb = teams.map(t => Math.abs(t.A.reduce((a, id) => a + P[id].off - P[id].def, 0)));
  const zms = teams.map(t => Math.max(0, t.A.reduce((a, id) => a + P[id].zmSchuss, 0) - 1));
  const spread = teams.map(t => Math.sqrt(mean(t.A.map(id => (mio[id] - 6) ** 2))));
  console.log(`Rest gegen Einseitigkeit |Angriff − Abwehr|: r = ${corr(imb, res).toFixed(2)}; gegen mehr als einen ZM-Schuss: r = ${corr(zms, res).toFixed(2)}; gegen Streuung der Marktwerte: r = ${corr(spread, res).toFixed(2)}`);
  const q = [...imb].sort((a, b) => a - b), hi = q[Math.floor(q.length * .8)];
  console.log(`Einseitigste 20 % der Mannschaften: Rest ${(mean(res.filter((r, i) => imb[i] >= hi)) * MW.perGoal).toFixed(1)} Mio., übrige ${(mean(res.filter((r, i) => imb[i] < hi)) * MW.perGoal).toFixed(1)} Mio.`);
  console.log('Lückenfüller (0,5 Mio.): ' + rows.filter(r => mio[r.id] <= 0.6).map(r => `${name(r.id)} ${(r.e * MW.perGoal).toFixed(1)}`).join(', '));
}
