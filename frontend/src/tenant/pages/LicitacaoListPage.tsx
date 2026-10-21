import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tenantApi, type Licitacao } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';
import { Kpi, KpiCarregando } from '../components/obras/ui';
import { dataBr } from '../components/obras/util';
import { TIPOS } from '../components/obras/licitacao-tipos';
import '../styles/compras-ui.css';
import '../styles/orcamento.css';
import '../styles/licitacao.css';

/* ── Licitações: cada uma com seus contratos e a vigência ── */

type Filtro = 'TODAS' | 'VENCENDO' | 'VENCIDOS' | 'SEM_CONTRATO' | 'INATIVAS';

export function LicitacaoListPage() {
  const { entityId } = useTenant();
  const navigate = useNavigate();
  const podeGerir = useTenantPermission('licitacoes.manage');
  const [lista, setLista] = useState<Licitacao[] | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODAS');

  useEffect(() => {
    tenantApi.licitacoes.list(entityId, new URLSearchParams({ pageSize: '100' }))
      .then(r => setLista(r.items)).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
  }, [entityId]);

  const itens = useMemo(() => lista ?? [], [lista]);
  const ativas = itens.filter(l => l.status === 'ACTIVE');
  const regra: Record<Filtro, (l: Licitacao) => boolean> = {
    TODAS: l => l.status === 'ACTIVE',
    VENCENDO: l => l.status === 'ACTIVE' && !!l.contratos?.vencendo,
    VENCIDOS: l => l.status === 'ACTIVE' && !!l.contratos?.vencidos,
    SEM_CONTRATO: l => l.status === 'ACTIVE' && !l.contratos?.total,
    INATIVAS: l => l.status !== 'ACTIVE',
  };
  const termo = busca.trim().toLowerCase();
  const visiveis = itens.filter(l => regra[filtro](l) && (!termo ||
    [l.identificacao, l.objeto, l.numeroProcesso ?? '', l.modalidade ?? '', ...(l.contratos?.fornecedores ?? [])].some(t => t.toLowerCase().includes(termo))));
  const soma = (k: 'vigentes' | 'vencendo' | 'vencidos') => ativas.reduce((t, l) => t + (l.contratos?.[k] ?? 0), 0);
  const FILTROS: { id: Filtro; rotulo: string; cor: string }[] = [
    { id: 'TODAS', rotulo: 'Ativas', cor: 'var(--ob-blue)' },
    { id: 'VENCENDO', rotulo: 'Vencendo', cor: 'var(--ob-amber)' },
    { id: 'VENCIDOS', rotulo: 'Com contrato vencido', cor: 'var(--ob-rose)' },
    { id: 'SEM_CONTRATO', rotulo: 'Sem contrato', cor: '#A8A29E' },
    { id: 'INATIVAS', rotulo: 'Desativadas', cor: 'var(--ob-faint)' },
  ];

  return (
    <div className="ob-page ob-claro lc-pagina" style={{ '--serv-cor': '#2563EB' } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>
          </span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv">Gestão contratual</span>
            <h1 className="ob-h1">Licitações</h1>
            <p className="ob-sub">Licitação → contratos → lotes → itens. Contrato vencido não aceita compras novas.</p>
          </div>
        </div>
        {podeGerir && (
          <div className="ob-head-acoes">
            <button type="button" className="ob-btn" onClick={() => navigate(`/t/${entityId}/licitacoes/new`)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nova licitação
            </button>
          </div>
        )}
      </header>

      <section className="ob-kpis" aria-label="Resumo">
        {!lista ? [1, 2, 3, 4].map(n => <KpiCarregando key={n} />) : <>
          <Kpi i={1} rotulo="Licitações ativas" valor={ativas.length} cor="var(--ob-blue)" nota={`${itens.length - ativas.length} desativadas`} tom="neutro" grafico={null} />
          <Kpi i={2} rotulo="Contratos vigentes" valor={soma('vigentes')} cor="var(--ob-green)" nota="dá para comprar" tom="neutro" grafico={null} />
          <Kpi i={3} rotulo="Vencem em 30 dias" valor={soma('vencendo')} cor="var(--ob-amber)" nota={soma('vencendo') ? 'providencie o aditivo de prazo' : 'nenhum perto de vencer'} tom={soma('vencendo') ? 'alerta' : 'neutro'} grafico={null} />
          <Kpi i={4} rotulo="Contratos vencidos" valor={soma('vencidos')} cor="var(--ob-rose)" nota={soma('vencidos') ? 'compras bloqueadas' : 'tudo em dia'} tom={soma('vencidos') ? 'ruim' : 'neutro'} grafico={null} />
        </>}
      </section>

      <section className="ob-card ob-reveal" style={{ '--i': 5 } as React.CSSProperties} aria-label="Licitações">
        <div className="ob-filtros">
          <div className="ob-chips" role="group" aria-label="Filtrar">
            {FILTROS.map(f => {
              const n = itens.filter(regra[f.id]).length;
              if (!n && f.id !== 'TODAS') return null;
              return <button key={f.id} type="button" className={`ob-chip${filtro === f.id ? ' is-ativo' : ''}`} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}><i style={{ background: f.cor }} />{f.rotulo}<span>{n}</span></button>;
            })}
          </div>
          <label className="ob-busca">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>
            <span className="ob-sr">Buscar</span>
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nº, objeto, P.A. ou fornecedor" />
          </label>
        </div>

        {erro && <div className="ob-erro" style={{ margin: '0 16px 12px' }}>{erro}</div>}
        {!lista && !erro && <div className="lc-lista">{[1, 2, 3].map(n => <span key={n} className="ob-skeleton" style={{ height: 170, borderRadius: 20 }} />)}</div>}
        {lista && visiveis.length === 0 && <p className="ob-vazio" style={{ padding: '8px 20px 24px' }}>{itens.length ? 'Nenhuma licitação com esse filtro.' : 'Nenhuma licitação cadastrada ainda.'}</p>}

        {visiveis.length > 0 && (
          <div className="lc-lista">
            {visiveis.map((l, idx) => {
              const t = l.tipo ? TIPOS[l.tipo] : null;
              const c = l.contratos;
              return (
                <Link key={l.id} to={`/t/${entityId}/licitacoes/${l.id}`} className={`lc-cartao ob-reveal${l.status !== 'ACTIVE' ? ' is-inativa' : ''}`}
                  style={{ '--i': Math.min(idx, 12), '--tipo-cor': t?.cor ?? '#2563EB' } as React.CSSProperties}>
                  <span className="lc-cartao-mod">{[t?.rotulo, l.modalidade].filter(Boolean).join(' · ') || 'Licitação'}</span>
                  <span className="lc-cartao-topo">
                    <span className="lc-cartao-num">{l.identificacao}</span>
                    {c?.vencidos ? <span className="ob-badge is-atrasada"><i />{c.vencidos} vencido{c.vencidos > 1 ? 's' : ''}</span> : null}
                    {c?.vencendo ? <span className="ob-badge is-execucao"><i />vence logo</span> : null}
                  </span>
                  <span className="lc-cartao-obj">{l.objeto}</span>
                  {c?.fornecedores.length ? <span className="lc-cartao-forn">{c.fornecedores.join(' · ')}</span> : l.fornecedor ? <span className="lc-cartao-forn">{l.fornecedor.razaoSocial}</span> : null}
                  <span className="lc-cartao-rodape">
                    <span className="lc-cartao-contratos">{c?.total ? `${c.total} contrato${c.total > 1 ? 's' : ''} · ${l.activeItemCount} itens` : `Sem contrato · ${l.activeItemCount} itens`}</span>
                    <span>{c?.proximoVencimento ? `vigência até ${dataBr(c.proximoVencimento)}` : l.numeroProcesso ? `P.A. ${l.numeroProcesso}` : ''}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
