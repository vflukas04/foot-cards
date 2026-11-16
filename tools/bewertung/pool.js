// Erzeugt den Pool aus 3000 Testkarten (daten/pool.json)
const S = require('./sim'), T = require('./testkarten'), fs = require('fs');
fs.mkdirSync(__dirname + '/daten', { recursive: true });
fs.writeFileSync(__dirname + '/daten/pool.json', JSON.stringify(T.build(S.CARDS, S.seeded(42), 3000)));
