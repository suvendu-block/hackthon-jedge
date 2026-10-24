import mongoose from 'mongoose';
import Submission from '../models/submission.model.js';
import DemoCheck from '../models/demoCheck.model.js';
import JudgeEvidence from '../models/judgeEvidence.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { checkDemo } from '../services/demoService.js';

/// evidence controller — demo review + judge evidence linking (BL-11).
/// demo checks are server-side facts (verified); judge evidence notes are a
/// judge's own record, optionally tied to a rubric criterion, visible only
/// to the judge who wrote them.

const loadSubmission = async (id) => {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    const sub = await Submission.findById(id)
        .populate('event', 'name status organizer judges rubric')
        .populate('team', 'name email');
    if (!sub) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    return sub;
};

const isOwner = (sub, user) => sub.team._id.toString() === user._id.toString();
const isAssignedJudge = (sub, user) => sub.event.judges.some(j => j._id.toString() === user._id.toString());
const isOrganizer = (sub, user) => sub.event.organizer._id.toString() === user._id.toString();

const assertCanView = (sub, user) => {
    if (!isOwner(sub, user) && !isAssignedJudge(sub, user) && !isOrganizer(sub, user)) {
        throw new AppError('Not your submission', 404, 'NOT_FOUND');
    }
};

const assertAssignedJudge = (sub, user) => {
    if (!isAssignedJudge(sub, user)) {
        throw new AppError('Only the assigned judge works on this submission', 403, 'FORBIDDEN');
    }
};

// ---- demo review ----------------------------------------------------------

// POST /api/submissions/:id/demo/check — owning team or assigned judge.
// the fetch itself can't fail the request: a dead or blocked demo is a
// recorded result.
export const checkDemoLink = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    if (!isOwner(sub, req.user) && !isAssignedJudge(sub, req.user)) {
        throw new AppError('Only your team or the assigned judge can check the demo', 403, 'FORBIDDEN');
    }
    if (!sub.demoUrl) {
        throw new AppError('Add a demo URL to your submission first', 422, 'NO_DEMO_URL');
    }

    const result = await checkDemo(sub.demoUrl);
    const check = await DemoCheck.create({
        submission: sub._id,
        url: sub.demoUrl,
        reachable: result.reachable,
        httpStatus: result.httpStatus,
        title: result.title,
        error: result.error,
        checkedBy: req.user._id
    });

    res.status(201).json({ check });
});

// GET /api/submissions/:id/demo/check — latest recorded check, if any
export const getDemoStatus = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertCanView(sub, req.user);

    const check = await DemoCheck.findOne({ submission: sub._id })
        .sort({ createdAt: -1 });
    res.json({ check, demoUrl: sub.demoUrl || '' });
});

// ---- judge evidence notes -------------------------------------------------

// POST /api/submissions/:id/evidence — assigned judge only. criterion must
// name a real rubric row when given, so linked notes can't drift off-rubric.
export const addJudgeEvidence = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertAssignedJudge(sub, req.user);

    const { criterion, type, text, source } = req.body;

    if (criterion) {
        // rubric rows carry their label in `name` — match case-insensitively
        // so "impact" from a select box lands as "Impact"
        const names = (sub.event.rubric || []).map(r => r.name);
        const match = names.find(n => n && n.toLowerCase() === criterion.toLowerCase());
        if (!match) throw new AppError('Unknown rubric criterion', 422, 'UNKNOWN_CRITERION');
        req.body.criterion = match;
    }

    const mine = await JudgeEvidence.countDocuments({
        submission: sub._id,
        judge: req.user._id
    });
    if (mine >= 20) throw new AppError('Evidence note limit reached for this submission', 429, 'EVIDENCE_CAPPED');

    const evidence = await JudgeEvidence.create({
        submission: sub._id,
        judge: req.user._id,
        criterion: req.body.criterion || null,
        type,
        text,
        source: source || ''
    });

    res.status(201).json({ evidence });
});

// GET /api/submissions/:id/evidence — assigned judge sees their own notes,
// the organizer sees every judge's for this submission
export const listJudgeEvidence = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    const me = req.user;

    let filter;
    if (isAssignedJudge(sub, me)) {
        filter = { submission: sub._id, judge: me._id };
    } else if (isOrganizer(sub, me)) {
        filter = { submission: sub._id };
    } else {
        // teams never see judge reasoning before results are out
        throw new AppError('Judge evidence is not visible here', 403, 'FORBIDDEN');
    }

    const evidence = await JudgeEvidence.find(filter)
        .populate('judge', 'name email')
        .sort({ createdAt: -1 });
    res.json({ evidence });
});

// DELETE /api/submissions/:id/evidence/:evidenceId — only the note's author
export const deleteJudgeEvidence = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertAssignedJudge(sub, req.user);

    if (!mongoose.isValidObjectId(req.params.evidenceId)) throw new AppError('Evidence not found', 404, 'NOT_FOUND');
    const evidence = await JudgeEvidence.findOne({
        _id: req.params.evidenceId,
        submission: sub._id,
        judge: req.user._id
    });
    if (!evidence) throw new AppError('Evidence not found', 404, 'NOT_FOUND');

    await evidence.deleteOne();
    res.json({ deleted: true });
});
