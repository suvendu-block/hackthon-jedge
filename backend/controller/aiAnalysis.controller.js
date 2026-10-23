import mongoose from 'mongoose';
import AIAnalysis from '../models/aiAnalysis.model.js';
import Submission from '../models/submission.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { analyzeSubmission } from '../services/aiEvaluationService.js';

// same load + guard pattern the evaluation controller uses — the analysis
// endpoint sits behind exactly the same doors as scoring itself
const loadSubmission = async (id) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError('Submission not found', 404, 'NOT_FOUND');
    }
    const sub = await Submission.findById(id).populate('event', 'name status organizer judges rubric');
    if (!sub) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    return sub;
};

// only a judge assigned to this event may ask for a draft
const ensureAssignedJudge = (sub, user) => {
    if (user.role !== 'judge') {
        throw new AppError('Only judges can request AI drafts', 403, 'NOT_A_JUDGE');
    }
    const assigned = sub.event.judges.some(j => j.toString() === user._id.toString());
    if (!assigned) {
        throw new AppError('You are not assigned to this event', 403, 'NOT_ASSIGNED');
    }
};

// drafts ride along with live judging — nothing to analyze once it's closed
const ensureJudgingOpen = (sub) => {
    if (sub.event.status === 'draft') {
        throw new AppError('Judging opens when the event is published', 409, 'NOT_PUBLISHED');
    }
    if (sub.event.status === 'closed') {
        throw new AppError('Judging is closed for this event', 409, 'EVENT_CLOSED');
    }
};


/// POST /api/submissions/:id/ai-analysis — generate + store a fresh report
export const requestAnalysis = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    ensureAssignedJudge(sub, req.user);
    ensureJudgingOpen(sub);

    // the service fails closed: no key → 503, provider hiccups → 503,
    // malformed output → 503. an error here stores exactly nothing.
    const { report, model } = await analyzeSubmission({ event: sub.event, submission: sub });

    const doc = await AIAnalysis.create({ submission: sub._id, model, ...report });
    res.status(201).json(doc);
});


/// GET /api/submissions/:id/ai-analysis — latest stored report, if any
export const getAnalysis = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    ensureAssignedJudge(sub, req.user);

    const doc = await AIAnalysis.findOne({ submission: sub._id }).sort('-createdAt');
    if (!doc) throw new AppError('No AI analysis yet for this submission', 404, 'NO_ANALYSIS');
    res.json(doc);
});
