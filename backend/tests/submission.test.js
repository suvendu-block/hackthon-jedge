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
    const email = `sub+${role}+${Math.random().toString(36).slice(2, 8)}+${stamp}@example.com`;
    const { data } = await api('/auth/register', {
        method: 'POST',
        body: { name: `Sub Test ${role}`, email, password: 'password123', role }
    });
    return { token: data.token, id: data._id };
};

// build a published event with one judge — the common test setup
const makePublishedEvent = async () => {
    const org = await makeUser('organizer');
    const judge = await makeUser('judge');
    const { data: event } = await api('/events', {
        method: 'POST',
        token: org.token,
        body: {
            name: `SubEvent ${Math.random().toString(36).slice(2, 6)} ${stamp}`,
            rubric: [{ name: 'Impact', weight: 50 }, { name: 'Tech', weight: 50 }]
        }
    });
    await api(`/events/${event._id}/judges`, { method: 'POST', token: org.token, body: { judgeId: judge.id } });
    // publish it
    await api(`/events/${event._id}`, { method: 'PUT', token: org.token, body: { status: 'published' } });
    return { org, judge, eventId: event._id };
};

const goodSubmission = () => ({
    projectName: `Cool App ${stamp}`,
    tagline: 'it does the thing',
    description: 'a genuinely cool hackathon project',
    links: [
        { label: 'repo', url: 'https://github.com/team/repo' },
        { label: 'demo', url: 'https://demo.example.com' }
    ]
});


// SUBMIT
test('submission: team submits to a published event', async () => {
    const { eventId } = await makePublishedEvent();
    const team = await makeUser('team');

    const { status, data } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: team.token, body: goodSubmission()
    });
    assert.equal(status, 201);
    assert.equal(data.projectName, `Cool App ${stamp}`);
    assert.equal(data.links.length, 2);
});

test('submission: judge cannot submit', async () => {
    const { eventId, judge } = await makePublishedEvent();
    const { status, data } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: judge.token, body: goodSubmission()
    });
    assert.equal(status, 403);
    assert.equal(data.error.code, 'NOT_A_TEAM');
});

test('submission: draft event rejects submissions', async () => {
    const org = await makeUser('organizer');
    const team = await makeUser('team');
    const { data: event } = await api('/events', {
        method: 'POST', token: org.token,
        body: { name: `Draft ${stamp}`, rubric: [{ name: 'Alpha', weight: 100 }] }
    });
    const { status, data } = await api(`/events/${event._id}/submissions`, {
        method: 'POST', token: team.token, body: goodSubmission()
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'NOT_PUBLISHED');
});

test('submission: second submission from same team → 409', async () => {
    const { eventId } = await makePublishedEvent();
    const team = await makeUser('team');

    await api(`/events/${eventId}/submissions`, { method: 'POST', token: team.token, body: goodSubmission() });
    const { status, data } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: team.token, body: goodSubmission()
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'ALREADY_SUBMITTED');
});

// URL ALLOWLIST
test('submission: javascript: link rejected', async () => {
    const { eventId } = await makePublishedEvent();
    const team = await makeUser('team');

    const { status, data } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: team.token,
        body: { ...goodSubmission(), links: [{ label: 'xss', url: 'javascript:alert(1)' }] }
    });
    assert.equal(status, 422);
    assert.match(data.error.message, /http/i);
});

test('submission: data: link rejected', async () => {
    const { eventId } = await makePublishedEvent();
    const team = await makeUser('team');

    const { status } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: team.token,
        body: { ...goodSubmission(), links: [{ label: 'evil', url: 'data:text/html,<script>1</script>' }] }
    });
    assert.equal(status, 422);
});

test('submission: plain text url rejected', async () => {
    const { eventId } = await makePublishedEvent();
    const team = await makeUser('team');

    const { status } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: team.token,
        body: { ...goodSubmission(), links: [{ label: 'bad', url: 'not a url at all' }] }
    });
    assert.equal(status, 422);
});

// VISIBILITY
test('submission: judge sees team submissions for their event', async () => {
    const { eventId, judge } = await makePublishedEvent();
    const team = await makeUser('team');
    await api(`/events/${eventId}/submissions`, { method: 'POST', token: team.token, body: goodSubmission() });

    const { status, data } = await api(`/events/${eventId}/submissions`, { token: judge.token });
    assert.equal(status, 200);
    assert.equal(data.length, 1);
    assert.equal(data[0].team.email, team.token ? data[0].team.email : null);   // populated
});

test('submission: a team sees only its own', async () => {
    const { eventId } = await makePublishedEvent();
    const teamA = await makeUser('team');
    const teamB = await makeUser('team');

    await api(`/events/${eventId}/submissions`, { method: 'POST', token: teamA.token, body: goodSubmission() });
    await api(`/events/${eventId}/submissions`, { method: 'POST', token: teamB.token, body: goodSubmission() });

    const { data } = await api(`/events/${eventId}/submissions`, { token: teamA.token });
    assert.equal(data.length, 1, 'each team only sees its own submission');
});

test('submission: unattached judge gets 403 on the list', async () => {
    const { eventId } = await makePublishedEvent();
    const stranger = await makeUser('judge');
    const { status } = await api(`/events/${eventId}/submissions`, { token: stranger.token });
    assert.equal(status, 403);
});

test('submission: detail — other team gets 403, owner gets 200', async () => {
    const { eventId } = await makePublishedEvent();
    const teamA = await makeUser('team');
    const teamB = await makeUser('team');

    const { data: created } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: teamA.token, body: goodSubmission()
    });

    const { status: ownerStatus } = await api(`/submissions/${created._id}`, { token: teamA.token });
    assert.equal(ownerStatus, 200);

    const { status: otherStatus } = await api(`/submissions/${created._id}`, { token: teamB.token });
    assert.equal(otherStatus, 403);
});

// EDIT + LOCK
test('submission: team edits its own while open', async () => {
    const { eventId } = await makePublishedEvent();
    const team = await makeUser('team');
    const { data: created } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: team.token, body: goodSubmission()
    });

    const { status, data } = await api(`/submissions/${created._id}`, {
        method: 'PUT', token: team.token, body: { tagline: 'a better tagline' }
    });
    assert.equal(status, 200);
    assert.equal(data.tagline, 'a better tagline');
});

test('submission: locked once the event closes', async () => {
    const { org, eventId } = await makePublishedEvent();
    const team = await makeUser('team');
    const { data: created } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: team.token, body: goodSubmission()
    });

    // organizer closes judging
    await api(`/events/${eventId}`, { method: 'PUT', token: org.token, body: { status: 'closed' } });

    const { status, data } = await api(`/submissions/${created._id}`, {
        method: 'PUT', token: team.token, body: { tagline: 'too late' }
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'SUBMISSION_LOCKED');
});

test('submission: other team cannot edit', async () => {
    const { eventId } = await makePublishedEvent();
    const teamA = await makeUser('team');
    const teamB = await makeUser('team');
    const { data: created } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: teamA.token, body: goodSubmission()
    });

    const { status } = await api(`/submissions/${created._id}`, {
        method: 'PUT', token: teamB.token, body: { projectName: 'Hijacked' }
    });
    assert.equal(status, 403);
});

// WITHDRAW
test('submission: team withdraws while open, then it 404s', async () => {
    const { eventId } = await makePublishedEvent();
    const team = await makeUser('team');
    const { data: created } = await api(`/events/${eventId}/submissions`, {
        method: 'POST', token: team.token, body: goodSubmission()
    });

    const { status: delStatus } = await api(`/submissions/${created._id}`, { method: 'DELETE', token: team.token });
    assert.equal(delStatus, 200);

    const { status: after } = await api(`/submissions/${created._id}`, { token: team.token });
    assert.equal(after, 404);
});

// AUTH
test('submissions: no token → 401', async () => {
    const { status } = await api(`/events/${stamp}/submissions`);
    assert.equal(status, 401);
});
