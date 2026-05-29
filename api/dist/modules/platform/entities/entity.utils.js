import { AppError } from '../../../shared/errors.js';
/** Builds tenant login path using entity UUID */
export function buildTenantAccessUrl(entityId) {
    return `/t/${entityId}/login`;
}
/** Validates Brazilian CNPJ checksum when provided */
export function validateCnpj(cnpj) {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14 || /^(\d)\1+$/.test(digits))
        return false;
    const calc = (base, weights) => {
        const sum = base
            .split('')
            .reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
        const rest = sum % 11;
        return rest < 2 ? 0 : 11 - rest;
    };
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const d1 = calc(digits.slice(0, 12), w1);
    const d2 = calc(digits.slice(0, 12) + d1, w2);
    return digits.endsWith(`${d1}${d2}`);
}
/** Strips non-digits from CNPJ */
export function sanitizeCnpj(cnpj) {
    if (!cnpj)
        return null;
    const digits = cnpj.replace(/\D/g, '');
    return digits.length ? digits : null;
}
/** Strips non-digits from phone */
export function sanitizePhone(phone) {
    if (!phone)
        return null;
    const digits = phone.replace(/\D/g, '');
    return digits.length ? digits : null;
}
/** Validates UF code */
export function validateUf(uf) {
    if (!uf)
        return;
    if (!/^[A-Z]{2}$/.test(uf)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'UF inválida', { uf });
    }
}
//# sourceMappingURL=entity.utils.js.map