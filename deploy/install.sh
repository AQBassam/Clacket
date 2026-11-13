#!/usr/bin/env bash
# Installs this release on the server. Run from inside the extracted release folder:
#   sudo bash deploy/install.sh
# Options (environment): SITE_ROOT=/var/www/clacket  KEEP=5  SKIP_NGINX=1 (testing only)
set -euo pipefail

SITE_ROOT="${SITE_ROOT:-/var/www/clacket}"
KEEP="${KEEP:-5}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31mتوقف: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || [ "${SKIP_NGINX:-0}" = 1 ] || fail "شغّل السكربت بـ sudo."
[ -f "$HERE/index.html" ] && [ -f "$HERE/version.json" ] && [ -f "$HERE/deploy/SHA256SUMS" ] || fail "الملفات ناقصة؛ هل فُكّ الأرشيف كاملًا؟"

say "1/5 التحقق من سلامة الملفات (SHA-256)"
( cd "$HERE" && sha256sum --check --quiet deploy/SHA256SUMS ) || fail "ملف واحد على الأقل تغيّر أو تلف أثناء النقل."
echo "سليمة: $(wc -l < "$HERE/deploy/SHA256SUMS") ملفًا"

VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$HERE/version.json")
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="$SITE_ROOT/releases/$STAMP-v$VERSION"

say "2/5 نسخ الإصدار $VERSION إلى $DEST"
mkdir -p "$DEST"
# Only the files the site serves; tests, docs and deploy scripts stay out of the web root.
( cd "$HERE" && cp -a $(cat deploy/FILES) "$DEST/" )
find "$DEST" -type d -exec chmod 755 {} +
find "$DEST" -type f -exec chmod 644 {} +
[ "${SKIP_NGINX:-0}" = 1 ] || chown -R root:root "$DEST"

say "3/5 تبديل الرابط current (لحظي، دون انقطاع)"
PREV=""
[ -L "$SITE_ROOT/current" ] && PREV="$(readlink -f "$SITE_ROOT/current")"
[ -e "$SITE_ROOT/current" ] && [ ! -L "$SITE_ROOT/current" ] && fail "$SITE_ROOT/current موجود كمجلد عادي لا كرابط؛ انقله يدويًا أولًا."
ln -sfn "$DEST" "$SITE_ROOT/current.tmp"
mv -Tf "$SITE_ROOT/current.tmp" "$SITE_ROOT/current"
[ -n "$PREV" ] && [ "$PREV" != "$DEST" ] && echo "$PREV" > "$SITE_ROOT/.previous"
echo "current → $(readlink "$SITE_ROOT/current")"
[ -n "$PREV" ] && echo "السابق (للتراجع): $PREV"

say "4/5 الإبقاء على آخر $KEEP إصدارات"
ls -1dt "$SITE_ROOT"/releases/*/ | tail -n +$((KEEP + 1)) | while read -r d; do
  d="${d%/}"
  if [ "$d" != "$DEST" ] && [ "$d" != "$PREV" ]; then rm -rf -- "$d"; echo "حُذف: $d"; fi
done

say "5/5 فحص إعداد nginx وإعادة تحميله"
if [ "${SKIP_NGINX:-0}" = 1 ]; then
  echo "(تخطٍّ: وضع الاختبار)"
else
  SNIP=/etc/nginx/snippets/clacket-security-headers.conf
  if ! cmp -s "$HERE/deploy/nginx/clacket-security-headers.conf" "$SNIP"; then
    [ -f "$SNIP" ] && cp -a "$SNIP" "$SNIP.bak-$STAMP"
    cp "$HERE/deploy/nginx/clacket-security-headers.conf" "$SNIP"
    echo "حُدّثت ترويسات الأمان"
  fi
  if ! nginx -t; then
    [ -f "$SNIP.bak-$STAMP" ] && cp -a "$SNIP.bak-$STAMP" "$SNIP"
    fail "nginx -t رفض الإعداد؛ المواقع الأخرى لم تتأثر. للتراجع: sudo bash deploy/rollback.sh"
  fi
  systemctl reload nginx
  sleep 2
fi
printf '\n\033[1;32mتم. الإصدار %s يعمل الآن.\033[0m\n' "$VERSION"
