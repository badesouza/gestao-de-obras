export class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, code, message, details) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}
/** Sends a structured JSON error response */
export function sendError(reply, statusCode, code, message, details) {
    return reply.code(statusCode).send({ code, message, details });
}
/** Maps AppError to HTTP response */
export function handleAppError(reply, error) {
    if (error instanceof AppError) {
        return sendError(reply, error.statusCode, error.code, error.message, error.details);
    }
    throw error;
}
//# sourceMappingURL=errors.js.map