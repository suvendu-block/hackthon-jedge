import { z } from 'zod';
import { isPrivateHostLiteral } from './repository.schema.js';

// the allowlist — only these protocols may appear in a link.
// this is what stops javascript:alert(1) or data:... from reaching a judge's browser.
const SAFE_PROTOCOLS = ['http:', 'https:'];

// a plain GitHub repository link — Phase 7 analysis only understands github.com
const GITHUB_REPO = /^https:\/\/github\.com\/[\w.-]{1,100}\/[\w.-]{1,100}(?:\.git)?\/?$/;

// validate one link: must be a real http(s) URL, nothing sneaky, and never a
// private-network literal (169.254.169.254 has no business in a link list)
const linkSchema = z.object({
    label: z.string().trim().min(1, 'Link needs a label').max(60),
    url: z.string().trim().max(500)
        .refine((val) => {
            try {
                const u = new URL(val);
                if (!SAFE_PROTOCOLS.includes(u.protocol)) return false;
                return !isPrivateHostLiteral(u.hostname);
            } catch {
                return false;   // not parseable → definitely not allowed
            }
        }, 'Link must be a valid http(s) URL outside private networks')
});

// repository field: github.com/owner/repo over https, full stop
const repositoryUrlSchema = z.string().trim().max(300)
    .refine((val) => val === '' || GITHUB_REPO.test(val),
        'Repository must look like https://github.com/owner/repo');

// demo field: https only, and never a private-network literal — the server
// re-checks DNS + redirects when it actually fetches (SECURITY §6)
const demoUrlSchema = z.string().trim().max(500)
    .refine((val) => {
        if (val === '') return true;
        try {
            const u = new URL(val);
            return u.protocol === 'https:' && !isPrivateHostLiteral(u.hostname);
        } catch {
            return false;
        }
    }, 'Demo must be an https URL outside private networks');

export const createSubmissionSchema = z.strictObject({
    projectName: z.string().trim().min(2, 'Project name is too short').max(100),
    tagline: z.string().trim().max(200).optional().default(''),
    description: z.string().trim().max(5000).optional().default(''),
    links: z.array(linkSchema).max(10, 'At most 10 links').optional().default([]),
    repositoryUrl: repositoryUrlSchema.optional().default(''),
    demoUrl: demoUrlSchema.optional().default('')
});

// update: same shape, all optional — teams can revise until the event closes
export const updateSubmissionSchema = z.strictObject({
    projectName: z.string().trim().min(2, 'Project name is too short').max(100).optional(),
    tagline: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    links: z.array(linkSchema).max(10, 'At most 10 links').optional(),
    repositoryUrl: repositoryUrlSchema.optional(),
    demoUrl: demoUrlSchema.optional()
}).refine(
    (body) => Object.keys(body).length > 0,
    { message: 'Nothing to update — send at least one field' }
);
