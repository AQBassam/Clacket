/* Clacket: reads a .pptx or .pdf inside the browser. Nothing is uploaded.
   Both readers return { kind, fileName, slides: [{ n, title, lines[], notes, images }], warnings[] } */
(function () {
  'use strict';

  var BASE = (document.currentScript && document.currentScript.src) || location.href;

  var NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  var NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

  function clean(s) {
    return String(s || '').replace(/[​‌‎‏‪-‮⁦-⁩﻿]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  /* Runs inside one paragraph are pieces of one sentence. Join them, then fix
     the spaces that the pieces carried around punctuation. */
  function tidy(s) {
    return clean(s).replace(/\s+([؟?!،,.:؛;%])/g, '$1').replace(/([(\[«])\s+/g, '$1').replace(/\s+([)\]»])/g, '$1');
  }
  function kids(el, ns, name) {
    var out = [], c = el.firstElementChild;
    while (c) { if (c.namespaceURI === ns && c.localName === name) out.push(c); c = c.nextElementSibling; }
    return out;
  }
  function first(el, ns, name) { return el ? el.getElementsByTagNameNS(ns, name)[0] || null : null; }
  function parseXml(bytes) {
    var text = new TextDecoder('utf-8').decode(bytes);
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('xml');
    return doc;
  }
  function resolve(base, target) {
    if (target.charAt(0) === '/') return target.slice(1);
    var parts = base.split('/'); parts.pop();
    target.split('/').forEach(function (p) {
      if (p === '..') parts.pop(); else if (p !== '.') parts.push(p);
    });
    return parts.join('/');
  }
  function relsOf(files, path) {
    var i = path.lastIndexOf('/');
    var relPath = path.slice(0, i) + '/_rels/' + path.slice(i + 1) + '.rels';
    var out = [];
    if (!files[relPath]) return out;
    var doc = parseXml(files[relPath]);
    var els = doc.getElementsByTagNameNS(NS_REL, 'Relationship');
    for (var k = 0; k < els.length; k++) {
      out.push({
        id: els[k].getAttribute('Id'),
        type: (els[k].getAttribute('Type') || '').split('/').pop(),
        target: els[k].getAttribute('TargetMode') === 'External' ? null : resolve(path, els[k].getAttribute('Target'))
      });
    }
    return out;
  }

  /* One paragraph: text of its runs joined, plus its largest font size. */
  function paragraph(p) {
    var text = '', size = 0, c = p.firstElementChild;
    while (c) {
      if (c.namespaceURI === NS_A) {
        if (c.localName === 'r' || c.localName === 'fld') {
          var t = first(c, NS_A, 't');
          if (t) text += t.textContent;
          var rPr = first(c, NS_A, 'rPr');
          var sz = rPr ? parseInt(rPr.getAttribute('sz'), 10) : 0;
          if (sz > size) size = sz;
        } else if (c.localName === 'br') { text += ' '; }
      }
      c = c.nextElementSibling;
    }
    return { text: tidy(text), size: size };
  }
  function placeholderType(sp) {
    var ph = first(sp, NS_P, 'ph');
    return ph ? (ph.getAttribute('type') || 'body') : null;
  }
  function offsetOf(el) {
    var off = first(el, NS_A, 'off');
    return off ? { x: parseInt(off.getAttribute('x'), 10) || 0, y: parseInt(off.getAttribute('y'), 10) || 0 } : { x: 0, y: 0 };
  }

  /* Collect text blocks of a shape tree, each with a rough position. Shapes
     inside a group take the group's position: good enough to order by. */
  function collect(tree, pos, out) {
    var c = tree.firstElementChild;
    while (c) {
      if (c.namespaceURI === NS_P) {
        if (c.localName === 'sp') {
          var ph = placeholderType(c);
          if (ph !== 'dt' && ph !== 'sldNum' && ph !== 'ftr' && ph !== 'hdr' && ph !== 'sldImg') {
            var body = kids(c, NS_P, 'txBody')[0];
            if (body) {
              var paras = kids(body, NS_A, 'p').map(paragraph).filter(function (q) { return q.text; });
              if (paras.length) out.push({ pos: pos || offsetOf(c), ph: ph, paras: paras });
            }
          }
        } else if (c.localName === 'grpSp') {
          collect(c, pos || offsetOf(c), out);
        } else if (c.localName === 'graphicFrame') {
          var rows = c.getElementsByTagNameNS(NS_A, 'tr');
          var tpos = pos || offsetOf(c);
          for (var r = 0; r < rows.length; r++) {
            var cells = kids(rows[r], NS_A, 'tc').map(function (tc) {
              return tidy(Array.prototype.map.call(tc.getElementsByTagNameNS(NS_A, 'p'), function (p) { return paragraph(p).text; }).join(' '));
            }).filter(Boolean);
            if (cells.length) out.push({ pos: { x: tpos.x, y: tpos.y + r }, ph: 'table', paras: [{ text: cells.join(' | '), size: 0 }] });
          }
        }
      }
      c = c.nextElementSibling;
    }
  }

  function readSlide(files, path, rtl) {
    var doc = parseXml(files[path]);
    var tree = first(doc, NS_P, 'spTree');
    var blocks = [];
    if (tree) collect(tree, null, blocks);
    /* Reading order: top to bottom, then from the reading side. */
    var band = 250000; /* about 7 mm: boxes this close in height share a row */
    blocks.sort(function (a, b) {
      var dy = a.pos.y - b.pos.y;
      if (Math.abs(dy) > band) return dy;
      return rtl ? b.pos.x - a.pos.x : a.pos.x - b.pos.x;
    });

    var title = '', lines = [];
    var titled = blocks.filter(function (b) { return b.ph === 'title' || b.ph === 'ctrTitle'; })[0];
    if (titled) {
      title = titled.paras.map(function (p) { return p.text; }).join(' ');
    } else {
      /* Designed decks have no title placeholder. The title is the block set
         in the largest type, if one clearly stands out. */
      var best = null, bestSize = 0, sizes = [];
      blocks.forEach(function (b) {
        var s = Math.max.apply(null, b.paras.map(function (p) { return p.size; }));
        if (s) sizes.push(s);
        if (s > bestSize) { bestSize = s; best = b; }
      });
      if (best && best.paras.map(function (p) { return p.text; }).join(' ').length <= 140) {
        titled = best;
        title = best.paras.map(function (p) { return p.text; }).join(' ');
      }
    }
    blocks.forEach(function (b) {
      if (b === titled) return;
      b.paras.forEach(function (p) { lines.push(p.text); });
    });

    var rels = relsOf(files, path);
    var images = rels.filter(function (r) { return r.type === 'image'; }).length;
    var notes = '';
    var nrel = rels.filter(function (r) { return r.type === 'notesSlide'; })[0];
    if (nrel && nrel.target && files[nrel.target]) {
      var ndoc = parseXml(files[nrel.target]);
      var sps = ndoc.getElementsByTagNameNS(NS_P, 'sp');
      var parts = [];
      for (var i = 0; i < sps.length; i++) {
        /* Only the notes body. Date, slide number and footer boxes are noise. */
        if (placeholderType(sps[i]) !== 'body') continue;
        var body = kids(sps[i], NS_P, 'txBody')[0];
        if (!body) continue;
        kids(body, NS_A, 'p').forEach(function (p) { var q = paragraph(p).text; if (q) parts.push(q); });
      }
      notes = parts.join(' ');
    }
    return { title: title, lines: lines, notes: notes, images: images };
  }

  function readPptx(buffer, fileName) {
    var files;
    try { files = window.fflate.unzipSync(new Uint8Array(buffer), {
      filter: function (f) { return /\.(xml|rels)$/.test(f.name); }
    }); } catch (e) { throw new Error('not-zip'); }
    var main = 'ppt/presentation.xml';
    if (!files[main]) throw new Error('not-pptx');
    var pres = parseXml(files[main]);
    var rels = relsOf(files, main);
    var byId = {};
    rels.forEach(function (r) { byId[r.id] = r.target; });
    var ids = pres.getElementsByTagNameNS(NS_P, 'sldId');
    var paths = [];
    for (var i = 0; i < ids.length; i++) {
      var t = byId[ids[i].getAttributeNS(NS_R, 'id')];
      if (t && files[t]) paths.push(t);
    }
    if (!paths.length) throw new Error('no-slides');

    /* Decide the reading side from the text itself. */
    var sample = '';
    paths.slice(0, 5).forEach(function (p) { sample += new TextDecoder('utf-8').decode(files[p]).replace(/<[^>]+>/g, ' '); });
    var rtl = (sample.match(/[؀-ۿ]/g) || []).length > (sample.match(/[A-Za-z]/g) || []).length;

    var slides = paths.map(function (p, i) {
      var s = readSlide(files, p, rtl);
      s.n = i + 1;
      /* A bare number equal to the slide's own number is a page number, in
         the slide or in an otherwise empty notes box. Drop it. */
      var isOwnNumber = function (t) { return /^\d{1,3}$/.test(t) && parseInt(t, 10) === s.n; };
      s.lines = s.lines.filter(function (l) { return !isOwnNumber(l) && !/^0\d$/.test(l); });
      if (/^[\d\s.\/-]*$/.test(s.notes)) s.notes = '';
      return s;
    });
    var warnings = [];
    var empty = slides.filter(function (s) { return !s.title && !s.lines.length; }).length;
    if (empty) warnings.push({ code: 'empty-slides', count: empty });
    if (!slides.some(function (s) { return s.notes; })) warnings.push({ code: 'no-notes' });
    return { kind: 'pptx', fileName: fileName, rtl: rtl, slides: slides, warnings: warnings };
  }

  /* PDF: one page is one slide. Text items are grouped into lines by height. */
  function readPdf(buffer, fileName) {
    return import(new URL('../vendor/pdfjs/pdf.min.mjs', BASE).href).then(function (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', BASE).href;
      return pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
    }).then(function (pdf) {
      var jobs = [];
      for (var n = 1; n <= pdf.numPages; n++) jobs.push(pdf.getPage(n).then(function (page) { return page.getTextContent(); }));
      return Promise.all(jobs);
    }).then(function (pages) {
      var slides = pages.map(function (content, i) {
        var rows = [];
        content.items.forEach(function (it) {
          if (!it.str || !it.str.trim()) return;
          var y = it.transform[5], h = Math.abs(it.transform[3]) || it.height || 10, x = it.transform[4];
          var row = null;
          for (var k = 0; k < rows.length; k++) if (Math.abs(rows[k].y - y) < h * 0.5) { row = rows[k]; break; }
          if (!row) { row = { y: y, h: h, items: [] }; rows.push(row); }
          if (h > row.h) row.h = h;
          row.items.push({ x: x, str: it.str.normalize ? it.str.normalize('NFKC') : it.str, rtl: it.dir === 'rtl' });
        });
        rows.sort(function (a, b) { return b.y - a.y; });
        var lines = rows.map(function (r) {
          var rtl = r.items.filter(function (q) { return q.rtl; }).length > r.items.length / 2;
          r.items.sort(function (a, b) { return rtl ? b.x - a.x : a.x - b.x; });
          return { text: tidy(r.items.map(function (q) { return q.str; }).join(' ')), h: r.h };
        }).filter(function (l) { return l.text; });
        var title = '';
        if (lines.length) {
          var big = lines.reduce(function (a, b) { return b.h > a.h ? b : a; });
          var second = lines.filter(function (l) { return l !== big; }).reduce(function (m, l) { return Math.max(m, l.h); }, 0);
          if (big.h > second * 1.15 && big.text.length <= 140) { title = big.text; lines = lines.filter(function (l) { return l !== big; }); }
        }
        return { n: i + 1, title: title, lines: lines.map(function (l) { return l.text; }), notes: '', images: 0 };
      });
      var warnings = [{ code: 'pdf-limits' }];
      var empty = slides.filter(function (s) { return !s.title && !s.lines.length; }).length;
      if (empty === slides.length) warnings.push({ code: 'pdf-no-text' });
      else if (empty) warnings.push({ code: 'empty-slides', count: empty });
      var all = slides.map(function (s) { return s.title + ' ' + s.lines.join(' '); }).join(' ');
      var rtl = (all.match(/[\u0600-\u06FF]/g) || []).length > (all.match(/[A-Za-z]/g) || []).length;
      /* Arabic set in a PDF often comes out as loose letters or with digits
         inside words. Measure it and say so, instead of passing it on quietly. */
      if (rtl) {
        var words = all.split(/\s+/).filter(function (w) { return /[\u0600-\u06FF]/.test(w); });
        var broken = words.filter(function (w) { return w.length === 1 || /[\u0600-\u06FF]\d|\d[\u0600-\u06FF]/.test(w); }).length;
        if (words.length > 20 && broken / words.length > 0.12) warnings.push({ code: 'pdf-damaged' });
      }
      return { kind: 'pdf', fileName: fileName, rtl: rtl, slides: slides, warnings: warnings };
    });
  }

  function readFile(file) {
    return file.arrayBuffer().then(function (buf) {
      var head = new Uint8Array(buf.slice(0, 5));
      var isZip = head[0] === 0x50 && head[1] === 0x4B;
      var isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
      if (isZip) return readPptx(buf, file.name);
      if (isPdf) return readPdf(buf, file.name);
      if (/\.ppt$/i.test(file.name)) throw new Error('old-ppt');
      throw new Error('unknown-type');
    });
  }

  /* Plain-text outline the person can edit before it goes into the prompt. */
  function toOutline(deck) {
    return deck.slides.map(function (s) {
      var ar = deck.rtl;
      var out = [(ar ? 'الشريحة ' : 'Slide ') + s.n + ': ' + (s.title || (ar ? '(بلا عنوان واضح)' : '(no title found)'))];
      s.lines.forEach(function (l) { out.push('  - ' + l); });
      if (s.images) out.push(ar ? '  [صور في هذه الشريحة: ' + s.images + ']' : '  [images on this slide: ' + s.images + ']');
      if (s.notes) out.push((ar ? '  ملاحظات: ' : '  Notes: ') + s.notes);
      return out.join('\n');
    }).join('\n\n');
  }

  window.ClacketReaders = { readFile: readFile, readPptx: readPptx, toOutline: toOutline, tidy: tidy };
})();
