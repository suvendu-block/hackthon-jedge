import express from 'express';
import {
    createSubmission,
    listSubmissions,
    getSubmission,
    updateSubmission,
    deleteSubmission
} from '../controller/submission.controller.js';
import { requestAnalysis, getAnalysis } from '../controller/aiAnalysis.controller.js';
import {
    grantRepository, revokeRepository, getGrantStatus,
    refreshInsight, getInsight
} from '../controller/repository.controller.js';
import {
    uploadDocument, listDocuments, downloadDocument, deleteDocument
} from '../controller/documents.controller.js';
import {
    checkDemoLink, getDemoStatus,
    addJudgeEvidence, listJudgeEvidence, deleteJudgeEvidence
} from '../controller/evidence.controller.js';
import { uploadSingle } from '../middleware/upload.middleware.js';
import { protect, requireRole } from '../middleware/auth.middleware.js';
import rateLimit from '../middleware/rateLimit.middleware.js';
import validate from '../middleware/validate.middleware.js';
import { createSubmissionSchema, updateSubmissionSchema } from '../schema/submission.schema.js';
import { grantRepoSchema, evidenceSchema } from '../schema/repository.schema.js';

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

// ---- Phase 7: evidence depth ----------------------------------------------
// GitHub grant + insight (team authorization is the M7 gate), documents,
// demo checks, judge evidence notes. external calls are metered per user.

const insightLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,                       // GitHub's unauthenticated budget is 60/h — stay under it
    keyFn: (req) => `repo-insight:${req.user._id}`
});
const demoLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    keyFn: (req) => `demo-check:${req.user._id}`
});
const uploadLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    keyFn: (req) => `uploads:${req.user._id}`
});

// repository — grant/refresh are the owning team's; everyone with a view
// of the submission can read grant status and insight
byId.post('/:id/repo/grant', requireRole('team'), validate(grantRepoSchema), grantRepository);
byId.delete('/:id/repo/grant', requireRole('team'), revokeRepository);
byId.get('/:id/repo/grant', getGrantStatus);
byId.post('/:id/repo/insight', insightLimit, refreshInsight);
byId.get('/:id/repo/insight', getInsight);

// documents — teams upload, readers download; multer's caps live in the middleware
byId.post('/:id/documents', requireRole('team'), uploadLimit, uploadSingle('file'), uploadDocument);
byId.get('/:id/documents', listDocuments);
byId.get('/:id/documents/:docId/download', downloadDocument);
byId.delete('/:id/documents/:docId', requireRole('team'), deleteDocument);

// demo — team verifies before submitting, judge re-checks during review
byId.post('/:id/demo/check', demoLimit, checkDemoLink);
byId.get('/:id/demo/check', getDemoStatus);

// judge evidence notes — assigned judge's own work product; the organizer
// reads the field's notes but never writes any
byId.post('/:id/evidence', requireRole('judge'), validate(evidenceSchema), addJudgeEvidence);
byId.get('/:id/evidence', requireRole('judge', 'organizer'), listJudgeEvidence);
byId.delete('/:id/evidence/:evidenceId', requireRole('judge'), deleteJudgeEvidence);

export { eventScoped, byId };
