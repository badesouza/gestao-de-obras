import { z } from 'zod';
export declare const loginRequestSchema: z.ZodObject<{
    email: z.ZodEmail;
    password: z.ZodString;
}, z.core.$strip>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
//# sourceMappingURL=auth.schema.d.ts.map