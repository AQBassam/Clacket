"""Clacket smoke test. Usage: python3 tests/smoke.py /path/to/deck.pptx [chrome-path]
Serves the repo locally, drives a hidden Chrome, writes screenshots to tests/out/.
Needs: pip install playwright. Exits 1 on any failure.
Set CLACKET_URL=http://host to test a running server instead of a local copy."""
import json, os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out')
DECK = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else None
CHROME = sys.argv[2] if len(sys.argv) > 2 else None
PORT = '8765'
BASE = os.environ.get('CLACKET_URL', 'http://127.0.0.1:' + PORT)
fails, logs = [], []

def check(name, ok, detail=''):
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' :: ' + str(detail)) if detail and not ok else ''))
    if not ok: fails.append(name)

def main():
    if not DECK or not os.path.exists(DECK):
        sys.exit('Give the path of a .pptx file to test with.')
    os.makedirs(OUT, exist_ok=True)
    srv = None if 'CLACKET_URL' in os.environ else subprocess.Popen([sys.executable, '-m', 'http.server', PORT, '--bind', '127.0.0.1', '-d', ROOT],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
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
                pg.on('request', lambda r: logs.append('external request: ' + r.url) if not r.url.startswith(('http://127.0.0.1', 'blob:', 'data:')) else None)
                pg.goto(BASE + '/'); pg.wait_for_timeout(500)
                pg.screenshot(path=os.path.join(OUT, name + '-1-page.png'), full_page=True)
                # the live show: Back and jump must land on the same picture as clicking through
                snap = '''() => JSON.stringify([Math.round(ClacketShow.state.shape*1000), document.getElementById('stage').dataset.beat,
                    document.querySelector('.count').textContent,
                    [...document.querySelectorAll('#stage .scene, #stage .w, #stage [data-in]')].map(e => getComputedStyle(e).opacity + getComputedStyle(e).visibility[0] + getComputedStyle(e).transform)])'''
                pg.wait_for_timeout(300); pg.wait_for_function('() => !ClacketShow.busy()'); pg.wait_for_timeout(80)
                n = pg.evaluate('ClacketShow.beats.length'); same = True
                pg.focus('#stage')
                for i in range(1, n):
                    pg.keyboard.press('ArrowRight'); pg.wait_for_function('() => !ClacketShow.busy()'); pg.wait_for_timeout(80)
                    through = pg.evaluate(snap)
                    if i < n - 1:
                        pg.keyboard.press('ArrowRight'); pg.wait_for_function('() => !ClacketShow.busy()'); pg.wait_for_timeout(80); pg.keyboard.press('ArrowLeft'); pg.wait_for_function('() => !ClacketShow.busy()'); pg.wait_for_timeout(80)
                        back = pg.evaluate(snap)
                    else: back = through
                    pg.evaluate('ClacketShow.go(0, true)'); pg.evaluate('ClacketShow.go(%d, true)' % i); pg.wait_for_timeout(120)
                    jump = pg.evaluate(snap)
                    if not (through == back == jump): same = False; print('   differs at beat', i)
                check(name + ': show: click-through, Back and jump give the same picture on all %d beats' % n, same)
                pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(100)
                check(name + ': show: a press during an animation finishes it and moves on', pg.evaluate('ClacketShow.beats.length') > 0)
                pg.keyboard.press('Home'); pg.keyboard.press('KeyB'); on = pg.evaluate("document.querySelector('.cover').classList.contains('on')")
                beat0 = pg.get_attribute('#stage', 'data-beat'); pg.keyboard.press('ArrowRight')
                check(name + ': show: B blacks the screen and the next press only brings it back', on and pg.get_attribute('#stage', 'data-beat') == beat0 and not pg.evaluate("document.querySelector('.cover').classList.contains('on')"))
                check(name + ': show: Arabic words are whole, no letter is split', pg.evaluate("[...document.querySelectorAll('#stage .w')].every(w => !/[\\u0600-\\u06FF]/.test(w.textContent) || w.textContent.trim().length > 1 || /^[\\u0648]$/.test(w.textContent.trim()))"))
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
                check(name + ': copy puts the whole prompt on the clipboard', pg.evaluate('navigator.clipboard.readText()') == pg.evaluate("document.getElementById('out').textContent"))
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
            b.close()
    finally:
        if srv: srv.terminate()
    check('no browser errors, failed or external requests', not logs, json.dumps(logs, ensure_ascii=False))
    print('\n' + ('ALL PASSED' if not fails else str(len(fails)) + ' FAILED') + '. Screenshots: ' + OUT)
    sys.exit(1 if fails else 0)

main()
