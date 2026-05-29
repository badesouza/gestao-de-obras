import type { FastifyInstance } from 'fastify';
import { createPrismaClient } from '../lib/prisma-client.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: ReturnType<typeof createPrismaClient>;
  }
}

/** Registers Prisma client on the Fastify instance */
export async function registerPrisma(fastify: FastifyInstance) {
  const prisma = createPrismaClient();
  await prisma.$connect();
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}
