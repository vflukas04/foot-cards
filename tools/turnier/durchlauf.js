// Marktwert-Turnier Bot gegen Bot: prüft den Ablauf (Markt, Zwangsverkauf, Finale) und zählt, was passiert.
// node tools/turnier/durchlauf.js [turniere]
const path = require('path');
const FC = require(path.join(__dirname, '../../challengers/iteration-3/src/engine.js'));
FC.setData(require(path.join(__dirname, '../../challengers/iteration-3/src/cards.json')));
FC.setMarketValues(require(path.join(__dirname, '../../challengers/iteration-3/src/marktwerte.json')));
const n = +(process.argv[2] || 50);
const stat = { ok: 0, verkauf: 0, pump: 0, hoeher: [0, 0, 0], rest: [[], [], [], []], fehler: 0, sieger: { A: 0, B: 0, x: 0 } };
for (let i = 0; i < n; i++) {
  let st = FC.newGame({ mode: 'mwt' }), k = 0;
  try {
    while (st.phase !== 'mover' && k++ < 20000) {
      const s = FC.actor(st);
      if (!s) { for (const t of ['A', 'B']) if (FC.legal(st, t).length) st = FC.apply(st, t, FC.botAct(st, t)); continue; }
      const prevPhase = st.phase, M = st.mwt, r = M.round;
      if (st.phase === 'mmarket' && M.step === 'buy' && FC.legal(st, s).length === 0) throw new Error('Käufer ohne Zug');
      st = FC.apply(st, s, FC.botAct(st, s));
      if (prevPhase === 'mmarket' && st.phase === 'setup' && !st.mwt.final) {
        for (const t of ['A', 'B']) { stat.rest[r].push(st.mwt.budget[t]); const T = st.mwt.teams[r][t]; stat.hoeher[r] += T.f.filter(id => Object.keys(FC.MWT_GROUPS).indexOf(FC.mwtGroupOf(id)) > r).length; }
      }
      if (prevPhase === 'mfinal' && st.phase === 'setup') for (const t of ['A', 'B']) stat.rest[3].push(st.mwt.budget[t]);
    }
    if (st.phase !== 'mover') throw new Error('nicht fertig, Phase ' + st.phase);
    stat.ok++; stat.sieger[st.mwt.winner || 'x']++;
    stat.verkauf += st.log.filter(l => l.t.startsWith('Zwangsverkauf')).length;
    stat.pump += st.log.filter(l => l.t.includes('auf Schulden')).length; stat.paule = (stat.paule || 0) + st.log.filter(l => l.t.includes('springt ein')).length;
  } catch (e) { stat.fehler++; if (stat.fehler < 3) console.log('Fehler:', e.message, st.phase, JSON.stringify(st.mwt && { step: st.mwt.step, buyer: st.mwt.buyer, need: st.mwt.need, budget: st.mwt.budget })); }
}
const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length / 10).toFixed(1) : '-';
console.log(`${stat.ok}/${n} Turniere fertig, Fehler ${stat.fehler}. Zwangsverkäufe ${stat.verkauf}, Notkäufe ${stat.pump}, Paule springt ein ${stat.paule || 0}. Sieger A ${stat.sieger.A}, B ${stat.sieger.B}, offen ${stat.sieger.x}.`);
console.log('Karten aus höheren Stapeln pro Kader (R1, R2): ' + [0, 1].map(r => (stat.hoeher[r] / (2 * stat.ok)).toFixed(1)).join(', ') + ' · Restgeld im Schnitt R1–R3, Finale: ' + stat.rest.map(avg).join(' / ') + ' Mio.');
