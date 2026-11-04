import type { PrismaClient } from '../../../../generated/prisma/index.js';

interface EnderecoPayload {
  entityId: string;
  bairro: string;
  logradouro: string;
  lat: number;
  lng: number;
}

/* Corta por letra (não quebra acento nem emoji ao meio). */
function cortar(texto: string, max: number): string {
  const letras = Array.from(texto);
  return letras.length > max ? letras.slice(0, max).join('').trim() : texto;
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

  /* O banco guarda até 150 (bairro) e 300 (rua) letras; texto maior seria recusado. */
  const bairroNorm = cortar(bairro.trim(), 150);
  const logradouroNorm = cortar(logradouro.trim(), 300);

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
