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

const makeUser = async (role, label) => {
    const email = `ai+${label}+${Math.random().toString(36).slice(2, 8)}+${stamp}@example.com`;
    const { data } = await api('/auth/register', {
        method: 'POST',
        body: { name: `AI Test ${label}`, email, password: 'password123', role }
    });
    return { token: data.token, id: data._id, email };
};

// one shared world for every test below
const world = {};

test('setup: published event, one assigned judge, one submission', async () => {
    world.org = await makeUser('organizer', 'org');
    world.judge = await makeUser('judge', 'judge');      // assigned
    world.stranger = await makeUser('judge', 'stranger'); // judge, but not assigned
    world.team = await makeUser('team', 'team');

    const { data: event } = await api('/events', {
        method: 'POST', token: world.org.token,
        body: {
            name: `AI Fest ${stamp}`,
            rubric: [
                { name: 'Impact', weight: 60 },
                { name: 'Technical', weight: 40 }
            ]
        }
    });
    world.event = event;

    await api(`/events/${event._id}/judges`, { method: 'POST', token: world.org.token, body: { judgeId: world.judge.id } });
    const pub = await api(`/events/${event._id}`, { method: 'PUT', token: world.org.token, body: { status: 'published' } });

    const { data: sub } = await api(`/events/${event._id}/submissions`, {
        method: 'POST', token: world.team.token,
        body: {
            projectName: `AI Project ${stamp}`,
            tagline: 'triage that never sleeps',
            description: 'a queue model that reads symptoms and ranks urgency for clinic staff, built with a small gradient-boosted model',
            links: [{ label: 'repo', url: 'https://github.com/team/ai-project' }]
        }
    });
    world.sub = sub;

    assert.equal(pub.status, 200);
    assert.ok(sub._id);
});

test('ai-analysis: teams and unassigned judges are turned away', async () => {
    // the team never gets past the route's role gate
    const asTeam = await api(`/submissions/${world.sub._id}/ai-analysis`, { method: 'POST', token: world.team.token });
    assert.equal(asTeam.status, 403);
    assert.equal(asTeam.data.error.code, 'FORBIDDEN');

    // a judge, but not one assigned to this event
    const asStranger = await api(`/submissions/${world.sub._id}/ai-analysis`, { method: 'POST', token: world.stranger.token });
    assert.equal(asStranger.status, 403);
    assert.equal(asStranger.data.error.code, 'NOT_ASSIGNED');
});

test('ai-analysis: assigned judge gets a complete, typed report', async () => {
    const { status, data } = await api(`/submissions/${world.sub._id}/ai-analysis`, { method: 'POST', token: world.judge.token });

    assert.equal(status, 201);
    assert.ok(data.model, 'the report names whichever provider produced it'); // mock or real — either way it is recorded
    assert.ok(data.summary.length > 0);
    assert.ok(data.complexityAnalysis.length > 0);

    // ADR-0009: every finding is typed (count varies by provider — types are the contract)
    assert.ok(data.evidence.length >= 1);
    for (const e of data.evidence) {
        assert.ok(['verified-evidence', 'team-claim', 'ai-inference'].includes(e.type));
        assert.ok(e.text.length > 0);
    }

    // every rubric criterion covered, each with rationale + confidence
    assert.equal(data.suggestedScores.length, 2);
    const names = data.suggestedScores.map(s => s.criterion).sort();
    assert.deepEqual(names, ['Impact', 'Technical']);
    for (const s of data.suggestedScores) {
        assert.ok(s.score >= 0 && s.score <= 10);
        assert.ok(s.rationale.length > 0);
        assert.ok(s.confidence >= 0 && s.confidence <= 1);
    }

    // never a report without limitations — and never provider secrets
    assert.ok(data.limitations.length >= 1);
    const blob = JSON.stringify(data);
    assert.ok(!blob.includes('apiKey') && !blob.includes('sk-'), 'no key material in the response');
});

test('ai-analysis: GET returns the stored latest report', async () => {
    const { status, data } = await api(`/submissions/${world.sub._id}/ai-analysis`, { token: world.judge.token });
    assert.equal(status, 200);
    assert.equal(data.suggestedScores.length, 2);
});

test('ai-analysis: rate limit cuts a judge off after the hourly allowance', async () => {
    // the two calls above already spent part of the budget — burn the rest
    let last = null;
    for (let i = 0; i < 12; i++) {
        last = await api(`/submissions/${world.sub._id}/ai-analysis`, { method: 'POST', token: world.judge.token });
        if (last.status === 429) break;
    }
    assert.equal(last.status, 429);
    assert.equal(last.data.error.code, 'RATE_LIMITED');

    // and it stays cut off
    const again = await api(`/submissions/${world.sub._id}/ai-analysis`, { method: 'POST', token: world.judge.token });
    assert.equal(again.status, 429);
});

test('ai-analysis: no drafts once judging closes', async () => {
    const close = await api(`/events/${world.event._id}`, { method: 'PUT', token: world.org.token, body: { status: 'closed' } });
    assert.equal(close.status, 200);

    // a fresh judge bucket — the old one is still rate-limited, and gating must win
    const judge2 = await makeUser('judge', 'judge2');
    await api(`/events/${world.event._id}/judges`, { method: 'POST', token: world.org.token, body: { judgeId: judge2.id } });

    const { status, data } = await api(`/submissions/${world.sub._id}/ai-analysis`, { method: 'POST', token: judge2.token });
    assert.equal(status, 409);
    assert.equal(data.error.code, 'EVENT_CLOSED');
});
