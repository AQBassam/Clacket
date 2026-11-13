#!/usr/bin/env bash
# Checks the deployed site with curl, from the server or any machine:
#   bash deploy/verify.sh                                         # https://clacket.bassamailab.xyz
#   bash deploy/verify.sh http://127.0.0.1 clacket.bassamailab.xyz  # on the server, before TLS
set -uo pipefail
BASE="${1:-https://clacket.bassamailab.xyz}"
HOSTH="${2:-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECT="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$HERE/version.json" 2>/dev/null)"
pass=0; failn=0
H=(); [ -n "$HOSTH" ] && H=(-H "Host: $HOSTH")
ok()  { printf '  \033[32mناجح\033[0m  %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  \033[31mفاشل\033[0m  %s — %s\n' "$1" "$2"; failn=$((failn+1)); }
hdr() { curl -sS -o /dev/null -D - --max-time 15 "${H[@]}" "$BASE$1" | tr -d '\r'; }
has() { grep -qi -- "$2" <<<"$1"; }
code() { head -1 <<<"$1"; }

echo "فحص $BASE"
h=$(hdr /)
has "$h" '^HTTP/[0-9.]* 200' && ok "الصفحة الرئيسية 200" || bad "الصفحة الرئيسية" "$(code "$h")"
has "$h" 'content-type: text/html' && ok "نوع المحتوى HTML" || bad "نوع المحتوى" "$(grep -i content-type <<<"$h")"
has "$h" "content-security-policy: default-src 'self'" && ok "سياسة CSP موجودة" || bad "CSP" "مفقودة"
has "$h" "connect-src 'self';" && ok "CSP لا تسمح بالاتصال بأي خادم آخر" || bad "CSP connect-src" "$(grep -io "connect-src[^;]*" <<<"$h")"
has "$h" 'x-content-type-options: nosniff' && ok "nosniff" || bad "nosniff" "مفقود"
has "$h" 'cache-control: no-cache' && ok "الصفحة لا تُخزَّن قديمة" || bad "Cache-Control للصفحة" "$(grep -i cache-control <<<"$h")"

for f in /js/app.js /js/brief.js /js/readers.js /js/show.js /vendor/fflate.js /vendor/gsap.min.js; do
  a=$(hdr "$f")
  has "$a" '^HTTP/[0-9.]* 200' && has "$a" 'content-type: \(application\|text\)/javascript' && ok "$f" || bad "$f" "$(code "$a") $(grep -i content-type <<<"$a")"
done
for f in /vendor/pdfjs/pdf.min.mjs /vendor/pdfjs/pdf.worker.min.mjs; do
  a=$(hdr "$f")
  has "$a" '^HTTP/[0-9.]* 200' && has "$a" 'content-type: text/javascript' && ok "$f بنوع text/javascript (قراءة PDF)" || bad "$f" "$(code "$a") $(grep -i content-type <<<"$a")"
done
c=$(hdr /css/style.css); has "$c" 'content-type: text/css' && ok "ملف التنسيق" || bad "ملف التنسيق" "$(code "$c")"
f=$(hdr /assets/fonts/tajawal-arabic-700-normal.woff2)
has "$f" '^HTTP/[0-9.]* 200' && has "$f" 'immutable' && ok "الخطوط مخزنة سنة" || bad "الخطوط" "$(code "$f") $(grep -i cache-control <<<"$f")"
d=$(hdr /.previous); has "$d" '^HTTP/[0-9.]* 40[34]' && ok "الملفات المخفية محجوبة" || bad "الملفات المخفية" "$(code "$d")"
t=$(hdr /tests/smoke.py); has "$t" '^HTTP/[0-9.]* 404' && ok "ملفات الاختبار ليست منشورة" || bad "ملفات الاختبار" "$(code "$t")"

v=$(curl -sS --max-time 15 "${H[@]}" "$BASE/version.json")
got=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' <<<"$v")
[ -n "$got" ] && [ "$got" = "$EXPECT" ] && ok "الإصدار المنشور $got يطابق الحزمة" || bad "مطابقة الإصدار" "المنشور: ${got:-لا شيء} / المتوقع: ${EXPECT:-؟}"

if [[ "$BASE" == https://* ]]; then
  r=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 15 "http://${BASE#https://}/")
  [[ "$r" == 301\ https://* || "$r" == 308\ https://* ]] && ok "HTTP يحوّل إلى HTTPS" || bad "التحويل إلى HTTPS" "$r"
  host="${BASE#https://}"; host="${host%%/*}"
  exp=$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null)
  [ -n "$exp" ] && ok "شهادة TLS: $exp" || bad "شهادة TLS" "تعذرت قراءتها"
fi
echo; echo "النتيجة: $pass ناجح، $failn فاشل"
[ "$failn" -eq 0 ]
