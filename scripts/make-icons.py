"""Builds the app icons from the cake π artwork (design/icon/cake-pi.png).

Every icon is a flat square with the cake on it; launchers mask it to their own shape (squircle, circle, …). CROP comes
from the crop tool (.claude/tools/crop-icon.html, "Copy values") and frames the whole icon. Android launchers show only
the middle 80% of a maskable icon (the maskable safe zone, its outer 10% may be cut), so the maskable icons shrink the
design to fit there, and the launcher shows it as framed. Needs Pillow: `python3 scripts/make-icons.py`.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
# Fractions of the icon's side: `width` is the cake's width, `x`/`y` move its center from the icon's center (right and
# down are positive). The background is the teal key color (PALETTE in place-colors.ts).
CROP = {'background': '#07bed4', 'width': 0.915, 'x': 0.0117, 'y': -0.005}
SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]
MASKABLE_SIZES = [192, 512]
MASKABLE_VISIBLE = 0.8

artwork = Image.open(ROOT / 'design/icon/cake-pi.png').convert('RGBA')
# Cropped to its visible pixels, as the crop tool does.
artwork = artwork.crop(artwork.getchannel('A').point(lambda alpha: 255 if alpha > 32 else 0).getbbox())


def icon(size: int, background: str | None = CROP['background'], visible: float = 1) -> Image.Image:
    """The icon, with the design framed in its middle `visible` share."""
    canvas = Image.new('RGBA', (size, size), background or (0, 0, 0, 0))
    frame = size * visible
    width = round(CROP['width'] * frame)
    cake = artwork.resize((width, round(width * artwork.height / artwork.width)), Image.LANCZOS)
    left = round(size / 2 + CROP['x'] * frame - cake.width / 2)
    top = round(size / 2 + CROP['y'] * frame - cake.height / 2)
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    layer.paste(cake, (left, top))  # Unlike alpha_composite, paste accepts the cake overflowing the icon.
    canvas.alpha_composite(layer)
    return canvas.convert('RGB') if background else canvas


for size in SIZES:
    icon(size).save(ROOT / f'public/icons/icon-{size}x{size}.png', optimize=True)
for size in MASKABLE_SIZES:
    icon(size, visible=MASKABLE_VISIBLE).save(ROOT / f'public/icons/maskable-{size}x{size}.png', optimize=True)
icon(272).save(ROOT / 'public/icons/icon.webp', quality=90)
icon(256).save(ROOT / 'public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
# The same crop with no background, at the artwork's full resolution.
icon(round(artwork.width / CROP['width']), None).save(ROOT / 'public/icons/icon-transparent.png', optimize=True)
