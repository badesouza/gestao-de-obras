import type { FastifyReply } from 'fastify';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/** Sends a structured JSON error response */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return reply.code(statusCode).send({ code, message, details });
}

/** Maps AppError to HTTP response */
export function handleAppError(reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return sendError(reply, error.statusCode, error.code, error.message, error.details);
  }
  throw error;
}
