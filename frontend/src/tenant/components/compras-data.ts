import type { ServicoConfig } from '../pages/servico-config';
import { SERVICOS_CONFIG } from '../pages/servico-config';

export type SolicitacaoStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'CONSOLIDATED';
export type PedidoStatus = 'READY' | 'SENT' | 'PARTIAL';

export interface CompraItem {
  id: string;
  licitacaoItemId: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
}

export interface SolicitacaoServico {
  id: string;
  numero: string;
  servicoSlug: string;
  licitacao: string;
  status: SolicitacaoStatus;
  prioridade: 'Alta' | 'Media' | 'Baixa';
  data: string;
  responsavel: string;
  justificativa: string;
  itens: CompraItem[];
}

export interface PedidoCompra {
  numero: string;
  status: PedidoStatus;
  enviadoEm: string;
  recebimentos: Record<string, number>;
}

export const SOLICITACOES_DEMO: SolicitacaoServico[] = [
  {
    id: 'sol-001',
    numero: 'SS-2026-018',
    servicoSlug: 'pintura',
    licitacao: 'Pregao 014/2026 - Materiais de pintura',
    status: 'APPROVED',
    prioridade: 'Alta',
    data: '2026-06-02',
    responsavel: 'Coord. Pintura',
    justificativa: 'Reposicao para faixas, meio-fio e predios publicos programados para junho.',
    itens: [
      { id: 'item-101', licitacaoItemId: 'lic-tinta-viaria', descricao: 'Tinta viaria branca 18L', unidade: 'balde', quantidade: 24, valorUnitario: 182 },
      { id: 'item-102', licitacaoItemId: 'lic-rolo', descricao: 'Rolo de pintura profissional', unidade: 'un', quantidade: 16, valorUnitario: 28 },
    ],
  },
  {
    id: 'sol-002',
    numero: 'SS-2026-019',
    servicoSlug: 'construcao-civil',
    licitacao: 'Pregao 009/2026 - Insumos de obras',
    status: 'APPROVED',
    prioridade: 'Media',
    data: '2026-06-02',
    responsavel: 'Eng. Obras',
    justificativa: 'Material previsto para reparo de calcadas e pequenas drenagens.',
    itens: [
      { id: 'item-201', licitacaoItemId: 'lic-cimento', descricao: 'Cimento CP II 50kg', unidade: 'saco', quantidade: 80, valorUnitario: 38 },
      { id: 'item-202', licitacaoItemId: 'lic-areia', descricao: 'Areia lavada', unidade: 'm3', quantidade: 12, valorUnitario: 120 },
    ],
  },
  {
    id: 'sol-003',
    numero: 'SS-2026-020',
    servicoSlug: 'pracas-jardins',
    licitacao: 'Pregao 009/2026 - Insumos de obras',
    status: 'APPROVED',
    prioridade: 'Media',
    data: '2026-06-01',
    responsavel: 'Coord. Pracas',
    justificativa: 'Reforco de materiais para manutencao de canteiros e pequenas bases.',
    itens: [
      { id: 'item-301', licitacaoItemId: 'lic-cimento', descricao: 'Cimento CP II 50kg', unidade: 'saco', quantidade: 30, valorUnitario: 38 },
      { id: 'item-302', licitacaoItemId: 'lic-muda', descricao: 'Muda ornamental porte medio', unidade: 'un', quantidade: 42, valorUnitario: 17 },
    ],
  },
  {
    id: 'sol-004',
    numero: 'SS-2026-021',
    servicoSlug: 'iluminacao',
    licitacao: 'Pregao 021/2026 - Eletrica e iluminacao',
    status: 'SUBMITTED',
    prioridade: 'Alta',
    data: '2026-05-31',
    responsavel: 'Coord. Iluminacao',
    justificativa: 'Trocas de luminarias nos bairros Centro, Urbis e Primavera.',
    itens: [
      { id: 'item-401', licitacaoItemId: 'lic-luminaria-led', descricao: 'Luminaria LED publica 150W', unidade: 'un', quantidade: 55, valorUnitario: 315 },
    ],
  },
  {
    id: 'sol-005',
    numero: 'SS-2026-022',
    servicoSlug: 'oficina',
    licitacao: 'Pregao 006/2026 - Pecas e filtros',
    status: 'DRAFT',
    prioridade: 'Baixa',
    data: '2026-05-30',
    responsavel: 'Oficina',
    justificativa: 'Reposicao preventiva para frota pesada.',
    itens: [
      { id: 'item-501', licitacaoItemId: 'lic-filtro-oleo', descricao: 'Filtro de oleo diesel', unidade: 'un', quantidade: 18, valorUnitario: 46 },
    ],
  },
];

export const PEDIDO_DEMO: PedidoCompra = {
  numero: 'PC-2026-007',
  status: 'PARTIAL',
  enviadoEm: '2026-06-02',
  recebimentos: {
    'lic-cimento': 88,
    'lic-tinta-viaria': 18,
  },
};

export function dinheiro(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function totalSolicitacao(solicitacao: SolicitacaoServico): number {
  return solicitacao.itens.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0);
}

export function getServico(slug: string): ServicoConfig {
  return SERVICOS_CONFIG[slug] ?? {
    slug,
    nome: slug,
    descricao: '',
    cor: '#2563eb',
    icon: null,
    iconPath: '',
    camposPrincipais: [],
    campos: [],
  };
}

export function consolidarSolicitacoes(solicitacoes: SolicitacaoServico[]) {
  const mapa = new Map<string, {
    licitacaoItemId: string;
    descricao: string;
    unidade: string;
    quantidadeTotal: number;
    valorUnitario: number;
    origens: Array<{ servicoSlug: string; numero: string; quantidade: number }>;
  }>();

  solicitacoes.forEach((solicitacao) => {
    solicitacao.itens.forEach((item) => {
      const atual = mapa.get(item.licitacaoItemId);
      if (!atual) {
        mapa.set(item.licitacaoItemId, {
          licitacaoItemId: item.licitacaoItemId,
          descricao: item.descricao,
          unidade: item.unidade,
          quantidadeTotal: item.quantidade,
          valorUnitario: item.valorUnitario,
          origens: [{ servicoSlug: solicitacao.servicoSlug, numero: solicitacao.numero, quantidade: item.quantidade }],
        });
        return;
      }
      atual.quantidadeTotal += item.quantidade;
      atual.origens.push({ servicoSlug: solicitacao.servicoSlug, numero: solicitacao.numero, quantidade: item.quantidade });
    });
  });

  return Array.from(mapa.values());
}
