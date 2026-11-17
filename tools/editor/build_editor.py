"""Baut den Karten-Editor (eine einzelne HTML-Seite) aus editor.src.html und den aktuellen Spieldaten.

Aufruf: python3 tools/editor/build_editor.py <ausgabe.html>
Eingebettet werden: challengers/iteration-3/src/cards.json (Kartenstand), die Stand-Kennung aus
challengers/iteration-3/index.html und die Marktwert-Daten aus tools/bewertung/ergebnisse.
"""
import csv
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
it3 = root / 'challengers' / 'iteration-3'
erg = root / 'tools' / 'bewertung' / 'ergebnisse'
out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / 'editor.html'

cards = json.loads((it3 / 'src' / 'cards.json').read_text(encoding='utf-8'))
stand = re.search(r'const BUILD = "([0-9a-f]+)"', (it3 / 'index.html').read_text(encoding='utf-8')).group(1)


def num(s):
    return float(s.replace(',', '.'))


def rows(name):
    with open(erg / name, encoding='utf-8') as f:
        return list(csv.reader(f, delimiter=';'))[1:]


# Gelernte Gewichte (Wertpunkte) je Merkmal
weights = {r[0]: num(r[2]) for r in rows('gewichte.csv')}
# Marktwerte: Tore pro Spiel über Ersatzniveau (Spalte 4), je Karte über den Namen zugeordnet
by_name = {r[1]: num(r[3]) for r in rows('marktwerte.csv')}
gk_mio = {r[0]: num(r[4]) for r in rows('torhueter.csv')}
players = {p['id']: by_name[p['name']] for p in cards['players'] if p['name'] in by_name}
gks = {g['id']: gk_mio[g['name']] for g in cards['gks'] if g['name'] in gk_mio}


def features(c):
    """Wie tools/bewertung/merkmale.js (für die Eichung unten)."""
    CLS = {'LO': 'OA', 'RO': 'OA', 'ZO': 'ZO', 'ZM': 'ZM', 'LD': 'DA', 'RD': 'DA', 'ZD': 'ZD'}
    f = {}

    def add(k, v=1):
        f[k] = f.get(k, 0) + v

    def tok(lst, per, row, i):
        if isinstance(per, list):
            return per[i] if i < len(per) else ''
        return row if row and i == len(lst) - 1 else ''
    n_shot = n_speed = 0
    for z, r in c['z'].items():
        k = CLS[z]
        for i, (a, g) in enumerate(r['a']):
            if a != '--':
                add(f'A|{k}|{i}|{a}')
            if g:
                add(f'grün|{i}')
            n_shot += a == 'Schuss'
            n_speed += a in ('Steilpass', 'Sprint')
            for t in tok(r['a'], r.get('ato'), r.get('at'), i):
                add(f'Token|{t}')
        for i, a in enumerate(r['d']):
            if a != '--':
                add(f'D|{k}|{i}|{a}')
            for t in tok(r['d'], r.get('dto'), r.get('dt'), i):
                add(f'Token|{t}')
    for s in ('tempo', 'praesenz', 'assist', 'kopf', 'schuss'):
        add(f'Wert|{s}', c[s])
    add('Zusammenspiel|schuss×Schuss-Optionen', c['schuss'] * n_shot)
    add('Zusammenspiel|tempo×Tempo-Optionen', c['tempo'] * n_speed)
    return f


# Eichung: Formelwert (Spalte 5) ≈ a · Σ Gewicht × Merkmal + b
xs, ys = [], []
formel = {r[1]: num(r[4]) for r in rows('marktwerte.csv')}
for p in cards['players']:
    if p['name'] in formel:
        xs.append(sum(weights.get(k, 0) * v for k, v in features(p).items()))
        ys.append(formel[p['name']])
n = len(xs)
mx, my = sum(xs) / n, sum(ys) / n
a = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
b = my - a * mx
# Euro je Tor: Mio. = 0,5 + perGoal · Wert (über Ersatzniveau)
pg = [(num(r[6]) - 0.5) / num(r[3]) for r in rows('marktwerte.csv') if num(r[6]) > 0.6]
per_goal = sum(pg) / len(pg)

value = {'w': weights, 'a': a, 'b': b, 'perGoal': per_goal, 'players': players, 'gks': gks}
src = (Path(__file__).parent / 'editor.src.html').read_text(encoding='utf-8')
html = (src.replace('/*DATA*/null', json.dumps(cards, ensure_ascii=False, separators=(',', ':')))
           .replace('/*VALUE*/null', json.dumps(value, ensure_ascii=False, separators=(',', ':')))
           .replace('/*STAND*/null', json.dumps(stand)))
out.write_text(html, encoding='utf-8')
print(f'gebaut: {out} (Stand {stand}, {len(cards["players"])} Feldspieler, {len(cards["gks"])} Torhüter, Eichung a={a:.5f} b={b:.3f}, {per_goal:.2f} Mio./Tor)')
