// Tauschtest (Lukas' Vorschlag): gleicher Grundkader, ein Platz frei – einmal Karte X, einmal Vergleichskarte R.
// Gleiche Zufallszahlen für beide Varianten (gepaarter Vergleich), viele verschiedene Grundkader und Gegner.
// node tausch.js <X-id> <R-id> [spiele] [lineup]
const S = require('./sim');
const [X, R, nArg, lArg] = process.argv.slice(2);
const n = +(nArg || 2000), lineup = +(lArg || 5);
const ids = S.CARDS.players.map(p => p.id).filter(id => id !== X && id !== R), gks = S.CARDS.gks.map(g => g.id);
let sum = 0, sum2 = 0, ptsX = 0, ptsR = 0;
const pts = (a, b) => a > b ? 3 : a === b ? 1 : 0;
for (let i = 0; i < n; i++) {
  const rng = S.seeded(777 + i * 31);
  const s = new Set(); while (s.size < 2 * lineup - 1) s.add(ids[Math.floor(rng() * ids.length)]);
  const pick = [...s], base = pick.slice(0, lineup - 1), opp = pick.slice(lineup - 1);
  const gkA = gks[Math.floor(rng() * gks.length)], gkB = gks[Math.floor(rng() * gks.length)];
  const rx = S.match({ A: [...base, X], B: opp, gkA, gkB, lineup, seed: 50000 + i });
  const rr = S.match({ A: [...base, R], B: opp, gkA, gkB, lineup, seed: 50000 + i });
  const d = (rx.a - rx.b) - (rr.a - rr.b); sum += d; sum2 += d * d;
  ptsX += pts(rx.a, rx.b); ptsR += pts(rr.a, rr.b);
}
const m = sum / n, se = Math.sqrt((sum2 / n - m * m) / n);
console.log(`${S.FC.card(X).name} statt ${S.FC.card(R).name}: Tordifferenz ${m >= 0 ? '+' : ''}${m.toFixed(3)} ± ${(1.96 * se).toFixed(3)} pro Spiel (95 %), Punkte/Spiel ${(ptsX / n).toFixed(2)} gegen ${(ptsR / n).toFixed(2)}, ${n} Spiele ${lineup + 1} gegen ${lineup + 1}`);
