import mongoose from 'mongoose';
import Event from '../models/event.model.js';
import Submission from '../models/submission.model.js';
import Evaluation from '../models/evaluation.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { buildLeaderboard } from '../services/scoringService.js';

// same load-a-doc-or-404 pattern the other controllers use; judges get
// populated here because both responses below show their names
const loadEvent = async (id) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError('Event not found', 404, 'NOT_FOUND');
    }
    const event = await Event.findById(id)
        .populate('organizer', 'name email')
        .populate('judges', 'name email');
    if (!event) throw new AppError('Event not found', 404, 'NOT_FOUND');
    return event;
};

const isOwner = (event, user) =>
    event.organizer._id.toString() === user._id.toString();

// both standings responses — the sealed one carries no scores at all,
// so an unpublished result never even leaves the server
const standingsPayload = async (event, { sealed }) => {
    const head = {
        released: event.resultsReleased,
        releasedAt: event.releasedAt,
        event: {
            _id: event._id,
            name: event.name,
            status: event.status,
            assigned: event.judges.length
        }
    };

    if (sealed) return { ...head, sealed: true, standings: [] };

    const [subs, evals] = await Promise.all([
        Submission.find({ event: event._id }).populate('team', 'name').sort('createdAt'),
        Evaluation.find({ event: event._id, status: 'submitted' }).populate('judge', 'name')
    ]);

    return { ...head, sealed: false, standings: buildLeaderboard(subs, evals) };
};


/// GET /api/events/:eventId/leaderboard
/// the organizer sees a preview; everyone else waits for the release
/// (judges too — nobody should benchmark against the midway standings)
export const getLeaderboard = catchAsync(async (req, res) => {
    const event = await loadEvent(req.params.eventId);
    const sealed = !event.resultsReleased && !isOwner(event, req.user);
    res.json(await standingsPayload(event, { sealed }));
});


/// POST /api/events/:eventId/leaderboard/release  (organizer, after closing)
export const releaseResults = catchAsync(async (req, res) => {
    const event = await loadEvent(req.params.eventId);

    if (!isOwner(event, req.user)) {
        throw new AppError('Only the organizer can release results', 403, 'FORBIDDEN');
    }
    if (event.resultsReleased) {
        throw new AppError('Results are already released', 409, 'ALREADY_RELEASED');
    }
    if (event.status !== 'closed') {
        throw new AppError('Close judging before releasing results', 409, 'EVENT_NOT_CLOSED');
    }

    event.resultsReleased = true;
    event.releasedAt = new Date();
    await event.save();

    res.json({ released: true, releasedAt: event.releasedAt });
});


// one column per assigned judge, in assignment order
const csvCell = (value) => {
    const s = String(value ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

const slugify = (name) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'event';


/// GET /api/events/:eventId/leaderboard/csv
/// a real file download — same gating as the page, and the bearer token
/// rides along because the frontend fetches it as a blob (a plain <a href>
/// would arrive tokenless and bounce to the login wall)
export const exportCsv = catchAsync(async (req, res) => {
    const event = await loadEvent(req.params.eventId);
    const sealed = !event.resultsReleased && !isOwner(event, req.user);
    if (sealed) {
        throw new AppError('Results are sealed until the organizer releases them', 409, 'RESULTS_SEALED');
    }

    const payload = await standingsPayload(event, { sealed: false });
    const judgeIds = event.judges.map(j => String(j._id));

    const header = ['rank', 'project', 'team', 'average', 'judged', 'assigned', ...event.judges.map(j => j.name)];
    const lines = [header.map(csvCell).join(',')];

    for (const row of payload.standings) {
        const perJudge = judgeIds.map((jid) => {
            const hit = row.scores.find(s => s.judge === jid);
            return hit ? hit.total : '';
        });
        lines.push([
            row.rank ?? '', row.project, row.team, row.average ?? '',
            row.judged, payload.event.assigned, ...perJudge
        ].map(csvCell).join(','));
    }

    // CRLF + BOM: what spreadsheets expect, so names with accents/emoji
    // don't turn to mojibake in Excel
    const csv = '\uFEFF' + lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${slugify(event.name)}-results.csv"`);
    res.send(csv);
});
