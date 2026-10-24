import mongoose from 'mongoose';
import Submission from '../models/submission.model.js';
import RepoGrant from '../models/repoGrant.model.js';
import RepositoryInsight from '../models/repositoryInsight.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { parseRepoUrl, validateRepoAccess, fetchInsight } from '../services/githubService.js';
import { encryptToken, decryptToken, fingerprint, requireRepoUrl } from '../utils/tokenVault.js';

/// repository controller — the team's grant flow + insight refresh (M7).
/// Authorization is the point: a private read needs a token the team gave
/// us, validated against GitHub before we record a thing, encrypted at rest,
/// and revocable — the raw token never appears in any response.

const loadSubmission = async (id) => {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    const sub = await Submission.findById(id)
        .populate('event', 'name status organizer judges')
        .populate('team', 'name email');
    if (!sub) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    return sub;
};

const isOwner = (sub, user) => sub.team._id.toString() === user._id.toString();
const isAssignedJudge = (sub, user) => sub.event.judges.some(j => j._id.toString() === user._id.toString());
const isOrganizer = (sub, user) => sub.event.organizer._id.toString() === user._id.toString();

// only the owning team may change grants or ask for a fresh fetch
const assertOwner = (sub, user) => {
    if (!isOwner(sub, user)) throw new AppError('Only your team can manage repository access', 403, 'FORBIDDEN');
};

// judges, their team, and the organizer read insight — nobody else
const assertCanView = (sub, user) => {
    if (!isOwner(sub, user) && !isAssignedJudge(sub, user) && !isOrganizer(sub, user)) {
        throw new AppError('Not your submission', 404, 'NOT_FOUND');
    }
};

// insight during judging only — nothing to fetch once the event is over
const assertJudgingOpen = (sub) => {
    if (sub.event.status === 'closed') {
        throw new AppError('This event is closed', 409, 'EVENT_CLOSED');
    }
};

// strip the secret before anything leaves the server
const sanitize = (grant) => grant ? ({
    repositoryUrl: `https://github.com/${grant.owner}/${grant.repo}`,
    visibility: grant.visibility,
    authorizedVia: grant.authorizedVia,
    tokenFingerprint: grant.tokenFingerprint,
    scopes: grant.scopes,
    grantedAt: grant.updatedAt,
    revokedAt: grant.revokedAt
}) : null;

// POST /api/submissions/:id/repo/grant  { token? }
export const grantRepository = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertOwner(sub, req.user);
    assertJudgingOpen(sub);

    requireRepoUrl(sub.repositoryUrl);
    const parsed = parseRepoUrl(sub.repositoryUrl);
    if (!parsed) {
        throw new AppError('Submission repositoryUrl must be a https://github.com/owner/repo link', 422, 'NO_REPOSITORY');
    }

    const { token } = req.body;
    let visibility = 'public';
    let authorizedVia = 'public';
    let encryptedToken = null;
    let tokenFingerprint = null;
    let scopes = [];

    if (token) {
        // never store a token we haven't watched work — GitHub's 401 becomes TOKEN_REJECTED
        const access = await validateRepoAccess(parsed.owner, parsed.repo, token);
        visibility = access.private ? 'private' : 'public';
        authorizedVia = 'team-token';
        encryptedToken = encryptToken(token);
        tokenFingerprint = fingerprint(token);
        scopes = access.scopes;
    } else {
        // no token: fine for public repos; private repos must bring one
        const access = await validateRepoAccess(parsed.owner, parsed.repo, undefined);
        if (access.private) {
            throw new AppError('Private repository — attach a read token to grant access', 403, 'TOKEN_REQUIRED');
        }
    }

    const grant = await RepoGrant.findOneAndUpdate(
        { submission: sub._id },
        {
            submission: sub._id,
            owner: parsed.owner,
            repo: parsed.repo,
            visibility,
            authorizedVia,
            encryptedToken,
            tokenFingerprint,
            scopes,
            grantedBy: req.user._id,
            revokedAt: null
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ grant: sanitize(grant) });
});

// DELETE /api/submissions/:id/repo/grant — permission withdrawn, ciphertext gone,
// the record of authorization stays
export const revokeRepository = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertOwner(sub, req.user);

    const grant = await RepoGrant.findOne({ submission: sub._id });
    if (!grant || grant.revokedAt) {
        throw new AppError('No active grant for this submission', 404, 'NOT_FOUND');
    }
    grant.encryptedToken = null;
    grant.tokenFingerprint = null;
    grant.revokedAt = new Date();
    await grant.save();

    res.json({ grant: sanitize(grant) });
});

// GET /api/submissions/:id/repo/grant
export const getGrantStatus = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertCanView(sub, req.user);

    const grant = await RepoGrant.findOne({ submission: sub._id });
    res.json({ grant: sanitize(grant) });
});

// POST /api/submissions/:id/repo/insight — owner or assigned judge, rate-limited
// at the route. token chain: team grant → server GITHUB_TOKEN → anonymous.
export const refreshInsight = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    const me = req.user;
    if (!isOwner(sub, me) && !isAssignedJudge(sub, me)) {
        throw new AppError('Only your team or the assigned judge can fetch repository insight', 403, 'FORBIDDEN');
    }
    assertJudgingOpen(sub);

    requireRepoUrl(sub.repositoryUrl);
    const parsed = parseRepoUrl(sub.repositoryUrl);
    if (!parsed) {
        throw new AppError('Submission repositoryUrl must be a https://github.com/owner/repo link', 422, 'NO_REPOSITORY');
    }

    // find the active grant and pull its token only now, only for this call
    const grant = await RepoGrant.findOne({ submission: sub._id }).select('+encryptedToken');
    if (grant?.revokedAt) {
        throw new AppError('Repository access was revoked — grant it again', 409, 'GRANT_REVOKED');
    }
    let token = grant ? decryptToken(grant.encryptedToken) : null;
    if (!token && process.env.GITHUB_TOKEN) token = process.env.GITHUB_TOKEN;
    const fetchedVia = token ? (grant ? 'team-token' : 'server-token') : 'public';

    const { facts, notes, visibility } = await fetchInsight(parsed.owner, parsed.repo, { token });

    const insight = await RepositoryInsight.create({
        submission: sub._id,
        owner: parsed.owner,
        repo: parsed.repo,
        visibility,
        fetchedVia,
        facts,
        fetchNotes: notes,
        fetchedBy: me._id
    });

    res.status(201).json({ insight });
});

// GET /api/submissions/:id/repo/insight — latest fetched version
export const getInsight = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertCanView(sub, req.user);

    const insight = await RepositoryInsight.findOne({ submission: sub._id })
        .sort({ createdAt: -1 });
    res.json({ insight });
});
