import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
const stamp = Date.now();

const api = async (path, { method = 'GET', body, token, form } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: form ? form : (body ? JSON.stringify(body) : undefined)
    });
    let data = null;
    try { data = await res.json(); } catch { /* binary or empty */ }
    return { status: res.status, data, res };
};

const makeUser = async (role, label) => {
    const email = `evi+${label}+${Math.random().toString(36).slice(2, 8)}+${stamp}@example.com`;
    const { data } = await api('/auth/register', {
        method: 'POST',
        body: { name: `Evidence ${label}`, email, password: 'password123', role }
    });
    return { token: data.token, id: data._id, name: data.name };
};

// one shared fixture: published event, assigned judge, owning team, and a
// submission pointed at GitHub's well-known octocat/Hello-World
let ctx;

before(async () => {
    const { status } = await api('/health').catch(() => ({ status: 0 }));
    if (status !== 200) {
        throw new Error(`Server not reachable at ${BASE} — start it first: npm run dev`);
    }

    const org = await makeUser('organizer', 'org');
    const judge = await makeUser('judge', 'judge');
    const team = await makeUser('team', 'team');
    const strangerTeam = await makeUser('team', 'stranger');
    const otherJudge = await makeUser('judge', 'other');

    const { data: event } = await api('/events', {
        method: 'POST', token: org.token,
        body: {
            name: `Evidence Fest ${stamp}`,
            rubric: [{ name: 'Impact', weight: 60 }, { name: 'Tech', weight: 40 }]
        }
    });
    await api(`/events/${event._id}/judges`, { method: 'POST', token: org.token, body: { judgeId: judge.id } });
    await api(`/events/${event._id}`, { method: 'PUT', token: org.token, body: { status: 'published' } });

    const { data: submission } = await api(`/events/${event._id}/submissions`, {
        method: 'POST', token: team.token,
        body: {
            projectName: `EvidenceApp ${stamp}`,
            tagline: 'repo, docs, demo',
            description: 'a project whose evidence actually exists on the internet',
            links: [],
            repositoryUrl: 'https://github.com/octocat/Hello-World',
            demoUrl: 'https://github.com/octocat/Hello-World'
        }
    });

    ctx = { org, judge, team, strangerTeam, otherJudge, eventId: event._id, subId: submission._id };
});

// ---- SSRF gates at the schema (SECURITY §6) ----

test('evidence: repositoryUrl outside github.com is rejected at the gate', async () => {
    const { status, data } = await api(`/events/${ctx.eventId}/submissions`, {
        method: 'POST', token: ctx.team.token,
        body: { projectName: 'Evil Repo', repositoryUrl: 'https://github.com.evil.test/o/r' }
    });
    assert.equal(status, 422);
    assert.equal(data.error.code, 'VALIDATION_ERROR');
});

test('evidence: demoUrl pointing at link-local metadata is rejected', async () => {
    const { status, data } = await api(`/events/${ctx.eventId}/submissions`, {
        method: 'POST', token: ctx.team.token,
        body: { projectName: 'Metadata Demo', demoUrl: 'http://169.254.169.254/latest/meta-data/' }
    });
    assert.equal(status, 422);
    assert.equal(data.error.code, 'VALIDATION_ERROR');
});

test('evidence: a link to a private-network literal is rejected too', async () => {
    const { status } = await api(`/events/${ctx.eventId}/submissions`, {
        method: 'POST', token: ctx.team.token,
        body: {
            projectName: 'Internal Link',
            links: [{ label: 'admin', url: 'http://192.168.1.10/admin' }]
        }
    });
    assert.equal(status, 422);
});

// ---- team authorization (the M7 gate) ----

test('evidence: public grant records authorization without leaking anything secret', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/repo/grant`, {
        method: 'POST', token: ctx.team.token, body: {}
    });
    assert.equal(status, 201);
    assert.equal(data.grant.authorizedVia, 'public');
    assert.equal(data.grant.visibility, 'public');
    assert.ok(data.grant.grantedAt, 'the moment of authorization is recorded');
    assert.equal(data.grant.revokedAt, null);

    // nothing token-shaped anywhere in the payload
    assert.ok(!('encryptedToken' in data.grant), 'ciphertext never leaves the server');
    assert.ok(!('token' in data.grant) && !('tokenFingerprint' in data.grant) || data.grant.tokenFingerprint === null);

    const read = await api(`/submissions/${ctx.subId}/repo/grant`, { token: ctx.team.token });
    assert.equal(read.status, 200);
    assert.equal(read.data.grant.authorizedVia, 'public');
});

test('evidence: a bogus GitHub token is rejected before it is ever stored', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/repo/grant`, {
        method: 'POST', token: ctx.team.token, body: { token: 'ghp_definitelyNotARealToken12345' }
    });
    assert.equal(status, 400);
    assert.equal(data.error.code, 'TOKEN_REJECTED');

    // the earlier clean public grant is untouched
    const read = await api(`/submissions/${ctx.subId}/repo/grant`, { token: ctx.team.token });
    assert.equal(read.data.grant.authorizedVia, 'public');
});

test('evidence: a stranger team cannot read grant status or trigger a fetch', async () => {
    const read = await api(`/submissions/${ctx.subId}/repo/grant`, { token: ctx.strangerTeam.token });
    assert.equal(read.status, 404);

    const fetchIt = await api(`/submissions/${ctx.subId}/repo/insight`, {
        method: 'POST', token: ctx.strangerTeam.token, body: {}
    });
    assert.equal(fetchIt.status, 403);
});

// ---- repository insight: server-fetched verified facts ----

test('evidence: insight fetch reads octocat/Hello-World through the SSRF guard', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/repo/insight`, {
        method: 'POST', token: ctx.team.token, body: {}
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.equal(data.insight.facts.fullName, 'octocat/Hello-World');
    assert.equal(data.insight.visibility, 'public');
    assert.equal(data.insight.fetchedVia, 'public');
    assert.ok(Array.isArray(data.insight.facts.languages));
    assert.ok(data.insight.facts.treeStats.totalFiles >= 1, 'static tree stats, no code executed');
    assert.ok(Array.isArray(data.insight.fetchNotes));
    assert.ok(!JSON.stringify(data.insight).includes('ghp_'), 'no token material in the payload');

    // judges see the same facts the team just triggered
    const asJudge = await api(`/submissions/${ctx.subId}/repo/insight`, { token: ctx.judge.token });
    assert.equal(asJudge.status, 200);
    assert.equal(asJudge.data.insight.facts.fullName, 'octocat/Hello-World');
});

test('evidence: revoking the grant withdraws permission — refresh stops until re-granted', async () => {
    const revoke = await api(`/submissions/${ctx.subId}/repo/grant`, {
        method: 'DELETE', token: ctx.team.token
    });
    assert.equal(revoke.status, 200);
    assert.ok(revoke.data.grant.revokedAt, 'the record of authorization remains');
    assert.equal(revoke.data.grant.tokenFingerprint, null);

    const refresh = await api(`/submissions/${ctx.subId}/repo/insight`, {
        method: 'POST', token: ctx.team.token, body: {}
    });
    assert.equal(refresh.status, 409);
    assert.equal(refresh.data.error.code, 'GRANT_REVOKED');

    const regrant = await api(`/submissions/${ctx.subId}/repo/grant`, {
        method: 'POST', token: ctx.team.token, body: {}
    });
    assert.equal(regrant.status, 201);
    assert.equal(regrant.data.grant.revokedAt, null);
});

// ---- documents ----

const mdBytes = Buffer.from('# How it works\nWe wired the sensors to a small model and shipped it in a weekend.\n');

const docForm = (name, type, bytes) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), name);
    return form;
};

test('evidence: uploading a markdown write-up extracts its text', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/documents`, {
        method: 'POST', token: ctx.team.token, form: docForm('how-it-works.md', 'text/markdown', mdBytes)
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.equal(data.document.originalName, 'how-it-works.md');
    assert.ok(data.document.extractedChars > 0, 'text was read');
    assert.ok(data.document.sizeBytes === mdBytes.length);
    ctx.docId = data.document._id;
});

test('evidence: the same bytes are deduplicated, not stored twice', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/documents`, {
        method: 'POST', token: ctx.team.token, form: docForm('copy.md', 'text/markdown', mdBytes)
    });
    assert.equal(status, 200);
    assert.equal(data.deduped, true);
    assert.equal(data.document._id, ctx.docId);

    const list = await api(`/submissions/${ctx.subId}/documents`, { token: ctx.team.token });
    assert.equal(list.data.documents.length, 1, 'one file, one row');
});

test('evidence: judges can read and download the upload; teams outside cannot', async () => {
    const asJudge = await api(`/submissions/${ctx.subId}/documents`, { token: ctx.judge.token });
    assert.equal(asJudge.status, 200);
    assert.equal(asJudge.data.documents.length, 1);

    const dl = await fetch(`${BASE}/submissions/${ctx.subId}/documents/${ctx.docId}/download`, {
        headers: { Authorization: `Bearer ${ctx.judge.token}` }
    });
    assert.equal(dl.status, 200);
    assert.match(dl.headers.get('content-disposition') || '', /attachment/);
    assert.equal(dl.headers.get('x-content-type-options'), 'nosniff');
    const body = Buffer.from(await dl.arrayBuffer());
    assert.deepEqual(body, mdBytes, 'bytes come back exactly as sent');

    const stranger = await api(`/submissions/${ctx.subId}/documents`, { token: ctx.strangerTeam.token });
    assert.equal(stranger.status, 404);
});

test('evidence: uploads are capped — oversized 413, disallowed type 422', async () => {
    const big = await api(`/submissions/${ctx.subId}/documents`, {
        method: 'POST', token: ctx.team.token,
        form: docForm('huge.txt', 'text/plain', Buffer.alloc(21 * 1024 * 1024, 0x61))
    });
    assert.equal(big.status, 413);
    assert.equal(big.data.error.code, 'UPLOAD_TOO_LARGE');

    const exe = await api(`/submissions/${ctx.subId}/documents`, {
        method: 'POST', token: ctx.team.token,
        form: docForm('installer.exe', 'application/x-msdownload', Buffer.from('MZ fake binary'))
    });
    assert.equal(exe.status, 422);
    assert.equal(exe.data.error.code, 'UPLOAD_TYPE_NOT_ALLOWED');
});

test('evidence: judges cannot upload, and the owner can remove their file', async () => {
    const judgeUpload = await api(`/submissions/${ctx.subId}/documents`, {
        method: 'POST', token: ctx.judge.token, form: docForm('j.md', 'text/markdown', mdBytes)
    });
    assert.equal(judgeUpload.status, 403);

    const del = await api(`/submissions/${ctx.subId}/documents/${ctx.docId}`, {
        method: 'DELETE', token: ctx.team.token
    });
    assert.equal(del.status, 200);

    const list = await api(`/submissions/${ctx.subId}/documents`, { token: ctx.judge.token });
    assert.equal(list.data.documents.length, 0, 'the file is gone from the listing');

    const gone = await fetch(`${BASE}/submissions/${ctx.subId}/documents/${ctx.docId}/download`, {
        headers: { Authorization: `Bearer ${ctx.judge.token}` }
    });
    assert.equal(gone.status, 404);
});

// ---- demo review ----

test('evidence: judge runs the demo check — liveness comes back verified', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/demo/check`, {
        method: 'POST', token: ctx.judge.token, body: {}
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.equal(data.check.reachable, true);
    assert.equal(data.check.httpStatus, 200);
    assert.ok(data.check.title, 'the page title was captured');

    const read = await api(`/submissions/${ctx.subId}/demo/check`, { token: ctx.judge.token });
    assert.equal(read.status, 200);
    assert.equal(read.data.check.reachable, true);
    assert.equal(read.data.demoUrl, 'https://github.com/octocat/Hello-World');
});

test('evidence: a submission without a demo URL says so instead of guessing', async () => {
    const { data: sub } = await api(`/events/${ctx.eventId}/submissions`, {
        method: 'POST', token: ctx.strangerTeam.token,
        body: { projectName: `No Demo ${stamp}` }
    });
    const { status, data } = await api(`/submissions/${sub._id}/demo/check`, {
        method: 'POST', token: ctx.strangerTeam.token, body: {}
    });
    assert.equal(status, 422);
    assert.equal(data.error.code, 'NO_DEMO_URL');
});

// ---- judge evidence notes (BL-11) ----

test('evidence: assigned judge links a verified note to a rubric criterion', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/evidence`, {
        method: 'POST', token: ctx.judge.token,
        body: {
            criterion: 'impact',
            type: 'verified-evidence',
            text: 'Demo link checked live — the walkthrough loads without login.',
            source: 'https://github.com/octocat/Hello-World'
        }
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.equal(data.evidence.criterion, 'Impact', 'normalized back to rubric spelling');
    ctx.evidenceId = data.evidence._id;

    const mine = await api(`/submissions/${ctx.subId}/evidence`, { token: ctx.judge.token });
    assert.equal(mine.data.evidence.length, 1);
    assert.equal(mine.data.evidence[0].judge.name, ctx.judge.name, 'judge identity travels with the note');
});

test('evidence: an off-rubric criterion is refused', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/evidence`, {
        method: 'POST', token: ctx.judge.token,
        body: { criterion: 'Vibes', type: 'team-claim', text: 'this feels nice somehow' }
    });
    assert.equal(status, 422);
    assert.equal(data.error.code, 'UNKNOWN_CRITERION');
});

test('evidence: only assigned judges may write — other roles hit a wall', async () => {
    const byOther = await api(`/submissions/${ctx.subId}/evidence`, {
        method: 'POST', token: ctx.otherJudge.token,
        body: { type: 'team-claim', text: 'not assigned to this event at all' }
    });
    assert.equal(byOther.status, 403);

    const byTeam = await api(`/submissions/${ctx.subId}/evidence`, {
        method: 'POST', token: ctx.team.token,
        body: { type: 'team-claim', text: 'teams do not write judge notes' }
    });
    assert.equal(byTeam.status, 403);

    const teamReads = await api(`/submissions/${ctx.subId}/evidence`, { token: ctx.team.token });
    assert.equal(teamReads.status, 403, 'judge reasoning stays away from teams');
});

test('evidence: the organizer sees every note, unassigned judges see nothing', async () => {
    const asOrg = await api(`/submissions/${ctx.subId}/evidence`, { token: ctx.org.token });
    assert.equal(asOrg.status, 200);
    assert.equal(asOrg.data.evidence.length, 1);

    const asOther = await api(`/submissions/${ctx.subId}/evidence`, { token: ctx.otherJudge.token });
    assert.equal(asOther.status, 403);
});

test('evidence: only the author can delete their note', async () => {
    const byOther = await api(`/submissions/${ctx.subId}/evidence/${ctx.evidenceId}`, {
        method: 'DELETE', token: ctx.otherJudge.token
    });
    assert.equal(byOther.status, 403);

    const byAuthor = await api(`/submissions/${ctx.subId}/evidence/${ctx.evidenceId}`, {
        method: 'DELETE', token: ctx.judge.token
    });
    assert.equal(byAuthor.status, 200);

    const mine = await api(`/submissions/${ctx.subId}/evidence`, { token: ctx.judge.token });
    assert.equal(mine.data.evidence.length, 0);
});

// ---- AI analysis rides on the artifacts ----

test('evidence: AI analysis runs with repo insight + demo check in the prompt', async () => {
    // restore an evidence note so the flow ends in a realistic state
    await api(`/submissions/${ctx.subId}/evidence`, {
        method: 'POST', token: ctx.judge.token,
        body: { criterion: 'Impact', type: 'verified-evidence', text: 'Demo link checked live.', source: 'demo' }
    });

    const { status, data } = await api(`/submissions/${ctx.subId}/ai-analysis`, {
        method: 'POST', token: ctx.judge.token, body: {}
    });
    assert.equal(status, 201, JSON.stringify(data).slice(0, 400));
    assert.ok(data.summary.length > 0);
    assert.ok(data.evidence.length >= 1);
    assert.equal(data.suggestedScores.length, 2, 'full rubric coverage');
    assert.ok(data.limitations.length >= 1);
    assert.ok(data.model, 'the model that wrote it is recorded');
});

test('evidence: the submission carries its typed evidence fields end to end', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}`, { token: ctx.team.token });
    assert.equal(status, 200);
    assert.equal(data.repositoryUrl, 'https://github.com/octocat/Hello-World');
    assert.equal(data.demoUrl, 'https://github.com/octocat/Hello-World');
});
