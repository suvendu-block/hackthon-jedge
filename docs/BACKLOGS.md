# Backlog — HackJudge AI

Every feature considered for the product, with status. Status values:
`todo` · `in-progress` · `done` · `planned` · `icebox`.

Priority: **P0** must-have MVP · **P1** important · **P2** nice-to-have.

## MVP Features (from README)

| ID | Feature | Priority | Status |
| --- | --- | --- | --- |
| BL-01 | Project submissions: title, description, problem statement, solution, tech stack, team details, links | P0 | todo |
| BL-02 | Judge dashboard: browse assigned projects, track evaluation status | P0 | todo |
| BL-03 | Configurable scoring rubric: criteria and weights per hackathon | P0 | todo |
| BL-04 | Scorecards and feedback: criterion scores, comments, strengths, improvement areas | P0 | todo |
| BL-05 | AI evaluation assistant: preliminary analysis and scoring suggestions | P1 | todo |
| BL-06 | Leaderboard: weighted scores and ranking of eligible submissions | P0 | todo |
| BL-07 | Authentication and roles: organizer, judge, team | P0 | todo |
| BL-08 | Evaluation history: record of submitted scores and feedback | P1 | todo |

## Planned Enhancements (from README)

| ID | Feature | Priority | Status |
| --- | --- | --- | --- |
| BL-09 | GitHub repository analysis, with team authorization where required | P1 | planned |
| BL-10 | Presentation and document analysis | P2 | planned |
| BL-11 | Demo review and evidence linking | P2 | planned |
| BL-12 | Judge disagreement alerts (large score divergence detection) | P1 | planned |
| BL-13 | AI-generated questions for project teams | P2 | planned |
| BL-14 | Similarity checks to help identify potentially duplicated submissions | P2 | planned |
| BL-15 | CSV export of results and reports | P1 | planned |

## Infrastructure / Quality

| ID | Feature | Priority | Status |
| --- | --- | --- | --- |
| BL-16 | Health check endpoint `/api/health` | P0 | todo |
| BL-17 | Server-side input validation and sanitization | P0 | todo |
| BL-18 | Rate limiting on auth and AI endpoints | P1 | todo |
| BL-19 | CORS allowlist configuration | P0 | todo |
| BL-20 | Unit tests for scoring service | P1 | todo |
| BL-21 | Integration tests for auth, events, submissions | P1 | todo |
| BL-22 | CI pipeline (lint + test on PR) | P2 | todo |
| BL-23 | Linting and formatting (ESLint + Prettier) | P1 | todo |
| BL-24 | Error tracking (e.g. Sentry) | P2 | todo |
| BL-25 | Structured logging | P2 | todo |

## UX

| ID | Feature | Priority | Status |
| --- | --- | --- | --- |
| BL-26 | Evidence-type badges (verified / claimed / inferred) | P1 | todo |
| BL-27 | AI-suggested vs judge-entered score visual distinction | P1 | todo |
| BL-28 | Confidence and uncertainty indicators on AI findings | P1 | todo |
| BL-29 | Dark mode | P2 | icebox |
| BL-30 | Mobile-responsive judge dashboard | P1 | todo |
| BL-31 | Accessibility pass (keyboard nav, ARIA, contrast) | P1 | todo |

## Governance

| ID | Feature | Priority | Status |
| --- | --- | --- | --- |
| BL-32 | Select and add a LICENSE file | P0 | todo |
| BL-33 | Privacy policy page for participants | P1 | todo |
| BL-34 | Data retention / deletion workflow | P2 | planned |
| BL-35 | Audit log of rubric and score changes | P2 | planned |

## Notes

- AI features (BL-05, BL-09–BL-14) must follow the AI Evaluation Rules in
  [PROJECT.md](PROJECT.md) and the constraints in [PRINCIPLES.md](PRINCIPLES.md).
- Anything touching secrets or external network calls must satisfy
  [SECURITY.md](SECURITY.md) before merging.
- The interface must clearly distinguish verified evidence, team-provided
  claims, and AI inferences.

## Related Documents

- [TASKS.md](TASKS.md) — actionable task breakdown
- [ROADMAP.md](ROADMAP.md) — sequencing over time
- [REQUIREMENTS.md](REQUIREMENTS.md) — requirement IDs
