# Deployments — HackJudge AI

Suggested deployment targets, methods, and a production checklist. Pick one
option per row; all are free-tier friendly for a hackathon pilot.

## Recommended Stack (Pilot)

| Component | Service | Why |
| --- | --- | --- |
| Database | **MongoDB Atlas** (M0 free tier) | Managed, backups, no local DB ops |
| API | **Render** or **Railway** | Node-native, free/hobby tiers, easy env vars |
| Frontend | **Vercel** or **Netlify** | Static React hosting, CDN, preview deploys |
| Secrets | Platform secret managers (never in repo) | Keeps keys server-side |

Alternative: single **Railway/Render** service for API + Atlas for DB;
frontend stays separate because `VITE_` vars are build-time.

## Environment Configuration

### API service

```
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster/…/hackjudge
CLIENT_URL=https://your-frontend.vercel.app
LLM_API_KEY=…            # only if AI enabled
GITHUB_TOKEN=…           # only if GitHub analysis enabled
NODE_ENV=production
```

### Frontend build

```
VITE_API_URL=https://your-api.onrender.com/api
```

> `VITE_*` values are baked at **build time** — changing them requires a
> rebuild. They must never contain secrets.

## Deployment Steps

1. **Prepare repo**
   - [ ] `.gitignore` covers `node_modules/`, `.env`, build output
   - [ ] `package-lock.json` committed
   - [ ] `npm start` script works (`node server.js`)
2. **Database**
   - [ ] Create Atlas cluster + DB user with least privilege
   - [ ] Whitelist service IPs / allow all from platform (prefer scoped)
   - [ ] Store `MONGODB_URI` in the platform's secret store
   - [ ] Verify connectivity from the API host
3. **API**
   - [ ] Connect repo; set root directory `backend/`
   - [ ] Build: `npm ci` · Start: `npm start`
   - [ ] Set env vars (including `CLIENT_URL` = exact frontend origin)
   - [ ] Health check path: `GET /api/health`
   - [ ] Confirm HTTPS URL serves the health check
4. **Frontend**
   - [ ] Connect repo; set root `client/` (create when scaffolded)
   - [ ] Build: `npm ci && npm run dev` → output `dist/`
   - [ ] Set `VITE_API_URL`, rebuild
   - [ ] Confirm API calls succeed from the deployed origin
5. **Wire together**
   - [ ] Frontend origin added to API CORS allowlist (`CLIENT_URL`)
   - [ ] No wildcard CORS with credentials
   - [ ] Smoke test: register → login → create event → submit → score →
         leaderboard

## CI/CD

- On PR: install, lint, unit + integration tests, `npm audit` gate.
- On merge to main: deploy API (Render/Railway auto-deploy), deploy frontend
  (Vercel/Netlify auto-deploy).
- Keep AI tests offline in CI (fixtures/mocks — see [TESTING.md](TESTING.md)).

## Release Checklist

- [ ] All [TESTING.md](TESTING.md) suites green
- [ ] [SECURITY.md](SECURITY.md) pre-release checklist complete
- [ ] No secrets in repo history or client bundle
- [ ] CORS locked to the real frontend origin
- [ ] Rate limits enabled (auth + AI)
- [ ] HTTPS enforced; security headers set
- [ ] Error tracking + logging configured (no PII/secrets in logs)
- [ ] Database backup policy active; restore tested once
- [ ] Rollback plan documented (previous build retained by platform)

## Rollback

1. Activate the previous build/release on the API platform (one click on
   Render/Railway/Vercel).
2. If a schema change was involved, restore from the Atlas snapshot taken
   pre-deploy (or run a reviewed fix-forward migration).
3. Verify `/api/health` and one core flow; announce in the changelog.

## Scaling Notes

- API is stateless (JWT/session) → horizontal replicas are safe.
- Put a CDN in front of the frontend; API can sit behind platform load
  balancing.
- Indexes per [SPECIFICATION.md](SPECIFICATION.md) matter before adding
  replicas — check slow-query logs after the first real event.
- LLM calls: keep timeouts tight; queueing (e.g. BullMQ + Redis) is a
  later enhancement if analysis volume grows.

## Environments

| Env | Purpose | Frontend | API |
| --- | --- | --- | --- |
| `local` | Development | http://localhost:5173 | http://localhost:5000 |
| `preview` | PR validation | preview URL | preview URL |
| `production` | Real events | custom domain | custom domain |

Use separate Atlas databases (`hackjudge_dev`, `hackjudge_prod`) and separate
LLM keys per environment where possible.

## Related Documents

- [OPERATIONS.md](OPERATIONS.md) — day-2 operations
- [STEPS.md](STEPS.md) — zero-to-production for local dev
- [SECURITY.md](SECURITY.md) — required controls
