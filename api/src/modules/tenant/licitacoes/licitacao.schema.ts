import { z } from 'zod';
import { MODALIDADES } from '../contratos/contratos.service.js';

const camposProcesso = {
  numeroProcesso: z.string().trim().max(60).optional().nullable(),
  modalidade: z.enum(MODALIDADES, { message: 'Escolha a modalidade da lista' }).optional().nullable(),
  tipo: z.enum(['MATERIAL', 'SERVICO', 'COMBUSTIVEL', 'OBRA']).optional().nullable(),
  dataHomologacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de homologação inválida').optional().nullable(),
};

export const createLicitacaoSchema = z.object({
  identificacao: z.string().trim().min(1, 'Identificação é obrigatória').max(100),
  objeto: z.string().trim().min(3, 'Objeto deve ter ao menos 3 caracteres').max(500),
  fornecedorId: z.string().uuid().optional().nullable(),
  ...camposProcesso,
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
