/** Builds tenant login path using entity UUID */
export declare function buildTenantAccessUrl(entityId: string): string;
/** Validates Brazilian CNPJ checksum when provided */
export declare function validateCnpj(cnpj: string): boolean;
/** Strips non-digits from CNPJ */
export declare function sanitizeCnpj(cnpj: string | null | undefined): string | null;
/** Strips non-digits from phone */
export declare function sanitizePhone(phone: string | null | undefined): string | null;
/** Validates UF code */
export declare function validateUf(uf: string | null | undefined): void;
//# sourceMappingURL=entity.utils.d.ts.map