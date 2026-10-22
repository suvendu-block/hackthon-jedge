import mongoose from 'mongoose';

// one judge's scorecard for one submission
// scores[] mirrors the event rubric — criterion ref + score 0–10
const criterionScoreSchema = new mongoose.Schema({
    criterion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Criterion',
        required: true
    },
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 10
    }
}, { _id: false });

const evaluationSchema = new mongoose.Schema({
    submission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
        required: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    judge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // null criterion = a partially-saved draft row; submit requires all filled
    scores: {
        type: [criterionScoreSchema],
        default: []
    },
    // judge's free-text justification — teams see this when results release
    comments: {
        type: String,
        maxlength: 3000,
        trim: true,
        default: ''
    },
    // computed via scoringService.totalScore, stored so the leaderboard
    // doesn't have to recompute history (and can't drift from it)
    total: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    // draft → submitted. only submitted evals count toward results
    status: {
        type: String,
        enum: ['draft', 'submitted'],
        default: 'draft'
    },
    submittedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// one judge, one submission, one scorecard — hard uniqueness
evaluationSchema.index({ submission: 1, judge: 1 }, { unique: true });

// for "what's still owed to me" queries
evaluationSchema.index({ judge: 1, status: 1 });

const Evaluation = mongoose.model('Evaluation', evaluationSchema);

export default Evaluation;
