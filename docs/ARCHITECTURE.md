# Architecture — HackJudge AI

> **Point of view:** this document now describes **two architectures** —
> the one **actually running today** (v1, verified against the code) and the
> **overhaul target** (v2) that the project is being rewritten toward:
> a full architecture + view (UI) rebuild. See
> [DECISIONS.md](DECISIONS.md) ADR-0013.

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

1. **Naming normalization:** `model/`→`models/`, `controller/`→`controllers/`,
   `genrateToken.js`→`generateToken.js`, routes `auth.route.js` (consistent `*.route.js`).
2. **Central error handler** — kill per-controller try/catch boilerplate; use
   an `asyncHandler` wrapper + single JSON error middleware.
3. **Validation middleware** (zod — already a Vite-side dep candidate) before
   controllers; controllers never do `if (!name)` checks again.
4. **`services/` layer** lands with Phase 4 scoring and Phase 6 AI —
   pure functions, unit-testable without DB.
5. **Config module** — `config/index.js` reads/validates env once at boot
   (fails fast if `JWT_SECRET` missing instead of crashing at first login).
6. **Test layout** — `tests/unit/`, `tests/integration/`, supertest against an
   exported `app` (no live-server dependency), per [TESTING.md](TESTING.md).

### Frontend target — the "view" overhaul

```
frontend/src/
├── main.jsx               # boot: providers, router
├── app/                   # router, layout shells, providers (Auth)
├── api/                   # axios instance + interceptors + per-resource modules
│   ├── client.js
│   └── auth.api.js / events.api.js / …
├── features/              # feature-first, not type-first
│   ├── auth/              # Login.jsx, useAuth, auth.forms
│   ├── events/            # list, rubric editor
│   ├── submissions/       # form, ProjectDetails
│   ├── judging/           # scorecard, evidence badges, AI report panel
│   └── leaderboard/
├── components/ui/         # design system primitives (Button, Card, Badge…)
├── styles/                # design tokens (CSS vars): color, spacing, type
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
