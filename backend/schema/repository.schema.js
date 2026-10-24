import { z } from 'zod';

// Phase 7 request bodies — grant (optional team token) and judge evidence.

// a GitHub fine-grained/classic read token, as-is. capped tight; anything
// longer than this is a paste mistake, not a token.
export const grantRepoSchema = z.strictObject({
    token: z.string().trim().min(8, 'Token looks too short').max(200).optional()
});

// private-IP literals the demoUrl field must never accept (DNS-level checks
// happen again at fetch time — this is just the first gate)
const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/i;

export const evidenceSchema = z.strictObject({
    // must match a rubric criterion name when given; null = general note
    criterion: z.string().trim().max(80).optional().nullable(),
    type: z.enum(['verified-evidence', 'team-claim']),
    text: z.string().trim().min(3, 'Write at least a sentence').max(1000),
    // where it was checked: demo URL, repo path, document name
    source: z.string().trim().max(300).optional().default('')
});

export const isPrivateHostLiteral = (hostname) => PRIVATE_HOST.test(String(hostname || ''));
