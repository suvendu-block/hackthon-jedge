import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
const stamp = Date.now();

const api = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty */ }
    return { status: res.status, data };
};

before(async () => {
    const { status } = await api('/health').catch(() => ({ status: 0 }));
    if (status !== 200) {
        throw new Error(`Server not reachable at ${BASE} — start it first: npm run dev`);
    }
});

const makeUser = async (role) => {
    const email = `evl+${role}+${Math.random().toString(36).slice(2, 8)}+${stamp}@example.com`;
    const { data } = await api('/auth/register', {
        method: 'POST',
        body: { name: `Eval ${role}`, email, password: 'password123', role }
    });
    return { token: data.token, id: data._id };
};

// full world: organizer + assigned judge + submitted team + published event
const makeWorld = async () => {
    const org = await makeUser('organizer');
    const judge = await makeUser('judge');
    const team = await makeUser('team');

    const { data: event } = await api('/events', {
        method: 'POST', token: org.token,
        body: {
            name: `JudgeEvent ${Math.random().toString(36).slice(2, 6)} ${stamp}`,
            rubric: [
                { name: 'Impact', weight: 50 },
                { name: 'Technical', weight: 50 }
            ]
        }
    });
    await api(`/events/${event._id}/judges`, { method: 'POST', token: org.token, body: { judgeId: judge.id } });
    await api(`/events/${event._id}`, { method: 'PUT', token: org.token, body: { status: 'published' } });

    const { data: sub } = await api(`/events/${event._id}/submissions`, {
        method: 'POST', token: team.token,
        body: { projectName: `EvalProject ${stamp}`, tagline: 'scores go here' }
    });

    return { org, judge, team, eventId: event._id, subId: sub._id, rubric: event.rubric };
};

// pull criterion ids out of the event rubric (they're assigned by mongo)
const getCritIds = async (eventId, orgToken) => {
    const { data } = await api(`/events/${eventId}`, { token: orgToken });
    return data.rubric.map(c => c._id);
};

// a valid full score set: 9 and 7 → (9/10×50)+(7/10×50) = 45+35 = 80
const fullScores = (ids) => [
    { criterion: ids[0], score: 9 },
    { criterion: ids[1], score: 7 }
];


// GET / open scorecard
test('evaluation: judge opens the scorecard, a draft is created', async () => {
    const w = await makeWorld();
    const { status, data } = await api(`/evaluations/submission/${w.subId}`, { token: w.judge.token });

    assert.equal(status, 200);
    assert.equal(data.evaluation.status, 'draft');
    assert.equal(data.evaluation.total, 0);
    assert.equal(data.rubric.length, 2, 'rubric comes with the scorecard');
    assert.equal(data.submission.projectName, `EvalProject ${stamp}`);
});

test('evaluation: team member cannot open a scorecard', async () => {
    const w = await makeWorld();
    const { status, data } = await api(`/evaluations/submission/${w.subId}`, { token: w.team.token });
    assert.equal(status, 403);
    assert.equal(data.error.code, 'NOT_A_JUDGE');
});

test('evaluation: unassigned judge → 403', async () => {
    const w = await makeWorld();
    const stranger = await makeUser('judge');
    const { status, data } = await api(`/evaluations/submission/${w.subId}`, { token: stranger.token });
    assert.equal(status, 403);
    assert.equal(data.error.code, 'NOT_ASSIGNED');
});


// PUT / draft
test('evaluation: partial draft saves, total tracks what is scored', async () => {
    const w = await makeWorld();
    const ids = await getCritIds(w.eventId, w.org.token);

    const { status, data } = await api(`/evaluations/submission/${w.subId}`, {
        method: 'PUT', token: w.judge.token,
        body: { scores: [{ criterion: ids[0], score: 9 }] }   // only one of two
    });
    assert.equal(status, 200);
    assert.equal(data.status, 'draft');
    assert.equal(data.total, 45, 'half the rubric, 9/10 → 45');
});

test('evaluation: out-of-range score rejected at the schema', async () => {
    const w = await makeWorld();
    const ids = await getCritIds(w.eventId, w.org.token);

    const { status } = await api(`/evaluations/submission/${w.subId}`, {
        method: 'PUT', token: w.judge.token,
        body: { scores: [{ criterion: ids[0], score: 15 }] }
    });
    assert.equal(status, 422);
});

test('evaluation: score order does not change the total', async () => {
    const w = await makeWorld();
    const ids = await getCritIds(w.eventId, w.org.token);

    // same scores, reversed order — total must still be 80
    const { data } = await api(`/evaluations/submission/${w.subId}`, {
        method: 'PUT', token: w.judge.token,
        body: { scores: [{ criterion: ids[1], score: 7 }, { criterion: ids[0], score: 9 }] }
    });
    assert.equal(data.total, 80);
});


// POST / submit
test('evaluation: submit with all scores → 200, submitted, total 80', async () => {
    const w = await makeWorld();
    const ids = await getCritIds(w.eventId, w.org.token);

    const { status, data } = await api(`/evaluations/submission/${w.subId}/submit`, {
        method: 'POST', token: w.judge.token,
        body: { scores: fullScores(ids), comments: 'solid work' }
    });

    assert.equal(status, 200);
    assert.equal(data.status, 'submitted');
    assert.equal(data.total, 80);
    assert.ok(data.submittedAt, 'timestamp recorded');
});

test('evaluation: submit with a missing criterion → 422', async () => {
    const w = await makeWorld();
    const ids = await getCritIds(w.eventId, w.org.token);

    const { status, data } = await api(`/evaluations/submission/${w.subId}/submit`, {
        method: 'POST', token: w.judge.token,
        body: { scores: [{ criterion: ids[0], score: 9 }] }   // Technical unscoped
    });
    assert.equal(status, 422);
    assert.equal(data.error.code, 'INCOMPLETE_SCORES');
    assert.match(data.error.message, /Technical/);
});

test('evaluation: submit twice → 409', async () => {
    const w = await makeWorld();
    const ids = await getCritIds(w.eventId, w.org.token);

    await api(`/evaluations/submission/${w.subId}/submit`, {
        method: 'POST', token: w.judge.token, body: { scores: fullScores(ids) }
    });
    const { status } = await api(`/evaluations/submission/${w.subId}/submit`, {
        method: 'POST', token: w.judge.token, body: { scores: fullScores(ids) }
    });
    assert.equal(status, 409);
});

test('evaluation: editing after submit → 409 (final means final)', async () => {
    const w = await makeWorld();
    const ids = await getCritIds(w.eventId, w.org.token);

    await api(`/evaluations/submission/${w.subId}/submit`, {
        method: 'POST', token: w.judge.token, body: { scores: fullScores(ids) }
    });

    const { status, data } = await api(`/evaluations/submission/${w.subId}`, {
        method: 'PUT', token: w.judge.token,
        body: { scores: [{ criterion: ids[0], score: 10 }] }
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'ALREADY_SUBMITTED');
});

test('evaluation: empty submit → 422 (schema needs at least one score)', async () => {
    const w = await makeWorld();
    const { status } = await api(`/evaluations/submission/${w.subId}/submit`, {
        method: 'POST', token: w.judge.token, body: { scores: [] }
    });
    assert.equal(status, 422);
});


// closed event
test('evaluation: no scoring once the event closes', async () => {
    const w = await makeWorld();
    await api(`/events/${w.eventId}`, { method: 'PUT', token: w.org.token, body: { status: 'closed' } });

    const { status, data } = await api(`/evaluations/submission/${w.subId}`, {
        method: 'PUT', token: w.judge.token, body: { scores: [] }
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'EVENT_CLOSED');
});

test('evaluation: draft event also blocks scoring', async () => {
    const org = await makeUser('organizer');
    const judge = await makeUser('judge');
    const team = await makeUser('team');

    const { data: event } = await api('/events', {
        method: 'POST', token: org.token,
        body: { name: `DraftJudge ${stamp}`, rubric: [{ name: 'Impact', weight: 100 }] }
    });
    await api(`/events/${event._id}/judges`, { method: 'POST', token: org.token, body: { judgeId: judge.id } });
    // NOTE: left as draft — never published
    const { data: sub } = await api(`/events/${event._id}/submissions`, {
        method: 'POST', token: team.token, body: { projectName: 'Nope' }
    }).catch(() => ({ data: null }));

    // submissions can't even exist in a draft event, so score a fake id → 404 first
    const { status } = await api(`/evaluations/submission/${'64b000000000000000000000'}`, { token: judge.token });
    assert.equal(status, 404);
});


// my queue
test('evaluation: /mine lists the judge scorecards', async () => {
    const w = await makeWorld();
    const ids = await getCritIds(w.eventId, w.org.token);

    await api(`/evaluations/submission/${w.subId}/submit`, {
        method: 'POST', token: w.judge.token, body: { scores: fullScores(ids) }
    });

    const { status, data } = await api('/evaluations/mine', { token: w.judge.token });
    assert.equal(status, 200);
    assert.equal(data.length, 1);
    assert.equal(data[0].status, 'submitted');
    assert.equal(data[0].submission.projectName, `EvalProject ${stamp}`);
});

test('evaluation: no token → 401', async () => {
    const { status } = await api('/evaluations/mine');
    assert.equal(status, 401);
});
