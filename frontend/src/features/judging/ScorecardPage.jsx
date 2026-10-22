import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getScorecard, saveDraft, submitEvaluation } from './judging.api.js';
import './ScorecardPage.css';

// running-total mirror of backend scoringService (ADR-0005: server is the
// authority — this is only the live preview the judge sees while typing)
const contribution = (score, weight) => (score / 10) * weight;
const previewTotal = (rubric, scores) =>
    rubric.reduce((sum, c) => {
        const s = scores[c._id];
        return typeof s === 'number' && !Number.isNaN(s) ? sum + contribution(s, c.weight) : sum;
    }, 0);

// the scorecard — the hero screen for judges
export default function ScorecardPage() {
    const { submissionId } = useParams();

    const [data, setData] = useState(null);      // { evaluation, rubric, submission }
    const [scores, setScores] = useState({});    // criterionId -> 0–10
    const [comments, setComments] = useState('');
    const [savedAt, setSavedAt] = useState(null);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        let ignore = false;   // StrictMode mounts twice — a slow stale load must
        // never wipe scores the judge has already started setting
        getScorecard(submissionId)
            .then((d) => {
                if (ignore) return;
                setData(d);
                // hydrate from any existing draft
                const map = {};
                for (const row of d.evaluation.scores || []) map[row.criterion] = row.score;
                setScores(map);
                setComments(d.evaluation.comments || '');
            })
            .catch((err) => {
                if (!ignore) setError(err.response?.data?.error?.message || 'Could not load scorecard');
            });
        return () => { ignore = true; };
    }, [submissionId]);

    if (error) return <main className="score"><p className="score-error">{error}</p></main>;
    if (!data) return <main className="score"><p className="score-empty">loading scorecard…</p></main>;

    const { rubric, submission, evaluation } = data;
    const total = previewTotal(rubric, scores);
    const rounded = Math.round(total * 10) / 10;
    const scored = rubric.filter(c => typeof scores[c._id] === 'number').length;
    const complete = scored === rubric.length;
    const submitted = evaluation.status === 'submitted';

    const payload = () => ({
        scores: rubric
            .filter(c => typeof scores[c._id] === 'number')
            .map(c => ({ criterion: c._id, score: scores[c._id] })),
        comments
    });

    const setScore = (id, value) => {
        setScores({ ...scores, [id]: value });
    };

    const handleSaveDraft = async () => {
        setBusy('draft');
        setError('');
        try {
            await saveDraft(submissionId, payload());
            setSavedAt(new Date());
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not save draft');
        } finally {
            setBusy('');
        }
    };

    const handleSubmit = async () => {
        if (!complete) {
            setError(`still need a score for ${rubric.length - scored} criterion`);
            return;
        }
        if (!window.confirm(`Submit this scorecard at ${rounded}/100? It becomes final.`)) return;

        setBusy('submit');
        setError('');
        try {
            await submitEvaluation(submissionId, payload());
            // reload — server now owns the submitted total/timestamp
            const fresh = await getScorecard(submissionId);
            setData(fresh);
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not submit');
        } finally {
            setBusy('');
        }
    };

    return (
        <main className="score">
            <div className="score-bg" aria-hidden="true"><div className="score-lamp" /></div>

            <header className="score-header">
                <div>
                    <Link to="/events" className="score-back">← the docket</Link>
                    <span className="score-eyebrow">the verdict</span>
                    <h1>{submission.projectName}</h1>
                    {submission.tagline && <p className="score-tagline">{submission.tagline}</p>}
                </div>
                {/* the running total — always visible, the whole point of this screen */}
                <div className={`score-total ${complete ? 'is-complete' : ''}`}>
                    <span className="score-total-num">{rounded}</span>
                    <span className="score-total-den">/ 100</span>
                    <span className="score-total-note">
                        {submitted
                            ? 'submitted — final'
                            : complete
                                ? 'all criteria scored'
                                : `${scored} of ${rubric.length} scored`}
                    </span>
                </div>
            </header>

            {error && <p role="alert" className="score-error">{error}</p>}
            {submitted && (
                <p className="score-final">
                    Submitted {new Date(evaluation.submittedAt).toLocaleString()} — locked.
                </p>
            )}

            {/* ---------- criteria ---------- */}
            <ul className="score-list">
                {rubric.map((c) => {
                    const val = scores[c._id];
                    const contributionPts = typeof val === 'number' ? contribution(val, c.weight) : null;
                    return (
                        <li key={c._id} className="score-row">
                            <div className="score-crit">
                                <span className="score-crit-name">{c.name}</span>
                                <span className="score-crit-weight">{c.weight}% weight</span>
                                {c.description && <p className="score-crit-desc">{c.description}</p>}
                            </div>

                            <div className="score-input">
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="1"
                                    value={val ?? 0}
                                    disabled={submitted}
                                    onChange={(e) => setScore(c._id, Number(e.target.value))}
                                    aria-label={`${c.name} score`}
                                />
                                <div className="score-readout">
                                    <span className="score-value">{val ?? '–'}</span>
                                    <span className="score-max">/10</span>
                                    {contributionPts !== null && (
                                        <span className="score-contrib">+{Math.round(contributionPts * 10) / 10}</span>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* ---------- comments ---------- */}
            <div className="score-comments">
                <span className="score-label">justification (teams see this)</span>
                <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="why these scores? what stood out, what's missing…"
                    rows={4}
                    maxLength={3000}
                    disabled={submitted}
                />
            </div>

            {/* ---------- actions ---------- */}
            {!submitted && (
                <div className="score-actions">
                    <button className="score-submit" onClick={handleSubmit} disabled={busy || !complete}>
                        {busy === 'submit' ? 'submitting…' : `submit — ${rounded}/100`}
                    </button>
                    <button className="score-draft" onClick={handleSaveDraft} disabled={busy}>
                        {busy === 'draft' ? 'saving…' : 'save draft'}
                    </button>
                    {savedAt && (
                        <span className="score-saved">draft saved {savedAt.toLocaleTimeString()}</span>
                    )}
                </div>
            )}
        </main>
    );
}
