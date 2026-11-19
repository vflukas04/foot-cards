// Test für den Marktwert-Turniermodus: Wie gut funktionieren Spiele mit wenigen Feldspielern?
// node kadergroesse.js [spiele]  – Bot gegen Bot, zufällige Kader aus einer Stufe.
const path = require('path');
const S = require(path.join(__dirname, '../bewertung/sim'));
const MW = require(path.join(__dirname, '../bewertung/daten/marktwerte.json'));
const n = +(process.argv[2] || 400);
const mio = {}; MW.players.forEach(p => mio[p.id] = p.mio); (MW.torhueter || []).forEach(g => mio[g.id] = g.mio);
const GROUP = { t5: ['flu', 'asche'], ver: ['vfl', 's04'], nat: ['dfb', 'dfbf'] };
const ids = (g, kind) => (kind === 'g' ? S.CARDS.gks : S.CARDS.players).filter(p => GROUP[g].includes(p.club || 'vfl')).map(p => p.id);
const allG = g => g === 'mix' ? Object.keys(GROUP) : [g];
function run(group, lineup) {
  let goals = 0, draws = 0, shots = 0, turns = 0, empty = 0, fwd = 0, change = 0, xs = [], ys = [];
  for (let i = 0; i < n; i++) {
    const rng = S.seeded(4242 + i * 13 + lineup * 1000);
    const pf = allG(group).flatMap(g => ids(g, 'f')), pg = allG(group).flatMap(g => ids(g, 'g'));
    const s = new Set(); while (s.size < 2 * lineup) s.add(pf[Math.floor(rng() * pf.length)]);
    const pick = [...s], A = pick.slice(0, lineup), B = pick.slice(lineup);
    const gkA = pg[Math.floor(rng() * pg.length)], gkB = pg[Math.floor(rng() * pg.length)];
    const r = S.match({ A, B, gkA, gkB, lineup, seed: 70000 + i });
    if (!r.ok) continue;
    goals += r.a + r.b; if (r.a === r.b) draws++;
    const st = r.st; shots += st.stats.A.shots + st.stats.B.shots;
    for (const t of st.track) { turns++; if (!t.aa || String(t.aa).startsWith('--')) empty++; if (t.k === 'ok') fwd++; if (t.ps !== t.pe) change++; }
    const v = (L, g) => L.reduce((x, id) => x + mio[id], 0) + mio[g];
    xs.push(v(A, gkA) - v(B, gkB)); ys.push(r.a - r.b);
  }
  const k = xs.length, mx = xs.reduce((a, b) => a + b) / k, my = ys.reduce((a, b) => a + b) / k;
  const cov = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0), vx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), vy = ys.reduce((a, y) => a + (y - my) ** 2, 0);
  const sdx = Math.sqrt(vx / k);
  return { group, lineup, spiele: k, toreProSpiel: +(goals / k).toFixed(2), remis: +(draws / k * 100).toFixed(0), schuesse: +(shots / k).toFixed(1), zuege: +(turns / k).toFixed(0),
    leer: +(empty / turns * 100).toFixed(0), vorwaerts: +(fwd / turns * 100).toFixed(0), wechsel: +(change / turns * 100).toFixed(0),
    korrelation: +(cov / Math.sqrt(vx * vy)).toFixed(2), toreJeKaderSd: +(cov / vx * sdx).toFixed(2), kaderSdMio: +sdx.toFixed(1) };
}
const which = process.argv[3] ? JSON.parse(process.argv[3]) : [['t5', 4], ['t5', 5], ['t5', 6], ['ver', 6], ['nat', 8], ['mix', 10]];
for (const [g, l] of which) console.log(JSON.stringify(run(g, l)));
