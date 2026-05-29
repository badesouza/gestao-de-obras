import { z } from 'zod';
export declare const upsertRegistroDiarioSchema: z.ZodObject<{
    data: z.ZodString;
    values: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        text: z.ZodOptional<z.ZodString>;
        date: z.ZodOptional<z.ZodString>;
        decimal: z.ZodOptional<z.ZodString>;
        boolean: z.ZodOptional<z.ZodBoolean>;
        itemIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export declare const monthQuerySchema: z.ZodObject<{
    year: z.ZodCoercedNumber<unknown>;
    month: z.ZodCoercedNumber<unknown>;
}, z.core.$strip>;
export type UpsertRegistroDiarioRequest = z.infer<typeof upsertRegistroDiarioSchema>;
//# sourceMappingURL=registro-diario.schema.d.ts.map