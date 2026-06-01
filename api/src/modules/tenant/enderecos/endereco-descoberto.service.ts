import type { PrismaClient } from '../../../../generated/prisma/index.js';

interface EnderecoPayload {
  entityId: string;
  bairro: string;
  logradouro: string;
  lat: number;
  lng: number;
}

/**
 * Grava bairro + rua + coords quando uma ocorrência é salva.
 * Se a combinação (entityId, bairro, logradouro) já existe, ignora silenciosamente.
 * Se o bairro ainda não tem coord em cadastros_auxiliares, atualiza automaticamente.
 */
export async function registrarEnderecoDescoberto(
  prisma: PrismaClient,
  payload: EnderecoPayload,
): Promise<void> {
  const { entityId, bairro, logradouro, lat, lng } = payload;

  const bairroNorm = bairro.trim();
  const logradouroNorm = logradouro.trim();

  if (!bairroNorm || !logradouroNorm) return;

  /* Inserir endereço descoberto — ON CONFLICT DO NOTHING via upsert sem update */
  await prisma.enderecoDescoberto.upsert({
    where: {
      entityId_bairro_logradouro: {
        entityId,
        bairro: bairroNorm,
        logradouro: logradouroNorm,
      },
    },
    create: { entityId, bairro: bairroNorm, logradouro: logradouroNorm, lat, lng },
    update: {}, /* descarta se já existe */
  });

  /* Se o bairro ainda não tem coord cadastrada, atualiza automaticamente */
  await prisma.cadastroAuxiliar.updateMany({
    where: {
      entityId,
      tipo: 'BAIRRO',
      nome: { equals: bairroNorm, mode: 'insensitive' },
      lat: null,
    },
    data: { lat, lng },
  });
}
