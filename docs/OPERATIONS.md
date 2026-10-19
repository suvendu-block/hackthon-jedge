# Operations — HackJudge AI

Service architecture and day-2 operations: what runs where, how it is kept
healthy, and what to do when something breaks.

## Service Architecture

```
                    ┌──────────────────────────────┐
                    │  CDN / Static Hosting         │
                    │  React client (Vite build)    │
                    │  Vercel / Netlify             │
                    └──────────────┬───────────────┘
                                   │ HTTPS (JSON)
                    ┌──────────────▼───────────────┐
                    │  API service (Node + Express) │
                    │  Render / Railway / VM        │
                    │  ┌─────────────────────────┐  │
                    │  │ auth middleware (JWT)    │  │
                    │  │ RBAC middleware          │  │
                    │  │ routes / controllers     │  │
                    │  │ scoringService           │  │
                    │  │ aiEvaluationService      │──┼──► LLM API
                    │  └─────────────────────────┘  │
                    └──────────────┬───────────────┘
                                   │ Mongoose (TLS)
                    ┌──────────────▼───────────────┐
                    │  MongoDB Atlas                │
                    │  users · events · submissions │
                    │  evaluations · aianalyses     │
                    └──────────────────────────────┘
                                   │
                          GitHub API (optional,
                          authorized repositories)
```

## Service Inventory

| Service | Purpose | Health signal | Owner |
| --- | --- | --- | --- |
| Frontend SPA | Judge/team UI | HTTP 200 on base route | frontend |
| API | REST endpoints | `GET /api/health` → `{status:"ok"}` | backend |
| MongoDB Atlas | Persistence | Atlas status page + connection metrics | backend |
| LLM provider | AI analysis | Successful analysis request | backend |
| GitHub API | Repo analysis (optional) | API rate-limit headers | backend |

## Ports and Endpoints

| Env | Frontend | API | DB |
| --- | --- | --- | --- |
| Local | http://localhost:5173 | http://localhost:5000 | mongodb://127.0.0.1:27017/hackjudge |
| Production | custom domain | `https://<api-host>/api` | Atlas cluster URI |

## Routine Operations

### Daily during an event
- Monitor API error rate and response times (platform dashboard or APM).
- Watch for `/ai-analysis` rate-limit hits and LLM failures.
- Check leaderboard correctness spot-wise after score submissions.

### Weekly
- `npm audit` on backend and frontend; apply high/critical patches.
- Review Atlas slow-query log; confirm indexes are used.
- Verify backup recency.

### Monthly
- Rotate non-expiring secrets if exposure is suspected; review token expiry
  settings.
- Restore-test a backup into a scratch database.
- Prune stale preview deployments.

## Configuration and Changes

- Config changes go through env vars — no code edits for config
  (`PORT`, `MONGODB_URI`, `CLIENT_URL`, keys).
- Rubric changes are data operations by the organizer — no deploy needed.
- Schema migrations: additive-first (add fields with defaults, backfill,
  then remove old fields in a later release).

## Monitoring and Alerting

| Signal | Alert when |
| --- | --- |
| `GET /api/health` | Fails 3 consecutive checks |
| API 5xx rate | > 1% for 5 minutes |
| LLM failure rate | > 10% over 15 minutes |
| DB connections | Atlas connection count near limit |
| Auth failures | Spike in 401s (possible brute force) |

Logs must exclude passwords, tokens, and API keys (see
[SECURITY.md](SECURITY.md)).

## Incident Response

1. **Detect** — alert or report (see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)).
2. **Triage** — severity: S1 (judging blocked during live event), S2 (degraded),
   S3 (cosmetic).
3. **Mitigate** — roll back the last release first; fix forward second.
   During a live event, prefer rollback over hotfix.
4. **Communicate** — status note to organizers; judges get a written ETA.
5. **Recover** — verify health + one full flow (event → submit → score →
   leaderboard).
6. **Postmortem** — within 48h for S1/S2: timeline, cause, action items,
   recorded in [CONVERSATION.md](CONVERSATION.md) and
   [CHANGELOG.md](CHANGELOG.md).

## Backup and Recovery

| Data | Backup | RPO |
| --- | --- | --- |
| Atlas collections | Daily snapshot, 30-day retention | ≤ 24h |
| Pre-release | Manual snapshot before each event | 0 |
| Secrets | Platform secret store (recoverable by admin) | — |

Restore procedure: create scratch cluster → restore snapshot → verify counts →
point API at restored URI (staging first).

## Data Retention and Cleanup

Execute the retention schedule in [PRIVACY.md](PRIVACY.md) §6. Provide a
deletion workflow for participant requests once the event retention period
allows.

## Scaling During a Live Event

- Scale API replicas horizontally (stateless auth makes this safe).
- Pre-warm: run one AI analysis and one leaderboard request before doors open.
- Cap AI analysis per judge to protect LLM quota.
- If Atlas load spikes, add the indexes from
  [SPECIFICATION.md](SPECIFICATION.md) before scaling the cluster.

## Freeze Policy

During a live hackathon: **no deploys except S1 fixes.** Feature freeze begins
1 hour before judging opens and ends when results are published.

## Related Documents

- [ARCHITECTURE.md](ARCHITECTURE.md) — component design
- [DEPLOYMENTS.md](DEPLOYMENTS.md) — deployment methods
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — problem playbook
- [SECURITY.md](SECURITY.md) — controls to maintain
