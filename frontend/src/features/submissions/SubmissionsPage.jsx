import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import {
    listSubmissions, createSubmission, updateSubmission, deleteSubmission
} from './submissions.api.js';
import { getEvent } from '@/features/events/events.api.js';
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
    const [form, setForm] = useState({ projectName: '', tagline: '', description: '', links: [] });
    const [saving, setSaving] = useState(false);

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
            links: (sub.links || []).map(l => ({ ...l }))
        });
        setShowForm(true);
    };

    const startNew = () => {
        setEditingId(null);
        setForm({ projectName: '', tagline: '', description: '', links: [] });
        setShowForm(true);
    };

    const setField = (field, value) => setForm({ ...form, [field]: value });

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

                            {s.links?.length > 0 && (
                                <div className="sub-links">
                                    {s.links.map((l, i) => (
                                        <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="sub-link">
                                            {l.label}
                                        </a>
                                    ))}
                                </div>
                            )}

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
