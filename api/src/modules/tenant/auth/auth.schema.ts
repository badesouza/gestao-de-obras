import { z } from 'zod';

export const tenantLoginSchema = z.object({
  entityId: z.uuid(),
  email: z.email(),
  password: z.string().min(1),
});

export type TenantLoginRequest = z.infer<typeof tenantLoginSchema>;
