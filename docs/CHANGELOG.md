# Changelog — HackJudge AI

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/);
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project README with full product specification (problem, goals, features,
  rubric, API overview, data models, AI principles, security considerations).
- Documentation set in `docs/` (24 files): architecture, overview, backlogs,
  contribution, conversations, decisions, deployments, human guidelines,
  milestones, operations, principles, privacy, project details, requirements,
  roadmap, security, specification, steps, tasks, testing, troubleshooting,
  vision, and the file index.
- Backend scaffold: `backend/package.json` with dependencies:
  - express `^5.3.0`
  - mongoose `^9.11.2`
  - mongodb `^7.7.0`
  - dotenv `^18.0.8`
  - nodemon `^3.1.14` (runtime dependency)
- `frontend/` directory reserved for the React client.

### Known Gaps

- No `server.js` or backend source files yet — start with
  [STEPS.md](STEPS.md) §2.
- No start/dev scripts in `backend/package.json`.
- Frontend not yet scaffolded (Vite React app pending).
- No tests, linting, or CI configured.
- No `LICENSE` selected (BL-32).

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
