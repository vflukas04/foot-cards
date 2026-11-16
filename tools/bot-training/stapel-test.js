// Test: Bot, der beim Weiterspielen (Querpass, Dribbling …) die verbleibenden Karten im eigenen Stapel berücksichtigt.
// Zielzone = normale Rangfolge + λ × (wie gut passen die restlichen Stapelkarten in diese Zone, verglichen mit dem Durchschnitt).
// node stapel-test.js <λ> <kaderpaare> <seed>
const path = require('path');
const S = require(path.join(__dirname, '../bewertung/sim')); const FC = S.FC;
const W = require(path.join(__dirname, '../bewertung/daten/gewichte.json'));
const CLS = { LO: 'OA', RO: 'OA', ZO: 'ZO', ZM: 'ZM', LD: 'DA', RD: 'DA', ZD: 'ZD' };
const val = {}; W.merkmale.forEach(m => { const p = m.name.split('|'); if (p[0] === 'A' && p[2] === '0') val[p[1] + '|' + p[3]] = m.gelernt / W.toreProWertpunkt; });
const optVal = (id, z) => { const r = FC.card(id).z[z]; const a = r.a[0][0]; let v = val[CLS[z] + '|' + a] ?? 0; if (a === 'Schuss') v += FC.card(id).schuss; return v; };
// Durchschnitt und Streuung je Zone über alle Karten
const all = S.CARDS.players.map(p => p.id), Z = ['LO', 'ZO', 'RO', 'ZM', 'LD', 'ZD', 'RD'], norm = {};
for (const z of Z) { const v = all.map(id => optVal(id, z)); const m = v.reduce((a, b) => a + b) / v.length; norm[z] = { m, sd: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1 }; }
const RANK = { ZO: 6, LO: 5, RO: 5, ZM: 3, LD: 1, RD: 1, ZD: 0 };
const lam = +process.argv[2];
const realBot = FC.botAct, realRandom = Math.random;
function smartMove(st, s) {
  const acts = FC.legal(st, s); const pile = st.teams[s].pile.length ? st.teams[s].pile : st.teams[s].discard;
  const sc = a => { const ev = pile.reduce((x, id) => x + optVal(id, a.zone), 0) / Math.max(1, pile.length); return RANK[a.zone] + lam * (ev - norm[a.zone].m) / norm[a.zone].sd + (Math.random() - 0.5); };
  return acts.slice().sort((x, y) => sc(y) - sc(x))[0];
}
const ids = all, gks = S.CARDS.gks.map(g => g.id);
function play(smart, A, B, gA, gB, seed) {
  Math.random = S.seeded(seed);
  let st = FC.newGame({ mode: 'random' }); st.lineupSize = 5; st.halfLen = 23; st.squadSize = 5;
  st.teams.A.squad = A; st.teams.B.squad = B; st.teams.A.gk = gA; st.teams.B.gk = gB; st.phase = 'setup'; st.ready = { A: false, B: false };
  st = FC.apply(st, 'A', { type: 'team', name: 'A', bench: [] }); st = FC.apply(st, 'B', { type: 'team', name: 'B', bench: [] });
  const act = q => (q === smart && st.phase === 'move') ? smartMove(st, q) : realBot(st, q);
  let k = 0; while (st.phase !== 'over' && k++ < 4000) { const q = FC.actor(st); if (!q) { for (const t of ['A', 'B']) if (FC.legal(st, t).length) st = FC.apply(st, t, act(t)); continue; } st = FC.apply(st, q, act(q)); }
  Math.random = realRandom; return st.phase === 'over' ? st.goals.A - st.goals.B : null;
}
const n = +process.argv[3], seed0 = +process.argv[4]; let sum = 0, sum2 = 0, k = 0;
for (let i = 0; i < n; i++) {
  const rng = S.seeded(seed0 * 100003 + i * 7); const s = new Set(); while (s.size < 10) s.add(ids[Math.floor(rng() * ids.length)]);
  const x = [...s], A = x.slice(0, 5), B = x.slice(5), gA = gks[Math.floor(rng() * gks.length)], gB = gks[Math.floor(rng() * gks.length)];
  const d1 = play('A', A, B, gA, gB, seed0 * 7919 + i), d2 = play('B', A, B, gA, gB, seed0 * 7919 + i);
  if (d1 == null || d2 == null) continue; const d = (d1 - d2) / 2; sum += d; sum2 += d * d; k++;
}
const m = sum / k; console.log(JSON.stringify({ lambda: lam, tore: +m.toFixed(3), ci95: +(1.96 * Math.sqrt((sum2 / k - m * m) / k)).toFixed(3), n: k }));
