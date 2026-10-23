# Troubleshooting — HackJudge AI

Common problems and fixes — **the top section is our real incident
history** (each one actually hit during development, with the fix that
worked), followed by the standing playbook.

---

## Part 1 — Real Incidents (already solved here)

### 🐛 Incident #1 — `npm test` crashes: `Cannot find module …\backend\tests`

**Symptom:**
```
Error: Cannot find module 'D:\…\backend\tests'
✖ tests (92ms)  fail 1
```
**Cause:** Node 24 treats a **bare directory argument** as a literal module
path — both `node --test tests/` and `node --test tests` fail this way on
Windows.
**Fix:** quote the glob so Node expands it itself:

```json
"test": "node --test \"tests/*.test.js\""
```
(Bare `node --test` with no args also works — auto-discovery.) Also remove
any **duplicate `"test"` key** in `package.json` — JSON silently keeps the
last one.

### 🐛 Incident #2 — `querySrv ECONNREFUSED _mongodb._tcp.cluster0.…`

**Symptom:** `Server is running on port 3000` then
`Error: querySrv ECONNREFUSED …` → exit 1.
**Cause:** the machine's only DNS server (e.g. `10.222.71.160`, a private/
VPN resolver) refuses Node's c-ares **SRV** queries — even though Windows
`Resolve-DnsName -Type SRV` succeeds and the cluster's TCP 27017 is open.
**Fix (chosen):** switch `.env` from `mongodb+srv://` to the **standard
connection string** (explicit shard hosts, no SRV):

```
MONGO_URL=mongodb://user:pass@ac-…-00-00.host:27017,ac-…-00-01.host:27017,ac-…-00-02.host:27017/hackjudge?ssl=true&replicaSet=atlas-…-shard-0&authSource=admin
```
Copy hosts + replicaSet from Atlas → Connect → Drivers → standard string.
**Alternative:** set adapter DNS to `8.8.8.8` / `1.1.1.1` (may be blocked on
corporate networks).

### 🐛 Incident #3 — Register always 500: `Path 'password' is required`

**Symptom:** server log shows
`Register Error User validation failed: password: Path 'password' is required.`
**Cause:** controller wrote `User.create({ …, passwordHash, role })` but the
schema field is **`password`** — `passwordHash` isn't in the schema (dropped
by strict mode), so required-field validation fails.
**Fix (3 spots):**
```js
User.create({ name, email, password: passwordHash, role })
User.findOne({ email }).select("+password")     // field is select:false
bcrypt.compare(password, user.password)
```
**Lesson:** a mismatched field name here fails *silently downstream* —
login then 401s because no user was ever created. Read the server log first.

### 🐛 Incident #4 — Every valid token returns 401

**Symptom:** `/me` and `/logout` fail with 401 even with a fresh, valid
token; "no token" and "garbage token" tests pass.
**Cause (both present at once):**
1. `header.startWith('Bearer')` — **typo**, String has `startsWith`; the
   TypeError is swallowed by `catch` → generic 401.
2. `import JWT from 'jsonwebtoken'` but `jwt.verify(...)` → ReferenceError,
   same swallowed path.
**Fix:** `startsWith('Bearer ')` (note the trailing space) and consistent
lowercase `jwt` import/call.
**Lesson:** a `catch-all → 401` hides real errors — log
`error.message` in the catch while developing.

### 🐛 Incident #5 — `.env` vars undefined / auth crashes

**Symptom:** `jwt.sign` throws (register 500) or CORS never applies.
**Cause:** `JWT_SECRET` (and `CLIENT_URL`) simply weren't in `.env` —
dotenv loaded only the 2 vars that existed (`injected env (2)`).
**Fix:** add both; generate a secret with
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
**Watch for:** the `injected env (N)` line on boot — N tells you how many
vars actually loaded.

### 🐛 Incident #6 — Health check 404 / body always `undefined`

**Symptom:** `GET /api/health` 404; every `req.body` field `undefined`.
**Cause:** `index.js` had no health route, and **`express.json()` was never
registered** — Express doesn't parse bodies by default. `cors` was imported
but never `app.use()`d either.
**Fix:** register middleware **before** routes:
```js
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CLIENT_URL }));
app.get('/api/health', …);
```

---

## Part 2 — Setup and Local Development

### `npm run dev` → `Missing script: dev`
Scripts missing from `backend/package.json`. Required set:
```json
"scripts": { "dev": "nodemon index.js", "start": "node index.js", "test": "node --test \"tests/*.test.js\"" }
```

### `Cannot find module '…/server.js'`
There is **no `server.js`** — the entry is **`index.js`** (docs written
before the rename were corrected 2026-10-20).

### MongoDB connection fails (`ECONNREFUSED` / Atlas `IP not allowed`)
1. Local mongod running? `mongosh --eval "db.runCommand({ping:1})"`
2. Is `.env` next to `index.js` and loaded? (check `injected env (N)`)
3. Atlas: IP allowlisted? DB user/password correct in the URI?
4. M0 clusters pause after inactivity — resume in the Atlas UI.
5. SRV issues → Incident #2 above.

### Env variables are `undefined`
- `import dotenv from 'dotenv'; dotenv.config();` must run **before** first
  `process.env` read (top of `index.js` ✅).
- File must be exactly `.env`, in `backend/`.
- After editing `.env` → **restart** the process (nodemon may not watch it).

### Port already in use: `EADDRINUSE :::3000`
Another process holds 3000 (often a forgotten `node index.js`):
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
Or run elsewhere: `$env:PORT=3001; npm run dev`.

## Part 3 — Frontend / Client

### `VITE_API_URL` undefined
Lives in `frontend/.env`; Vite reads it at **start time** → restart
`npm run dev`. Access as `import.meta.env.VITE_API_URL`, not `process.env`.

### CORS error ("blocked by CORS policy")
1. `CLIENT_URL` in `backend/.env` must match the frontend origin **exactly**
   (`http://localhost:5173`, no trailing slash) — currently set ✅.
2. `app.use(cors({ origin: process.env.CLIENT_URL }))` must appear **before**
   routes.
3. Restart the API after env changes.
4. Prod: https frontend → https API only (no mixed content).

### 404 on page refresh (production SPA)
Add a rewrite to `index.html` (Vercel `vercel.json` rewrites; Netlify
`_redirects`: `/* /index.html 200`).

### 401 immediately after login
Token not attached (missing Axios interceptor), token expired (7 days), or
wrong header shape — must be `Authorization: Bearer <token>`.

## Part 4 — API and Data

### 422/400 "weights must sum to 100"
Rubric validator — adjust weights until the running total hits 100.

### Score total ≠ my hand calculation
1. Rounding: contributions round to 2 decimals **before** summing.
2. Draft evaluations are excluded from the leaderboard.
3. All criteria must be scored (missing ≠ zero).
4. If a unit test of `scoringService` fails → it's a bug, file it.

### 409 duplicate evaluation
Unique index `{ submissionId, judgeId }` — update the existing evaluation.

### Judge can't see a submission
Judge not in event's `judgeIds`, wrong event, or stale client cache.

### Judge sees another judge's draft scores
**Security bug (P0)** — report per [SECURITY.md](SECURITY.md) §10.

## Part 5 — AI Analysis

- **503 on "Request AI analysis":** missing/invalid `LLM_API_KEY`, provider
  down, timeout, or schema-invalid output (service fails closed by design).
  Check server logs; never display a partial report.
- **No key while developing:** set `LLM_API_KEY=mock` in `backend/.env` —
  the deterministic in-repo provider answers without network or secret, so
  the whole request → review → accept → override flow works in dev, tests,
  and the UI journey. Leaving the key unset keeps the endpoints honestly
  fail-closed (503 `AI_DISABLED`).
- **Real provider settings:** `LLM_BASE_URL` (default
  `https://api.openai.com/v1`), `LLM_MODEL` (default `gpt-4o-mini`),
  `LLM_TIMEOUT_MS` (default `20000`), `LLM_REASONING=off` to silence
  thinking models — opt-in because plain OpenAI rejects unknown fields.
  Dev runs OpenRouter + `qwen/qwen3.7-flash`.
- **OpenRouter 404 "No allowed providers are available":** your account's
  allowed-providers filter (openrouter.ai/settings/privacy) doesn't include
  the model's host. Check
  `GET /api/v1/models/<id>/endpoints` for `provider_name` entries your
  account permits.
- **Suggestions don't populate the scorecard:** by design — judges must
  click "accept" per criterion (FR-18).
- **Repo content containing "ignore previous instructions":** must stay
  wrapped as untrusted data (ADR-0012). If the model obeys it → P0 bug,
  add a fixture to the test suite ([TESTING.md](TESTING.md) §8).

## Part 6 — Performance

- **Leaderboard slow:** index `{ eventId, status }` on evaluations; use one
  aggregation pipeline (watch for N+1).
- **429s during judging:** rate limits on `/auth/*` or AI endpoints — raise
  for the event window via config, don't disable in production.

## Part 7 — Git and Repo

### `.env` got committed
Rotate **everything** in it immediately (`MONGO_URL` password,
`JWT_SECRET`), then purge history (`git filter-repo`) and verify
`.gitignore`.

### Junk files to remove (housekeeping backlog)
- `backend/config/dns.js` — stray debug server referencing nonexistent
  `MONGO_URI`.
- npm package `dns` in dependencies — Node's `dns` is built-in;
  `npm uninstall dns`.

## Getting More Detail

- Reproduce with the server in the foreground — watch the console
  (`Register Error …` style logs exist for a reason).
- Errors must include request id + route in dev; never secrets or stack
  traces in production responses.
- Still stuck? Open an issue with: repro steps, role of the test user,
  timestamps, sanitized logs.

## Related Documents

- [OPERATIONS.md](OPERATIONS.md) — incident response
- [STEPS.md](STEPS.md) — correct setup procedure
- [CHANGELOG.md](CHANGELOG.md) — what these incidents turned into
