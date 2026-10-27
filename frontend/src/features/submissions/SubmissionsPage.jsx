import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import {
    listSubmissions, createSubmission, updateSubmission, deleteSubmission,
    getRepoGrant, grantRepo, revokeRepo, getInsight, refreshInsight,
    listDocuments, uploadDocument, removeDocument, documentBlob,
    checkDemo, getDemoCheck
} from './submissions.api.js';
import { getEvent } from '@/features/events/events.api.js';
import QaReport from '@/features/shared/QaReport.jsx';
import './SubmissionsPage.css';

// the submissions screen — a team enters/edits its project,
// a judge or organizer reads the field
export default function SubmissionsPage() {
    const { eventId } = useParams();
    const { user } = useAuth();
    const isTeam = user.role === 'team';

    const [event, setEvent] = useState(null);
    const [subs, setSubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // form state — one shared form for create + edit
    const [editingId, setEditingId] = useState(null);   // null = creating
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        projectName: '', tagline: '', description: '', links: [],
        repositoryUrl: '', demoUrl: ''
    });
    const [saving, setSaving] = useState(false);

    // phase 7 — the team's evidence bench (grant, insight, documents, demo).
    // loaded only for the team's own entry; everyone else reads these on
    // the scorecard instead.
    const [grant, setGrant] = useState(null);
    const [showGrant, setShowGrant] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [consent, setConsent] = useState(false);
    const [insight, setInsight] = useState(null);
    const [docs, setDocs] = useState([]);
    const [demo, setDemo] = useState(null);
    const [evBusy, setEvBusy] = useState('');   // which bench action is running
    const [evMsg, setEvMsg] = useState('');     // small inline status line

    const isClosed = event?.status === 'closed';
    // a team that already submitted switches to edit mode
    const mySub = subs.find(s => s.team._id === user._id);

    // refetch after we change something (submit / edit / withdraw)
    const refresh = async () => {
        try {
            const [ev, list] = await Promise.all([getEvent(eventId), listSubmissions(eventId)]);
            setEvent(ev);
            setSubs(list);
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not load submissions');
        } finally {
            setLoading(false);
        }
    };

    // first load. `ignore` stops us setting state if we've already left the page.
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const [ev, list] = await Promise.all([getEvent(eventId), listSubmissions(eventId)]);
                if (!ignore) { setEvent(ev); setSubs(list); }
            } catch (err) {
                if (!ignore) setError(err.response?.data?.error?.message || 'Could not load submissions');
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [eventId]);

    const startEdit = (sub) => {
        setEditingId(sub._id);
        setForm({
            projectName: sub.projectName,
            tagline: sub.tagline || '',
            description: sub.description || '',
            links: (sub.links || []).map(l => ({ ...l })),
            repositoryUrl: sub.repositoryUrl || '',
            demoUrl: sub.demoUrl || ''
        });
        setShowForm(true);
    };

    const startNew = () => {
        setEditingId(null);
        setForm({
            projectName: '', tagline: '', description: '', links: [],
            repositoryUrl: '', demoUrl: ''
        });
        setShowForm(true);
    };

    const setField = (field, value) => setForm({ ...form, [field]: value });

    // pull the evidence bench for the team's own submission — every call
    // tolerates "nothing there yet" (404/403 just mean: not set up)
    useEffect(() => {
        if (!mySub?._id || !isTeam) return;
        let ignore = false;
        (async () => {
            const [g, i, d, dc] = await Promise.all([
                getRepoGrant(mySub._id).catch(() => ({ grant: null })),
                getInsight(mySub._id).catch(() => ({ insight: null })),
                listDocuments(mySub._id).catch(() => ({ documents: [] })),
                getDemoCheck(mySub._id).catch(() => ({ check: null }))
            ]);
            if (ignore) return;
            setGrant(g.grant);
            setInsight(i.insight);
            setDocs(d.documents || []);
            setDemo(dc.check);
        })();
        return () => { ignore = true; };
    }, [mySub?._id, isTeam]);

    // ---- bench actions -----------------------------------------------------

    const benchError = (err, fallback) =>
        setEvMsg(err.response?.data?.error?.message || fallback);

    const handleGrant = async (e) => {
        e.preventDefault();
        setEvBusy('grant');
        setEvMsg('');
        try {
            const r = await grantRepo(mySub._id, tokenInput ? { token: tokenInput.trim() } : {});
            setGrant(r.grant);
            setShowGrant(false);
            setTokenInput('');
            setConsent(false);
            setEvMsg('access granted and recorded');
        } catch (err) {
            benchError(err, 'could not grant access');
        } finally {
            setEvBusy('');
        }
    };

    const handleRevoke = async () => {
        if (!window.confirm('Withdraw repository access? Judges can no longer refresh the read.')) return;
        setEvBusy('grant');
        setEvMsg('');
        try {
            const r = await revokeRepo(mySub._id);
            setGrant(r.grant);
            setEvMsg('access withdrawn — the record of authorization stays');
        } catch (err) {
            benchError(err, 'could not withdraw access');
        } finally {
            setEvBusy('');
        }
    };

    const handleAnalyze = async () => {
        setEvBusy('insight');
        setEvMsg('');
        try {
            const r = await refreshInsight(mySub._id);
            setInsight(r.insight);
            setEvMsg('repository read — the facts below came from this server, not the team');
        } catch (err) {
            benchError(err, 'could not read the repository');
        } finally {
            setEvBusy('');
        }
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';   // let the same file be re-picked after a delete
        if (!file) return;
        setEvBusy('upload');
        setEvMsg('');
        try {
            await uploadDocument(mySub._id, file);
            setDocs((await listDocuments(mySub._id)).documents || []);
            setEvMsg(`uploaded ${file.name}`);
        } catch (err) {
            benchError(err, 'upload failed');
        } finally {
            setEvBusy('');
        }
    };

    const handleDownloadDoc = async (doc) => {
        try {
            const blob = await documentBlob(mySub._id, doc._id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.originalName;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            benchError(err, 'download failed');
        }
    };

    const handleDeleteDoc = async (doc) => {
        if (!window.confirm(`Remove "${doc.originalName}"?`)) return;
        try {
            await removeDocument(mySub._id, doc._id);
            setDocs(docs.filter(d => d._id !== doc._id));
        } catch (err) {
            benchError(err, 'could not remove the file');
        }
    };

    const handleDemoCheck = async () => {
        setEvBusy('demo');
        setEvMsg('');
        try {
            const r = await checkDemo(mySub._id);
            setDemo(r.check);
        } catch (err) {
            benchError(err, 'demo check failed');
        } finally {
            setEvBusy('');
        }
    };

    const setLink = (i, field, value) => {
        const links = form.links.map((l, idx) => (idx === i ? { ...l, [field]: value } : l));
        setForm({ ...form, links });
    };

    const addLink = () => setForm({ ...form, links: [...form.links, { label: '', url: '' }] });
    const removeLink = (i) => setForm({ ...form, links: form.links.filter((_, idx) => idx !== i) });

    // client-side mirror of the server allowlist — catches it before the round trip
    const linkError = form.links.find(l => l.url && !/^https?:\/\//i.test(l.url));
    const canSave = form.projectName.trim().length >= 2 && !linkError;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            // drop half-filled link rows (blank label AND url)
            const links = form.links.filter(l => l.label.trim() && l.url.trim());
            const body = { ...form, links };
            if (editingId) {
                await updateSubmission(editingId, body);
            } else {
                await createSubmission(eventId, body);
            }
            setShowForm(false);
            setEditingId(null);
            await refresh();
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not save submission');
        } finally {
            setSaving(false);
        }
    };

    const handleWithdraw = async (sub) => {
        if (!window.confirm(`Withdraw "${sub.projectName}"? Judges will no longer see it.`)) return;
        try {
            await deleteSubmission(sub._id);
            setShowForm(false);
            setEditingId(null);
            await refresh();
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not withdraw');
        }
    };

    if (loading) return <main className="subs"><p className="subs-empty">loading…</p></main>;

    return (
        <main className="subs">
            <div className="subs-bg" aria-hidden="true"><div className="subs-lamp" /></div>

            <header className="subs-header">
                <div>
                    <Link to="/events" className="subs-back">← the docket</Link>
                    <span className="subs-eyebrow">the projects</span>
                    <h1>{event?.name || 'Submissions'}</h1>
                </div>
                {isTeam && !isClosed && (
                    <button
                        className="subs-new"
                        onClick={() => (mySub ? startEdit(mySub) : startNew())}
                    >
                        {mySub ? 'edit your entry' : '+ submit project'}
                    </button>
                )}
            </header>

            {error && <p role="alert" className="subs-error">{error}</p>}
            {isClosed && <p className="subs-locked">Judging is closed — submissions are read-only.</p>}

            {/* ---------- team form ---------- */}
            {showForm && (
                <form className="subs-form" onSubmit={handleSubmit}>
                    <label className="subs-field">
                        <span>project name</span>
                        <input
                            value={form.projectName}
                            onChange={(e) => setField('projectName', e.target.value)}
                            placeholder="what's it called?"
                            required
                        />
                    </label>

                    <label className="subs-field">
                        <span>tagline</span>
                        <input
                            value={form.tagline}
                            onChange={(e) => setField('tagline', e.target.value)}
                            placeholder="one line — what does it do?"
                            maxLength={200}
                        />
                    </label>

                    <label className="subs-field">
                        <span>description</span>
                        <textarea
                            value={form.description}
                            onChange={(e) => setField('description', e.target.value)}
                            placeholder="what problem it solves, how you built it, what's hard about it…"
                            rows={5}
                            maxLength={5000}
                        />
                    </label>

                    {/* typed evidence fields — the server analyzes these (Phase 7) */}
                    <label className="subs-field">
                        <span>repository (github)</span>
                        <input
                            value={form.repositoryUrl}
                            onChange={(e) => setField('repositoryUrl', e.target.value)}
                            placeholder="https://github.com/yourteam/yourrepo"
                            maxLength={300}
                        />
                    </label>

                    <label className="subs-field">
                        <span>demo url</span>
                        <input
                            value={form.demoUrl}
                            onChange={(e) => setField('demoUrl', e.target.value)}
                            placeholder="https://your-app.example.com — where judges can try it"
                            maxLength={500}
                        />
                    </label>

                    {/* links — with the http(s) allowlist shown inline */}
                    <div className="subs-links">
                        <div className="subs-links-head">
                            <span className="subs-label">links</span>
                            <button type="button" className="subs-link-add" onClick={addLink}>+ add link</button>
                        </div>

                        {form.links.length === 0 && (
                            <p className="subs-links-empty">repo, demo, deck — optional but judges love them.</p>
                        )}

                        {form.links.map((l, i) => (
                            <div key={i} className="subs-link-row">
                                <input
                                    className="subs-link-label"
                                    placeholder="label (repo, demo…)"
                                    value={l.label}
                                    onChange={(e) => setLink(i, 'label', e.target.value)}
                                />
                                <input
                                    className="subs-link-url"
                                    placeholder="https://…"
                                    value={l.url}
                                    onChange={(e) => setLink(i, 'url', e.target.value)}
                                />
                                <button type="button" className="subs-link-remove" onClick={() => removeLink(i)}>×</button>
                            </div>
                        ))}
                        {linkError && <p className="subs-link-warn">links must start with http:// or https://</p>}
                    </div>

                    <div className="subs-form-actions">
                        <button type="submit" className="subs-save" disabled={saving || !canSave}>
                            {saving ? 'saving…' : editingId ? 'save changes' : 'submit project'}
                        </button>
                        {editingId && (
                            <button type="button" className="subs-cancel" onClick={() => { setShowForm(false); setEditingId(null); }}>
                                cancel
                            </button>
                        )}
                    </div>
                </form>
            )}

            {/* ---------- list ---------- */}
            {subs.length === 0 ? (
                <p className="subs-empty">
                    {isTeam ? 'No project submitted yet — be the first.' : 'No submissions yet.'}
                </p>
            ) : (
                <ul className="subs-list">
                    {subs.map(s => (
                        <li key={s._id} className="sub-card">
                            <div className="sub-top">
                                <h2>{s.projectName}</h2>
                                <span className="sub-team">{s.team.name}</span>
                            </div>
                            {s.tagline && <p className="sub-tagline">{s.tagline}</p>}
                            {s.description && <p className="sub-desc">{s.description}</p>}

                            {/* typed evidence links — repo + demo, first-class now */}
                            {(s.repositoryUrl || s.demoUrl) && (
                                <div className="sub-typed-links">
                                    {s.repositoryUrl && (
                                        <a className="sub-link" href={s.repositoryUrl} target="_blank" rel="noopener noreferrer">
                                            ⌗ repository
                                        </a>
                                    )}
                                    {s.demoUrl && (
                                        <a className="sub-link" href={s.demoUrl} target="_blank" rel="noopener noreferrer">
                                            ▷ demo
                                        </a>
                                    )}
                                </div>
                            )}

                            {s.links?.length > 0 && (
                                <div className="sub-links">
                                    {s.links.map((l, i) => (
                                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="sub-link">
                                            {l.label}
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* the team's own evidence bench — grant the repo
                                read, pull server-checked insight, hand over
                                documents, poke the demo link */}
                            {isTeam && s.team._id === user._id && !isClosed && (
                                <div className="sub-evidence" data-testid="evidence-bench">
                                    <span className="subs-label">your evidence bench</span>

                                    {s.repositoryUrl && (
                                        <div className="ev-row">
                                            <span className="ev-key">repository access</span>
                                            {grant && !grant.revokedAt ? (
                                                <span className="ev-chip ev-chip--ok">
                                                    ✓ authorized · {grant.authorizedVia === 'team-token'
                                                        ? `read token ${grant.tokenFingerprint}…`
                                                        : 'public read'}
                                                    <button
                                                        className="ev-mini"
                                                        onClick={handleRevoke}
                                                        disabled={evBusy === 'grant'}
                                                    >
                                                        withdraw
                                                    </button>
                                                </span>
                                            ) : showGrant ? (
                                                <form className="ev-grant" onSubmit={handleGrant}>
                                                    <input
                                                        type="password"
                                                        value={tokenInput}
                                                        onChange={(e) => setTokenInput(e.target.value)}
                                                        placeholder="GitHub read token — only for private repos"
                                                        autoComplete="off"
                                                        maxLength={200}
                                                    />
                                                    <label className="ev-consent">
                                                        <input
                                                            type="checkbox"
                                                            checked={consent}
                                                            onChange={(e) => setConsent(e.target.checked)}
                                                            required
                                                        />
                                                        I authorize HackJudge to read this repository —
                                                        static inspection only, no code ever runs
                                                    </label>
                                                    <div className="ev-grant-actions">
                                                        <button
                                                            className="ev-action"
                                                            disabled={evBusy === 'grant' || !consent}
                                                        >
                                                            {evBusy === 'grant' ? 'checking with GitHub…' : 'authorize the read'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="ev-mini"
                                                            onClick={() => { setShowGrant(false); setTokenInput(''); setConsent(false); }}
                                                        >
                                                            cancel
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <button className="ev-action" onClick={() => setShowGrant(true)}>
                                                    {grant?.revokedAt ? 're-grant read access' : 'grant read access'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {s.repositoryUrl && (
                                        <div className="ev-row">
                                            <span className="ev-key">repo read</span>
                                            <button
                                                className="ev-action"
                                                onClick={handleAnalyze}
                                                disabled={evBusy === 'insight'}
                                            >
                                                {evBusy === 'insight'
                                                    ? 'reading the repo…'
                                                    : insight ? 'refresh the read' : 'analyze repository'}
                                            </button>
                                            {grant?.revokedAt && (
                                                <span className="ev-hint">access withdrawn — grant it again first</span>
                                            )}
                                        </div>
                                    )}

                                    {insight && (
                                        <div className="ev-facts" data-testid="insight-facts">
                                            <p className="ev-facts-head">
                                                <span className="ev-verified">✓ server-checked</span>
                                                {insight.facts.fullName} · {insight.facts.visibility} ·{' '}
                                                {insight.facts.license || 'no license stated'}
                                            </p>
                                            <ul className="ev-facts-list">
                                                <li>
                                                    {insight.facts.treeStats?.totalFiles ?? '?'} files ·{' '}
                                                    {insight.facts.languages?.length
                                                        ? insight.facts.languages.map(l => l.name).join(', ')
                                                        : 'languages unknown'}
                                                </li>
                                                <li>
                                                    {insight.facts.treeStats?.hasCI ? 'CI ✓' : 'no CI'} ·{' '}
                                                    {insight.facts.treeStats?.testLikeFiles > 0
                                                        ? `${insight.facts.treeStats.testLikeFiles} test-like files`
                                                        : 'no test files seen'}{' '}
                                                    · {insight.facts.treeStats?.hasManifest ? 'dependency manifest ✓' : 'no manifest'}{' '}
                                                    · {insight.facts.treeStats?.hasDocs ? 'docs folder ✓' : 'no docs folder'}
                                                </li>
                                                <li>
                                                    last push {insight.facts.pushedAt
                                                        ? new Date(insight.facts.pushedAt).toLocaleDateString()
                                                        : 'unknown'}{' '}
                                                    · {insight.facts.stars}★ {insight.facts.forks}⑂
                                                </li>
                                            </ul>
                                            {insight.fetchNotes?.length > 0 && (
                                                <p className="ev-note-line">read notes: {insight.fetchNotes.join(' · ')}</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="ev-row">
                                        <span className="ev-key">documents</span>
                                        <label className={`ev-action ev-upload ${evBusy === 'upload' ? 'is-busy' : ''}`}>
                                            {evBusy === 'upload' ? 'uploading…' : '+ upload a document'}
                                            <input
                                                type="file"
                                                accept=".md,.markdown,.txt,.csv,.pdf,.docx,.pptx"
                                                onChange={handleUpload}
                                                hidden
                                                disabled={evBusy === 'upload'}
                                            />
                                        </label>
                                        <span className="ev-hint">md · txt · csv · pdf · docx · pptx — 20MB max</span>
                                    </div>

                                    {docs.length > 0 && (
                                        <ul className="ev-docs">
                                            {docs.map(d => (
                                                <li key={d._id} className="ev-doc">
                                                    <span className="ev-doc-name">{d.originalName}</span>
                                                    <span className="ev-doc-meta">
                                                        {Math.max(1, Math.round(d.sizeBytes / 1024))}KB ·{' '}
                                                        {d.extractedChars} chars read
                                                        {d.extractionNotes?.length > 0 ? ` · ${d.extractionNotes[0]}` : ''}
                                                    </span>
                                                    <button className="ev-mini" onClick={() => handleDownloadDoc(d)}>
                                                        download
                                                    </button>
                                                    <button
                                                        className="ev-mini ev-mini--danger"
                                                        onClick={() => handleDeleteDoc(d)}
                                                    >
                                                        remove
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    {s.demoUrl && (
                                        <div className="ev-row">
                                            <span className="ev-key">demo link</span>
                                            <button
                                                className="ev-action"
                                                onClick={handleDemoCheck}
                                                disabled={evBusy === 'demo'}
                                            >
                                                {evBusy === 'demo'
                                                    ? 'knocking…'
                                                    : demo ? 'check it again' : 'check the demo link'}
                                            </button>
                                            {demo && (
                                                <span className={`ev-chip ${demo.reachable ? 'ev-chip--ok' : 'ev-chip--bad'}`}>
                                                    {demo.reachable
                                                        ? `✓ reachable · HTTP ${demo.httpStatus}${demo.title ? ` · ${demo.title}` : ''}`
                                                        : `✗ ${demo.error || 'not reachable'}`}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {evMsg && <p className="ev-msg">{evMsg}</p>}
                                </div>
                            )}

                            {/* the AI report card — tech stack, structure,
                                complexity, errors, capacity. everyone who can
                                see the project reads it; the owning team and
                                assigned judges can run or refresh one */}
                            <QaReport
                                submissionId={s._id}
                                canRun={s.team._id === user._id || user.role === 'judge'}
                            />

                            {/* per-role actions on the card */}
                            <div className="sub-actions">
                                {/* judges get a straight path to the scorecard */}
                                {user.role === 'judge' && !isClosed && (
                                    <Link to={`/scorecard/${s._id}`} className="sub-score">
                                        score it →
                                    </Link>
                                )}
                                {/* the owning team can edit or withdraw while open */}
                                {isTeam && s.team._id === user._id && !isClosed && (
                                    <>
                                        <button className="sub-edit" onClick={() => startEdit(s)}>
                                            edit
                                        </button>
                                        <button className="sub-withdraw" onClick={() => handleWithdraw(s)}>
                                            withdraw
                                        </button>
                                    </>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
