# Tasks — HackJudge AI

Actionable task breakdown grouped by workstream. Each task maps to backlog
items (`BL-xx`) and requirements (`FR-x`). Check tasks off as they complete and
record the change in [CHANGELOG.md](CHANGELOG.md).

## Workstream 0 — Project Setup ✅ done (2026-10-19/20)

- [x] Root `.gitignore` (per-app `.gitignore`s exist in `backend/` + `frontend/`;
      root-level merge still open)
- [ ] Add `LICENSE` (decision needed — none selected yet) *(BL-32)*
- [ ] Add ESLint + Prettier to backend and frontend *(BL-23; ESLint ships
      with the Vite template in `frontend/` — config backend separately)*
- [x] `backend/index.js` with Express app, CORS (`CLIENT_URL`), JSON limit,
      health route `GET /api/health` *(BL-16)*
- [x] Backend scripts: `start` (node index.js), `dev` (nodemon index.js),
      `test` (`node --test "tests/*.test.js"` — **quoted glob required**)
- [x] `backend/config/db.js` — Mongoose connection from **`MONGO_URL`**
      (standard non-SRV string; SRV blocked by local DNS)
- [ ] Create `backend/.env.example` documenting required variables
- [x] Frontend scaffolded: `npm create vite@latest frontend -- --template react`
      (React 19 + Vite 8 + ESLint)
- [ ] Install client deps: axios, react-router-dom
- [ ] Create `frontend/src/api/client.js` Axios instance + Bearer
      interceptor *(SPEC §7)*
- [ ] Choose styling framework: Tailwind **or** Bootstrap, record in
      ADR-0011
- [x] Add `JWT_SECRET` + `CLIENT_URL` to `.env`
- [ ] Housekeeping: delete `config/dns.js`, `npm uninstall dns`

## Workstream 0.5 — Architecture + View Overhaul (ADR-0013)

- [ ] Normalize names (`models/`, `controllers/`, `generateToken.js`)
- [ ] Central error handler + `asyncHandler` wrapper
- [ ] Validation middleware (zod) before controllers
- [ ] `config/index.js` fail-fast env validation at boot
- [ ] Frontend feature-first layout + design tokens + `components/ui/`
- [ ] Evidence badges + AI-suggested styling (visual contract)
- [ ] Supertest against exported `app` (no live server needed)
- [ ] Fold in reference GitHub repo (adopt/adapt/reject → ADRs)

## Workstream 1 — Authentication and Roles *(FR-1…FR-3)* 🟡 backend done

- [x] `User` model: name, email (unique), **password** (bcrypt hash,
      `select:false`), role enum, timestamps — `model/user.model.js`
- [x] bcrypt (bcryptjs) hashing on register (10 rounds)
- [x] `POST /api/auth/register` with validation (required fields, password
      ≥ 8 chars, duplicate email → 400)
- [x] `POST /api/auth/login` issuing JWT (7-day expiry, Bearer)
- [x] Auth middleware: `protect` verifies token, attaches `req.user`
- [x] RBAC middleware: `requireRole("organizer" | "judge" | "team")`
- [ ] Rate limit `/api/auth/*` *(NFR-3)*
- [ ] Client: Login page, token storage, Axios auth interceptor, 401 handling
- [ ] Client: auth context + protected routes
- [x] Tests: register/login happy path, duplicate email, bad password,
      token required, garbage token — **12/12 passing** (`tests/auth.test.js`)
- [ ] Tests: role enforcement (requireRole deny matrix)

## Workstream 2 — Events and Rubric *(FR-4…FR-7)*

- [ ] `Event` model with embedded rubric and Σ weight === 100 validator
- [ ] `POST /api/events` (organizer only)
- [ ] `GET /api/events` scoped to the current user's visibility
- [ ] `GET /api/events/:eventId`
- [ ] Event status transitions: draft → active → completed
- [ ] Assign/unassign judges (organizer only)
- [ ] Client: event creation form with rubric editor (criterion + weight rows,
      live total display)
- [ ] Client: event list view
- [ ] Tests: rubric weight validation, role restrictions, membership scoping

## Workstream 3 — Submissions *(FR-8…FR-11)*

- [ ] `Submission` model with URL validation and host allowlist *(NFR-5)*
- [ ] `POST /api/events/:eventId/submissions` (team; event must be active)
- [ ] `GET /api/events/:eventId/submissions` (assigned judge / organizer)
- [ ] `GET /api/submissions/:submissionId` with ownership/assignment checks
- [ ] Team edit-submission until close
- [ ] Client: submission form (all fields, links, tech stack chips)
- [ ] Client: ProjectDetails page (evidence summary view)
- [ ] Tests: assignment enforcement, URL allowlist rejection

## Workstream 4 — Judging and Scoring *(FR-12…FR-15, FR-14)*

- [ ] `Evaluation` model: criterionScores, comments, strengths,
      improvementAreas, status, unique (submissionId, judgeId)
- [ ] `scoringService.js`: `(score/10) × weight`, 2-decimal rounding, sum
      *(ADR-0005, SPEC §5)*
- [ ] `POST /api/submissions/:submissionId/evaluations` (draft save)
- [ ] Submit-draft → `submitted` transition
- [ ] Evaluation history recording *(FR-15, BL-08)*
- [ ] Client: JudgeEvaluation scorecard (sliders/inputs per criterion,
      auto-computed running total, strengths/improvements text areas)
- [ ] Tests: **unit tests for scoring math**, draft exclusion, one-eval-per-
      judge rule

## Workstream 5 — Leaderboard *(FR-21…FR-23)*

- [ ] `GET /api/events/:eventId/leaderboard` — aggregate submitted
      evaluations, average per submission, rank
- [ ] Tie-breaking per SPEC §5
- [ ] Results-release gate: hide unpublished scores until organizer publishes
      *(FR-23)*
- [ ] Client: Leaderboard page with rank, team, project, weighted total
- [ ] CSV export of results *(FR-24, BL-15)*
- [ ] Tests: ranking order, draft exclusion, publish gating

## Workstream 6 — AI Evaluation Assistant *(FR-16…FR-20)*

- [ ] `AIAnalysis` collection with evidence type labels *(ADR-0008/0009)*
- [ ] `aiEvaluationService.js`: prompt builder embedding rubric + AI rules
- [ ] Untrusted-content framing for repo/document text *(FR-20, NFR-5)*
- [ ] LLM call with timeout, retry, response schema validation
- [ ] `POST /api/submissions/:submissionId/ai-analysis` (assigned judge,
      rate-limited)
- [ ] Store limitations and confidence; never auto-fill judge scores
      *(FR-18, FR-19)*
- [ ] Client: "Request AI analysis" action, loading state, report view with
      evidence badges (Verified / Claimed / Inferred)
- [ ] Client: accept-suggestion button per criterion (explicit judge action)
- [ ] Tests: schema validation, judge-only access, no-execution guarantee,
      error handling (503 on LLM failure)

## Workstream 7 — Hardening and Launch *(NFR-1…NFR-9, BL-17…BL-31)*

- [ ] Input validation/sanitization pass on every endpoint *(BL-17)*
- [ ] CORS production allowlist *(BL-19, NFR-2)*
- [ ] Rate limits on AI endpoints *(BL-18)*
- [ ] Security headers (helmet), HTTPS enforcement *(NFR-6)*
- [ ] Accessibility pass: keyboard nav, ARIA labels, contrast *(BL-31)*
- [ ] Responsive layout check for judge dashboard *(BL-30)*
- [ ] Privacy policy page *(BL-33)*
- [ ] Deployment: Atlas + Render/Railway + Vercel/Netlify (see
      [DEPLOYMENTS.md](DEPLOYMENTS.md))
- [ ] Production env audit: no secrets client-side *(NFR-1)*
- [ ] End-to-end smoke test: event → submission → AI → score → leaderboard

## Workstream 8 — Advanced Features (post-MVP)

- [ ] GitHub repository analysis with team authorization *(BL-09)*
- [ ] Presentation and document analysis *(BL-10)*
- [ ] Demo review and evidence linking *(BL-11)*
- [ ] Judge disagreement alerts *(BL-12, FR-25)*
- [ ] AI-generated questions for teams *(BL-13)*
- [ ] Similarity checks for duplicate submissions *(BL-14)*
- [ ] Audit log of rubric/score changes *(BL-35)*

## Related Documents

- [BACKLOGS.md](BACKLOGS.md) — feature inventory
- [ROADMAP.md](ROADMAP.md) — time sequencing
- [TESTING.md](TESTING.md) — test detail per workstream
