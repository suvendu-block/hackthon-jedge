import { z } from 'zod';

// shared piece: one rubric criterion
const criterion = z.strictObject({
    name: z.string().trim().min(2, 'Criterion name is too short'),
    description: z.string().trim().max(300).optional().default(''),
    // weights are percentages, one decimal place is plenty
    weight: z.number().min(0, 'Weight cannot be negative').max(100, 'Weight cannot exceed 100')
});

// the Σ = 100 rule lives here so bad rubrics never reach mongoose
const rubricSchema = z.array(criterion)
    .max(20, 'A rubric can have at most 20 criteria')
    .superRefine((criteria, ctx) => {
        const total = criteria.reduce((sum, c) => sum + c.weight, 0);
        if (Math.abs(total - 100) > 0.001) {
            ctx.addIssue({
                code: 'custom',
                message: `Rubric weights must add up to 100 (currently ${total})`
            });
        }
    });

// create: everything except judges/status (judges get assigned after, status starts as draft)
export const createEventSchema = z.strictObject({
    name: z.string().trim().min(2, 'Event name is too short').max(100),
    description: z.string().trim().max(1000).optional().default(''),
    rubric: rubricSchema.optional().default([])
});

// update: partial — only the fields you send get validated/changed
export const updateEventSchema = z.strictObject({
    name: z.string().trim().min(2, 'Event name is too short').max(100).optional(),
    description: z.string().trim().max(1000).optional(),
    rubric: rubricSchema.optional(),
    status: z.enum(['draft', 'published', 'closed'], 'status must be draft, published or closed').optional()
}).refine(
    (body) => Object.keys(body).length > 0,
    { message: 'Nothing to update — send at least one field' }
);

// assigning a judge: must be a valid user id
export const assignJudgeSchema = z.strictObject({
    judgeId: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'judgeId must be a valid user id')
});
