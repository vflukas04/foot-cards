// Auswertung: lernt aus den Simulationen, wie viel jedes Merkmal zur Tordifferenz beiträgt.
// Modell: Tordifferenz (A − B) = Σ Gewicht × (Merkmale Team A − Merkmale Team B) + Zufall.
// Die Startwerte (Bauchgefühl) dienen als Vorwissen: Schätzung „schrumpft“ zu ihnen hin, wo die Daten wenig sagen (Ridge-Regression).
// node auswerten.js <pool.json> <spiele.jsonl ...>  → schreibt daten/gewichte.json
const fs = require('fs');
const M = require('./merkmale');
const [poolFile, ...gameFiles] = process.argv.slice(2);
const pool = JSON.parse(fs.readFileSync(poolFile, 'utf8'));
const F = {}; pool.forEach(c => (F[c.id] = M.features(c)));
const names = [...new Set(pool.flatMap(c => Object.keys(F[c.id])))].sort();
const idx = Object.fromEntries(names.map((n, i) => [n, i]));
const K = names.length;
const games = gameFiles.flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)));
// Normalgleichungen aufbauen
const XtX = Array.from({ length: K }, () => new Float64Array(K)), Xty = new Float64Array(K);
const prior = Float64Array.from(names, n => M.prior(n));
let yy = 0, xp2 = 0, xpy = 0;
for (const g of games) {
  const x = new Float64Array(K);
  for (const id of g.A) for (const [k, v] of Object.entries(F[id])) x[idx[k]] += v;
  for (const id of g.B) for (const [k, v] of Object.entries(F[id])) x[idx[k]] -= v;
  const y = g.a - g.b; yy += y * y;
  let xp = 0; for (let i = 0; i < K; i++) xp += x[i] * prior[i];
  xp2 += xp * xp; xpy += xp * y;
  for (let i = 0; i < K; i++) { if (!x[i]) continue; Xty[i] += x[i] * y; const xi = x[i], row = XtX[i]; for (let j = 0; j < K; j++) if (x[j]) row[j] += xi * x[j]; }
}
const N = games.length;
// 1) Maßstab der Startwerte: Wie viele Tore ist ein Wertpunkt wert, wenn das Bauchgefühl stimmt?
const scale = xpy / xp2;
const r2prior = 1 - (yy - 2 * scale * xpy + scale * scale * xp2) / yy;
// 2) Ridge zum skalierten Bauchgefühl hin. λ: Stärke des Vorwissens (entspricht etwa λ zusätzlichen Beobachtungen je Merkmal)
function solve(A, b) {
  const n = b.length, M2 = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M2[r][c]) > Math.abs(M2[p][c])) p = r;
    [M2[c], M2[p]] = [M2[p], M2[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M2[r][c] / M2[c][c]; if (f) for (let k = c; k <= n; k++) M2[r][k] -= f * M2[c][k]; }
  }
  return M2.map((r, i) => r[n] / r[i]);
}
function fit(lambda, rows) {
  const A = XtX.map((r, i) => Array.from(r, (v, j) => v + (i === j ? lambda : 0)));
  const b = Array.from(Xty, (v, i) => v + lambda * scale * prior[i]);
  return solve(A, b);
}
const lambda = +(process.env.LAMBDA || 200);
const w = fit(lambda);
// Restvarianz und grobe Standardfehler (Diagonale der inversen Matrix, über Einheitsvektoren)
let rss = yy; { let wXty = 0; for (let i = 0; i < K; i++) wXty += w[i] * Xty[i]; let wXXw = 0; for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) wXXw += w[i] * XtX[i][j] * w[j]; rss = yy - 2 * wXty + wXXw; }
const sigma2 = rss / N;
const A = XtX.map((r, i) => Array.from(r, (v, j) => v + (i === j ? lambda : 0)));
const se = names.map((_, i) => { const e = new Array(K).fill(0); e[i] = 1; return Math.sqrt(sigma2 * solve(A.map(r => r.slice()), e)[i]); });
const count = Float64Array.from(names, n => pool.reduce((s, c) => s + (F[c.id][n] ? 1 : 0), 0));
const out = { spiele: N, lambda, toreProWertpunkt: scale, r2Bauchgefuehl: r2prior, r2Modell: 1 - rss / yy,
  merkmale: names.map((n, i) => ({ name: n, startwert: prior[i], startwertTore: prior[i] * scale, gelernt: w[i], se: se[i], karten: count[i] })) };
fs.mkdirSync(__dirname + '/daten', { recursive: true });
fs.writeFileSync(__dirname + '/daten/gewichte.json', JSON.stringify(out, null, 1));
console.log(`Spiele ${N}, Tore je Wertpunkt ${scale.toFixed(4)}, R² Bauchgefühl ${r2prior.toFixed(3)}, R² Modell ${out.r2Modell.toFixed(3)}`);
