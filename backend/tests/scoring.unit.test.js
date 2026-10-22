import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    contribution,
    totalScore,
    validateWeights,
    checkScoresComplete,
    buildLeaderboard,
    WEIGHT_TOTAL,
    SCORE_MIN,
    SCORE_MAX
} from '../services/scoringService.js';

// ---- contribution: (score/10) × weight ----

test('contribution: 8/10 on 20% = 16 points (the ADR-0005 example)', () => {
    assert.equal(contribution(8, 20), 16);
});

test('contribution: perfect 10/10 gives the full weight', () => {
    assert.equal(contribution(10, 35), 35);
});

test('contribution: 0/10 gives nothing', () => {
    assert.equal(contribution(0, 40), 0);
});

// ---- totalScore ----

const rubric = [
    { _id: 'a', weight: 40 },
    { _id: 'b', weight: 35 },
    { _id: 'c', weight: 25 }
];

test('totalScore: scores in rubric order sum to 100 at perfect', () => {
    const scores = [{ criterion: 'a', score: 10 }, { criterion: 'b', score: 10 }, { criterion: 'c', score: 10 }];
    assert.equal(totalScore(rubric, scores), 100);
});

test('totalScore: mixed scores match hand-computed value', () => {
    // 9/10×40 = 36 · 8/10×35 = 28 · 7/10×25 = 17.5 → 81.5
    const scores = [{ criterion: 'a', score: 9 }, { criterion: 'b', score: 8 }, { criterion: 'c', score: 7 }];
    assert.equal(totalScore(rubric, scores), 81.5);
});

test('totalScore: ignores missing/partial rows (draft state)', () => {
    const scores = [{ criterion: 'a', score: 10 }];   // b and c not scored yet
    assert.equal(totalScore(rubric, scores), 40);
});

test('totalScore: garbage input returns 0, never NaN', () => {
    assert.equal(totalScore(null, null), 0);
    assert.equal(totalScore(rubric, [{ score: 'ten' }]), 0);
});

test('totalScore: no float drift on tricky weights', () => {
    // 0.1+0.2 weights style problem: three 33.33% criteria
    const thirds = [{ weight: 33.33 }, { weight: 33.33 }, { weight: 33.34 }];
    const scores = [{ score: 7 }, { score: 7 }, { score: 7 }];
    // 7/10 × 100 = 70 exactly — must not be 70.00000000000001
    assert.equal(totalScore(thirds, scores), 70);
});

// ---- validateWeights: the Σ=100 rule ----

test('validateWeights: exactly 100 passes', () => {
    const r = validateWeights([{ weight: 60 }, { weight: 40 }]);
    assert.equal(r.ok, true);
    assert.equal(r.total, 100);
});

test('validateWeights: 90 fails, reports 10 missing', () => {
    const r = validateWeights([{ weight: 60 }, { weight: 30 }]);
    assert.equal(r.ok, false);
    assert.equal(r.missing, 10);
});

test('validateWeights: 110 fails, reports -10 missing', () => {
    const r = validateWeights([{ weight: 60 }, { weight: 50 }]);
    assert.equal(r.ok, false);
    assert.equal(r.missing, -10);
});

test('validateWeights: empty rubric fails', () => {
    assert.equal(validateWeights([]).ok, false);
    assert.equal(WEIGHT_TOTAL, 100);
});

// ---- checkScoresComplete ----

const criteria = [
    { _id: 'a', name: 'Impact', weight: 50 },
    { _id: 'b', name: 'Technical', weight: 50 }
];

test('checkScoresComplete: all scored in range → no problems', () => {
    const problems = checkScoresComplete(criteria, [
        { criterionId: 'a', score: 8 },
        { criterionId: 'b', score: 9 }
    ]);
    assert.deepEqual(problems, []);
});

test('checkScoresComplete: missing criterion is reported by name', () => {
    const problems = checkScoresComplete(criteria, [{ criterionId: 'a', score: 8 }]);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /Technical/);
});

test('checkScoresComplete: out-of-range score rejected', () => {
    const problems = checkScoresComplete(criteria, [
        { criterionId: 'a', score: 11 },     // too high
        { criterionId: 'b', score: 9 }
    ]);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /0–10/);
});

test('checkScoresComplete: score for unknown criterion flagged', () => {
    const problems = checkScoresComplete(criteria, [
        { criterionId: 'a', score: 8 },
        { criterionId: 'b', score: 9 },
        { criterionId: 'zzz', score: 5 }      // rubric changed, stale row
    ]);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /unknown criterion/);
});

test('bounds exported so UI/API agree on the scale', () => {
    assert.equal(SCORE_MIN, 0);
    assert.equal(SCORE_MAX, 10);
});

// ---- buildLeaderboard: standings, averages, tie-breakers ----

const board = (projects) => projects.map(p => ({
    _id: p.id, projectName: p.name, tagline: p.tagline ?? '', team: { name: p.team ?? 'Team' }
}));

test('buildLeaderboard: two judges average by hand — (82+80)/2 = 81', () => {
    const rows = buildLeaderboard(
        board([{ id: 's1', name: 'ClimateLens' }]),
        [
            { submission: 's1', judge: { _id: 'j1', name: 'Bo' }, total: 82, status: 'submitted' },
            { submission: 's1', judge: { _id: 'j2', name: 'Ann' }, total: 80, status: 'submitted' }
        ]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].average, 81);
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[0].judged, 2);
    // per-judge chips come out alphabetical so the UI is stable
    assert.deepEqual(rows[0].scores.map(s => s.judgeName), ['Ann', 'Bo']);
});

test('buildLeaderboard: draft scorecards never reach the standings', () => {
    const rows = buildLeaderboard(
        board([{ id: 's1', name: 'Alpha' }]),
        [
            { submission: 's1', judge: { _id: 'j1', name: 'A' }, total: 80, status: 'submitted' },
            { submission: 's1', judge: { _id: 'j2', name: 'B' }, total: 100, status: 'draft' }
        ]
    );
    assert.equal(rows[0].average, 80);
    assert.equal(rows[0].judged, 1);
});

test('buildLeaderboard: ranks highest first', () => {
    const rows = buildLeaderboard(
        board([{ id: 'a', name: 'Aardvark' }, { id: 'b', name: 'Middle' }, { id: 'c', name: 'Zulu' }]),
        [
            { submission: 'a', judge: 'j1', total: 60, status: 'submitted' },
            { submission: 'b', judge: 'j1', total: 95, status: 'submitted' },
            { submission: 'c', judge: 'j1', total: 75, status: 'submitted' }
        ]
    );
    assert.deepEqual(rows.map(r => r.project), ['Middle', 'Zulu', 'Aardvark']);
    assert.deepEqual(rows.map(r => r.rank), [1, 2, 3]);
});

test('buildLeaderboard: equal averages — the fuller judging wins', () => {
    const rows = buildLeaderboard(
        board([{ id: 'a', name: 'Zeta' }, { id: 'b', name: 'Alpha' }]),
        [
            { submission: 'a', judge: 'j1', total: 80, status: 'submitted' },
            { submission: 'b', judge: 'j1', total: 80, status: 'submitted' },
            { submission: 'b', judge: 'j2', total: 80, status: 'submitted' }
        ]
    );
    assert.equal(rows[0].project, 'Alpha');   // same 80, but 2 judges vs 1
    assert.equal(rows[0].judged, 2);
});

test('buildLeaderboard: still tied — alphabetical settles it', () => {
    const rows = buildLeaderboard(
        board([{ id: 'z', name: 'Beta' }, { id: 'y', name: 'Aardvark' }]),
        [
            { submission: 'z', judge: 'j1', total: 70, status: 'submitted' },
            { submission: 'y', judge: 'j1', total: 70, status: 'submitted' }
        ]
    );
    assert.deepEqual(rows.map(r => r.project), ['Aardvark', 'Beta']);
});

test('buildLeaderboard: unjudged sits last, rank and average null (not 0)', () => {
    const rows = buildLeaderboard(
        board([{ id: 'a', name: 'Scored' }, { id: 'b', name: 'Ghost' }]),
        [{ submission: 'a', judge: 'j1', total: 50, status: 'submitted' }]
    );
    assert.equal(rows[0].project, 'Scored');
    assert.equal(rows[1].project, 'Ghost');
    assert.equal(rows[1].rank, null);
    assert.equal(rows[1].average, null);
    assert.equal(rows[1].judged, 0);
});

test('buildLeaderboard: average rounds to the scorecard\'s 1dp, float noise and all', () => {
    // 81.6 + 81.7 = 163.3 → 81.65 → must show 81.7, not 81.6
    const rows = buildLeaderboard(
        board([{ id: 's1', name: 'Edge' }]),
        [
            { submission: 's1', judge: 'j1', total: 81.6, status: 'submitted' },
            { submission: 's1', judge: 'j2', total: 81.7, status: 'submitted' }
        ]
    );
    assert.equal(rows[0].average, 81.7);
});

test('buildLeaderboard: empty inputs give an empty board', () => {
    assert.deepEqual(buildLeaderboard([], []), []);
});
