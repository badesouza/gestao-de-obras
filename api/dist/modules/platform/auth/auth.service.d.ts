import type { PrismaClient } from '../../../../generated/prisma/index.js';
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
export declare function loginPlatformOperator(prisma: PrismaClient, input: LoginRequest, metadata?: Record<string, unknown>): Promise<{
    operatorId: string;
    email: string;
    name: string;
}>;
/** Returns platform operator profile by id */
export declare function getPlatformOperator(prisma: PrismaClient, operatorId: string): Promise<{
    id: string;
    name: string;
    email: string;
    status: import("../../../../generated/prisma/index.js").$Enums.OperatorStatus;
}>;
/** Records logout in audit trail */
export declare function logoutPlatformOperator(prisma: PrismaClient, operatorId: string, metadata?: Record<string, unknown>): Promise<void>;
/** Builds JWT payload for platform scope */
export declare function buildPlatformTokenPayload(operatorId: string, email: string): {
    sub: string;
    email: string;
    scope: string;
};
/** Hashes password for seed/scripts */
export declare function hashPassword(password: string): Promise<string>;
//# sourceMappingURL=auth.service.d.ts.map