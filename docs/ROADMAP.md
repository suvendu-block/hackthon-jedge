# Development Roadmap — HackJudge AI

Phased roadmap from scaffold to a production-ready judging platform. Progress
mirrors the roadmap in [README.md](../README.md); detailed tasks live in
[TASKS.md](TASKS.md).

## Phase 0 — Foundation ✎ in progress

- [x] Repository initialized (`backend/`, `frontend/`, `docs/`)
- [x] Backend dependencies installed (Express 5, Mongoose 9, MongoDB 7,
      dotenv, nodemon)
- [x] Project documentation set created
- [ ] Root `.gitignore`, `LICENSE`, lint/format tooling
- [ ] `server.js` + health endpoint + DB config
- [ ] Frontend scaffolded (Vite + React + Axios + Router)

## Phase 1 — Authentication and Roles

- [ ] User model, register/login endpoints, password hashing
- [ ] JWT/session middleware, RBAC middleware
- [ ] Login page, auth context, protected routes

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
- [ ] `scoringService` with unit-tested weighted math
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

| Milestone | Deliverable | Gate |
| --- | --- | --- |
| M0 | Runnable skeleton | `/api/health` returns ok, DB connects |
| M1 | Auth works end-to-end | Roles enforced in integration tests |
| M2 | Events with custom rubrics | Σ weight validation enforced |
| M3 | Submissions flowing | Teams can submit, judges can read |
| M4 | Judging live | Scorecards + scoring service tested |
| M5 | Results visible | Leaderboard matches hand-computed totals |
| M6 | AI assist enabled | Reports typed, uncertain, overridable |
| M7 | Deep evidence | GitHub analysis with authorization |
| M8 | Production | Deployed, monitored, security checklist done |

See [MILESTONES.md](MILESTONES.md) for the narrative version.

## Related Documents

- [TASKS.md](TASKS.md) — executable task list
- [BACKLOGS.md](BACKLOGS.md) — full feature inventory
- [STEPS.md](STEPS.md) — zero-to-production commands
