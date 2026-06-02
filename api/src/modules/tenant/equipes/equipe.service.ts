import type { PrismaClient } from '../../../../generated/prisma/index.js';

export async function getOrCreateEquipe(
  prisma: PrismaClient,
  entityId: string,
  cadastroId: string,
) {
  const existing = await prisma.equipe.findUnique({ where: { cadastroId } });
  if (existing) return existing;

  const cadastro = await prisma.cadastroAuxiliar.findFirst({
    where: { id: cadastroId, entityId, tipo: 'EQUIPE' },
  });
  if (!cadastro) throw new Error('NOT_FOUND');

  return prisma.equipe.create({ data: { entityId, cadastroId } });
}

export async function getEquipeDetail(
  prisma: PrismaClient,
  entityId: string,
  cadastroId: string,
) {
  const equipe = await prisma.equipe.findUnique({
    where: { cadastroId },
    include: {
      lider: { select: { id: true, name: true, email: true } },
      operadores: { where: { ativo: true }, orderBy: { nome: 'asc' } },
    },
  });

  if (!equipe || equipe.entityId !== entityId) {
    return { cadastroId, lider: null, operadores: [] };
  }

  return equipe;
}

export async function setLider(
  prisma: PrismaClient,
  entityId: string,
  cadastroId: string,
  liderUserId: string | null,
) {
  const equipe = await getOrCreateEquipe(prisma, entityId, cadastroId);

  if (liderUserId) {
    const user = await prisma.tenantUser.findFirst({
      where: { id: liderUserId, entityId, isLiderEquipe: true },
    });
    if (!user) throw new Error('LIDER_INVALIDO');
  }

  return prisma.equipe.update({
    where: { id: equipe.id },
    data: { liderUserId },
    include: { lider: { select: { id: true, name: true, email: true } } },
  });
}

export async function listLideres(prisma: PrismaClient, entityId: string) {
  return prisma.tenantUser.findMany({
    where: { entityId, isLiderEquipe: true, status: 'ACTIVE' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
}

export async function addOperador(
  prisma: PrismaClient,
  entityId: string,
  cadastroId: string,
  data: { nome: string; cargo: string },
) {
  const equipe = await getOrCreateEquipe(prisma, entityId, cadastroId);
  return prisma.operador.create({
    data: { entityId, equipeId: equipe.id, nome: data.nome.trim(), cargo: data.cargo.trim() },
  });
}

export async function updateOperador(
  prisma: PrismaClient,
  entityId: string,
  operadorId: string,
  data: { nome?: string; cargo?: string; ativo?: boolean },
) {
  const op = await prisma.operador.findFirst({ where: { id: operadorId, entityId } });
  if (!op) throw new Error('NOT_FOUND');

  return prisma.operador.update({
    where: { id: operadorId },
    data: {
      ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
      ...(data.cargo !== undefined ? { cargo: data.cargo.trim() } : {}),
      ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
    },
  });
}

export async function deleteOperador(
  prisma: PrismaClient,
  entityId: string,
  operadorId: string,
) {
  const op = await prisma.operador.findFirst({ where: { id: operadorId, entityId } });
  if (!op) throw new Error('NOT_FOUND');
  await prisma.operador.delete({ where: { id: operadorId } });
}
