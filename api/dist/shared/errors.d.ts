import type { FastifyReply } from 'fastify';
export declare class AppError extends Error {
    statusCode: number;
    code: string;
    details?: Record<string, unknown>;
    constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>);
}
/** Sends a structured JSON error response */
export declare function sendError(reply: FastifyReply, statusCode: number, code: string, message: string, details?: Record<string, unknown>): FastifyReply<import("fastify").RouteGenericInterface, import("fastify").RawServerDefault, import("node:http").IncomingMessage, import("node:http").ServerResponse<import("node:http").IncomingMessage>, unknown, import("fastify").FastifySchema, import("fastify").FastifyTypeProviderDefault, unknown>;
/** Maps AppError to HTTP response */
export declare function handleAppError(reply: FastifyReply, error: unknown): FastifyReply<import("fastify").RouteGenericInterface, import("fastify").RawServerDefault, import("node:http").IncomingMessage, import("node:http").ServerResponse<import("node:http").IncomingMessage>, unknown, import("fastify").FastifySchema, import("fastify").FastifyTypeProviderDefault, unknown>;
//# sourceMappingURL=errors.d.ts.map