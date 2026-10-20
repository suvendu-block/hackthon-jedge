# ALL.md — All About HackJudge AI

One-page overview of the entire project — **including where it actually
stands and where it's being rebuilt toward.** Every other document in
`docs/` goes deeper; this file is the map.

## What It Is

**HackJudge AI** is an AI-powered hackathon project evaluation and judging
assistant built with the MERN stack. It helps hackathon judges evaluate
submissions more consistently by organizing project information, analyzing
available evidence, and providing structured scoring recommendations.

It **supports human judges — it does not replace their final decisions.**

## Where It Stands (2026-10-20)

| Area | Reality |
| --- | --- |
| Backend | ✅ Runnable: Express 5 (ESM, `index.js`, port **3000**), Atlas DB connected, `/api/health` green |
| Auth | ✅ Implemented end-to-end: register/login/logout/me, bcryptjs, JWT (7d), `protect` + `requireRole` middleware |
| Tests | ✅ **12/12 passing** (`node --test "tests/*.test.js"`) |
| Frontend | 🟡 Vite + React 19 scaffolded (`frontend/`) — still template screens; no `api.js`, no login UI yet |
| Events / Submissions / Judging / AI | ⬜ Not started (Phases 2–6) |
| Docs | ✅ This 24-file set, rewritten to current reality |

## The Big Move Right Now: Architecture + View Overhaul

The project is being **rewritten, not patched** — two tracks
([DECISIONS.md](DECISIONS.md) ADR-0013, [ARCHITECTURE.md](ARCHITECTURE.md)
Part 2):

1. **Architecture v2** — strict 5-layer backend pipeline (routes →
   controllers → services → models → central error handler), validation
   middleware, config module, normalized names (`models/`, `generateToken.js`).
2. **View v2 (UI)** — feature-first frontend (`features/auth`,
   `features/judging`, …), design-system components, design tokens, evidence
   badge language (Verified / Claimed / Inferred), AI-vs-judge visual
   distinction, mobile-first scorecard.

> 📎 **Reference slot:** a GitHub reference repository link will be dropped
> into [ARCHITECTURE.md](ARCHITECTURE.md) Part 2 when provided — the docs
> will be reconciled against it (adopt / adapt / reject, each recorded as an
> ADR).

## The Problem

Hackathon judges must assess many projects in a short time. Projects use
unfamiliar technologies, presentations may not reflect implementation
progress, and judges interpret scoring criteria differently — producing
inconsistent, opaque scoring.

## The Goals

- Reduce the time required to review each submission.
- Separate technical complexity from implementation quality.
- Provide clear explanations for suggested scores.
- Apply a consistent, configurable rubric to every team.
- Help judges identify missing evidence and ask useful follow-up questions.
- Keep final scoring decisions in the hands of human judges.

## Who It Serves

| Role | What they do |
| --- | --- |
| Organizer | Creates events, sets rubric criteria and weights, assigns judges |
| Judge | Reviews assigned submissions, reads AI analysis, scores projects |
| Team | Submits project details, repository, presentation, and demo links |

## Core Features (MVP)

- Project submissions (title, description, problem, solution, tech stack, team, links)
- Judge dashboard with evaluation status tracking
- Configurable scoring rubric (criteria + weights per event)
- Scorecards and feedback (criterion scores, comments, strengths, improvements)
- AI evaluation assistant with preliminary analysis and score suggestions
- Weighted leaderboard
- Authentication with organizer / judge / team roles ✅ *(backend done)*
- Evaluation history

Full inventory with priorities: [BACKLOGS.md](BACKLOGS.md).

## The Rubric (Example)

| Criterion | Weight | What Judges Consider |
| --- | --- | --- |
| Innovation | 20% | Originality and differentiation |
| Technical Complexity | 20% | Engineering challenges, technical depth, design decisions |
| Implementation | 25% | Working functionality, completeness, supporting evidence |
| Real-World Impact | 15% | Importance of the problem and potential value |
| UX and Usability | 10% | Accessibility, clarity, ease of use |
| Presentation | 10% | Demo quality and clarity of explanation |

Scoring: `(criterion score / 10) × weight`, summed to 100. An 8/10 on a 20%
criterion contributes 16 points.

## How It Works

1. **Create an event** — organizer sets details, criteria, weights, judges.
2. **Submit a project** — team adds description, tech, repo, presentation, demo.
3. **Analyze** — the system organizes evidence and may request AI analysis.
4. **Review the report** — strengths, limitations, complexity, questions.
5. **Score** — judge enters or adjusts criterion-level scores and comments.
6. **Calculate results** — weighted scores and leaderboard per event rules.

## Tech Stack (as actually used)

- **Node 24 LTS** · **Express 5** (ESM) · **Mongoose 9** · **MongoDB Atlas**
- bcryptjs (hashing) · jsonwebtoken (JWT) · cors · dotenv · nodemon
- **React 19 + Vite 8** (ESM), ESLint 10 — axios + react-router-dom to be added
- Testing: **node:test built-in runner** (zero deps; supertest planned)
- Optional: LLM API, GitHub API, Tailwind *or* Bootstrap (ADR-0011 pending)

## Repository Layout (actual)

```
hackthon-jedge/
├── frontend/                 # React (Vite) — scaffolded, template UI
│   └── src/  App.jsx, main.jsx, index.css, App.css, assets/
├── backend/                  # Express API (ESM, entry: index.js, port 3000)
│   ├── config/               # db.js  (dns.js = stray, delete)
│   ├── model/                # user.model.js
│   ├── controller/           # auth.controller.js
│   ├── middleware/           # auth.middleware.js (protect, requireRole)
│   ├── routes/               # auth.routes.js
│   ├── utils/                # genrateToken.js
│   ├── tests/                # auth.test.js — 12 passing
│   ├── index.js
│   └── .env                  # PORT, MONGO_URL, JWT_SECRET, CLIENT_URL
├── docs/                     # this documentation set
└── README.md
```

## Document Index

| File | Covers |
| --- | --- |
| [PROJECT.md](PROJECT.md) | Complete project details |
| [VISION.md](VISION.md) | Long-term vision |
| [MILESTONES.md](MILESTONES.md) | Vision and milestones |
| [ROADMAP.md](ROADMAP.md) | Development roadmap |
| [TASKS.md](TASKS.md) | Task breakdown |
| [BACKLOGS.md](BACKLOGS.md) | Every feature |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Functional requirements |
| [SPECIFICATION.md](SPECIFICATION.md) | Technical specification |
| [ARCHITECTURE.md](ARCHITECTURE.md) | v1 (as-built) + v2 (overhaul target) |
| [OPERATIONS.md](OPERATIONS.md) | Service architecture |
| [PRINCIPLES.md](PRINCIPLES.md) | Design principles |
| [DECISIONS.md](DECISIONS.md) | Architecture decisions incl. ADR-0013 |
| [STEPS.md](STEPS.md) | Zero to production |
| [DEPLOYMENTS.md](DEPLOYMENTS.md) | Deployment guide |
| [TESTING.md](TESTING.md) | Testing strategy |
| [SECURITY.md](SECURITY.md) | Security policies |
| [PRIVACY.md](PRIVACY.md) | Privacy policies |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Troubleshooting (incl. real incidents) |
| [CONTRIBUTION.md](CONTRIBUTION.md) | Developer contributions |
| [HUMAN.md](HUMAN.md) | Human guidelines |
| [CONVERSATION.md](CONVERSATION.md) | Project conversations |
| [CHANGELOG.md](CHANGELOG.md) | Notable changes |
| [FILES.md](FILES.md) | This document index |

## The Golden Rule

> AI-generated findings are **recommendations, not proof**. The interface must
> clearly distinguish verified evidence, team-provided claims, and AI
> inferences — and a human must review before results are published.
