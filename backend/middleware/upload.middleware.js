import multer from 'multer';
import AppError from '../utils/AppError.js';

// upload middleware — memory storage so nothing touches disk until we've
// hashed and vetted the file. 20MB cap and a MIME allowlist (SPEC §9):
// anything else is a clear 422, not a surprise later.

const MAX_UPLOAD = 20 * 1024 * 1024;

const ALLOWED_MIME = new Set([
    // text we can read straight away
    'text/markdown', 'text/x-markdown', 'text/plain', 'text/csv',
    'application/pdf',
    // office zips — extracted statically (see documentService)
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

// extension fallback: browsers send octet-stream for all sorts of things, so
// a known-good extension rescues the mime — but a .exe has no such friend
const ALLOWED_EXT = /\.(md|markdown|txt|csv|pdf|docx|pptx)$/i;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD, files: 1 },
    fileFilter: (_req, file, cb) => {
        const okMime = ALLOWED_MIME.has(file.mimetype);
        const okExt = ALLOWED_EXT.test(file.originalname || '');
        if (okMime || okExt) return cb(null, true);
        cb(new AppError('Upload rejected — allowed: md, txt, csv, pdf, docx, pptx (max 20MB)', 422, 'UPLOAD_TYPE_NOT_ALLOWED'));
    }
});

// single-file wrapper that turns multer's own errors into our error shape
export const uploadSingle = (field = 'file') => (req, res, next) => {
    upload.single(field)(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return next(new AppError('File is larger than 20MB', 413, 'UPLOAD_TOO_LARGE'));
            }
            return next(new AppError('Upload rejected — one file per request', 422, 'UPLOAD_REJECTED'));
        }
        next(err);   // our own fileFilter AppError passes straight through
    });
};
