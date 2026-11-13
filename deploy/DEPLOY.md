# نشر كلاكيت على VPS

**الخادم:** Contabo، Ubuntu، ويستقبل الزيارات nginx على المضيف نفسه، والشهادة من certbot. الطريقة نفسها المتبعة في دليل العشاء.
**النطاق:** `clacket.bassamailab.xyz`، بسجل من نوع A في Namecheap يشير إلى `161.97.99.78` (IPv4 فقط).

## البنية

```
الإنترنت ─443→ nginx (المضيف) ─→ /var/www/clacket/current → releases/<تاريخ>-v<إصدار>/
```

- **صفحة ثابتة:** لا خادم تطبيق ولا قاعدة بيانات ولا Docker ولا بناء.
- **لا يمس المواقع الأخرى:** ملف إعداد مستقل وترويسات أمان مستقلة.
- **الإصدار الجاري:** الرابط `current` يشير إليه، ويحتفظ الخادم بآخر 5 إصدارات للتراجع.
- **ما يُنشر:** الملفات المذكورة في `deploy/FILES` فقط. الاختبارات والوثائق وسكربتات النشر لا تدخل مجلد الموقع.

## إصدار جديد (على جهاز التطوير)

1. ارفع `version` في `version.json`، وإن تغيّرت المطالبة فارفع `brief` أيضًا.
2. شغّل `bash deploy/make-sums.sh` لتحديث بصمات الملفات.
3. ارفع التعديل إلى `main`، ثم أنشئ الوسم وارفعه:

```bash
git tag v1.0.1 && git push origin v1.0.1
```

GitHub يصنع أرشيف الوسم تلقائيًا، فلا حاجة إلى GitHub Actions.

## التثبيت على الخادم

```bash
V=1.1.0
cd /root
curl -fL -o clacket-$V.tar.gz https://github.com/AQBassam/Clacket/archive/refs/tags/v$V.tar.gz
tar -xzf clacket-$V.tar.gz && cd Clacket-$V
bash deploy/install.sh          # تحقق الملفات، ثم تبديل current، ثم nginx -t وإعادة التحميل
bash deploy/verify.sh           # المتوقع: 22 ناجح بعد HTTPS
```

`install.sh` يتحقق من كل ملف ببصمته في `deploy/SHA256SUMS` قبل النسخ، وينسخ ترويسات الأمان إلى `/etc/nginx/snippets/` إن تغيّرت، ويعيد القديمة إن رفض `nginx -t` الإعداد.

**التراجع:** `bash deploy/rollback.sh` يعيد الرابط `current` إلى الإصدار السابق في ثانية.

## الإعداد لأول مرة

```bash
dig +short clacket.bassamailab.xyz            # المتوقع: 161.97.99.78
cp deploy/nginx/clacket-security-headers.conf /etc/nginx/snippets/
cp deploy/nginx/clacket.bassamailab.xyz.conf /etc/nginx/sites-available/clacket.bassamailab.xyz
ln -s /etc/nginx/sites-available/clacket.bassamailab.xyz /etc/nginx/sites-enabled/
bash deploy/install.sh
bash deploy/verify.sh http://127.0.0.1 clacket.bassamailab.xyz   # المتوقع: 19 ناجح
certbot --nginx -d clacket.bassamailab.xyz --redirect
bash deploy/verify.sh                                              # المتوقع: 22 ناجح
```

- **بعد certbot لا يُنسخ ملف الموقع من جديد.** certbot كتب أسطر الشهادة في الملف الحي، والنسخ فوقه يمحوها.
- **ملفات `.mjs`** تُخدَّم بنوع `text/javascript` بقاعدة خاصة في ملف الموقع، لأن nginx 1.24 لا يعرفها، والمتصفح يرفض قراءة PDF بدونها.
- **HSTS:** بعد يوم من عمل HTTPS بلا مشاكل، احذف `#` من سطره في ملف الترويسات وأعد التثبيت.

## ما اختُبر

البروفة الكاملة للإعداد لأول مرة (دون certbot) أُجريت على nginx 1.24 محليًا: `install.sh` ثم `verify.sh` بنتيجة 19 ناجح، ثم الاختبار الآلي للصفحة عبر nginx وسياسة الأمان مفعّلة، بلا أخطاء. قراءة PDF تعمل تحت سياسة الأمان.
