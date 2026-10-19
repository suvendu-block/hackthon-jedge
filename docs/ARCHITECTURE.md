# Architecture — HackJudge AI

This document describes the system architecture of HackJudge AI: an AI-powered
hackathon project evaluation and judging assistant built with the MERN stack.

## High-Level Overview

```
React Client
    |
    | HTTPS / JSON
    v
Express.js REST API (Node.js)
    |
    +---- Authentication & Authorization
    |
    +---- Events and Submissions
    |
    +---- Judging and Score Calculation
    |
    +---- AI Evaluation Service (optional)
    |          |
    |          +---- LLM API
    |          +---- Authorized Repository Analysis
    |
    v
MongoDB (Mongoose)
```

## Layers

### 1. Client (React)

- Single-page application served statically in production.
- Pages: Login, Dashboard, ProjectDetails, JudgeEvaluation, Leaderboard.
- Talks to the API through a shared Axios client (`client/src/api.js`) using
  `VITE_API_URL`.
- Holds **no secrets**. Anything prefixed with `VITE_` is bundled into the
  browser.

### 2. API (Express.js / Node.js)

REST endpoints under `/api`. Middleware concerns, in order:

1. CORS restriction to the known frontend origin.
2. JSON body parsing (1 MB limit).
3. Authentication (JWT or secure session).
4. Role-based authorization (organizer / judge / team).
5. Route handler.

Internal modules:

| Module | Responsibility |
| --- | --- |
| `routes/` + `controllers/` | HTTP surface: request validation, response shaping |
| `middleware/` | auth, RBAC, rate limits, error handling |
| `models/` | Mongoose schemas (User, Event, Submission, Evaluation, AIAnalysis) |
| `services/scoringService.js` | Weighted score computation, leaderboard ranking |
| `services/aiEvaluationService.js` | Builds prompts, calls the LLM API, stores reports |
| `config/` | DB connection, env loading |
| `utils/` | Helpers (slugify, pagination, validators) |

### 3. Data (MongoDB via Mongoose)

Collections: `users`, `events`, `submissions`, `evaluations`,
`aianalyses`. See [SPECIFICATION.md](SPECIFICATION.md) for field-level detail
and [PROJECT.md](PROJECT.md) for the entity summary.

## Key Flows

### Evaluation flow

1. Team submits a project to an event.
2. Organizer-assigned judges see the submission on their dashboard.
3. A judge requests AI analysis (optional) → `aiEvaluationService` gathers the
   submission payload, calls the LLM, and stores an `AIAnalysis` document.
4. The judge reviews the report, adjusts criterion-level scores, and submits an
   `Evaluation`.
5. `scoringService` computes the weighted total and the leaderboard.

### Scoring formula

For a criterion scored 0–10 with weight `w`:

```
contribution = (score / 10) × weight
final = Σ contributions            // out of 100
```

Example: 8/10 on a 20%-weighted criterion contributes 16 points.

## Architecture Rules

- **AI runs on the server only.** `LLM_API_KEY` and `GITHUB_TOKEN` never reach
  the client bundle or browser code.
- **Judges are final.** AI output is a recommendation layer, never an
  authority; the API always accepts judge overrides.
- **Evidence is typed.** Stored AI reports distinguish verified evidence,
  team-provided claims, and AI inferences.
- **Submissions and repo content are untrusted input** — parsed, never
  executed, never injected into prompts as instructions.

## Current State

The repository is at the scaffold stage:

- `backend/` — dependencies installed (Express 5, Mongoose 9, MongoDB driver 7,
  dotenv, nodemon); application source not yet written.
- `frontend/` — reserved for the React client (Vite template).

See [ROADMAP.md](ROADMAP.md) and [TASKS.md](TASKS.md) for what comes next.
