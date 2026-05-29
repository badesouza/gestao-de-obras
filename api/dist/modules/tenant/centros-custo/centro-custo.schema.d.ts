import { z } from 'zod';
export declare const createCentroCustoSchema: z.ZodObject<{
    nome: z.ZodString;
    dataPrevistaInicio: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    dataPrevistaFim: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    dataRealizadaInicio: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    dataRealizadaFim: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    licitacaoIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const updateCentroCustoSchema: z.ZodObject<{
    dataPrevistaInicio: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    dataPrevistaFim: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    dataRealizadaInicio: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    dataRealizadaFim: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    licitacaoIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    nome: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateCentroCustoStatusSchema: z.ZodObject<{
    status: z.ZodLiteral<"INACTIVE">;
}, z.core.$strip>;
export declare const setLicitacoesSchema: z.ZodObject<{
    licitacaoIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const propriedadesConfigSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        propriedadeId: z.ZodString;
        columnOrder: z.ZodNumber;
        productionRole: z.ZodDefault<z.ZodEnum<{
            NONE: "NONE";
            INICIO: "INICIO";
            CONCLUSAO: "CONCLUSAO";
        }>>;
        active: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CreateCentroCustoRequest = z.infer<typeof createCentroCustoSchema>;
export type UpdateCentroCustoRequest = z.infer<typeof updateCentroCustoSchema>;
export type PropriedadesConfigRequest = z.infer<typeof propriedadesConfigSchema>;
//# sourceMappingURL=centro-custo.schema.d.ts.map