# Task: make the whole Clacket page a film, with pictures

Read AGENTS.md first. This file is the handoff for the next piece of work,
written at the end of the session that built versions 1.0.0 to 1.1.1.

## What the owner asked for (13 Nov 2026)
1. The whole page should live in the style of the cinematic show, not only the
   hero. The one part that stays as it is: the four-step prompt generator
   (its questions, its logic, its output).
2. A cinematic show needs pictures. The current show is dots and type only.
   Generate fitting pictures or fetch them from free-licence sites, as was
   done in the owner's Luban project.
3. Use the design skills installed on the owner's machine. He named
   `frontend-design`, `design-taste-frontend` and `Frontend UI Engineering`.
   Load whichever of them exist before designing, and say which you used.

## What exists now
- `js/show.js`: a miniature show in the hero. 6 pages, 8 beats, one paused
  GSAP timeline, a 2D-canvas point cloud drawn from the state object `S`,
  Arabic split by whole words, Back in reverse at twice the speed, B for a
  black screen, F for full screen, page number with click dots at bottom left,
  progress line growing from the right.
- Below it: an intro paragraph, the generator, and the guide as static cards
  and a table. That static part is what the owner finds lifeless.
- Identity: BassamAI Lab colours (see `:root` in css/style.css). The show sits
  in a dark "hall" (`--hall`) with a lamp-yellow accent (`--lamp`). Tajawal.

## Direction to take
- One continuous film from top to bottom. The guide's content (what you need,
  install, folder, paste, the four gates, show day) becomes scenes, in the same
  visual language as the show: one idea at a time, large type, the living
  background carrying on between scenes without a cut.
- Decide and state how the visitor moves through it. Two honest options:
  a single long show driven by clicks and keys, with the generator as its last
  scene; or a scrolling page where each section is a scene that plays as it
  arrives. On a phone, scrolling is the native gesture and the generator's
  form must stay comfortable to fill in. Pick one, say why, and keep the
  keyboard and clicker controls working wherever a show is on screen.
- The generator stays a plain, calm, usable form. Do not animate its fields.
  It may sit inside the film's frame, but nothing about its steps changes.
- Pictures are scenes, not decoration: full-bleed or filling the visual
  column, with a slow camera move driven by the timeline, and a scrim behind
  any text so contrast stays at 7:1. The dots may live over a dimmed picture.
- Subject matter for pictures comes from the world of the thing: a projector
  beam in a dark hall, rows of seats, a clapperboard, a hand holding a
  clicker, a lit stage. No identifiable real people.

## Hard constraints (do not break)
- Static site. No server, no build step, no framework, no CDN, no analytics,
  no network call after load. The CSP in deploy/nginx allows only `'self'`:
  every picture, font and script is a file in this repository. Inline
  `style=""` attributes and `<style>` blocks are blocked; set styles from CSS
  files or from script.
- Pictures: download into `assets/img/`, at most 2560 px wide, WebP or JPEG,
  and keep the page's first load light (lazy-load anything below the hero).
  Record every picture in `docs/CREDITS.md`: file, source URL, author, licence.
  Use only licences that allow this use (for example Unsplash, Pexels,
  Wikimedia Commons CC0/CC BY with credit). If you generate pictures, say with
  what, and record that instead.
- Add new folders to `deploy/FILES`, or they will not be deployed.
- Every sentence on a slide must be true of the brief in js/brief.js.
- Arabic: whole words only, never letter by letter; Western digits; RTL
  layout; motion travels right to left. A right-pointing arrow as a picture
  reads as "backwards" to this audience; it was removed for that reason.
- Each click owns its content. Place it at or after the previous beat's time,
  never with '>' relative to the last tween. This exact fault shipped once:
  half a sentence from click 2 showed on click 1. tests/smoke.py now checks it.
- Class names inside the stage must not collide with page classes.
- Respect `prefers-reduced-motion`. Keep it smooth on an ordinary phone: stop
  drawing when the stage is off screen or the tab is hidden.
- Do not change js/brief.js unless the owner asks; if you do, follow AGENTS.md.

## How to check your work
- `python3 tests/smoke.py /path/to/any.pptx` must pass on phone and desktop
  sizes. Extend it for whatever you add (new scenes: same-picture check for
  click-through, Back and jump; nothing from a later click visible early).
- Rehearse behind the real nginx config with the CSP, as deploy/DEPLOY.md
  describes, or at least serve the site with that CSP header and confirm the
  browser console is clean.
- Look at the result yourself on a 390 px wide screen and a 1280 px one. Show
  the owner screenshots or a local preview before calling it done.
- Say plainly what you tested and what you could not.

## Releasing
Bump `version` in version.json, run `bash deploy/make-sums.sh`, commit, push
to main. The owner creates the tag and release on GitHub himself, then follows
deploy/DEPLOY.md on the server. Nothing has been deployed to the server yet:
the DNS record exists, and releases v1.0.0 exists on GitHub.
