import { createPrismaClient } from '../lib/prisma-client.js';
/** Registers Prisma client on the Fastify instance */
export async function registerPrisma(fastify) {
    const prisma = createPrismaClient();
    await prisma.$connect();
    fastify.decorate('prisma', prisma);
    fastify.addHook('onClose', async () => {
        await prisma.$disconnect();
    });
}
//# sourceMappingURL=prisma.js.map