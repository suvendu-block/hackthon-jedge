# Security Policies — HackJudge AI

Security requirements for developing and operating HackJudge AI. Treat these
as blocking requirements: a feature that violates them does not ship.

## 1. Authentication and Passwords

- Hash passwords with a suitable password-hashing algorithm (bcrypt, or
  argon2/scrypt). **Never store or log plaintext passwords.**
- Minimum password length 8 characters; reject commonly-compromised passwords
  where feasible.
- Tokens (JWT/session) have a finite expiry; logout invalidates sessions.
- Login and registration endpoints are rate-limited and return uniform errors
  (no user enumeration).

## 2. Authorization

- **Enforce role-based access control on every protected route** — organizer,
  judge, team.
- Judges may access only submissions assigned to them.
- Teams may access only their own submissions and released feedback.
- Validate event membership on cross-entity requests (a valid token alone is
  not permission).
- Unpublished scores and judge comments are protected until release.

## 3. Input Handling

- Validate and sanitize all input on the server — never trust the client.
- Enforce the JSON body limit (1 MB) and reject oversized payloads.
- Uploads: enforce size limits and file-type (MIME/extension) allowlists;
  scan uploads when appropriate; store outside the web root with random names.
- Use parameterized queries/ODM methods (Mongoose) — no string-built queries.

## 4. Secrets and Configuration

- `LLM_API_KEY`, `GITHUB_TOKEN`, database credentials, session secrets live
  **only** on the server, in environment variables.
- Any variable prefixed with `VITE_` is bundled into client-side code — it
  **must not** contain secrets.
- `.env` files are in `.gitignore` and never committed.
- Rotate any credential the moment it is suspected of exposure.

## 5. Network and Transport

- Use HTTPS in production; redirect HTTP → HTTPS.
- Restrict CORS to known frontend origins in production
  (`CLIENT_URL` allowlist); never `origin: "*"` with credentials.
- Set security headers (helmet: CSP, HSTS, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy).
- Rate-limit authentication and AI endpoints; apply global throttling in
  production.

## 6. External Resources (SSRF and Untrusted Content)

- Treat external repository URLs carefully to prevent **server-side request
  forgery (SSRF)**: allowlist supported hosts (e.g. github.com, gitlab.com),
  validate every redirect, block private/internal IP ranges and link-local
  addresses, and cap response sizes and timeouts.
- **Do not execute submitted code** as part of repository analysis — static
  inspection and metadata only.
- Treat repository content, uploaded documents, and any third-party text as
  **untrusted input**, never as instructions to the AI (prompt-injection
  defense). Wrap external content in clearly delimited data blocks.
- Obtain permission before accessing private repositories or storing team
  submissions.

## 7. AI-Specific Safety

- All LLM calls happen server-side (ADR-0007).
- Validate and schema-check LLM responses before storing or displaying them.
- Never auto-apply AI scores; judges must explicitly accept suggestions.
- Do not send other judges' scores or personal/demographic data in prompts.
- Log model, timestamp, and inputs/outputs per report for auditability — while
  excluding secrets.

## 8. Data Protection

- Least-privilege database credentials.
- Encrypt data in transit (HTTPS) and at rest (managed DB encryption).
- Protect judge comments and unpublished scores from unauthorized access.
- Never log tokens, passwords, or API keys.
- Backups per [OPERATIONS.md](OPERATIONS.md); test restores.

## 9. Dependency and Supply Chain

- Pin versions in lockfiles; commit `package-lock.json`.
- Run `npm audit` regularly; upgrade dependencies with supported, maintained
  versions.
- Review new dependencies before adding (maintenance status, install size,
  transitive risk).

## 10. Operational Practices

- Use HTTPS-only, cookie-based sessions with `HttpOnly`, `Secure`,
  `SameSite` flags where cookies are used.
- Implement consistent error responses that never leak stack traces in
  production.
- Keep an audit trail of rubric changes, score changes, and result releases.

## Vulnerability Reporting

- Report suspected vulnerabilities privately to the project maintainers
  (open a confidential issue or contact the organizer directly) — do not
  disclose publicly before a fix is available.
- Provide reproduction steps, affected endpoint/role, and impact.
- Maintainers acknowledge within 48 hours and prioritize by severity.

## Pre-Release Security Checklist

- [ ] No secrets in client bundle or repo history
- [ ] All routes RBAC-tested
- [ ] CORS locked to production origins
- [ ] Rate limits active on auth + AI endpoints
- [ ] URL allowlist + redirect validation tested (SSRF)
- [ ] Upload limits enforced (when uploads ship)
- [ ] Passwords hashed; no plaintext anywhere
- [ ] HTTPS enforced; security headers set
- [ ] `npm audit` clean of high/critical issues
- [ ] Unpublished scores/comments inaccessible to teams before release

## Related Documents

- [PRIVACY.md](PRIVACY.md) — personal data handling
- [ARCHITECTURE.md](ARCHITECTURE.md) — where controls are enforced
- [SPECIFICATION.md](SPECIFICATION.md) — validation rules
- [TESTING.md](TESTING.md) — security test coverage
