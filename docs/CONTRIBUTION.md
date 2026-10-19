# Contributing — HackJudge AI

Guide for developers contributing to HackJudge AI. Contributions, suggestions,
and bug reports are welcome.

## Getting Started

1. Fork the repository.
2. Clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/hackjudge-ai.git
   cd hackjudge-ai
   ```

3. Set up the project by following [STEPS.md](STEPS.md) (backend + frontend).
4. Read [PRINCIPLES.md](PRINCIPLES.md) and [SECURITY.md](SECURITY.md) — they
   are binding, not aspirational.

## Workflow

1. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature
   ```

2. Implement the change with tests ([TESTING.md](TESTING.md)).
3. Update the affected docs in `docs/`.
4. Commit using clear messages:

   ```
   feat: add rubric weight validation
   fix: exclude draft evaluations from leaderboard
   docs: document SSRF allowlist rules
   ```

5. Push and open a pull request:

   ```bash
   git push origin feature/your-feature
   ```

For larger changes, **open an issue first** to discuss the proposed
implementation before writing code.

## Branch and Commit Conventions

| | |
| --- | --- |
| Branches | `feature/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>` |
| Commits | Conventional style: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:` |
| Main | Always deployable; PRs only, no direct pushes |

## Code Standards

- **JavaScript style:** ES modules on the client (`import`), CommonJS on the
  server (`require`) — match the file you're editing.
- **Naming:** camelCase for functions/variables, PascalCase for components and
  Mongoose models.
- **Config via env:** no hardcoded URLs, ports, or secrets. Anything secret
  goes in server-side env vars — never `VITE_` variables.
- **Errors:** consistent JSON error shape
  `{ error: { code, message } }`; never leak stack traces in production.
- **Validation:** every new endpoint validates and sanitizes input server-side
  and enforces RBAC.
- **Scoring math:** never reimplement scoring inline — import
  `scoringService.js` (ADR-0005).
- **AI code:** all LLM calls go through `aiEvaluationService.js`, server-side
  only.

## Testing Requirements

- New endpoints: integration test for the happy path **and** at least one
  explicit **deny** test (wrong role / not assigned).
- Scoring changes: update `scoringService` unit tests first (TDD is welcome).
- Never call a live LLM API in CI — use fixtures/mocks.

## Documentation Requirements

Every PR that changes behavior updates the matching file in `docs/`:

| Change | Update |
| --- | --- |
| New/changed feature | `BACKLOGS.md`, `REQUIREMENTS.md`, `TASKS.md` |
| API/schema change | `SPECIFICATION.md` |
| Architecture change | `ARCHITECTURE.md`, `DECISIONS.md` (new ADR) |
| User-facing behavior | `PROJECT.md`, `HUMAN.md` |
| Notable change | `CHANGELOG.md` |

## Pull Request Checklist

- [ ] Tests written and passing locally
- [ ] Lint clean (once ESLint/Prettier are configured)
- [ ] No secrets, `.env` files, or credentials in the diff
- [ ] New routes validated + RBAC-enforced
- [ ] Docs updated
- [ ] Related issue linked

## Review Expectations

- One approving review before merge.
- Security-relevant changes ([SECURITY.md](SECURITY.md)) require a
  security-minded reviewer.
- Reviews respond within 48 hours during active development.

## Reporting Bugs

Open an issue with:

- What you expected vs. what happened
- Reproduction steps (role, endpoint, payload shape — **redact secrets**)
- Environment (local/production, Node version)
- Logs (sanitized — no tokens or keys)

## Good First Contributions

- Items marked `P1/P2` and `todo` in [BACKLOGS.md](BACKLOGS.md)
- Test coverage gaps in [TESTING.md](TESTING.md) §3–4
- Accessibility fixes (BL-31)
- Documentation improvements in this `docs/` set

## License

No license has been selected yet — a `LICENSE` file must be added before
distributing or accepting external contributions (BL-32).

## Related Documents

- [STEPS.md](STEPS.md) — environment setup
- [PRINCIPLES.md](PRINCIPLES.md) — design rules
- [CONVERSATION.md](CONVERSATION.md) — design discussions and context
