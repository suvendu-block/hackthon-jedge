import mongoose from 'mongoose';
import QAReport from '../models/qaReport.model.js';
import Submission from '../models/submission.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { runQAReport } from '../services/qaReportService.js';
import { loadArtifacts } from './aiAnalysis.controller.js';

/// qaReport controller — the project quality card (ratings, errors,
/// capacity). The submitting team asks about its own build, the assigned
/// judge asks before scoring, everyone who may see the submission reads the
/// stored card. Inputs are stored artifacts only — no live fetches here.

const loadSubmission = async (id) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError('Submission not found', 404, 'NOT_FOUND');
    }
    const sub = await Submission.findById(id)
        .populate('event', 'name status organizer judges')
        .populate('team', 'name');
    if (!sub) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    return sub;
};

const isOwner = (sub, user) => sub.team._id.toString() === user._id.toString();
const isAssignedJudge = (sub, user) => sub.event.judges.some(j => j._id.toString() === user._id.toString());
const isOrganizer = (sub, user) => sub.event.organizer._id.toString() === user._id.toString();

// running a report: the owning team (it's their project) or the assigned judge
const assertCanRun = (sub, user) => {
    if (!isOwner(sub, user) && !isAssignedJudge(sub, user)) {
        throw new AppError('Only your team or the assigned judge can run a quality report', 403, 'FORBIDDEN');
    }
};

// reading: same audience as the submission itself — nobody else
const assertCanView = (sub, user) => {
    if (!isOwner(sub, user) && !isAssignedJudge(sub, user) && !isOrganizer(sub, user)) {
        throw new AppError('Not your submission', 404, 'NOT_FOUND');
    }
};

// a run during judging only — closed events already have their cards
const assertJudgingOpen = (sub) => {
    if (sub.event.status === 'closed') {
        throw new AppError('This event is closed', 409, 'EVENT_CLOSED');
    }
};


/// POST /api/submissions/:id/qa-report — generate + store a fresh card
export const requestQaReport = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertCanRun(sub, req.user);
    assertJudgingOpen(sub);

    const artifacts = await loadArtifacts(sub._id);

    // fails closed like the judging assistant: no key → 503, provider hiccup →
    // 503, malformed output → 503. an error here stores exactly nothing.
    const { report, model } = await runQAReport({ submission: sub, artifacts });

    const doc = await QAReport.create({
        submission: sub._id,
        model,
        // which inputs the card leaned on — the UI shows this under the card
        inputs: {
            repository: Boolean(artifacts.insight),
            documents: artifacts.documents?.length || 0,
            demo: Boolean(artifacts.demoCheck)
        },
        ...report
    });
    res.status(201).json(doc);
});


/// GET /api/submissions/:id/qa-report — latest stored card, if any
export const getQaReport = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertCanView(sub, req.user);

    const doc = await QAReport.findOne({ submission: sub._id }).sort('-createdAt');
    if (!doc) throw new AppError('No quality report yet for this submission', 404, 'NO_QA_REPORT');
    res.json(doc);
});
