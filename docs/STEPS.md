# Steps — From Zero to Production

End-to-end path: clone → local development → tests → deploy. Commands are
written for PowerShell-friendly shells; adapt as needed.

## Stage 0 — Prerequisites

- [ ] Node.js — current supported LTS release
- [ ] npm (ships with Node)
- [ ] MongoDB locally **or** a MongoDB Atlas cluster
- [ ] Git

Verify:

```bash
node -v
npm -v
mongosh --version
git --version
```

## Stage 1 — Clone

```bash
git clone https://github.com/YOUR_USERNAME/hackjudge-ai.git
cd hackjudge-ai
```

> Replace `YOUR_USERNAME` and update the repository URL if needed.

## Stage 2 — Backend (from zero to running)

```bash
cd backend
npm install          # installs express, mongoose, mongodb, dotenv, nodemon
```

1. Ensure `backend/package.json` has:

   ```json
   "scripts": {
     "start": "node server.js",
     "dev": "nodemon server.js"
   }
   ```

2. Create `backend/server.js`:

   ```js
   const express = require("express");
   const mongoose = require("mongoose");
   const cors = require("cors");
   require("dotenv").config();

   const app = express();

   app.use(cors({ origin: process.env.CLIENT_URL }));
   app.use(express.json({ limit: "1mb" }));

   app.get("/api/health", (req, res) => {
     res.json({ status: "ok", service: "HackJudge AI API" });
   });

   async function startServer() {
     try {
       await mongoose.connect(process.env.MONGODB_URI);
       const port = process.env.PORT || 5000;
       app.listen(port, () => {
         console.log(`API server running on port ${port}`);
       });
     } catch (error) {
       console.error("Failed to start server:", error.message);
       process.exit(1);
     }
   }

   startServer();
   ```

   > Express 5 note: install `cors` (`npm install cors`) — it is not in the
   > dependency list yet.

3. Create `backend/.env` (**never commit it**):

   ```
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/hackjudge
   CLIENT_URL=http://localhost:5173

   # Optional: configure only if AI analysis is implemented
   LLM_API_KEY=
   GITHUB_TOKEN=
   ```

4. Run and verify:

   ```bash
   npm run dev
   ```

   Open <http://localhost:5000/api/health> →
   `{"status":"ok","service":"HackJudge AI API"}`

## Stage 3 — Frontend

From the repository root, open a **new** terminal:

```bash
npm create vite@latest client -- --template react
cd client
npm install
npm install axios react-router-dom
npm run dev
```

Vite prints the local URL, usually <http://localhost:5173>.

## Stage 4 — Connect Frontend to Backend

Create `client/.env`:

```
VITE_API_URL=http://localhost:5000/api
```

Create `client/src/api.js`:

```js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

export default api;
```

Use `api` from components. Add auth headers/cookie handling when
authentication lands (see [SPECIFICATION.md](SPECIFICATION.md) §7).

Restart `npm run dev` after changing `.env`.

## Stage 5 — Implement the App

Follow the workstreams in order:

1. Auth and roles ([TASKS.md](TASKS.md) WS1)
2. Events and rubric (WS2)
3. Submissions (WS3)
4. Judging and scoring (WS4)
5. Leaderboard (WS5)
6. AI assistant (WS6)

## Stage 6 — Test

```bash
cd backend
npm test        # add test script when tests exist
cd ../client
npm test
```

See [TESTING.md](TESTING.md). Gate: scoring unit tests pass and the
authorization matrix is covered before any deploy.

## Stage 7 — Pre-Deploy Checklist

- [ ] `.gitignore` excludes `node_modules/`, `.env`, build output
- [ ] `package-lock.json` committed
- [ ] No secrets anywhere in client code (`VITE_*` are public)
- [ ] CORS `CLIENT_URL` matches the real frontend origin
- [ ] Security checklist complete ([SECURITY.md](SECURITY.md))
- [ ] `npm audit` free of high/critical findings

## Stage 8 — Deploy

Full instructions: [DEPLOYMENTS.md](DEPLOYMENTS.md). Short version:

1. **DB:** create MongoDB Atlas cluster → store `MONGODB_URI` in the
   platform's secrets.
2. **API:** connect repo on Render/Railway → root `backend/` → build
   `npm ci` → start `npm start` → set env vars → health check
   `/api/health`.
3. **Frontend:** connect repo on Vercel/Netlify → root `client/` → build
   `npm ci && npm run build` → set `VITE_API_URL` → deploy.
4. **Wire:** add the production frontend origin to API CORS; smoke test
   register → login → event → submit → score → leaderboard.

## Stage 9 — Operate

- Monitoring, backups, incidents: [OPERATIONS.md](OPERATIONS.md)
- Problems: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Releases: update [CHANGELOG.md](CHANGELOG.md)

## Milestone Checkpoints

| After stage | You should have |
| --- | --- |
| 2 | Health endpoint green, DB connected |
| 4 | Client talks to API |
| 5.4 | Judges can score; totals compute correctly |
| 6 | Tests green |
| 8 | Public URL serving the app |

## Related Documents

- [STEPS ↔ ROADMAP mapping](ROADMAP.md)
- [SPECIFICATION.md](SPECIFICATION.md) — what to build at each stage
- [DEPLOYMENTS.md](DEPLOYMENTS.md) — deployment detail
