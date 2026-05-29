import { AppError } from '../../shared/errors.js';
const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
/** Lists Brazilian states from IBGE */
export async function listStates() {
    const response = await fetch(`${IBGE_BASE}/estados?orderBy=nome`);
    if (!response.ok) {
        throw new AppError(502, 'EXTERNAL_API_ERROR', 'Falha ao consultar UFs');
    }
    const data = (await response.json());
    return data.map((state) => ({
        id: state.id,
        sigla: state.sigla,
        nome: state.nome,
    }));
}
/** Lists municipalities for a UF from IBGE */
export async function listMunicipalitiesByUf(uf) {
    const normalizedUf = uf.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedUf)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'UF inválida');
    }
    const response = await fetch(`${IBGE_BASE}/estados/${normalizedUf}/municipios?orderBy=nome`);
    if (!response.ok) {
        throw new AppError(502, 'EXTERNAL_API_ERROR', 'Falha ao consultar municípios');
    }
    const data = (await response.json());
    return data.map((municipality) => ({
        id: municipality.id,
        nome: municipality.nome,
    }));
}
//# sourceMappingURL=localities.service.js.map