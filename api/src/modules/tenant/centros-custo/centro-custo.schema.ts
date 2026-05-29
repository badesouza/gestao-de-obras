import { z } from 'zod';

const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

const licitacaoIdsSchema = z.array(z.string().uuid()).max(1, 'Centro de custo permite apenas uma licitação');

export const createCentroCustoSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  dataPrevistaInicio: optionalDate,
  dataPrevistaFim: optionalDate,
  dataRealizadaInicio: optionalDate,
  dataRealizadaFim: optionalDate,
  licitacaoIds: licitacaoIdsSchema.optional(),
});

export const updateCentroCustoSchema = createCentroCustoSchema.partial().extend({
  nome: z.string().trim().min(1).max(200).optional(),
});

export const updateCentroCustoStatusSchema = z.object({
  status: z.literal('INACTIVE'),
});

export const setLicitacoesSchema = z.object({
  licitacaoIds: licitacaoIdsSchema,
});

export const propriedadesConfigSchema = z.object({
  items: z.array(
    z.object({
      propriedadeId: z.string().uuid(),
      columnOrder: z.number().int().min(0),
      productionRole: z.enum(['NONE', 'INICIO', 'CONCLUSAO']).default('NONE'),
      active: z.boolean().default(true),
    }),
  ),
});

export type CreateCentroCustoRequest = z.infer<typeof createCentroCustoSchema>;
export type UpdateCentroCustoRequest = z.infer<typeof updateCentroCustoSchema>;
export type PropriedadesConfigRequest = z.infer<typeof propriedadesConfigSchema>;
