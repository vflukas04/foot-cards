// Gespeicherte Spiele auslesen: node tools/spiele.js         → Übersicht aller Spiele
//                               node tools/spiele.js <gid>   → ein Spiel mit Spielbericht
// Quelle: Firestore games/footcards/archiv (Projekt burbenoginspired), nur lesen. Rohdaten → tools/spiele-daten/ (nicht im Repo).
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const BASE = 'https://firestore.googleapis.com/v1/projects/burbenoginspired/databases/(default)/documents/games/footcards/archiv';
const get = url => JSON.parse(execFileSync('curl', ['-s', '-m', '20', url], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const val = v => v.mapValue ? obj(v.mapValue.fields || {}) : v.arrayValue ? (v.arrayValue.values || []).map(val)
  : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue
  : 'nullValue' in v ? null : 'stringValue' in v ? v.stringValue : v.timestampValue || null;
const obj = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, val(v)]));
const docs = []; let tok = '';
do { const r = get(BASE + '?pageSize=300' + (tok ? '&pageToken=' + tok : '')); (r.documents || []).forEach(d => docs.push(obj(d.fields || {}))); tok = r.nextPageToken; } while (tok);
const games = docs.filter(d => d.gid).sort((a, b) => (a.start || 0) - (b.start || 0));
const dir = path.join(__dirname, 'spiele-daten'); fs.mkdirSync(dir, { recursive: true });
games.forEach(g => fs.writeFileSync(path.join(dir, g.gid + '.json'), JSON.stringify({ ...g, verlauf: JSON.parse(g.verlauf || '{}') }, null, 1)));
const one = process.argv[2];
if (!one) {
  console.log(`${games.length} Spiele im Archiv\n`);
  for (const g of games) console.log([new Date(g.start || 0).toLocaleString('de-DE'), g.modus, g.draft, `${g.namen.A} ${g.tore.A}:${g.tore.B} ${g.namen.B}`,
    g.phase === 'over' ? 'Abpfiff' : `läuft (${g.minute}.)`, g.build, g.gid].join(' · '));
} else {
  const g = games.find(x => x.gid === one); if (!g) { console.log('nicht gefunden'); process.exit(1); }
  const v = JSON.parse(g.verlauf || '{}');
  console.log(`${g.namen.A} ${g.tore.A}:${g.tore.B} ${g.namen.B} · ${g.ergebnis || g.phase}\n`);
  (v.log || []).forEach(l => console.log(`${String(l.m + 1).padStart(3)}'  ${l.t}`));
}
