/* Clacket: the brief template.
   This file is the single source of the prompt text. The page builds the
   "About my talk" block from the form, then appends BODY unchanged.
   To update the prompt: edit BODY, raise VERSION, add a line to docs/BRIEF-CHANGELOG.md. */
window.CLACKET_BRIEF = {
  VERSION: '2.2',
  DATE: '2026-11-13',
  TITLE: '# Build me a cinematic, clicker-driven web presentation',
  BODY: String.raw`## 1. What I want
A presentation that is a web page, driven by a presentation clicker exactly like
PowerPoint, that feels like a film instead of slides: one continuous world where
things move, change and arrive on each click, with very little text on screen.
Alongside the show I want a full set of presenting tools, a way to export it,
and a fallback that works on any computer.

## 2. How to read this brief
- Outcomes are fixed. Techniques are defaults. Where I name a technique, you may
  propose a better one, but tell me before you switch.
- This brief was written at one point in time. Browsers, libraries and tools
  change. Trust what you verify by test today over what this brief assumes. When
  they differ, tell me, and record it in docs/decisions.md. You may run checks
  and throwaway test pages at any time, including before the first gate.
- Do not rely on your memory of any library's API. Read the copy you downloaded.
- Where this brief leaves something open, choose, and record the choice in
  docs/decisions.md. Ask me only when a wrong guess would cost a rebuild.
- I may not be technical. When you need something from me, say exactly what to
  click or type, one step at a time.
- When two goals conflict, this order wins:
  1. The show never fails in front of an audience.
  2. Back and jump always show the correct picture.
  3. Text is readable from the back row.
  4. Motion is smooth.
  5. Visual ambition.

## 3. How we work: four phases, each with a gate
Do not start a phase until I have accepted the one before it. At each gate, give
me a short list of things to try myself and tell me what you tested and what you
could not. Section 13 applies at every gate, to whatever exists by then.
tools/check, README.md, AGENTS.md and docs/ start in Phase 1 and grow with each
phase.

Phase 0, plan. Explain in plain language how you will build it. Propose three
art directions, each with a name, a palette, a type pairing, one motion
principle and a background idea, and say which one you would pick for my
audience and room. If I gave you slides or an outline, also propose how you
would split them into pages and clicks. Ask me whatever you need. Then stop and
wait. If I answer without choosing, use the one you recommended.

Phase 1, engine and controls. The stage, the timeline engine, navigation, every
key in section 6, the key tester, help, the URL hash, tools/check, and one page
clearly labelled "Test" with three clicks. The overview and presenter keys open
plain first versions (beat names, no snapshots, no live copy); they are finished
in Phase 3. No visual polish yet.
Gate: I drive the Test page with my real clicker, forward, back and jump, and
every button does what the key tester says. I also press Esc in full screen and
tell you what happened.

Phase 2, look. The background, type, colour, the quality ladder and bench in
section 8, and my first real slide (or a second Test page if I have sent none).
Once a real slide exists, the Test page leaves the show and stays reachable
with index.html?testpage, so the control checks keep running.
Gate: I see the chosen art direction on my screen and run ?bench myself. Frame
times from your own machine are a sanity check only; mine decide.

Phase 3, presenting tools and outputs. Everything in sections 9 and 10.
Gate: I rehearse with the presenter view on a second screen, export the PDF, and
open the fallback on a different browser.

Phase 4, slides. Add slides as I send material. Build only the slides I ask for.
No title, agenda, filler or thank-you slides of your own; suggest them in chat.
The start screen (page 0) shows my talk title and nothing else. When I send a
screenshot and say something looks bad, rebuild that part properly. Do not
nudge it.

## 4. Hard rules
- The show runs offline by double-clicking index.html (a file:// page) in a
  current Chromium browser (Chrome or Edge). No server, no build step, no
  frameworks, no CDN links, no network requests at show time.
- A file:// page blocks many things: ES modules, fetch and XHR of local files,
  and WebGL textures loaded from image files. Use classic script tags, and keep
  data in .js files that assign to a global. Test any other API on file://
  before you depend on it.
- One animation library only: GSAP 3, core only, downloaded once into vendor/.
  Record its exact version, download date and licence in vendor/VERSIONS.md.
  Never update it unless I ask. Fonts go in assets/fonts/ as .woff2 with their
  licence files; take them from any source that carries the open licence and
  record where. Nothing downloaded is needed at show time except those files.
  Everything else is hand-written HTML, CSS and JavaScript.
- Never invent facts or numbers. Use what I give you, or research and cite: a
  small source line on the slide, details in docs/sources.md, caveats in the
  speaker notes. Label illustrative charts "illustrative" and placeholder
  numbers "demo data", in the slide's language. A statement that is plainly my
  own opinion needs no source; a number always does.
- One idea per click. A short kicker, a headline, big numbers. What I will say
  goes in the speaker notes, not on screen.
- For slide content at rest on the 1920x1080 stage: no text smaller than 28 px,
  headlines at least 72 px, nothing inside the outer 5 percent, and at least
  7:1 contrast for main text. Presenting aids (page number, typed digits, key
  tester) and full-bleed texture are exempt but must stay readable.
- Always build a light and a dark theme, switched by one setting and by
  ?theme=. The default follows the room: light for a bright or unknown room,
  dark for a dark hall.
- Plain language in everything I read: chat, help, notes, README.
- I can fix a typo without you: all on-screen text and speaker notes live in
  one file, js/content.js, keyed by beat name. Each beat has its text and its
  notes; the first beat of a page also has the page title. A word wrapped in
  *asterisks* is emphasised. The README shows me how.

## 5. The engine
- A fixed 1920x1080 stage, centred and scaled to fit any screen.
- The whole show is one paused GSAP master timeline. A beat is a point where the
  show stops and waits for a click. A scene is one page and can hold several
  beats.
- Every beat has a unique, stable name. The name is its identity everywhere: URL
  hash, snapshots, content file, notes. On start-up, stop with a clear on-screen
  error if two beats share a name, or a beat lacks text or notes.
- Next plays forward to the next beat. A press during an animation finishes it
  instantly, then moves on. Back during a forward animation returns to the beat
  it left. A jump of more than one beat is instant, covered by a short black
  flash. Ignore key auto-repeat, so a held or stuck button moves one beat.
- Back plays the last click in reverse, about twice as fast. Where a reversed
  animation looks wrong, give that beat a short crossfade to the previous
  picture instead. Back must always end on exactly the previous picture.
- Rules that keep Back and jumps correct:
  - Set every initial state up front. On the master timeline use only .to() and
    .set(), never .from() or .fromTo().
  - Anything drawn by code (canvas, SVG, counters, typed text) is drawn from a
    state object that the timeline tweens, and redrawn whenever that state
    changes. No effect may depend on having been played forward. The library
    attaches its own bookkeeping to objects it tweens, so never serialise or
    blindly copy a state object.
  - Each scene hides its own elements when it ends.
- Authoring: js/deck.js builds the show with a small API: start a scene, mark a
  beat with its name, add animation between beats. Extra scene files
  (js/scenes-*.js) can add pages at named points, so the show grows without one
  giant file. Provide helpers for staggered text, typed text, counters and
  watched drawing, all obeying section 7.
- Start-up: wait for fonts and images behind a small loader, with time limits. A
  slow or missing file must never block the show.
- The current beat name is kept in the URL hash, so a refresh reopens there.
- In test and snapshot modes (?test), seed all randomness and freeze the
  background clock, so two captures of the same beat are identical.

## 6. Controls: keyboard, clicker, mouse
A clicker is a keyboard. Most send PageDown and PageUp or arrow keys; many send
F5, Shift+F5 or Esc for "start slideshow" and B or "." for "black screen".

- Next: Right, Down, PageDown, Space, N, Enter (when no number is typed), and a
  left-click on the stage.
- Back: Left, Up, PageUp, Backspace, and a right-click on the stage.
- Full screen on/off: F, F5, Shift+F5. F5 must not reload the page.
- Black screen: B or ".". White screen: W or ",".
- Presenter view: P (pressing it again brings the same window forward).
  Overview: G or O. Help: H or "?".
- Jump: type a page number, then Enter. It is the number shown on screen, not
  a click count; 0 is the start screen. Show the typed digits small on screen.
  Clear them after 3 seconds without a key, or on Esc. To reach one click
  inside a page, I use the overview.
- First and last beat: Home, End.
- Key tester: D. Progress line: L. Close any overlay: Esc.

Also:
- Letter shortcuts must work on any keyboard layout. On an Arabic layout the B
  key types two letters, not "b". Match letters by the physical key as well as
  by the character.
- Arrow keys keep the same meaning in a right-to-left deck. Clickers send
  physical keys; flipping them would make the forward button go back.
- While the screen is black or white, the next Next, Back, Esc or click only
  brings the picture back. It does not change the slide. The other colour's key
  switches colour.
- In the overview, Next and Back keys move the selection in reading order;
  only Enter or a mouse click jumps. Space moves, so a clicker that sends Space
  cannot jump by accident.
- Ignore presses with Ctrl, Alt or Cmd held. Shift is allowed.
- Clicks inside overlays and on buttons act on those, never as Next or Back.
- Suppress the right-click menu. Hide the pointer after 2 seconds of stillness.
- The Esc problem: in full screen the browser itself takes Esc and leaves full
  screen; the page does not even receive the key. A keyboard-lock feature exists
  but may be refused, and a hidden test browser cannot settle whether it works.
  So: request the lock when entering full screen, use it if granted, and never
  depend on it. Esc never changes the slide. If full screen is lost, the next
  F, F5 or Shift+F5 restores it, and the presenter view shows a quiet warning.
  Tell me to learn which clicker button sends Esc, using the key tester.
  When the lock is granted, a short press of Esc no longer leaves full screen,
  which feels like being stuck. So on entering full screen show a two-second
  hint, and repeat it in the help table: press F to leave full screen, or hold
  Esc for two seconds.

## 7. Language and direction
If the slide language is Arabic or both, these are requirements, not polish.
- Set lang and dir correctly on the page and on any element in the other
  language. Isolate mixed-direction runs so numbers, Latin words and
  punctuation land where a reader expects.
- Never wrap single Arabic letters in their own elements and never add letter
  spacing to Arabic. Both break the joined letter forms. For Arabic text, split
  and stagger by whole words only. For typed or scrambled effects, lay out the
  full line first and reveal it with a mask, wipe, blur or fade, starting from
  the right. Per-letter effects are for Latin text only. Detect the script per
  text run; do not assume one script per deck.
- Fonts: bundle a real Arabic family with several weights for headlines and
  body (default Tajawal), and optionally a contrasting Arabic face for emphasis.
  No fake italics and no capitals logic for Arabic; emphasise with weight,
  colour or the second face. Latin words inside Arabic text may use the Arabic
  family's own Latin letters; an emphasised Latin word uses weight and colour.
  Check that no text falls back to a system font.
- Give Arabic headlines more line height than Latin, so marks above and below
  the letters never clip.
- Numerals are Western digits (0-9) everywhere, including animated counters.
- Mirror the layout for right-to-left: text block on the right, visual on the
  left, page number bottom left, progress line growing from the right, wipes
  and entrances travelling right to left, overview grid filling from the right.
- Charts keep number and time axes left to right unless I say otherwise; their
  labels are in the slide language.
- Help, presenter view, key tester and check reports are in the language I
  chose for talking with you.

## 8. Look and performance
Look:
- Build the art direction I chose in Phase 0. Keep every colour, size and
  timing in one place (CSS variables and one JS settings object).
- One living background behind every page that never cuts. Default: a WebGL
  point cloud whose dots morph from one meaningful shape to the next (a model
  of the slide's subject, a network, a map), not generic spheres. The timeline
  can animate its position, scale, rotation, opacity, colours and dot size.
- Scenes do not cut: elements leave and arrive while the background changes.
- Every page has two columns: a text column and a visual column. The background
  shape lives in the visual column and never sits under text. When a number,
  chart or image takes the visual column, the shape moves out of the way or
  fades below 10 percent first.
- Centre each page's content vertically by eye. Do not leave the bottom third
  empty on every page.
- Charts are SVG so they animate: lines draw, bars grow, numbers count. Label
  axes and show the source.
- Animate transforms and opacity. A faint grain and vignette are welcome in the
  live show if they cost almost nothing. Leave grain out of every export: noise
  does not compress and multiplies file sizes.

Performance budget:
- Target 60 frames a second. Never below 30 during a transition.
- Build a quality ladder: full, medium, lite, static. Static is a still picture
  of the background for each beat, swapped on arrival. It must look finished,
  because it is also what a computer without WebGL shows; current browsers no
  longer fall back to software rendering on their own.
- The show measures its own smoothed frame time. If it stays above 24 ms for 2
  seconds, it steps down one level between transitions, never during one, and
  does not step back up until the page is reloaded.
- ?quality=full|medium|lite|static forces a level. Cap the canvas pixel ratio.
  Stop drawing when the tab is hidden.
- If WebGL is missing or the context is lost, fall to static without an error
  on screen, and recover if the context returns.
- index.html?bench runs each level for a few seconds, about 20 seconds in all,
  through a real transition. A browser never draws faster than the screen, so
  average frame time hides the difference between levels: report dropped frames
  and the slowest 5 percent of frames per level. Verdict in plain words:
  slowest 5 percent up to 20 ms is smooth, up to 33 ms is acceptable, above
  that use a lower level. End by naming the level to use on this computer.
- Embedded copies of the show (presenter view) run at lite or below.

## 9. Presenting tools
- Help (H or ?): a table of every control.
- Page numbers: each scene is a page, numbered by order so they update
  themselves. The start screen is page 0 and shows no number.
  A page is one idea: clicks inside a page build on the same picture. When a
  click replaces the whole picture with a new idea, it is a new page with its
  own number. If I ask for one page whose clicks are really separate ideas,
  tell me and split it. Beside the page number show small dots, one per click
  of the page, with the current one filled, so I can see the show moved.
- Overview (G or O): a grid of snapshots of every click, grouped by page, each
  group headed by page number, title and click count. The current click is
  highlighted. Keys as in section 6. A click without a snapshot shows its name.
- Presenter view (P): a second window, presenter.html, for my laptop screen
  while the show is full screen on the projector. It shows:
  - click n of total, page number and title, time of day;
  - a timer that starts on my first forward click, and a pace line comparing
    time used with progress through the show. If I give minutes per page in
    content.js, pace uses them; otherwise it treats every click as equal and
    says so;
  - a live copy of what the audience sees, and the next click as a still
    snapshot (not a second live copy);
  - speaker notes at 36 px or larger;
  - buttons for Back, Next, Black and Reset timer. The Next, Back, black, white,
    Home and End keys work here too.
  The windows and the embedded live copy talk only through window.postMessage.
  On file:// every page is a separate origin: the origin reads as "null" and one
  page cannot reach into another. Accept a message only if it carries a token
  created when the show opened the presenter (pass it to the embedded copy in
  its address) and comes from the expected window. The presenter re-announces
  itself every few seconds, so the link recovers if either window reloads. If
  the browser logs a harmless message during that recovery, list it in
  docs/decisions.md as tolerated; tolerate nothing else.
- Black and white screens (B, W): a fade, to pull attention back to me.
- Key tester (D): a small box showing the name of each key pressed and what it
  did ("next", "back", "not mapped"). Off by default. It must not cover slide
  text.
- Progress line (L): a thin line on the bottom edge. Off by default.

## 10. Outputs and Plan B
Build these with scripts that drive a hidden Chrome or Edge through its remote
debugging protocol, using only what the current Node.js LTS has built in, no
npm packages. If built-in features are not enough, stop and tell me instead of
adding dependencies. A double-click cannot pass options, so give each output
its own launcher for my computer, and say which launchers you could not test.
If I have no Node.js, run the exports yourself and hand me the files. A hidden
browser may need a flag to allow software WebGL; without it your captures show
the static background.
- Snapshots: a 480x270 JPEG of every beat in assets/thumbs/, plus a .js index
  that maps beat names to files, for the overview and presenter view.
- Slides as images: a 1920x1080 PNG of the final picture of every beat in
  export/slides/, numbered in order, ready to drop into PowerPoint.
- PDF, three files: export/handout.pdf (one widescreen page per beat),
  export/handout-by-page.pdf (one per scene, showing its last beat), and
  export/handout-notes.pdf (A4 upright, speaker notes under each picture).
  Stream the PDF out of the browser so a long deck does not hit a size limit.
  Arabic text in a PDF may not search or copy correctly; say so in the README.
- Plan B: export/static.html, one self-contained file with the pictures inside
  it, with the same Next, Back, black-screen and page-jump keys, no WebGL and
  no animation library, written so that old browsers can run it. It must work
  in any browser on any computer from a USB stick. Tell me its size; if it
  passes 25 MB, embed JPEGs instead of PNGs.
- Every export records a fingerprint of the slides it was made from.
- tools/check runs every automatic check in section 13 and prints pass or fail
  in plain language, and fails if an export is older than the slides. It has a
  quick mode that checks only new or changed beats plus a start-up test, and a
  full mode. Tell me how long each takes.

## 11. Only if I supply a comic or storyboard
Turn it into a motion comic: treat each page as a world and fly a virtual
camera through it, one panel or moment per click, with my script as the notes.
Spotlight the active panel and dim the rest. Interpolate zoom on a logarithmic
scale so it feels even. Pin any effects to the art in the image's own pixel
coordinates. Use my images as they are, and tell me what size to export if they
are too small for deep zooms. In a right-to-left comic, read panels right to
left.

## 12. Files
- index.html, presenter.html, css/
- js/engine.js (beats, navigation, keys, overlays, presenter link)
- js/settings.js, js/background.js, js/deck.js, js/scenes-*.js, js/content.js
- vendor/ (GSAP and VERSIONS.md), assets/ (fonts, thumbs, my images)
- tools/ (snapshot, export, check, bench helpers, launchers), export/
- docs/sources.md (where every fact comes from)
- docs/decisions.md (what you chose, what differed from this brief, and why)
- README.md: how to present, the controls table, what is on each page, how to
  fix a typo, the browser versions you tested, and a pre-show checklist
  (rehearse on the venue computer, run ?bench, re-export, copy Plan B and the
  PDF to a USB stick).
- AGENTS.md, plus whatever briefing file your own tool reads automatically: how
  the project is built and my rules, for a future AI session that has never
  seen this conversation.
Add other files when you need them and list them in the README.

## 13. Before you tell me anything is done
- Load the show in the hidden browser and confirm there are no console errors.
- For every new beat: capture it after clicking through, after jumping straight
  to it from a freshly loaded page, and after going one beat past and pressing
  Back. The three captures must match. Changing only the part of the address
  after # does not reload a page; a test that does that checks a stale page.
- Matching captures prove consistency, not correctness: three captures can be
  identically wrong. Look at the pictures yourself: every beat, frames from the
  middle of each animation, each theme, and the small embedded copy in the
  presenter view.
- If the deck has Arabic: capture every text effect mid-animation and confirm
  the letters stay joined and no text uses a fallback font.
- Confirm beat names are unique and every beat has text and notes.
- Refresh snapshots and exports. Update README, sources and decisions.
- Tell me plainly what you tested, what you could not test (my real clicker,
  the projector, the venue computer, other operating systems and browsers), and
  anything you are unsure of.`
};
