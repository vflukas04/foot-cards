// Merkmale einer Karte für das Bewertungssystem (Feldspieler).
// Zonen-Klassen: links/rechts zusammengefasst (Symmetrie), je Position vor/hinter dem „/“, Angriff und Abwehr getrennt.
const CLS = { LO: 'OA', RO: 'OA', ZO: 'ZO', ZM: 'ZM', LD: 'DA', RD: 'DA', ZD: 'ZD' };
const SHOT = new Set(['Schuss']), SPEED = new Set(['Steilpass', 'Sprint']);
function optTok(list, per, rowTok, i) { if (Array.isArray(per)) return per[i] || ''; if (!rowTok) return ''; return i === list.length - 1 ? rowTok : ''; }
function features(c) {
  const f = {};
  const add = (k, v = 1) => { f[k] = (f[k] || 0) + v; };
  let nShot = 0, nSpeed = 0;
  for (const [z, r] of Object.entries(c.z)) {
    const k = CLS[z];
    r.a.forEach(([a, g], i) => {
      if (a !== '--') add(`A|${k}|${i}|${a}`);
      if (g) add(`grün|${i}`);
      if (SHOT.has(a)) nShot++; if (SPEED.has(a)) nSpeed++;
      for (const t of optTok(r.a, r.ato, r.at, i)) add(`Token|${t}`);
    });
    r.d.forEach((a, i) => {
      if (a !== '--') add(`D|${k}|${i}|${a}`);
      for (const t of optTok(r.d, r.dto, r.dt, i)) add(`Token|${t}`);
    });
  }
  for (const s of ['tempo', 'praesenz', 'assist', 'kopf', 'schuss']) add(`Wert|${s}`, c[s]);
  add('Zusammenspiel|schuss×Schuss-Optionen', c.schuss * nShot);
  add('Zusammenspiel|tempo×Tempo-Optionen', c.tempo * nSpeed);
  return f;
}
// Startwert eines Merkmals (Wertpunkte)
const SW = require('./startwerte');
function prior(name) {
  const p = name.split('|');
  if (p[0] === 'A') return (SW.ATT[p[1]][+p[2]] || {})[p[3]] ?? 0;
  if (p[0] === 'D') return (SW.DEF[p[1]][+p[2]] || {})[p[3]] ?? 0;
  if (p[0] === 'grün') return SW.GREEN;
  if (p[0] === 'Token') return SW.TOKEN[p[1]] ?? 0;
  if (p[0] === 'Wert') return SW.STAT[p[1]];
  if (p[0] === 'Zusammenspiel') return SW.INTER[p[1]] ?? 0;
  return 0;
}
module.exports = { CLS, features, prior };
