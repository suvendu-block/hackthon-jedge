import mongoose from 'mongoose';
import Evaluation from '../models/evaluation.model.js';
import Submission from '../models/submission.model.js';
import Event from '../models/event.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { totalScore, checkScoresComplete } from '../services/scoringService.js';

// load a submission + its event, 404 on bad/missing id
const loadSubmission = async (id) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError('Submission not found', 404, 'NOT_FOUND');
    }
    // keep 'rubric' in the select — scoring math reads it
    const sub = await Submission.findById(id).populate('event', 'name status organizer judges rubric');
    if (!sub) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    return sub;
};

// only a judge assigned to this event may score it
const ensureAssignedJudge = (sub, user) => {
    if (user.role !== 'judge') {
        throw new AppError('Only judges can score submissions', 403, 'NOT_A_JUDGE');
    }
    const assigned = sub.event.judges.some(j => j.toString() === user._id.toString());
    if (!assigned) {
        throw new AppError('You are not assigned to this event', 403, 'NOT_ASSIGNED');
    }
};

// judging only happens while the event is open for it
const ensureJudgingOpen = (sub) => {
    if (sub.event.status === 'draft') {
        throw new AppError('Judging opens when the event is published', 409, 'NOT_PUBLISHED');
    }
    if (sub.event.status === 'closed') {
        throw new AppError('Judging is closed for this event', 409, 'EVENT_CLOSED');
    }
};


/// get-or-create my scorecard for a submission — the scorecard screen loads this
export const getMyEvaluation = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    ensureAssignedJudge(sub, req.user);
    ensureJudgingOpen(sub);

    let ev = await Evaluation.findOne({ submission: sub._id, judge: req.user._id });

    if (!ev) {
        // start a draft on first open — cheap, and makes the UI stateless
        ev = await Evaluation.create({
            submission: sub._id,
            event: sub.event._id,
            judge: req.user._id,
            scores: [],
            status: 'draft'
        });
    }

    res.json({
        evaluation: ev,
        rubric: sub.event.rubric,     // criteria the scorecard renders
        submission: { _id: sub._id, projectName: sub.projectName, tagline: sub.tagline }
    });
});


/// save draft — partial scores welcome, total kept current either way
export const saveDraft = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    ensureAssignedJudge(sub, req.user);
    ensureJudgingOpen(sub);

    let ev = await Evaluation.findOne({ submission: sub._id, judge: req.user._id });
    if (!ev) {
        ev = new Evaluation({ submission: sub._id, event: sub.event._id, judge: req.user._id });
    }

    // a submitted scorecard goes back to draft only via explicit reopen —
    // silent edits after submit would undermine "final"
    if (ev.status === 'submitted') {
        throw new AppError('Already submitted — ask the organizer to reopen', 409, 'ALREADY_SUBMITTED');
    }

    ev.scores = req.body.scores ?? [];
    ev.comments = req.body.comments ?? '';
    ev.total = totalScore(sub.event.rubric, ev.scores);
    await ev.save();

    res.json(ev);
});


/// submit — every criterion must be scored; math via scoringService (ADR-0005)
export const submitEvaluation = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    ensureAssignedJudge(sub, req.user);
    ensureJudgingOpen(sub);

    let ev = await Evaluation.findOne({ submission: sub._id, judge: req.user._id });
    if (!ev) {
        ev = new Evaluation({ submission: sub._id, event: sub.event._id, judge: req.user._id });
    }

    if (ev.status === 'submitted') {
        throw new AppError('Scorecard already submitted', 409, 'ALREADY_SUBMITTED');
    }

    ev.scores = req.body.scores;
    ev.comments = req.body.comments ?? '';

    // save first, then check completeness — a failed submit shouldn't wipe their work
    ev.total = totalScore(sub.event.rubric, ev.scores);
    await ev.save();

    // completeness: all rubric criteria covered, scores in range
    const problems = checkScoresComplete(sub.event.rubric, ev.scores);
    if (problems.length > 0) {
        throw new AppError(`Cannot submit: ${problems.join('; ')}`, 422, 'INCOMPLETE_SCORES');
    }

    ev.status = 'submitted';
    ev.submittedAt = new Date();
    await ev.save();

    res.json(ev);
});


/// my queue — every open submission + whether I've scored it (judge home)
export const myEvaluations = catchAsync(async (req, res) => {
    const mine = await Evaluation.find({ judge: req.user._id })
        .populate({ path: 'submission', select: 'projectName tagline event' })
        .sort('-updatedAt');

    res.json(mine);
});
