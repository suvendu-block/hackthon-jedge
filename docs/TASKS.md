# Tasks — HackJudge AI

Actionable task breakdown grouped by workstream. Each task maps to backlog
items (`BL-xx`) and requirements (`FR-x`). Check tasks off as they complete and
record the change in [CHANGELOG.md](CHANGELOG.md).

## Workstream 0 — Project Setup

- [ ] Add root `.gitignore` (Node, env files, build output, OS files)
- [ ] Add `LICENSE` (decision needed — none selected yet) *(BL-32)*
- [ ] Add ESLint + Prettier to backend and frontend *(BL-23)*
- [ ] Create `backend/server.js` with Express app, CORS, JSON limit, health
      route `GET /api/health` *(BL-16)*
- [ ] Add backend scripts: `start` (node server.js), `dev` (nodemon server.js)
- [ ] Create `backend/config/db.js` — Mongoose connection from `MONGODB_URI`
- [ ] Create `backend/.env.example` documenting required variables
- [ ] Scaffold frontend: `npm create vite@latest client -- --template react`
- [ ] Install client deps: axios, react-router-dom
- [ ] Create `client/src/api.js` Axios instance *(SPEC §7)*
- [ ] Choose styling framework: Tailwind **or** Bootstrap, record in
      ADR-0011

## Workstream 1 — Authentication and Roles *(FR-1…FR-3)*

- [ ] `User` model: name, email (unique), passwordHash, role, createdAt
- [ ] Install bcrypt; implement password hashing on register
- [ ] `POST /api/auth/register` with validation (email format, unique,
      password ≥ 8 chars)
- [ ] `POST /api/auth/login` issuing JWT (or secure session)
- [ ] Auth middleware: verify token, attach `req.user`
- [ ] RBAC middleware: `requireRole("organizer" | "judge" | "team")`
- [ ] Rate limit `/api/auth/*` *(NFR-3)*
- [ ] Client: Login page, token storage, Axios auth interceptor, 401 handling
- [ ] Client: auth context + protected routes
- [ ] Tests: register/login happy path, duplicate email, bad password, role
      enforcement

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
