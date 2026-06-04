import { z } from 'zod';

export const createLicitacaoSchema = z.object({
  identificacao: z.string().trim().min(1, 'Identificação é obrigatória').max(100),
  objeto: z.string().trim().min(3, 'Objeto deve ter ao menos 3 caracteres').max(500),
  fornecedorId: z.string().uuid().optional().nullable(),
});

export const updateLicitacaoStatusSchema = z.object({
  status: z.literal('INACTIVE'),
});

export const updateLicitacaoSchema = z.object({
  identificacao: z.string().trim().min(1, 'Identificação é obrigatória').max(100),
  objeto: z.string().trim().min(3, 'Objeto deve ter ao menos 3 caracteres').max(500),
  fornecedorId: z.string().uuid().optional().nullable(),
});

export type UpdateLicitacaoRequest = z.infer<typeof updateLicitacaoSchema>;

export const updateItemStatusSchema = z.object({
  status: z.literal('INACTIVE'),
});

export type CreateLicitacaoRequest = z.infer<typeof createLicitacaoSchema>;
