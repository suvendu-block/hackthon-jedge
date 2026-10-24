import AppError from '../utils/AppError.js';

// runs the schema against req.body, replaces it with the clean parsed value
// if anything is wrong it throws a 422 and the error middleware handles the rest
const validate = (schema) => (req, res, next) => {
    // a body-less POST still deserves schema rules — parse {} rather than
    // crashing on undefined (required fields then fail with a clear 422)
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
        const first = result.error.issues[0];
        const where = first.path.join('.') || 'body';
        return next(new AppError(`${where}: ${first.message}`, 422, 'VALIDATION_ERROR'));
    }

    req.body = result.data;   // trimmed, lowercased, safe to use
    next();
};

export default validate;
