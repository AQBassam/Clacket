/* Clacket: the wizard and the prompt builder. No network calls anywhere. */
(function () {
  'use strict';
  var B = window.CLACKET_BRIEF, R = window.ClacketReaders;
  var form = document.getElementById('form');
  var $ = function (id) { return document.getElementById(id); };
  var step = 1, deck = null;
  var KEY = 'clacket.form.v1';

  $('ver').textContent = B.VERSION;

  /* ---------- reading the form ---------- */
  function val(name) {
    var el = form.elements[name];
    if (!el) return '';
    if (el.length && !el.tagName) {            /* radio group or checkbox group */
      var out = [];
      for (var i = 0; i < el.length; i++) if (el[i].checked) out.push(el[i].value);
      return el[0].type === 'checkbox' ? out : (out[0] || '');
    }
    if (el.type === 'checkbox') return el.checked;
    return el.value.trim();
  }
  /* Free text goes onto one line of the prompt. */
  function oneLine(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  /* ---------- building the prompt ---------- */
  function aboutBlock() {
    var source = val('source');
    var outline = $('outline').value.trim();
    var hasOutline = source !== 'none' && outline.length > 0;
    var fromFile = source === 'file' && !!deck;

    var node = { yes: 'yes', no: 'no', unknown: "I don't know. Check for me, and if you need it tell me exactly how to install it" }[val('node')];
    var clicker = val('clicker');
    var model = oneLine(val('clickerModel'));
    var clickerLine = clicker === 'yes' ? ('yes, ' + (model ? 'model: ' + model : 'model unknown'))
      : clicker === 'no' ? 'none, I will use the keyboard' : 'unknown';

    var supplies = val('sup').slice();
    if (fromFile) supplies.unshift('my original ' + (deck.kind === 'pptx' ? 'PowerPoint' : 'PDF') + ' file (see "My existing deck")');
    else if (hasOutline) supplies.unshift('an outline (see "My outline")');

    var minutes = val('minutes');
    var lines = [
      '## About my talk',
      '- Title and topic: ' + oneLine(val('title')),
      '- Audience and occasion: ' + (oneLine(val('audience')) || 'decide for me'),
      '- Length in minutes: ' + (minutes ? String(parseInt(minutes, 10)) : 'decide for me, and tell me what you assumed'),
      '- Slide language: ' + val('slideLang'),
      '- Language you use with me (chat, speaker notes, help, README): ' + val('chatLang'),
      '- Room: ' + val('room'),
      '- Presenting computer: ' + val('computer'),
      '- Keyboard layout on that computer: ' + val('keyboard'),
      '- Node.js installed on my computer: ' + node,
      '- Clicker: ' + clickerLine,
      '- What I will supply: ' + (supplies.length ? supplies.join('; ') : 'nothing yet'),
      '- First slides I want: ' + (fromFile ? (hasOutline ? 'the slides of my existing deck, below' : 'the slides of my existing deck; read the file') : hasOutline ? 'the slides in my outline, below' : 'none yet, build the tools first')
    ];
    var out = lines.join('\n');

    if (fromFile) {
      var hasNotes = deck.slides.some(function (s) { return s.notes; });
      out += '\n\n## My existing deck\n'
        + 'I am converting an existing presentation: "' + oneLine(deck.fileName) + '" (' + deck.slides.length + ' slides).\n'
        + 'I will put that file in this project folder. Take the images from it. If the\n'
        + 'file is not there or you cannot open it, tell me before you go on.\n\n'
        + (hasOutline ? 'The outline below was extracted from the file by a script. It is raw\n'
          + 'material, not a slide plan:\n' : 'I am not giving you an outline: read the file itself. Then:\n')
        + '- Keep my wording, my facts and my numbers. Add none of your own.\n'
        + '- My slides are denser than this brief allows. Split them into pages and\n'
        + '  clicks (section 4: one idea per click; section 9: a page is one idea) and\n'
        + '  show me the split in Phase 0. Text that will not fit on screen moves to the\n'
        + '  speaker notes, not to the bin.\n'
        + (hasOutline ? '- Extraction can put text in the wrong order or miss text that is inside a\n'
          + '  picture. Where the outline looks scrambled or thin, check the original\n'
          + '  file, or ask me.\n' : '')
        + (deck.kind === 'pdf' && hasOutline ? '- This came from a PDF, so the outline has no speaker notes and no image\n  counts, and Arabic text may be damaged. Rely on the file itself.\n' : '')
        + (hasNotes ? '- Lines marked "Notes:" or "ملاحظات:" are my own speaker notes. Use them as\n  the notes.\n'
          : val('draftNotes') ? '- My deck has no speaker notes. Draft notes for each click from the slide\n  content only, add no facts, and show them to me for approval.\n'
          : '- My deck has no speaker notes. Leave the notes short and ask me for them.\n')
        + (hasOutline ? '\n' + outline : '');
    } else if (hasOutline) {
      out += '\n\n## My outline\n'
        + 'These are my own points for the talk. Keep my wording, my facts and my\n'
        + 'numbers, and add none of your own. Split them into pages and clicks\n'
        + '(section 4: one idea per click; section 9: a page is one idea) and show me\n'
        + 'the split in Phase 0. Draft speaker notes from this content only and show\n'
        + 'them to me for approval.\n\n' + outline;
    }
    return out;
  }
  function buildPrompt() {
    return B.TITLE + '\n\n' + aboutBlock() + '\n\n' + B.BODY + '\n';
  }
  window.ClacketApp = { buildPrompt: buildPrompt };

  /* ---------- steps ---------- */
  function show(n) {
    if (n > 1 && !val('title')) {
      step = 1; n = 1;
      $('e-title').hidden = false; $('f-title').classList.add('bad'); $('f-title').focus();
    }
    step = n;
    Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (p) {
      p.hidden = Number(p.getAttribute('data-step')) !== n;
    });
    Array.prototype.forEach.call($('steps').children, function (li) {
      var k = Number(li.getAttribute('data-go'));
      li.className = k === n ? 'on' : k < n ? 'done' : '';
      if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('back').hidden = n === 1;
    $('next').hidden = n === 4;
    $('next').textContent = n === 3 ? 'ولّد المطالبة' : 'التالي';
    if (n === 4) renderOutput();
  }
  function renderOutput() {
    var text = buildPrompt();
    $('out').textContent = text;
    var words = text.split(/\s+/).length;
    $('out-meta').textContent = 'نسخة المطالبة ' + B.VERSION + ' · نحو ' + words.toLocaleString('en-US') + ' كلمة. هي بالإنجليزية لأنها موجهة للوكيل.';
    $('copy-status').textContent = '';
    var fromFile = val('source') === 'file' && deck;
    $('next-file').textContent = fromFile ? '، وانسخ إليه ملف عرضك «' + deck.fileName + '»' : '';
  }
  $('next').addEventListener('click', function () { show(step + 1); scrollToMaker(); });
  $('back').addEventListener('click', function () { show(step - 1); scrollToMaker(); });
  $('steps').addEventListener('click', function (e) {
    var li = e.target.closest('li');
    if (li && li.className === 'done') { show(Number(li.getAttribute('data-go'))); scrollToMaker(); }
  });
  function scrollToMaker() {
    var top = $('maker').getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) $('maker').scrollIntoView();
  }
  $('f-title').addEventListener('input', function () { $('e-title').hidden = true; this.classList.remove('bad'); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'file') { e.preventDefault(); if (step < 4) show(step + 1); }
  });

  /* ---------- content source ---------- */
  function syncSource() {
    var s = val('source');
    $('src-file').hidden = s !== 'file';
    $('src-paste').hidden = s !== 'paste';
    var showOutline = s === 'paste' || (s === 'file' && deck);
    $('outline-wrap').hidden = !showOutline;
    $('outline-lab').textContent = s === 'paste' ? 'محاور العرض' : 'محتوى الشرائح كما قرأناه. راجعه وعدّل ما تشاء.';
    $('outline').placeholder = s === 'paste' ? 'الشريحة 1: ...\nالشريحة 2: ...' : '';
    var noNotes = s === 'file' && deck && !deck.slides.some(function (x) { return x.notes; });
    $('notes-field').hidden = !noNotes;
  }
  function syncClicker() { $('f-clicker-model').hidden = val('clicker') !== 'yes'; }
  form.addEventListener('change', function (e) {
    if (e.target.name === 'source') syncSource();
    if (e.target.name === 'clicker') syncClicker();
    save();
  });
  form.addEventListener('input', save);

  /* ---------- the file ---------- */
  var MSG = {
    'not-zip': 'تعذّر فتح الملف. قد يكون تالفًا أو محميًا بكلمة مرور.',
    'not-pptx': 'هذا ليس ملف PowerPoint. اختر ملفًا بصيغة pptx أو pdf.',
    'no-slides': 'لم نجد شرائح في هذا الملف.',
    'old-ppt': 'صيغة ppt القديمة غير مدعومة. افتح الملف في PowerPoint واحفظه بصيغة pptx ثم أعد المحاولة.',
    'unknown-type': 'نوع الملف غير مدعوم. اختر ملفًا بصيغة pptx أو pdf.'
  };
  function span(cls, text) { var s = document.createElement('span'); s.className = cls; s.textContent = text; return s; }
  function handleFile(file) {
    var box = $('file-status');
    box.textContent = '';
    if (!file) return;
    if (file.size > 150 * 1024 * 1024) { box.appendChild(span('bad', 'الملف أكبر من 150 ميغابايت. جرّب نسخة أصغر، أو اختر «سأكتب النقاط».')); return; }
    box.appendChild(span('ok', 'جارٍ قراءة الملف…'));
    R.readFile(file).then(function (d) {
      deck = d;
      box.textContent = '';
      var withText = d.slides.filter(function (s) { return s.title || s.lines.length; }).length;
      box.appendChild(span('ok', 'قرأنا ' + d.slides.length + ' شريحة من «' + d.fileName + '»، منها ' + withText + ' فيها نص.'));
      d.warnings.forEach(function (w) {
        var t = w.code === 'empty-slides' ? w.count + ' شريحة بلا نص مقروء. إن كان نصها داخل صور فاكتبه بيدك في الخانة أدناه.'
          : w.code === 'pdf-limits' ? 'ملف PDF لا يحمل ملاحظات المتحدث، وترتيب النص العربي فيه قد يختل. راجع النص أدناه.'
          : w.code === 'pdf-damaged' ? 'النص العربي في هذا الملف خرج مشوّهًا، وهذا شائع في ملفات PDF. الأفضل أن ترفع ملف pptx. وإن لم يتوفر فصحّح النص أدناه بيدك، أو امسحه كله ليقرأ الوكيل الملف نفسه.'
          : w.code === 'pdf-no-text' ? 'هذا الملف صور بلا نص، فلم نستطع قراءة شيء. ارفع ملف pptx، أو اختر «سأكتب النقاط».'
          : '';
        if (t) box.appendChild(span('warn', t));
      });
      $('outline').value = R.toOutline(d);
      $('outline-hint').textContent = 'هذا النص سيدخل المطالبة كما هو. الوكيل هو من يقسّمه إلى صفحات ونقرات، فلا تختصره أنت.';
      if (!val('title')) { /* nothing: the title was asked in step 1 */ }
      syncSource();
    }).catch(function (err) {
      deck = null;
      box.textContent = '';
      box.appendChild(span('bad', MSG[err && err.message] || 'تعذّرت قراءة الملف. جرّب ملفًا آخر، أو اختر «سأكتب النقاط».'));
      syncSource();
    });
  }
  $('file').addEventListener('change', function () { handleFile(this.files[0]); });
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

  /* ---------- copy and download ---------- */
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }
  $('copy').addEventListener('click', function () {
    var text = $('out').textContent, st = $('copy-status');
    var done = function (ok) { st.textContent = ok ? 'نُسخت المطالبة. الصقها في وكيل البرمجة.' : 'لم نستطع النسخ تلقائيًا. حدّد النص أدناه وانسخه، أو نزّله ملفًا.'; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
    else done(fallbackCopy(text));
  });
  $('download').addEventListener('click', function () {
    var blob = new Blob([$('out').textContent], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'clacket-brief.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    $('copy-status').textContent = 'نُزّل الملف clacket-brief.txt. افتحه وانسخ محتواه كاملًا إلى الوكيل.';
  });

  /* ---------- remembering answers on this device (never the file) ---------- */
  var FIELDS = ['title', 'audience', 'minutes', 'slideLang', 'chatLang', 'room', 'computer', 'keyboard', 'clicker', 'clickerModel', 'node'];
  function save() {
    try {
      var data = {};
      FIELDS.forEach(function (f) { data[f] = val(f); });
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function restore() {
    var data;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
    if (!data) return;
    FIELDS.forEach(function (f) {
      var el = form.elements[f], v = data[f];
      if (!el || v == null || v === '') return;
      if (el.length && !el.tagName) { for (var i = 0; i < el.length; i++) if (el[i].value === v) el[i].checked = true; }
      else el.value = v;
    });
  }
  restore(); syncSource(); syncClicker(); show(1);
})();
