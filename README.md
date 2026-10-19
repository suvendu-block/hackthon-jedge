HackJudge AI
AI-powered hackathon project evaluation and judging assistant built with the MERN stack.

HackJudge AI helps hackathon judges evaluate submissions more consistently by organizing project information, analyzing available evidence, and providing structured scoring recommendations. It supports human judges—it does not replace their final decisions.
Table of Contents
- Overview
- Problem Statement
- Goals
- Features
- Judging Rubric
- How It Works
- Tech Stack
- Architecture
- Getting Started
- Environment Variables
- Suggested Project Structure
- API Overview
- Data Models
- AI Evaluation Principles
- Security Considerations
- Roadmap
- Contributing
- License
Overview
HackJudge AI is a web platform for hackathon organizers and judges. Teams submit project details, repository links, presentations, and demo links. Judges can review submissions in one place and use AI-generated analysis to understand the project's technical complexity, implementation progress, strengths, weaknesses, and potential impact.

The platform can also compare evaluations, highlight large differences between judges' scores, and generate a leaderboard based on the event's judging rubric.
Problem Statement
Hackathon judges often need to assess many projects in a short period. Projects can use unfamiliar technologies, presentations may not fully reflect implementation progress, and judges may interpret scoring criteria differently.

HackJudge AI aims to make this process more organized, transparent, evidence-based, and consistent.
Goals
- Reduce the time required to review each submission.
- Separate technical complexity from implementation quality.
- Provide clear explanations for suggested scores.
- Apply a consistent, configurable rubric to every team.
- Help judges identify missing evidence and ask useful follow-up questions.
- Keep final scoring decisions in the hands of human judges.
Features
MVP Features
- Project submissions: Store project title, description, problem statement, solution, tech stack, team details, and links.
- Judge dashboard: Browse assigned projects and track evaluation status.
- Configurable scoring rubric: Set criteria and weights for a hackathon.
- Scorecards and feedback: Record criterion-level scores, comments, strengths, and areas for improvement.
- AI evaluation assistant: Generate preliminary analysis and scoring suggestions from the information provided.
- Leaderboard: Calculate weighted scores and rank eligible submissions.
- Authentication and roles: Support organizer, judge, and team roles.
- Evaluation history: Keep a record of submitted scores and feedback.
Planned Enhancements
- GitHub repository analysis, with team authorization where required.
- Presentation and document analysis.
- Demo review and evidence linking.
- Judge disagreement alerts.
- AI-generated questions for project teams.
- Similarity checks to help identify potentially duplicated submissions.
- CSV export of results and reports.
AI-generated findings are recommendations, not proof. The interface should clearly distinguish verified evidence, team-provided claims, and AI inferences.

Judging Rubric
The following is an example rubric. Organizers should be able to customize criteria and weights for each event.
Criterion	Example Weight	What Judges Consider
Innovation	20%	Originality and differentiation
Technical Complexity	20%	Engineering challenges, technical depth, and design decisions
Implementation	25%	Working functionality, completeness, and supporting evidence
Real-World Impact	15%	Importance of the problem and potential value
UX and Usability	10%	Accessibility, clarity, and ease of use
Presentation	10%	Demo quality and clarity of explanation
Total	100%	


For a criterion scored from 0 to 10, its weighted contribution is:

(criterion score / 10) × criterion weight

The final score is the sum of all weighted contributions. For example, a score of 8/10 in a criterion weighted at 20% contributes 16 points out of 100.
How It Works
1. Create an event: An organizer sets event details, criteria, weights, and judge assignments.
2. Submit a project: A team adds its project description, technologies, repository, presentation, and demo links.
3. Analyze the submission: The system organizes the supplied evidence and may request an AI-generated analysis.
4. Review the report: Judges inspect strengths, limitations, complexity indicators, and questions for the team.
5. Score the project: Judges enter or adjust criterion-level scores and comments.
6. Calculate results: The system computes weighted scores and shows the leaderboard according to event rules.
Tech Stack
MERN Stack
- MongoDB — document database for users, events, submissions, and evaluations.
- Express.js — REST API and server-side middleware.
- React — frontend dashboard and judging interface.
- Node.js — JavaScript runtime for the backend.
Supporting Tools
- Mongoose — MongoDB object modeling.
- JWT or secure session authentication — authentication strategy.
- bcrypt — password hashing if local password authentication is implemented.
- Tailwind CSS or Bootstrap — UI styling (choose one).
- An LLM API — optional AI-powered analysis and feedback.
- GitHub API — optional repository metadata and code review integrations.
- Multer and object storage — optional upload handling for presentations and documents.
Choose supported, maintained versions of dependencies when setting up the project.
Architecture
React Client
    |
    | HTTPS / JSON
    v
Express.js REST API (Node.js)
    |
    +---- Authentication & Authorization
    |
    +---- Events and Submissions
    |
    +---- Judging and Score Calculation
    |
    +---- AI Evaluation Service (optional)
    |          |
    |          +---- LLM API
    |          +---- Authorized Repository Analysis
    |
    v
MongoDB (Mongoose)
The AI integration should run on the server. Never expose private API keys in React environment variables or browser code.
Getting Started
Prerequisites
Install the following before starting:
- Node.js (a current supported LTS release)
- npm
- MongoDB locally or a MongoDB Atlas cluster
- Git
1. Clone the repository
git clone https://github.com/YOUR_USERNAME/hackjudge-ai.git
cd hackjudge-ai
Replace YOUR_USERNAME with your GitHub username and update the repository URL if needed.
2. Set up the backend
mkdir server
cd server
npm init -y
npm install express mongoose cors dotenv
npm install --save-dev nodemon
Add the following scripts to the scripts section of server/package.json:
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
Create server/server.js:
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
Create server/.env using the variables in the Environment Variables section. Do not commit this file.

Run the backend:
npm run dev
Check http://localhost:5000/api/health to confirm the server is running.
3. Set up the frontend
From the repository root, open a new terminal:
npm create vite@latest client -- --template react
cd client
npm install
npm install axios react-router-dom
npm run dev
Vite will display the local frontend URL in the terminal, commonly http://localhost:5173.
4. Connect frontend and backend
Create client/.env:
VITE_API_URL=http://localhost:5000/api
Example Axios client:
// client/src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

export default api;
Use this client to call your Express API from React components. Add authentication headers or cookie handling when you implement authentication.
Environment Variables
server/.env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/hackjudge
CLIENT_URL=http://localhost:5173

# Optional: configure only if AI analysis is implemented
LLM_API_KEY=
GITHUB_TOKEN=
client/.env
VITE_API_URL=http://localhost:5000/api
Important: Keep LLM_API_KEY, GITHUB_TOKEN, database credentials, and other secrets on the server. Any variable prefixed with VITE_ is bundled for client-side use and must not contain secrets. Add .env files to .gitignore.
Suggested Project Structure
hackjudge-ai/
├── client/
│   ├── public/
│   └── src/
│       ├── api.js
│       ├── components/
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── ProjectDetails.jsx
│       │   ├── JudgeEvaluation.jsx
│       │   └── Leaderboard.jsx
│       ├── hooks/
│       ├── context/
│       ├── App.jsx
│       └── main.jsx
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   │   ├── scoringService.js
│   │   └── aiEvaluationService.js
│   ├── utils/
│   ├── server.js
│   └── .env
├── .gitignore
└── README.md
This is a suggested structure; create folders as you implement the corresponding features.
API Overview
Suggested REST endpoints (these need to be implemented):
Method	Endpoint	Purpose
POST	/api/auth/register	Register a user
POST	/api/auth/login	Authenticate a user
GET	/api/events	List events available to the current user
POST	/api/events	Create an event (organizer)
GET	/api/events/:eventId/submissions	List event submissions
POST	/api/events/:eventId/submissions	Submit a project
GET	/api/submissions/:submissionId	View project details
POST	/api/submissions/:submissionId/evaluations	Create or update a judge evaluation
POST	/api/submissions/:submissionId/ai-analysis	Request AI analysis
GET	/api/events/:eventId/leaderboard	Get ranked results


Protect routes with authentication and role-based authorization. Validate request bodies, check event membership, and ensure judges can only access submissions assigned to them where applicable.
Data Models
Suggested MongoDB collections:
User
- name
- email (unique)
- passwordHash (never store plaintext passwords)
- role (organizer, judge, or team)
- createdAt
Event
- name
- description
- rubric (criteria and weights)
- organizerId
- judgeIds
- status (draft, active, or completed)
- createdAt
Submission
- eventId
- teamName
- projectTitle
- description
- problemStatement
- solution
- techStack
- repositoryUrl
- demoUrl
- presentationUrl
- status
- createdAt
Evaluation
- eventId
- submissionId
- judgeId
- criterionScores
- comments
- strengths
- improvementAreas
- status (draft or submitted)
- updatedAt
AI Analysis (optional)
- submissionId
- model
- summary
- complexityAnalysis
- evidence
- suggestedScores
- limitations
- createdAt
Store AI reports separately if they need independent versioning. Define appropriate indexes, access rules, and data-retention policies before production deployment.
AI Evaluation Principles
AI-assisted evaluations should:
1. Use the same rubric for submissions in the same judging category.
2. Explain each suggested score with supporting evidence.
3. Separate verified repository or demo evidence from claims supplied by the team.
4. Treat missing information as unknown, not automatic proof of poor quality.
5. Assess complexity based on engineering challenges and design decisions—not just lines of code, file count, or number of technologies.
6. Evaluate complexity separately from implementation completeness.
7. Indicate uncertainty and allow judges to override suggestions.
8. Avoid inferring a team's ability or project quality from personal or demographic characteristics.
9. Treat repository content and uploaded documents as untrusted input, not as instructions to the AI.
10. Require human review before final results are published.
Security Considerations
- Hash passwords with a suitable password-hashing algorithm.
- Validate and sanitize input on the server.
- Enforce role-based access control on every protected route.
- Restrict CORS to known frontend origins in production.
- Apply rate limits to authentication and AI endpoints.
- Set upload size and file-type limits; scan uploads when appropriate.
- Keep API keys and credentials out of source control and client bundles.
- Use HTTPS in production.
- Treat external repository URLs carefully to prevent server-side request forgery (SSRF); allowlist supported hosts and validate redirects.
- Do not execute submitted code as part of repository analysis.
- Obtain permission before accessing private repositories or storing team submissions.
- Protect judge comments and unpublished scores from unauthorized access.
Roadmap
- [ ] Initialize MERN application
- [ ] Build authentication and user roles
- [ ] Create event management
- [ ] Implement project submission forms
- [ ] Build judge dashboard and evaluation scorecards
- [ ] Implement configurable weighted scoring
- [ ] Create leaderboard and export
- [ ] Add AI-generated evaluation reports
- [ ] Add evidence references and uncertainty indicators
- [ ] Integrate authorized GitHub repository analysis
- [ ] Add judge disagreement alerts
- [ ] Write tests and deploy the application
Contributing
Contributions, suggestions, and bug reports are welcome.
1. Fork the repository.
2. Create a feature branch: git checkout -b feature/your-feature.
3. Commit your changes: git commit -m "Add your feature".
4. Push your branch and open a pull request.
For larger changes, open an issue first to discuss the proposed implementation.
License
No license has been selected yet. Add a LICENSE file before distributing or accepting external contributions. If you choose an open-source license, update this section to match it.