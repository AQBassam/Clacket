/* Clacket: the page as one film.
   Built by the rules of the brief it advertises:
   - one paused GSAP master timeline for the whole page; a beat is a stop;
   - only .to() and .set() on it, every start state set up front;
   - the point cloud is drawn from a plain state object S that the timeline tweens;
   - Arabic text is split by whole words, never by letters;
   - Back plays the last click in reverse, about twice as fast;
   - each click owns its content: it is placed at or after the previous beat.
   The page scrolls. Each section is a scene: scrolling down to one plays all its
   clicks; a click, an arrow key or a clicker steps through them one at a time,
   and at the end of a scene moves on to the next. The generator is not a scene. */
(function () {
  'use strict';
  var stage = document.getElementById('stage');
  if (!stage || !window.gsap) { document.documentElement.classList.add('no-film'); return; }
  var gsap = window.gsap;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D = reduce ? 0.01 : 1;                 /* duration scale */
  var body = document.body;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

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
    for (var i = 0; i < 5; i++) {
      (function (i) {
        parts.push({ w: 0.75, f: function (a, b) {
          var u = (i * 2 + a) / 10, v = b;
          return [0.14 + u * 0.74 + v * 0.03, 0.34 - u * 0.17 + v * 0.085];
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
    function page(sign) { return function (a, b) { var u = a; return [0.5 + sign * u * 0.4, 0.3 + b * 0.46 - u * 0.07 + Math.sin(u * 3.1416) * -0.035]; }; }
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
  function clicker() {
    var bodyF = function (a, b) {
      var x = 0.38 + a * 0.24, y = 0.36 + b * 0.52;
      var dx = Math.max(0.46 - x, x - 0.54, 0), dyTop = Math.max(0.44 - y, 0), dyBot = Math.max(y - 0.80, 0);
      var d = Math.sqrt(dx * dx + (dyTop + dyBot) * (dyTop + dyBot));
      return d > 0.08 ? [0.5 + (x - 0.5) * 0.6, y] : [x, y];
    };
    return fill([
      { w: 5, f: bodyF },
      { w: 1.1, f: ring(0.5, 0.5, 0.055, 0.006, 0, 6.2832) },
      { w: 0.9, f: ring(0.5, 0.66, 0.04, 0.006, 0, 6.2832) },
      { w: 0.5, f: seg(0.5, 0.33, 0.5, 0.2, 0.004) },
      { w: 0.5, f: ring(0.5, 0.34, 0.13, 0.006, 3.6, 5.82) },
      { w: 0.6, f: ring(0.5, 0.34, 0.21, 0.006, 3.6, 5.82) }
    ]);
  }
  /* 0 clapper, 1 spot, 2 gates, 3 network, 4 book, 5 clicker, 6 clapper, 7 gates */
  var SHAPES = [clapper(), spot(), gates(), network(), book(), clicker(), clapper(), gates()];
  var GATES = { 2: 1, 7: 1 };
  /* which gate a point belongs to, counted from the right (the first gate is on the right) */
  var gateOf = SHAPES.map(function (sh, k) {
    if (!GATES[k]) return null;
    return sh.map(function (p) { return p[1] > 0.862 ? -1 : 3 - Math.max(0, Math.min(3, Math.round((p[0] - 0.17) / 0.22))); });
  });
  var delay = [], swirl = [], size = [];
  for (var i = 0; i < N; i++) { delay.push(rnd() * 0.45); swirl.push((rnd() - 0.5) * 0.22); size.push(0.6 + rnd() * 0.9); }

  /* ---------- point cloud: drawing from state ---------- */
  var canvas = $('.bg .cloud'), ctx = canvas.getContext('2d');
  var S = { shape: 0, alpha: 0, drift: 1, lit: 0 };   /* the only thing the timeline animates here */
  var W = 0, H = 0, dpr = 1, clock = 0, last = 0, quiet = false, blank = false;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(window.innerWidth * dpr)); H = Math.max(1, Math.round(window.innerHeight * dpr));
    canvas.width = W; canvas.height = H; blank = false;
  }
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  var INK = ['#e9f1ec', '#f0cf76', '#eea17d'];
  function draw() {
    var a = Math.max(0, Math.min(1, S.alpha));
    if (a < 0.005) { if (!blank) { ctx.clearRect(0, 0, W, H); blank = true; } return; }
    blank = false;
    var i0 = Math.max(0, Math.min(SHAPES.length - 1, Math.floor(S.shape)));
    var i1 = Math.min(SHAPES.length - 1, i0 + 1), t = S.shape - i0;
    var A = SHAPES[i0], B = SHAPES[i1];
    var G = t < 0.5 ? gateOf[i0] : gateOf[i1];
    /* the cloud lives in the visual column: the left of a wide screen, the top of a phone */
    var narrow = W / dpr < 700, bw, bh, ox, oy;
    if (narrow) { bw = W * 0.86; bh = Math.min(bw * 0.95, H * 0.42); ox = W * 0.07; oy = H * 0.1; }
    else { bw = W * 0.42; bh = Math.min(H * 0.78, bw * 1.1); ox = W * 0.04; oy = (H - bh) / 2; }
    ctx.clearRect(0, 0, W, H);
    var base = Math.max(1, Math.min(W, H * 1.6) / 620);
    for (var pass = 0; pass < 3; pass++) {
      ctx.fillStyle = INK[pass];
      for (var i = 0; i < N; i++) {
        var ink;
        if (G) { var g = G[i]; ink = g >= 0 && g < S.lit - 0.001 ? 1 : 0; ctx.globalAlpha = a * (ink || g < 0 ? 1 : 0.5); }
        else { ink = (i % 9 === 0) ? 2 : (i % 4 === 0) ? 1 : 0; ctx.globalAlpha = a; }
        if (ink !== pass) continue;
        var k = ease((t - delay[i]) / 0.55);
        var x = A[i][0] + (B[i][0] - A[i][0]) * k, y = A[i][1] + (B[i][1] - A[i][1]) * k;
        var arc = Math.sin(k * 3.1416) * swirl[i];
        x += arc; y -= arc * 0.6;
        var ph = clock * 0.0006 + i;
        x += Math.sin(ph) * 0.004 * S.drift; y += Math.cos(ph * 1.3) * 0.004 * S.drift;
        var s = base * size[i];
        ctx.fillRect(ox + x * bw, oy + y * bh, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (quiet || document.hidden) { last = now; return; }
    if (!reduce) clock += Math.min(50, now - last);
    last = now;
    setCount();
    draw();
  }

  /* ---------- pictures: loaded when their scene is near ---------- */
  var pics = {};
  $$('.bg .pic').forEach(function (img) { pics[img.getAttribute('data-pic')] = img; });
  function wantPic(name) {
    var img = pics[name];
    if (!img || img.getAttribute('srcset')) return;
    img.setAttribute('sizes', '100vw');
    img.setAttribute('srcset', 'assets/img/' + name + '-960.webp 960w, assets/img/' + name + '-1600.webp 1600w');
    img.setAttribute('src', 'assets/img/' + name + '-960.webp');
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

  /* ---------- the film ---------- */
  var tl = gsap.timeline({ paused: true });
  var beats = [];                             /* { name, time, page, click, clicks, sec } */
  var secs = [stage].concat($$('.take'));
  var scenes = $$('.scene', stage);
  var counter = $('.count', stage), CN = { v: 0 };
  function setCount() { counter.textContent = String(Math.round(CN.v)); }

  /* every start state, up front */
  scenes.forEach(function (sc) { gsap.set(sc, { autoAlpha: 0 }); });
  gsap.set(Object.keys(pics).map(function (k) { return pics[k]; }), { opacity: 0, scale: 1.12, xPercent: 0 });
  var parts = {};
  $$('[data-in]', stage).forEach(function (el) {
    var words = el.hasAttribute('data-words') ? splitWords(el) : [el];
    parts[el.getAttribute('data-in')] = (parts[el.getAttribute('data-in')] || []).concat(words);
    gsap.set(words, { autoAlpha: 0, x: '0.5em' });       /* enters from the right */
  });
  /* In the guide, text keeps its place in the page for screen readers: only opacity moves. */
  secs.slice(1).forEach(function (sec) {
    $$('[data-click]', sec).forEach(function (el) {
      var key = sec.id + '-' + el.getAttribute('data-click');
      var words = el.hasAttribute('data-words') ? splitWords(el) : [el];
      parts[key] = (parts[key] || []).concat(words);
      gsap.set(words, { opacity: 0, x: '0.5em' });
    });
  });
  setCount();

  /* A beat is the END of everything added so far. Whatever a later click shows
     must be placed at or after that time. Placing it with '>' (the end of the
     most recently added tween) is a trap: that tween can end before a longer
     one, and the later click's content then leaks into the earlier picture. */
  var owner = {};                             /* part key -> index of the beat that first shows it */
  var secNo = 0;
  function beat(name, page, click, clicks) { tl.addLabel('beat-' + name, tl.duration()); beats.push({ name: name, time: tl.duration(), page: page, click: click, clicks: clicks, sec: secNo }); }
  function afterBeat() { return tl.duration(); }
  function sceneIn(n, at) { tl.set(scenes[n], { autoAlpha: 1 }, at); }
  function sceneOut(n) { tl.to(scenes[n], { autoAlpha: 0, duration: 0.35 * D, ease: 'power1.in' }, afterBeat()); }
  function bring(key, at, stagger) { owner[key] = beats.length; tl.to(parts[key], { autoAlpha: 1, x: 0, duration: 0.5 * D, ease: 'power2.out', stagger: (stagger == null ? 0.07 : stagger) * D }, at); }
  function show(key, at) { owner[key] = beats.length; tl.to(parts[key], { opacity: 1, x: 0, duration: 0.55 * D, ease: 'power2.out', stagger: 0.06 * D }, at); }
  function morph(to, at, dur) { tl.to(S, { shape: to, duration: (dur || 1.5) * D, ease: 'none' }, at); }
  function dots(alpha, at) { tl.to(S, { alpha: alpha, duration: 0.8 * D, ease: 'power1.inOut' }, at); }
  /* A picture is a shot: it fades in over the last one, and the camera moves slowly. */
  var onScreen = null;
  function shot(name, at, o, s, x) {
    if (onScreen && onScreen !== name) tl.to(pics[onScreen], { opacity: 0, duration: 1.1 * D, ease: 'power1.inOut' }, at);
    tl.to(pics[name], { opacity: o, duration: 1.1 * D, ease: 'power1.inOut' }, at);
    tl.to(pics[name], { scale: s, xPercent: x, duration: 2.2 * D, ease: 'sine.out' }, at);
    onScreen = name;
  }

  /* page 0: the start screen */
  sceneIn(0, 0);
  shot('hall', 0, 0.32, 1.05, 0);
  dots(1, 0);
  bring('start-title', 0.15 * D); bring('start-line', '>-' + 0.25 * D); bring('start-hint', '>-' + 0.1 * D);
  beat('start', 0, 0, 1);

  /* page 1: one idea per click (two clicks, same picture) */
  sceneOut(0); tl.addLabel('p1'); sceneIn(1, 'p1'); morph(1, 'p1'); shot('stage', 'p1', 0.55, 1.05, -1);
  bring('idea-kicker', 'p1+=' + 0.3 * D); bring('idea-title', '>-' + 0.2 * D);
  beat('one-idea', 1, 0, 2);
  bring('idea-notes', afterBeat());
  beat('one-idea-notes', 1, 1, 2);

  /* page 2: a number that counts, and four gates that light from the right */
  sceneOut(1); tl.addLabel('p2'); sceneIn(2, 'p2'); morph(2, 'p2'); shot('stage-dim', 'p2', 0.4, 1.08, 1);
  bring('gates-num', 'p2+=' + 0.3 * D, 0);
  tl.to(CN, { v: 4, duration: 1.1 * D, ease: 'power1.out', onUpdate: setCount }, '<');
  tl.to(S, { lit: 4, duration: 1.1 * D, ease: 'power1.out' }, '<');
  bring('gates-label', '>-' + 0.5 * D);
  beat('four-gates', 2, 0, 1);

  /* page 3: the living background (two clicks, the shape changes) */
  sceneOut(2); tl.addLabel('p3'); sceneIn(3, 'p3'); morph(3, 'p3'); shot('dust', 'p3', 0.65, 1.06, 0);
  bring('live-title', 'p3+=' + 0.3 * D);
  beat('living-network', 3, 0, 2);
  tl.addLabel('p3b', afterBeat()); morph(4, 'p3b', 1.3); tl.to(pics.dust, { scale: 1.1, xPercent: -1.5, duration: 2.2 * D, ease: 'sine.out' }, 'p3b');
  bring('live-line', 'p3b+=' + 0.5 * D);
  beat('living-book', 3, 1, 2);

  /* page 4: you drive. The picture carries this page; the dots step back. */
  sceneOut(3); tl.addLabel('p4'); sceneIn(4, 'p4'); morph(5, 'p4'); dots(0, 'p4'); shot('clicker', 'p4', 0.95, 1.05, 1);
  bring('drive-title', 'p4+=' + 0.3 * D); bring('drive-keys', '>-' + 0.1 * D, 0.12);
  beat('you-drive', 4, 0, 1);

  /* page 5: your turn */
  sceneOut(4); tl.addLabel('p5'); sceneIn(5, 'p5'); morph(6, 'p5'); dots(1, 'p5'); shot('seats', 'p5', 0.5, 1.06, 0);
  bring('yours-title', 'p5+=' + 0.3 * D); bring('yours-line', '>-' + 0.2 * D);
  beat('your-turn', 5, 0, 1);

  /* the scenes below the show: one per section, built from their markup */
  var page = 5;
  secs.slice(1).forEach(function (sec) {
    secNo++; page++;
    var cam = (sec.getAttribute('data-cam') || '1.05,0').split(',').map(Number);
    var gatesDots = sec.getAttribute('data-dots') === 'gates';
    var n = 1 + $$('[data-click]', sec).reduce(function (m, el) { return Math.max(m, Number(el.getAttribute('data-click'))); }, 0);
    var at = afterBeat();
    shot(sec.getAttribute('data-pic'), at, gatesDots ? 0.4 : 0.9, cam[0], cam[1]);
    if (gatesDots) { morph(7, at); tl.to(S, { lit: 0, duration: 0.3 * D }, at); dots(1, at); }
    else dots(0, at);
    show(sec.id + '-0', at + 0.3 * D);
    beat(sec.id, page, 0, n);
    for (var c = 1; c < n; c++) {
      var t = afterBeat(), el = $('[data-click="' + c + '"]', sec);
      show(sec.id + '-' + c, t);
      if (el && el.hasAttribute('data-lit')) tl.to(S, { lit: Number(el.getAttribute('data-lit')), duration: 0.6 * D, ease: 'power1.out' }, t);
      beat(sec.id + '-' + c, page, c, n);
    }
  });

  /* names must be unique: the brief stops the show otherwise, and so does this */
  var seen = {};
  beats.forEach(function (b) { if (seen[b.name]) throw new Error('duplicate beat: ' + b.name); seen[b.name] = 1; });
  function firstOf(s) { for (var i = 0; i < beats.length; i++) if (beats[i].sec === s) return i; return 0; }
  function lastOf(s) { for (var i = beats.length - 1; i >= 0; i--) if (beats[i].sec === s) return i; return 0; }

  /* ---------- navigation ---------- */
  var cur = 0, mover = null, black = false, expect = -1;
  var pageNo = $('.hud .pageno b'), clickDots = $('.hud .pageno i'), line = $('.hud .progress i'), cover = $('.cover');
  var live = document.getElementById('stage-live');
  function hud() {
    var b = beats[cur];
    pageNo.textContent = b.page ? String(b.page) : '';
    clickDots.textContent = '';
    for (var i = 0; i < b.clicks && b.page && b.clicks > 1; i++) { var d = document.createElement('u'); if (i === b.click) d.className = 'on'; clickDots.appendChild(d); }
    line.style.transform = 'scaleX(' + (cur / (beats.length - 1)) + ')';
    stage.setAttribute('data-beat', b.name);
    body.setAttribute('data-beat', b.name);
    if (live) live.textContent = b.sec === 0 && scenes[b.page] ? (scenes[b.page].getAttribute('data-say') || '') : '';
  }
  function picsFor(s) {
    var names = s === 0 ? ['hall', 'stage', 'stage-dim', 'dust', 'clicker', 'seats'] : [secs[s].getAttribute('data-pic')];
    names.forEach(wantPic);
  }
  function settle() { if (mover) { mover.kill(); mover = null; tl.time(beats[cur].time); } }
  function play(to, speed) {
    var from = tl.time();
    if (reduce || from === to) { tl.time(to); return; }
    mover = gsap.to(tl, { time: to, duration: Math.abs(to - from) / speed, ease: 'none', onComplete: function () { mover = null; } });
  }
  /* Where the page should stand for beat i: its scene at the top, unless what that
     click shows would end up under the buttons at the bottom of the screen. */
  var BOTTOM = 104, TOP = 62;
  function aim(i) {
    var b = beats[i], y = window.pageYOffset, top = secs[b.sec].getBoundingClientRect().top + y - TOP, low = 0;
    if (b.sec === 0) return top;
    Object.keys(owner).forEach(function (k) {
      if (owner[k] === i) parts[k].forEach(function (e) { low = Math.max(low, e.getBoundingClientRect().bottom + y); });
    });
    return Math.max(top, low - (window.innerHeight - BOTTOM));
  }
  /* While the film scrolls the page itself, the scenes it passes do not play.
     The scroll is over when no scroll event has come for a moment (4 s at most). */
  var scrolling = 0, endTimer = 0;
  function scrollEnded() { scrolling = 0; expect = -1; }
  window.addEventListener('scroll', function () {
    if (!scrolling) return;
    clearTimeout(endTimer); endTimer = setTimeout(scrollEnded, 160);
  }, { passive: true });
  function scrollTo(y) {
    y = Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight));
    if (!scrolling && Math.abs(y - window.pageYOffset) < 2) return false;   /* already there, and nothing else in flight */
    scrolling = Date.now() + 4000;
    clearTimeout(endTimer); endTimer = setTimeout(scrollEnded, 400);
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    return true;
  }
  function bringIntoView(i) {
    expect = beats[i].sec;
    if (!scrollTo(aim(i))) expect = -1;
  }
  function keepInView(i) {
    var want = aim(i), y = window.pageYOffset;
    if (want > y + 1) scrollTo(want);
  }
  function go(i, instant) {
    i = Math.max(0, Math.min(beats.length - 1, i));
    settle();
    if (i === cur) return;
    var far = Math.abs(i - cur) > 1, back = i < cur, from = beats[cur].sec;
    cur = i; hud(); picsFor(beats[i].sec);
    if (beats[i].sec !== from) bringIntoView(i); else if (!back) keepInView(i);
    if (instant || far) { tl.time(beats[i].time); return; }
    play(beats[i].time, back ? 2 : 1);
  }
  function next() {
    if (unblack()) return;
    var b = beats[cur];
    if (cur === lastOf(b.sec) && secs[b.sec].getAttribute('data-then')) {
      var m = document.getElementById(secs[b.sec].getAttribute('data-then'));
      if (m) { m.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); return; }
    }
    go(cur + 1);
  }
  function prev() { if (unblack()) return; go(cur - 1); }
  function unblack() { if (!black) return false; black = false; cover.classList.remove('on'); return true; }
  function toggleBlack() { black = !black; cover.classList.toggle('on', black); }
  function toggleFull() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(function () {}); } catch (e) {}
  }

  /* A scene that scrolls into the middle of the screen plays. Coming from above
     it plays all its clicks; coming back from below it shows its last picture. */
  function arrive(s) {
    quiet = s < 0;
    body.classList.toggle('quiet', quiet);
    if (s < 0) return;
    if (expect >= 0) { if (s !== expect && Date.now() < scrolling) return; expect = -1; }
    var cs = beats[cur].sec;
    if (s === cs) return;
    settle(); picsFor(s);
    if (s === 0) { cur = 0; hud(); tl.time(beats[0].time); return; }
    if (s > cs) {
      tl.time(beats[lastOf(s - 1)].time);
      cur = lastOf(s); hud();
      play(beats[cur].time, 1);
    } else {
      var adjacent = cs === s + 1 && cur === firstOf(cs);
      cur = lastOf(s); hud();
      if (adjacent) play(beats[cur].time, 2); else tl.time(beats[cur].time);
    }
  }
  var watched = secs.concat($$('[data-quiet]'));
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (!e.isIntersecting) return;
        var s = secs.indexOf(e.target);
        arrive(s);
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    watched.forEach(function (el) { io.observe(el); });
    /* pictures load half a screen ahead of their scene */
    var near = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { var s = secs.indexOf(e.target); if (s > 0) picsFor(s); } });
    }, { rootMargin: '50% 0px 50% 0px' });
    secs.slice(1).forEach(function (el) { near.observe(el); });
  }

  /* keys: wherever a scene is on screen, but never while typing in the generator */
  function typing(t) { return t && t.closest && t.closest('input, textarea, select, [contenteditable], #maker'); }
  function activating(t, k) { return (k === 'Enter' || k === ' ') && t && t.closest && t.closest('a, button, summary'); }
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey || quiet || typing(e.target)) return;
    var k = e.key, c = e.code, done = true;
    if (activating(e.target, k)) return;
    if (e.repeat && k !== 'ArrowRight' && k !== 'ArrowLeft') return;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter' || c === 'KeyN') next();
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') prev();
    else if (c === 'KeyB' || k === '.') toggleBlack();     /* by physical key: an Arabic layout types other letters */
    else if (c === 'KeyF') toggleFull();
    else done = false;
    if (done) e.preventDefault();
  });
  function inScene(t) {
    if (!t.closest || t.closest('a, button, summary, details, input, label')) return null;
    var sec = t.closest('.reel, .take');
    return sec && secs.indexOf(sec) === beats[cur].sec ? sec : null;
  }
  document.getElementById('film').addEventListener('click', function (e) {
    if (!inScene(e.target) || String(window.getSelection ? window.getSelection() : '')) return;
    next();
  });
  document.getElementById('film').addEventListener('contextmenu', function (e) { if (inScene(e.target)) { e.preventDefault(); prev(); } });
  /* a link reached with Tab inside a scene that has not played yet: show the scene */
  document.addEventListener('focusin', function (e) {
    var sec = e.target.closest && e.target.closest('.take');
    if (sec && secs.indexOf(sec) > beats[cur].sec) { settle(); var s = secs.indexOf(sec); cur = lastOf(s); hud(); tl.time(beats[cur].time); picsFor(s); }
  });
  var bNext = document.getElementById('show-next'), bPrev = document.getElementById('show-prev'), bFull = document.getElementById('show-full');
  if (bNext) bNext.addEventListener('click', next);
  if (bPrev) bPrev.addEventListener('click', prev);
  if (bFull) { if (!document.documentElement.requestFullscreen) bFull.hidden = true; bFull.addEventListener('click', toggleFull); }

  /* ---------- start ---------- */
  resize();
  window.addEventListener('resize', resize);
  body.classList.add('film-ready');
  hud();
  requestAnimationFrame(function (now) { last = now; frame(now); });
  window.addEventListener('load', function () { picsFor(0); });
  /* the one unprompted moment: the start screen assembles itself */
  var ready = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
  ready.then(function () {
    if (cur !== 0 || mover) return;
    if (reduce) { tl.time(beats[0].time); return; }
    mover = gsap.to(tl, { time: beats[0].time, duration: beats[0].time, ease: 'none', onComplete: function () { mover = null; } });
  });

  window.ClacketShow = { owner: owner, parts: parts, beats: beats, go: go, next: next, prev: prev, timeline: tl, state: S,
    cur: function () { return cur; }, busy: function () { return !!mover || Date.now() < scrolling; } };
})();
