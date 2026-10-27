import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    getScorecard, saveDraft, submitEvaluation, requestAnalysis, getAnalysis,
    getInsight, refreshInsight, listDocuments, documentBlob,
    getDemoCheck, checkDemo, listEvidence, addEvidence, deleteEvidence
} from './judging.api.js';
import './ScorecardPage.css';
import QaReport from '@/features/shared/QaReport.jsx';

// evidence badge labels — icon + text, never color alone (accessibility)
const EV_LABEL = {
    'verified-evidence': '✓ verified',
    'team-claim': '◆ claimed',
    'ai-inference': '≈ inferred'
};

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
    const [ai, setAi] = useState(null);          // latest AI draft report, if any
    const [aiBusy, setAiBusy] = useState(false);
    const [aiError, setAiError] = useState('');

    // phase 7 — the evidence panel: server-fetched artifacts + the judge's
    // own criterion-linked notes (BL-11)
    const [insight, setInsight] = useState(null);
    const [docs, setDocs] = useState([]);
    const [demo, setDemo] = useState(null);
    const [notes, setNotes] = useState([]);
    const [evForm, setEvForm] = useState({ criterion: '', type: 'verified-evidence', text: '', source: '' });
    const [evBusy, setEvBusy] = useState('');
    const [evError, setEvError] = useState('');

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

    // a stored AI draft rides along with the scorecard (404 = none yet)
    useEffect(() => {
        let ignore = false;
        getAnalysis(submissionId)
            .then((d) => { if (!ignore) setAi(d); })
            .catch(() => { /* none yet — the judge can ask for one */ });
        return () => { ignore = true; };
    }, [submissionId]);

    // evidence artifacts — whatever the server has already fetched for this
    // submission, plus this judge's own notes. anything missing just stays
    // unbuilt on the panel; none of it blocks scoring.
    useEffect(() => {
        let ignore = false;
        (async () => {
            const [i, d, dc, n] = await Promise.all([
                getInsight(submissionId).catch(() => null),
                listDocuments(submissionId).catch(() => null),
                getDemoCheck(submissionId).catch(() => null),
                listEvidence(submissionId).catch(() => null)
            ]);
            if (ignore) return;
            setInsight(i?.insight || null);
            setDocs(d?.documents || []);
            setDemo(dc?.check || null);
            setNotes(n?.evidence || []);
        })();
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

    const handleAskAi = async () => {
        setAiBusy(true);
        setAiError('');
        try {
            setAi(await requestAnalysis(submissionId));
        } catch (err) {
            setAiError(err.response?.data?.error?.message || 'AI analysis unavailable');
        } finally {
            setAiBusy(false);
        }
    };

    // ---- evidence panel actions -------------------------------------------

    const handleRefreshInsight = async () => {
        setEvBusy('insight');
        setEvError('');
        try {
            setInsight((await refreshInsight(submissionId)).insight);
        } catch (err) {
            setEvError(err.response?.data?.error?.message || 'Could not read the repository');
        } finally {
            setEvBusy('');
        }
    };

    const handleRecheckDemo = async () => {
        setEvBusy('demo');
        setEvError('');
        try {
            setDemo((await checkDemo(submissionId)).check);
        } catch (err) {
            setEvError(err.response?.data?.error?.message || 'Demo check failed');
        } finally {
            setEvBusy('');
        }
    };

    const handleDownloadDoc = async (doc) => {
        try {
            const blob = await documentBlob(submissionId, doc._id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.originalName;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            setEvError('Download failed');
        }
    };

    const handleAddEvidence = async (e) => {
        e.preventDefault();
        if (evForm.text.trim().length < 3) return;
        setEvBusy('note');
        setEvError('');
        try {
            const created = await addEvidence(submissionId, {
                type: evForm.type,
                text: evForm.text.trim(),
                source: evForm.source.trim(),
                ...(evForm.criterion ? { criterion: evForm.criterion } : {})
            });
            setNotes([created.evidence, ...notes]);
            setEvForm({ ...evForm, text: '', source: '' });
        } catch (err) {
            setEvError(err.response?.data?.error?.message || 'Could not save the note');
        } finally {
            setEvBusy('');
        }
    };

    const handleDeleteNote = async (noteId) => {
        try {
            await deleteEvidence(submissionId, noteId);
            setNotes(notes.filter(n => n._id !== noteId));
        } catch (err) {
            setEvError(err.response?.data?.error?.message || 'Could not remove the note');
        }
    };

    // "accept" only prefills the slider — the judge can still change it, and
    // nothing reaches the server until they submit the scorecard themselves
    const handleUse = (s) => {
        const crit = rubric.find(c => c.name.toLowerCase() === s.criterion.toLowerCase());
        if (!crit) return;
        const ok = window.confirm(
            `Use the AI draft of ${s.score}/10 for "${crit.name}"? You can still change it — nothing is submitted until you submit the scorecard.`
        );
        if (!ok) return;
        setScore(crit._id, s.score);
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

            {/* ---------- evidence — what the server checked, and what the
                 judge checked themselves (never confused with AI drafts) ---------- */}
            <div className="ev-panel" data-testid="evidence-panel">
                <div className="ev-panel-head">
                    <span className="ev-panel-label">evidence</span>
                    <span className="ev-panel-note">checked by this server, checked by you — drafts below stay separate</span>
                </div>

                {/* repository insight — fetched server-side through the SSRF guard */}
                {insight ? (
                    <div className="ev-block ev-block--verified">
                        <p className="ev-block-head">
                            <span className="ev-badge ev-badge--verified">✓ verified</span>
                            <span>
                                repository <strong>{insight.facts.fullName}</strong> — read via{' '}
                                {insight.fetchedVia === 'team-token'
                                    ? 'the team-authorized token'
                                    : insight.fetchedVia === 'server-token'
                                        ? 'the server token'
                                        : 'the public GitHub API'}
                            </span>
                        </p>
                        <ul className="ev-block-list">
                            <li>
                                {insight.facts.treeStats?.totalFiles ?? '?'} files ·{' '}
                                {insight.facts.languages?.length
                                    ? insight.facts.languages.map(l => l.name).join(', ')
                                    : 'languages unknown'} · {insight.facts.license || 'no license'}
                            </li>
                            <li>
                                {insight.facts.treeStats?.hasCI ? 'CI ✓' : 'no CI'} ·{' '}
                                {insight.facts.treeStats?.testLikeFiles > 0
                                    ? `${insight.facts.treeStats.testLikeFiles} test-like files`
                                    : 'no test files seen'}{' '}
                                · {insight.facts.treeStats?.hasDockerfile ? 'container ✓' : 'no container file'} ·
                                last push {insight.facts.pushedAt
                                    ? new Date(insight.facts.pushedAt).toLocaleDateString()
                                    : 'unknown'}
                            </li>
                        </ul>
                        {insight.fetchNotes?.length > 0 && (
                            <p className="ev-block-note">read notes: {insight.fetchNotes.join(' · ')}</p>
                        )}
                    </div>
                ) : (
                    <div className="ev-block ev-block--muted">
                        <span className="ev-badge">no repository read yet</span>
                        {submission.repositoryUrl && (
                            <button
                                className="ev-action"
                                onClick={handleRefreshInsight}
                                disabled={evBusy === 'insight'}
                            >
                                {evBusy === 'insight' ? 'reading…' : 'read the repository'}
                            </button>
                        )}
                    </div>
                )}

                {/* team documents — uploads, never executed */}
                {docs.length > 0 && (
                    <div className="ev-block ev-block--docs">
                        <p className="ev-block-head">
                            <span className="ev-badge ev-badge--team">◆ team upload</span>
                            <span>{docs.length} document{docs.length > 1 ? 's' : ''} on file</span>
                        </p>
                        <ul className="ev-docs">
                            {docs.map(d => (
                                <li key={d._id} className="ev-doc">
                                    <span className="ev-doc-name">{d.originalName}</span>
                                    <span className="ev-doc-meta">
                                        {Math.max(1, Math.round(d.sizeBytes / 1024))}KB · {d.extractedChars} chars read
                                    </span>
                                    <button className="ev-mini" onClick={() => handleDownloadDoc(d)}>
                                        download
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* demo link — server-side liveness the judge can re-run */}
                {submission.demoUrl && (
                    <div className="ev-block ev-block--demo">
                        <p className="ev-block-head">
                            <span className={`ev-badge ${demo ? (demo.reachable ? 'ev-badge--verified' : 'ev-badge--bad') : ''}`}>
                                {demo ? (demo.reachable ? '✓ verified' : '✗ failed') : 'demo'}
                            </span>
                            <a
                                href={submission.demoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ev-demo-link"
                            >
                                {submission.demoUrl}
                            </a>
                            <button
                                className="ev-action ev-action--small"
                                onClick={handleRecheckDemo}
                                disabled={evBusy === 'demo'}
                            >
                                {evBusy === 'demo' ? 'checking…' : demo ? 're-check' : 'check link'}
                            </button>
                        </p>
                        {demo && (
                            <p className="ev-block-note">
                                {demo.reachable
                                    ? `reachable · HTTP ${demo.httpStatus}${demo.title ? ` · "${demo.title}"` : ''}`
                                    : (demo.error || 'not reachable')}
                                {' · '}checked {new Date(demo.createdAt).toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                )}

                {/* the judge's own notes — human work, solid borders, criterion-linked */}
                <div className="ev-notes">
                    <span className="score-label">your evidence notes</span>
                    <ul className="ev-note-list">
                        {notes.length === 0 && (
                            <li className="ev-note-empty">
                                nothing recorded yet — link what you checked to a criterion while you score
                            </li>
                        )}
                        {notes.map(n => (
                            <li key={n._id} className="ev-note">
                                <span className="ev-note-type">{EV_LABEL[n.type] || n.type}</span>
                                {n.criterion && <span className="ev-note-crit">→ {n.criterion}</span>}
                                <span className="ev-note-text">
                                    {n.text}
                                    {n.source && <em className="ev-note-src"> — {n.source}</em>}
                                </span>
                                <button
                                    className="ev-mini ev-mini--danger"
                                    onClick={() => handleDeleteNote(n._id)}
                                    aria-label="remove note"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>

                    <form className="ev-form" onSubmit={handleAddEvidence}>
                        <select
                            value={evForm.criterion}
                            onChange={(e) => setEvForm({ ...evForm, criterion: e.target.value })}
                            aria-label="link to criterion"
                        >
                            <option value="">general — no criterion</option>
                            {rubric.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                        </select>
                        <select
                            value={evForm.type}
                            onChange={(e) => setEvForm({ ...evForm, type: e.target.value })}
                            aria-label="evidence type"
                        >
                            <option value="verified-evidence">✓ verified</option>
                            <option value="team-claim">◆ claim</option>
                        </select>
                        <input
                            className="ev-form-text"
                            value={evForm.text}
                            onChange={(e) => setEvForm({ ...evForm, text: e.target.value })}
                            placeholder="what you checked, and what it showed"
                            maxLength={1000}
                        />
                        <input
                            className="ev-form-src"
                            value={evForm.source}
                            onChange={(e) => setEvForm({ ...evForm, source: e.target.value })}
                            placeholder="source — optional"
                            maxLength={300}
                        />
                        <button
                            className="ev-action"
                            disabled={evBusy === 'note' || evForm.text.trim().length < 3}
                        >
                            {evBusy === 'note' ? 'saving…' : '+ record'}
                        </button>
                    </form>
                    {evError && <p role="alert" className="score-error">{evError}</p>}
                </div>
            </div>

            {/* ---------- QA report card — the project's own report, ratings
                straight from the AI pass: stack, structure, complexity, docs,
                readiness, errors, and how many users it could serve ---------- */}
            {data?.submission?._id && (
                <QaReport submissionId={data.submission._id} canRun />
            )}

            {/* ---------- AI draft — optional, the judge decides alone ---------- */}
            <div className="ai-panel">
                <div className="ai-head">
                    <span className="ai-chip">AI</span>
                    <span className="ai-head-label">assistant draft — a starting point, never a verdict</span>
                    {!ai && !aiBusy && (
                        <button className="ai-ask" onClick={handleAskAi}>request a draft</button>
                    )}
                    {aiBusy && <span className="ai-busy">reading the submission…</span>}
                </div>

                {aiError && <p role="alert" className="score-error">{aiError}</p>}

                {ai && (
                    <>
                        <p className="ai-summary">{ai.summary}</p>
                        <p className="ai-complex">{ai.complexityAnalysis}</p>

                        <span className="score-label">what it is resting on</span>
                        <ul className="ai-evidence">
                            {ai.evidence.map((e, i) => (
                                <li key={i} className={`ai-ev ai-ev--${e.type}`}>
                                    <span className="ai-ev-type">{EV_LABEL[e.type] || e.type}</span>
                                    <span className="ai-ev-text">
                                        {e.text}
                                        {e.source && <em className="ai-ev-src"> — {e.source}</em>}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <span className="score-label">suggested starting points</span>
                        <ul className="ai-scores">
                            {ai.suggestedScores.map((s) => (
                                <li key={s.criterion} className="ai-score">
                                    <div className="ai-score-top">
                                        <strong className="ai-score-crit">{s.criterion}</strong>
                                        <span className="ai-score-num">
                                            draft {s.score}/10 · confidence {Math.round(s.confidence * 100)}%
                                        </span>
                                    </div>
                                    <p className="ai-rationale">{s.rationale}</p>
                                    <button className="ai-use" onClick={() => handleUse(s)} disabled={submitted}>
                                        use this score
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="ai-limits">
                            <span className="score-label">what this draft cannot know</span>
                            <ul>
                                {ai.limitations.map((l, i) => <li key={i}>{l}</li>)}
                            </ul>
                        </div>
                    </>
                )}
            </div>

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
