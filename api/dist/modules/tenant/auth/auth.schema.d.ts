import { z } from 'zod';
export declare const tenantLoginSchema: z.ZodObject<{
    entityId: z.ZodUUID;
    email: z.ZodEmail;
    password: z.ZodString;
}, z.core.$strip>;
export type TenantLoginRequest = z.infer<typeof tenantLoginSchema>;
//# sourceMappingURL=auth.schema.d.ts.map