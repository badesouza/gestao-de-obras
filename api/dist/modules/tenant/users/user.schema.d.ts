import { z } from 'zod';
export declare const createTenantUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodEmail;
    password: z.ZodString;
    roleCode: z.ZodEnum<{
        ADMIN: "ADMIN";
        ENGINEER: "ENGINEER";
        OPERATOR: "OPERATOR";
    }>;
}, z.core.$strip>;
export declare const updateTenantUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    roleCode: z.ZodOptional<z.ZodEnum<{
        ADMIN: "ADMIN";
        ENGINEER: "ENGINEER";
        OPERATOR: "OPERATOR";
    }>>;
    isLiderEquipe: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const updateTenantUserStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        ACTIVE: "ACTIVE";
        INACTIVE: "INACTIVE";
    }>;
}, z.core.$strip>;
export declare const resetTenantUserPasswordSchema: z.ZodObject<{
    password: z.ZodString;
}, z.core.$strip>;
export declare const bootstrapAdminSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodEmail;
    password: z.ZodString;
}, z.core.$strip>;
export type CreateTenantUserRequest = z.infer<typeof createTenantUserSchema>;
export type UpdateTenantUserRequest = z.infer<typeof updateTenantUserSchema>;
export type BootstrapAdminRequest = z.infer<typeof bootstrapAdminSchema>;
//# sourceMappingURL=user.schema.d.ts.map