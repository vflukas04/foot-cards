"""Schreibt challengers/iteration-3/src/marktwerte.json aus tools/bewertung/ergebnisse (Marktwerte in Mio. €).
Aufruf: python3 tools/turnier/marktwerte-export.py   (danach python3 build.py)"""
import csv, json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
C = json.loads((root / 'challengers/iteration-3/src/cards.json').read_text(encoding='utf-8'))
name2id = {p['name']: p['id'] for p in C['players'] + C['gks']}
out = {}
for f, col in (('marktwerte.csv', -1), ('torhueter.csv', -1)):
    rows = list(csv.reader((root / 'tools/bewertung/ergebnisse' / f).open(encoding='utf-8'), delimiter=';'))
    for r in rows[1:]:
        name = r[1] if f == 'marktwerte.csv' else r[0]
        if name in name2id: out[name2id[name]] = round(float(r[col].replace(',', '.')), 1)
miss = [p['name'] for p in C['players'] + C['gks'] if p['id'] not in out]
(root / 'challengers/iteration-3/src/marktwerte.json').write_text(json.dumps(out, ensure_ascii=False, sort_keys=True), encoding='utf-8')
print(len(out), 'Marktwerte geschrieben' + (', ohne Wert (5,0 Mio.): ' + ', '.join(miss) if miss else ''))
