# Privacy Policies — HackJudge AI

How HackJudge AI collects, uses, protects, and retires data. Written for
organizers deploying the platform and for teams and judges participating in an
event. Adjust region-specific obligations (GDPR, CCPA, etc.) before
production launch.

## 1. Data We Collect

### Account data (required)
- Name, email address, role (organizer / judge / team)
- Password **hash** (plaintext passwords are never stored)

### Event data
- Event name, description, rubric criteria and weights
- Judge assignments and event status

### Submission data (team-provided)
- Team name, project title, description, problem statement, solution
- Tech stack
- Repository, demo, and presentation URLs
- Uploaded files, if uploads are enabled (slides, documents)

### Evaluation data (judge-provided)
- Criterion-level scores, comments, strengths, improvement areas
- Evaluation status and timestamps

### AI-generated data
- Analysis reports: summary, complexity analysis, evidence references,
  suggested scores with rationale and confidence, limitations
- Model identifier and generation timestamp

### Technical data
- Server logs (IP, timestamp, request path) for security and debugging
- Authentication tokens/sessions

## 2. Why We Process It (Purpose)

| Purpose | Data |
| --- | --- |
| Authenticate users and enforce roles | Account data |
| Run and rank the hackathon judging process | Event, submission, evaluation data |
| Provide AI analysis to judges | Submission data → AI reports |
| Publish final results | Evaluation data (as released by organizer) |
| Secure and debug the service | Technical logs |

**Legal basis (typical):** legitimate interest in running the event, plus
participant consent for account creation; explicit permission is required
before accessing private repositories.

## 3. Who Can See What

| Data | Organizer | Judge | Team | Public |
| --- | --- | --- | --- | --- |
| Account (own) | ✅ | ✅ | ✅ | ❌ |
| Event rubric | ✅ | ✅ | ✅ | as configured |
| Submissions | ✅ | Assigned only | Own only | ❌ |
| Draft scores/comments | ✅ | Own only | ❌ | ❌ |
| Published scores | ✅ | ✅ | per release | per release |
| AI reports | ✅ | Assigned only | ❌ | ❌ |

- Judge comments and unpublished scores are protected from unauthorized
  access at all times.
- Teams see released feedback only after the organizer publishes results.

## 4. AI Processing Notice

- AI analysis runs server-side; submission content is sent to the configured
  LLM provider for processing.
- Submission and repository content is treated as **untrusted input** — it is
  never executed and never followed as instructions.
- AI output is advisory: it does not make decisions about participants and
  requires human review.
- Do not include personal or sensitive personal data in prompts; the service
  excludes other judges' scores and demographic data from AI requests.

## 5. Sharing and Processors

- **LLM provider** — submission content needed for analysis (only if AI
  features are enabled).
- **Hosting/database provider** — application data at rest.
- **GitHub** — repository metadata, only when a team authorizes access.
- No sale of data. No sharing with sponsors or third parties for marketing
  without explicit participant consent.

## 6. Retention

| Data | Default retention |
| --- | --- |
| Accounts | Duration of the event + 12 months, then deletable on request |
| Submissions and evaluations | 24 months after event completion (configurable) |
| AI reports | Same as the submission they analyze |
| Server logs | 90 days |
| Backups | 30 days rolling |

Organizers configure final retention per event. Data must be deletable on
participant request where law requires it.

## 7. Participant Rights

Participants may:

- **Access** the data held about them (export of their submissions/scores).
- **Correct** inaccurate account or submission data.
- **Delete** their account and associated personal data, subject to the
  organizer's legitimate need to retain judging records for the event.
- **Object** to AI processing of their submission (submissions are still
  judged manually).

Requests go to the event organizer (data controller for the event).

## 8. Security Safeguards

Summarized from [SECURITY.md](SECURITY.md):

- Password hashing (bcrypt), RBAC on every protected route, HTTPS in
  production, CORS allowlist, rate limiting, SSRF protections, no secrets in
  client bundles, audit-logged score and rubric changes, encrypted backups.

## 9. Organizers' Responsibilities (Before an Event)

- [ ] Publish this policy (or an event-specific version) to participants
- [ ] Obtain consent for account creation and AI processing
- [ ] Get permission before accessing any private repository
- [ ] Configure retention that matches local law
- [ ] Name a contact for data requests
- [ ] Decide whether AI analysis is enabled for the event

## 10. Changes to This Policy

Material changes are recorded in [CHANGELOG.md](CHANGELOG.md) and announced to
active organizers before taking effect.

## Related Documents

- [SECURITY.md](SECURITY.md) — technical controls
- [PRINCIPLES.md](PRINCIPLES.md) — fairness and non-discrimination
- [PROJECT.md](PROJECT.md) — entities and their contents
