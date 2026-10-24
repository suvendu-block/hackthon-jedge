import mongoose from 'mongoose';

/// SubmissionDocument — an uploaded slide deck / doc / write-up. Stored on
/// disk (sha256-named), metadata + extracted text in Mongo. we keep the
/// extraction result so judges and the AI read the same bounded text.
const submissionDocumentSchema = new mongoose.Schema({
    submission: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
        required: true
    },
    originalName: { type: String, required: true, maxlength: 200 },
    mimeType: { type: String, required: true, maxlength: 120 },
    sizeBytes: { type: Number, required: true, min: 0, max: 20 * 1024 * 1024 },
    sha256: { type: String, required: true, maxlength: 64 },
    // where the bytes live under backend/uploads/
    storedName: { type: String, required: true, maxlength: 120 },
    extractedText: { type: String, default: '' },
    extractionNotes: { type: [String], default: [] },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

submissionDocumentSchema.index({ submission: 1, createdAt: -1 });

const SubmissionDocument = mongoose.model('SubmissionDocument', submissionDocumentSchema);

export default SubmissionDocument;
