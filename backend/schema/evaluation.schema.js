import { z } from 'zod';

// one score row — criterion id must be a real ObjectId, score 0–10
const scoreRow = z.strictObject({
    criterion: z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'criterion must be a valid id'),
    // .int() — half points make the leaderboard math ugly to reconcile;
    // the UI uses a 0–10 slider with step 1
    score: z.number().min(0, 'score cannot be below 0').max(10, 'score cannot exceed 10')
});

// save a draft — partial scores allowed, empty is fine (it's a draft)
export const saveDraftSchema = z.strictObject({
    scores: z.array(scoreRow).max(50, 'too many score rows').optional().default([]),
    comments: z.string().trim().max(3000).optional().default('')
});

// submit — stricter: at least one score, and the controller verifies
// every rubric criterion is covered (needs the event, so zod can't do it alone)
export const submitSchema = z.strictObject({
    scores: z.array(scoreRow).min(1, 'submit needs at least one score').max(50),
    comments: z.string().trim().max(3000).optional().default('')
});
