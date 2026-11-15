"""Builds the game's icon font from Material Symbols (the `material-symbols` package): only its icons, the symbols
named in src/app/ui/icons.json, as Google recommends of an icon font, written as their names (ligatures).

Rounded and filled, at the regular weight (400). It keeps the optical size axis (20 to 48), for the browser to match
the size an icon is drawn at, and the grade axis from -25 to 0, for light icons on a dark background to glare less. It
versions the font's address in src/index.html by its content, for browsers never to keep an older one. Run it whenever
icons.json changes. Needs fontTools and Brotli: `python3 scripts/make-icon-font.py`.
"""

import hashlib
import io
import json
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'node_modules/material-symbols/material-symbols-rounded.woff2'
FONT = ROOT / 'public/fonts/material-symbols/material-symbols-rounded.woff2'
# What the names are written with.
LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789_'

symbols = sorted(set(json.loads((ROOT / 'src/app/ui/icons.json').read_text()).values()))
font = instancer.instantiateVariableFont(
    TTFont(SOURCE), {'FILL': 1, 'wght': 400, 'GRAD': (-25, 0), 'opsz': (20, 48)}
)
# Saved and read again before subsetting, which otherwise trips on the glyphs that have no variations.
instanced = io.BytesIO()
font.save(instanced)
instanced.seek(0)
font = TTFont(instanced)

glyphs = set(font.getGlyphOrder())
missing = [symbol for symbol in symbols if symbol not in glyphs]
if missing:
    raise SystemExit(f'Not in Material Symbols: {", ".join(missing)}')
options = subset.Options()
# Only the ligatures of the symbols kept, rather than of every symbol the letters could write.
options.layout_closure = False
options.layout_features = ['*']
options.name_IDs = ['*']
options.notdef_outline = True
options.flavor = 'woff2'
subsetter = subset.Subsetter(options)
subsetter.populate(
    glyphs=[glyph for symbol in symbols for glyph in (symbol, f'{symbol}.fill') if glyph in glyphs],
    unicodes=[ord(letter) for letter in LETTERS],
)
subsetter.subset(font)
FONT.parent.mkdir(parents=True, exist_ok=True)
font.save(FONT)
version = hashlib.sha256(FONT.read_bytes()).hexdigest()[:8]
index = ROOT / 'src/index.html'
index.write_text(
    re.sub(r'(material-symbols-rounded\.woff2)(\?v=\w+)?', rf'\1?v={version}', index.read_text())
)
print(f'{FONT.relative_to(ROOT)}: {len(symbols)} symbols, {FONT.stat().st_size} bytes, version {version}')
