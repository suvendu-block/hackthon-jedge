import { z } from 'zod';

// the allowlist — only these protocols may appear in a link.
// this is what stops javascript:alert(1) or data:... from reaching a judge's browser.
const SAFE_PROTOCOLS = ['http:', 'https:'];

// validate one link: must be a real http(s) URL, nothing sneaky
const linkSchema = z.object({
    label: z.string().trim().min(1, 'Link needs a label').max(60),
    url: z.string().trim().max(500)
        .refine((val) => {
            try {
                const u = new URL(val);
                return SAFE_PROTOCOLS.includes(u.protocol);
            } catch {
                return false;   // not parseable → definitely not allowed
            }
        }, 'Link must be a valid http(s) URL')
});

export const createSubmissionSchema = z.strictObject({
    projectName: z.string().trim().min(2, 'Project name is too short').max(100),
    tagline: z.string().trim().max(200).optional().default(''),
    description: z.string().trim().max(5000).optional().default(''),
    links: z.array(linkSchema).max(10, 'At most 10 links').optional().default([])
});

// update: same shape, all optional — teams can revise until the event closes
export const updateSubmissionSchema = z.strictObject({
    projectName: z.string().trim().min(2, 'Project name is too short').max(100).optional(),
    tagline: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    links: z.array(linkSchema).max(10, 'At most 10 links').optional()
}).refine(
    (body) => Object.keys(body).length > 0,
    { message: 'Nothing to update — send at least one field' }
);
