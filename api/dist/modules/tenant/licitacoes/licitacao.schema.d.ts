import { z } from 'zod';
export declare const createLicitacaoSchema: z.ZodObject<{
    identificacao: z.ZodString;
    objeto: z.ZodString;
}, z.core.$strip>;
export declare const updateLicitacaoStatusSchema: z.ZodObject<{
    status: z.ZodLiteral<"INACTIVE">;
}, z.core.$strip>;
export declare const updateItemStatusSchema: z.ZodObject<{
    status: z.ZodLiteral<"INACTIVE">;
}, z.core.$strip>;
export type CreateLicitacaoRequest = z.infer<typeof createLicitacaoSchema>;
//# sourceMappingURL=licitacao.schema.d.ts.map