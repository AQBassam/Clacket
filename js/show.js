/* Clacket: the live miniature show at the top of the page.
   Built by the rules of the brief it advertises:
   - one paused GSAP master timeline; a beat is a stop;
   - only .to() and .set() on the master timeline, every start state set up front;
   - the point cloud is drawn from a plain state object the timeline tweens;
   - Arabic text is split by whole words, never by letters;
   - Back plays the last click in reverse, about twice as fast. */
(function () {
  'use strict';
  var stage = document.getElementById('stage');
  if (!stage || !window.gsap) { if (stage) stage.classList.add('no-show'); return; }
  var gsap = window.gsap;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D = reduce ? 0.01 : 1;                 /* duration scale */
  var $ = function (s) { return stage.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(stage.querySelectorAll(s)); };

  /* ---------- point cloud: shapes ---------- */
  var N = 1500;
  var seed = 20261113;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function jitter(a) { return (rnd() - 0.5) * a; }
  /* Each shape fills N points with [x, y] in a unit box (0..1, y down). */
  function fill(parts) {
    var total = parts.reduce(function (s, p) { return s + p.w; }, 0), pts = [];
    parts.forEach(function (p) {
      var n = Math.round(N * p.w / total);
      for (var i = 0; i < n; i++) pts.push(p.f(rnd(), rnd()));
    });
    while (pts.length < N) pts.push(parts[0].f(rnd(), rnd()));
    pts.length = N;
    return pts;
  }
  function seg(x1, y1, x2, y2, th) { return function (a) { return [x1 + (x2 - x1) * a + jitter(th), y1 + (y2 - y1) * a + jitter(th)]; }; }
  function rect(x, y, w, h) { return function (a, b) { return [x + w * a, y + h * b]; }; }
  function disc(cx, cy, r) { return function (a, b) { var t = a * 6.2832, q = r * Math.sqrt(b); return [cx + Math.cos(t) * q, cy + Math.sin(t) * q]; }; }
  function ring(cx, cy, r, th, from, to) { return function (a) { var t = from + (to - from) * a; return [cx + Math.cos(t) * r + jitter(th), cy + Math.sin(t) * r + jitter(th)]; }; }

  function clapper() {
    var parts = [{ w: 5, f: rect(0.14, 0.42, 0.72, 0.42) }];
    /* the arm: a slanted bar of alternating stripes, hinged on the left */
    for (var i = 0; i < 5; i++) {
      (function (i) {
        parts.push({ w: 0.75, f: function (a, b) {
          var u = (i * 2 + a) / 10, v = b;         /* along the arm, across it */
          var x = 0.14 + u * 0.74 + v * 0.03, y = 0.34 - u * 0.17 + v * 0.085;
          return [x, y];
        } });
      })(i);
    }
    parts.push({ w: 0.7, f: seg(0.14, 0.42, 0.86, 0.42, 0.008) });
    return fill(parts);
  }
  function spot() { return fill([{ w: 5, f: disc(0.5, 0.52, 0.2) }, { w: 3, f: ring(0.5, 0.52, 0.31, 0.012, 0, 6.2832) }, { w: 1.5, f: ring(0.5, 0.52, 0.4, 0.008, 0, 6.2832) }]); }
  function gates() {
    var parts = [];
    for (var i = 0; i < 4; i++) {
      var cx = 0.17 + i * 0.22, w = 0.075, top = 0.4 - i * 0.045;
      parts.push({ w: 1, f: seg(cx - w, 0.86, cx - w, top, 0.012) });
      parts.push({ w: 1, f: seg(cx + w, 0.86, cx + w, top, 0.012) });
      parts.push({ w: 1, f: ring(cx, top, w, 0.012, Math.PI, 2 * Math.PI) });
    }
    parts.push({ w: 1.5, f: seg(0.05, 0.87, 0.95, 0.87, 0.006) });
    return fill(parts);
  }
  function network() {
    var nodes = [[0.2, 0.3], [0.5, 0.18], [0.8, 0.32], [0.3, 0.6], [0.62, 0.5], [0.85, 0.68], [0.45, 0.84], [0.14, 0.82]];
    var edges = [[0, 1], [1, 2], [0, 3], [1, 4], [2, 4], [3, 4], [4, 5], [3, 6], [4, 6], [3, 7], [6, 5], [0, 4]];
    var parts = nodes.map(function (n, i) { return { w: 1, f: disc(n[0], n[1], i === 4 ? 0.06 : 0.038) }; });
    edges.forEach(function (e) { parts.push({ w: 0.42, f: seg(nodes[e[0]][0], nodes[e[0]][1], nodes[e[1]][0], nodes[e[1]][1], 0.005) }); });
    return fill(parts);
  }
  function book() {
    var parts = [];
    function page(sign) {
      return function (a, b) { var u = a, x = 0.5 + sign * u * 0.4; return [x, 0.3 + b * 0.46 - u * 0.07 + Math.sin(u * 3.1416) * -0.035]; };
    }
    parts.push({ w: 3, f: page(1) }, { w: 3, f: page(-1) });
    for (var k = 0; k < 4; k++) {
      (function (k) {
        [1, -1].forEach(function (s) {
          parts.push({ w: 0.45, f: function (a) { var u = 0.1 + a * 0.75; return [0.5 + s * u * 0.4 + jitter(0.004), 0.39 + k * 0.085 - u * 0.07 + jitter(0.006)]; } });
        });
      })(k);
    }
    parts.push({ w: 0.8, f: seg(0.5, 0.28, 0.5, 0.78, 0.008) });
    return fill(parts);
  }
  function arrow() {
    return fill([
      { w: 4, f: rect(0.12, 0.44, 0.48, 0.16) },
      { w: 4, f: function (a, b) { var u = Math.sqrt(a); return [0.9 - u * 0.32, 0.52 + (b - 0.5) * u * 0.52]; } }
    ]);
  }
  var SHAPES = [clapper(), spot(), gates(), network(), book(), arrow(), clapper()];
  /* Per-point timing, so dots leave at their own moment and swirl in flight. */
  var delay = [], swirl = [], size = [];
  for (var i = 0; i < N; i++) { delay.push(rnd() * 0.45); swirl.push((rnd() - 0.5) * 0.22); size.push(0.6 + rnd() * 0.9); }

  /* ---------- point cloud: drawing from state ---------- */
  var canvas = $('.cloud'), ctx = canvas.getContext('2d');
  var S = { shape: 0, alpha: 0, drift: 1 };   /* the only thing the timeline animates here */
  var W = 0, H = 0, dpr = 1, clock = 0, last = 0, visible = true, lastKey = '';
  function resize() {
    var r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    canvas.width = W; canvas.height = H; lastKey = '';
  }
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  function draw() {
    var i0 = Math.max(0, Math.min(SHAPES.length - 1, Math.floor(S.shape)));
    var i1 = Math.min(SHAPES.length - 1, i0 + 1), t = S.shape - i0;
    var A = SHAPES[i0], B = SHAPES[i1];
    /* the cloud lives in the visual column: the left 46% of the stage */
    var narrow = W / dpr < 640;
    var bw = W * (narrow ? 0.4 : 0.46), bh = narrow ? bw * 1.05 : H * 0.92, ox = W * 0.02, oy = (H - bh) / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, Math.min(1, S.alpha));
    var base = Math.max(1, W / 620);
    for (var i = 0; i < N; i++) {
      var k = ease((t - delay[i]) / 0.55);
      var x = A[i][0] + (B[i][0] - A[i][0]) * k, y = A[i][1] + (B[i][1] - A[i][1]) * k;
      var arc = Math.sin(k * 3.1416) * swirl[i];
      x += arc; y -= arc * 0.6;
      var ph = clock * 0.0006 + i;
      x += Math.sin(ph) * 0.004 * S.drift; y += Math.cos(ph * 1.3) * 0.004 * S.drift;
      ctx.fillStyle = (i % 9 === 0) ? '#eea17d' : (i % 4 === 0) ? '#f0cf76' : '#e9f1ec';
      var s = base * size[i];
      ctx.fillRect(ox + x * bw, oy + y * bh, s, s);
    }
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; return; }
    if (!reduce) clock += Math.min(50, now - last);
    last = now;
    setCount();
    draw();
  }

  /* ---------- text: whole words only ---------- */
  function splitWords(el) {
    var out = [];
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach(function (piece) {
          if (!piece) return;
          if (/^\s+$/.test(piece)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w'; w.textContent = piece;
          frag.appendChild(w); out.push(w);
        });
        el.replaceChild(frag, node);
      } else if (node.nodeType === 1) { node.classList.add('w'); out.push(node); }
    });
    return out;
  }

  /* ---------- the show ---------- */
  var tl = gsap.timeline({ paused: true });
  var beats = [];                             /* { name, time, page, click, clicks } */
  var scenes = $$('.scene');
  var counter = $('.count'), CN = { v: 0 };
  function setCount() { counter.textContent = String(Math.round(CN.v)); }

  /* every start state, up front */
  scenes.forEach(function (sc) { gsap.set(sc, { autoAlpha: 0 }); });
  var parts = {};
  $$('[data-in]').forEach(function (el) {
    var words = el.hasAttribute('data-words') ? splitWords(el) : [el];
    parts[el.getAttribute('data-in')] = (parts[el.getAttribute('data-in')] || []).concat(words);
    gsap.set(words, { autoAlpha: 0, x: '0.5em' });       /* enters from the right */
  });
  setCount();

  function beat(name, page, click, clicks) { beats.push({ name: name, time: tl.duration(), page: page, click: click, clicks: clicks }); }
  function sceneIn(n, at) { tl.set(scenes[n], { autoAlpha: 1 }, at); }
  function sceneOut(n) { tl.to(scenes[n], { autoAlpha: 0, duration: 0.35 * D, ease: 'power1.in' }); }
  function bring(key, at, stagger) { tl.to(parts[key], { autoAlpha: 1, x: 0, duration: 0.5 * D, ease: 'power2.out', stagger: (stagger == null ? 0.07 : stagger) * D }, at); }
  function morph(to, at, dur) { tl.to(S, { shape: to, duration: (dur || 1.5) * D, ease: 'none' }, at); }

  /* page 0: the start screen */
  sceneIn(0, 0);
  tl.to(S, { alpha: 1, duration: 0.9 * D, ease: 'power1.out' }, 0);
  bring('start-title', 0.15 * D); bring('start-line', '>-0.25'); bring('start-hint', '>-0.1');
  beat('start', 0, 0, 1);

  /* page 1: one idea per click (two clicks, same picture) */
  sceneOut(0); tl.addLabel('p1'); sceneIn(1, 'p1'); morph(1, 'p1');
  bring('idea-kicker', 'p1+=' + 0.3 * D); bring('idea-title', '>-0.2');
  beat('one-idea', 1, 0, 2);
  bring('idea-notes', '>');
  beat('one-idea-notes', 1, 1, 2);

  /* page 2: a number that counts */
  sceneOut(1); tl.addLabel('p2'); sceneIn(2, 'p2'); morph(2, 'p2');
  bring('gates-num', 'p2+=' + 0.3 * D, 0);
  tl.to(CN, { v: 4, duration: 1.1 * D, ease: 'power1.out', onUpdate: setCount }, '<');
  bring('gates-label', '>-0.5');
  beat('four-gates', 2, 0, 1);

  /* page 3: the living background (two clicks, the shape changes) */
  sceneOut(2); tl.addLabel('p3'); sceneIn(3, 'p3'); morph(3, 'p3');
  bring('live-title', 'p3+=' + 0.3 * D);
  beat('living-network', 3, 0, 2);
  tl.addLabel('p3b'); morph(4, 'p3b', 1.3); bring('live-line', 'p3b+=' + 0.5 * D);
  beat('living-book', 3, 1, 2);

  /* page 4: you drive */
  sceneOut(3); tl.addLabel('p4'); sceneIn(4, 'p4'); morph(5, 'p4');
  bring('drive-title', 'p4+=' + 0.3 * D); bring('drive-keys', '>-0.1', 0.12);
  beat('you-drive', 4, 0, 1);

  /* page 5: your turn */
  sceneOut(4); tl.addLabel('p5'); sceneIn(5, 'p5'); morph(6, 'p5');
  bring('yours-title', 'p5+=' + 0.3 * D); bring('yours-line', '>-0.2');
  beat('your-turn', 5, 0, 1);

  /* names must be unique: the brief stops the show otherwise, and so does this */
  var seen = {};
  beats.forEach(function (b) { if (seen[b.name]) throw new Error('duplicate beat: ' + b.name); seen[b.name] = 1; });

  /* ---------- navigation ---------- */
  var cur = 0, mover = null, black = false;
  var pageNo = $('.pageno b'), dots = $('.pageno i'), line = $('.progress i'), cover = $('.cover');
  var live = document.getElementById('stage-live');
  function hud() {
    var b = beats[cur];
    pageNo.textContent = b.page ? String(b.page) : '';
    dots.textContent = '';
    for (var i = 0; i < b.clicks && b.page; i++) { var d = document.createElement('u'); if (i === b.click) d.className = 'on'; dots.appendChild(d); }
    line.style.transform = 'scaleX(' + (cur / (beats.length - 1)) + ')';
    stage.setAttribute('data-beat', b.name);
    var sc = scenes[b.page];
    if (live && sc) live.textContent = sc.getAttribute('data-say') || '';
    stage.classList.toggle('at-end', cur === beats.length - 1);
  }
  function settle() { if (mover) { mover.kill(); mover = null; tl.time(beats[cur].time); } }
  function go(i, instant) {
    i = Math.max(0, Math.min(beats.length - 1, i));
    settle();
    if (i === cur) return;
    var from = beats[cur].time, to = beats[i].time, far = Math.abs(i - cur) > 1;
    var back = i < cur;
    cur = i; hud();
    if (instant || far || reduce) { tl.time(to); return; }
    mover = gsap.to(tl, { time: to, duration: Math.abs(to - from) / (back ? 2 : 1), ease: 'none', onComplete: function () { mover = null; } });
  }
  function next() { if (unblack()) return; if (cur === beats.length - 1) { toMaker(); return; } go(cur + 1); }
  function prev() { if (unblack()) return; go(cur - 1); }
  function unblack() { if (!black) return false; black = false; cover.classList.remove('on'); return true; }
  function toggleBlack() { black = !black; cover.classList.toggle('on', black); }
  function toMaker() { var m = document.getElementById('maker'); if (m) m.scrollIntoView(); }
  function toggleFull() {
    var el = document.fullscreenElement;
    try { if (el) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen().catch(function () {}); } catch (e) {}
  }

  stage.addEventListener('click', function (e) {
    if (e.target.closest('a,button')) return;
    stage.focus({ preventScroll: true }); next();
  });
  stage.addEventListener('contextmenu', function (e) { e.preventDefault(); prev(); });
  stage.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    var k = e.key, c = e.code, done = true;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter' || c === 'KeyN') next();
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') prev();
    else if (k === 'Home') go(0, true);
    else if (k === 'End') go(beats.length - 1, true);
    else if (c === 'KeyB' || k === '.') toggleBlack();     /* by physical key: an Arabic layout types other letters */
    else if (c === 'KeyF') toggleFull();
    else done = false;
    if (done) e.preventDefault();
  });
  var bNext = document.getElementById('show-next'), bPrev = document.getElementById('show-prev'), bFull = document.getElementById('show-full');
  if (bNext) bNext.addEventListener('click', next);
  if (bPrev) bPrev.addEventListener('click', prev);
  if (bFull) { if (!stage.requestFullscreen) bFull.hidden = true; bFull.addEventListener('click', toggleFull); }

  /* ---------- start ---------- */
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  if (window.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(stage);
  stage.classList.add('ready');
  hud();
  requestAnimationFrame(function (now) { last = now; frame(now); });
  /* the one unprompted moment: the start screen assembles itself */
  var ready = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
  ready.then(function () {
    if (reduce) { tl.time(beats[0].time); return; }
    mover = gsap.to(tl, { time: beats[0].time, duration: beats[0].time, ease: 'none', onComplete: function () { mover = null; } });
  });

  window.ClacketShow = { beats: beats, go: go, next: next, prev: prev, timeline: tl, state: S, busy: function () { return !!mover; } };
})();
