/// AppError — trusted, intentional errors (everything else = bug → 500)
export default class AppError extends Error {
    constructor(message, statusCode = 500, code = 'SERVER_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;   // distinguishes user errors from bugs
        Error.captureStackTrace(this, this.constructor);
    }
}
