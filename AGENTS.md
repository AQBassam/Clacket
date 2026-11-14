# Clacket: briefing for an AI session

Clacket is a static Arabic (RTL) page that turns a presenter's answers, or their
existing .pptx/.pdf, into a prompt for a coding agent. The agent then builds a
cinematic, clicker-driven web presentation. Owner: Bassam (BassamAI Lab).
Live at clacket.bassamailab.xyz.

## Rules
- No server, no build step, no framework, no CDN, no analytics, no network
  calls after page load. The uploaded file never leaves the browser.
- Vanilla JS in classic scripts. Only vendor/ holds third-party code (GSAP core,
  fflate, pdf.js legacy build), each with its licence. Record any version change in
  README.
- UI text is Arabic, plain, for non-technical presenters. Western digits.
  Tajawal, self-hosted. Colours follow the lab: see :root in css/style.css.
- The generated prompt is English. js/brief.js is its single source. Any change
  to BODY needs a VERSION bump and a line in docs/BRIEF-CHANGELOG.md.
- Never claim something works that was not tested. docs/TESTING.md lists what
  was and was not tested; keep it current, and keep the "what was not tested"
  block in index.html in step with it.
- The guide's install steps come from Claude's official docs; re-verify them
  before editing, and update the date shown in the guide.
- Do not commit real presentations. Tests take a file path.

## The film (js/show.js)
The whole page is one film in a dark hall. One fixed layer (`.bg`) holds the
pictures and the point cloud; the sections scroll over it. The show at the top
(`#stage`) and every guide section (`.take`) are scenes on ONE paused master
timeline. Scrolling down to a scene plays all its clicks; arrows, PageUp/Down
and a clicker step through them one by one and move on at a scene's end.
The generator (`#maker`, inside `.booth`) comes last, after the guide, so the
visitor has seen the whole path before filling it in. It is not a scene: it stays a plain form,
nothing in it animates, and keys never drive the film while focus is there.
The film must obey the brief it advertises: only .to() and .set(), the point
cloud drawn from the state object S, Arabic split by whole words, Back in
reverse at twice the speed, letter keys matched by physical key, arrow keys
keep the brief's meaning (Right = next; the slide names PageDown/PageUp, never
an arrow picture, since an arrow pointing right reads as "back" to this audience), each click
placed at or after the previous beat (never '>' across clicks), relative
offsets multiplied by D. Every claim on a slide must be true of the brief.
Guide text animates opacity only, never visibility, so screen readers keep it.
Class names inside the film must not collide with page classes (a `.num`
collision once broke the counter).

Pictures: generated, recorded in docs/CREDITS.md. Originals in art/originals/
(not deployed); `python tools/treat-images.py` prints them in the hall's inks
into assets/img/. Guide pictures load only when their scene is near.

## How the reader works (js/readers.js)
- pptx: unzip with fflate, order slides by presentation.xml, join the runs of
  each paragraph (designed decks split one sentence into several runs), sort
  text boxes top to bottom then from the reading side, take the title from a
  title placeholder or else the largest type on the slide. Notes: only the
  notes body placeholder; number-only notes are treated as empty.
- pdf: pdf.js text items grouped into lines. Arabic often comes out damaged;
  the reader measures that and the page warns instead of passing it on quietly.

## Releases
See deploy/DEPLOY.md. Bump version.json, run `bash deploy/make-sums.sh`, push
to main, push a tag vX.Y.Z. Never copy the nginx site file over the live one
after certbot has edited it.

## Check before saying done
Run `python3 tests/smoke.py <deck.pptx>` and look at the screenshots it writes,
on both the phone and desktop sizes. It serves the site with the live CSP
(tests/serve.py) and checks every beat: same picture by click-through, Back and
jump; nothing from a later click early; text at least 7:1 against what lies
behind it; no text under the buttons. `python tests/serve.py` serves the same
way for a manual look.
