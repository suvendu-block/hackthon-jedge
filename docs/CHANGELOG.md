# Changelog — HackJudge AI

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/);
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
