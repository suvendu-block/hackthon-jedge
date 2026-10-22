# Testing Strategy — HackJudge AI

Testing goals, tooling, and coverage targets. The product's value is
*consistency* — so the scoring math and authorization rules get the hardest
tests.

## 1. Objectives

1. The weighted score formula is provably correct and identical everywhere.
2. Authorization is provably enforced (judge ≠ organizer ≠ team).
3. AI reports are provably well-formed, labeled, and never auto-applied.
4. Regressions are caught before they reach an event.

## 2. Test Layers

| Layer | Scope | Tooling (suggested) |
| --- | --- | --- |
| Unit | Pure functions: scoring, validators, prompt builders | Node test runner / Jest |
| Integration | API routes against an in-memory or test MongoDB | Supertest + Jest/Mocha + mongodb-memory-server |
| Component | React pages/components in isolation | Vitest + React Testing Library |
| E2E | Full flows in a browser | Cypress or Playwright |
| Security | AuthZ matrix, SSRF, rate limits, input validation | Supertest suites + manual checklist |
| AI-specific | Prompt construction, response validation, labeling | Unit + recorded fixtures |

Run everything in CI on each pull request (BL-22).

## 3. Unit Tests — Scoring (highest priority)

`backend/services/scoringService.test.js`

- [ ] Single criterion: 8/10 at 20% → 16.00
- [ ] Full default rubric (20/20/25/15/10/10) with all 10s → 100.00
- [ ] All zeros → 0.00
- [ ] Rounding boundaries: e.g. 7/10 at 15% → 10.50; 3/10 at 10% → 3.00
- [ ] Sum of contributions equals reported total (property test over random
      valid rubrics and scores)
- [ ] Non-100% rubric rejected before computation
- [ ] Score out of range (−1, 11) rejected
- [ ] Missing criterion score rejected
- [ ] Deterministic: same input twice → identical output (NFR-7)
- [ ] Tie-breaking: equal totals resolve per SPEC §5

## 4. Integration Tests — API

| Suite | Key cases |
| --- | --- |
| `auth.test.js` | register success; duplicate email 409; weak password 422; login success/invalid creds; token required; role middleware blocks wrong role |
| `events.test.js` | organizer creates event; non-organizer 403; rubric Σ≠100 rejected; membership-scoped listing; status transitions |
| `submissions.test.js` | team submits to active event; closed event rejected; judge sees only assigned; URL allowlist rejects `http://169.254.169.254`; team edits own only |
| `evaluations.test.js` | draft save; submit transition; one eval per judge per submission (409); auto-computed total present; score range enforced |
| `leaderboard.test.js` | ranking order + hand-checked averages; draft evaluations excluded; standings sealed for teams **and** judges pre-release; organizer preview; release rules (owner-only, closed-only, once-only); status locked after release; CSV shape + gating |
| `aiAnalysis.test.js` | assigned judge only; non-assigned 403; rate limit 429; malformed LLM response → 503, nothing stored; stored report has evidence types |

## 5. AI Evaluation Tests

- [ ] Prompt includes the event rubric and all ten AI Evaluation Rules
- [ ] External content is wrapped in untrusted delimiters; prompt-injection
      sample (e.g. repo README containing "ignore previous instructions") is
      contained inside the data block, never a system instruction
- [ ] Response fails closed: schema-invalid output is rejected, not stored
- [ ] Every `suggestedScores` entry has rationale and confidence
- [ ] Evidence entries carry only allowed types:
      `verified-evidence | team-claim | ai-inference`
- [ ] Missing data produces an "unknown" note, not a low suggested score
- [ ] Suggested scores never write to `Evaluation.criterionScores` without an
      explicit judge action (test at API and UI level)
- [ ] No `LLM_API_KEY` present in any client build artifact

## 6. Security Testing

- [ ] AuthZ matrix: every route × every role (allow/deny table from
      [SECURITY.md](SECURITY.md))
- [ ] SSRF suite: private IPs, link-local, metadata endpoints, redirect
      chains, oversized responses
- [ ] Rate limits trigger on `/auth/*` and AI endpoints
- [ ] Oversized JSON body rejected
- [ ] Stack traces absent from production error responses
- [ ] `npm audit` gate on CI (fail on high/critical)

## 7. Frontend Tests

- [ ] Login flow: success, failure, token persistence, logout on 401
- [ ] Rubric editor: live total updates; publish disabled unless Σ = 100%
- [x] Scorecard: running total matches `scoringService` for the same inputs
      (UI journey asserts hand math: 9→54, +7→82, 5+5→50)
- [ ] AI report: evidence badges render with **text labels** (not color alone)
- [ ] Accept-suggestion requires explicit confirmation
- [x] Unpublished leaderboard hidden from team role (and judges — sealed
      screen asserted for both; organizer preview + release + CSV download
      all walked in the UI journey)
- [ ] Keyboard-only navigation through the scoring flow; ARIA labels present

## 8. Test Data and Fixtures

- One fixture event `Demo Hack 2026` with the default rubric.
- Three teams with known hand-computed expected totals (document the expected
  values in the fixture README).
- Two judges, one deliberately divergent — to exercise disagreement alerts
  later.
- A malicious fixture submission containing prompt-injection text and
  suspicious URLs.

## 9. Coverage Targets

| Area | Target |
| --- | --- |
| `services/scoringService` | 100% branch coverage |
| `services/aiEvaluationService` | ≥ 90% (excluding live LLM calls; mock the provider) |
| Route handlers + middleware | ≥ 85% |
| Overall backend | ≥ 80% |
| Critical UI flows | E2E smoke on every release |

**Never hit a live LLM API in CI** — use recorded fixtures or a mock provider.

### Current reality (2026-10-20)

- **Runner in use:** Node's built-in `node --test` (ADR-0014) — no framework
  installed yet. Script: `node --test "tests/*.test.js"` (**must be quoted**;
  bare directory args crash on Node 24).
- **Live suite:** `backend/tests/auth.test.js` — **12/12 passing** against a
  running server + real Atlas DB (register ×4, login ×3, `/me` ×3,
  logout ×2), including assertions that `password`/`passwordHash` never
  appear in responses.
- **Known gap:** tests require `npm run dev` running and leave
  `test+<timestamp>@example.com` users in Atlas — fixed when Phase 0.5 adds
  supertest + an exported `app` + teardown.
- Coverage targets above are aspirational; scoring unit tests start in
  Phase 4.

## 10. Definition of Done for a Feature

1. Unit/integration tests written and passing.
2. Authorization covered by an explicit deny test.
3. No secrets logged or returned in responses.
4. Docs updated ([CHANGELOG.md](CHANGELOG.md), related doc files).
5. CI green.

## Related Documents

- [REQUIREMENTS.md](REQUIREMENTS.md) — what is being verified
- [SECURITY.md](SECURITY.md) — security test checklist
- [TASKS.md](TASKS.md) — test tasks per workstream
