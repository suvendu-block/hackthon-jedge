import AppError from '../utils/AppError.js';

const isDev = () => process.env.NODE_ENV !== 'production';

/// 404 — anything that reaches here matched no route (register AFTER all routes)
export const notFound = (req, res, next) => {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
};

/// central error handler — ONE place that shapes every error response
/// must be registered LAST (after routes + notFound)
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let code = err.code || 'SERVER_ERROR';
    let message = err.message || 'Something went wrong';

    // malformed JSON body from client (express.json throws SyntaxError)
    if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
        statusCode = 400;
        code = 'BAD_JSON';
        message = 'Request body is not valid JSON';
    }

    // mongoose validation errors → 422
    if (err.name === 'ValidationError') {
        statusCode = 422;
        code = 'VALIDATION_ERROR';
        message = Object.values(err.errors).map((e) => e.message).join('; ');
    }

    // mongoose duplicate key (e.g. unique email) → 409
    if (err.code === 11000) {
        statusCode = 409;
        code = 'DUPLICATE_KEY';
        message = `Duplicate value for: ${Object.keys(err.keyValue).join(', ')}`;
    }

    // unknown/bug errors: log loudly, respond generically (no stack leak)
    if (statusCode === 500) {
        console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
        code = 'SERVER_ERROR';
        message = 'Internal server error';
    } else if (isDev()) {
        console.error(`[handled] ${code} ${statusCode} — ${message}`);
    }

    res.status(statusCode).json({ error: { code, message } });
};
