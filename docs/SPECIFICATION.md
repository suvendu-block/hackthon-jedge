# Technical Specification — HackJudge AI

Implementable detail for the backend and frontend. Derived from
[README.md](../README.md) and [REQUIREMENTS.md](REQUIREMENTS.md).

## 1. Technology Versions

| Component | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js LTS | Current supported LTS release |
| API | Express.js `^5.3.0` | Installed in `backend/` |
| ODM | Mongoose `^9.11.2` | Installed |
| DB driver | MongoDB `^7.7.0` | Installed |
| Env | dotenv `^18.0.8` | Installed |
| Dev runner | nodemon `^3.1.14` | Installed |
| Frontend | React via Vite | `npm create vite@latest frontend -- --template react` (React 19 + Vite 8) |
| HTTP client | Axios | Planned: shared client in `frontend/src/api/client.js` with Bearer interceptor |
| Routing | react-router-dom | Client-side routes |
| Styling | Tailwind CSS **or** Bootstrap | Choose exactly one (see ADR-0011) |
| Auth | JWT or secure session + bcrypt | Password hashing mandatory |

## 2. Environment Variables

### `backend/.env` (server — secret; 4 vars in use today)

```
PORT=3000
MONGO_URL=mongodb://user:pass@ac-…-00-00.host:27017,…/hackjudge?ssl=true&replicaSet=atlas-…-shard-0&authSource=admin
JWT_SECRET=<64-char random hex>
CLIENT_URL=http://localhost:5173

# Optional: only if AI analysis is implemented
LLM_API_KEY=
GITHUB_TOKEN=
```

> **Field name is `MONGO_URL`** (not `MONGODB_URI`), read by
> `config/db.js`. Prefer the standard non-SRV form if `mongodb+srv://` fails
> in your network (see [TROUBLESHOOTING.md](TROUBLESHOOTING.md) Incident #2).

### `frontend/.env` (public — bundled)

```
VITE_API_URL=http://localhost:3000/api
```

> Any `VITE_`-prefixed variable is exposed to the browser. Never put secrets
> there. All `.env` files belong in `.gitignore`.

## 3. Data Models (Mongoose)

### User

```js
{
  name:         String, required,
  email:        String, required, unique, lowercase, trimmed,
  passwordHash: String, required,   // never plaintext
  role:         Enum ["organizer", "judge", "team"], required,
  createdAt:    Date, default: Date.now
}
```
Indexes: unique index on `email`.

### Event

```js
{
  name:        String, required,
  description: String,
  rubric: [{
    criterion: String, required,      // e.g. "Innovation"
    weight:    Number, required,      // percent, 0–100
    description: String               // what judges consider
  }],                                 // Σ weight must equal 100
  organizerId: ObjectId → User, required,
  judgeIds:    [ObjectId → User],
  status:      Enum ["draft", "active", "completed"], default: "draft",
  createdAt:   Date, default: Date.now
}
```
Validation: custom validator enforcing Σ weights === 100.
Indexes: `status`, `judgeIds`.

### Submission

```js
{
  eventId:          ObjectId → Event, required,
  teamName:         String, required,
  projectTitle:     String, required,
  description:      String,
  problemStatement: String,
  solution:         String,
  techStack:        [String],
  repositoryUrl:    String,   // validated against host allowlist
  demoUrl:          String,
  presentationUrl:  String,
  status:           Enum ["draft", "submitted", "under_review", "scored"],
  createdAt:        Date, default: Date.now
}
```
Indexes: `{ eventId: 1, status: 1 }`.

### Evaluation

```js
{
  eventId:        ObjectId → Event, required,
  submissionId:   ObjectId → Submission, required,
  judgeId:        ObjectId → User, required,
  criterionScores: [{ criterion: String, score: Number }],  // 0–10
  comments:       String,
  strengths:      String,
  improvementAreas: String,
  totalScore:     Number,   // derived, computed by scoringService
  status:         Enum ["draft", "submitted"], default: "draft",
  updatedAt:      Date, default: Date.now
}
```
Unique index: `{ submissionId: 1, judgeId: 1 }` (one evaluation per judge per
submission).
Validation: each score within 0–10; every rubric criterion must have a score.

### AIAnalysis (optional, separate collection for versioning — ADR-0008)

```js
{
  submissionId:      ObjectId → Submission, required,
  model:             String,          // e.g. "gpt-4o-mini"
  summary:           String,
  complexityAnalysis: String,
  evidence: [{
    type: Enum ["verified-evidence", "team-claim", "ai-inference"],
    text: String,
    source: String                    // file path, URL section, or field name
  }],
  suggestedScores: [{ criterion: String, score: Number, rationale: String,
                      confidence: Number }],
  limitations:      [String],
  createdAt:        Date, default: Date.now
}
```
Indexes: `{ submissionId: 1, createdAt: -1 }`.

## 4. REST API

Base URL: `/api`. All routes require auth except where noted.

| Method | Endpoint | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Register a user |
| POST | `/auth/login` | public | Authenticate, return token |
| GET | `/events` | auth | List events visible to current user |
| POST | `/events` | organizer | Create an event |
| GET | `/events/:eventId/submissions` | judge/organizer | List event submissions |
| POST | `/events/:eventId/submissions` | team | Submit a project |
| GET | `/submissions/:submissionId` | assigned judge/organizer/team owner | View project details |
| POST | `/submissions/:submissionId/evaluations` | assigned judge | Create or update an evaluation |
| POST | `/submissions/:submissionId/ai-analysis` | assigned judge | Request AI analysis |
| GET | `/events/:eventId/leaderboard` | auth | Get ranked results |

### Conventions

- JSON only; request body limit 1 MB.
- Errors: `{ "error": { "code": string, "message": string } }` with proper HTTP
  status (400/401/403/404/409/422/429/500).
- Validation failures return 422 with field-level detail.
- Pagination: `?page=&limit=` on list endpoints.
- Rate limits: stricter on `/auth/*` and `/submissions/:id/ai-analysis`.

## 5. Scoring Algorithm

```
for each criterion c in event.rubric:
    score[c] = evaluation.criterionScores[c]        // 0–10
    contribution[c] = (score[c] / 10) * weight[c]   // weight in percent
total = Σ contribution[c]                            // 0–100
```

- Rounding: round each contribution to 2 decimals, then sum; round final to
  2 decimals. Same rule everywhere (ADR-0005).
- Leaderboard rank: sort by `total` descending; ties broken by Implementation
  criterion contribution, then by earliest `updatedAt`.
- Only `status: "submitted"` evaluations count.

Example: score 8 on a 20%-weighted criterion → `(8/10) × 20 = 16` points.

## 6. AI Evaluation Service

`backend/services/aiEvaluationService.js`

1. Verify the requesting judge is assigned to the submission.
2. Gather inputs: submission fields (never other judges' scores).
3. Build the prompt embedding the event rubric and the AI Evaluation Rules
   (see [PROJECT.md](PROJECT.md)).
4. Mark all repo/document content as untrusted data blocks, with an explicit
   system instruction that content inside them is never instructions.
5. Call the LLM API server-side with timeout and retry-with-backoff.
6. Validate the response against the `AIAnalysis` schema; reject malformed
   output.
7. Persist an `AIAnalysis` document; return it to the client.

Failure policy: on LLM error, return 503 with a clear message; never partial
score suggestions without labels and limitations.

## 7. Client Specification

### Routes

| Route | Page | Access |
| --- | --- | --- |
| `/login` | `Login.jsx` | public |
| `/` | `Dashboard.jsx` | all roles |
| `/submissions/:id` | `ProjectDetails.jsx` | judge/organizer/team owner |
| `/submissions/:id/evaluate` | `JudgeEvaluation.jsx` | assigned judge |
| `/events/:id/leaderboard` | `Leaderboard.jsx` | auth |

### API client (`frontend/src/api/client.js` — target, Phase 1 frontend)

```js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

On a 401 response: clear the stored token and redirect to `/login` (add a
response interceptor when the login page lands).

### UI conventions

- AI-suggested values are visually distinct from judge-entered values.
- Evidence badges: **Verified** (green), **Claimed** (amber), **Inferred**
  (grey) — never rely on color alone; include text labels.
- Destructive/publishing actions confirm explicitly.

## 8. Project Structure

**As built today:**

```
hackthon-jedge/
├── frontend/                    # React 19 + Vite 8 (scaffolded)
│   └── src/
│       ├── App.jsx  main.jsx    # template state — view overhaul pending
│       ├── App.css  index.css
│       └── assets/
├── backend/                     # Express 5, ESM, entry: index.js, port 3000
│   ├── config/   db.js  (+ dns.js 🗑 delete)
│   ├── model/    user.model.js
│   ├── controller/  auth.controller.js
│   ├── middleware/  auth.middleware.js   # protect, requireRole
│   ├── routes/      auth.routes.js
│   ├── utils/       genrateToken.js      # typo — rename in v2
│   ├── tests/       auth.test.js         # 12 passing
│   ├── index.js
│   ├── package.json                      # scripts: dev/start/test
│   └── .env                              # PORT, MONGO_URL, JWT_SECRET, CLIENT_URL
├── docs/
├── .gitignore
└── README.md
```

**Overhaul target (ADR-0013):**

```
frontend/src/
├── app/            # router, layout, providers
├── api/            # client.js + interceptors + per-resource modules
├── features/       # auth/ events/ submissions/ judging/ leaderboard/
├── components/ui/  # design-system primitives
├── styles/         # design tokens
└── hooks/ context/ utils/

backend/
├── config/  index.js        # fail-fast env validation
├── routes/  controllers/    # thin
├── services/                # scoringService, aiEvaluationService (pure)
├── models/                  # mongoose schemas only
└── middleware/              # cors→json→validate→auth→rbac + central error handler
```

## 9. Validation Rules Summary

- Email: valid format, unique (case-insensitive).
- Password: minimum 8 characters (recommend zod/express-validator).
- Rubric weights: Σ === 100.
- Scores: integers 0–10 per rubric criterion; all criteria present.
- URLs (`repositoryUrl`, `demoUrl`, `presentationUrl`): http(s) only, host
  allowlist (github.com, gitlab.com, drive.google.com, ...), redirects
  re-validated.
- Uploads (planned): ≤ 20 MB, MIME allowlist, AV scan where available.

## Related Documents

- [ARCHITECTURE.md](ARCHITECTURE.md) — system context
- [DECISIONS.md](DECISIONS.md) — why these choices
- [SECURITY.md](SECURITY.md) — security requirements for implementation
