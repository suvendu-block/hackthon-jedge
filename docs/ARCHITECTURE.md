# Architecture — HackJudge AI

> **Point of view:** this document describes **two architectures** —
> **v1** (the original as-built) and **v2** (the overhaul target from ADR-0013).
> As of 2026-10-21 the overhaul has **landed**: central error handler, zod
> validation, naming normalization, feature-first frontend and design tokens
> are live. Part 1 stays as the historical record; Part 2's ✅ items are
> current reality. Leftovers (config module, supertest layout, logout design)
> tracked in [ROADMAP.md](ROADMAP.md) Phase 0.5.

---

## Part 1 — Architecture v1: What Runs Today (verified)

```
frontend/  (React 19 + Vite 8, ESM)
    |
    | HTTP / JSON   (VITE_API_URL → http://localhost:3000/api)
    v
backend/  index.js (Node ESM, Express 5)
    |
    +-- 1. express.json({ limit: '1mb' })
    +-- 2. cors({ origin: CLIENT_URL })
    +-- 3. GET /api/health
    +-- 4. /api/auth  → routes/auth.routes.js
    |        +-- controller/auth.controller.js
    |        +-- middleware/auth.middleware.js  (protect / requireRole)
    |        +-- model/user.model.js
    |        +-- utils/genrateToken.js          (JWT, 7-day expiry)
    +-- 5. 404 handler (JSON error shape)
    |
    v
MongoDB Atlas  (Mongoose 9, standard non-SRV connection string)
    collections: users  ✅ implemented
                 events, submissions, evaluations, aianalyses  ← planned
```

### v1 module map (as built)

| File | Responsibility | Status |
| --- | --- | --- |
| `backend/index.js` | App wiring: middleware order, health, routes, 404 | ✅ |
| `backend/config/db.js` | Mongoose connect from `MONGO_URL`, fail-fast exit | ✅ |
| `backend/model/user.model.js` | User schema: name, email (unique), password (`select:false`), role enum, timestamps | ✅ |
| `backend/controller/auth.controller.js` | register / login / logout / me, bcrypt hashing, error shapes | ✅ |
| `backend/middleware/auth.middleware.js` | `protect` (Bearer JWT) + `requireRole` (RBAC) | ✅ |
| `backend/routes/auth.routes.js` | `/api/auth/*` route table | ✅ |
| `backend/utils/genrateToken.js` | `jwt.sign({id}, JWT_SECRET, {expiresIn:'7d'})` | ✅ |
| `backend/tests/auth.test.js` | 12 API tests (node:test runner) | ✅ 12/12 pass |
| `backend/config/dns.js` | Stray debug file | 🗑 delete pending |
| `backend/services/*` | scoring + AI services | ⬜ Phase 4/6 |

### v1 runtime facts

- **Entry:** `index.js` (ESM, `"type": "module"` — not `server.js`)
- **Scripts:** `npm run dev` (nodemon) · `npm start` · `npm test` (`node --test "tests/*.test.js"`)
- **Port:** `PORT=3000` (not 5000)
- **Env vars (4):** `PORT`, `MONGO_URL`, `JWT_SECRET`, `CLIENT_URL`
- **Frontend:** `frontend/` (not `client/`) — Vite template only; `api.js`, auth pages not yet built
- **Known v1 debt:** no central error handler (try/catch repeated in every controller), no `services/` layer, no rate limiting, no request validation middleware, `logout` clears a cookie that is never set (token is localStorage/Bearer), typo'd names kept for compatibility (`genrateToken.js`, folder `model/` singular)

---

## Part 2 — Architecture v2: The Overhaul (target)

**Principle of the rewrite:** same MERN bones, but strict layering, one place
for every concern, and a view architecture that can carry the judging UI.

### Backend target — strict 5-layer pipeline

```
HTTP request
   │
   ▼
[pre-router middleware]  cors → json → (future: helmet, rate-limit)
   │
   ▼
[routes]        thin: path + middleware stack only
   │
   ▼
[controllers]   parse+validate input, call service, shape response
   │              no business logic, no mongoose queries
   ▼
[services]      business rules: scoringService, aiEvaluationService,
   │              authService…  pure functions where possible (testable)
   ▼
[models]        mongoose schemas only
   │
   ▼
[error handler] ONE central async error handler —
                  app.use((err, req, res, next) => …)
```

**v2 moves (delta from v1):**

1. ✅ **Naming normalization (2026-10-21):** `model/`→`models/`,
   `genrateToken.js`→`generateToken.js`. `controller/` stays singular for now
   (one controller; revisit with the first Phase 2 feature).
2. ✅ **Central error handler (2026-10-21):** `utils/AppError.js` +
   `utils/catchAsync.js` + `middleware/error.middleware.js` (`notFound` →
   `errorHandler`, mounted last). Shapes `{error:{code,message}}`, maps
   SyntaxError→400 `BAD_JSON`, Mongoose ValidationError→422, duplicate key→409,
   unknown→500 (stack logged, never leaked).
3. ✅ **Validation middleware (2026-10-21):** zod, at the route layer
   (`schema/auth.schema.js` + `middleware/validate.middleware.js`). Strict
   schemas reject unknown fields → 422 `VALIDATION_ERROR`. Controllers keep
   manual checks only as a safety net.
4. ✅ **`services/` layer** — `scoringService.js` (Phase 4),
   `aiEvaluationService.js` (Phase 6), and Phase 7's
   `githubService` / `documentService` / `demoService` built on
   `utils/safeFetch.js`: pure functions where possible, unit-testable with
   injected lookup/fetch; the AI service takes injectable transport/env.
5. **Config module** — `config/index.js` reads/validates env once at boot
   (fails fast if `JWT_SECRET` missing instead of crashing at first login).
6. **Test layout** — `tests/unit/`, `tests/integration/`, supertest against an
   exported `app` (no live-server dependency), per [TESTING.md](TESTING.md).

**Phase 6 AI request path (as built, 2026-10-23):**

```
POST /api/submissions/:id/ai-analysis
  → protect → requireRole('judge') → rateLimit (10/h per judge, in-memory)
  → aiAnalysis.controller: assigned-judge + event-status gates
  → aiEvaluationService.analyzeSubmission: prompt → provider → strict zod
  → AIAnalysis.create → 201 report        GET … → latest stored report
```

Provider selection: real key → OpenAI-compatible `/chat/completions`
(20s timeout, one network retry, one re-ask when sampled output is
off-spec — reasons logged server-side, bad reports never stored);
`LLM_API_KEY=mock` → deterministic in-repo provider (dev, API tests, UI
journey); unset → 503 `AI_DISABLED` (fail closed). No AI key names,
provider URLs, or model IDs appear in the client bundle (M6 gate,
verified by dist grep).

**Phase 7 evidence request paths (as built, 2026-10-27):**

```
POST /api/submissions/:id/repo/grant      team only → githubService.validateRepoAccess
  → token (optional): validated → AES-256-GCM vault → fingerprint shown, raw never stored
DELETE …/repo/grant                      team only → ciphertext wiped, revokedAt set
POST …/repo/insight      (20/h/user)      team or assigned judge → safeFetch-guarded
  → githubService.fetchInsight: meta + languages + tree + README (each degrades to a note)
  → RepositoryInsight.create             submitted code never checked out, never run

POST …/documents         (30/h/user)      team only → multer (20MB, md/txt/csv/pdf/docx/pptx)
  → sha256 dedupe → bytes to backend/uploads/ → documentService.extract → row
GET  …/documents/:docId/download          attachment + nosniff (never rendered in-app)

POST …/demo/check        (20/h/user)      team or assigned judge → demoService: https-only,
  allowlisted hosts, DNS + redirect re-validation → reachable/title/status recorded
  (a dead demo is a recorded result, never a 5xx)

POST …/evidence                           assigned judge → rubric-criterion normalization
GET  …/evidence                           assigned judge (own) | organizer (all) | team ✗
```

Every outbound call in the phase funnels through
`utils/safeFetch.js`: https + port 443 + host allowlist + public-IP DNS
check + per-hop redirect revalidation + byte caps + abort timeout.
`isPrivateAddress` also guards the `demoUrl`/link schemas at request time
(SECURITY §6). AI analysis now receives the stored artifacts as
`<untrusted_repository>/<untrusted_documents>/<untrusted_demo>` prompt
blocks — stored reads only; an AI request never triggers a live fetch.

### Frontend target — the "view" overhaul

**As-built today (2026-10-22):**

```
frontend/src/
├── main.jsx                       # boot: tokens.css → providers → App
├── app/                           # App.jsx (router, ProtectedRoute), Dashboard
├── styles/tokens.css              # design tokens: color/type/spacing/radii/shadow/z
├── features/
│   ├── auth/                      # Login.jsx + AuthContext.jsx ✅
│   ├── shared/api/client.js       # axios instance + interceptors ✅
│   ├── events/                    # EventsPage + RubricEditor + events.api.js ✅
│   ├── submissions/               # SubmissionsPage + submissions.api.js ✅
│   ├── judging/                   # ScorecardPage + judging.api.js ✅
│   └── leaderboard/               # LeaderboardPage + leaderboard.api.js ✅
└── components/                    # shared UI primitives (empty, Phase 6+)
```

Per-resource API modules are **colocated in their feature**
(`features/events/events.api.js` etc.), not a shared top-level `api/` —
pages still never call axios directly.

Repo-root additions: `scripts/e2e-walkthrough.mjs` (live API walkthrough,
18 checks) and `e2e/ui-journey.mjs` (Playwright user journey, 110 checks) —
both need backend :3000 and frontend :5173 running.

`@` → `src` alias configured in `vite.config.js`.

**Still to come (per phase):**

```
frontend/src/
├── components/ui/             # design system primitives (Button, Card, Badge…)
└── hooks/  context/  utils/
```

**View rules (the visual contract):**

- **Design tokens first** — one palette/type scale in CSS variables (or Tailwind
  config — ADR-0011 selection happens at UI kickoff); no hard-coded hex in components.
- **Evidence is a visual language:** Verified / Claimed / Inferred badges use
  icon + text label, never color alone (accessibility).
- **AI vs. human must be legible at a glance:** AI-suggested values styled
  distinctly (dashed outline + "AI" chip) until a judge explicitly accepts them.
- **Scorecard = the hero screen:** running weighted total always visible;
  one-column on mobile for judges scoring on phones.
- **Responsive + keyboard-complete** before Phase 9 (BL-30/BL-31).

### Reference project slot

> When the reference GitHub repository link is provided, this section will be
> reconciled with its architecture and UI approach — mapping what we adopt,
> what we adapt, and what we explicitly reject (with reasons in
> [DECISIONS.md](DECISIONS.md)).

---

## Non-Negotiable Rules (both versions)

1. **AI runs server-side only.** `LLM_API_KEY` / `GITHUB_TOKEN` never reach
   the client bundle. Anything `VITE_`-prefixed is public.
2. **Judges are final.** AI output is a recommendation layer; the API always
   accepts judge overrides.
3. **Evidence is typed.** Reports distinguish verified evidence, team claims,
   and AI inferences.
4. **Submissions are untrusted input** — parsed, never executed, never
   injected into prompts as instructions.
5. **Scoring math lives in exactly one module** (ADR-0005) — controllers,
   UI, and exports all defer to it.

## Scoring formula (unchanged by the overhaul)

```
contribution = (score / 10) × weight        // score 0–10, weight in %
final        = Σ contributions               // out of 100
```
Example: 8/10 on a 20%-weighted criterion = 16 points.

## Related Documents

- [DECISIONS.md](DECISIONS.md) — ADR-0013 declares the overhaul
- [ROADMAP.md](ROADMAP.md) — how the overhaul is sequenced
- [SPECIFICATION.md](SPECIFICATION.md) — field/endpoint level detail
- [TASKS.md](TASKS.md) — the work items behind every v2 move
