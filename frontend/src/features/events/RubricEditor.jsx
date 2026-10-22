import { useEffect, useState } from 'react';
import './RubricEditor.css';

// the rubric editor — criteria rows + live weight total
// the Σ=100 rule is shown visually while you type, not after you submit
export default function RubricEditor({ criteria, onChange, locked = false }) {
    const [draft, setDraft] = useState(() =>
        criteria.length ? criteria : [
            { name: 'Impact', description: '', weight: 40 },
            { name: 'Technical', description: '', weight: 35 },
            { name: 'Design', description: '', weight: 25 }
        ]
    );

    // the prefilled rows start life inside this component only — push them up
    // once so the parent's "Σ=100" gate agrees with the meter on screen
    useEffect(() => {
        if (criteria.length === 0) onChange(draft);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const total = draft.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
    const rounded = Math.round(total * 10) / 10;           // kill float noise (0.1+0.2)
    const isValid = draft.length > 0 && Math.abs(total - 100) < 0.001;
    const offBy = Math.round((100 - total) * 10) / 10;

    // keep parent in sync so the outer form knows when to allow submit
    const commit = (next) => {
        setDraft(next);
        onChange(next);
    };

    const update = (i, field, value) => {
        commit(draft.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
    };

    const addCriterion = () => {
        commit([...draft, { name: '', description: '', weight: 0 }]);
    };

    const removeCriterion = (i) => {
        commit(draft.filter((_, idx) => idx !== i));
    };

    // spread the remaining weight evenly across the other criteria —
    // the "make it add up for me" button judges will want constantly
    const distribute = () => {
        if (draft.length === 0) return;
        const others = draft.length - 1;
        if (others === 0) { commit([{ ...draft[0], weight: 100 }]); return; }
        const currentTop = Number(draft[draft.length - 1].weight) || 0;
        const rest = 100 - currentTop;
        const each = Math.floor((rest / others) * 10) / 10;
        const lastOther = Math.round((rest - each * (others - 1)) * 10) / 10;
        commit(draft.map((c, idx) => ({
            ...c,
            weight: idx === draft.length - 1 ? currentTop : (idx === others - 1 ? lastOther : each)
        })));
    };

    return (
        <div className="rubric">
            <div className="rubric-head">
                <span className="rubric-title">rubric</span>
                {!locked && (
                    <button type="button" className="rubric-add" onClick={addCriterion}>
                        + add criterion
                    </button>
                )}
            </div>

            {draft.length === 0 && (
                <p className="rubric-empty">
                    No criteria yet — a rubric needs at least one before judges can score.
                </p>
            )}

            <ul className="rubric-list">
                {draft.map((c, i) => (
                    <li key={i} className="rubric-row">
                        <div className="rubric-fields">
                            <input
                                className="rubric-name"
                                placeholder="Criterion name (e.g. Impact)"
                                value={c.name}
                                disabled={locked}
                                onChange={(e) => update(i, 'name', e.target.value)}
                            />
                            <input
                                className="rubric-desc"
                                placeholder="what judges look for (optional)"
                                value={c.description}
                                disabled={locked}
                                onChange={(e) => update(i, 'description', e.target.value)}
                            />
                        </div>
                        <div className="rubric-weight">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={c.weight}
                                disabled={locked}
                                onChange={(e) => update(i, 'weight', e.target.value === '' ? '' : Number(e.target.value))}
                            />
                            <span className="rubric-pct">%</span>
                        </div>
                        {!locked && (
                            <button
                                type="button"
                                className="rubric-remove"
                                aria-label={`Remove ${c.name || 'criterion'}`}
                                onClick={() => removeCriterion(i)}
                            >
                                ×
                            </button>
                        )}
                    </li>
                ))}
            </ul>

            {/* live total — the thing that stops 90% of rubric mistakes */}
            <div className={`rubric-total ${isValid ? 'is-valid' : 'is-invalid'}`}>
                <div className="rubric-bar" aria-hidden="true">
                    <div
                        className="rubric-bar-fill"
                        style={{ width: `${Math.min(100, Math.max(0, total))}%` }}
                    />
                </div>
                <div className="rubric-total-readout">
                    <span className="rubric-total-num">
                        Σ {rounded}%
                    </span>
                    <span className="rubric-total-msg">
                        {isValid
                            ? 'adds up — good to publish'
                            : draft.length === 0
                                ? 'add at least one criterion'
                                : offBy > 0
                                    ? `${offBy}% still unassigned`
                                    : `${Math.abs(offBy)}% over the maximum`}
                    </span>
                    {!locked && !isValid && draft.length > 0 && (
                        <button type="button" className="rubric-fix" onClick={distribute}>
                            spread the rest evenly
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
