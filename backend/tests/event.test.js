import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
const stamp = Date.now();   // unique emails so re-runs don't collide

// helper: call the API
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
    try { data = await res.json(); } catch { /* empty body */ }
    return { status: res.status, data };
};

// fail fast if the server isn't up
before(async () => {
    const { status } = await api('/health').catch(() => ({ status: 0 }));
    if (status !== 200) {
        throw new Error(`Server not reachable at ${BASE} — start it first: npm run dev`);
    }
});

// register + login in one go, return the token
const makeUser = async (role) => {
    const email = `evt+${role}+${Math.random().toString(36).slice(2, 8)}+${stamp}@example.com`;
    const { data } = await api('/auth/register', {
        method: 'POST',
        body: { name: `Event Test ${role}`, email, password: 'password123', role }
    });
    return { token: data.token, id: data._id, email };
};

// a valid rubric — weights already sum to 100
const goodRubric = () => ([
    { name: 'Impact', description: 'Does it matter?', weight: 40 },
    { name: 'Technical', description: 'How hard was it?', weight: 35 },
    { name: 'Design', weight: 25 }
]);

const goodEvent = () => ({
    name: `HackFest ${stamp}`,
    description: 'a test hackathon',
    rubric: goodRubric()
});


// CREATE
test('event: organizer creates one and becomes owner', async () => {
    const { token } = await makeUser('organizer');
    const { status, data } = await api('/events', { method: 'POST', body: goodEvent(), token });

    assert.equal(status, 201);
    assert.equal(data.name, `HackFest ${stamp}`);
    assert.equal(data.status, 'draft');           // new events always start as draft
    assert.equal(data.rubric.length, 3);
});

test('event: judge cannot create one', async () => {
    const { token } = await makeUser('judge');
    const { status } = await api('/events', { method: 'POST', body: goodEvent(), token });
    assert.equal(status, 403);
});

test('event: rubric weights that dont sum to 100 rejected', async () => {
    const { token } = await makeUser('organizer');
    const { status, data } = await api('/events', {
        method: 'POST',
        token,
        body: { ...goodEvent(), rubric: [{ name: 'Alpha', weight: 60 }, { name: 'Beta', weight: 20 }] }
    });
    assert.equal(status, 422);
    assert.match(data.error.message, /add up to 100/i);
});

test('event: unknown extra field rejected (strict schema)', async () => {
    const { token } = await makeUser('organizer');
    const { status } = await api('/events', {
        method: 'POST', token, body: { ...goodEvent(), startDate: 'soon' }
    });
    assert.equal(status, 422);
});

// LIST + DETAIL
test('event: organizer lists own events only', async () => {
    const org = await makeUser('organizer');
    const other = await makeUser('organizer');

    await api('/events', { method: 'POST', body: goodEvent(), token: org.token });
    await api('/events', { method: 'POST', body: goodEvent(), token: other.token });

    const { status, data } = await api('/events', { token: org.token });
    assert.equal(status, 200);
    // exactly one — mine, not theirs
    assert.ok(Array.isArray(data));
    assert.ok(data.every(e => e.organizer._id === org.id), 'should only see own events');
});

test('event: detail — unassigned judge gets 403', async () => {
    const org = await makeUser('organizer');
    const judge = await makeUser('judge');

    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: org.token });
    const { status } = await api(`/events/${created._id}`, { token: judge.token });
    assert.equal(status, 403);
});

test('event: detail — stranger gets 403, missing id gets 404', async () => {
    const org = await makeUser('organizer');
    const stranger = await makeUser('judge');

    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: org.token });

    const { status: s1 } = await api(`/events/${created._id}`, { token: stranger.token });
    assert.equal(s1, 403);

    const { status: s2 } = await api('/events/64b000000000000000000000', { token: org.token });
    assert.equal(s2, 404);
});

// JUDGE ASSIGNMENT
test('judge: organizer assigns one, judge then sees the event', async () => {
    const org = await makeUser('organizer');
    const judge = await makeUser('judge');

    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: org.token });

    const { status: assignStatus } = await api(`/events/${created._id}/judges`, {
        method: 'POST', token: org.token, body: { judgeId: judge.id }
    });
    assert.equal(assignStatus, 201);

    // now the judge can see it
    const { status: listStatus, data: list } = await api('/events', { token: judge.token });
    assert.equal(listStatus, 200);
    assert.equal(list.length, 1);

    // and can open the detail
    const { status: detailStatus } = await api(`/events/${created._id}`, { token: judge.token });
    assert.equal(detailStatus, 200);
});

test('judge: assigning a team member rejected', async () => {
    const org = await makeUser('organizer');
    const team = await makeUser('team');

    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: org.token });
    const { status, data } = await api(`/events/${created._id}/judges`, {
        method: 'POST', token: org.token, body: { judgeId: team.id }
    });
    assert.equal(status, 422);
    assert.equal(data.error.code, 'NOT_A_JUDGE');
});

test('judge: assigning the same judge twice → 409', async () => {
    const org = await makeUser('organizer');
    const judge = await makeUser('judge');

    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: org.token });
    await api(`/events/${created._id}/judges`, { method: 'POST', token: org.token, body: { judgeId: judge.id } });
    const { status } = await api(`/events/${created._id}/judges`, {
        method: 'POST', token: org.token, body: { judgeId: judge.id }
    });
    assert.equal(status, 409);
});

// UPDATE + RUBRIC LOCK
test('event: non-owner organizer cannot edit', async () => {
    const owner = await makeUser('organizer');
    const other = await makeUser('organizer');

    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: owner.token });
    const { status } = await api(`/events/${created._id}`, {
        method: 'PUT', token: other.token, body: { name: 'Hijacked' }
    });
    assert.equal(status, 403);
});

test('event: organizer renames it (draft)', async () => {
    const org = await makeUser('organizer');
    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: org.token });

    const { status, data } = await api(`/events/${created._id}`, {
        method: 'PUT', token: org.token, body: { name: `Renamed ${stamp}` }
    });
    assert.equal(status, 200);
    assert.equal(data.name, `Renamed ${stamp}`);
});

test('event: publish then rubric edit → 409 locked', async () => {
    const org = await makeUser('organizer');
    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: org.token });

    // publish it
    const { status: pubStatus } = await api(`/events/${created._id}`, {
        method: 'PUT', token: org.token, body: { status: 'published' }
    });
    assert.equal(pubStatus, 200);

    // rubric edit now rejected
    const { status, data } = await api(`/events/${created._id}`, {
        method: 'PUT', token: org.token, body: { rubric: goodRubric() }
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'RUBRIC_LOCKED');

    // but plain fields (like name) still fine
    const { status: nameStatus } = await api(`/events/${created._id}`, {
        method: 'PUT', token: org.token, body: { description: 'updated after publish' }
    });
    assert.equal(nameStatus, 200);
});

test('event: bad status value rejected', async () => {
    const org = await makeUser('organizer');
    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: org.token });
    const { status } = await api(`/events/${created._id}`, {
        method: 'PUT', token: org.token, body: { status: 'archived' }
    });
    assert.equal(status, 422);
});

// DELETE
test('event: organizer deletes own, then it 404s', async () => {
    const org = await makeUser('organizer');
    const { data: created } = await api('/events', { method: 'POST', body: goodEvent(), token: org.token });

    const { status: delStatus } = await api(`/events/${created._id}`, { method: 'DELETE', token: org.token });
    assert.equal(delStatus, 200);

    const { status: after } = await api(`/events/${created._id}`, { token: org.token });
    assert.equal(after, 404);
});

// AUTH
test('events: no token at all → 401', async () => {
    const { status } = await api('/events');
    assert.equal(status, 401);
});

// JUDGE DIRECTORY (for the assign dropdown)
test('users: organizer sees the judge list', async () => {
    const org = await makeUser('organizer');
    await makeUser('judge');   // make sure at least one exists

    const { status, data } = await api('/users/judges', { token: org.token });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data) && data.length >= 1);
    assert.equal(data[0].password, undefined, 'no password leak');
});

test('users: a judge cannot pull the judge list', async () => {
    const judge = await makeUser('judge');
    const { status } = await api('/users/judges', { token: judge.token });
    assert.equal(status, 403);
});
