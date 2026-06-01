import type { PrismaClient } from '../../../../generated/prisma/index.js';

export type CadastroTipo = 'BAIRRO' | 'EQUIPE' | 'VEICULO' | 'EQUIPAMENTO';

export async function listCadastros(
  prisma: PrismaClient,
  entityId: string,
  tipo?: CadastroTipo,
) {
  const items = await prisma.cadastroAuxiliar.findMany({
    where: { entityId, ...(tipo ? { tipo } : {}) },
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
  });
  return { items };
}

export async function createCadastro(
  prisma: PrismaClient,
  entityId: string,
  data: { tipo: CadastroTipo; nome: string },
) {
  const maxOrdem = await prisma.cadastroAuxiliar.aggregate({
    where: { entityId, tipo: data.tipo },
    _max: { ordem: true },
  });
  const ordem = (maxOrdem._max.ordem ?? 0) + 1;

  return prisma.cadastroAuxiliar.create({
    data: { entityId, tipo: data.tipo, nome: data.nome.trim(), ordem },
  });
}

export async function updateCadastro(
  prisma: PrismaClient,
  entityId: string,
  id: string,
  data: { nome?: string; ativo?: boolean; ordem?: number },
) {
  const item = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId } });
  if (!item) throw new Error('NOT_FOUND');

  return prisma.cadastroAuxiliar.update({
    where: { id },
    data: {
      ...(data.nome !== undefined ? { nome: data.nome.trim() } : {}),
      ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
    },
  });
}

export async function saveBairroCoords(
  prisma: PrismaClient,
  entityId: string,
  id: string,
  lat: number,
  lng: number,
) {
  const item = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId, tipo: 'BAIRRO' } });
  if (!item) throw new Error('NOT_FOUND');

  return prisma.cadastroAuxiliar.update({
    where: { id },
    data: { lat, lng },
  });
}

export async function listBairrosComCoords(
  prisma: PrismaClient,
  entityId: string,
) {
  const items = await prisma.cadastroAuxiliar.findMany({
    where: { entityId, tipo: 'BAIRRO', ativo: true },
    select: { id: true, nome: true, lat: true, lng: true },
    orderBy: { nome: 'asc' },
  });
  return { items };
}

export async function deleteCadastro(
  prisma: PrismaClient,
  entityId: string,
  id: string,
) {
  const item = await prisma.cadastroAuxiliar.findFirst({ where: { id, entityId } });
  if (!item) throw new Error('NOT_FOUND');
  await prisma.cadastroAuxiliar.delete({ where: { id } });
}
