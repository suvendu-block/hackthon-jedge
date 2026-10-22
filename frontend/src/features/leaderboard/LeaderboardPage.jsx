import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLeaderboard, releaseResults, downloadResults } from './leaderboard.api.js';
import './LeaderboardPage.css';

// the standings — organizer previews before release, everyone else after
export default function LeaderboardPage() {
    const { eventId } = useParams();

    const [data, setData] = useState(null);   // { released, sealed, event, standings }
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');

    const load = async () => {
        try {
            setData(await getLeaderboard(eventId));
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not load results');
        }
    };

    // first load. `ignore` stops us setting state if we've already left the page.
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const d = await getLeaderboard(eventId);
                if (!ignore) setData(d);
            } catch (err) {
                if (!ignore) setError(err.response?.data?.error?.message || 'Could not load results');
            }
        })();
        return () => { ignore = true; };
    }, [eventId]);

    const handleRelease = async () => {
        const ok = window.confirm('Release results? Every judge\'s score becomes visible to teams right away.');
        if (!ok) return;
        setBusy('release');
        setError('');
        try {
            await releaseResults(eventId);
            await load();
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not release results');
        } finally {
            setBusy('');
        }
    };

    const handleDownload = async () => {
        setBusy('csv');
        setError('');
        try {
            await downloadResults(eventId);
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not download the CSV');
        } finally {
            setBusy('');
        }
    };

    if (error && !data) return <main className="lb"><p className="lb-error">{error}</p></main>;
    if (!data) return <main className="lb"><p className="lb-empty">reading the standings…</p></main>;

    const { event, standings, released, sealed, releasedAt } = data;
    const assigned = event?.assigned ?? 0;
    // only the organizer ever reaches this branch unreleased — the server
    // seals judges and teams out — so no extra role check is needed here

    // the sealed screen — no numbers at all until the organizer lets them out
    if (sealed) {
        return (
            <main className="lb">
                <div className="lb-bg" aria-hidden="true"><div className="lb-lamp" /></div>
                <header className="lb-header">
                    <div>
                        <Link to="/events" className="lb-back">← the docket</Link>
                        <span className="lb-eyebrow">the standings</span>
                        <h1>{event?.name || 'Results'}</h1>
                    </div>
                </header>
                <section className="lb-sealed">
                    <span className="lb-sealed-mark" aria-hidden="true">?</span>
                    <h2>Results are sealed</h2>
                    <p>
                        The organizer hasn&apos;t released them yet. Rankings appear here
                        the moment they do — your own scorecard stays visible to you
                        in the meantime.
                    </p>
                    <Link to="/events" className="lb-sealed-back">back to the docket</Link>
                </section>
            </main>
        );
    }

    return (
        <main className="lb">
            <div className="lb-bg" aria-hidden="true"><div className="lb-lamp" /></div>

            <header className="lb-header">
                <div>
                    <Link to="/events" className="lb-back">← the docket</Link>
                    <span className="lb-eyebrow">the standings</span>
                    <h1>{event?.name || 'Results'}</h1>
                </div>

                <div className="lb-header-actions">
                    <button
                        className="lb-csv"
                        onClick={handleDownload}
                        disabled={busy === 'csv'}
                    >
                        {busy === 'csv' ? 'preparing…' : 'download csv'}
                    </button>
                </div>
            </header>

            {error && <p role="alert" className="lb-error">{error}</p>}

            {/* release status strip */}
            {released ? (
                <p className="lb-released">
                    Released {newDate(releasedAt)} — final.
                </p>
            ) : (
                <div className="lb-preview">
                    <p>
                        <strong>Preview.</strong> Only you can see this — results stay
                        sealed for judges and teams until you release them.
                    </p>
                    <button
                        className="lb-release"
                        onClick={handleRelease}
                        disabled={busy === 'release'}
                    >
                        {busy === 'release' ? 'releasing…' : 'release results'}
                    </button>
                </div>
            )}

            {/* ---------- the board ---------- */}
            {standings.length === 0 ? (
                <p className="lb-empty">Nothing to rank yet — no submissions came in.</p>
            ) : (
                <div className="lb-table-wrap">
                    <table className="lb-table">
                        <thead>
                            <tr>
                                <th className="lb-th-rank">#</th>
                                <th>project</th>
                                <th>team</th>
                                <th className="lb-th-num">judged</th>
                                <th>judge scores</th>
                                <th className="lb-th-avg">average</th>
                            </tr>
                        </thead>
                        <tbody>
                            {standings.map((r) => (
                                <tr key={r.submission} className={r.rank === 1 ? 'is-first' : ''}>
                                    <td className="lb-rank">{r.rank ?? '—'}</td>
                                    <td>
                                        <strong className="lb-project">{r.project}</strong>
                                        {r.tagline && <span className="lb-tagline">{r.tagline}</span>}
                                    </td>
                                    <td className="lb-team">{r.team}</td>
                                    <td className="lb-judged">{r.judged}/{assigned}</td>
                                    <td className="lb-scores">
                                        {r.scores.map((s) => (
                                            <span key={s.judge} className="lb-chip">
                                                {s.judgeName || 'judge'} <i>{s.total}</i>
                                            </span>
                                        ))}
                                        {r.judged === 0 && <span className="lb-pending">not judged yet</span>}
                                    </td>
                                    <td className="lb-avg">{r.average ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="lb-foot">
                average = mean of submitted scorecards, each weighted by the rubric
                (Σ = 100). ties: average, then judges signed off, then name.
            </p>
        </main>
    );
}

// keep the date call out of the JSX so the header stays readable
function newDate(iso) {
    return iso ? new Date(iso).toLocaleString() : 'just now';
}
