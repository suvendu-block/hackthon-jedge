# Functional Requirements — HackJudge AI

Requirement IDs are stable references used by [TASKS.md](TASKS.md) and
[TESTING.md](TESTING.md). Format: `FR-x` (functional), `NFR-x`
(non-functional).

## Roles

- **R1** The system supports three roles: `organizer`, `judge`, `team`.
- **R2** Every protected endpoint enforces role-based authorization.

## Authentication

- **FR-1** Users can register with name, email, password, and role. Email is
  unique; passwords are stored as hashes only.
- **FR-2** Users can log in and receive an authentication token (JWT or secure
  session).
- **FR-3** Roles cannot be self-elevated after registration without organizer
  action.

## Events (Organizer)

- **FR-4** An organizer can create an event with name, description, rubric
  criteria, weights, and assigned judges.
- **FR-5** Rubric weights must sum to 100%; invalid rubrics are rejected.
- **FR-6** An organizer can change event status: `draft`, `active`,
  `completed`.
- **FR-7** A user sees only events they are a member of (organizer, assigned
  judge) or that are open for team submission.

## Submissions (Team)

- **FR-8** A team can submit a project to an active event containing: title,
  description, problem statement, solution, tech stack, repository URL, demo
  URL, presentation URL.
- **FR-9** A team can view and edit its own submission until the event closes.
- **FR-10** A judge or organizer can list all submissions for an event.
- **FR-11** A judge can view submission details only for submissions assigned
  to them (unless the event grants broader access).

## Evaluation (Judge)

- **FR-12** A judge can create and edit a draft evaluation for an assigned
  submission: one score (0–10) per rubric criterion, plus comments, strengths,
  and improvement areas.
- **FR-13** A judge can submit a draft evaluation, locking it as `submitted`
  while remaining editable per event policy.
- **FR-14** The system computes the weighted total automatically using
  `(score/10) × weight`, summed to 100. Judges cannot type a manual total.
- **FR-15** Evaluation history is retained: who scored what, when, and the
  resulting changes.

## AI Evaluation Assistant (Optional)

- **FR-16** A judge can request AI analysis for a submission. The server
  builds the prompt, calls the LLM, and stores the report.
- **FR-17** An AI report contains: summary, complexity analysis, evidence with
  type labels (`verified-evidence`, `team-claim`, `ai-inference`), suggested
  criterion scores with rationale, and stated limitations.
- **FR-18** AI suggested scores never automatically populate or overwrite
  judge-entered scores; judges explicitly accept suggestions.
- **FR-19** Missing information is reported as "unknown", never scored as
  failure.
- **FR-20** AI analysis is generated only from the submitted materials and
  authorized sources; submitted code is never executed.

## Leaderboard and Results

- **FR-21** The system computes a ranked leaderboard for an event from
  submitted evaluations using the event rubric.
- **FR-22** Draft (unsubmitted) evaluations are excluded from the leaderboard.
- **FR-23** Unpublished scores and judge comments are visible only to
  authorized roles until results are released.
- **FR-24** Organizers can export results as CSV (planned — see BACKLOGS).

## Notifications and Alerts (Planned)

- **FR-25** The system flags large score divergences between judges on the
  same submission (judge-disagreement alerts).

## Non-Functional Requirements

- **NFR-1** All secrets (`LLM_API_KEY`, `GITHUB_TOKEN`, DB credentials) remain
  server-side; no secret ever appears in the client bundle.
- **NFR-2** CORS is restricted to known frontend origins in production.
- **NFR-3** Authentication and AI endpoints are rate-limited.
- **NFR-4** Request bodies are validated and sanitized server-side; upload
  size and file-type limits are enforced.
- **NFR-5** External URLs are allowlisted and redirects validated to prevent
  SSRF.
- **NFR-6** Production traffic runs over HTTPS.
- **NFR-7** Score computation is deterministic: identical inputs always
  produce identical totals.
- **NFR-8** Sensitive data (passwords, tokens) is never logged.
- **NFR-9** The AI layer must clearly distinguish verified evidence, team
  claims, and AI inferences in every report.

## Traceability

| Requirement area | Primary test file (planned) |
| --- | --- |
| Auth | `tests/integration/auth.test.js` |
| Events / rubric validation | `tests/integration/events.test.js` |
| Submissions | `tests/integration/submissions.test.js` |
| Scoring math | `tests/unit/scoringService.test.js` |
| AI report schema | `tests/unit/aiEvaluationService.test.js` |
| Leaderboard | `tests/integration/leaderboard.test.js` |

See [TESTING.md](TESTING.md) for the full strategy.

## Related Documents

- [SPECIFICATION.md](SPECIFICATION.md) — implementable detail
- [BACKLOGS.md](BACKLOGS.md) — every feature with status
- [REQUIREMENTS ↔ TASKS mapping](TASKS.md)
