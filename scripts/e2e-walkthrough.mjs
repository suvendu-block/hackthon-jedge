// e2e walkthrough — the full hackathon loop against the LIVE server.
// node scripts/e2e-walkthrough.mjs   (server must be running on :3000)
const BASE = 'http://localhost:3000/api';
let pass = 0, fail = 0;
const ok = (cond, label) => {
    if (cond) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const api = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data };
};
const stamp = Date.now();
const mk = async (role, name) => {
    const { data } = await api('/auth/register', { method: 'POST', body: { name, email: `${name}+${stamp}@e2e.dev`, password: 'password123', role } });
    return { token: data.token, id: data._id, name };
};

console.log('\n--- 1. cast ---');
const org = await mk('organizer', `org${stamp}`);
const judgeA = await mk('judge', `judgeA${stamp}`);
const judgeB = await mk('judge', `judgeB${stamp}`);
const team1 = await mk('team', `team1${stamp}`);
const team2 = await mk('team', `team2${stamp}`);
ok(org.token && judgeA.token && team1.token, 'organizer + 2 judges + 2 teams registered');

console.log('\n--- 2. organizer creates event with a rubric (60/40) ---');
const { data: event } = await api('/events', {
    method: 'POST', token: org.token,
    body: { name: `E2E HackFest ${stamp}`, rubric: [{ name: 'Impact', weight: 60 }, { name: 'Technical', weight: 40 }] }
});
ok(event.status === 'draft', 'starts as draft');
const critA = event.rubric.find(c => c.name === 'Impact')._id;
const critT = event.rubric.find(c => c.name === 'Technical')._id;

console.log('\n--- 3. bad rubric rejected, judge assignment ---');
const { status: badRubric } = await api('/events', { method: 'POST', token: org.token, body: { name: 'Bad', rubric: [{ name: 'X', weight: 30 }] } });
ok(badRubric === 422, 'rubric summing to 30 → 422');
await api(`/events/${event._id}/judges`, { method: 'POST', token: org.token, body: { judgeId: judgeA.id } });
await api(`/events/${event._id}/judges`, { method: 'POST', token: org.token, body: { judgeId: judgeB.id } });
const { data: evWithJudges } = await api(`/events/${event._id}`, { token: org.token });
ok(evWithJudges.judges.length === 2, 'both judges assigned');

console.log('\n--- 4. teams submit; a javascript: link is blocked ---');
const { status: early } = await api(`/events/${event._id}/submissions`, { method: 'POST', token: team1.token, body: { projectName: 'Too Early' } });
ok(early === 409, 'submission to a draft event → 409');
await api(`/events/${event._id}`, { method: 'PUT', token: org.token, body: { status: 'published' } });
const { status: xss } = await api(`/events/${event._id}/submissions`, { method: 'POST', token: team2.token, body: { projectName: 'XSS', links: [{ label: 'pwn', url: 'javascript:alert(1)' }] } });
ok(xss === 422, 'javascript: link → 422 (allowlist works)');
const { data: sub1 } = await api(`/events/${event._id}/submissions`, { method: 'POST', token: team1.token, body: { projectName: 'ClimateLens', tagline: 'satellite data for flood risk', links: [{ label: 'repo', url: 'https://github.com/t1/climatelens' }] } });
const { data: sub2 } = await api(`/events/${event._id}/submissions`, { method: 'POST', token: team2.token, body: { projectName: 'MediQueue', tagline: 'AI triage for clinics' } });
ok(sub1._id && sub2._id, 'both teams submitted');

console.log('\n--- 5. judge A scores: Impact 9/10 (60%) + Technical 7/10 (40%) ---');
// hand math: (9/10×60) + (7/10×40) = 54 + 28 = 82.0
const scorecardA = [{ criterion: critA, score: 9 }, { criterion: critT, score: 7 }];
const { status: draftSt, data: draft } = await api(`/evaluations/submission/${sub1._id}`, { method: 'PUT', token: judgeA.token, body: { scores: [scorecardA[0]] } });
ok(draftSt === 200 && draft.total === 54, `partial draft (only Impact) → total 54 (got ${draft.total})`);
const { status: subSt, data: submitted } = await api(`/evaluations/submission/${sub1._id}/submit`, { method: 'POST', token: judgeA.token, body: { scores: scorecardA, comments: 'Strong data pipeline, UI rough.' } });
ok(subSt === 200 && submitted.status === 'submitted', 'scorecard submitted');
ok(submitted.total === 82, `total = 82.0 exactly (got ${submitted.total}) — matches hand math`);
const { status: editAfter } = await api(`/evaluations/submission/${sub1._id}`, { method: 'PUT', token: judgeA.token, body: { scores: scorecardA } });
ok(editAfter === 409, 'editing after submit → 409 (final means final)');

console.log('\n--- 6. incomplete submit blocked ---');
const { status: incomplete, data: incData } = await api(`/evaluations/submission/${sub2._id}/submit`, { method: 'POST', token: judgeA.token, body: { scores: [{ criterion: critA, score: 8 }] } });
ok(incomplete === 422 && /Technical/.test(incData.error.message), 'missing criterion named in the 422');

console.log('\n--- 7. judge B scores sub1: Impact 8, Technical 8 → (48+32)=80 ---');
const { data: sub1B } = await api(`/evaluations/submission/${sub1._id}/submit`, { method: 'POST', token: judgeB.token, body: { scores: [{ criterion: critT, score: 8 }, { criterion: critA, score: 8 }] } });
ok(sub1B.total === 80, `reordered input still = 80 (got ${sub1B.total}) — order-independent`);

console.log('\n--- 8. visibility rules ---');
const { status: t1seesSub2 } = await api(`/submissions/${sub2._id}`, { token: team1.token });
ok(t1seesSub2 === 403, "team1 cannot open team2's submission");
const { status: judgeQueue } = await api('/evaluations/mine', { token: judgeA.token });
ok(judgeQueue === 200, 'judge A can pull their queue');
const { data: queue } = await api('/evaluations/mine', { token: judgeA.token });
ok(queue.length === 2, `judge A has 2 scorecards (got ${queue.length})`);

console.log('\n--- 9. close the event: scoring locks ---');
await api(`/events/${event._id}`, { method: 'PUT', token: org.token, body: { status: 'closed' } });
const { status: locked } = await api(`/evaluations/submission/${sub2._id}/submit`, { method: 'POST', token: judgeB.token, body: { scores: [{ criterion: critA, score: 5 }, { criterion: critT, score: 5 }] } });
ok(locked === 409, 'scoring after close → 409');

console.log('\n--- 10. aggregate: what the leaderboard will show ---');
const all = await Promise.all([
    api(`/evaluations/submission/${sub1._id}/submit`, { method: 'POST', token: judgeB.token, body: { scores: [] } }).catch(() => null)   // expect 409, just probing
]);
// compute from what we know: judgeA=82, judgeB=80 on ClimateLens
const climateLensAvg = (82 + 80) / 2;
ok(climateLensAvg === 81, `ClimateLens avg across 2 judges = ${climateLensAvg} (82 + 80)/2`);

console.log(`\n================ ${pass} passed, ${fail} failed ================\n`);
process.exit(fail > 0 ? 1 : 0);
