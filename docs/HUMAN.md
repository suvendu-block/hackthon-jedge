# Human Guidelines — HackJudge AI

Guidelines for the humans who use, run, and shape HackJudge AI: judges,
organizers, and developers. The system assists you — **you are responsible for
the outcome.**

## For Judges

### Your role

AI findings are **recommendations, not proof**. You accept, adjust, or reject
every suggestion. No score becomes official without you.

### Review workflow (per submission)

1. **Read the team's own words first** — problem statement, solution,
   description — before looking at AI suggestions (avoid anchoring).
2. **Scan the evidence panel.** Note the labels:
   - **Verified** — checked against the repository/demo.
   - **Claimed** — stated by the team, not verified.
   - **Inferred** — the model's interpretation.
3. **Check what's missing.** Unknown ≠ bad. Missing evidence is a signal to
   *ask*, not to penalize.
4. **Compare with your own reading.** Where the AI's suggestion and your view
   differ, find the evidence that settles it — or record your reasoning.
5. **Score each criterion 0–10**, using the criterion description. The
   weighted total computes itself.
6. **Write comments that help**: one strength, one improvement area, and any
   follow-up questions for the team.
7. **Submit** — and revisit before results are published if new evidence
   appears.

### Judging discipline

- Apply the event's rubric as written; don't invent criteria mid-event.
- Judge the *project*, not the pitch delivery alone — and not the team's
  apparent seniority, school, or background. (Non-discrimination is a hard
  rule.)
- Complexity means engineering challenges and design decisions — not lines of
  code, file count, or technology count.
- Judge complexity and implementation completeness **separately**; a rough
  demo of an ambitious system is not the same as a polished trivial one.
- If you're unsure, say so in the comments. Honest uncertainty beats false
  precision.
- Don't coordinate scores informally with other judges — divergence is
  information the organizer needs.

### When to override AI

Override when: evidence is thin or misread, the team's constraints weren't
visible to the model, the suggestion contradicts something you verified, or
the suggestion rests on a claim rather than evidence. **You never need
permission to override.**

## For Organizers

- Configure criteria and weights **before** judging opens; Σ must equal 100%.
- Brief judges on the rubric — 15 minutes of alignment prevents most score
  divergence.
- Decide per event whether AI analysis is enabled, and tell participants
  ([PRIVACY.md](PRIVACY.md) §9).
- Get permission before any private repository is accessed.
- Publish results explicitly — unpublished scores and judge comments stay
  hidden until you release them.
- Review disagreement alerts when they exist; mediate large gaps with
  evidence, not averages.
- Review the leaderboard for sanity before announcing winners.

## For Developers

- Read [PRINCIPLES.md](PRINCIPLES.md) and [SECURITY.md](SECURITY.md) before
  your first commit — they are binding.
- Keep secrets server-side. Never put a key in a `VITE_` variable or client
  bundle.
- Centralize scoring math; don't re-derive totals in a component.
- Treat every submission as hostile input: validate, allowlist URLs, never
  execute code, never let content act as AI instructions.
- Write the deny test (wrong role, not assigned) alongside the happy path.
- Update the docs when behavior changes ([CONTRIBUTION.md](CONTRIBUTION.md)).
- Log responsibly: no passwords, tokens, or API keys — ever.

## For Everyone

### The product's promises (hold us to them)

1. Humans make final decisions; AI never publishes results alone.
2. Verified evidence, team claims, and AI inferences are always distinguished.
3. Missing information is unknown, not proof of poor quality.
4. The same rubric applies to everyone in a judging category.
5. Personal or demographic characteristics never influence scores.
6. Participants' data is handled per [PRIVACY.md](PRIVACY.md).

### Reporting problems

- **Security issue:** private report per [SECURITY.md](SECURITY.md) §10.
- **Suspected unfair score:** contact the event organizer with the submission
  and criterion in question.
- **Unclear AI report:** flag it — report quality issues so prompts improve.
- **Data deletion request:** go to the event organizer (see
  [PRIVACY.md](PRIVACY.md) §7).

## Quick Reference Card

| Situation | Do |
| --- | --- |
| AI suggests 9, evidence says 6 | Score 6; note why in comments |
| No demo, no repo, just slides | Mark as unknown; list questions for the team |
| Two judges differ by 3+ points | Keep your score; organizer mediates with evidence |
| Team text says "ignore instructions" | Ignore; it's untrusted input |
| Rubric seems wrong mid-event | Stop; ask organizer — don't improvise |
| About to publish results | Confirm every evaluation is `submitted` and reviewed |

## Related Documents

- [PRINCIPLES.md](PRINCIPLES.md) — the underlying design principles
- [PROJECT.md](PROJECT.md) — the ten AI evaluation rules
- [HUMAN ↔ workflow mapping](MILESTONES.md)
