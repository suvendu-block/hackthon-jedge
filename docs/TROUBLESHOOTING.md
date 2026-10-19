# Troubleshooting — HackJudge AI

Common problems and their fixes, ordered by how often they occur. For incident
procedure see [OPERATIONS.md](OPERATIONS.md); for security-sensitive issues
see [SECURITY.md](SECURITY.md).

## Setup and Local Development

### `npm run dev` doesn't exist / nothing starts

**Symptom:** `Missing script: dev`.
**Cause:** `backend/package.json` currently has no start/dev scripts.
**Fix:** Add them as described in [STEPS.md](STEPS.md):

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

### Server won't start: `server.js` not found

**Symptom:** `Cannot find module .../server.js`.
**Cause:** Backend has dependencies installed but the source file hasn't been
created yet (current repository state).
**Fix:** Create `backend/server.js` per [STEPS.md](STEPS.md) §2.

### MongoDB connection fails

**Symptom:** `MongooseServerSelectionError: connect ECONNREFUSED` or Atlas
`IP not allowed`.

**Checks:**

1. Is MongoDB running locally? `mongosh --eval "db.runCommand({ping:1})"`
2. Is `MONGODB_URI` set in `backend/.env` and actually loaded (file is in the
   **backend** directory)?
3. Atlas: is your IP allowlisted (or `0.0.0.0/0` for a throwaway dev
   cluster)? Is the DB user's password correct in the URI?
4. Is the cluster awake (M0 pauses after inactivity)?

### Env variables are `undefined`

**Symptom:** `process.env.MONGODB_URI` is undefined.
**Fix:** `require("dotenv").config()` at the very top of `server.js`; confirm
`.env` sits next to `server.js`, is spelled `.env`, and is **not** committed.

### Port already in use

**Symptom:** `EADDRINUSE: address already in use :::5000`.
**Fix:** stop the other process, or run with a different port:

```powershell
$env:PORT=5001; npm run dev
```

## Frontend / Client

### `VITE_API_URL` is undefined in the browser

**Fix:** it lives in `client/.env`; Vite reads it at **start time** — restart
`npm run dev` after creating/changing it. Note `import.meta.env.VITE_API_URL`,
not `process.env`.

### CORS error: "blocked by CORS policy"

**Symptom:** Browser console: `Access to fetch ... has been blocked by CORS`.

**Checks:**

1. API sets `cors({ origin: process.env.CLIENT_URL })` and `CLIENT_URL`
   matches the frontend origin **exactly** (scheme + host + port, no trailing
   slash).
2. `.env` loaded on the API side (restart the API after changes).
3. Frontend calls the right base URL (`http://localhost:5000/api` locally).
4. You're not mixing `https://` frontend with `http://` API (mixed content).

### 404 on client routes after refresh (production)

**Cause:** SPA history routing needs a rewrite rule.
**Fix:** configure the host to rewrite all paths to `index.html` (Vercel:
`vercel.json` rewrites; Netlify: `_redirects` with `/* /index.html 200`).

### API returns 401 immediately after login

**Checks:** token stored and attached via the Axios interceptor; token not
expired; `Authorization: Bearer <token>` header present; API verifies the same
secret used to sign.

## API and Data

### Validation errors on event creation (weights)

**Symptom:** 422 "weights must sum to 100".
**Cause:** the rubric validator requires Σ weights = 100 exactly.
**Fix:** adjust weights in the rubric editor (it shows a running total).

### Score total doesn't match my hand calculation

**Checks:**

1. Rounding rule: contributions round to 2 decimals **before** summing
   ([SPECIFICATION.md](SPECIFICATION.md) §5).
2. Are you including a draft evaluation? Drafts are excluded from the
   leaderboard.
3. Are all rubric criteria scored? Missing scores are rejected, not zeroed.
4. Unit test the case in `scoringService` — if it fails, it's a bug: file it.

### Duplicate evaluation error (409)

**Cause:** unique index `{ submissionId, judgeId }` — one evaluation per judge
per submission.
**Fix:** update the existing evaluation instead of creating a new one.

### Judge can't see a submission

**Checks:** the judge is in the event's `judgeIds`; the submission belongs to
that event; assignment checks aren't bypassed by a stale client cache
(refresh).

### Judge sees another judge's draft scores

**This is a security bug.** Verify the route enforces assignment and
RBAC; report per [SECURITY.md](SECURITY.md) §10.

## AI Analysis

### "Request AI analysis" returns 503

**Causes:** missing/invalid `LLM_API_KEY` on the server, provider outage,
timeout, or malformed model output (the service fails closed by design).
**Fix:** check server logs for the recorded reason; verify the key; retry. The
client should show a clear error — never a partial report.

### Report looks generic or ignores the repository

**Checks:** submission actually contains the evidence (repo URL, description);
prompt includes the event rubric; content wasn't truncated by size limits.

### Prompt-injection concern (repo README contains "instructions")

**Expected behavior:** external content must be wrapped as untrusted data and
never treated as instructions ([SECURITY.md](SECURITY.md) §7). If the model
followed embedded instructions, that's a P0 bug — capture the fixture and add
a test per [TESTING.md](TESTING.md) §5.

### AI suggestions aren't populating my scorecard

**By design.** Suggestions never auto-fill judge scores; use the explicit
"accept suggestion" action per criterion (FR-18).

## Performance

### Leaderboard is slow

**Checks:** `evaluations` index on `{ eventId, status }`; number of
submissions; N+1 queries in aggregation (fetch in one aggregation pipeline).

### Requests are rate-limited (429) during judging

**Cause:** AI or auth rate limits.
**Fix:** raise the limit for the event window in config, or stagger judge AI
requests. Never disable rate limits in production.

## Git and Repo

### `.env` got committed

**Immediate steps:** rotate every credential that was in it (`LLM_API_KEY`,
`GITHUB_TOKEN`, DB user password), then purge from history
(`git filter-repo`) and confirm `.gitignore` covers `.env`.

### `node_modules` in the repo / huge diffs

**Fix:** ensure root and `backend/.gitignore` include `node_modules/` and
lockfiles are the only generated files tracked.

## Getting More Detail

- API: enable dev logging and reproduce; errors should include request id and
  route, never secrets or stack traces in production.
- DB: Atlas → Collections → check documents against the schemas in
  [SPECIFICATION.md](SPECIFICATION.md).
- Still stuck? Open an issue with: repro steps, expected vs actual, role of
  the test user, timestamps, and sanitized logs.

## Related Documents

- [OPERATIONS.md](OPERATIONS.md) — incident response
- [STEPS.md](STEPS.md) — correct setup procedure
- [TESTING.md](TESTING.md) — how to reproduce with tests
