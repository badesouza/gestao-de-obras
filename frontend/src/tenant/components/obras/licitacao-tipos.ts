import type { TipoLicitacao } from '../../../lib/api-client';

/* Tipos de licitação (ícone e cor de cada um) */
export const TIPOS: Record<TipoLicitacao, { rotulo: string; desc: string; cor: string; icone: string }> = {
  MATERIAL:    { rotulo: 'Material',    desc: 'Consumo: areia, cimento, lâmpadas…', cor: '#2563EB', icone: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.3 7L12 12l8.7-5M12 22V12' },
  SERVICO:     { rotulo: 'Serviço',     desc: 'Mão de obra, locação de máquinas…',  cor: '#7C3AED', icone: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
  COMBUSTIVEL: { rotulo: 'Combustível', desc: 'Diesel, gasolina, lubrificantes',    cor: '#EA580C', icone: 'M3 22h12M4 9h10M14 22V4a2 2 0 00-2-2H6a2 2 0 00-2 2v18M14 13h2a2 2 0 012 2v2a2 2 0 002 2 2 2 0 002-2V9.83a2 2 0 00-.59-1.42L18 5' },
  OBRA:        { rotulo: 'Obra',        desc: 'Construção ou reforma contratada',   cor: '#0F766E', icone: 'M2 20h20M5 20V8l7-5 7 5v12M9 20v-6h6v6' },
};
