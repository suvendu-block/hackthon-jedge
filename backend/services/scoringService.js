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

// same idea at 1dp (what the scorecard and leaderboard show). the 1e-9 slack
// absorbs float noise so 81.64999999999999 lands on 81.7, not 81.6
function round1(n) {
    return Math.round(n * 10 + 1e-9) / 10;
}

/**
 * standings for an event — every submission ranked by the average of its
 * submitted scorecards. This is still ADR-0005 territory: the UI and the CSV
 * render exactly what this returns, they never re-derive it.
 *
 * Ties break in a fixed order so reruns can never shuffle the board:
 *   1. higher average (1dp — the same precision a judge sees on the card)
 *   2. more judges have signed off (a fuller picture beats a thin one)
 *   3. project name A→Z (deterministic across machines)
 *   4. submission id (pure tie-stopper)
 * A submission nobody scored sits at the bottom with rank/average null —
 * it isn't a zero, it simply hasn't been judged yet.
 *
 * @param {Array<{_id:string, projectName:string, tagline?:string, team?:{name:string}}>} submissions
 * @param {Array<{submission:any, judge:any, total:number, status?:string}>} evaluations
 *        drafts are ignored — only submitted scorecards count
 * @returns {Array} rows {rank, submission, project, team, tagline, average, judged, scores}
 */
export const buildLeaderboard = (submissions = [], evaluations = []) => {
    const submitted = evaluations.filter(e => (e.status ?? 'submitted') === 'submitted');

    const rows = submissions.map(s => {
        const id = String(s._id ?? s.id);
        const mine = submitted.filter(e => String(e.submission) === id);

        const scores = mine
            .map(e => ({
                judge: String(e.judge?._id ?? e.judge),
                judgeName: typeof e.judge === 'object' && e.judge !== null ? (e.judge.name ?? '') : '',
                total: e.total
            }))
            .sort((a, b) => a.judgeName.localeCompare(b.judgeName) || a.judge.localeCompare(b.judge));

        const average = mine.length
            ? round1(mine.reduce((sum, e) => sum + e.total, 0) / mine.length)
            : null;

        return {
            rank: null,
            submission: id,
            project: s.projectName,
            team: s.team?.name ?? '',
            tagline: s.tagline ?? '',
            average,
            judged: mine.length,
            scores
        };
    });

    const scored = rows.filter(r => r.average !== null);
    scored.sort((a, b) =>
        b.average - a.average ||
        b.judged - a.judged ||
        a.project.localeCompare(b.project) ||
        a.submission.localeCompare(b.submission)
    );
    scored.forEach((row, i) => { row.rank = i + 1; });

    const unscored = rows.filter(r => r.average === null);
    unscored.sort((a, b) =>
        a.project.localeCompare(b.project) || a.submission.localeCompare(b.submission)
    );

    return [...scored, ...unscored];
};
