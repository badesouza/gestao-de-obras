import type { FastifyInstance } from 'fastify';
import { createPrismaClient } from '../lib/prisma-client.js';
declare module 'fastify' {
    interface FastifyInstance {
        prisma: ReturnType<typeof createPrismaClient>;
    }
}
/** Registers Prisma client on the Fastify instance */
export declare function registerPrisma(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=prisma.d.ts.map