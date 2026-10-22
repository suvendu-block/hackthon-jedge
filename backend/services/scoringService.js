/// scoringService — the ONE place scoring math happens (ADR-0005).
/// controllers, UI totals, and CSV export all defer to this.
/// pure functions: no DB, no req/res — unit-testable in isolation.

// weights are percentages that must sum to 100
export const WEIGHT_TOTAL = 100;

// a judge's score for one criterion: 0–10
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;

/**
 * contribution of one criterion = (score / 10) × weight
 * e.g. 8/10 on a 20% criterion = 16 points
 */
export const contribution = (score, weight) => (score / SCORE_MAX) * weight;

/**
 * total score for a submission from a judge's criteria scores.
 * rows are matched to rubric criteria by id (order-independent);
 * falls back to index matching when ids are absent.
 *
 * @param {Array<{_id?:string, weight:number}>} criteria — the event rubric
 * @param {Array<{criterion?:string, criterionId?:string, score:number}>} scores
 * @returns {number} 0–100, rounded to 2 decimals
 */
export const totalScore = (criteria, scores) => {
    if (!Array.isArray(criteria) || !Array.isArray(scores)) return 0;

    const sum = criteria.reduce((acc, c, i) => {
        const id = c._id ?? c.id;
        // id match when possible — a judge can reorder the scorecard freely
        const row = id !== undefined && id !== null
            ? scores.find(s => String(s.criterion ?? s.criterionId) === String(id))
            : scores[i];

        const s = row?.score;
        if (typeof s !== 'number' || Number.isNaN(s)) return acc;
        return acc + contribution(s, c.weight);
    }, 0);

    return round2(sum);
};

/**
 * validate a rubric's weights — the Σ=100 rule as a pure function
 * (mirrors the zod/mongoose checks, but usable anywhere)
 * @returns {{ok: boolean, total: number, missing: number}}
 */
export const validateWeights = (criteria) => {
    const total = criteria.reduce((acc, c) => acc + (Number(c.weight) || 0), 0);
    const ok = criteria.length > 0 && Math.abs(total - WEIGHT_TOTAL) < 0.001;
    return { ok, total: round2(total), missing: round2(WEIGHT_TOTAL - total) };
};

/**
 * check the judge scored every criterion (and scores are in range).
 * returns the list of problems — empty array = good to submit.
 * @param {Array<{_id?:string, id?:string, name?:string}>} criteria
 * @param {Array<{criterionId:string, score:number}>} scores
 * @returns {string[]} human-readable issues, [] when valid
 */
export const checkScoresComplete = (criteria, scores) => {
    const problems = [];

    for (const c of criteria) {
        const id = String(c._id ?? c.id);
        // accept both shapes: {criterionId} from callers, {criterion} from the schema
        const hit = scores.find(s => String(s.criterionId ?? s.criterion) === id);

        if (!hit) {
            problems.push(`"${c.name ?? id}" has no score`);
            continue;
        }
        if (typeof hit.score !== 'number' || Number.isNaN(hit.score)) {
            problems.push(`"${c.name ?? id}" score is not a number`);
            continue;
        }
        if (hit.score < SCORE_MIN || hit.score > SCORE_MAX) {
            problems.push(`"${c.name ?? id}" must be ${SCORE_MIN}–${SCORE_MAX}`);
        }
    }

    // stray scores for criteria that don't exist (rubric changed mid-event)
    const known = new Set(criteria.map(c => String(c._id ?? c.id)));
    for (const s of scores) {
        const id = String(s.criterionId ?? s.criterion);
        if (!known.has(id)) {
            problems.push(`score for unknown criterion ${id}`);
        }
    }

    return problems;
};

// round half away from zero at 2dp — avoids 15.000000000000002 display bugs
function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
