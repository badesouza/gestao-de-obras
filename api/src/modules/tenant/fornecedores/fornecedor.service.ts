import type { PrismaClient } from '../../../../generated/prisma/index.js';
import { AppError } from '../../../shared/errors.js';

export async function listFornecedores(
  prisma: PrismaClient,
  entityId: string,
  q?: string,
) {
  return prisma.fornecedor.findMany({
    where: {
      entityId,
      ativo: true,
      ...(q ? { razaoSocial: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { razaoSocial: 'asc' },
    take: 50,
  });
}

export async function createFornecedor(
  prisma: PrismaClient,
  entityId: string,
  data: { razaoSocial: string; cnpj?: string; contato?: string; telefone?: string; email?: string },
) {
  return prisma.fornecedor.create({
    data: {
      entityId,
      razaoSocial: data.razaoSocial.trim(),
      cnpj:    data.cnpj?.trim()    || null,
      contato: data.contato?.trim() || null,
      telefone:data.telefone?.trim()|| null,
      email:   data.email?.trim()   || null,
    },
  });
}

export async function updateFornecedor(
  prisma: PrismaClient,
  entityId: string,
  id: string,
  data: { razaoSocial?: string; cnpj?: string; contato?: string; telefone?: string; email?: string; ativo?: boolean },
) {
  const f = await prisma.fornecedor.findFirst({ where: { id, entityId } });
  if (!f) throw new AppError(404, 'NOT_FOUND', 'Fornecedor não encontrado');

  return prisma.fornecedor.update({
    where: { id },
    data: {
      ...(data.razaoSocial !== undefined ? { razaoSocial: data.razaoSocial.trim() } : {}),
      ...(data.cnpj        !== undefined ? { cnpj:        data.cnpj?.trim() || null } : {}),
      ...(data.contato     !== undefined ? { contato:     data.contato?.trim() || null } : {}),
      ...(data.telefone    !== undefined ? { telefone:    data.telefone?.trim() || null } : {}),
      ...(data.email       !== undefined ? { email:       data.email?.trim() || null } : {}),
      ...(data.ativo       !== undefined ? { ativo:       data.ativo } : {}),
    },
  });
}
