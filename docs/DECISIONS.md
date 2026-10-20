# Architecture Decisions — HackJudge AI

Record of significant architecture decisions (ADR-style). Newest decisions are
appended at the bottom. To change a decision, add a new entry that supersedes
the old one — do not edit history.

---

## ADR-0001 — MERN Stack

**Status:** Accepted
**Context:** Hackathon-scale timeline; team knows JavaScript end-to-end; need
one language across client and server.
**Decision:** MongoDB + Express.js + React + Node.js, with Mongoose as ODM.
**Consequences:** Fast iteration, shared conventions, easy hiring; gives up
relational joins (mitigated by embedding small documents and referencing large
ones).

## ADR-0002 — REST API with JSON

**Status:** Accepted
**Context:** Simple CRUD-shaped domain (events, submissions, evaluations).
**Decision:** Express exposes a REST API under `/api` with JSON bodies (1 MB
limit).
**Consequences:** Trivially consumable from React via Axios; straightforward to
test and document.

## ADR-0003 — JWT / Secure Session Authentication

**Status:** Accepted
**Context:** Three roles (organizer, judge, team) must be authenticated; SPA
client.
**Decision:** JWT (or secure cookie-backed sessions) with bcrypt-hashed
passwords. Auth middleware attaches the user; RBAC middleware enforces roles.
**Consequences:** Stateless API; requires careful token expiry and refresh
policy (see SECURITY.md).

## ADR-0004 — Role-Based Access Control on Every Protected Route

**Status:** Accepted
**Context:** Judges must only see assigned submissions; rubrics are
organizer-only; unpublished scores are sensitive.
**Decision:** Every non-public route checks role and event membership.
Judges are limited to submissions assigned to them.
**Consequences:** Slight middleware overhead; large reduction in data-leak
surface.

## ADR-0005 — Centralized Weighted Scoring Service

**Status:** Accepted
**Context:** The formula `(score/10) × weight`, summed to 100, must be applied
identically everywhere (dashboard, leaderboard, export).
**Decision:** One `scoringService.js` owns all score math. No route or
controller computes scores inline.
**Consequences:** Single place to test and change scoring; leaderboard and
detail views can never disagree.

## ADR-0006 — Rubric Stored Per Event, Not Hardcoded

**Status:** Accepted
**Context:** Every hackathon weights criteria differently.
**Decision:** Each event document embeds its rubric (criteria + weights).
Validators enforce weights sum to 100%.
**Consequences:** Fully configurable events; scoring service reads weights
from the event rather than constants.

## ADR-0007 — AI Evaluation Runs Server-Side Only

**Status:** Accepted
**Context:** LLM API keys must never reach the browser; `VITE_`-prefixed
variables are public.
**Decision:** `aiEvaluationService.js` lives on the server. The client only
requests analysis; the server builds prompts, calls the LLM, and stores the
report.
**Consequences:** Keys stay secret; prompt construction and output validation
are centrally controlled.

## ADR-0008 — AI Reports Stored as Separate Documents

**Status:** Accepted
**Context:** Reports may be regenerated with different models; they need
independent versioning and must not overwrite judge data.
**Decision:** AI analyses go in their own collection keyed by
`submissionId`, storing model, summary, complexity analysis, evidence,
suggested scores, and limitations.
**Consequences:** Easy re-analysis and history; leaderboard reads only judge
scores, never AI suggestions directly.

## ADR-0009 — AI Output Classified by Evidence Type

**Status:** Accepted
**Context:** Judges must distinguish what was proven vs. claimed vs. inferred.
**Decision:** Every AI finding carries a type: `verified-evidence`,
`team-claim`, or `ai-inference`, rendered with distinct styling.
**Consequences:** Slightly richer prompt/response schema; dramatically clearer
reports.

## ADR-0010 — React with Vite

**Status:** Accepted
**Context:** Need a fast SPA toolchain with minimal config.
**Decision:** `npm create vite@latest client -- --template react`, plus Axios
and react-router-dom.
**Consequences:** Instant dev server and simple builds; standard React
component model.

## ADR-0011 — One CSS Framework: Tailwind *or* Bootstrap

**Status:** Pending selection
**Context:** README mandates choosing exactly one.
**Decision:** TBD at frontend kickoff — decide in the first frontend session
and record the outcome here.
**Consequences:** Avoids framework mixing; keeps styling consistent.

## ADR-0012 — Untrusted Input: Never Execute Submitted Code

**Status:** Accepted
**Context:** Repository analysis could tempt execution of team code.
**Decision:** Static inspection and metadata only. No execution of submitted
code, ever. External URLs validated against an allowlist to prevent SSRF.
**Consequences:** Limits depth of analysis; eliminates a major attack class.

## ADR-0013 — Architecture + View Overhaul (v1 → v2)

**Status:** Accepted — in progress (2026-10-20)
**Context:** The Phase 0/1 MVP was built quickly and worked, but accumulated
structural debt: per-controller try/catch boilerplate with inconsistent error
shapes, no validation layer, naming drift (`model/` singular,
`genrateToken.js` typo, `server.js`-era docs vs. `index.js` reality),
frontend still a template, and no defined visual language for the product's
core idea (evidence typing, AI-vs-judge distinction). The team also wants to
re-anchor the project's "view" (UI) around a reference GitHub project once
linked.
**Decision:** Rewrite rather than patch:

1. **Backend v2** — strict 5-layer pipeline (pre-router middleware → routes →
   controllers → services → models → central error handler), validation
   middleware before controllers, single config module that fail-fast-validates
   env at boot, normalized file naming.
2. **Frontend v2 (view)** — feature-first structure (`features/*`), design
   tokens, reusable `components/ui/` primitives, evidence-badge visual
   language (Verified / Claimed / Inferred), explicit AI-suggested vs
   judge-entered styling, mobile-first scorecard.
3. **Reference reconciliation** — when a reference repository URL is
   provided, its architecture and UI are mapped as adopt / adapt / reject,
   each recorded as its own ADR appended here.

**Consequences:** Short-term rework of recently written code; long-term one
error shape everywhere, testable pure services, faster feature UI, and a
coherent visual identity. Non-negotiables (server-side AI, judges final,
typed evidence, untrusted input) are unchanged by the overhaul.

## ADR-0014 — Tests Run on Node's Built-in Runner

**Status:** Accepted (2026-10-20)
**Context:** [TESTING.md](TESTING.md) proposed Jest/Vitest + Supertest. For
the auth milestone, zero-dependency speed mattered more.
**Decision:** Use `node --test "tests/*.test.js"` for now; the glob
**must** be quoted (Node 24 treats a bare directory argument as a module
path → `MODULE_NOT_FOUND`). Re-evaluate supertest + an exported `app` during
the overhaul (Phase 0.5) so tests stop requiring a live server.
**Consequences:** Zero new dependencies, 12 tests running today; tests hit
the real Atlas DB and leave `test+…` users behind (cleanup needed until
teardown lands).

## Related Documents

- [PRINCIPLES.md](PRINCIPLES.md) — why these decisions were acceptable
- [SPECIFICATION.md](SPECIFICATION.md) — the decisions in implementable form
- [CONVERSATION.md](CONVERSATION.md) — the discussions behind the decisions
