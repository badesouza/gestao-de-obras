import { z } from 'zod';

export const createPropriedadeSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  tipo: z.enum(['TEXTO', 'DATA', 'VALOR', 'BOOLEAN', 'ITEM_LICITACAO', 'ITENS_LICITACAO']),
});

export const updatePropriedadeSchema = z.object({
  nome: z.string().trim().min(1).max(100).optional(),
  status: z.literal('INACTIVE').optional(),
});

export type CreatePropriedadeRequest = z.infer<typeof createPropriedadeSchema>;
export type UpdatePropriedadeRequest = z.infer<typeof updatePropriedadeSchema>;
