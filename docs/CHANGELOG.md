# Changelog — HackJudge AI

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/);
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added (2026-10-22) — Phase 5: leaderboard, release gating, CSV export

- **Phase 5 — Leaderboard & Export.** `buildLeaderboard` joins
  `services/scoringService.js` (ADR-0005 kept one authority for all scoring
  math): per submission, the mean of its **submitted** scorecards rounded to
  1dp; ties break average → judged count → project name → submission id, and
  unjudged rows sit last with null rank/average (a blank isn't a zero).
- **Release gating.** Event gains `resultsReleased` + `releasedAt`.
  Standings are sealed for judges *and* teams — zero scores in the payload —
  until the organizer releases; judges are deliberately gated too so nobody
  benchmarks against midway standings. The organizer gets a live preview.
  `POST /events/:eventId/leaderboard/release` requires owner + `closed`
  event; after release the event can no longer change status
  (`RESULTS_LOCKED`), and a second press is `ALREADY_RELEASED`.
- **Leaderboard page** (`/events/:eventId/leaderboard`): rank table with
  per-judge score chips, judged x/y coverage, sealed screen, preview strip +
  release button (confirm), released strip. Event cards gained a quiet
  **results** link for every role, hidden while the event is a draft.
- **CSV export** `GET /events/:eventId/leaderboard/csv` — BOM + CRLF, one
  column per assigned judge in assignment order, proper quoting; same
  gating (`RESULTS_SEALED` for non-organizers pre-release). The frontend
  fetches it as a blob so the bearer token rides along, and CORS now
  exposes `Content-Disposition` so the download keeps the server's filename.
- **Tests: 95 backend checks** (8 new release-lifecycle API tests + 8
  `buildLeaderboard` units with hand-checked averages), and the UI journey
  grew to **102 checks**: judge2 assigned mid-event scores MediQueue to
  hand-computed 50 (5/10×60 + 5/10×40), organizer previews 82 vs 50,
  releases through the confirm, downloads the CSV as a real file, and the
  team reads the released standings.

### Fixed (2026-10-22) — bugs found while testing Phase 5

- **A slow load could wipe a judge's scores.** `ScorecardPage`'s mount
  effect had no `ignore` guard; under React StrictMode it fires two
  `getScorecard` calls, and the second (stale) response re-hydrated
  `scores` from the empty server draft — silently resetting sliders the
  judge had already set, disabling submit. It never surfaced while the API
  answered in milliseconds; Atlas latency widened the race until the UI
  journey hit it twice. Now guarded with the same `ignore` flag the list
  pages use. (Found by `e2e/ui-journey.mjs`, which is exactly the kind of
  timing bug a browser walk catches and unit tests can't.)

### Added (2026-10-22) — Phases 2/3/4: events, submissions, judging

- **Phase 2 — Events + rubrics.** Event model with an embedded rubric whose
  weights must sum to 100 (enforced in zod, mongoose, and the service layer).
  Organizer CRUD, judge assignment (`GET /api/users/judges` directory),
  status flow `draft → published → closed`. Rubric editor UI with a live
  weight meter and a "spread evenly" fix-up button.
- **Phase 3 — Submissions.** One entry per team per event (unique index),
  `http:`/`https:`-only link allowlist (blocks `javascript:`/`data:` before it
  reaches a judge's browser), role-scoped visibility (teams see only their
  own), lock when the event closes. Submission form with dynamic link rows,
  edit and withdraw.
- **Phase 4 — Judging.** Evaluation model (unique per judge + submission),
  draft → submitted workflow, `GET /evaluations/mine` queue, and
  `services/scoringService.js` holding all scoring math per ADR-0005
  (`contribution = (score/10) × weight`, `final = Σ`). Scorecard page with
  0–10 sliders, running total, and per-criterion contribution chips.
- **Tests: 79 backend checks** (`node --test "tests/*.test.js"`, 12 of them
  pure scoring-math units) — plus a live API walkthrough
  (`scripts/e2e-walkthrough.mjs`, 18 checks, server must be on :3000).

### Fixed (2026-10-22) — bugs found by walking the UI as a real user

Found by `e2e/ui-journey.mjs` (Playwright drives the real screens — 79/79
checks across all four roles):

- **Organizers could never publish.** The API accepted `PUT /events/:id`
  `status`, but the events page exposed no publish/close control, so every
  event dead-ended as a draft (teams got `NOT_PUBLISHED`, judges got
  `NOT_PUBLISHED`). Card now shows **publish** while draft and **close
  judging** while live, both behind a confirm.
- **Teams saw an empty docket forever.** `listEvents` put every
  non-organizer into `{ judges: userId }` — a team is never in `judges`, so
  the list was always empty and there was no path to a submissions page.
  Teams now get `{ status: { $ne: 'draft' } }` (open events), and
  `getEvent` lets a team read an event once it's published.
- **Judge chips rendered blank.** `addJudge`/`removeJudge`/`updateEvent`
  returned the event with raw ObjectIds (never populated) while the UI
  draws judge names straight from the response — chips showed only the `×`
  until a manual refresh. Responses now populate `organizer` + `judges`.
- **A wrong password showed nothing.** The axios 401 interceptor did a hard
  `window.location.href = "/login"`, reloading the page before the error
  could render. Login attempts are now exempt: the server's
  "Invalid Email or Password" reaches the form; expired sessions elsewhere
  still bounce to login.
- **Fresh rubric form had a dead create button.** The rubric editor
  prefills Impact/Technical/Design (Σ=100) internally but never pushed them
  to the parent, so `rubricOk` stayed false — green meter, disabled button —
  until the user nudged a value. The editor now syncs on mount.
- **Failed submits erased the judge's work** (also caught by the API
  walkthrough): `submitEvaluation` threw `INCOMPLETE_SCORES` before saving.
  The attempt now persists as a draft first, then validates.
- **Withdraw was unreachable**: `handleWithdraw` existed but no button ever
  called it — wired edit/withdraw onto the owning team's card (+ styles).
- **Stale `setState` after unmount** on both list pages — restructured to
  inline async + `ignore` flag; also cleared the last ESLint errors
  (frontend lint exits 0).

### Added (2026-10-22) — user-journey test harness

- **`e2e/ui-journey.mjs`** — Playwright walks the whole loop as people, not
  APIs: unauthenticated bounce → bad login → organizer creates/rubrics/
  assigns/publishes → team checks drafts are invisible → two teams submit
  (with the `javascript:` rejection seen in-form) → edit/withdraw/re-enter →
  unassigned judge locked out → judge scores to exactly 82 (hand-checked:
  9/10×60 + 7/10×40) → submit confirm names the total → reload stays
  locked → close judging → everything read-only. `npm i` in `e2e/`,
  then `node e2e/ui-journey.mjs` with backend :3000 + frontend :5173 up.
- **Gotcha worth knowing:** the frontend must run on **5173** — CORS allows
  only `CLIENT_URL`, so a second dev server on 5174 silently fails every
  request.

### Added (2026-10-21) — Phase 0.5 overhaul landed + Phase 1 frontend

- **Design tokens** — `frontend/src/styles/tokens.css`: full palette
  (ink/paper/amber…), Instrument Serif + Archivo + IBM Plex Mono, spacing,
  radii, shadows, z-index scale. Single source of truth for the
  "Night Judging Desk" look.
- **Login page redesign** — "The Night Judging Desk": lamplight glow, drifting
  evidence-constellation canvas (respects `prefers-reduced-motion`), ledger
  grid, film grain, ghost score watermark, floating Verified/Claimed/Inferred
  chips. Fonts loaded in `index.html`.
- **Central error handler** — `utils/AppError.js` + `utils/catchAsync.js` +
  `middleware/error.middleware.js`: one place shapes `{error:{code,message}}`;
  SyntaxError→400 `BAD_JSON`, Mongoose ValidationError→422,
  duplicate-key→409, unknown→500 (stack logged server-side only).
- **Zod validation** — `schema/auth.schema.js` + reusable `validate()`
  middleware at the route layer. Strict schemas reject unknown fields →
  422 `VALIDATION_ERROR`; bodies are trimmed/lowercased before controllers.
- **Feature-first frontend restructure** — `app/`, `features/auth/`,
  `features/shared/api/`, `components/`, `styles/`; `@`→`src` alias in
  `vite.config.js`. All moves via `git mv` (history preserved).
- **Dashboard placeholder** restyled in the design language (lamp + grain +
  judge card + ghost logout button).
- **`.env.example`** (backend) — keys only, with the non-SRV connection-string
  note.
- **Tests now 13/13** — 2 updated to the 422 validation contract, +1 new
  strict-schema test.

### Fixed (2026-10-21)

- **Login never sent the email** — `login({emila, password})` typo in
  AuthContext destructured a non-existent `emila` var (would throw
  ReferenceError; `email` was never posted).
- **`role: data.email`** in `setUser` — dashboard displayed the email as role.
- **JWT never attached** — axios interceptor read `localStorage.getItem("Token")`
  (capital T) while the auth context writes `"token"`; both read and 401-cleanup
  paths corrected.
- **`VITE_API_URL` was `undefined`** — `.env` sat in `frontend/src/` where Vite
  never looks; moved to `frontend/` root, verified via `loadEnv`, and `.env`
  added to `.gitignore` (+ unstaged before it could be committed).
- **`messsage` typo** in the old 500 response — removed with the controller
  slim-down.

### Changed (2026-10-21)

- **Naming normalization (ADR-0013 #1):** `model/`→`models/`,
  `utils/genrateToken.js`→`utils/generateToken.js` (`git mv`, imports fixed).
- **Controller slimmed** — auth controller now throws `AppError` instead of
  hand-rolling try/catch + response objects.
- **Register/login validation contract** — manual 400s replaced by route-layer
  zod 422s (tests updated accordingly).
- **Dead code removed** — `backend/config/dns.js` deleted (never imported;
  `dns` is a Node built-in, was never actually installed).
- Docs synced: ROADMAP (Phase 0.5 + Phase 1 ✅, M1/M1.5 milestones closed),
  ARCHITECTURE (Part 2 marked as-built).

### Added (2026-10-20)

- **Architecture + View Overhaul declared** — ADR-0013 in
  [DECISIONS.md](DECISIONS.md); target architecture documented in
  [ARCHITECTURE.md](ARCHITECTURE.md) Part 2 (strict 5-layer backend,
  feature-first frontend with design system).
- **Auth API complete:** `POST /api/auth/register`, `POST /api/auth/login`,
  `POST /api/auth/logout`, `GET /api/auth/me`.
- **Auth middleware:** `protect` (Bearer JWT, 7-day expiry) and
  `requireRole` (organizer/judge/team RBAC).
- **User model** — name, unique email, bcrypt-hashed password
  (`select:false`), role enum, timestamps.
- **Health endpoint** `GET /api/health` + CORS (`CLIENT_URL`) + JSON
  parsing (1 MB) wired in `index.js`.
- **Test suite:** `backend/tests/auth.test.js` — **12/12 passing** with
  Node's built-in runner (`npm test` → `node --test "tests/*.test.js"`).
- Scripts: `dev` (nodemon), `start`, `test` in `backend/package.json`.
- Docs set rewritten (24 files): current reality + overhaul direction,
  `frontend/` naming, real ports/env names, incident history in
  [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

### Fixed (2026-10-19/20)

- **MongoDB SRV failure** (`querySrv ECONNREFUSED`) — machine's DNS
  (`10.222.71.160`) refuses Node SRV lookups; switched `.env` to a standard
  non-SRV connection string with explicit shard hosts + `replicaSet`.
- **`npm test` crash** (`Cannot find module …/tests`) — Node 24 treats a
  directory argument as a literal module path; script changed to
  `node --test "tests/*.test.js"`; also removed the duplicate `"test"` key
  from `package.json`.
- **Register 500** (`Path 'password' is required`) — controller saved
  `passwordHash` but the schema field is `password`; corrected `create`,
  `select("+password")`, and `bcrypt.compare` usages.
- **Valid tokens rejected (401)** — `header.startWith` typo →
  `startsWith('Bearer ')`; imported `JWT` but called `jwt.verify` →
  consistent lowercase `jwt`.
- **Missing env vars** — added `JWT_SECRET` (64-char random) and
  `CLIENT_URL` to `.env`.

### Security (2026-10-20)

- Passwords hashed with bcryptjs (10 rounds); password field excluded from
  default queries and verified absent from all API responses by tests.
- Uniform login failure responses (no user enumeration).

### Known Gaps

- Frontend still the Vite template — no `api.js`, login UI, or app screens.
- No central error handler / validation middleware / `services/` layer
  (planned in overhaul, Phase 0.5).
- Housekeeping: stray `backend/config/dns.js` and unused npm `dns` package
  pending removal; no `LICENSE` selected (BL-32).
- Test users (`test+<timestamp>@example.com`) accumulate in Atlas per test
  run — purge periodically until test teardown exists.

---

## Template for Future Entries

```markdown
## [1.1.0] - YYYY-MM-DD

### Added
- New capabilities.

### Changed
- Behavior changes judges or organizers will notice.

### Fixed
- Bugs.

### Security
- Vulnerability fixes (never include exploit detail before patch adoption).
```

## Release Notes Guidelines

- Write for a reader who was offline: what changed, why it matters, and any
  action required (env var changes, migrations, redeploys).
- Anything touching scoring behavior must state whether existing totals are
  affected.
- Security entries follow [SECURITY.md](SECURITY.md) — coordinated disclosure
  first.
- Milestone completions are cross-referenced with
  [MILESTONES.md](MILESTONES.md).

## Related Documents

- [ROADMAP.md](ROADMAP.md) — planned changes
- [CONVERSATION.md](CONVERSATION.md) — the discussions behind changes
- [TASKS.md](TASKS.md) — in-flight work
