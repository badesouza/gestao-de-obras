import { z } from 'zod';
export declare const createEntitySchema: z.ZodObject<{
    name: z.ZodString;
    cnpj: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    email: z.ZodNullable<z.ZodOptional<z.ZodEmail>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    legalRepresentativeName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    uf: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    municipalityId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    municipalityName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    coatOfArmsUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    acknowledgeCnpjDuplicate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const updateEntitySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    cnpj: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    email: z.ZodNullable<z.ZodOptional<z.ZodEmail>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    legalRepresentativeName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    uf: z.ZodNullable<z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    municipalityId: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    municipalityName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    coatOfArmsUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    acknowledgeCnpjDuplicate: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const updateEntityStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        ACTIVE: "ACTIVE";
        INACTIVE: "INACTIVE";
    }>;
}, z.core.$strip>;
export declare const listEntitiesQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        ACTIVE: "ACTIVE";
        INACTIVE: "INACTIVE";
    }>>;
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type CreateEntityRequest = z.infer<typeof createEntitySchema>;
export type UpdateEntityRequest = z.infer<typeof updateEntitySchema>;
//# sourceMappingURL=entity.schema.d.ts.map