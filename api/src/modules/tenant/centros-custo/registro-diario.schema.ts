import { z } from 'zod';

const cellValueSchema = z.object({
  text: z.string().optional(),
  date: z.string().optional(),
  decimal: z.string().optional(),
  boolean: z.boolean().optional(),
  itemIds: z.array(z.string().uuid()).optional(),
});

export const upsertRegistroDiarioSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  values: z.record(z.string().uuid(), cellValueSchema).optional(),
});

export const monthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type UpsertRegistroDiarioRequest = z.infer<typeof upsertRegistroDiarioSchema>;
