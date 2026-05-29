/** Lists Brazilian states from IBGE */
export declare function listStates(): Promise<{
    id: number;
    sigla: string;
    nome: string;
}[]>;
/** Lists municipalities for a UF from IBGE */
export declare function listMunicipalitiesByUf(uf: string): Promise<{
    id: number;
    nome: string;
}[]>;
//# sourceMappingURL=localities.service.d.ts.map