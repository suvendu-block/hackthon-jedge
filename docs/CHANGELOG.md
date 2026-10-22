# Changelog — HackJudge AI

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/);
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
