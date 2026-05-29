import { z } from 'zod';
export const createLicitacaoSchema = z.object({
    identificacao: z.string().trim().min(1, 'Identificação é obrigatória').max(100),
    objeto: z.string().trim().min(3, 'Objeto deve ter ao menos 3 caracteres').max(500),
});
export const updateLicitacaoStatusSchema = z.object({
    status: z.literal('INACTIVE'),
});
export const updateItemStatusSchema = z.object({
    status: z.literal('INACTIVE'),
});
//# sourceMappingURL=licitacao.schema.js.map