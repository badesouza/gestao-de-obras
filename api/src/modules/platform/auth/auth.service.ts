import bcrypt from 'bcryptjs';
import type { PrismaClient, Prisma } from '../../../../generated/prisma/index.js';
import { JWT_SCOPE_PLATFORM } from '../../../shared/constants.js';
import { AppError } from '../../../shared/errors.js';
import { writePlatformAudit } from '../audit/audit.service.js';
import type { LoginRequest } from './auth.schema.js';

export interface AuthResult {
  operator: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
}

/** Authenticates a platform operator by email and password */
export async function loginPlatformOperator(
  prisma: PrismaClient,
  input: LoginRequest,
  metadata?: Record<string, unknown>,
): Promise<{ operatorId: string; email: string; name: string }> {
  const operator = await prisma.platformOperator.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!operator || operator.status !== 'ACTIVE') {
    throw new AppError(401, 'UNAUTHORIZED', 'Credenciais inválidas');
  }

  const valid = await bcrypt.compare(input.password, operator.passwordHash);
  if (!valid) {
    await writePlatformAudit(prisma, {
      operatorId: operator.id,
      action: 'AUTH_LOGIN_FAILURE',
      resource: 'auth',
      metadata: { email: input.email, ...metadata } as Prisma.InputJsonValue,
    });
    throw new AppError(401, 'UNAUTHORIZED', 'Credenciais inválidas');
  }

  await writePlatformAudit(prisma, {
    operatorId: operator.id,
    action: 'AUTH_LOGIN_SUCCESS',
    resource: 'auth',
    metadata: metadata as Prisma.InputJsonValue | undefined,
  });

  return {
    operatorId: operator.id,
    email: operator.email,
    name: operator.name,
  };
}

/** Returns platform operator profile by id */
export async function getPlatformOperator(
  prisma: PrismaClient,
  operatorId: string,
) {
  const operator = await prisma.platformOperator.findUnique({
    where: { id: operatorId },
    select: { id: true, name: true, email: true, status: true },
  });
  if (!operator || operator.status !== 'ACTIVE') {
    throw new AppError(401, 'UNAUTHORIZED', 'Operador inválido');
  }
  return operator;
}

/** Records logout in audit trail */
export async function logoutPlatformOperator(
  prisma: PrismaClient,
  operatorId: string,
  metadata?: Record<string, unknown>,
) {
  await writePlatformAudit(prisma, {
    operatorId,
    action: 'AUTH_LOGOUT',
    resource: 'auth',
    metadata: metadata as Prisma.InputJsonValue | undefined,
  });
}

/** Builds JWT payload for platform scope */
export function buildPlatformTokenPayload(operatorId: string, email: string) {
  return {
    sub: operatorId,
    email,
    scope: JWT_SCOPE_PLATFORM,
  };
}

/** Hashes password for seed/scripts */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
