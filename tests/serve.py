"""Serve the site locally with the same security headers as the live nginx config.
Usage: python tests/serve.py [port]   (default 8765)
The headers are read from deploy/nginx/clacket-security-headers.conf, so a page
that breaks the Content-Security-Policy breaks here too."""
import http.server, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = os.path.join(ROOT, 'deploy', 'nginx', 'clacket-security-headers.conf')
HEADERS = []
for line in open(CONF, encoding='utf-8'):
    m = re.match(r'\s*add_header\s+(\S+)\s+"([^"]*)"', line)
    if m: HEADERS.append((m.group(1), m.group(2)))

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript', '.webp': 'image/webp', '.woff2': 'font/woff2'}
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def end_headers(self):
        for k, v in HEADERS: self.send_header(k, v)
        super().end_headers()
    def log_message(self, *a): pass

def run(port=8765):
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()

if __name__ == '__main__':
    run(int(sys.argv[1]) if len(sys.argv) > 1 else 8765)
