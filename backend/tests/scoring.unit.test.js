import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    contribution,
    totalScore,
    validateWeights,
    checkScoresComplete,
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
