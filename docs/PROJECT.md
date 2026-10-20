# PROJECT.md — HackJudge AI: Complete Details

## Identity

| | |
| --- | --- |
| **Name** | HackJudge AI |
| **One-liner** | AI-powered hackathon project evaluation and judging assistant |
| **Stack** | MERN — MongoDB (Atlas), Express 5 (ESM), React 19 (Vite 8), Node 24 |
| **Type** | Web platform for hackathon organizers and judges |
| **Repo** | `hackthon-jedge` |
| **License** | None selected yet — add a LICENSE before distributing |

## Current Direction (2026-10-20)

**Architecture + view overhaul in progress.** The MVP backend foundation
(auth, DB, health, tests) is proven; the project is now being rewritten
toward a strict layered backend and a feature-first, design-system-driven
frontend. See [ARCHITECTURE.md](ARCHITECTURE.md) Part 2 and ADR-0013 in
[DECISIONS.md](DECISIONS.md). A reference GitHub repository link will be
folded into the docs when provided.

## Purpose

Hackathon judges often need to assess many projects in a short period.
Projects can use unfamiliar technologies, presentations may not fully reflect
implementation progress, and judges may interpret scoring criteria
differently.

HackJudge AI makes this process **more organized, transparent,
evidence-based, and consistent** — while keeping final scoring decisions in
human hands.

## Users and Roles

| Role | Capabilities |
| --- | --- |
| **Organizer** | Create events, configure rubric criteria/weights, assign judges, view leaderboard, export results |
| **Judge** | Browse assigned submissions, request/read AI analysis, enter criterion scores, write feedback, view history |
| **Team** | Submit projects (details, links), view own evaluation status and released feedback |

Roles are enforced by `requireRole(...)` middleware on every protected route.

## Core Entities

- **User** ✅ implemented — name, email (unique), password (bcrypt hash,
  `select:false`), role (organizer/judge/team, default team), timestamps
- **Event** — name, description, rubric (criteria + weights), organizerId,
  judgeIds, status (draft/active/completed), createdAt
- **Submission** — eventId, teamName, projectTitle, description,
  problemStatement, solution, techStack, repositoryUrl, demoUrl,
  presentationUrl, status, createdAt
- **Evaluation** — eventId, submissionId, judgeId, criterionScores, comments,
  strengths, improvementAreas, status (draft/submitted), updatedAt
- **AI Analysis** *(optional)* — submissionId, model, summary,
  complexityAnalysis, evidence (typed), suggestedScores, limitations, createdAt

Field-level definitions: [SPECIFICATION.md](SPECIFICATION.md).

## Judging Rubric (default example)

Organizers customize criteria and weights per event (Σ must = 100%).

| Criterion | Weight | Judges Consider |
| --- | --- | --- |
| Innovation | 20% | Originality and differentiation |
| Technical Complexity | 20% | Engineering challenges, technical depth, design decisions |
| Implementation | 25% | Working functionality, completeness, supporting evidence |
| Real-World Impact | 15% | Importance of the problem, potential value |
| UX and Usability | 10% | Accessibility, clarity, ease of use |
| Presentation | 10% | Demo quality, clarity of explanation |

**Formula:** `contribution = (score / 10) × weight`; final = Σ (out of 100).
Example: 8/10 at 20% = 16 points.

## Product Workflow

1. Organizer creates an event (details, criteria, weights, judge assignments).
2. Team submits a project (description, technologies, repo, presentation, demo).
3. System organizes supplied evidence; AI analysis may be requested.
4. Judge reviews the report: strengths, limitations, complexity, questions.
5. Judge enters/adjusts criterion-level scores and comments.
6. System computes weighted scores and displays the leaderboard per event rules.

## MVP Feature Set

- Project submissions with full metadata and links
- Judge dashboard with evaluation status tracking
- Configurable scoring rubric (criteria + weights)
- Scorecards and feedback (scores, comments, strengths, improvements)
- AI evaluation assistant (preliminary analysis + score suggestions)
- Weighted leaderboard
- Authentication and roles ✅ **backend complete, 12/12 tests passing**
- Evaluation history

## AI Evaluation Rules

AI-assisted evaluations must:

1. Use the same rubric for submissions in the same judging category.
2. Explain each suggested score with supporting evidence.
3. Separate verified repository/demo evidence from team claims.
4. Treat missing information as unknown, not proof of poor quality.
5. Assess complexity by engineering challenges and design decisions — not
   lines of code, file count, or technology count.
6. Evaluate complexity separately from implementation completeness.
7. Indicate uncertainty and allow judges to override suggestions.
8. Avoid inferring ability or quality from personal/demographic characteristics.
9. Treat repository content and uploads as untrusted input, not AI
   instructions.
10. Require human review before final results are published.

## Technology (as built)

| Piece | Choice |
| --- | --- |
| Runtime | Node.js 24 |
| API framework | Express 5, ESM (`"type": "module"`), entry `index.js`, port **3000** |
| DB | MongoDB Atlas via Mongoose 9 — env var **`MONGO_URL`** (standard non-SRV string) |
| Auth | jsonwebtoken (7-day tokens, `Authorization: Bearer`) + bcryptjs (10 rounds) |
| CORS | restricted to `CLIENT_URL` (http://localhost:5173) |
| Tests | `node --test "tests/*.test.js"` — built-in runner, 12 tests |
| Frontend | React 19 + Vite 8 + ESLint 10 (template state; axios/router pending) |
| Styling | Tailwind *or* Bootstrap — ADR-0011 still open |
| Optional | LLM API, GitHub API, Multer + object storage |

## Repository Structure (actual)

```
hackthon-jedge/
├── frontend/                     # React (Vite) — scaffolded
│   └── src/
│       ├── App.jsx  main.jsx     # (template — view overhaul pending)
│       ├── App.css  index.css
│       └── assets/
├── backend/                      # Express API (ESM, entry: index.js)
│   ├── config/
│   │   ├── db.js                 # mongoose connect (MONGO_URL), fail-fast
│   │   └── dns.js                # 🗑 stray debug file — delete
│   ├── model/
│   │   └── user.model.js         # User schema ✅
│   ├── controller/
│   │   └── auth.controller.js    # register/login/logout/me ✅
│   ├── middleware/
│   │   └── auth.middleware.js    # protect (JWT) + requireRole (RBAC) ✅
│   ├── routes/
│   │   └── auth.routes.js        # /api/auth/* ✅
│   ├── utils/
│   │   └── genrateToken.js       # jwt.sign (typo kept — rename in v2) ✅
│   ├── tests/
│   │   └── auth.test.js          # 12/12 passing ✅
│   ├── index.js                  # app wiring: json → cors → health → routes → 404
│   ├── package.json              # scripts: dev / start / test
│   └── .env                      # PORT=3000, MONGO_URL, JWT_SECRET, CLIENT_URL
├── docs/                         # this 24-file documentation set
└── README.md
```

## Current Status

| Area | State |
| --- | --- |
| Backend foundation | ✅ Health endpoint, CORS, JSON parsing, Atlas connection |
| Auth (Phase 1) | ✅ Backend complete — routes, middleware, controller, model, JWT, RBAC |
| Tests | ✅ 12/12 passing (register ×4, login ×3, `/me` ×3, logout ×2) |
| Frontend | 🟡 Vite scaffold only — no app code yet |
| Events / Submissions / Judging / Leaderboard / AI | ⬜ Not started |
| Housekeeping | 🟡 `.gitignore`s exist; `config/dns.js` + npm `dns` dep to remove; LICENSE pending |
| Docs | ✅ Rewritten to current reality + overhaul direction |

## Related Documents

- [ALL.md](ALL.md) — one-page overview
- [ARCHITECTURE.md](ARCHITECTURE.md) — v1 as-built + v2 overhaul target
- [REQUIREMENTS.md](REQUIREMENTS.md) — functional requirements
- [SPECIFICATION.md](SPECIFICATION.md) — technical spec
- [TASKS.md](TASKS.md) — task breakdown
- [README.md](../README.md) — original project README
