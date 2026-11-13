# Clacket: briefing for an AI session

Clacket is a static Arabic (RTL) page that turns a presenter's answers, or their
existing .pptx/.pdf, into a prompt for a coding agent. The agent then builds a
cinematic, clicker-driven web presentation. Owner: Bassam (BassamAI Lab).
Live at clacket.bassamailab.xyz.

## Rules
- No server, no build step, no framework, no CDN, no analytics, no network
  calls after page load. The uploaded file never leaves the browser.
- Vanilla JS in classic scripts. Only vendor/ holds third-party code (fflate,
  pdf.js legacy build), each with its licence. Record any version change in
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
on both the phone and desktop sizes.
