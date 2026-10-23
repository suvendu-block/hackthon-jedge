import express from 'express';
import {
    createSubmission,
    listSubmissions,
    getSubmission,
    updateSubmission,
    deleteSubmission
} from '../controller/submission.controller.js';
import { requestAnalysis, getAnalysis } from '../controller/aiAnalysis.controller.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';
import rateLimit from '../middleware/rateLimit.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { createSubmissionSchema, updateSubmissionSchema } from '../schema/submission.schema.js';

// everything needs a logged-in user
// (applied to both routers below — one guard, two mount points)

// 1) nested under an event: /api/events/:eventId/submissions
//    mergeParams lifts eventId into req.params for the controller
const eventScoped = express.Router({ mergeParams: true });
eventScoped.use(protect);
eventScoped.post('/', validate(createSubmissionSchema), createSubmission);
eventScoped.get('/', listSubmissions);

// 2) standalone by id: /api/submissions/:id
//    a judge opens one project from the list — no eventId in the path
const byId = express.Router();
byId.use(protect);
byId.get('/:id', getSubmission);
byId.put('/:id', validate(updateSubmissionSchema), updateSubmission);
byId.delete('/:id', deleteSubmission);

// AI draft — assigned judges only, and LLM calls are metered so a retry-happy
// judge can't run up the provider bill (10 per judge per hour)
const aiSpendLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    keyFn: (req) => `ai-analysis:${req.user._id}`
});
byId.post('/:id/ai-analysis', requireRole('judge'), aiSpendLimit, requestAnalysis);
byId.get('/:id/ai-analysis', requireRole('judge'), getAnalysis);

export { eventScoped, byId };
