import { z } from 'zod';

const decimalString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).replace(',', '.'))
  .refine((value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0;
  }, 'Informe um numero maior que zero');

export const solicitacoesQuerySchema = z.object({
  servicoSlug: z.string().optional(),
  status: z
    .enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONSOLIDATED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const createSolicitacaoSchema = z.object({
  servicoSlug: z.string().min(1),
  servicoNome: z.string().min(1),
  licitacaoId: z.string().uuid(),
  prioridade: z.enum(['Alta', 'Media', 'Baixa']).default('Media'),
  justificativa: z.string().min(3).max(2000),
  observacoes: z.string().max(2000).optional().nullable(),
  submit: z.boolean().default(false),
  itens: z.array(z.object({
    licitacaoItemId: z.string().uuid(),
    quantidade: decimalString,
    observacoes: z.string().max(1000).optional().nullable(),
  })).min(1),
});

export const pedidosQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const createPedidoFromSolicitacoesSchema = z.object({
  solicitacaoIds: z.array(z.string().uuid()).min(1),
  observacoes: z.string().max(2000).optional().nullable(),
  send: z.boolean().default(false),
});

export const recebimentoSchema = z.object({
  pedidoCompraItemId: z.string().uuid(),
  quantidade: decimalString,
  recebidoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  responsavel: z.string().min(2).max(160),
  observacoes: z.string().max(1000).optional().nullable(),
});
