import mongoose from 'mongoose';

/// JudgeEvidence — a judge's own evidence note, optionally linked to a rubric
/// criterion ("BL-11 evidence linking"). human work, so it renders nothing
/// like the AI's dashed draft; kept per judge so nobody's reasoning shows up
/// on another judge's screen.
const judgeEvidenceSchema = new mongoose.Schema({
    submission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
        required: true
    },
    judge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // rubric criterion name, or null for a general note
    criterion: { type: String, default: null, maxlength: 80 },
    type: {
        type: String,
        enum: ['verified-evidence', 'team-claim'],
        required: true
    },
    text: { type: String, required: true, maxlength: 1000 },
    // where they checked it (demo URL, repo path, document name)
    source: { type: String, default: '', maxlength: 300 }
}, { timestamps: true });

judgeEvidenceSchema.index({ submission: 1, judge: 1, createdAt: -1 });

const JudgeEvidence = mongoose.model('JudgeEvidence', judgeEvidenceSchema);

export default JudgeEvidence;
