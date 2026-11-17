"""Übernimmt im Editor angeforderte Exporte in challengers/iteration-3/src/cards.json.

Aufruf: python3 tools/editor/apply_export.py <vorschlaege.json>
<vorschlaege.json>: Liste der Datenbank-Dokumente aus der Sammlung „vorschlaege“ des Editors,
jeweils {"id": <Dokument-ID>, "data": {...}} (so wie sie Claude mit ArtifactData liest).
Übernommen wird jeweils exportJson der Dokumente mit exportState == "angefordert".
Ausgabe: die Liste der Änderungen (für BALANCE.md und den Pull Request) und die übernommenen Dokument-IDs.
"""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
path = root / 'challengers' / 'iteration-3' / 'src' / 'cards.json'
cards = json.loads(path.read_text(encoding='utf-8'))
docs = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))

ZONES = ['LO', 'ZO', 'RO', 'ZM', 'LD', 'ZD', 'RD']
STATS = [('tempo', 'Tempo'), ('praesenz', 'Präsenz'), ('assist', 'Assist'), ('kopf', 'Kopfball'), ('schuss', 'Schuss')]


def tok(lst, per, row, i):
    if isinstance(per, list):
        return per[i] if i < len(per) else ''
    return row if row and i == len(lst) - 1 else ''


def row_txt(r, role):
    tn = {'R': 'rot', 'G': 'grün', 'B': 'blau'}
    t = lambda s: (' [' + ', '.join(tn[k] for k in s) + 'er Token]') if s else ''
    if role == 'a':
        return ' / '.join(a + (' (grün)' if g else '') + t(tok(r['a'], r.get('ato'), r.get('at'), i)) for i, (a, g) in enumerate(r['a']))
    return ' / '.join(a + t(tok(r['d'], r.get('dto'), r.get('dt'), i)) for i, a in enumerate(r['d']))


def diff(b, c):
    out = []
    for k, n in (('name', 'Name'), ('nr', 'Nummer'), ('col', 'Trikot'), ('typ', 'Spielertyp')):
        if (b.get(k) or '') != (c.get(k) or ''):
            out.append(f'{n}: {b.get(k) or "–"} → {c.get(k) or "–"}')
    if 'fields' in c:
        for i, n in enumerate(('links', 'Mitte', 'rechts')):
            if b['fields'][i] != c['fields'][i]:
                out.append(f'Feld {n}: {b["fields"][i]} → {c["fields"][i]}')
        for k, n, d in (('dist', 'Distanz', 1), ('ovo', '1 gegen 1', 0), ('box', 'Strafraum', 0), ('aura', 'Ausstrahlung', 0)):
            x, y = b.get(k, d), c.get(k, d)
            if x != y:
                out.append(f'{n}: {x} → {y}')
        return out
    for k, n in STATS:
        if b[k] != c[k]:
            out.append(f'{n}: {b[k]} → {c[k]}')
    for z in ZONES:
        for r, n in (('a', 'mit Ball'), ('d', 'ohne Ball')):
            x, y = row_txt(b['z'][z], r), row_txt(c['z'][z], r)
            if x != y:
                out.append(f'{z} {n}: {x} → {y}')
    return out


def clean(c):
    """Token-Felder wie im übrigen Kartenbestand: ato/dto nur, wenn es Token gibt."""
    c = dict(c)
    if 'z' in c:
        for z in ZONES:
            r = c['z'][z]
            for per, row in (('ato', 'at'), ('dto', 'dt')):
                if not any(r.get(per) or []):
                    r.pop(per, None)
                    r[row] = ''
                else:
                    r[row] = ''.join(r[per])
    if c.get('club') == 'vfl':
        c.pop('club')
    return c


changes, done = [], []
req = [d for d in docs if d['data'].get('exportState') == 'angefordert']
# Vereine zuerst, dann Karten
req.sort(key=lambda d: d['data']['kind'] != 'club')
for d in req:
    p = d['data']
    c = json.loads(p['exportJson'])
    if p['kind'] == 'club':
        club = {k: c[k] for k in ('k', 'name', 'short', 'tier', 'col', 'label') if k in c}
        old = next((x for x in cards['clubs'] if x['k'] == club['k']), None)
        if old:
            old.update(club)
            changes.append(f'Mannschaft {club["name"]}: Angaben geändert')
        else:
            cards['clubs'].append(club)
            changes.append(f'Neue Mannschaft {club["name"]} ({club["k"]})')
        done.append(d['id'])
        continue
    c = clean(c)
    lst = cards['gks'] if p['kind'] == 'gk' else cards['players']
    i = next((j for j, x in enumerate(lst) if x['id'] == c['id']), None)
    if i is None:
        lst.append(c)
        changes.append(f'Neu: {c["name"]} ({c.get("club", "vfl")}, Nr. {c["nr"]})')
    else:
        dl = diff(lst[i], c)
        lst[i] = c
        changes.append(f'{c["name"]}: ' + ('; '.join(dl) if dl else 'keine Änderung'))
    done.append(d['id'])

clubs = {c['k'] for c in cards['clubs']}
missing = {c.get('club', 'vfl') for c in cards['players'] + cards['gks']} - clubs
if missing:
    sys.exit(f'Abbruch: Karten gehören zu unbekannten Mannschaften {sorted(missing)} (Mannschaft nicht mit exportiert?)')
path.write_text(json.dumps(cards, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'changes': changes, 'done': done}, ensure_ascii=False, indent=1))
