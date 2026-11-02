"""Baut die spielbaren Seiten aus den Quelldateien.

Aufruf: python build.py
Für jede Iteration unter challengers/ wird aus src/template.html, src/engine.js
und src/cards.json die Datei index.html erzeugt (Online-Version mit PeerJS).
Gibt es src/draft-music.mp3, wird sie als Draft-Musik eingebettet.
"""
import base64
import re
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
    # Draft-Musik: aus src/draft-music.mp3 (liegt nicht im Repository, Lizenz erlaubt keine Weitergabe als
    # Einzeldatei). Fehlt die Datei, wird die bereits in index.html eingebettete Musik übernommen.
    music = src / 'draft-music.mp3'
    if '/*MUSIC*/null' in t:
        old = src.parent / 'index.html'
        prev = re.search(r'const DRAFT_TRACK = ("data:audio/mpeg;base64,[A-Za-z0-9+/=]+");', old.read_text(encoding='utf-8')) if old.exists() else None
        data = ('"data:audio/mpeg;base64,' + base64.b64encode(music.read_bytes()).decode() + '"') if music.exists() else (prev.group(1) if prev else 'null')
        t = t.replace('/*MUSIC*/null', data)
    out = src.parent / 'index.html'
    out.write_text(HEAD + t + '</body></html>', encoding='utf-8')
    print('gebaut:', out.relative_to(root))
