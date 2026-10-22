import type { PrismaClient } from '../../generated/prisma/index.js';

const FUSO_MS = -3 * 3600_000;

/** Data de hoje no horário de Brasília (AAAA-MM-DD) */
export const hojeBrasilia = () => new Date(Date.now() + FUSO_MS).toISOString().slice(0, 10);

/** Próximo número da sequência (atômico, nunca repete) */
export async function proximoNumero(prisma: Pick<PrismaClient, '$queryRaw'>, entityId: string, chave: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ ultimo: number }[]>`
    INSERT INTO sequencias (entity_id, chave, ultimo, updated_at)
    VALUES (${entityId}, ${chave}, 1, now())
    ON CONFLICT (entity_id, chave) DO UPDATE SET ultimo = sequencias.ultimo + 1, updated_at = now()
    RETURNING ultimo`;
  return Number(rows[0]!.ultimo);
}
