// Experiment: Bot mit Vorausschau. Für jede mögliche Angriffs- bzw. Abwehrentscheidung werden R kurze Verläufe über H Züge
// mit dem normalen Bot durchgespielt, die Stapel dafür neu gemischt (keine Kenntnis der Kartenreihenfolge).
// Ergebnis siehe README.md: bisher kein gesicherter Vorteil gegenüber dem normalen Bot.
const path = require('path');
const S = require(path.join(__dirname, '../bewertung/sim')); const FC = S.FC;
const ZV = { ZO: .3, LO: .15, RO: .15, ZM: 0, LD: -.1, RD: -.1, ZD: -.2 };
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function lookahead(st, s, R = 16, H = 8) {
  const ch = FC.legal(st, s).filter(a => a.type === 'choose' || a.type === 'nodef' || a.type === 'blue2' || a.type === 'green');
  if ((st.phase !== 'att' && st.phase !== 'def') || ch.length < 2) return null;
  const o = s === 'A' ? 'B' : 'A', t0 = st.turn, g0 = st.goals[s] - st.goals[o];
  let best = null, bestV = -Infinity;
  for (const a of ch) {
    let v = 0;
    for (let r = 0; r < R; r++) {
      let x = structuredClone(st); x.opts = Object.assign({}, x.opts, { botLevel: 'normal' });
      for (const t of ['A', 'B']) x.teams[t].pile = shuffle(x.teams[t].pile);
      x = FC.apply(x, s, a);
      let k = 0;
      while (x.phase !== 'over' && x.turn < t0 + H && k++ < 200) {
        const q = FC.actor(x);
        if (!q) { for (const t of ['A', 'B']) if (FC.legal(x, t).length) x = FC.apply(x, t, FC.botAct(x, t)); continue; }
        x = FC.apply(x, q, FC.botAct(x, q));
      }
      v += (x.goals[s] - x.goals[o]) - g0 + (x.poss === s ? 1 : -1) * ((ZV[x.ball] ?? 0) + .1);
    }
    if (v > bestV) { bestV = v; best = a; }
  }
  return best;
}
module.exports = { lookahead };
