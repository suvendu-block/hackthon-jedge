import mongoose from 'mongoose';
import Submission from '../models/submission.model.js';
import Event from '../models/event.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// same 404-on-bad-or-missing id pattern as events
const findSubmissionOr404 = async (id) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError('Submission not found', 404, 'NOT_FOUND');
    }
    const sub = await Submission.findById(id)
        .populate('event', 'name status organizer judges')
        .populate('team', 'name email');
    if (!sub) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    return sub;
};

// can this user see this submission? (team owner, event organizer, assigned judge)
const canView = (sub, user) => {
    if (sub.team._id.toString() === user._id.toString()) return true;
    if (sub.event.organizer._id.toString() === user._id.toString()) return true;
    return sub.event.judges.some(j => j._id.toString() === user._id.toString());
};


/// submit — a team enters a project into a published event
export const createSubmission = catchAsync(async (req, res) => {
    const { eventId } = req.params;

    if (!mongoose.isValidObjectId(eventId)) {
        throw new AppError('Event not found', 404, 'NOT_FOUND');
    }
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404, 'NOT_FOUND');

    // only teams submit — judges/organizers don't have projects here
    if (req.user.role !== 'team') {
        throw new AppError('Only teams can submit projects', 403, 'NOT_A_TEAM');
    }

    // the event has to be actually accepting work
    if (event.status === 'draft') {
        throw new AppError('Submissions open once the organizer publishes the event', 409, 'NOT_PUBLISHED');
    }
    if (event.status === 'closed') {
        throw new AppError('Submissions are closed for this event', 409, 'EVENT_CLOSED');
    }

    // one per team per event (the unique index would 500 otherwise)
    const existing = await Submission.findOne({ event: eventId, team: req.user._id });
    if (existing) {
        throw new AppError('You already have a submission in this event — edit it instead', 409, 'ALREADY_SUBMITTED');
    }

    const sub = await Submission.create({
        ...req.body,
        event: eventId,
        team: req.user._id
    });

    res.status(201).json(sub);
});


/// list — scoped by role: teams see their own, judges/organizers see the event's
export const listSubmissions = catchAsync(async (req, res) => {
    const { eventId } = req.params;

    if (!mongoose.isValidObjectId(eventId)) {
        throw new AppError('Event not found', 404, 'NOT_FOUND');
    }
    const event = await Event.findById(eventId);
    if (!event) throw new AppError('Event not found', 404, 'NOT_FOUND');

    const isOrganizer = event.organizer.toString() === req.user._id.toString();
    const isJudge = event.judges.some(j => j.toString() === req.user._id.toString());

    if (!isOrganizer && !isJudge) {
        // teams get filtered to their own in the query below, everyone else
        // who isn't attached to the event gets nothing
        if (req.user.role !== 'team') {
            throw new AppError('Not your event', 403, 'FORBIDDEN');
        }
    }

    const filter = { event: eventId };
    if (!isOrganizer && !isJudge) {
        filter.team = req.user._id;   // a team only ever sees its own entry
    }

    const subs = await Submission.find(filter)
        .populate('team', 'name email')
        .sort('-createdAt');

    res.json(subs);
});


/// detail — team owner, event organizer, or assigned judge
export const getSubmission = catchAsync(async (req, res) => {
    const sub = await findSubmissionOr404(req.params.id);
    if (!canView(sub, req.user)) {
        throw new AppError('Not your submission', 403, 'FORBIDDEN');
    }
    res.json(sub);
});


/// update — team owner only, and only while the event is still open
export const updateSubmission = catchAsync(async (req, res) => {
    const sub = await findSubmissionOr404(req.params.id);

    if (sub.team._id.toString() !== req.user._id.toString()) {
        throw new AppError('Only the submitting team can edit', 403, 'FORBIDDEN');
    }
    if (sub.event.status === 'closed') {
        throw new AppError('Judging has closed — submissions are locked', 409, 'SUBMISSION_LOCKED');
    }

    Object.assign(sub, req.body);
    await sub.save();

    res.json(sub);
});


/// delete — team owner only, before judging closes
export const deleteSubmission = catchAsync(async (req, res) => {
    const sub = await findSubmissionOr404(req.params.id);

    if (sub.team._id.toString() !== req.user._id.toString()) {
        throw new AppError('Only the submitting team can withdraw', 403, 'FORBIDDEN');
    }
    if (sub.event.status === 'closed') {
        throw new AppError('Judging has closed — cannot withdraw now', 409, 'SUBMISSION_LOCKED');
    }

    await sub.deleteOne();
    res.json({ message: 'Submission withdrawn' });
});
