"""Clacket smoke test. Usage: python3 tests/smoke.py /path/to/deck.pptx [chrome-path]
Serves the repo locally WITH the live Content-Security-Policy (tests/serve.py),
drives a hidden Chrome, writes screenshots to tests/out/.
Needs: pip install playwright pillow. Exits 1 on any failure.
Set CLACKET_URL=http://host to test a running server instead of a local copy."""
import io, json, os, sys, threading
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tests'))
import serve

OUT = os.path.join(ROOT, 'tests', 'out')
DECK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else None
CHROME = sys.argv[2] if len(sys.argv) > 2 else None
PORT = 8765
BASE = os.environ.get('CLACKET_URL', 'http://127.0.0.1:%d' % PORT)
GUIDE_PICS = ['desk', 'lens', 'slate', 'keys', 'house']
fails, logs = [], []

def check(name, ok, detail=''):
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' :: ' + str(detail)) if detail and not ok else ''))
    if not ok: fails.append(name)

# The picture of one beat: the state object, the beat, the counter, and every animated element.
SNAP = '''() => JSON.stringify([Math.round(ClacketShow.state.shape*1000), Math.round(ClacketShow.state.alpha*1000), Math.round(ClacketShow.state.lit*1000),
    document.body.dataset.beat, document.querySelector('.count').textContent,
    [...document.querySelectorAll('#stage .scene, #film .w, #film [data-in], #film [data-click], .bg .pic')].map(e => {
        const s = getComputedStyle(e); return (+s.opacity).toFixed(3) + s.visibility[0] + s.transform })])'''
LEAKS = '''(i) => Object.keys(ClacketShow.owner).filter(k => ClacketShow.owner[k] > i &&
    ClacketShow.parts[k].some(e => parseFloat(getComputedStyle(e).opacity) > 0.001 && getComputedStyle(e).visibility !== 'hidden' &&
        (!e.closest('.scene') || getComputedStyle(e.closest('.scene')).visibility !== 'hidden')))'''
# Text on screen, line by line, with its colour. Then the text is made transparent so the
# screenshot shows only what is behind it.
PROBE = '''() => {
    const out = [], hidden = [];
    const els = [...document.querySelectorAll('#film .w, #film [data-click], #stage [data-in]:not([data-words])')]
        .filter(e => !e.closest('.cue') && parseFloat(getComputedStyle(e).opacity) > 0.9 && getComputedStyle(e).visibility === 'visible' &&
            (!e.closest('.scene') || getComputedStyle(e.closest('.scene')).visibility === 'visible'));
    for (const e of els) {
        const r = document.createRange(); r.selectNodeContents(e);
        const c = getComputedStyle(e).color.match(/[0-9.]+/g).map(Number);
        const top = document.querySelector('.top').getBoundingClientRect().bottom;   /* text under the sticky header is scrolled away */
        for (const b of r.getClientRects()) if (b.width > 4 && b.bottom - Math.max(top, b.top) > 4 && b.top < innerHeight)
            out.push({x: b.left, y: Math.max(top, b.top), w: b.width, h: Math.min(b.bottom, innerHeight) - Math.max(top, b.top), c});
    }
    for (const e of document.querySelectorAll('.hud, .deck-btns')) { hidden.push([e, 'visibility', e.style.visibility], [e, 'transition', e.style.transition]); e.style.transition = 'none'; e.style.visibility = 'hidden'; }
    for (const e of els) for (const d of [e, ...e.querySelectorAll('*')]) { hidden.push([d, 'color', d.style.color], [d, 'border-color', d.style.borderColor]); d.style.color = 'transparent'; d.style.borderColor = 'transparent'; }
    window.__probeHidden = hidden;
    return out; }'''
UNPROBE = '''() => { for (const [e, k, v] of window.__probeHidden.reverse()) e.style.setProperty(k, v); }'''

# No text on screen may sit under the buttons, the page number or the progress line.
UNDER = '''() => {
    const furniture = [...document.querySelectorAll('.deck-btns .dbtn, .hud .pageno, .hud .progress')].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
        .map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
    const hit = [];
    for (const e of document.querySelectorAll('#film .w, #film [data-click]')) {
        if (parseFloat(getComputedStyle(e).opacity) < 0.5 || getComputedStyle(e).visibility !== 'visible') continue;
        if (e.closest('.scene') && getComputedStyle(e.closest('.scene')).visibility !== 'visible') continue;
        const r = document.createRange(); r.selectNodeContents(e);
        for (const b of r.getClientRects()) for (const f of furniture)
            if (b.right > f.left && b.left < f.right && b.bottom > f.top + 2 && b.top < f.bottom - 2) hit.push(e.textContent.trim().slice(0, 24));
    }
    return hit; }'''

def lum(rgb):
    def ch(v):
        v = v / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])

def worst_contrast(pg):
    """Lowest contrast between text and the brightest 2% of what lies behind it."""
    rects = pg.evaluate(PROBE)
    shot = Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
    pg.evaluate(UNPROBE)
    scale = shot.width / pg.viewport_size['width']
    worst = 99
    for r in rects:
        box = tuple(int(v * scale) for v in (r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        crop = shot.crop(box)
        if crop.width < 2 or crop.height < 2: continue
        ls = sorted(lum(p) for p in crop.resize((max(2, crop.width // 3), max(2, crop.height // 3))).getdata())
        bg = ls[int(len(ls) * 0.98) - 1]
        fg = lum(r['c'][:3])
        worst = min(worst, (max(fg, bg) + 0.05) / (min(fg, bg) + 0.05))
    return worst

def idle(pg):
    pg.wait_for_function('() => !ClacketShow.busy()', timeout=15000); pg.wait_for_timeout(90)

def film(pg, name):
    """The film: every beat, by click-through, Back and jump."""
    idle(pg)
    pics_at_load = pg.evaluate("[...document.querySelectorAll('.bg .pic')].filter(i => i.getAttribute('src')).map(i => i.dataset.pic)")
    check(name + ': first load fetches no guide picture', not set(pics_at_load) & set(GUIDE_PICS), pics_at_load)
    n = pg.evaluate('ClacketShow.beats.length'); same = True
    leaks = pg.evaluate(LEAKS, 0); low = []; under = pg.evaluate(UNDER)
    c = worst_contrast(pg)
    if c < 7: low.append('0:%.1f' % c)
    for i in range(1, n):
        pg.keyboard.press('ArrowRight'); idle(pg)
        if pg.evaluate('ClacketShow.cur()') != i:      # the end of a scene before the generator scrolls to it
            pg.evaluate('ClacketShow.go(%d)' % i); idle(pg)
        through = pg.evaluate(SNAP)
        leaks += [str(i) + ':' + k for k in pg.evaluate(LEAKS, i)]
        under += [str(i) + ':' + t for t in pg.evaluate(UNDER)]
        c = worst_contrast(pg)
        if c < 7: low.append('%d %s: %.1f' % (i, pg.evaluate('ClacketShow.beats[%d].name' % i), c))
        if i in (1, 9, 20, n - 2) or i % 4 == 0:
            pg.screenshot(path=os.path.join(OUT, '%s-film-%02d.png' % (name, i)))
        if i < n - 1:
            pg.evaluate('ClacketShow.go(%d)' % (i + 1)); idle(pg); pg.evaluate('ClacketShow.prev()'); idle(pg)
            back = pg.evaluate(SNAP)
        else: back = through
        pg.evaluate('ClacketShow.go(0, true)'); pg.evaluate('ClacketShow.go(%d, true)' % i); idle(pg)
        jump = pg.evaluate(SNAP)
        if not (through == back == jump): same = False; print('   differs at beat', i, pg.evaluate('ClacketShow.beats[%d].name' % i))
    check(name + ': film: click-through, Back and jump give the same picture on all %d beats' % n, same)
    check(name + ': film: nothing from a later click is visible at an earlier one', not leaks, leaks)
    check(name + ': film: text has at least 7:1 contrast with what lies behind it, on every beat', not low, low)
    check(name + ': film: no text is hidden under the buttons or the page number', not under, under[:6])
    check(name + ': film: every picture loaded', pg.evaluate("[...document.querySelectorAll('.bg .pic')].every(i => i.complete && i.naturalWidth > 0)"))
    check(name + ': Arabic words are whole, no letter is split', pg.evaluate("[...document.querySelectorAll('#film .w')].every(w => !/[\\u0600-\\u06FF]/.test(w.textContent) || w.textContent.trim().length > 1 || /^[\\u0648]$/.test(w.textContent.trim()))"))
    pg.evaluate('ClacketShow.go(0, true)'); idle(pg); pg.wait_for_timeout(600)
    pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(100)
    check(name + ': film: a press during an animation finishes it and moves on', pg.evaluate('ClacketShow.cur()') == 2)
    pg.evaluate('ClacketShow.go(0, true)'); idle(pg)
    pg.keyboard.press('KeyB'); on = pg.evaluate("document.querySelector('.cover').classList.contains('on')")
    beat0 = pg.evaluate('document.body.dataset.beat'); pg.keyboard.press('ArrowRight')
    check(name + ': film: B blacks the screen and the next press only brings it back', on and pg.evaluate('document.body.dataset.beat') == beat0 and not pg.evaluate("document.querySelector('.cover').classList.contains('on')"))
    # scrolling: a scene that arrives from above plays all its clicks
    pg.evaluate("document.getElementById('take-install').scrollIntoView({block: 'start', behavior: 'instant'})"); pg.wait_for_timeout(400); idle(pg)
    check(name + ': scrolling down to a scene plays all its clicks', pg.evaluate('document.body.dataset.beat') == 'take-install-3', pg.evaluate('document.body.dataset.beat'))
    pg.screenshot(path=os.path.join(OUT, name + '-scrolled-install.png'))
    pg.evaluate("document.getElementById('take-what').scrollIntoView({block: 'start', behavior: 'instant'})"); pg.wait_for_timeout(400); idle(pg)
    check(name + ': scrolling back up shows that scene\'s last picture', pg.evaluate('document.body.dataset.beat') == 'take-what-3', pg.evaluate('document.body.dataset.beat'))
    pg.evaluate("document.getElementById('maker').scrollIntoView({behavior: 'instant'})"); pg.wait_for_timeout(400)
    check(name + ': at the generator the film goes quiet and its buttons hide', pg.evaluate("document.body.classList.contains('quiet') && getComputedStyle(document.querySelector('.deck-btns')).visibility === 'hidden'"))
    pg.focus('#f-title'); beat = pg.evaluate('document.body.dataset.beat')
    pg.keyboard.press('KeyB'); pg.keyboard.press('ArrowRight')
    check(name + ': typing in the generator never drives the film', not pg.evaluate("document.querySelector('.cover').classList.contains('on')") and pg.evaluate('document.body.dataset.beat') == beat and pg.input_value('#f-title') == 'b')
    pg.fill('#f-title', '')

def main():
    if not DECK or not os.path.exists(DECK):
        sys.exit('Give the path of a .pptx file to test with.')
    os.makedirs(OUT, exist_ok=True)
    if 'CLACKET_URL' not in os.environ:
        threading.Thread(target=serve.run, args=(PORT,), daemon=True).start()
    with sync_playwright() as p:
        kw = {'args': ['--no-sandbox']}
        if CHROME: kw['executable_path'] = CHROME
        b = p.chromium.launch(**kw)
        for name, vp in [('phone', {'width': 390, 'height': 844}), ('desktop', {'width': 1280, 'height': 900})]:
            ctx = b.new_context(viewport=vp, accept_downloads=True)
            ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
            pg = ctx.new_page()
            pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)))
            pg.on('requestfailed', lambda r: logs.append('requestfailed: ' + r.url))
            pg.on('request', lambda r: logs.append('external request: ' + r.url) if not r.url.startswith((BASE, 'blob:', 'data:')) else None)
            pg.goto(BASE + '/'); pg.wait_for_timeout(2600)
            pg.screenshot(path=os.path.join(OUT, name + '-0-start.png'))
            film(pg, name)
            pg.evaluate('window.scrollTo(0, 0)'); pg.wait_for_timeout(300)
            pg.screenshot(path=os.path.join(OUT, name + '-1-page.png'), full_page=True)
            pg.evaluate("document.getElementById('maker').scrollIntoView()"); pg.click('#next')
            check(name + ': an empty title is refused', pg.is_visible('#e-title') and pg.is_visible('[data-step="1"]'))
            pg.fill('#f-title', 'عرض تجريبي: اختبار 2026'); pg.fill('input[name=minutes]', '12')
            pg.click('#next'); pg.wait_for_timeout(150)
            pg.screenshot(path=os.path.join(OUT, name + '-2-place.png'))
            pg.click('#next')
            pg.set_input_files('#file', DECK); pg.wait_for_selector('#file-status .ok, #file-status .bad'); pg.wait_for_timeout(800)
            outline = pg.input_value('#outline')
            check(name + ': the deck is read', 'ok' in (pg.get_attribute('#file-status span', 'class') or '') and len(outline) > 50, pg.inner_text('#file-status'))
            pg.screenshot(path=os.path.join(OUT, name + '-3-content.png'))
            pg.click('#next'); pg.wait_for_timeout(200)
            out = pg.inner_text('#out')
            check(name + ': the prompt has its three parts', out.startswith('# Build me') and '## My existing deck' in out and '## 13. Before you tell me anything is done' in out)
            check(name + ': the outline is inside the prompt', outline.strip().split('\n')[0] in out)
            check(name + ': no placeholder is left', '[fill in]' not in out and 'undefined' not in out and 'NaN' not in out)
            pg.screenshot(path=os.path.join(OUT, name + '-4-prompt.png'))
            pg.click('#copy'); pg.wait_for_timeout(300)
            check(name + ': copy puts the whole prompt on the clipboard', pg.evaluate('navigator.clipboard.readText()').replace(chr(13), '') == pg.evaluate("document.getElementById('out').textContent"))  # Windows writes CRLF
            with pg.expect_download() as d: pg.click('#download')
            check(name + ': download gives a .txt file', d.value.suggested_filename == 'clacket-brief.txt')
            pg.click('#back'); pg.wait_for_timeout(500); pg.check('input[name=source][value=none]', force=True); pg.click('#next')
            out = pg.inner_text('#out')
            check(name + ': "later" asks for the tools first', 'none yet, build the tools first' in out and '## My ' not in out)
            pg.click('#back'); pg.wait_for_timeout(500); pg.check('input[name=source][value=paste]', force=True)
            pg.fill('#outline', 'الشريحة 1: مقدمة\nالشريحة 2: خاتمة'); pg.click('#next')
            out = pg.inner_text('#out')
            check(name + ': pasted points go under "My outline"', '## My outline' in out and 'الشريحة 2: خاتمة' in out)
            check(name + ': no sideways scrolling', not pg.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth'))
            bad = os.path.join(OUT, 'not-a-deck.pptx'); open(bad, 'w').write('hello')
            pg.click('#back'); pg.wait_for_timeout(500); pg.check('input[name=source][value=file]', force=True)
            pg.set_input_files('#file', bad); pg.wait_for_selector('#file-status .bad')
            check(name + ': a wrong file gets a plain message', True)
            pg.reload()
            check(name + ': answers are remembered, the file is not', pg.input_value('#f-title') != '' and pg.input_value('#outline') == '')
            ctx.close()
        # reduced motion: no camera moves, and every beat still lands on the same picture
        ctx = b.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce')
        pg = ctx.new_page(); pg.on('pageerror', lambda e: logs.append('pageerror: ' + str(e)))
        pg.goto(BASE + '/'); pg.wait_for_timeout(1200); idle(pg)
        n = pg.evaluate('ClacketShow.beats.length'); same = True
        for i in range(1, n):
            pg.evaluate('ClacketShow.go(%d)' % i); idle(pg); a = pg.evaluate(SNAP)
            pg.evaluate('ClacketShow.go(0, true)'); pg.evaluate('ClacketShow.go(%d, true)' % i); idle(pg)
            j = pg.evaluate(SNAP)
            if a != j:
                same = False; A, J = json.loads(a), json.loads(j)
                print('   reduced differs at', i, [k for k in range(5) if A[k] != J[k]], [(k, A[5][k], J[5][k]) for k in range(len(A[5])) if A[5][k] != J[5][k]][:3])
        check('reduced motion: every beat lands on the same picture', same)
        ctx.close()
        b.close()
    check('no browser errors, failed or external requests, under the live CSP', not logs, json.dumps(logs, ensure_ascii=False))
    print('\n' + ('ALL PASSED' if not fails else str(len(fails)) + ' FAILED') + '. Screenshots: ' + OUT)
    sys.exit(1 if fails else 0)

main()
