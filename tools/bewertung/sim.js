// Simulations-Kern für das Bewertungssystem: feste Kader gegeneinander, Bot gegen Bot, mit festem Zufallsstartwert.
// Nutzung: const S = require('./sim'); S.match({ A:[ids], B:[ids], gkA, gkB, lineup:5, seed:1 })
const path = require('path');
const ENGINE = path.join(__dirname, '../../challengers/iteration-3/src/engine.js');
const CARDS = require(path.join(__dirname, '../../challengers/iteration-3/src/cards.json'));
const FC = require(ENGINE);
let DATA = CARDS;
function setExtra(extraPlayers = [], extraGks = []) {
  DATA = { players: CARDS.players.concat(extraPlayers), gks: CARDS.gks.concat(extraGks) };
  FC.setData(DATA);
}
setExtra();
// Zufall mit Startwert (mulberry32): gleiche Startwerte für beide Varianten verringern das Rauschen beim Tauschtest
function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const realRandom = Math.random;
function match({ A, B, gkA, gkB, lineup = 5, seed = 1, chase }) {
  Math.random = seeded(seed);
  try {
    let st = FC.newGame({ mode: 'random', chaseRule: chase });
    st.lineupSize = lineup; st.halfLen = Math.round(lineup * 9 / 2); st.squadSize = Math.max(A.length, B.length);
    st.teams.A.squad = A.slice(); st.teams.B.squad = B.slice();
    st.teams.A.gk = gkA; st.teams.B.gk = gkB;
    st.phase = 'setup'; st.ready = { A: false, B: false }; st.pool = []; st.pickOrder = [];
    st = FC.apply(st, 'A', { type: 'team', name: 'A', bench: A.slice(lineup) });
    st = FC.apply(st, 'B', { type: 'team', name: 'B', bench: B.slice(lineup) });
    let k = 0;
    while (st.phase !== 'over' && k < 4000) {
      k++;
      const s = FC.actor(st);
      if (!s) { for (const t of ['A', 'B']) if (FC.legal(st, t).length) st = FC.apply(st, t, FC.botAct(st, t)); continue; }
      st = FC.apply(st, s, FC.botAct(st, s));
    }
    return { a: st.goals.A, b: st.goals.B, ok: st.phase === 'over', st };
  } finally { Math.random = realRandom; }
}
module.exports = { FC, CARDS, setExtra, match, seeded, get DATA() { return DATA; } };
