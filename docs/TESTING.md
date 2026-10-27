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
| `ai.test.js` (API) + `ai.unit.test.js` (service) | assigned judge only — team gets route-level 403, unassigned judge 403 `NOT_ASSIGNED`; typed report shape (evidence types, rationale, confidence 0–1); GET returns latest; rate limit 429 `RATE_LIMITED`; `EVENT_CLOSED` after close; unit: ten rules in prompt, untrusted-block injection containment, strict schema rejects malformed output (nothing stored), no key → fail-closed 503, mock is deterministic |
| `evidence.test.js` (API) + `evidence.unit.test.js` (service) | SSRF gates at the schema (metadata IP, private-host literals, non-github repo → 422); grant records authorization leak-free; bogus GitHub token → 400 `TOKEN_REJECTED` before storage; stranger 404/403; insight fetch on octocat/Hello-World; revoke → 409 `GRANT_REVOKED` → re-grant; upload md → text extracted, sha256 dedupe, download bytes exact + `nosniff`, 413 size / 422 type caps, judge-upload 403; demo check reachable+title, `NO_DEMO_URL`; evidence CRUD with criterion normalization (`impact`→`Impact`), `UNKNOWN_CRITERION`, role gating (assigned judge writes, organizer reads all, team 403); live AI with artifacts; unit: SSRF address matrix, redirect hops, byte caps, timeouts with injected lookup/fetch, token vault roundtrip/tamper, crafted-zip docx/pptx extraction, downloadName safety, README-injection containment in artifact blocks |

## 5. AI Evaluation Tests

- [x] Prompt includes the event rubric and all ten AI Evaluation Rules
      (unit: every rule asserted verbatim in the system prompt)
- [x] External content is wrapped in untrusted delimiters; prompt-injection
      sample (e.g. repo README containing "ignore previous instructions") is
      contained inside the data block, never a system instruction
      (unit: payload asserted present inside the block, absent outside it)
- [x] Response fails closed: schema-invalid output is rejected, not stored
      (unit: strict zod schema — bad enum, missing/unknown criterion, extra
      field, out-of-range score, missing limitations → 503 `AI_BAD_OUTPUT`;
      controller persists only after validation passes)
- [x] Every `suggestedScores` entry has rationale and confidence
- [x] Evidence entries carry only allowed types:
      `verified-evidence | team-claim | ai-inference`
- [x] Missing data produces an "unknown" note, not a low suggested score
      (unit: bare submission — floors hold ≥ 3, gap named in limitations)
- [x] Suggested scores never write to `Evaluation.criterionScores` without an
      explicit judge action (test at API and UI level)
      (API: analysis endpoints never touch Evaluation; UI journey: "use this
      score" prefills the slider behind a confirm, judge submits their own
      final numbers)
- [x] No `LLM_API_KEY` present in any client build artifact
      (dist bundle grep gate: no key names, provider URLs, or model IDs)
- [x] Server-fetched artifacts arrive in their own untrusted blocks and the
      model cannot be steered by them (unit: a README saying "IGNORE ALL
      RULES" stays inside `<untrusted_repository>`, never reaches the system
      prompt); mock rows mark github/demo facts `verified-evidence`,
      uploads `team-claim`
- [x] An AI request never triggers a live network fetch — artifacts come
      from stored reads only (`loadArtifacts` reads RepositoryInsight /
      SubmissionDocument / DemoCheck)

## 6. Security Testing

- [ ] AuthZ matrix: every route × every role (allow/deny table from
      [SECURITY.md](SECURITY.md))
- [x] SSRF suite: private IPs, link-local, metadata endpoints, redirect
      chains, oversized responses
      (`evidence.unit.test.js`: address matrix incl. IPv4-mapped IPv6 +
      CGNAT, allowlist/port/protocol refusals, DNS-to-private refusal,
      redirect-off-allowlist refusal, redirect-to-private refusal, redirect
      loop cap, byte-cap `RESPONSE_TOO_LARGE`, abort timeout — all with
      injected lookup/fetch, no network in CI)
- [x] Rate limits trigger on AI endpoints (10/h per judge, asserted);
      repo-insight/demo (20/h) and uploads (30/h) metered the same way
- [ ] Oversized JSON body rejected
- [ ] Stack traces absent from production error responses
- [ ] `npm audit` gate on CI (fail on high/critical)

## 7. Frontend Tests

- [ ] Login flow: success, failure, token persistence, logout on 401
- [ ] Rubric editor: live total updates; publish disabled unless Σ = 100%
- [x] Scorecard: running total matches `scoringService` for the same inputs
      (UI journey asserts hand math: 9→54, +7→82, 5+5→50)
- [x] AI report: evidence badges render with **text labels** (not color alone)
      (journey asserts `.ai-ev-type` contents: "✓ verified" / "◆ claimed")
- [x] Accept-suggestion requires explicit confirmation
      (journey: dialog fires before the slider moves; override after accept
      still wins)
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

### Current reality (2026-10-27)

- **Runner in use:** Node's built-in `node --test` (ADR-0014). Script:
  `node --test "tests/*.test.js"` (**must be quoted**; bare directory args
  crash on Node 24).
- **Live suites** (server on :3000 + real DB): `auth` 13, `event`,
  `submission`, `evaluation`, `leaderboard`, `ai` (6), `evidence` (22 —
  includes one live AI call and GitHub's public API).
- **Unit suites:** `scoring.unit` (12), `ai.unit` (18), `scoring`… plus
  `evidence.unit` (37 — safeFetch, token vault, zip extraction, artifact
  prompts; zero network).
- **UI journey:** `e2e/ui-journey.mjs` — **126 browser checks** across all
  four roles, incl. the Phase 7 evidence bench + evidence panel.
- **External budgets when running everything:** GitHub's unauthenticated
  API is 60/h per IP (set `GITHUB_TOKEN` to lift) and the live LLM pools
  throttle in windows — probe first, run the AI tests inside a window.
- **Known gap:** live tests leave `test+…` users/events behind — teardown
  when supertest + exported `app` lands.

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
