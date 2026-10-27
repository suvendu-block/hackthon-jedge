import { useEffect, useState } from 'react';
import { getQaReport, runQaReport } from '@/features/submissions/submissions.api.js';
import './QaReport.css';

// fixed labels for the five dimensions the backend rates (order included —
// reports always render the same rows)
const DIM_LABELS = {
    'tech-stack': 'tech stack',
    'folder-structure': 'folder structure',
    'complexity': 'complexity',
    'documentation': 'documentation',
    'readiness': 'readiness'
};

// ADR-0009 in the UI: type shown as text, never color alone
const TYPE_LABEL = {
    'verified-evidence': '✓ verified',
    'team-claim': '◆ claimed',
    'ai-inference': '◇ inferred'
};

/**
 * the project's AI report card — ratings, errors, capacity, overall 1-10.
 * self-fetching so the team's submission card and the judge's scorecard
 * mount it the same way. everyone who can see the project reads the stored
 * card; the owning team and assigned judges can run or refresh one.
 */
export default function QaReport({ submissionId, canRun = false }) {
    const [card, setCard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);   // a fresh run is in flight
    const [err, setErr] = useState('');

    // first load — `ignore` stops state updates once we've left the page
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const data = await getQaReport(submissionId);
                if (!ignore) { setCard(data); setErr(''); }
            } catch (e) {
                if (ignore) return;
                const code = e.response?.data?.error?.code;
                // "no report yet" is a normal state — only real failures show
                if (code === 'NO_QA_REPORT') { setCard(null); setErr(''); }
                else setErr(e.response?.data?.error?.message || 'Could not load the report card');
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [submissionId]);

    const handleRun = async () => {
        setBusy(true);
        setErr('');
        try {
            setCard(await runQaReport(submissionId));
        } catch (e) {
            setErr(e.response?.data?.error?.message || 'The report could not be generated');
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="qa-panel" data-testid="qa-panel">
            <header className="qa-head">
                <span className="qa-label">project report card</span>
                {card && (
                    <span className="qa-overall" title="overall rating, 1 to 10">
                        <b data-testid="qa-overall">{card.overall}</b><i>/10</i>
                    </span>
                )}
            </header>

            {loading && <p className="qa-muted">checking for a report card…</p>}

            {!loading && err && <p role="alert" className="qa-err">{err}</p>}

            {!loading && !card && !err && (
                <p className="qa-muted">
                    No report yet — {canRun
                        ? 'run one to rate the stack, folder structure, complexity, docs, and readiness.'
                        : 'nobody has run a quality report on this project.'}
                </p>
            )}

            {!loading && !card && canRun && (
                <button className="qa-run" onClick={handleRun} disabled={busy}>
                    {busy ? 'reading the project…' : 'run quality report'}
                </button>
            )}

            {card && (
                <div className="qa-body">
                    <p className="qa-summary">{card.summary}</p>

                    <ul className="qa-ratings">
                        {card.ratings.map((r) => (
                            <li key={r.dimension} className="qa-rating">
                                <div className="qa-rating-top">
                                    <span className="qa-dim">{DIM_LABELS[r.dimension]}</span>
                                    <span className="qa-bar" aria-hidden="true">
                                        <i style={{ width: `${r.score * 10}%` }} />
                                    </span>
                                    <span className="qa-score">{r.score}<i>/10</i></span>
                                </div>
                                <p className="qa-why">
                                    {r.rationale}
                                    <span className={`qa-type qa-type--${r.evidenceType}`}>
                                        {TYPE_LABEL[r.evidenceType]}
                                    </span>
                                </p>
                            </li>
                        ))}
                    </ul>

                    <div className="qa-block">
                        <span className="qa-sub-label">errors found</span>
                        {card.errors.length ? (
                            <ul className="qa-errors">
                                {card.errors.map((e, i) => (
                                    <li key={i} className={`qa-error qa-error--${e.severity}`}>
                                        <b>{e.severity}</b>
                                        <span>{e.message}</span>
                                        <em>{e.source}</em>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="qa-muted">Nothing visible in the fetched evidence.</p>
                        )}
                    </div>

                    <div className="qa-block">
                        <span className="qa-sub-label">how many users it can serve</span>
                        <p className="qa-capacity">
                            {card.capacity.estimate}
                            <span className="qa-type qa-type--ai-inference">
                                ◇ inferred · {Math.round(card.capacity.confidence * 100)}% confidence
                            </span>
                        </p>
                    </div>

                    <p className="qa-inputs">
                        based on:{' '}
                        {[
                            card.inputs.repository && 'server-fetched repository',
                            card.inputs.documents > 0 && `${card.inputs.documents} uploaded document(s)`,
                            card.inputs.demo && 'demo liveness check'
                        ].filter(Boolean).join(' · ') || 'the write-up only'}
                    </p>

                    <ul className="qa-limits">
                        {card.limitations.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>

                    <footer className="qa-foot">
                        <span>AI-made — a hint, not a verdict.</span>
                        {canRun && (
                            <button className="qa-mini" onClick={handleRun} disabled={busy}>
                                {busy ? 'reading the project…' : 'run again'}
                            </button>
                        )}
                    </footer>
                </div>
            )}
        </section>
    );
}
