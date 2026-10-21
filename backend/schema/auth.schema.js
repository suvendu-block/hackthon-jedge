import { z } from 'zod';

// strict() = extra unknown fields get rejected instead of silently dropped
// (catches typos like "emial" before they reach the DB)

export const registerSchema = z.strictObject({
    name: z.string().trim().min(2, 'Name is too short'),
    email: z.string().trim().toLowerCase().email('That does not look like an email'),
    password: z.string().min(8, 'Password must be at least 8 characters long.....'),
    role: z.enum(['organizer', 'judge', 'team'], 'role must be organizer, judge or team')
});

export const loginSchema = z.strictObject({
    email: z.string().trim().toLowerCase().email('That does not look like an email'),
    password: z.string().min(1, 'Password is required')
});
