# Steps — From Zero to Production

End-to-end path: clone → run → develop → test → deploy. Written against the
project **as it actually exists** (ESM backend, `index.js`, port 3000).

## Stage 0 — Prerequisites

- [ ] Node.js — current supported LTS (project built on **Node 24**)
- [ ] npm
- [ ] MongoDB locally **or** a MongoDB Atlas cluster
- [ ] Git

```bash
node -v      # >= 20 recommended (test runner features)
npm -v
mongosh --version
git --version
```

## Stage 1 — Clone

```bash
git clone https://github.com/YOUR_USERNAME/hackjudge-ai.git
cd hackjudge-ai
```

## Stage 2 — Backend (already built — verify it runs)

```bash
cd backend
npm install        # express, mongoose, mongodb, dotenv, nodemon,
                   # cors, bcryptjs, jsonwebtoken
```

### What must exist (reference)

**`backend/package.json` scripts:**
```json
"scripts": {
  "dev": "nodemon index.js",
  "start": "node index.js",
  "test": "node --test \"tests/*.test.js\""
}
```
> ⚠️ The test glob **must be quoted** — bare `tests/` crashes on Node 24
> with `MODULE_NOT_FOUND` (directory treated as a module path).

**`backend/index.js` (entry — note: `index.js`, NOT `server.js`):**
```js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.routes.js';

dotenv.config();

const app = express();

// middleware
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CLIENT_URL }));

// health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'HackJudge AI API' });
});

// routes
app.use('/api/auth', authRoutes);

// 404
app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

const PORT = process.env.PORT || 3000;

connectDB();
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
```

**`backend/.env`** (never commit — 4 vars):
```
PORT=3000
MONGO_URL=mongodb+srv or standard connection string (see below)
JWT_SECRET=<64-char random hex>
CLIENT_URL=http://localhost:5173
```

Generate `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Connection string notes (real-world gotcha we hit):**
- `mongodb+srv://` requires Node's c-ares DNS to resolve SRV records. If your
  DNS server refuses SRV queries (`querySrv ECONNREFUSED`), use the standard
  form with explicit hosts:
  ```
  MONGO_URL=mongodb://user:pass@ac-…-00-00.host:27017,ac-…-00-01.host:27017,ac-…-00-02.host:27017/hackjudge?ssl=true&replicaSet=atlas-…-shard-0&authSource=admin
  ```
  Get the hosts/replicaSet from Atlas → Connect → Drivers → standard string.

### Run and verify

```bash
npm run dev
```
→ `http://localhost:3000/api/health` returns
`{"status":"ok","service":"HackJudge AI API"}` and
`Mongodb connected: ac-….mongodb.net` appears in the console.

### Run tests (second terminal)

```bash
npm test          # 12/12 expected with the server running
```

## Stage 3 — Frontend (scaffolded; app code next)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Missing pieces (Phase 1 frontend work):
```bash
npm install axios react-router-dom
```

**Create `frontend/.env`:**
```
VITE_API_URL=http://localhost:3000/api
```

**Create `frontend/src/api/client.js`:**
```js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```
> `VITE_*` vars are bundled into the browser — never put secrets there.
> Restart `npm run dev` after editing `.env`.

## Stage 4 — Connect frontend and backend

1. Auth context (`login`/`logout` storing token + user) — see
   [CONVERSATION.md](CONVERSATION.md) / ADR-0013 frontend layout.
2. `Login.jsx` page → `POST /api/auth/login` → on success `navigate("/")`.
3. Protected routes via `react-router-dom` + `useAuth`.
4. Smoke test: register via UI → login → `/me` loads → logout clears
   localStorage.

## Stage 5 — Build the product (roadmap phases)

Order per [ROADMAP.md](ROADMAP.md): **Phase 0.5 overhaul** → Events (P2) →
Submissions (P3) → Judging/scoring (P4) → Leaderboard (P5) → AI (P6).

## Stage 6 — Test

```bash
cd backend && npm test        # node:test, quoted glob
```
Add unit tests for scoring the moment `services/scoringService.js` exists
([TESTING.md](TESTING.md) §3). Never call a live LLM API in tests.

## Stage 7 — Pre-Deploy Checklist

- [ ] `.gitignore` covers `.env`, `node_modules/`, `dist/` (root + both apps)
- [ ] `package-lock.json` committed; `npm audit` clean of high/critical
- [ ] No secrets in client code (`VITE_*` are public)
- [ ] CORS `CLIENT_URL` = exact production frontend origin
- [ ] Security checklist complete ([SECURITY.md](SECURITY.md))
- [ ] Housekeeping: remove `config/dns.js` + npm `dns` package

## Stage 8 — Deploy

Full instructions: [DEPLOYMENTS.md](DEPLOYMENTS.md). Short version:

1. **DB:** MongoDB Atlas → store `MONGO_URL` in platform secrets.
2. **API:** Render/Railway → root `backend/` → build `npm ci` → start
   `npm start` → env vars (`PORT`, `MONGO_URL`, `JWT_SECRET`, `CLIENT_URL`)
   → health check `/api/health`.
3. **Frontend:** Vercel/Netlify → root `frontend/` → build
   `npm ci && npm run build` → set `VITE_API_URL` → deploy.
4. **Wire:** CORS allowlist + full smoke test:
   register → login → event → submit → score → leaderboard.

## Stage 9 — Operate

- Monitoring, backups, incidents: [OPERATIONS.md](OPERATIONS.md)
- Problems: [TROUBLESHOOTING.md](TROUBLESHOOTING.md) (includes our real
  incident history)
- Releases: update [CHANGELOG.md](CHANGELOG.md)

## Milestone Checkpoints

| After stage | You should have |
| --- | --- |
| 2 | Health endpoint green, DB connected, 12/12 tests pass |
| 3 | Frontend dev server runs |
| 4 | UI login round-trip works against the API |
| 5 | Core judging flows demoable |
| 8 | Public URL serving the app |

## Related Documents

- [SPECIFICATION.md](SPECIFICATION.md) — what to build at each stage
- [ROADMAP.md](ROADMAP.md) — phase sequencing incl. the overhaul
- [DEPLOYMENTS.md](DEPLOYMENTS.md) — deployment detail
