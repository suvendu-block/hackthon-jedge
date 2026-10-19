# PROJECT.md — HackJudge AI: Complete Details

## Identity

| | |
| --- | --- |
| **Name** | HackJudge AI |
| **One-liner** | AI-powered hackathon project evaluation and judging assistant |
| **Stack** | MERN (MongoDB, Express.js, React, Node.js) |
| **Type** | Web platform for hackathon organizers and judges |
| **Origin** | Hackathon project (`hackthon-jedge` repository) |
| **License** | None selected yet — add a LICENSE before distributing |

## Purpose

Hackathon judges often need to assess many projects in a short period. Projects
can use unfamiliar technologies, presentations may not fully reflect
implementation progress, and judges may interpret scoring criteria differently.

HackJudge AI makes this process **more organized, transparent, evidence-based,
and consistent** — while keeping final scoring decisions in human hands.

## Users and Roles

| Role | Capabilities |
| --- | --- |
| **Organizer** | Create events, configure rubric criteria/weights, assign judges, view leaderboard, export results |
| **Judge** | Browse assigned submissions, request/read AI analysis, enter criterion scores, write feedback, view history |
| **Team** | Submit projects (details, links), view their own evaluation status and released feedback |

## Core Entities

- **User** — name, email (unique), passwordHash, role, createdAt
- **Event** — name, description, rubric (criteria + weights), organizerId,
  judgeIds, status (draft/active/completed), createdAt
- **Submission** — eventId, teamName, projectTitle, description,
  problemStatement, solution, techStack, repositoryUrl, demoUrl,
  presentationUrl, status, createdAt
- **Evaluation** — eventId, submissionId, judgeId, criterionScores, comments,
  strengths, improvementAreas, status (draft/submitted), updatedAt
- **AI Analysis** *(optional)* — submissionId, model, summary,
  complexityAnalysis, evidence, suggestedScores, limitations, createdAt

Full field-level definitions: [SPECIFICATION.md](SPECIFICATION.md).

## Judging Rubric (default example)

Organizers customize criteria and weights per event.

| Criterion | Weight | Judges Consider |
| --- | --- | --- |
| Innovation | 20% | Originality and differentiation |
| Technical Complexity | 20% | Engineering challenges, technical depth, design decisions |
| Implementation | 25% | Working functionality, completeness, supporting evidence |
| Real-World Impact | 15% | Importance of the problem, potential value |
| UX and Usability | 10% | Accessibility, clarity, ease of use |
| Presentation | 10% | Demo quality, clarity of explanation |

**Formula:** `contribution = (score / 10) × weight`; final score = Σ
contributions (out of 100). Example: 8/10 at 20% weight = 16 points.

## Product Workflow

1. Organizer creates an event (details, criteria, weights, judge assignments).
2. Team submits a project (description, technologies, repo, presentation, demo).
3. System organizes the supplied evidence; AI analysis may be requested.
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
- Authentication and roles (organizer, judge, team)
- Evaluation history

## Planned Enhancements

- GitHub repository analysis (with team authorization where required)
- Presentation and document analysis
- Demo review and evidence linking
- Judge disagreement alerts
- AI-generated questions for project teams
- Similarity checks for potentially duplicated submissions
- CSV export of results and reports

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

## Technology

**Core:** MongoDB (documents), Express.js (REST API), React (dashboard),
Node.js (runtime).

**Supporting:** Mongoose; JWT/session auth; bcrypt (password hashing); Tailwind
CSS *or* Bootstrap (choose one); optional LLM API; optional GitHub API;
optional Multer + object storage for uploads.

## Repository Structure

```
hackjudge-ai/
├── client/                 # React (Vite) — planned
│   └── src/
│       ├── api.js
│       ├── components/
│       ├── pages/          # Login, Dashboard, ProjectDetails,
│       │                   # JudgeEvaluation, Leaderboard
│       ├── hooks/
│       ├── context/
│       ├── App.jsx
│       └── main.jsx
├── backend/                # Express API — dependencies installed
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/           # scoringService.js, aiEvaluationService.js
│   ├── utils/
│   └── server.js
├── docs/                   # This documentation set
├── .gitignore
└── README.md
```

## Current Status

| Area | State |
| --- | --- |
| Backend | Scaffold: `package.json` with Express 5.3, Mongoose 9.11, MongoDB 7.7, dotenv, nodemon. No source files yet. |
| Frontend | Empty directory — Vite React app pending |
| Docs | This documentation set |
| Tests | None yet |

## Related Documents

- [ALL.md](ALL.md) — one-page overview
- [REQUIREMENTS.md](REQUIREMENTS.md) — functional requirements
- [SPECIFICATION.md](SPECIFICATION.md) — technical spec
- [TASKS.md](TASKS.md) — task breakdown
- [README.md](../README.md) — original project README
