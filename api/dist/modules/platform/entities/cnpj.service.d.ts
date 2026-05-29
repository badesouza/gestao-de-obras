export interface CnpjLookupResult {
    cnpj: string;
    name: string;
    tradeName: string | null;
    email: string | null;
    phone: string | null;
    legalRepresentativeName: string | null;
    uf: string | null;
    municipalityName: string | null;
    address: string | null;
}
/** Fetches company data from OpenCNPJ API */
export declare function lookupCnpj(rawCnpj: string): Promise<CnpjLookupResult>;
//# sourceMappingURL=cnpj.service.d.ts.map