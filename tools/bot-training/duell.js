// Bot gegen Bot: Stufe/Stellschrauben X gegen Y, gleiche Kader, beide Seiten getauscht (Kartenglück hebt sich auf).
// Nutzung als Modul: duel({ lx, px, ly, py, n, lineup, seed0 }) → mittlere Tordifferenz aus Sicht von X
const path = require('path');
const S = require(path.join(__dirname, '../bewertung/sim'));
const FC = S.FC;
const realBot = FC.botAct;
function playSides(levels, params, A, B, gkA, gkB, lineup, seed) {
  Math.random = S.seeded(seed);
  try {
    let st = FC.newGame({ mode: 'random', botLevel: levels });
    st.lineupSize = lineup; st.halfLen = Math.round(lineup * 9 / 2); st.squadSize = A.length;
    st.teams.A.squad = A.slice(); st.teams.B.squad = B.slice(); st.teams.A.gk = gkA; st.teams.B.gk = gkB;
    st.phase = 'setup'; st.ready = { A: false, B: false };
    st = FC.apply(st, 'A', { type: 'team', name: 'A', bench: A.slice(lineup) });
    st = FC.apply(st, 'B', { type: 'team', name: 'B', bench: B.slice(lineup) });
    const act = (s) => realBot(st, s);
    let k = 0;
    while (st.phase !== 'over' && k++ < 4000) {
      const s = FC.actor(st);
      if (!s) { for (const t of ['A', 'B']) if (FC.legal(st, t).length) st = FC.apply(st, t, act(t)); continue; }
      st = FC.apply(st, s, act(s));
    }
    return st.phase === 'over' ? st.goals.A - st.goals.B : null;
  } finally { Math.random = S.realRandom || Math.random; }
}
const realRandom = Math.random;
function duel({ lx = 'stark', px = null, ly = 'normal', py = null, n = 400, lineup = 5, seed0 = 1 }) {
  const ids = S.CARDS.players.map(p => p.id), gks = S.CARDS.gks.map(g => g.id);
  let sum = 0, sum2 = 0, k = 0, wins = 0, draws = 0;
  for (let i = 0; i < n; i++) {
    const rng = S.seeded(seed0 * 100003 + i * 7);
    const s = new Set(); while (s.size < 2 * lineup) s.add(ids[Math.floor(rng() * ids.length)]);
    const all = [...s], A = all.slice(0, lineup), B = all.slice(lineup);
    const gA = gks[Math.floor(rng() * gks.length)], gB = gks[Math.floor(rng() * gks.length)];
    const d1 = playSides({ A: lx, B: ly }, { A: px, B: py }, A, B, gA, gB, lineup, seed0 * 7919 + i);
    const d2 = playSides({ A: ly, B: lx }, { A: py, B: px }, A, B, gA, gB, lineup, seed0 * 7919 + i);
    Math.random = realRandom;
    if (d1 == null || d2 == null) continue;
    const d = (d1 - d2) / 2; sum += d; sum2 += d * d; k++;
    for (const x of [d1, -d2]) { if (x > 0) wins++; else if (x === 0) draws++; }
  }
  const m = sum / k, se = Math.sqrt(Math.max(0, sum2 / k - m * m) / k);
  return { tore: m, se, sieg: wins / (2 * k), remis: draws / (2 * k), n: k };
}
module.exports = { duel };
if (require.main === module) {
  const [lx, ly, n] = process.argv.slice(2);
  const r = duel({ lx: lx || 'stark', ly: ly || 'normal', n: +(n || 300) });
  console.log(`${lx || 'stark'} gegen ${ly || 'normal'}: Tordifferenz ${r.tore >= 0 ? '+' : ''}${r.tore.toFixed(3)} ± ${(1.96 * r.se).toFixed(3)}, Siege ${(100 * r.sieg).toFixed(0)} %, Remis ${(100 * r.remis).toFixed(0)} % (${r.n} Kaderpaare)`);
}
