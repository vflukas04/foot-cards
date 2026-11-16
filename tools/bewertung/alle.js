// Tauschtest für alle Karten gegen dieselbe Vergleichskarte, mit denselben Grundkadern, Gegnern und Zufallszahlen.
// node alle.js <worker> <anzahlWorker> <spiele> <ausgabe.jsonl> [vergleich-id] [lineup]
const S = require('./sim'); const fs = require('fs');
const [wk, nw, nArg, outFile, refArg, lArg] = process.argv.slice(2);
const n = +nArg, lineup = +(lArg || 5), REF = refArg || 'c25';
const all = S.CARDS.players.map(p => p.id), gks = S.CARDS.gks.map(g => g.id);
const only = process.env.NUR ? JSON.parse(require('fs').readFileSync(process.env.NUR, 'utf8')) : null;
const mine = all.filter((_, i) => i % +nw === +wk && all[i] !== REF && (!only || only.includes(all[i])));
// Grundkader und Gegner: einmal festgelegt, für alle Karten gleich (ohne die getestete Karte und die Vergleichskarte)
const setups = [];
for (let i = 0; i < n; i++) {
  const rng = S.seeded(424242 + i * 17);
  const ids = all.filter(id => id !== REF);
  const s = []; while (s.length < 2 * lineup + 2) { const id = ids[Math.floor(rng() * ids.length)]; if (!s.includes(id)) s.push(id); }
  setups.push({ pick: s, gkA: gks[Math.floor(rng() * gks.length)], gkB: gks[Math.floor(rng() * gks.length)], seed: 900000 + i });
}
const pts = (a, b) => a > b ? 3 : a === b ? 1 : 0;
const out = [];
for (const X of mine) {
  let sum = 0, sum2 = 0, px = 0, pr = 0, k = 0;
  for (const u of setups) {
    const pool = u.pick.filter(id => id !== X);
    const base = pool.slice(0, lineup - 1), opp = pool.slice(lineup - 1, 2 * lineup - 1);
    const rx = S.match({ A: [...base, X], B: opp, gkA: u.gkA, gkB: u.gkB, lineup, seed: u.seed });
    const rr = S.match({ A: [...base, REF], B: opp, gkA: u.gkA, gkB: u.gkB, lineup, seed: u.seed });
    if (!rx.ok || !rr.ok) continue;
    const d = (rx.a - rx.b) - (rr.a - rr.b); sum += d; sum2 += d * d; px += pts(rx.a, rx.b); pr += pts(rr.a, rr.b); k++;
  }
  const m = sum / k, se = Math.sqrt((sum2 / k - m * m) / k);
  out.push(JSON.stringify({ id: X, name: S.FC.card(X).name, delta: m, se, punkte: (px - pr) / k, n: k }));
}
fs.writeFileSync(outFile, out.join('\n') + '\n');
