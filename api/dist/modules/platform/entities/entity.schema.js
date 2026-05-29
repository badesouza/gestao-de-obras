import { z } from 'zod';
const ufSchema = z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase());
const coatOfArmsUrlSchema = z.string().optional().nullable();
export const createEntitySchema = z.object({
    name: z.string().min(2).max(200),
    cnpj: z.string().optional().nullable(),
    email: z.email().optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    legalRepresentativeName: z.string().max(200).optional().nullable(),
    uf: ufSchema.optional().nullable(),
    municipalityId: z.number().int().positive().optional().nullable(),
    municipalityName: z.string().max(200).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    coatOfArmsUrl: coatOfArmsUrlSchema,
    acknowledgeCnpjDuplicate: z.boolean().optional().default(false),
});
export const updateEntitySchema = z.object({
    name: z.string().min(2).max(200).optional(),
    cnpj: z.string().optional().nullable(),
    email: z.email().optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
    legalRepresentativeName: z.string().max(200).optional().nullable(),
    uf: ufSchema.optional().nullable(),
    municipalityId: z.number().int().positive().optional().nullable(),
    municipalityName: z.string().max(200).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    coatOfArmsUrl: coatOfArmsUrlSchema,
    acknowledgeCnpjDuplicate: z.boolean().optional().default(false),
});
export const updateEntityStatusSchema = z.object({
    status: z.enum(['ACTIVE', 'INACTIVE']),
});
export const listEntitiesQuerySchema = z.object({
    search: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
//# sourceMappingURL=entity.schema.js.map