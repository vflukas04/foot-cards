"""Baut die spielbaren Seiten aus den Quelldateien.

Aufruf: python build.py
Für jede Iteration unter challengers/ wird aus src/template.html, src/engine.js
und src/cards.json die Datei index.html erzeugt (Online-Version mit PeerJS).
"""
from pathlib import Path

PEERJS = '<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js"></script>'
HEAD = ('<!doctype html><html lang="de"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>[hidden]{display:none!important}body{margin:0}</style></head><body>')

root = Path(__file__).parent
for src in sorted(root.glob('challengers/*/src')):
    t = (src / 'template.html').read_text(encoding='utf-8')
    t = t.replace('/*CARDS*/null', (src / 'cards.json').read_text(encoding='utf-8'))
    t = t.replace('/*ENGINE*/', (src / 'engine.js').read_text(encoding='utf-8'))
    t = t.replace('<!--PEERJS-->', PEERJS).replace('/*P2P*/false', 'true')
    out = src.parent / 'index.html'
    out.write_text(HEAD + t + '</body></html>', encoding='utf-8')
    print('gebaut:', out.relative_to(root))
