import mongoose from 'mongoose';
import Event from '../models/event.model.js';
import User from '../models/user.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

// helper — organizer-only edits: anyone else gets a 403
const ensureOwner = (event, user) => {
    if (event.organizer.toString() !== user._id.toString()) {
        throw new AppError('Only the organizer can change this event', 403, 'FORBIDDEN');
    }
};

// helper — same 404 whether the event is missing or just malformed id
// populate as a param (you can't chain .populate onto a plain promise)
const findEventOr404 = async (id, populate = []) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError('Event not found', 404, 'NOT_FOUND');
    }
    let query = Event.findById(id);
    for (const field of populate) query = query.populate(field);
    const event = await query;
    if (!event) throw new AppError('Event not found', 404, 'NOT_FOUND');
    return event;
};

// these routes hand the event straight back to the page, which draws judge
// chips from it — without this the chips come back nameless until a refresh
const withRefs = async (event) => {
    await event.populate([
        { path: 'organizer', select: 'name email' },
        { path: 'judges', select: 'name email' }
    ]);
    return event;
};


/// create — logged-in user becomes the organizer
export const createEvent = catchAsync(async (req, res) => {
    const event = await Event.create({
        ...req.body,
        organizer: req.user._id
    });
    res.status(201).json(event);
});


/// list — organizers see their own, judges see events they're assigned to,
/// teams see everything that's actually open to them (no drafts)
export const listEvents = catchAsync(async (req, res) => {
    const role = req.user.role;
    const filter = role === 'organizer'
        ? { organizer: req.user._id }
        : role === 'team'
            ? { status: { $ne: 'draft' } }
            : { judges: req.user._id };

    const events = await Event.find(filter)
        .populate('organizer', 'name email')
        .populate('judges', 'name email')
        .sort('-createdAt');

    res.json(events);
});


/// detail — only organizer or assigned judge may look
export const getEvent = catchAsync(async (req, res) => {
    const event = await findEventOr404(req.params.id, ['organizer', 'judges']);

    const isOrganizer = event.organizer._id.toString() === req.user._id.toString();
    const isJudge = event.judges.some(j => j._id.toString() === req.user._id.toString());
    // teams can look once the event is open — they need it before submitting
    const isTeam = req.user.role === 'team' && event.status !== 'draft';

    if (!isOrganizer && !isJudge && !isTeam) {
        throw new AppError('Not your event', 403, 'FORBIDDEN');
    }

    res.json(event);
});


/// update — organizer only; published events lock the rubric
export const updateEvent = catchAsync(async (req, res) => {
    const event = await findEventOr404(req.params.id);
    ensureOwner(event, req.user);

    // once judges can score, the rubric can't shift under their feet
    if (event.status !== 'draft' && req.body.rubric) {
        throw new AppError('Rubric is locked after publishing — reopen as draft first', 409, 'RUBRIC_LOCKED');
    }

    // results are out — nobody reopens the books behind them
    if (event.resultsReleased && req.body.status && req.body.status !== 'closed') {
        throw new AppError('Results are released — this event cannot change status anymore', 409, 'RESULTS_LOCKED');
    }

    Object.assign(event, req.body);
    await event.save();   // runs the Σ=100 validator again as a safety net

    res.json(await withRefs(event));
});


/// delete — organizer only
export const deleteEvent = catchAsync(async (req, res) => {
    const event = await findEventOr404(req.params.id);
    ensureOwner(event, req.user);

    await event.deleteOne();
    res.json({ message: 'Event deleted' });
});


/// assign judge — organizer only, and they must be an actual judge
export const addJudge = catchAsync(async (req, res) => {
    const event = await findEventOr404(req.params.id);
    ensureOwner(event, req.user);

    const judge = await User.findById(req.body.judgeId);
    if (!judge) throw new AppError('No user with that id', 404, 'USER_NOT_FOUND');
    if (judge.role !== 'judge') {
        throw new AppError('That user is not a judge', 422, 'NOT_A_JUDGE');
    }

    // ObjectId comparison — use .some, .includes does loose matching weirdly
    const already = event.judges.some(j => j.toString() === judge._id.toString());
    if (already) throw new AppError('Judge already assigned', 409, 'ALREADY_ASSIGNED');

    event.judges.push(judge._id);
    await event.save();

    res.status(201).json(await withRefs(event));
});


/// remove judge — organizer only
export const removeJudge = catchAsync(async (req, res) => {
    const event = await findEventOr404(req.params.id);
    ensureOwner(event, req.user);

    event.judges = event.judges.filter(j => j.toString() !== req.params.judgeId);
    await event.save();

    res.json(await withRefs(event));
});
