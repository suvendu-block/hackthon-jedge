import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
const stamp = Date.now();   // unique emails so re-runs don't collide

// helper: call the API
const api = async (path, { method = 'GET', body, token, raw = false } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    if (raw) {
        const text = await res.text();
        return { status: res.status, headers: res.headers, text };
    }
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

const makeUser = async (role, label) => {
    const email = `lb+${label}+${Math.random().toString(36).slice(2, 8)}+${stamp}@example.com`;
    const { data } = await api('/auth/register', {
        method: 'POST',
        body: { name: `Leaderboard Test ${label}`, email, password: 'password123', role }
    });
    return { token: data.token, id: data._id, email };
};

// one shared world for every test below, built once in the first test
const world = {};

test('setup: event with two judges, two teams, two submissions', async () => {
    world.org = await makeUser('organizer', 'org');
    world.org2 = await makeUser('organizer', 'org2');   // someone else's event
    world.j1 = await makeUser('judge', 'judge1');
    world.j2 = await makeUser('judge', 'judge2');
    world.t1 = await makeUser('team', 'team1');
    world.t2 = await makeUser('team', 'team2');

    const { data: event } = await api('/events', {
        method: 'POST', token: world.org.token,
        body: {
            name: `Leaderboard Fest ${stamp}`,
            rubric: [
                { name: 'Impact', weight: 50 },
                { name: 'Technical', weight: 50 }
            ]
        }
    });
    world.event = event;

    for (const j of [world.j1, world.j2]) {
        await api(`/events/${event._id}/judges`, { method: 'POST', token: world.org.token, body: { judgeId: j.id } });
    }
    const pub = await api(`/events/${event._id}`, { method: 'PUT', token: world.org.token, body: { status: 'published' } });

    const { data: sub1 } = await api(`/events/${event._id}/submissions`, {
        method: 'POST', token: world.t1.token,
        body: { projectName: 'Alpha', tagline: 'first in, first judged' }
    });
    const { data: sub2 } = await api(`/events/${event._id}/submissions`, {
        method: 'POST', token: world.t2.token,
        body: { projectName: 'Beta' }
    });
    world.sub1 = sub1;
    world.sub2 = sub2;

    assert.equal(pub.status, 200);
    assert.equal(pub.data.status, 'published');
    assert.ok(sub1._id && sub2._id);
});

const score = (sub, judge, a, b, token) =>
    api(`/evaluations/submission/${sub._id}/submit`, {
        method: 'POST', token,
        body: {
            scores: [
                { criterion: world.event.rubric[0]._id, score: a },
                { criterion: world.event.rubric[1]._id, score: b }
            ],
            comments: 'hand-checked'
        }
    });

test('setup: Alpha scores 90 + 80 across judges, Beta scores 50', async () => {
    const r1 = await score(world.sub1, world.j1, 9, 9, world.j1.token);   // 9/10×50 + 9/10×50 = 90
    const r2 = await score(world.sub1, world.j2, 8, 8, world.j2.token);   // 80
    const r3 = await score(world.sub2, world.j1, 5, 5, world.j1.token);   // 50

    assert.equal(r1.status, 200);
    assert.equal(r1.data.total, 90);
    assert.equal(r2.data.total, 80);
    assert.equal(r3.data.total, 50);
});

test('leaderboard: sealed for teams and judges before release', async () => {
    const asTeam = await api(`/events/${world.event._id}/leaderboard`, { token: world.t1.token });
    assert.equal(asTeam.status, 200);
    assert.equal(asTeam.data.sealed, true);
    assert.equal(asTeam.data.standings.length, 0);   // not one score leaks
    assert.equal(asTeam.data.event.name, `Leaderboard Fest ${stamp}`);   // header still works

    const asJudge = await api(`/events/${world.event._id}/leaderboard`, { token: world.j1.token });
    assert.equal(asJudge.data.sealed, true);
    assert.equal(asJudge.data.standings.length, 0);   // judges can't benchmark midway either
});

test('leaderboard: organizer gets the preview — Alpha 85 ranks above Beta 50', async () => {
    const { status, data } = await api(`/events/${world.event._id}/leaderboard`, { token: world.org.token });

    assert.equal(status, 200);
    assert.equal(data.sealed, false);
    assert.equal(data.released, false);
    assert.equal(data.event.assigned, 2);

    assert.equal(data.standings.length, 2);

    const [first, second] = data.standings;
    assert.equal(first.project, 'Alpha');
    assert.equal(first.rank, 1);
    assert.equal(first.average, 85);        // (90+80)/2, hand-checked
    assert.equal(first.judged, 2);
    assert.equal(first.scores.length, 2);

    assert.equal(second.project, 'Beta');
    assert.equal(second.rank, 2);
    assert.equal(second.average, 50);
    assert.equal(second.judged, 1);
});

test('csv: sealed for a team, always there for the organizer', async () => {
    const sealed = await api(`/events/${world.event._id}/leaderboard/csv`, { token: world.t1.token, raw: true });
    assert.equal(sealed.status, 409);
    assert.match(JSON.parse(sealed.text).error.code, /RESULTS_SEALED/);

    const csv = await api(`/events/${world.event._id}/leaderboard/csv`, { token: world.org.token, raw: true });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    assert.match(csv.headers.get('content-disposition'), /attachment; filename=".*-results\.csv"/);
    assert.ok(csv.text.includes('rank,project,team,average,judged,assigned'));   // header row
    assert.ok(csv.text.includes('Alpha'));
    assert.ok(csv.text.includes('85'));
    assert.ok(csv.text.includes('Leaderboard Test judge1'));   // one column per judge
    assert.ok(csv.text.includes('\r\n'));                       // spreadsheet line endings
});

test('release: only the owner, only after closing', async () => {
    // wrong role
    const asTeam = await api(`/events/${world.event._id}/leaderboard/release`, { method: 'POST', token: world.t1.token });
    assert.equal(asTeam.status, 403);

    // right role, wrong event
    const asOtherOrg = await api(`/events/${world.event._id}/leaderboard/release`, { method: 'POST', token: world.org2.token });
    assert.equal(asOtherOrg.status, 403);

    // right event, but judging still open
    const tooEarly = await api(`/events/${world.event._id}/leaderboard/release`, { method: 'POST', token: world.org.token });
    assert.equal(tooEarly.status, 409);
    assert.equal(tooEarly.data.error.code, 'EVENT_NOT_CLOSED');
});

test('release: close, release, and the board opens for everyone', async () => {
    const close = await api(`/events/${world.event._id}`, { method: 'PUT', token: world.org.token, body: { status: 'closed' } });
    assert.equal(close.status, 200);

    const release = await api(`/events/${world.event._id}/leaderboard/release`, { method: 'POST', token: world.org.token });
    assert.equal(release.status, 200);
    assert.equal(release.data.released, true);
    assert.ok(release.data.releasedAt);

    // second press bounces
    const twice = await api(`/events/${world.event._id}/leaderboard/release`, { method: 'POST', token: world.org.token });
    assert.equal(twice.status, 409);
    assert.equal(twice.data.error.code, 'ALREADY_RELEASED');

    // the team that was locked out now sees the same 85/50 board
    const asTeam = await api(`/events/${world.event._id}/leaderboard`, { token: world.t1.token });
    assert.equal(asTeam.data.sealed, false);
    assert.equal(asTeam.data.released, true);
    assert.equal(asTeam.data.standings[0].project, 'Alpha');
    assert.equal(asTeam.data.standings[0].average, 85);

    // and can pull the file
    const csv = await api(`/events/${world.event._id}/leaderboard/csv`, { token: world.t1.token, raw: true });
    assert.equal(csv.status, 200);
    assert.ok(csv.text.includes('Beta'));
});

test('release: once results are out, the event cannot be reopened', async () => {
    const { status, data } = await api(`/events/${world.event._id}`, {
        method: 'PUT', token: world.org.token, body: { status: 'published' }
    });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'RESULTS_LOCKED');
});
