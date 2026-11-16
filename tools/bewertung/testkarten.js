// Gebaute Testkarten: zufällige, aber realistische Karten. Jede Zone wird zu 70 % aus einer echten Karte übernommen
// (gleiche Zone), zu 30 % frei aus den Aktionen gebaut, die es in dieser Zonen-Klasse gibt. Werte aus den echten Verteilungen.
const { CLS } = require('./merkmale');
function build(CARDS, rng, n, prefix = 'T') {
  const P = CARDS.players, zones = ['LO', 'ZO', 'RO', 'ZM', 'LD', 'ZD', 'RD'];
  const vocab = {};   // Klasse|Seite|Position → Liste der Aktionen (mit Grün-Markierung)
  for (const p of P) for (const z of zones) { const r = p.z[z], k = CLS[z];
    r.a.forEach(([a, g], i) => { const key = `${k}|a|${i}`; (vocab[key] = vocab[key] || new Set()).add(a + (g ? '*' : '')); });
    r.d.forEach((a, i) => { const key = `${k}|d|${i}`; (vocab[key] = vocab[key] || new Set()).add(a); }); }
  for (const k in vocab) vocab[k] = [...vocab[k]];
  const pick = a => a[Math.floor(rng() * a.length)];
  const out = [];
  for (let j = 0; j < n; j++) {
    const c = { id: `${prefix}${j}`, name: `Testkarte ${j}`, nr: 0, col: 'grau', z: {} };
    for (const s of ['tempo', 'praesenz', 'assist', 'kopf', 'schuss']) c[s] = pick(P)[s];
    for (const z of zones) {
      const k = CLS[z];
      let row;
      if (rng() < 0.7) row = JSON.parse(JSON.stringify(pick(P).z[z]));
      else {
        const a0 = pick(vocab[`${k}|a|0`]), a = [[a0.replace('*', ''), a0.endsWith('*') ? 1 : 0]];
        if (rng() < 0.5) { const a1 = pick(vocab[`${k}|a|1`]); a.push([a1.replace('*', ''), a1.endsWith('*') ? 1 : 0]); }
        const d = [pick(vocab[`${k}|d|0`])];
        if (rng() < 0.5) d.push(pick(vocab[`${k}|d|1`]));
        row = { a, at: '', d, dt: '' };
        if (rng() < 0.08) row.at = pick(['R', 'G', 'B']);
        if (rng() < 0.06) row.dt = pick(['R', 'G', 'B']);
      }
      c.z[z] = row;
    }
    out.push(c);
  }
  return out;
}
module.exports = { build };
