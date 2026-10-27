import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
const stamp = Date.now();

const api = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, data };
};

const makeUser = async (role, label) => {
    const email = `qa+${label}+${Math.random().toString(36).slice(2, 8)}+${stamp}@example.com`;
    const { data } = await api('/auth/register', {
        method: 'POST',
        body: { name: `QA ${label}`, email, password: 'password123', role }
    });
    return { token: data.token, id: data._id, name: data.name };
};

const DIMENSIONS = ['tech-stack', 'folder-structure', 'complexity', 'documentation', 'readiness'];

// one shared fixture: published event, assigned judge, owning team, and a
// submission with a real repository + demo on the internet
let ctx;
let firstCardId;

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
            name: `QA Fest ${stamp}`,
            rubric: [{ name: 'Impact', weight: 60 }, { name: 'Tech', weight: 40 }]
        }
    });
    await api(`/events/${event._id}/judges`, { method: 'POST', token: org.token, body: { judgeId: judge.id } });
    await api(`/events/${event._id}`, { method: 'PUT', token: org.token, body: { status: 'published' } });

    const { data: submission } = await api(`/events/${event._id}/submissions`, {
        method: 'POST', token: team.token,
        body: {
            projectName: `QACraft ${stamp}`,
            tagline: 'a project worth rating',
            description: 'An emissions dashboard for small teams: spreadsheet ingestion, an API layer, trend charts, and a small offline sync queue so field workers can log entries without a connection.',
            links: [],
            repositoryUrl: 'https://github.com/octocat/Hello-World',
            demoUrl: 'https://github.com/octocat/Hello-World'
        }
    });

    // stored artifacts first — the card should lean on repo + demo facts
    await api(`/submissions/${submission._id}/repo/grant`, { method: 'POST', token: team.token, body: {} });
    await api(`/submissions/${submission._id}/repo/insight`, { method: 'POST', token: team.token });
    await api(`/submissions/${submission._id}/demo/check`, { method: 'POST', token: team.token });

    ctx = { org, judge, team, strangerTeam, otherJudge, eventId: event._id, subId: submission._id };
});

// ---- nobody else's submission ----

test('qa report: bad id never reaches the service', async () => {
    const { status, data } = await api('/submissions/nope/qa-report', { token: ctx.team.token });
    assert.equal(status, 404);
    assert.equal(data.error.code, 'NOT_FOUND');
});

test('qa report: a stranger team gets nothing — not even confirmation it exists', async () => {
    const get = await api(`/submissions/${ctx.subId}/qa-report`, { token: ctx.strangerTeam.token });
    assert.equal(get.status, 404);
    const post = await api(`/submissions/${ctx.subId}/qa-report`, { method: 'POST', token: ctx.strangerTeam.token });
    assert.equal(post.status, 403);
    assert.equal(post.data.error.code, 'FORBIDDEN');
});

test('qa report: an unassigned judge may not run or read one', async () => {
    const post = await api(`/submissions/${ctx.subId}/qa-report`, { method: 'POST', token: ctx.otherJudge.token });
    assert.equal(post.status, 403);
    const get = await api(`/submissions/${ctx.subId}/qa-report`, { token: ctx.otherJudge.token });
    assert.equal(get.status, 404);
});

test('qa report: the organizer reads cards but never runs one', async () => {
    const post = await api(`/submissions/${ctx.subId}/qa-report`, { method: 'POST', token: ctx.org.token });
    assert.equal(post.status, 403);
});

test('qa report: not generated yet says so with NO_QA_REPORT', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/qa-report`, { token: ctx.team.token });
    assert.equal(status, 404);
    assert.equal(data.error.code, 'NO_QA_REPORT');
});

// ---- the owning team runs one (a real provider call) ----

test('qa report: the team runs one and gets a full card back', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/qa-report`, {
        method: 'POST', token: ctx.team.token
    });
    assert.equal(status, 201, JSON.stringify(data).slice(0, 300));
    firstCardId = data._id;

    assert.ok(data.model, 'provider named');
    assert.equal(data.ratings.length, DIMENSIONS.length, 'all five dimensions');
    assert.deepEqual(data.ratings.map(r => r.dimension).sort(), [...DIMENSIONS].sort());
    for (const r of data.ratings) {
        assert.equal(r.score, Math.round(r.score), 'whole points');
        assert.ok(r.score >= 1 && r.score <= 10, `score 1-10, got ${r.score}`);
        assert.ok(r.rationale.length > 0, 'every rating explains itself');
        assert.ok(r.confidence >= 0 && r.confidence <= 1);
        assert.ok(['verified-evidence', 'team-claim', 'ai-inference'].includes(r.evidenceType));
    }
    assert.equal(data.overall, Math.round(data.overall));
    assert.ok(data.overall >= 1 && data.overall <= 10, `overall 1-10, got ${data.overall}`);
    assert.ok(data.capacity.estimate.length > 0, 'capacity estimate present');
    assert.ok(data.capacity.confidence >= 0 && data.capacity.confidence <= 1);
    assert.ok(Array.isArray(data.errors), 'errors list present (may be empty)');
    assert.ok(data.limitations.length >= 0 && typeof data.summary === 'string');
    // the stored artifacts really fed the card
    assert.equal(data.inputs.repository, true, 'repo insight was an input');
    assert.equal(data.inputs.demo, true, 'demo check was an input');
    assert.equal(data.inputs.documents, 0);
});

test('qa report: the team reads the stored card back', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/qa-report`, { token: ctx.team.token });
    assert.equal(status, 200);
    assert.equal(data._id, firstCardId, 'latest card is the one just stored');
});

// ---- the assigned judge runs one ----

test('qa report: the assigned judge runs their own fresh card', async () => {
    const { status, data } = await api(`/submissions/${ctx.subId}/qa-report`, {
        method: 'POST', token: ctx.judge.token
    });
    assert.equal(status, 201, JSON.stringify(data).slice(0, 300));
    assert.notEqual(data._id, firstCardId, 'a new run stores a new card');
    assert.equal(data.ratings.length, DIMENSIONS.length);

    const read = await api(`/submissions/${ctx.subId}/qa-report`, { token: ctx.judge.token });
    assert.equal(read.status, 200);
    assert.equal(read.data._id, data._id, 'judge sees the newest card');

    const orgRead = await api(`/submissions/${ctx.subId}/qa-report`, { token: ctx.org.token });
    assert.equal(orgRead.status, 200, 'organizer reads the same card');
});

// ---- lifecycle: runs stop when judging closes, reading does not ----

test('qa report: closed event refuses new runs but keeps the card readable', async () => {
    await api(`/events/${ctx.eventId}`, { method: 'PUT', token: ctx.org.token, body: { status: 'closed' } });

    const post = await api(`/submissions/${ctx.subId}/qa-report`, { method: 'POST', token: ctx.team.token });
    assert.equal(post.status, 409);
    assert.equal(post.data.error.code, 'EVENT_CLOSED');

    const get = await api(`/submissions/${ctx.subId}/qa-report`, { token: ctx.team.token });
    assert.equal(get.status, 200, 'stored cards outlive the judging window');
});
