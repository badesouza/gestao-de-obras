import { CENTRO_IDS, SERVICOS_CONFIG, type ServicoConfig } from '../../pages/servico-config';

/* ── Problemas como o cidadão fala, ligados ao serviço que resolve ── */

export interface CategoriaCidadao {
  slug: string;
  nome: string;
  dica: string;
  servicoSlug: string | null;
}

export const CATEGORIAS_CIDADAO: CategoriaCidadao[] = [
  { slug: 'tapa-buracos',     nome: 'Buraco na rua',       dica: 'Asfalto quebrado ou cratera',      servicoSlug: 'tapa-buracos' },
  { slug: 'rocagem',          nome: 'Mato alto',           dica: 'Terreno, canteiro ou calçada',     servicoSlug: 'rocagem' },
  { slug: 'coleta-entulhos',  nome: 'Entulho acumulado',   dica: 'Restos de obra, lixo grande',      servicoSlug: 'coleta-entulhos' },
  { slug: 'iluminacao',       nome: 'Lâmpada apagada',     dica: 'Poste sem luz ou piscando',        servicoSlug: 'iluminacao' },
  { slug: 'poda-arvores',     nome: 'Árvore ou galho',     dica: 'Poda, galho caído ou perigoso',    servicoSlug: 'poda-arvores' },
  { slug: 'varricao',         nome: 'Rua suja',            dica: 'Varrição e limpeza da via',        servicoSlug: 'varricao' },
  { slug: 'encascalhamento',  nome: 'Estrada de terra',    dica: 'Buraco e lama na zona rural',      servicoSlug: 'encascalhamento' },
  { slug: 'pracas-jardins',   nome: 'Praça ou jardim',     dica: 'Manutenção de praças',             servicoSlug: 'pracas-jardins' },
  { slug: 'construcao-civil', nome: 'Calçada ou meio-fio', dica: 'Calçada quebrada, obra parada',    servicoSlug: 'construcao-civil' },
  { slug: 'pintura',          nome: 'Faixa ou pintura',    dica: 'Faixa de pedestre apagada',        servicoSlug: 'pintura' },
  { slug: 'outro',            nome: 'Outro problema',      dica: 'Algo que não está na lista',       servicoSlug: null },
];

const ICONE_OUTRO = 'M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01';

export function categoriaPorSlug(slug: string): CategoriaCidadao | undefined {
  return CATEGORIAS_CIDADAO.find(c => c.slug === slug);
}

export function servicoDaCategoria(slug: string): ServicoConfig | undefined {
  const c = categoriaPorSlug(slug);
  return c?.servicoSlug ? SERVICOS_CONFIG[c.servicoSlug] : undefined;
}

export function centroDaCategoria(slug: string): string | undefined {
  const c = categoriaPorSlug(slug);
  return c?.servicoSlug ? CENTRO_IDS[c.servicoSlug] : undefined;
}

export const corDaCategoria = (slug: string) => servicoDaCategoria(slug)?.cor ?? '#64748b';

/** Caminho SVG do ícone (para desenhar em qualquer tamanho) */
export const iconeDaCategoria = (slug: string) => servicoDaCategoria(slug)?.iconPath ?? ICONE_OUTRO;
