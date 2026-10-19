# Milestones — HackJudge AI

Vision-driven milestones. Each milestone has a goal, a concrete deliverable,
and an exit gate. Sequencing detail lives in [ROADMAP.md](ROADMAP.md); tasks in
[TASKS.md](TASKS.md).

## Why Milestones

The vision ([VISION.md](VISION.md)) — fair, evidence-based, consistent
judging with humans in control — is reached in increments. Each milestone
must ship something a hackathon could actually use, however small.

---

## M0 — Runnable Skeleton

- **Goal:** A developer can clone, configure, and run both halves of the
  system.
- **Deliverable:** Express server with `/api/health`, Mongo connection,
  `.env.example`, Vite React client with an Axios client and router shell.
- **Gate:** Health check returns `ok`; client renders; docs describe exact
  steps.

## M1 — Trusted Identities

- **Goal:** Every action belongs to a known user with a known role.
- **Deliverable:** Register/login, bcrypt hashing, JWT/session, RBAC
  middleware, login UI.
- **Gate:** Integration tests prove a judge cannot hit organizer routes and a
  token-less request is rejected.

## M2 — Events With Real Rubrics

- **Goal:** Organizers define what "good" means for *their* hackathon.
- **Deliverable:** Event CRUD, embedded rubric (criteria + weights validated
  to 100%), judge assignment, status flow, rubric editor UI.
- **Gate:** Two events with different rubrics coexist; invalid weights are
  rejected with field-level errors.

## M3 — Submissions Flowing

- **Goal:** Teams can enter the system; judges can read what teams wrote.
- **Deliverable:** Submission model + form (description, problem, solution,
  tech stack, repo/demo/presentation links), assignment-scoped detail view.
- **Gate:** A judge sees only assigned submissions; URL allowlist rejects
  suspicious links.

## M4 — Judging Live

- **Goal:** A judge can score a project consistently and quickly.
- **Deliverable:** Evaluation model, scorecard UI, `scoringService` with
  running totals, draft→submitted workflow, evaluation history.
- **Gate:** Scoring unit tests cover the full formula including rounding;
  hand-computed example (8/10 @ 20% = 16) matches the system.

## M5 — Results Visible

- **Goal:** Organizers see ranked, defensible results.
- **Deliverable:** Leaderboard endpoint + page, tie-breaking, publish gating
  for unpublished scores, CSV export.
- **Gate:** Leaderboard matches independently computed totals for a fixture
  event; unpublished scores are invisible to teams.

## M6 — AI Assist Enabled

- **Goal:** Judges get a well-labeled, cautious first draft of analysis —
  never an authority.
- **Deliverable:** `aiEvaluationService`, `AIAnalysis` collection with typed
  evidence, confidence + limitations, accept-suggestion UI, rate limits,
  failure policy.
- **Gate:** Every suggestion is overridable; every report distinguishes
  verified/claimed/inferred; malformed LLM output is rejected, not stored;
  no key exists in the client bundle.

## M7 — Deep Evidence

- **Goal:** Analysis rests on artifacts, not just prose.
- **Deliverable:** Authorized GitHub repository analysis, presentation and
  document analysis, demo review with evidence linking.
- **Gate:** SSRF allowlist and redirect validation hold in tests; submitted
  code is never executed; team authorization is recorded.

## M8 — Fairness Tooling

- **Goal:** The system actively helps judges catch inconsistency.
- **Deliverable:** Judge-disagreement alerts, AI-generated follow-up
  questions, similarity checks for duplicated submissions.
- **Gate:** An alert fires when judge scores diverge beyond a configured
  threshold; similarity checks produce explainable, evidence-backed flags.

## M9 — Production and Pilot

- **Goal:** A real hackathon runs on HackJudge AI.
- **Deliverable:** Deployed environment, monitoring, security checklist
  complete ([SECURITY.md](SECURITY.md)), accessibility pass, pilot event.
- **Gate:** Pilot completes with judge feedback captured; retrospective
  filed; no critical security findings.

---

## Milestone Principles

- No milestone ships without its gate passing.
- AI milestones (M6–M8) inherit every rule in the AI Evaluation Rules
  ([PROJECT.md](PROJECT.md)).
- A missed gate extends the milestone — it does not get waived to "keep
  schedule". Consistency is the product.

## Related Documents

- [VISION.md](VISION.md) — where this is going
- [ROADMAP.md](ROADMAP.md) — phase sequencing
- [CHANGELOG.md](CHANGELOG.md) — what has actually shipped
