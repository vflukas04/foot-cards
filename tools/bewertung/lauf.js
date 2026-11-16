// Simulationslauf: N Spiele 5 gegen 5 (bzw. LINEUP) mit zufälligen Testkarten. Ausgabe: JSON-Zeilen {A:[ids],B:[ids],a,b}.
// node lauf.js <start> <anzahl> <ausgabe.jsonl> [lineup] [pool.json]
const fs = require('fs');
const S = require('./sim');
const [start, n, outFile, lineupArg, poolFile] = process.argv.slice(2);
const lineup = +(lineupArg || 5);
const pool = JSON.parse(fs.readFileSync(poolFile || __dirname + '/daten/pool.json', 'utf8'));
S.setExtra(pool);
const ids = pool.map(c => c.id), gks = S.CARDS.gks.map(g => g.id);
const out = fs.createWriteStream(outFile, { flags: 'a' });
for (let i = +start; i < +start + +n; i++) {
  const rng = S.seeded(i * 7919 + 13);
  const pickN = k => { const s = new Set(); while (s.size < k) s.add(ids[Math.floor(rng() * ids.length)]); return [...s]; };
  const both = pickN(2 * lineup), A = both.slice(0, lineup), B = both.slice(lineup);
  const gkA = gks[Math.floor(rng() * gks.length)], gkB = gks[Math.floor(rng() * gks.length)];
  const r = S.match({ A, B, gkA, gkB, lineup, seed: i + 1 });
  if (r.ok) out.write(JSON.stringify({ i, A, B, gkA, gkB, a: r.a, b: r.b }) + '\n');
}
out.end();
