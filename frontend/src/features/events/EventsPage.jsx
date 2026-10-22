import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import RubricEditor from './RubricEditor.jsx';
import {
    listEvents, createEvent, deleteEvent, addJudge, removeJudge, listJudges
} from './events.api.js';
import './EventsPage.css';

const STATUS_LABEL = { draft: 'draft', published: 'open for judging', closed: 'closed' };

// events screen — list what you can see, create if organizer, assign judges
export default function EventsPage() {
    const { user } = useAuth();
    const isOrganizer = user.role === 'organizer';

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // create form state
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [criteria, setCriteria] = useState([]);
    const [saving, setSaving] = useState(false);

    // judge assignment
    const [judges, setJudges] = useState([]);
    const [assignOpen, setAssignOpen] = useState(null);   // event id currently picking a judge
    const [pickedJudge, setPickedJudge] = useState('');

    const total = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);
    const rubricOk = criteria.length > 0 && Math.abs(total - 100) < 0.001;

    const refresh = async () => {
        try {
            setEvents(await listEvents());
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not load events');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);

    // judge directory only matters to organizers, and only when assigning
    useEffect(() => {
        if (isOrganizer && assignOpen && judges.length === 0) {
            listJudges().then(setJudges).catch(() => { /* non-fatal */ });
        }
    }, [isOrganizer, assignOpen, judges.length]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            await createEvent({ name, description, rubric: criteria });
            setShowForm(false);
            setName('');
            setDescription('');
            setCriteria([]);
            await refresh();
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not create event');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this event? This cannot be undone.')) return;
        try {
            await deleteEvent(id);
            setEvents(events.filter(ev => ev._id !== id));
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not delete event');
        }
    };

    const handleAssign = async (eventId) => {
        if (!pickedJudge) return;
        try {
            const updated = await addJudge(eventId, pickedJudge);
            setEvents(events.map(ev => (ev._id === eventId ? updated : ev)));
            setAssignOpen(null);
            setPickedJudge('');
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Could not assign judge');
        }
    };

    return (
        <main className="events">
            <div className="events-bg" aria-hidden="true">
                <div className="events-lamp" />
            </div>

            <header className="events-header">
                <div>
                    <span className="events-eyebrow">the docket</span>
                    <h1>Events</h1>
                </div>
                {isOrganizer && (
                    <button
                        className="events-new"
                        onClick={() => setShowForm(!showForm)}
                    >
                        {showForm ? 'close' : '+ new event'}
                    </button>
                )}
            </header>

            {error && <p role="alert" className="events-error">{error}</p>}

            {/* ---------- create form ---------- */}
            {showForm && (
                <form className="events-form" onSubmit={handleCreate}>
                    <label className="events-field">
                        <span>event name</span>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Spring HackFest 2026"
                            required
                        />
                    </label>

                    <label className="events-field">
                        <span>description</span>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="what is this hackathon about? (optional)"
                            rows={2}
                        />
                    </label>

                    <RubricEditor criteria={criteria} onChange={setCriteria} />

                    <button
                        type="submit"
                        className="events-create"
                        disabled={saving || !name.trim() || !rubricOk}
                    >
                        {saving ? 'creating…' : 'create event'}
                    </button>
                </form>
            )}

            {/* ---------- list ---------- */}
            {loading ? (
                <p className="events-empty">reading the docket…</p>
            ) : events.length === 0 ? (
                <p className="events-empty">
                    {isOrganizer
                        ? 'No events yet — create the first one.'
                        : 'No events assigned to you yet. An organizer has to invite you.'}
                </p>
            ) : (
                <ul className="events-list">
                    {events.map(ev => (
                        <li key={ev._id} className="event-card">
                            <div className="event-top">
                                <h2>{ev.name}</h2>
                                <span className={`event-status event-status--${ev.status}`}>
                                    {STATUS_LABEL[ev.status] || ev.status}
                                </span>
                            </div>

                            {ev.description && <p className="event-desc">{ev.description}</p>}

                            <div className="event-meta">
                                <span>{ev.rubric.length} criteria</span>
                                <span>·</span>
                                <span>{ev.judges.length} judge{ev.judges.length === 1 ? '' : 's'}</span>
                            </div>

                            {/* assigned judges — chips with a remove x for the organizer */}
                            {ev.judges.length > 0 && (
                                <div className="event-judges">
                                    {ev.judges.map(j => (
                                        <span key={j._id} className="event-judge">
                                            {j.name}
                                            {isOrganizer && (
                                                <button
                                                    onClick={() => removeAssigned(ev, j._id)}
                                                    aria-label={`Unassign ${j.name}`}
                                                >×</button>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {isOrganizer && (
                                <div className="event-actions">
                                    <Link
                                        to={`/events/${ev._id}/submissions`}
                                        className="event-view"
                                    >
                                        view submissions
                                    </Link>
                                    {ev.status === 'draft' && (
                                        <>
                                            <button
                                                className="event-assign"
                                                onClick={() => setAssignOpen(assignOpen === ev._id ? null : ev._id)}
                                            >
                                                assign judge
                                            </button>
                                            <button
                                                className="event-del"
                                                onClick={() => handleDelete(ev._id)}
                                            >
                                                delete
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* judges get the same link */}
                            {!isOrganizer && (
                                <div className="event-actions">
                                    <Link
                                        to={`/events/${ev._id}/submissions`}
                                        className="event-view"
                                    >
                                        view submissions
                                    </Link>
                                </div>
                            )}

                            {/* judge picker — inline dropdown, only open for one card at a time */}
                            {isOrganizer && assignOpen === ev._id && (
                                <div className="event-picker">
                                    <select
                                        value={pickedJudge}
                                        onChange={(e) => setPickedJudge(e.target.value)}
                                    >
                                        <option value="">
                                            {judges.length ? 'pick a judge…' : 'no judges registered yet'}
                                        </option>
                                        {judges.map(j => (
                                            <option key={j._id} value={j._id}>
                                                {j.name} — {j.email}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className="event-assign-go"
                                        disabled={!pickedJudge}
                                        onClick={() => handleAssign(ev._id)}
                                    >
                                        assign
                                    </button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );

    // nested helper so unassigning doesn't inline-uglify the JSX above
    function removeAssigned(ev, judgeId) {
        removeJudge(ev._id, judgeId)
            .then(updated => setEvents(events.map(e => (e._id === ev._id ? updated : e))))
            .catch(() => setError('Could not remove judge'));
    }
}
