import mongoose from 'mongoose';

// one typed evidence row — ADR-0009: every finding says where it came from
const evidenceSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['verified-evidence', 'team-claim', 'ai-inference'],
        required: true
    },
    text: {
        type: String,
        required: true,
        maxlength: 500
    },
    // file path, URL section, or submission field name
    source: {
        type: String,
        maxlength: 300,
        default: ''
    }
}, { _id: false });

// one suggested score — always with a rationale and a stated confidence
const suggestedScoreSchema = new mongoose.Schema({
    criterion: {
        type: String,
        required: true,
        maxlength: 80
    },
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 10
    },
    rationale: {
        type: String,
        required: true,
        maxlength: 1000
    },
    // 0–1, how much the model trusts its own suggestion
    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    }
}, { _id: false });

/// AIAnalysis — reports live in their own collection (ADR-0008): they get
/// versioned, regenerated, and never overwrite judge data. The leaderboard
/// only ever reads Evaluation totals, never these.
const aiAnalysisSchema = new mongoose.Schema({
    // keyed by submission, not by judge — any assigned judge sees the same draft
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
        maxlength: 2000
    },
    complexityAnalysis: {
        type: String,
        required: true,
        maxlength: 3000
    },
    evidence: {
        type: [evidenceSchema],
        default: []
    },
    suggestedScores: {
        type: [suggestedScoreSchema],
        default: []
    },
    // never a report without "what this cannot know"
    limitations: {
        type: [String],
        default: []
    }
}, { timestamps: true });

// latest report for a submission is the hot path
aiAnalysisSchema.index({ submission: 1, createdAt: -1 });

const AIAnalysis = mongoose.model('AIAnalysis', aiAnalysisSchema);

export default AIAnalysis;
