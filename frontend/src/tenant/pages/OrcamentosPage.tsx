import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ApiError, cadastrosAuxiliaresApi, centrosDeCustoApi, orcamentosApi, tenantApi,
  type AcaoOrcamento, type BairroCoord, type CentroDeCusto, type DadosOrcamento, type Orcamento,
  type OrcamentoResumo, type OrcamentoStatus, type ResumoOrcamentos, type SaldoLicitacao,
} from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';
import { Dialogo, Kpi, KpiCarregando } from '../components/obras/ui';
import { haQuanto, nomeCurto, useFotoUrl } from '../components/obras/util';
import { CENTRO_IDS, SERVICOS_CONFIG } from './servico-config';
import { CameraCarimbo, type LocalFoto } from '../components/camera/CameraCarimbo';
import { bairroMaisProximoLocal } from '../components/camera/carimbo';
import '../styles/compras-ui.css';
import '../styles/orcamento.css';

/* ── Orçamentação ────────────────────────────────────────────────
   Fotografa o local (com carimbo), lista o material dos contratos —
   cada linha com seu serviço e seu centro de custo — e manda para
   revisão e aprovação. Aprovado, vira pedido de compra.             */

const ETAPA: Record<OrcamentoStatus, { rotulo: string; classe: string; cor: string }> = {
  RASCUNHO:             { rotulo: 'Rascunho',              classe: 'is-rascunho',  cor: '#A8A29E' },
  EM_REVISAO:           { rotulo: 'Em revisão',            classe: 'is-execucao',  cor: 'var(--ob-amber)' },
  AGUARDANDO_APROVACAO: { rotulo: 'Aguardando aprovação',  classe: 'is-aprovacao', cor: 'var(--ob-violeta)' },
  APROVADO:             { rotulo: 'Aprovado · gerar pedido', classe: 'is-aberta',  cor: 'var(--ob-blue)' },
  CONVERTIDO:           { rotulo: 'Virou pedido',          classe: 'is-concluida', cor: 'var(--ob-green)' },
  CANCELADO:            { rotulo: 'Cancelado',             classe: 'is-cancelada', cor: 'var(--ob-faint)' },
};
const MOTIVOS = ['Quantidade acima do necessário', 'Faltam fotos do local', 'Material errado para o serviço', 'Centro de custo errado'];
const SERVICOS = Object.values(SERVICOS_CONFIG);
const COR_PADRAO = '#0F766E';

const real = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v: string | number) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const dataCurta = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
const msgErro = (e: unknown) => e instanceof ApiError ? e.body.message : e instanceof Error ? e.message : 'Não foi possível concluir';
const corDoServico = (slug?: string | null) => (slug && SERVICOS_CONFIG[slug]?.cor) || COR_PADRAO;

function IconeServico({ slug, tamanho = 18 }: { slug?: string | null; tamanho?: number }) {
  const s = slug ? SERVICOS_CONFIG[slug] : undefined;
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={s?.iconPath ?? 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h5'} />
    </svg>
  );
}

function Passos({ o }: { o: Pick<OrcamentoResumo, 'status' | 'criadoPor' | 'criadoEm' | 'revisadoEm' | 'revisadoPor' | 'aprovadoEm' | 'aprovadoPor' | 'convertidoEm'> }) {
  const ordem: OrcamentoStatus[] = ['RASCUNHO', 'EM_REVISAO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'CONVERTIDO'];
  const pos = ordem.indexOf(o.status);
  const passos = [
    { nome: 'Lançado', feito: true, info: `${nomeCurto(o.criadoPor)} · ${dataCurta(o.criadoEm)}` },
    { nome: 'Revisado', feito: !!o.revisadoEm || pos >= 3, info: o.revisadoPor ? `${nomeCurto(o.revisadoPor)} · ${dataCurta(o.revisadoEm)}` : '' },
    { nome: 'Aprovado', feito: !!o.aprovadoEm, info: o.aprovadoPor ? `${nomeCurto(o.aprovadoPor)} · ${dataCurta(o.aprovadoEm)}` : '' },
    { nome: 'Pedido', feito: o.status === 'CONVERTIDO', info: dataCurta(o.convertidoEm) },
  ];
  const atual = o.status === 'CANCELADO' ? -1 : passos.findIndex(x => !x.feito);
  return (
    <ol className="cp-passos" aria-label="Andamento do orçamento">
      {passos.map((x, i) => (
        <li key={x.nome} className={`${x.feito ? 'is-feito' : ''}${i === atual ? ' is-atual' : ''}`} title={x.info || undefined}>
          <i /><span>{x.nome}</span>{x.info && <small>{x.info}</small>}
        </li>
      ))}
    </ol>
  );
}

function Capa({ entityId, fotoId, slug }: { entityId: string; fotoId: string | null; slug: string | null }) {
  const url = useFotoUrl(entityId, fotoId, 'orcamento');
  const [quebrada, setQuebrada] = useState<string | null>(null);
  return (
    <span className="or-capa" style={{ '--serv-cor': corDoServico(slug) } as React.CSSProperties}>
      {url && quebrada !== url
        ? <img src={url} alt="" loading="lazy" onError={() => setQuebrada(url)} />
        : <span className="or-capa-vazia"><IconeServico slug={slug} tamanho={34} /><small>{fotoId && !url ? 'carregando…' : 'sem foto'}</small></span>}
    </span>
  );
}

/* ═════════════════════════ LISTA ═════════════════════════ */

type Filtro = 'TODOS' | OrcamentoStatus;

export function OrcamentosPage() {
  const { entityId, session } = useTenant();
  const navigate = useNavigate();
  const podeLancar = useTenantPermission('centros_custo.manage');
  const { podeRevisarCompra, podeAprovarCompra, exigeAprovacaoCompra } = session.obras;
  const [lista, setLista] = useState<OrcamentoResumo[] | null>(null);
  const [resumo, setResumo] = useState<ResumoOrcamentos | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    Promise.all([orcamentosApi.listar(entityId), orcamentosApi.resumo(entityId)])
      .then(([l, r]) => { setLista(l); setResumo(r); })
      .catch(e => setErro(msgErro(e)));
  }, [entityId]);

  const itens = lista ?? [];
  const conta = (s: OrcamentoStatus) => itens.filter(o => o.status === s).length;
  const termo = busca.trim().toLowerCase();
  const visiveis = itens.filter(o => (filtro === 'TODOS' || o.status === filtro) &&
    (!termo || [o.numero, o.titulo, o.bairro ?? '', o.servicoNome ?? '', o.centroDeCusto?.codigo ?? '', o.criadoPor].some(t => t.toLowerCase().includes(termo))));
  const devolvidos = itens.filter(o => o.status === 'RASCUNHO' && o.devolvidoMotivo).length;
  const FILTROS: Filtro[] = ['TODOS', 'RASCUNHO', 'EM_REVISAO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'CONVERTIDO', 'CANCELADO'];

  return (
    <div className="ob-page ob-claro or-pagina" style={{ '--serv-cor': COR_PADRAO } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone"><IconeServico tamanho={30} /></span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv">Orçamentação</span>
            <h1 className="ob-h1">Orçamentos</h1>
            <p className="ob-sub">Fotografe o local, liste o material dos contratos e envie para aprovação. Aprovado, vira pedido de compra.</p>
          </div>
        </div>
        <div className="ob-head-acoes">
          <Link to={`/t/${entityId}/saldos`} className="ob-btn-ghost ob-btn-alto">Saldos dos contratos</Link>
          {podeLancar && (
            <button type="button" className="ob-btn" onClick={() => navigate(`/t/${entityId}/orcamentos/novo`)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Novo orçamento
            </button>
          )}
        </div>
      </header>

      <section className="ob-kpis" aria-label="Resumo">
        {!resumo ? [1, 2, 3, 4].map(n => <KpiCarregando key={n} />) : (
          <>
            <Kpi i={1} rotulo="Em revisão" valor={resumo.emRevisao} cor="var(--ob-amber)"
              nota={resumo.emRevisao ? (podeRevisarCompra ? 'esperando a sua revisão' : 'com os revisores') : 'nada para revisar'}
              tom={resumo.emRevisao && podeRevisarCompra ? 'alerta' : 'neutro'} grafico={null} />
            <Kpi i={2} rotulo="Aguardando aprovação" valor={resumo.aguardandoAprovacao} cor="var(--ob-violeta)"
              nota={resumo.aguardandoAprovacao ? (podeAprovarCompra ? 'esperando a sua aprovação' : 'com quem aprova') : 'nada para aprovar'}
              tom={resumo.aguardandoAprovacao && podeAprovarCompra ? 'alerta' : 'neutro'} grafico={null} />
            <Kpi i={3} rotulo="Aprovados" valor={resumo.aprovados} cor="var(--ob-blue)"
              nota={devolvidos ? `${devolvidos} ${devolvidos === 1 ? 'devolvido' : 'devolvidos'} para corrigir` : resumo.aprovados ? 'prontos para virar pedido' : `${resumo.convertidos} já viraram pedido`}
              tom={devolvidos ? 'ruim' : 'neutro'} grafico={null} />
            <div className="ob-kpi ob-reveal" style={{ '--i': 4, '--kpi-cor': COR_PADRAO } as React.CSSProperties}>
              <span className="ob-kpi-rotulo">Em orçamento</span>
              <div className="ob-kpi-linha"><span className="ob-kpi-valor cp-kpi-dinheiro">{real(resumo.valorEmAberto)}</span></div>
              <div className="ob-kpi-rodape"><span className="ob-kpi-nota tom-neutro">{real(resumo.valorConvertidoMes)} viraram pedido este mês</span></div>
            </div>
          </>
        )}
      </section>

      <section className="ob-card ob-reveal" style={{ '--i': 5 } as React.CSSProperties} aria-label="Orçamentos">
        <div className="ob-filtros">
          <div className="ob-chips" role="group" aria-label="Filtrar por etapa">
            {FILTROS.map(f => {
              const n = f === 'TODOS' ? itens.length : conta(f);
              if (n === 0 && !['TODOS', 'EM_REVISAO', 'AGUARDANDO_APROVACAO'].includes(f)) return null;
              return (
                <button key={f} type="button" className={`ob-chip${filtro === f ? ' is-ativo' : ''}`} onClick={() => setFiltro(f)} aria-pressed={filtro === f}>
                  <i style={{ background: f === 'TODOS' ? 'var(--ob-faint)' : ETAPA[f].cor }} />{f === 'TODOS' ? 'Todos' : ETAPA[f].rotulo.split(' · ')[0]}<span>{n}</span>
                </button>
              );
            })}
          </div>
          <label className="ob-busca">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>
            <span className="ob-sr">Buscar</span>
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nº, local, serviço ou centro" />
          </label>
        </div>

        {erro && <div className="ob-erro" style={{ margin: '0 16px 12px' }}>{erro}</div>}
        {!lista && !erro && <div className="or-grade">{[1, 2, 3].map(n => <span key={n} className="ob-skeleton" style={{ height: 300, borderRadius: 20 }} />)}</div>}
        {lista && visiveis.length === 0 && (
          <div className="or-vazio">
            <IconeServico tamanho={40} />
            <strong>{itens.length ? 'Nenhum orçamento com esse filtro.' : 'Nenhum orçamento ainda.'}</strong>
            {!itens.length && <span>Comece pelo local: tire as fotos, depois escolha o material dos contratos.</span>}
            {!itens.length && podeLancar && <button type="button" className="ob-btn" onClick={() => navigate(`/t/${entityId}/orcamentos/novo`)}>Fazer o primeiro orçamento</button>}
          </div>
        )}

        {visiveis.length > 0 && (
          <div className="or-grade">
            {visiveis.map((o, idx) => {
              const et = ETAPA[o.status];
              const devolvido = o.status === 'RASCUNHO' && !!o.devolvidoMotivo;
              return (
                <Link key={o.id} to={`/t/${entityId}/orcamentos/${o.id}`}
                  className={`or-cartao ob-reveal${devolvido ? ' is-devolvido' : ''}${o.status === 'CANCELADO' ? ' is-cancelado' : ''}`}
                  style={{ '--i': Math.min(idx, 12), '--serv-cor': corDoServico(o.servicoSlug) } as React.CSSProperties}>
                  <span className="or-cartao-foto">
                    <Capa entityId={entityId} fotoId={o.capaFotoId} slug={o.servicoSlug} />
                    <span className="or-numero">{o.numero}</span>
                    {o.qtdFotos > 1 && <span className="or-qtd-fotos">{o.qtdFotos} fotos</span>}
                  </span>
                  <span className="or-cartao-corpo">
                    <span className="cp-topo">
                      <span className={`ob-badge ${et.classe}`}><i />{et.rotulo}</span>
                      {devolvido && <span className="ob-badge is-atrasada"><i />devolvido</span>}
                    </span>
                    <strong className="or-cartao-titulo">{o.titulo}</strong>
                    <span className="or-cartao-local">
                      <span className="or-serv-pilula"><IconeServico slug={o.servicoSlug} tamanho={14} />{o.servicoNome}</span>
                      {o.bairro && <span>{o.bairro}</span>}
                    </span>
                    <span className="or-cartao-valor">
                      <b>{real(o.valorTotal)}</b>
                      <small>{o.qtdItens} {o.qtdItens === 1 ? 'material' : 'materiais'}{o.centroDeCusto ? ` · CC ${o.centroDeCusto.codigo}` : ''}</small>
                    </span>
                    <span className="or-cartao-rodape">
                      <span>{nomeCurto(o.criadoPor)} · {haQuanto(o.criadoEm)}</span>
                      {o.pedidos.length > 0 && <span className="or-pedidos-tag">{o.pedidos.map(p => p.numero).join(', ')}</span>}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      {!exigeAprovacaoCompra && lista && <p className="or-nota-regra">A revisão e a aprovação de compras estão desligadas nas Regras: ao enviar, o orçamento já fica aprovado.</p>}
    </div>
  );
}

/* ═════════════════════════ EDITOR ═════════════════════════ */

interface Linha {
  chave: string;
  licitacaoItemId: string;
  descricao: string;
  unidade: string;
  valorUnitario: string;
  quantidade: string;
  servicoSlug: string;           /* '' = mesmo do orçamento */
  centroDeCustoId: string;       /* '' = padrão do serviço / do orçamento */
  licitacao: { id: string; identificacao: string; fornecedor: string | null };
}
interface FotoPendente { id: string; file: File; url: string }

function FotoSalva({ entityId, fotoId, onAbrir, onRemover }: { entityId: string; fotoId: string; onAbrir: (url: string) => void; onRemover?: () => void }) {
  const url = useFotoUrl(entityId, fotoId, 'orcamento');
  return (
    <span className="or-foto">
      {url ? <button type="button" className="or-foto-btn" onClick={() => onAbrir(url)} aria-label="Ampliar foto"><img src={url} alt="" /></button> : <span className="ob-skeleton" style={{ width: '100%', height: '100%' }} />}
      {onRemover && <button type="button" className="or-foto-x" onClick={onRemover} aria-label="Tirar esta foto">×</button>}
    </span>
  );
}

export function OrcamentoEditorPage() {
  const { orcamentoId } = useParams();
  const novo = orcamentoId === 'novo';
  const { entityId, session } = useTenant();
  const navigate = useNavigate();
  const podeLancar = useTenantPermission('centros_custo.manage');
  const { podeRevisarCompra, podeAprovarCompra, exigeAprovacaoCompra } = session.obras;

  const [orc, setOrc] = useState<Orcamento | null>(null);
  const [carregadoId, setCarregadoId] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  /* campos */
  const permitidos = session.servicosPermitidos;
  const meusServicos = useMemo(() => permitidos ? SERVICOS.filter(s => permitidos.includes(CENTRO_IDS[s.slug])) : SERVICOS, [permitidos]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [servicoSlug, setServicoSlug] = useState(meusServicos.length === 1 ? meusServicos[0].slug : '');
  const [centroId, setCentroId] = useState<string | null>(null);   /* null = padrão do serviço */
  const [bairro, setBairro] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [pendentes, setPendentes] = useState<FotoPendente[]>([]);
  const [alterado, setAlterado] = useState(false);

  /* apoio */
  const [centros, setCentros] = useState<CentroDeCusto[]>([]);
  const [saldos, setSaldos] = useState<SaldoLicitacao[]>([]);
  const [bairros, setBairros] = useState<string[]>([]);
  const [bairrosCoords, setBairrosCoords] = useState<BairroCoord[]>([]);
  const [camera, setCamera] = useState(false);
  const [catalogo, setCatalogo] = useState(false);
  const [buscaCat, setBuscaCat] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const [devolvendo, setDevolvendo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [confirmaPedido, setConfirmaPedido] = useState(false);
  const pendentesRef = useRef(pendentes);
  useEffect(() => { pendentesRef.current = pendentes; }, [pendentes]);
  useEffect(() => () => pendentesRef.current.forEach(p => URL.revokeObjectURL(p.url)), []);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 4000); return () => clearTimeout(t); }, [aviso]);

  useEffect(() => {
    centrosDeCustoApi.listar(entityId).then(r => setCentros(r.itens.filter(c => c.ativo))).catch(() => {});
    tenantApi.compras.saldos(entityId).then(r => setSaldos(r.licitacoes)).catch(() => {});
    cadastrosAuxiliaresApi.list(entityId, 'BAIRRO').then(r => setBairros(r.items.filter(i => i.ativo).map(i => i.nome))).catch(() => {});
    cadastrosAuxiliaresApi.listBairrosCoords(entityId).then(r => setBairrosCoords(r.items)).catch(() => {});
  }, [entityId]);

  const preencher = useCallback((o: Orcamento) => {
    setOrc(o);
    setTitulo(o.titulo); setDescricao(o.descricao ?? ''); setServicoSlug(o.servicoSlug ?? '');
    setCentroId(o.centroDeCusto?.id ?? ''); setBairro(o.bairro ?? ''); setLogradouro(o.logradouro ?? '');
    setCoords(o.lat != null && o.lng != null ? { lat: o.lat, lng: o.lng } : null);
    setLinhas(o.itens.map(i => ({
      chave: i.id, licitacaoItemId: i.licitacaoItemId, descricao: i.descricao, unidade: i.unidade,
      valorUnitario: i.valorUnitario, quantidade: String(Number(i.quantidade)),
      servicoSlug: i.servicoSlug && i.servicoSlug !== o.servicoSlug ? i.servicoSlug : '',
      centroDeCustoId: i.centroDeCusto && i.centroDeCusto.id !== o.centroDeCusto?.id ? i.centroDeCusto.id : '',
      licitacao: { id: i.licitacao.id, identificacao: i.licitacao.identificacao, fornecedor: i.licitacao.fornecedor },
    })));
    setAlterado(false);
  }, []);

  useEffect(() => {
    if (novo || !orcamentoId) return;
    let vivo = true;
    orcamentosApi.obter(entityId, orcamentoId)
      .then(o => { if (vivo) preencher(o); })
      .catch(e => { if (vivo) setErro(msgErro(e)); })
      .finally(() => { if (vivo) setCarregadoId(orcamentoId); });
    return () => { vivo = false; };
  }, [entityId, orcamentoId, novo, preencher]);
  const carregando = !novo && carregadoId !== orcamentoId && orc?.id !== orcamentoId;

  const status: OrcamentoStatus = orc?.status ?? 'RASCUNHO';
  const editavel = podeLancar && status === 'RASCUNHO';
  const servico = servicoSlug ? SERVICOS_CONFIG[servicoSlug] : undefined;
  const cor = corDoServico(servicoSlug);
  const centroPadraoDe = (slug: string) => centros.find(c => c.servicos.some(s => s.id === CENTRO_IDS[slug]));
  const centroEfetivo = centroId ?? (servicoSlug ? centroPadraoDe(servicoSlug)?.id ?? '' : '');
  const mexeu = () => setAlterado(true);

  /* saldo disponível por item de contrato */
  const saldoItem = useMemo(() => {
    const m = new Map<string, { disponivel: string | null; licitacao: SaldoLicitacao; item: SaldoLicitacao['itens'][number] }>();
    saldos.forEach(l => l.itens.forEach(i => m.set(i.id, { disponivel: i.disponivel, licitacao: l, item: i })));
    return m;
  }, [saldos]);

  const total = linhas.reduce((t, l) => t + Number(l.valorUnitario) * (Number(l.quantidade.replace(',', '.')) || 0), 0);
  const porContrato = useMemo(() => {
    const m = new Map<string, { nome: string; fornecedor: string | null; valor: number }>();
    linhas.forEach(l => {
      const v = Number(l.valorUnitario) * (Number(l.quantidade.replace(',', '.')) || 0);
      const a = m.get(l.licitacao.id) ?? { nome: l.licitacao.identificacao, fornecedor: l.licitacao.fornecedor, valor: 0 };
      a.valor += v; m.set(l.licitacao.id, a);
    });
    return Array.from(m.values());
  }, [linhas]);
  const porCentro = useMemo(() => {
    const m = new Map<string, number>();
    linhas.forEach(l => {
      const c = l.centroDeCustoId || (l.servicoSlug ? centroPadraoDe(l.servicoSlug)?.id ?? centroEfetivo : centroEfetivo);
      m.set(c, (m.get(c) ?? 0) + Number(l.valorUnitario) * (Number(l.quantidade.replace(',', '.')) || 0));
    });
    return Array.from(m.entries()).map(([id, valor]) => ({ centro: centros.find(c => c.id === id), valor }));
  }, [linhas, centros, centroEfetivo]); // eslint-disable-line react-hooks/exhaustive-deps

  const acimaDoSaldo = (l: Linha) => {
    const s = saldoItem.get(l.licitacaoItemId);
    if (!s || s.disponivel === null) return null;
    const q = Number(l.quantidade.replace(',', '.')) || 0;
    return q > Number(s.disponivel) ? s.disponivel : null;
  };

  /* catálogo de materiais dos contratos */
  const adicionar = (l: SaldoLicitacao, i: SaldoLicitacao['itens'][number]) => {
    if (linhas.some(x => x.licitacaoItemId === i.id)) { setLinhas(ls => ls.filter(x => x.licitacaoItemId !== i.id)); mexeu(); return; }
    setLinhas(ls => [...ls, {
      chave: crypto.randomUUID(), licitacaoItemId: i.id, descricao: i.descricao, unidade: i.unidade, valorUnitario: i.valorUnitario,
      quantidade: '1', servicoSlug: '', centroDeCustoId: '', licitacao: { id: l.id, identificacao: l.identificacao, fornecedor: l.fornecedor },
    }]);
    mexeu();
  };
  const termoCat = buscaCat.trim().toLowerCase();
  const catalogoFiltrado = saldos.map(l => ({
    ...l, itens: l.itens.filter(i => !termoCat || [i.descricao, i.categoria ?? '', l.identificacao, l.fornecedor ?? ''].some(t => t.toLowerCase().includes(termoCat))),
  })).filter(l => l.itens.length);

  const alterarLinha = (chave: string, campo: Partial<Linha>) => { setLinhas(ls => ls.map(l => l.chave === chave ? { ...l, ...campo } : l)); mexeu(); };

  /* fotos */
  const aoTirarFotos = useCallback((files: File[], local: LocalFoto | null) => {
    setCamera(false);
    setPendentes(p => [...p, ...files.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
    setAlterado(true);
    if (!local) return;
    setCoords(c => c ?? { lat: local.lat, lng: local.lng });
    setBairro(b => b || (bairroMaisProximoLocal(local.lat, local.lng, bairrosCoords) ?? ''));
  }, [bairrosCoords]);

  const tirarPendente = (id: string) => setPendentes(p => { const f = p.find(x => x.id === id); if (f) URL.revokeObjectURL(f.url); return p.filter(x => x.id !== id); });

  /* salvar */
  const dados = (): DadosOrcamento => ({
    titulo: titulo.trim(), descricao: descricao.trim() || null, bairro: bairro || null, logradouro: logradouro.trim() || null,
    lat: coords?.lat ?? null, lng: coords?.lng ?? null,
    servicoSlug, servicoNome: servico?.nome ?? servicoSlug, centroDeCustoId: centroEfetivo || null,
    itens: linhas.map(l => {
      const s = l.servicoSlug ? SERVICOS_CONFIG[l.servicoSlug] : undefined;
      const centroLinha = l.centroDeCustoId || (l.servicoSlug ? centroPadraoDe(l.servicoSlug)?.id ?? '' : '');
      return {
        licitacaoItemId: l.licitacaoItemId, quantidade: l.quantidade.replace(',', '.'),
        servicoSlug: s?.slug ?? null, servicoNome: s?.nome ?? null, centroDeCustoId: centroLinha || null,
      };
    }),
  });

  const validar = (): string | null => {
    if (!servicoSlug) return 'Escolha o serviço do orçamento.';
    if (titulo.trim().length < 3) return 'Dê um título ao orçamento (ex.: "Recuperação da Rua A").';
    if (linhas.some(l => !(Number(l.quantidade.replace(',', '.')) > 0))) return 'Há material com quantidade zerada.';
    return null;
  };

  const salvar = async (): Promise<Orcamento | null> => {
    const v = validar(); if (v) { setErro(v); return null; }
    setOcupado(true); setErro('');
    try {
      let o = novo || !orc ? await orcamentosApi.criar(entityId, dados()) : await orcamentosApi.atualizar(entityId, orc.id, dados());
      if (pendentes.length) {
        o = await orcamentosApi.enviarFotos(entityId, o.id, pendentes.map(p => p.file));
        pendentes.forEach(p => URL.revokeObjectURL(p.url)); setPendentes([]);
      }
      preencher(o);
      if (novo) navigate(`/t/${entityId}/orcamentos/${o.id}`, { replace: true });
      return o;
    } catch (e) { setErro(msgErro(e)); return null; }
    finally { setOcupado(false); }
  };

  const agir = async (acao: AcaoOrcamento, texto: string, m?: string) => {
    setOcupado(true); setErro('');
    try { preencher(await orcamentosApi.fluxo(entityId, orc!.id, acao, m)); setAviso(texto); }
    catch (e) { setErro(msgErro(e)); }
    finally { setOcupado(false); }
  };

  const enviar = async () => {
    if (!linhas.length) { setErro('Inclua ao menos um material antes de enviar.'); return; }
    const o = alterado || novo || pendentes.length ? await salvar() : orc;
    if (!o) return;
    setOcupado(true);
    try {
      const r = await orcamentosApi.fluxo(entityId, o.id, 'enviar');
      preencher(r);
      setAviso(r.status === 'APROVADO' ? `${r.numero} enviado e já aprovado (aprovação desligada nas Regras).` : `${r.numero} enviado para revisão.`);
      if (novo) navigate(`/t/${entityId}/orcamentos/${o.id}`, { replace: true });
    } catch (e) { setErro(msgErro(e)); }
    finally { setOcupado(false); }
  };

  const gerarPedido = async () => {
    setConfirmaPedido(false); setOcupado(true); setErro('');
    try {
      const r = await orcamentosApi.gerarPedido(entityId, orc!.id);
      preencher(r.orcamento);
      setAviso(`Pronto: ${r.pedidos.map(p => p.numero).join(', ')} ${r.pedidos.length === 1 ? 'criado' : 'criados'} e aprovado${r.pedidos.length === 1 ? '' : 's'}.`);
    } catch (e) { setErro(msgErro(e)); }
    finally { setOcupado(false); }
  };

  if (carregando) return <div className="ob-page ob-claro"><span className="ob-skeleton" style={{ height: 420, borderRadius: 20 }} /></div>;
  if (!novo && !orc) return <div className="ob-page ob-claro"><div className="ob-erro">{erro || 'Orçamento não encontrado.'}</div><Link to={`/t/${entityId}/orcamentos`} className="ob-btn-ghost ob-btn-alto">Voltar</Link></div>;

  const et = ETAPA[status];
  const revisouEste = !!orc?.revisadoPorId && orc.revisadoPorId === session.id && session.role.code !== 'ADMIN';
  const totalFotos = (orc?.fotos.length ?? 0) + pendentes.length;
  const contratos = porContrato.length;

  return (
    <div className="ob-page ob-claro or-pagina" style={{ '--serv-cor': cor } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone"><IconeServico slug={servicoSlug} tamanho={30} /></span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv">
              <Link to={`/t/${entityId}/orcamentos`} className="or-voltar">← Orçamentos</Link>
            </span>
            <h1 className="ob-h1">{novo ? 'Novo orçamento' : orc!.numero}</h1>
            {!novo && (
              <p className="ob-sub or-sub-status">
                <span className={`ob-badge ${et.classe}`}><i />{et.rotulo}</span>
                {orc!.pedidos.map(p => <Link key={p.id} to={`/t/${entityId}/pedidos`} className="or-pedidos-tag">{p.numero}</Link>)}
              </p>
            )}
          </div>
        </div>
        {orc && <div className="or-passos-topo"><Passos o={orc} /></div>}
      </header>

      {aviso && <div className="cp-aviso" role="status">{aviso}</div>}
      {orc?.status === 'RASCUNHO' && orc.devolvidoMotivo && (
        <div className="cp-devolucao or-devolucao"><b>Devolvido em {dataCurta(orc.devolvidoEm)}:</b> {orc.devolvidoMotivo}</div>
      )}

      <div className="or-layout">
        <div className="or-coluna">
          {/* ── 1. local ── */}
          <section className="ob-card or-secao ob-reveal" style={{ '--i': 1 } as React.CSSProperties}>
            <h2 className="or-secao-titulo"><span>1</span>Onde e o quê</h2>
            {editavel ? (
              <div className="or-form">
                <label className="cc-campo cc-largo"><span>Título</span>
                  <input value={titulo} onChange={e => { setTitulo(e.target.value); mexeu(); }} placeholder='Ex.: Recuperação da Rua A, trecho da escola' maxLength={200} />
                </label>
                <div className="cc-campo cc-largo"><span>Serviço</span>
                  <div className="or-servicos" role="radiogroup" aria-label="Serviço">
                    {meusServicos.map(s => (
                      <button key={s.slug} type="button" role="radio" aria-checked={servicoSlug === s.slug}
                        className={`or-serv-opcao${servicoSlug === s.slug ? ' is-ativo' : ''}`} style={{ '--serv-cor': s.cor } as React.CSSProperties}
                        onClick={() => { setServicoSlug(s.slug); setCentroId(null); mexeu(); }}>
                        <IconeServico slug={s.slug} tamanho={16} />{s.nome}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="cc-campo"><span>Centro de custo {servicoSlug && centroId === null && centroEfetivo ? <em>— padrão do serviço</em> : null}</span>
                  <select value={centroEfetivo} onChange={e => { setCentroId(e.target.value); mexeu(); }}>
                    <option value="">Sem centro de custo</option>
                    {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
                  </select>
                </label>
                <label className="cc-campo"><span>Bairro {coords && <em>· GPS das fotos</em>}</span>
                  <select value={bairro} onChange={e => { setBairro(e.target.value); mexeu(); }}>
                    <option value="">Escolha…</option>
                    {(bairro && !bairros.includes(bairro) ? [bairro, ...bairros] : bairros).map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
                <label className="cc-campo cc-largo"><span>Endereço / referência</span>
                  <input value={logradouro} onChange={e => { setLogradouro(e.target.value); mexeu(); }} placeholder="Rua, número, ponto de referência" maxLength={300} />
                </label>
                <label className="cc-campo cc-largo"><span>O que precisa ser feito <em>(opcional)</em></span>
                  <textarea value={descricao} onChange={e => { setDescricao(e.target.value); mexeu(); }} rows={3} maxLength={2000} placeholder="Descreva a situação encontrada e a solução prevista" />
                </label>
              </div>
            ) : (
              <dl className="or-ficha">
                <div className="cc-largo"><dt>Título</dt><dd><strong>{orc!.titulo}</strong></dd></div>
                <div><dt>Serviço</dt><dd><span className="or-serv-pilula"><IconeServico slug={orc!.servicoSlug} tamanho={14} />{orc!.servicoNome}</span></dd></div>
                <div><dt>Centro de custo</dt><dd>{orc!.centroDeCusto ? `${orc!.centroDeCusto.codigo} · ${orc!.centroDeCusto.nome}` : '—'}</dd></div>
                <div><dt>Bairro</dt><dd>{orc!.bairro || '—'}</dd></div>
                <div><dt>Endereço</dt><dd>{orc!.logradouro || '—'}</dd></div>
                {orc!.descricao && <div className="cc-largo"><dt>Situação</dt><dd>{orc!.descricao}</dd></div>}
                {coords && <div className="cc-largo"><dt>GPS</dt><dd><a href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`} target="_blank" rel="noreferrer">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} ↗</a></dd></div>}
              </dl>
            )}
          </section>

          {/* ── 2. fotos ── */}
          <section className="ob-card or-secao ob-reveal" style={{ '--i': 2 } as React.CSSProperties}>
            <div className="or-secao-cab">
              <h2 className="or-secao-titulo"><span>2</span>Fotos do local <small>{totalFotos}/12</small></h2>
              {editavel && totalFotos < 12 && (
                <button type="button" className="ob-btn or-btn-camera" onClick={() => { if (!servicoSlug) { setErro('Escolha o serviço antes das fotos: ele vai no carimbo.'); return; } setCamera(true); }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Tirar fotos com carimbo
                </button>
              )}
            </div>
            {totalFotos === 0 ? (
              <p className="or-dica">{editavel ? 'As fotos saem com data, hora, GPS e o brasão do município — e o GPS já preenche o bairro.' : 'Sem fotos.'}</p>
            ) : (
              <div className="or-fotos">
                {orc?.fotos.map(f => (
                  <FotoSalva key={f.id} entityId={entityId} fotoId={f.id} onAbrir={setZoom}
                    onRemover={editavel ? () => { void orcamentosApi.removerFoto(entityId, orc.id, f.id).then(o => setOrc(x => x ? { ...x, fotos: o.fotos } : x)).catch(e => setErro(msgErro(e))); } : undefined} />
                ))}
                {pendentes.map(p => (
                  <span key={p.id} className="or-foto is-pendente">
                    <button type="button" className="or-foto-btn" onClick={() => setZoom(p.url)} aria-label="Ampliar foto"><img src={p.url} alt="" /></button>
                    <button type="button" className="or-foto-x" onClick={() => tirarPendente(p.id)} aria-label="Tirar esta foto">×</button>
                    <small>a salvar</small>
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* ── 3. materiais ── */}
          <section className="ob-card or-secao ob-reveal" style={{ '--i': 3 } as React.CSSProperties}>
            <div className="or-secao-cab">
              <h2 className="or-secao-titulo"><span>3</span>Materiais dos contratos <small>{linhas.length}</small></h2>
              {editavel && <button type="button" className="ob-btn" onClick={() => { setBuscaCat(''); setCatalogo(true); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Adicionar material
              </button>}
            </div>
            {linhas.length === 0 ? (
              <p className="or-dica">{editavel ? 'Escolha os itens das licitações. Cada linha pode ir para um serviço e um centro de custo diferentes.' : 'Sem materiais.'}</p>
            ) : (
              <div className="or-linhas">
                {linhas.map((l, idx) => {
                  const q = Number(l.quantidade.replace(',', '.')) || 0;
                  const acima = acimaDoSaldo(l);
                  const servLinha = l.servicoSlug || servicoSlug;
                  const centroLinha = l.centroDeCustoId || (l.servicoSlug ? centroPadraoDe(l.servicoSlug)?.id ?? '' : centroEfetivo);
                  const centroObj = centros.find(c => c.id === centroLinha);
                  const itemOrc = orc?.itens.find(i => i.licitacaoItemId === l.licitacaoItemId);
                  return (
                    <article key={l.chave} className={`or-linha ob-reveal${acima ? ' is-acima' : ''}`} style={{ '--i': Math.min(idx, 10), '--serv-cor': corDoServico(servLinha) } as React.CSSProperties}>
                      <div className="or-linha-topo">
                        <div className="or-linha-texto">
                          <strong>{l.descricao}</strong>
                          <span>Licitação {l.licitacao.identificacao}{l.licitacao.fornecedor ? ` · ${l.licitacao.fornecedor}` : ''} · {real(l.valorUnitario)} / {l.unidade}</span>
                        </div>
                        <div className="or-linha-total">{real(Number(l.valorUnitario) * q)}</div>
                        {editavel && <button type="button" className="or-remover" onClick={() => { setLinhas(ls => ls.filter(x => x.chave !== l.chave)); mexeu(); }} aria-label="Remover material">×</button>}
                      </div>
                      {editavel ? (
                        <div className="or-linha-campos">
                          <label className="or-qtd">
                            <span>Quantidade</span>
                            <span className="or-qtd-caixa">
                              <button type="button" onClick={() => alterarLinha(l.chave, { quantidade: String(Math.max(0, q - 1)) })} aria-label="Menos">−</button>
                              <input inputMode="decimal" value={l.quantidade} onChange={e => alterarLinha(l.chave, { quantidade: e.target.value.replace(/[^0-9.,]/g, '') })} />
                              <button type="button" onClick={() => alterarLinha(l.chave, { quantidade: String(q + 1) })} aria-label="Mais">+</button>
                            </span>
                            <em>{l.unidade}</em>
                          </label>
                          <label className="cc-campo"><span>Serviço</span>
                            <select value={l.servicoSlug} onChange={e => alterarLinha(l.chave, { servicoSlug: e.target.value, centroDeCustoId: '' })}>
                              <option value="">{servico ? `${servico.nome} (do orçamento)` : 'Mesmo do orçamento'}</option>
                              {SERVICOS.filter(s => s.slug !== servicoSlug).map(s => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                            </select>
                          </label>
                          <label className="cc-campo"><span>Centro de custo</span>
                            <select value={centroLinha} onChange={e => alterarLinha(l.chave, { centroDeCustoId: e.target.value })}>
                              <option value="">Sem centro de custo</option>
                              {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
                            </select>
                          </label>
                        </div>
                      ) : (
                        <div className="or-linha-leitura">
                          <span><b>{num(l.quantidade)}</b> {l.unidade}</span>
                          <span className="or-serv-pilula"><IconeServico slug={itemOrc?.servicoSlug} tamanho={13} />{itemOrc?.servicoNome ?? '—'}</span>
                          {itemOrc?.centroDeCusto && <span className="ob-tag" title={itemOrc.centroDeCusto.nome}>CC {itemOrc.centroDeCusto.codigo}</span>}
                        </div>
                      )}
                      {acima && editavel && <div className="or-alerta-saldo">Acima do saldo do contrato: restam {num(acima)} {l.unidade}. Assim não vira pedido.</div>}
                      {editavel && centroObj && l.centroDeCustoId === '' && l.servicoSlug && <div className="or-linha-nota">Centro padrão de {SERVICOS_CONFIG[l.servicoSlug]?.nome}</div>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── resumo lateral ── */}
        <aside className="or-lateral">
          <section className="ob-card or-total ob-reveal" style={{ '--i': 4 } as React.CSSProperties}>
            <span className="or-total-rotulo">Total do orçamento</span>
            <strong className="or-total-valor">{real(total)}</strong>
            <span className="or-total-sub">{linhas.length} {linhas.length === 1 ? 'material' : 'materiais'} · {totalFotos} {totalFotos === 1 ? 'foto' : 'fotos'}{contratos > 1 ? ` · ${contratos} contratos` : ''}</span>

            {porContrato.length > 0 && (
              <div className="or-quebra">
                <span className="or-quebra-titulo">{contratos > 1 ? `Vira ${contratos} pedidos (um por contrato)` : 'Vira 1 pedido'}</span>
                {porContrato.map(c => (
                  <div key={c.nome} className="or-quebra-linha">
                    <span>{c.nome}<small>{c.fornecedor ?? 'fornecedor da licitação'}</small></span>
                    <b>{real(c.valor)}</b>
                  </div>
                ))}
              </div>
            )}
            {porCentro.length > 0 && (
              <div className="or-quebra">
                <span className="or-quebra-titulo">Por centro de custo</span>
                {porCentro.map(({ centro, valor }) => (
                  <div key={centro?.id ?? 'sem'} className="or-quebra-linha">
                    <span>{centro ? centro.codigo : 'Sem centro'}<small>{centro?.nome ?? 'não apropriado'}</small></span>
                    <b>{real(valor)}</b>
                    <i style={{ width: `${total ? Math.round((valor / total) * 100) : 0}%` }} />
                  </div>
                ))}
              </div>
            )}

            {erro && <div className="ob-erro">{erro}</div>}

            <div className="or-acoes">
              {editavel && <>
                <button type="button" className="ob-acao is-conferir or-acao-larga" disabled={ocupado} onClick={() => void enviar()}>
                  {exigeAprovacaoCompra ? 'Enviar para revisão' : 'Enviar e aprovar'}
                </button>
                <button type="button" className="ob-btn-ghost ob-btn-alto or-acao-larga" disabled={ocupado || (!alterado && !novo && !pendentes.length)} onClick={() => void salvar().then(o => o && setAviso('Rascunho salvo.'))}>
                  {ocupado ? 'Salvando…' : 'Salvar rascunho'}
                </button>
              </>}
              {status === 'EM_REVISAO' && podeRevisarCompra && <>
                <button type="button" className="ob-acao is-conferir or-acao-larga" disabled={ocupado} onClick={() => void agir('revisar', `${orc!.numero} revisado. Agora vai para aprovação.`)}>Revisado ✓</button>
                <button type="button" className="ob-btn-ghost cp-devolver or-acao-larga" disabled={ocupado} onClick={() => { setMotivo(''); setDevolvendo(true); }}>Devolver para corrigir</button>
              </>}
              {status === 'AGUARDANDO_APROVACAO' && podeAprovarCompra && <>
                <button type="button" className="ob-acao is-aprovar or-acao-larga" disabled={ocupado || revisouEste} title={revisouEste ? 'Quem revisou não aprova o mesmo orçamento' : undefined}
                  onClick={() => void agir('aprovar', `${orc!.numero} aprovado.`)}>Aprovar orçamento</button>
                <button type="button" className="ob-btn-ghost cp-devolver or-acao-larga" disabled={ocupado} onClick={() => { setMotivo(''); setDevolvendo(true); }}>Devolver para corrigir</button>
              </>}
              {status === 'APROVADO' && podeLancar && (
                <button type="button" className="ob-acao is-baixa or-acao-larga or-acao-pedido" disabled={ocupado} onClick={() => setConfirmaPedido(true)}>
                  Gerar pedido de compra
                </button>
              )}
              {status === 'CONVERTIDO' && (
                <Link to={`/t/${entityId}/pedidos`} className="ob-btn-ghost ob-btn-alto or-acao-larga">Ver os pedidos</Link>
              )}
              {orc && !['CONVERTIDO', 'CANCELADO'].includes(status) && (podeLancar || podeAprovarCompra) && (
                <button type="button" className="or-cancelar" disabled={ocupado} onClick={() => { if (window.confirm(`Cancelar o orçamento ${orc.numero}?`)) void agir('cancelar', `${orc.numero} cancelado.`); }}>Cancelar orçamento</button>
              )}
            </div>
            {editavel && alterado && !novo && <span className="or-nao-salvo">Há alterações não salvas</span>}
          </section>
        </aside>
      </div>

      {/* ── catálogo ── */}
      {catalogo && (
        <Dialogo titulo="Materiais dos contratos" subtitulo="Toque para incluir ou tirar. O saldo mostra quanto ainda resta em cada item."
          onFechar={() => setCatalogo(false)}
          acoes={<button type="button" className="ob-btn" onClick={() => setCatalogo(false)}>Pronto · {linhas.length} {linhas.length === 1 ? 'material' : 'materiais'}</button>}>
          <div className="or-catalogo">
            <label className="ob-busca or-cat-busca">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>
              <span className="ob-sr">Buscar material</span>
              <input type="search" autoFocus value={buscaCat} onChange={e => setBuscaCat(e.target.value)} placeholder="Areia, cimento, lâmpada…" />
            </label>
            {saldos.length === 0 && <p className="or-dica">Nenhum contrato ativo com itens. Cadastre em Licitações.</p>}
            {catalogoFiltrado.map(l => (
              <div key={l.id} className="or-cat-grupo">
                <div className="or-cat-cab"><strong>Licitação {l.identificacao}</strong><span>{l.fornecedor ?? l.objeto}</span></div>
                {l.itens.map(i => {
                  const escolhido = linhas.some(x => x.licitacaoItemId === i.id);
                  const esgotado = i.disponivel !== null && Number(i.disponivel) <= 0;
                  return (
                    <button key={i.id} type="button" className={`or-cat-item${escolhido ? ' is-escolhido' : ''}${esgotado ? ' is-esgotado' : ''}`}
                      disabled={esgotado && !escolhido} onClick={() => adicionar(l, i)} aria-pressed={escolhido}>
                      <span className="or-cat-check" aria-hidden="true">{escolhido ? '✓' : '+'}</span>
                      <span className="or-cat-texto"><strong>{i.descricao}</strong><small>{real(i.valorUnitario)} / {i.unidade}{i.categoria ? ` · ${i.categoria}` : ''}</small></span>
                      <span className="or-cat-saldo">{i.disponivel === null ? <small>sem limite</small> : esgotado ? <small>esgotado</small> : <><b>{num(i.disponivel)}</b><small>{i.unidade} livres</small></>}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {saldos.length > 0 && catalogoFiltrado.length === 0 && <p className="or-dica">Nada encontrado para “{buscaCat}”.</p>}
          </div>
        </Dialogo>
      )}

      {devolvendo && orc && (
        <Dialogo titulo={`Devolver ${orc.numero}`} subtitulo="O orçamento volta para quem lançou, com o motivo abaixo, para corrigir e enviar de novo."
          onFechar={() => setDevolvendo(false)}
          acoes={<>
            <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setDevolvendo(false)}>Cancelar</button>
            <button type="button" className="ob-acao is-conferir" disabled={motivo.trim().length < 5}
              onClick={() => { setDevolvendo(false); void agir('devolver', `${orc.numero} devolvido para correção.`, motivo.trim()); }}>Devolver</button>
          </>}>
          <div className="cm-motivos">
            {MOTIVOS.map(m => <button key={m} type="button" className={`ob-chip${motivo === m ? ' is-ativo' : ''}`} onClick={() => setMotivo(m)}>{m}</button>)}
          </div>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Explique o que precisa ser corrigido…" maxLength={1000} />
        </Dialogo>
      )}

      {confirmaPedido && orc && (
        <Dialogo titulo="Gerar pedido de compra"
          subtitulo={contratos > 1 ? `Este orçamento usa ${contratos} contratos, então vira ${contratos} pedidos — um para cada fornecedor.` : 'O pedido nasce aprovado, pronto para enviar ao fornecedor.'}
          onFechar={() => setConfirmaPedido(false)}
          acoes={<>
            <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setConfirmaPedido(false)}>Agora não</button>
            <button type="button" className="ob-acao is-baixa" onClick={() => void gerarPedido()}>Gerar {contratos > 1 ? `${contratos} pedidos` : 'pedido'}</button>
          </>}>
          <div className="or-quebra">
            {porContrato.map(c => <div key={c.nome} className="or-quebra-linha"><span>{c.nome}<small>{c.fornecedor ?? ''}</small></span><b>{real(c.valor)}</b></div>)}
          </div>
        </Dialogo>
      )}

      {camera && servico && (
        <CameraCarimbo
          entityId={entityId}
          assinatura={{ nome: session.name, entidade: session.entity.name, usuarioId: session.id }}
          servico={`Orçamento · ${servico.nome}`}
          cor={servico.cor}
          bairro={bairro}
          logradouro={logradouro}
          bairrosCoords={bairrosCoords}
          onConcluir={aoTirarFotos}
          onFechar={() => setCamera(false)}
        />
      )}

      {zoom && (
        <div className="or-zoom" role="dialog" aria-label="Foto ampliada" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" />
          <button type="button" aria-label="Fechar">×</button>
        </div>
      )}
    </div>
  );
}
