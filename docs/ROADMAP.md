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
- [x] Root `.gitignore` merge + `.env.example` (LICENSE pending)
- [x] Delete stray `config/dns.js` (the `dns` package was never installed —
      Node built-in)

## Phase 0.5 — Architecture + View Overhaul ✅ complete (2026-10-21)

Declared ADR-0013 — rewrite, not patch. Details:
[ARCHITECTURE.md](ARCHITECTURE.md) Part 2.

**Backend (architecture v2):**
- [x] Normalize names: `model/`→`models/`, `genrateToken.js`→`generateToken.js`
      (`controller/`→`controllers/` left as-is — one controller, revisit in Phase 2)
- [x] Central error handler + `catchAsync` wrapper (try/catch boilerplate gone;
      `{error:{code,message}}` shaped in one place)
- [x] Validation middleware layer (zod) before controllers — strict schemas,
      422 `VALIDATION_ERROR`
- [ ] `config/index.js` — validate env at boot (fail fast if `JWT_SECRET` missing)
- [ ] Move `logout` to a real design (Bearer has no server state — document or switch to HttpOnly cookies)
- [ ] Supertest-based tests against exported `app` (no live server needed)

**Frontend (view v2):**
- [x] Design tokens (`styles/tokens.css` — palette/type/spacing/radii/shadows)
- [x] Feature-first structure: `app/`, `features/{auth,shared/api}`, `components/`
      (events/submissions/judging/leaderboard land in their phases)
- [ ] Evidence badge system (Verified / Claimed / Inferred — icon + text)
- [ ] AI-suggested vs judge-entered visual distinction
- [ ] Mobile-first scorecard shell
- [ ] **Fold in reference GitHub project** once link is provided (adopt/adapt/reject → ADRs)

## Phase 1 — Authentication and Roles ✅ complete (2026-10-21)

- [x] User model, register/login endpoints, password hashing (bcryptjs)
- [x] JWT middleware (`protect`) + RBAC middleware (`requireRole`)
- [x] 13 API tests passing (`node --test`)
- [x] Login page, auth context, Axios interceptor, protected routes
- [x] `api` client wired (`VITE_API_URL=http://localhost:3000/api` in
      `frontend/.env` — root, not `src/`)

## Phase 2 — Event Management ✅ complete (2026-10-22)

- [x] Event model with configurable rubric (criteria + weights, Σ = 100%,
      enforced in zod + mongoose + service)
- [x] Event CRUD (organizer), judge assignment, status flow
      (draft → published → closed, with publish/close controls on the card)
- [x] Rubric editor UI with live weight-total display (+ "spread evenly")

## Phase 3 — Project Submissions ✅ complete (2026-10-22)

- [x] Submission model with URL allowlist validation (`http:`/`https:` only)
- [x] Submit/list/detail endpoints with assignment enforcement and
      role-scoped visibility (teams see only their own)
- [x] Submission form with dynamic link rows, edit + withdraw

## Phase 4 — Judging and Scorecards ✅ complete (2026-10-22)

- [x] Evaluation model (one per judge per submission, unique index)
- [x] `services/scoringService.js` with unit-tested weighted math (ADR-0005,
      12 unit tests; `contribution = (score/10) × weight`)
- [x] Draft → submitted workflow (failed submits persist as drafts so no
      work is lost), submit locks scoring
- [x] Scorecard UI with 0–10 sliders, running total, contribution chips

## Phase 5 — Leaderboard and Export ✅ complete (2026-10-22)

- [x] Weighted aggregation and ranking with tie-breakers (average → judged
      count → name → id; unjudged rows last with null rank)
- [x] Results-release gating for unpublished scores (sealed for judges and
      teams until the organizer releases; preview for the organizer)
- [x] Leaderboard page; CSV export (BOM + CRLF, one column per judge)

## Phase 6 — AI Evaluation Assistant ✅ complete (2026-10-23)

- [x] Server-side `aiEvaluationService` (prompts embed rubric + AI rules)
- [x] Evidence typing: verified / claimed / inferred
- [x] Confidence and limitations on every suggestion; judge-override only
- [x] Rate limiting, timeout, schema validation, 503 failure policy
- [x] Report UI with evidence badges and accept-suggestion flow

## Phase 7 — Evidence Depth (GitHub & Documents) ✅ complete (2026-10-27)

- [x] Typed evidence fields (`repositoryUrl` github-only, `demoUrl` https-only,
      private-network literals rejected at the schema)
- [x] Team authorization record — grant/revoke, token validated against GitHub
      before storage, AES-256-GCM vault, fingerprint-only display
- [x] SSRF allowlist + per-hop redirect validation, byte caps, timeouts —
      **submitted code is never executed** (ADR-0012, SECURITY §6)
- [x] Static GitHub inspection: metadata, languages, file-tree stats, README
      excerpt (per-piece degradation to honest notes)
- [x] Document upload (md/txt/csv/pdf/docx/pptx, 20MB) — own zip reader for
      docx/pptx, PDFs stored with an honest "not extracted" note
- [x] Demo liveness checks (server-side, recorded) + judge evidence notes
      linked to rubric criteria (BL-11)
- [x] AI artifacts: server-fetched facts ride into the prompt as
      `<untrusted_repository>/<untrusted_documents>/<untrusted_demo>` blocks

## Phase 7.5 — AI Quality Report Cards ✅ complete (2026-10-27)

- [x] Register screen: role picker spells out **Team / Judge / Event manager**
      with a helper line; role-aware dashboard copy (and the name field no
      longer labelled "judge" for everyone)
- [x] `qaReportService` — five rated dimensions (tech stack, folder
      structure, complexity, documentation, readiness) 1–10, visible errors
      with severity, "how many users it can serve" estimate, overall 1–10;
      strict zod schema, fail-closed storage, mock + real provider
- [x] Stored-artifacts only — an AI request never triggers a live fetch;
      team-authored text rides in `<untrusted_*>` blocks (rules intact)
- [x] Report card UI: team's submission card + judge's scorecard; owning
      team and assigned judge run, organizer reads; inputs + limitations
      printed on the card, 1–10 with typed evidence labels
- [x] Rate-limited 10/user/h; runs stop when judging closes, stored cards
      stay readable

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
| M1 | Auth works end-to-end | Roles enforced in tests | ✅ 2026-10-21 |
| M1.5 | Architecture + view overhaul | v2 layers + feature-first UI landed | ✅ 2026-10-21 |
| M2 | Events with custom rubrics | Σ weight validation enforced | ✅ 2026-10-22 |
| M3 | Submissions flowing | Teams can submit, judges can read | ✅ 2026-10-22 |
| M4 | Judging live | Scorecards + scoring service tested | ✅ 2026-10-22 |
| M5 | Results visible | Leaderboard matches hand-computed totals | ✅ 2026-10-22 |
| M6 | AI assist enabled | Reports typed, uncertain, overridable | ✅ 2026-10-23 |
| M7 | Deep evidence | GitHub analysis with authorization, no code execution | ✅ 2026-10-27 |
| M7.5 | Project rated | Report card: 5 dimensions + errors + capacity, typed, fail-closed | ✅ 2026-10-27 |
| M8 | Production | Deployed, monitored, security checklist done | ⬜ |

See [MILESTONES.md](MILESTONES.md) for the narrative version.

## Related Documents

- [TASKS.md](TASKS.md) — executable task list
- [BACKLOGS.md](BACKLOGS.md) — full feature inventory
- [STEPS.md](STEPS.md) — zero-to-production commands
- [DECISIONS.md](DECISIONS.md) — ADR-0013 (why the overhaul)
