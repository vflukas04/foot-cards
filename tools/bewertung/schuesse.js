// Sammelt Torschüsse aus echten 11-gegen-11-Bot-Spielen: Art (Kopfball / Fernschuss / Schuss aus ZO), Punkte vor Torwart-Abzug.
const S = require('./sim'); const fs = require('fs'); const FC = S.FC;
const P = S.CARDS.players.map(p => p.id), G = S.CARDS.gks.map(g => g.id);
const shots = [];
const orig = FC.apply;
let seen = new WeakSet();
for (let i = 0; i < +(process.argv[2] || 300); i++) {
  const rng = S.seeded(9000 + i); const sh = P.slice().sort(() => rng() - .5);
  Math.random = S.seeded(20000 + i);
  let st = FC.newGame({ mode: 'random' }); st.squadSize = 10;
  st.teams.A.squad = sh.slice(0, 10); st.teams.B.squad = sh.slice(10, 20); st.teams.A.gk = G[i % G.length]; st.teams.B.gk = G[(i + 3) % G.length];
  st.phase = 'setup'; st.ready = { A: false, B: false };
  st = FC.apply(st, 'A', { type: 'team', name: 'A', bench: [] }); st = FC.apply(st, 'B', { type: 'team', name: 'B', bench: [] });
  let k = 0, lastTurn = -1;
  while (st.phase !== 'over' && k++ < 4000) {
    const s = FC.actor(st);
    if (!s) { for (const t of ['A', 'B']) if (FC.legal(st, t).length) st = FC.apply(st, t, FC.botAct(st, t)); continue; }
    if (st.phase === 'dist' && st.cur.turn !== lastTurn) { lastTurn = st.cur.turn; const x = st.cur.shot; shots.push({ kind: x.kind === 'Kopfball' ? 'Kopfball' : x.fern ? 'Fernschuss' : 'Schuss ZO', raw: x.base + x.assist }); }
    st = FC.apply(st, s, FC.botAct(st, s));
  }
}
fs.writeFileSync(__dirname + '/daten/schuesse.json', JSON.stringify(shots));
console.log(shots.length, 'Schüsse');
