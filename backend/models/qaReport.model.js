import mongoose from 'mongoose';

// one rated dimension of the report card — fixed set, whole points 1-10
const ratingSchema = new mongoose.Schema({
    dimension: {
        type: String,
        enum: ['tech-stack', 'folder-structure', 'complexity', 'documentation', 'readiness'],
        required: true
    },
    score: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    rationale: {
        type: String,
        required: true,
        maxlength: 600
    },
    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    // ADR-0009: every row says where it came from
    evidenceType: {
        type: String,
        enum: ['verified-evidence', 'team-claim', 'ai-inference'],
        required: true
    }
}, { _id: false });

// one thing a QA pass would flag — empty list means "nothing visible seen"
const errorSchema = new mongoose.Schema({
    severity: {
        type: String,
        enum: ['blocker', 'major', 'minor'],
        required: true
    },
    message: {
        type: String,
        required: true,
        maxlength: 300
    },
    source: {
        type: String,
        enum: ['repository', 'demo', 'documents', 'ai'],
        required: true
    }
}, { _id: false });

/// QAReport — the project's quality card lives in its own collection
/// (ADR-0008 territory): regenerated freely, never touches judge data, and
/// the leaderboard only ever reads Evaluation totals — never these.
const qaReportSchema = new mongoose.Schema({
    // keyed by submission — team, judges, and the organizer all read one card
    submission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
        required: true
    },
    // which provider produced it ("mock" for the built-in dev provider)
    model: {
        type: String,
        required: true,
        maxlength: 100
    },
    summary: {
        type: String,
        required: true,
        maxlength: 1200
    },
    ratings: {
        type: [ratingSchema],
        default: []
    },
    errors: {
        type: [errorSchema],
        default: []
    },
    // "how many users can this serve" — always an ai-inference estimate
    capacity: {
        estimate: {
            type: String,
            required: true,
            maxlength: 300
        },
        confidence: {
            type: Number,
            required: true,
            min: 0,
            max: 1
        }
    },
    overall: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    // never a card without "what this cannot know"
    limitations: {
        type: [String],
        default: []
    },
    // which stored artifacts the report leaned on — honesty about inputs
    inputs: {
        repository: { type: Boolean, default: false },
        documents: { type: Number, default: 0 },
        demo: { type: Boolean, default: false }
    }
    // `errors` is technically a reserved mongoose path, but it's the word the
    // whole product uses for this list — silencing the warning on purpose
}, { timestamps: true, suppressReservedKeysWarning: true });

// latest card for a submission is the hot path
qaReportSchema.index({ submission: 1, createdAt: -1 });

const QAReport = mongoose.model('QAReport', qaReportSchema);

export default QAReport;
