import mongoose from 'mongoose';

/// submissions schema — one team's project entry in one event
const submissionSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    // the team that owns this submission — they can edit it until judging starts
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    projectName: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true
    },
    tagline: {
        type: String,
        maxlength: 200,
        trim: true,
        default: ''
    },
    // what it does / how it was built — the evidence judges read
    description: {
        type: String,
        maxlength: 5000,
        trim: true,
        default: ''
    },
    // links — validated against an allowlist (no javascript:, no data:)
    // each entry: { label, url }
    links: [{
        label: { type: String, maxlength: 60, trim: true },
        url: { type: String, maxlength: 500, trim: true }
    }],
    // typed evidence fields (Phase 7) — the repository we may statically
    // inspect, and the demo judges will click. validated harder than links.
    repositoryUrl: {
        type: String,
        maxlength: 300,
        trim: true,
        default: ''
    },
    demoUrl: {
        type: String,
        maxlength: 500,
        trim: true,
        default: ''
    },
    // one submission per team per event — enforced by the unique index below
}, { timestamps: true });

// a team can only submit once per event (Phase 3 rule)
submissionSchema.index({ event: 1, team: 1 }, { unique: true });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
