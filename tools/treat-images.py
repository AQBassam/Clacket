"""Print every scene picture in the hall's inks, then save two WebP sizes.
Usage: python tools/treat-images.py
Reads art/originals/*, writes assets/img/<name>-960.webp and <name>-1600.webp.
The originals are generated pictures (see docs/CREDITS.md); they stay in art/
and are not deployed. Needs Pillow with WebP support."""
import glob, os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'art', 'originals'), os.path.join(ROOT, 'assets', 'img')
# Luminance -> colour. Shadows sink into the hall, mid-tones go teal, light turns lamp-yellow.
STOPS = [(0, (5, 20, 21)), (70, (12, 38, 36)), (140, (22, 84, 79)), (200, (190, 168, 104)), (255, (250, 238, 196))]
WIDTHS = [960, 1600]

def ramp():
    lut = []
    for c in range(3):
        for v in range(256):
            for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
                if a <= v <= b:
                    t = (v - a) / (b - a); lut.append(round(ca[c] + (cb[c] - ca[c]) * t)); break
    return lut

def main():
    os.makedirs(OUT, exist_ok=True)
    lut = ramp()
    for f in sorted(glob.glob(os.path.join(SRC, '*'))):
        name = os.path.splitext(os.path.basename(f))[0]
        im = Image.open(f).convert('RGB')
        im = im.crop((0, 0, im.width, round(im.width * 9 / 16))) if im.height > im.width * 9 / 16 + 2 else im
        grey = ImageOps.autocontrast(im.convert('L'), cutoff=0.5)
        toned = Image.merge('RGB', (grey, grey, grey)).point(lut)
        for w in WIDTHS:
            out = toned if toned.width <= w else toned.resize((w, round(toned.height * w / toned.width)), Image.LANCZOS)
            p = os.path.join(OUT, '%s-%d.webp' % (name, w))
            out.save(p, 'WEBP', quality=72, method=6)
            print('%-28s %5d KB' % (os.path.relpath(p, ROOT), os.path.getsize(p) // 1024))

if __name__ == '__main__':
    main()
