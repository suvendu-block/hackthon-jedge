import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import Submission from '../models/submission.model.js';
import SubmissionDocument from '../models/submissionDocument.model.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';
import { sha256, extractDocument, downloadName } from '../services/documentService.js';

/// documents controller — slide decks, write-ups, PDFs. bytes land on disk
/// under backend/uploads/ (sha256-named, gitignored), metadata + the text we
/// could honestly extract land in Mongo. teams own their uploads; judges and
/// the organizer read them.

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const ensureDir = () => {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
};

const loadSubmission = async (id) => {
    if (!mongoose.isValidObjectId(id)) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    const sub = await Submission.findById(id)
        .populate('event', 'name status organizer judges')
        .populate('team', 'name email');
    if (!sub) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    return sub;
};

const isOwner = (sub, user) => sub.team._id.toString() === user._id.toString();
const isAssignedJudge = (sub, user) => sub.event.judges.some(j => j._id.toString() === user._id.toString());
const isOrganizer = (sub, user) => sub.event.organizer._id.toString() === user._id.toString();

// judges/organizer/owning team can read; only the team uploads or deletes
const assertCanView = (sub, user) => {
    if (!isOwner(sub, user) && !isAssignedJudge(sub, user) && !isOrganizer(sub, user)) {
        throw new AppError('Not your submission', 404, 'NOT_FOUND');
    }
};

const assertOwner = (sub, user) => {
    if (!isOwner(sub, user)) throw new AppError('Only your team can manage documents', 403, 'FORBIDDEN');
};

const serialize = (doc) => ({
    _id: doc._id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    extractedChars: doc.extractedText.length,
    extractionNotes: doc.extractionNotes,
    uploadedAt: doc.createdAt
});

// POST /api/submissions/:id/documents — multipart, multer runs at the route
export const uploadDocument = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertOwner(sub, req.user);

    if (!req.file) {
        throw new AppError('No file attached — send one file as "file"', 422, 'NO_FILE');
    }

    const hash = sha256(req.file.buffer);
    const ext = ((req.file.originalname || '').match(/\.[A-Za-z0-9]{1,10}$/) || [''])[0].toLowerCase();

    // same bytes twice for the same submission? keep one copy
    const existing = await SubmissionDocument.findOne({ submission: sub._id, sha256: hash });
    if (existing) return res.status(200).json({ document: serialize(existing), deduped: true });

    ensureDir();
    const storedName = `${hash}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), req.file.buffer);

    const { text, notes } = extractDocument(req.file.buffer, req.file.mimetype, req.file.originalname);

    const doc = await SubmissionDocument.create({
        submission: sub._id,
        originalName: (req.file.originalname || 'upload').slice(0, 200),
        mimeType: req.file.mimetype || 'application/octet-stream',
        sizeBytes: req.file.size,
        sha256: hash,
        storedName,
        extractedText: text,
        extractionNotes: notes,
        uploadedBy: req.user._id
    });

    res.status(201).json({ document: serialize(doc) });
});

// GET /api/submissions/:id/documents
export const listDocuments = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertCanView(sub, req.user);

    const documents = await SubmissionDocument.find({ submission: sub._id })
        .sort({ createdAt: -1 });
    res.json({ documents: documents.map(serialize) });
});

// GET /api/submissions/:id/documents/:docId/download — bytes back as an
// attachment; the browser downloads, it never renders untrusted markup
export const downloadDocument = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertCanView(sub, req.user);

    if (!mongoose.isValidObjectId(req.params.docId)) throw new AppError('Document not found', 404, 'NOT_FOUND');
    const doc = await SubmissionDocument.findOne({ _id: req.params.docId, submission: sub._id });
    if (!doc) throw new AppError('Document not found', 404, 'NOT_FOUND');

    const abs = path.join(UPLOAD_DIR, doc.storedName);
    if (!fs.existsSync(abs)) throw new AppError('File no longer stored', 410, 'FILE_MISSING');

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName(doc.originalName, doc.sha256)}"`);
    res.setHeader('Content-Length', doc.sizeBytes);
    fs.createReadStream(abs).pipe(res);
});

// DELETE /api/submissions/:id/documents/:docId — owner only; bytes + rows go
export const deleteDocument = catchAsync(async (req, res) => {
    const sub = await loadSubmission(req.params.id);
    assertOwner(sub, req.user);

    if (!mongoose.isValidObjectId(req.params.docId)) throw new AppError('Document not found', 404, 'NOT_FOUND');
    const doc = await SubmissionDocument.findOne({ _id: req.params.docId, submission: sub._id });
    if (!doc) throw new AppError('Document not found', 404, 'NOT_FOUND');

    await doc.deleteOne();
    fs.promises.unlink(path.join(UPLOAD_DIR, doc.storedName)).catch(() => {});

    res.json({ deleted: true });
});
