// Mannschaftstest (Lukas, 25.11.): Sind Mannschaften mit gleichem Gesamtmarktwert gleich stark, egal wie sie zusammengesetzt sind?
// 7 gegen 7 (6 Feldspieler, beide mit demselben Torhüter Nils Körber), Gesamtmarktwert der Feldspieler 36 Mio. ± 0,3.
// node mannschaften.js typen            → Teil A: gezielt zusammengestellte Mannschaftstypen, je SPIELE Spiele gegen Zufallsgegner
// node mannschaften.js zufall <k> <n>   → Teil B: Mannschaften k, k+n, k+2n … (für parallele Läufe), je SPIELE Spiele
// Ergebnisse als JSON-Zeilen in daten/mannschaften-*.jsonl, Auswertung mit mannschaften-auswertung.js
const fs = require('fs');
const S = require('./sim'), F = require('./merkmale');
const MW = require('./daten/marktwerte.json'), W = require('./daten/gewichte.json');
const T = 36, TOL = 0.3, LINEUP = 6, GK = 'k2';
const SPIELE = +(process.env.SPIELE || 600), TEAMS = +(process.env.TEAMS || 300);
const mio = Object.fromEntries(MW.players.map(p => [p.id, p.mio]));
const cards = S.CARDS.players.filter(c => mio[c.id] != null);
const ids = cards.map(c => c.id), byId = Object.fromEntries(cards.map(c => [c.id, c]));
// Profil einer Karte: Beitrag von Angriff, Abwehr und Eigenschaften in Mio. (aus den gelernten Gewichten), dazu Zählmerkmale
const k = MW.perGoal * 1.23, w = Object.fromEntries(W.merkmale.map(m => [m.name, m.gelernt * k]));
function profil(c) {
  const f = F.features(c), p = { off: 0, def: 0, wert: 0, opt2: 0, flanke: 0, zmSchuss: 0, token: 0 };
  for (const [n, v] of Object.entries(f)) {
    const val = (w[n] || 0) * v, t = n.split('|');
    if (t[0] === 'A') { p.off += val; if (t[2] === '1') p.opt2 += v; if (t[3] === 'Flanke') p.flanke += v; if (t[1] === 'ZM' && t[3] === 'Schuss') p.zmSchuss += v; }
    else if (t[0] === 'D') { p.def += val; if (t[2] === '1') p.opt2 += v; }
    else if (t[0] === 'Token') p.token += v;
    else p.wert += val;
  }
  Object.assign(p, { tempo: c.tempo, praesenz: c.praesenz, kopf: c.kopf, schuss: c.schuss, assist: c.assist, mio: mio[c.id] });
  return p;
}
const P = Object.fromEntries(cards.map(c => [c.id, profil(c)]));
function team(rng, avoid = []) {
  for (let tries = 0; tries < 10000; tries++) {
    const s = new Set(); while (s.size < LINEUP - 1) { const id = ids[Math.floor(rng() * ids.length)]; if (!avoid.includes(id)) s.add(id); }
    const rest = T - [...s].reduce((a, id) => a + mio[id], 0);
    const fit = ids.filter(id => !s.has(id) && !avoid.includes(id) && Math.abs(mio[id] - rest) <= TOL);
    if (fit.length) { s.add(fit[Math.floor(rng() * fit.length)]); return [...s]; }
  }
  throw new Error('kein Team');
}
function play(A, n, seed0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const rng = S.seeded(seed0 + i * 7919), B = team(rng, A);
    const r = S.match({ A, B, gkA: GK, gkB: GK, lineup: LINEUP, seed: seed0 + i });
    if (r.ok) out.push({ B, a: r.a, b: r.b });
  }
  return out;
}
const sum = (A, key) => A.reduce((a, id) => a + P[id][key], 0);
const TYPEN = {
  'Ausgeglichen (alle zwischen 5 und 7 Mio.)': A => -A.reduce((a, id) => a + (mio[id] - 6) ** 2, 0),
  'Stars und Lückenfüller': A => A.reduce((a, id) => a + (mio[id] - 6) ** 2, 0),
  'Offensiv (Angriffsaktionen)': A => sum(A, 'off') - sum(A, 'def'),
  'Defensiv (Abwehraktionen)': A => sum(A, 'def') - sum(A, 'off'),
  'Tempo': A => sum(A, 'tempo'),
  'Präsenz': A => sum(A, 'praesenz'),
  'Flanke und Kopfball': A => sum(A, 'flanke') * 2 + sum(A, 'kopf'),
  'Schüsse aus dem Mittelfeld': A => sum(A, 'zmSchuss') * 10 + sum(A, 'schuss'),
  'Viele Optionen hinter dem Strich': A => sum(A, 'opt2'),
  'Wenige Optionen hinter dem Strich': A => -sum(A, 'opt2'),
  'Viele Token': A => sum(A, 'token'),
};
const mode = process.argv[2];
if (mode === 'typen') {
  const rng = S.seeded(2511), cand = []; for (let i = 0; i < 60000; i++) cand.push(team(rng));
  const out = fs.createWriteStream(__dirname + '/daten/mannschaften-typen.jsonl');
  let t = 0;
  for (const [name, crit] of Object.entries(TYPEN)) {
    const A = cand.reduce((b, x) => crit(x) > crit(b) ? x : b, cand[0]);
    const games = play(A, SPIELE, 100000 * (++t));
    out.write(JSON.stringify({ typ: name, A, games }) + '\n');
    const gd = games.map(g => g.a - g.b), m = gd.reduce((a, b) => a + b, 0) / gd.length, sd = Math.sqrt(gd.reduce((a, x) => a + (x - m) ** 2, 0) / gd.length);
    console.log(name.padEnd(44), (m >= 0 ? '+' : '') + m.toFixed(2), '±', (1.96 * sd / Math.sqrt(gd.length)).toFixed(2), A.map(id => byId[id].name + ' ' + mio[id].toFixed(1)).join(', '));
  }
  out.end();
} else if (mode === 'zufall') {
  const k0 = +process.argv[3] || 0, step = +process.argv[4] || 1;
  const out = fs.createWriteStream(__dirname + `/daten/mannschaften-zufall-${k0}.jsonl`);
  for (let t = k0; t < TEAMS; t += step) {
    const A = team(S.seeded(777000 + t * 31));
    out.write(JSON.stringify({ t, A, games: play(A, SPIELE, 3000000 + t * 1000) }) + '\n');
  }
  out.end();
}
module.exports = { P, mio, profil };
