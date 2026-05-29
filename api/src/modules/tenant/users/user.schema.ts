import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8)
  .refine(
    (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
    'Senha deve conter ao menos uma letra e um número',
  );

export const createTenantUserSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.email(),
  password: passwordSchema,
  roleCode: z.enum(['ADMIN', 'ENGINEER', 'OPERATOR']),
});

export const updateTenantUserSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  roleCode: z.enum(['ADMIN', 'ENGINEER', 'OPERATOR']).optional(),
});

export const updateTenantUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const resetTenantUserPasswordSchema = z.object({
  password: passwordSchema,
});

export const bootstrapAdminSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.email(),
  password: passwordSchema,
});

export type CreateTenantUserRequest = z.infer<typeof createTenantUserSchema>;
export type UpdateTenantUserRequest = z.infer<typeof updateTenantUserSchema>;
export type BootstrapAdminRequest = z.infer<typeof bootstrapAdminSchema>;
