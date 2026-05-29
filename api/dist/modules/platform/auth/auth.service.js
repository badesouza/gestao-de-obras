import bcrypt from 'bcryptjs';
import { JWT_SCOPE_PLATFORM } from '../../../shared/constants.js';
import { AppError } from '../../../shared/errors.js';
import { writePlatformAudit } from '../audit/audit.service.js';
/** Authenticates a platform operator by email and password */
export async function loginPlatformOperator(prisma, input, metadata) {
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
            metadata: { email: input.email, ...metadata },
        });
        throw new AppError(401, 'UNAUTHORIZED', 'Credenciais inválidas');
    }
    await writePlatformAudit(prisma, {
        operatorId: operator.id,
        action: 'AUTH_LOGIN_SUCCESS',
        resource: 'auth',
        metadata: metadata,
    });
    return {
        operatorId: operator.id,
        email: operator.email,
        name: operator.name,
    };
}
/** Returns platform operator profile by id */
export async function getPlatformOperator(prisma, operatorId) {
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
export async function logoutPlatformOperator(prisma, operatorId, metadata) {
    await writePlatformAudit(prisma, {
        operatorId,
        action: 'AUTH_LOGOUT',
        resource: 'auth',
        metadata: metadata,
    });
}
/** Builds JWT payload for platform scope */
export function buildPlatformTokenPayload(operatorId, email) {
    return {
        sub: operatorId,
        email,
        scope: JWT_SCOPE_PLATFORM,
    };
}
/** Hashes password for seed/scripts */
export async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}
//# sourceMappingURL=auth.service.js.map