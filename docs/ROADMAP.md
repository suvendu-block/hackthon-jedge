# Development Roadmap — HackJudge AI

Phased roadmap from scaffold to a production-ready judging platform —
now including the **Architecture + View Overhaul** track declared in
ADR-0013 ([DECISIONS.md](DECISIONS.md)).

## Phase 0 — Foundation ✅ complete (2026-10-19/20)

- [x] Repository initialized (`backend/`, `frontend/`, `docs/`)
- [x] Backend dependencies installed (Express 5, Mongoose 9, MongoDB 7,
      dotenv, nodemon, cors, bcryptjs, jsonwebtoken)
- [x] Project documentation set created (24 files)
- [x] Atlas connection fixed (standard non-SRV connection string)
- [x] `index.js` with `express.json()` + `cors({origin: CLIENT_URL})` +
      `GET /api/health`
- [x] Frontend scaffolded (Vite + React 19 + ESLint; `frontend/`)
- [x] `package.json` scripts: `dev` / `start` / `test`
- [ ] Root `.gitignore` merge + `LICENSE` + lint tooling
- [ ] Delete stray `config/dns.js` + uninstall junk `dns` npm package

## Phase 0.5 — Architecture + View Overhaul 📍 current

Declared ADR-0013 — rewrite, not patch. Details:
[ARCHITECTURE.md](ARCHITECTURE.md) Part 2.

**Backend (architecture v2):**
- [ ] Normalize names: `model/`→`models/`, `controller/`→`controllers/`,
      `genrateToken.js`→`generateToken.js`
- [ ] Central error handler + `asyncHandler` wrapper (kill try/catch boilerplate)
- [ ] Validation middleware layer (zod) before controllers
- [ ] `config/index.js` — validate env at boot (fail fast if `JWT_SECRET` missing)
- [ ] Move `logout` to a real design (Bearer has no server state — document or switch to HttpOnly cookies)
- [ ] Supertest-based tests against exported `app` (no live server needed)

**Frontend (view v2):**
- [ ] Design tokens (palette/type/spacing as CSS vars)
- [ ] Feature-first structure: `app/`, `api/`, `features/{auth,events,submissions,judging,leaderboard}`, `components/ui/`
- [ ] Evidence badge system (Verified / Claimed / Inferred — icon + text)
- [ ] AI-suggested vs judge-entered visual distinction
- [ ] Mobile-first scorecard shell
- [ ] **Fold in reference GitHub project** once link is provided (adopt/adapt/reject → ADRs)

## Phase 1 — Authentication and Roles 🟡 backend done, frontend pending

- [x] User model, register/login endpoints, password hashing (bcryptjs)
- [x] JWT middleware (`protect`) + RBAC middleware (`requireRole`)
- [x] 12 API tests passing (`node --test`)
- [ ] Login page, auth context, Axios interceptor, protected routes
- [ ] Wire `api.js` (`VITE_API_URL=http://localhost:3000/api`)

## Phase 2 — Event Management

- [ ] Event model with configurable rubric (criteria + weights, Σ = 100%)
- [ ] Event CRUD (organizer), judge assignment, status flow
- [ ] Rubric editor UI with live weight-total display

## Phase 3 — Project Submissions

- [ ] Submission model with URL allowlist validation
- [ ] Submit/list/detail endpoints with assignment enforcement
- [ ] Submission form and ProjectDetails page

## Phase 4 — Judging and Scorecards

- [ ] Evaluation model (one per judge per submission)
- [ ] `services/scoringService.js` with unit-tested weighted math
- [ ] Draft → submitted workflow, evaluation history
- [ ] JudgeEvaluation scorecard UI with running total

## Phase 5 — Leaderboard and Export

- [ ] Weighted aggregation and ranking with tie-breakers
- [ ] Results-release gating for unpublished scores
- [ ] Leaderboard page; CSV export

## Phase 6 — AI Evaluation Assistant

- [ ] Server-side `aiEvaluationService` (prompts embed rubric + AI rules)
- [ ] Evidence typing: verified / claimed / inferred
- [ ] Confidence and limitations on every suggestion; judge-override only
- [ ] Rate limiting, timeout, schema validation, 503 failure policy
- [ ] Report UI with evidence badges and accept-suggestion flow

## Phase 7 — Evidence Depth (GitHub & Documents)

- [ ] Authorized GitHub repository analysis (team grants access)
- [ ] SSRF allowlist, redirect validation, **no code execution**
- [ ] Presentation/document upload and analysis
- [ ] Demo review and evidence linking

## Phase 8 — Intelligence and Fairness

- [ ] Judge disagreement alerts
- [ ] AI-generated follow-up questions for teams
- [ ] Similarity checks for potentially duplicated submissions

## Phase 9 — Launch

- [ ] Accessibility and responsive passes
- [ ] Security hardening review ([SECURITY.md](SECURITY.md) checklist)
- [ ] Tests green in CI ([TESTING.md](TESTING.md))
- [ ] Deploy per [DEPLOYMENTS.md](DEPLOYMENTS.md)
- [ ] First live hackathon pilot → retrospective → iterate

## Milestone Targets

| Milestone | Deliverable | Gate | Status |
| --- | --- | --- | --- |
| M0 | Runnable skeleton | `/api/health` returns ok, DB connects | ✅ 2026-10-20 |
| M1 | Auth works end-to-end | Roles enforced in tests | 🟡 backend ✅ / frontend pending |
| M1.5 | Architecture + view overhaul | v2 layers + feature-first UI landed | ⬜ current |
| M2 | Events with custom rubrics | Σ weight validation enforced | ⬜ |
| M3 | Submissions flowing | Teams can submit, judges can read | ⬜ |
| M4 | Judging live | Scorecards + scoring service tested | ⬜ |
| M5 | Results visible | Leaderboard matches hand-computed totals | ⬜ |
| M6 | AI assist enabled | Reports typed, uncertain, overridable | ⬜ |
| M7 | Deep evidence | GitHub analysis with authorization | ⬜ |
| M8 | Production | Deployed, monitored, security checklist done | ⬜ |

See [MILESTONES.md](MILESTONES.md) for the narrative version.

## Related Documents

- [TASKS.md](TASKS.md) — executable task list
- [BACKLOGS.md](BACKLOGS.md) — full feature inventory
- [STEPS.md](STEPS.md) — zero-to-production commands
- [DECISIONS.md](DECISIONS.md) — ADR-0013 (why the overhaul)
