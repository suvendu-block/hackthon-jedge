# Design Principles — HackJudge AI

These principles constrain every design and implementation decision. When a
proposal conflicts with a principle, the principle wins unless the team amends
it in [DECISIONS.md](DECISIONS.md).

## 1. Human in the Loop

AI generates recommendations, never final results. Every AI-suggested score
must be adjustable by a judge, and publishing results always requires human
review. The product *supports* judges; it does not replace them.

## 2. Evidence Over Claims

The system separates three kinds of information and labels them everywhere:

| Kind | Source | Trust |
| --- | --- | --- |
| Verified evidence | Repository, demo, uploaded documents | Highest |
| Team-provided claim | Submission form text | Unverified |
| AI inference | Model output | Advisory |

A score backed by verified evidence is qualitatively different from one backed
only by a claim — the interface must make that visible.

## 3. Consistency First

- The same rubric applies to every submission in a judging category.
- Rubric criteria and weights are configured once per event, not reinterpreted
  per judge.
- Scoring math is centralized in one service so every score path produces
  identical arithmetic.

## 4. Explainability Is Mandatory

No naked numbers. Every suggested score carries a rationale, the evidence it
rests on, and its uncertainty. Judges can see *why* before they accept.

## 5. Missing Data Is Unknown, Not Bad

Absent evidence (no README, no demo video) is treated as **unknown**, never as
automatic proof of poor quality. The assistant's job includes telling judges
what questions to ask — not filling gaps with guesses.

## 6. Complexity ≠ Completeness

Technical complexity (engineering challenges, design decisions) is evaluated
**separately** from implementation completeness (does it work, how finished is
it). A brilliant architecture with a rough demo and a simple app that is
polished should not be conflated.

## 7. Judge Depth by Engineering, Not Volume

Complexity is assessed by challenges and decisions — not by lines of code,
file count, commit count, or number of technologies listed.

## 8. Security and Privacy by Default

- Secrets stay server-side; nothing sensitive ships to the client.
- Role-based access control protects every route.
- Submissions, repository content, and uploads are **untrusted input** —
  parsed and displayed, never executed, never treated as AI instructions.
- Judge comments and unpublished scores are protected until release.

## 9. Transparency of Uncertainty

AI outputs state their confidence and limitations. Where evidence is thin, the
report says so rather than presenting false precision.

## 10. Fairness and Non-Discrimination

No inference about a team's ability or a project's quality from personal or
demographic characteristics. Judging rests only on submitted artifacts.

## 11. Configurability Without Fragmentation

Events customize criteria, weights, and status flows — but the data model,
scoring formula, and audit trails stay shared so results remain comparable and
the codebase stays coherent.

## 12. Progressive Disclosure

Judges see the essentials first (scorecard, summary, top findings) and drill
into detail (full evidence, raw analysis, history) on demand. Dashboards
optimize for review speed; detail pages optimize for depth.

## Related Documents

- [DECISIONS.md](DECISIONS.md) — the concrete decisions these principles produced
- [SECURITY.md](SECURITY.md) — principle 8 in policy form
- [AI evaluation principles in PROJECT.md](PROJECT.md) — the ten AI rules
