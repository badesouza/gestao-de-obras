import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, tenantApi, type AcaoPedido, type PedidoCompra, type PedidoCompraStatus } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';
import { Dialogo, Kpi, KpiCarregando } from '../components/obras/ui';
import { haQuanto, nomeCurto } from '../components/obras/util';
import '../styles/compras-ui.css';

/* ── Pedidos de compra: lançamento → revisão → aprovação → fornecedor → entrega ── */

type Filtro = 'TODOS' | 'LANCAMENTO' | 'EM_REVISAO' | 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'ENVIADOS' | 'RECEIVED' | 'CANCELLED';

const ETAPA: Record<PedidoCompraStatus, { rotulo: string; classe: string }> = {
  DRAFT:                { rotulo: 'Em lançamento',         classe: 'is-rascunho' },
  EM_REVISAO:           { rotulo: 'Em revisão',            classe: 'is-execucao' },
  AGUARDANDO_APROVACAO: { rotulo: 'Aguardando aprovação',  classe: 'is-aprovacao' },
  APROVADO:             { rotulo: 'Aprovado · enviar',     classe: 'is-aberta' },
  SENT:                 { rotulo: 'Com o fornecedor',      classe: 'is-enviado' },
  PARTIAL:              { rotulo: 'Entrega parcial',       classe: 'is-enviado' },
  RECEIVED:             { rotulo: 'Entregue',              classe: 'is-concluida' },
  CANCELLED:            { rotulo: 'Cancelado',             classe: 'is-cancelada' },
};
const MOTIVOS = ['Quantidade acima do necessário', 'Item errado para o serviço', 'Falta justificativa', 'Sem saldo suficiente no contrato'];

const real = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataCurta = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

function Passos({ p }: { p: PedidoCompra }) {
  const ordem: PedidoCompraStatus[] = ['DRAFT', 'EM_REVISAO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'SENT', 'PARTIAL', 'RECEIVED'];
  const pos = ordem.indexOf(p.status);
  const passos = [
    { nome: 'Lançado', feito: true, info: `${nomeCurto(p.createdBy.name)} · ${dataCurta(p.createdAt)}` },
    { nome: 'Revisado', feito: !!p.revisadoEm || pos >= 3, info: p.revisadoPor ? `${nomeCurto(p.revisadoPor.name)} · ${dataCurta(p.revisadoEm)}` : '' },
    { nome: 'Aprovado', feito: !!p.aprovadoEm || pos >= 4, info: p.aprovadoPor ? `${nomeCurto(p.aprovadoPor.name)} · ${dataCurta(p.aprovadoEm)}` : '' },
    { nome: 'Fornecedor', feito: pos >= 4, info: dataCurta(p.sentAt) },
    { nome: 'Entregue', feito: p.status === 'RECEIVED', info: p.status === 'PARTIAL' ? 'parcial' : '' },
  ];
  const atual = p.status === 'CANCELLED' ? -1 : passos.findIndex(x => !x.feito);
  return (
    <ol className="cp-passos" aria-label="Andamento do pedido">
      {passos.map((x, i) => (
        <li key={x.nome} className={`${x.feito ? 'is-feito' : ''}${i === atual ? ' is-atual' : ''}`} title={x.info || undefined}>
          <i />
          <span>{x.nome}</span>
          {x.info && <small>{x.info}</small>}
        </li>
      ))}
    </ol>
  );
}

export function PedidosCompraPage() {
  const { entityId, session } = useTenant();
  const podeLancar = useTenantPermission('centros_custo.manage');
  const { podeRevisarCompra, podeAprovarCompra, exigeAprovacaoCompra } = session.obras;
  const [pedidos, setPedidos] = useState<PedidoCompra[] | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [devolvendo, setDevolvendo] = useState<PedidoCompra | null>(null);
  const [motivo, setMotivo] = useState('');

  const carregar = () => {
    const p = new URLSearchParams({ pageSize: '100' });
    return tenantApi.compras.listPedidos(entityId, p).then(r => { setPedidos(r.items); setErro(''); }).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
  };
  useEffect(() => { void carregar(); }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 3500); return () => clearTimeout(t); }, [aviso]);

  const agir = async (p: PedidoCompra, acao: AcaoPedido, texto: string, m?: string) => {
    setOcupado(p.id); setErro('');
    try { await tenantApi.compras.fluxoPedido(entityId, p.id, acao, m); setAviso(texto); await carregar(); }
    catch (e) { setErro(e instanceof ApiError ? e.body.message : 'Não foi possível concluir'); }
    finally { setOcupado(null); }
  };

  const lista = useMemo(() => pedidos ?? [], [pedidos]);
  const conta = (s: PedidoCompraStatus[]) => lista.filter(p => s.includes(p.status)).length;
  const grupos: Record<Filtro, PedidoCompraStatus[] | null> = {
    TODOS: null, LANCAMENTO: ['DRAFT'], EM_REVISAO: ['EM_REVISAO'], AGUARDANDO_APROVACAO: ['AGUARDANDO_APROVACAO'],
    APROVADO: ['APROVADO'], ENVIADOS: ['SENT', 'PARTIAL'], RECEIVED: ['RECEIVED'], CANCELLED: ['CANCELLED'],
  };
  const FILTROS: { id: Filtro; rotulo: string; cor: string }[] = [
    { id: 'TODOS', rotulo: 'Todos', cor: 'var(--ob-faint)' },
    { id: 'LANCAMENTO', rotulo: 'Em lançamento', cor: '#A8A29E' },
    { id: 'EM_REVISAO', rotulo: 'Em revisão', cor: 'var(--ob-amber)' },
    { id: 'AGUARDANDO_APROVACAO', rotulo: 'Aguardando aprovação', cor: 'var(--ob-violeta)' },
    { id: 'APROVADO', rotulo: 'Aprovados', cor: 'var(--ob-blue)' },
    { id: 'ENVIADOS', rotulo: 'Com o fornecedor', cor: '#0891B2' },
    { id: 'RECEIVED', rotulo: 'Entregues', cor: 'var(--ob-green)' },
    { id: 'CANCELLED', rotulo: 'Cancelados', cor: 'var(--ob-faint)' },
  ];
  const termo = busca.trim().toLowerCase();
  const visiveis = lista.filter(p => (!grupos[filtro] || grupos[filtro]!.includes(p.status)) &&
    (!termo || [p.numero, ...(p.servicos ?? []), ...(p.fornecedores ?? []), ...(p.licitacoes ?? []), ...p.itens.map(i => i.descricao)].some(t => t.toLowerCase().includes(termo))));

  const emRevisao = conta(['EM_REVISAO']), aguardando = conta(['AGUARDANDO_APROVACAO']), aprovados = conta(['APROVADO']);
  const devolvidos = lista.filter(p => p.status === 'DRAFT' && p.devolvidoMotivo).length;
  const valorAberto = lista.filter(p => ['SENT', 'PARTIAL'].includes(p.status)).reduce((s, p) => s + Number(p.valorTotal), 0);

  return (
    <div className="ob-page ob-claro" style={{ '--serv-cor': '#2563EB' } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 002 1.58h8.77a2 2 0 001.95-1.57L21 8H5.12"/></svg>
          </span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv">Compras</span>
            <h1 className="ob-h1">Pedidos de compra</h1>
            <p className="ob-sub">{exigeAprovacaoCompra ? 'Cada pedido passa por revisão e aprovação antes de ir ao fornecedor.' : 'A aprovação de compras está desligada nas regras.'}</p>
          </div>
        </div>
        <div className="ob-head-acoes">
          <Link to={`/t/${entityId}/saldos`} className="ob-btn-ghost ob-btn-alto">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>
            Saldos dos contratos
          </Link>
          {podeLancar && (
            <Link to={`/t/${entityId}/compras`} className="ob-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Lançar pedido
            </Link>
          )}
        </div>
      </header>

      <section className="ob-kpis" aria-label="Resumo">
        {!pedidos ? [1, 2, 3, 4].map(n => <KpiCarregando key={n} />) : (
          <>
            <Kpi i={1} rotulo="Em revisão" valor={emRevisao} cor="var(--ob-amber)" nota={emRevisao ? (podeRevisarCompra ? 'esperando a sua revisão' : 'com os revisores') : 'nada para revisar'} tom={emRevisao && podeRevisarCompra ? 'alerta' : 'neutro'} grafico={null} />
            <Kpi i={2} rotulo="Aguardando aprovação" valor={aguardando} cor="var(--ob-violeta)" nota={aguardando ? (podeAprovarCompra ? 'esperando a sua aprovação' : 'com quem aprova') : 'nada para aprovar'} tom={aguardando && podeAprovarCompra ? 'alerta' : 'neutro'} grafico={null} />
            <Kpi i={3} rotulo="Aprovados para enviar" valor={aprovados} cor="var(--ob-blue)" nota={devolvidos ? `${devolvidos} ${devolvidos === 1 ? 'pedido devolvido' : 'pedidos devolvidos'} para corrigir` : aprovados ? 'prontos para o fornecedor' : 'nenhum na fila'} tom={devolvidos ? 'ruim' : 'neutro'} grafico={null} />
            <div className="ob-kpi ob-reveal" style={{ '--i': 4, '--kpi-cor': '#0891B2' } as React.CSSProperties}>
              <span className="ob-kpi-rotulo">Com os fornecedores</span>
              <div className="ob-kpi-linha"><span className="ob-kpi-valor cp-kpi-dinheiro">{real(valorAberto)}</span></div>
              <div className="ob-kpi-rodape"><span className="ob-kpi-nota tom-neutro">{conta(['SENT', 'PARTIAL'])} pedidos aguardando entrega</span></div>
            </div>
          </>
        )}
      </section>

      {aviso && <div className="cp-aviso" role="status">{aviso}</div>}

      <section className="ob-card ob-reveal" style={{ '--i': 5 } as React.CSSProperties} aria-label="Pedidos">
        <div className="ob-filtros">
          <div className="ob-chips" role="group" aria-label="Filtrar por etapa">
            {FILTROS.map(f => {
              const n = f.id === 'TODOS' ? lista.length : conta(grupos[f.id]!);
              if (n === 0 && !['TODOS', 'EM_REVISAO', 'AGUARDANDO_APROVACAO'].includes(f.id)) return null;
              return (
                <button key={f.id} type="button" className={`ob-chip${filtro === f.id ? ' is-ativo' : ''}`} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}>
                  <i style={{ background: f.cor }} />{f.rotulo}<span>{n}</span>
                </button>
              );
            })}
          </div>
          <label className="ob-busca">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>
            <span className="ob-sr">Buscar</span>
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nº, serviço, fornecedor ou item" />
          </label>
        </div>

        {erro && <div className="ob-erro" style={{ margin: '0 16px 12px' }}>{erro}</div>}
        {!pedidos && !erro && <div className="ob-lista">{[1, 2, 3].map(n => <div key={n} className="ob-oc"><span className="ob-skeleton" style={{ height: 110 }} /></div>)}</div>}
        {pedidos && visiveis.length === 0 && <p className="ob-vazio" style={{ padding: '8px 20px 24px' }}>{lista.length ? 'Nenhum pedido com esse filtro.' : 'Nenhum pedido ainda. Os pedidos nascem das solicitações aprovadas em Compras.'}</p>}

        {visiveis.length > 0 && (
          <div className="ob-lista">
            {visiveis.map((p, idx) => {
              const et = ETAPA[p.status];
              const ocup = ocupado === p.id;
              const revisouEste = p.revisadoPor?.id === session.id && session.role.code !== 'ADMIN';
              const expandido = aberto === p.id;
              return (
                <article key={p.id} className={`ob-oc pc-pedido ob-reveal${p.status === 'DRAFT' && p.devolvidoMotivo ? ' is-devolvido' : ''}`} style={{ '--i': Math.min(idx, 12) } as React.CSSProperties}>
                  <div className="cp-linha">
                    <button type="button" className="cp-abrir" onClick={() => setAberto(expandido ? null : p.id)} aria-expanded={expandido}>
                      <span className="cp-topo">
                        <span className="ob-oc-os">{p.numero}</span>
                        <span className={`ob-badge ${et.classe}`}><i />{et.rotulo}</span>
                        {p.status === 'DRAFT' && p.devolvidoMotivo && <span className="ob-badge is-atrasada"><i />devolvido</span>}
                      </span>
                      <strong className="cp-titulo">{(p.servicos ?? []).join(' · ') || 'Pedido de compra'}</strong>
                      <span className="cp-sub">{(p.fornecedores ?? []).join(', ') || 'Fornecedor da licitação'}{p.licitacoes?.length ? ` · Licitação ${p.licitacoes.join(', ')}` : ''} · {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}</span>
                      <span className="cp-meta">Lançado por {nomeCurto(p.createdBy.name)} · {haQuanto(p.createdAt)}</span>
                    </button>
                    <div className="cp-valor"><small>Valor</small><strong>{real(p.valorTotal)}</strong></div>
                  </div>

                  {p.status === 'DRAFT' && p.devolvidoMotivo && (
                    <div className="cp-devolucao"><b>Devolvido:</b> {p.devolvidoMotivo}</div>
                  )}

                  <div className="cp-rodape">
                    <Passos p={p} />
                    <div className="cp-acoes">
                      {p.status === 'DRAFT' && podeLancar && (
                        exigeAprovacaoCompra
                          ? <button type="button" className="ob-acao is-conferir" disabled={ocup} onClick={() => void agir(p, 'enviar_revisao', `${p.numero} enviado para revisão.`)}>Enviar para revisão</button>
                          : <button type="button" className="ob-acao is-aprovar" disabled={ocup} onClick={() => void agir(p, 'enviar_fornecedor', `${p.numero} enviado ao fornecedor.`)}>Enviar ao fornecedor</button>
                      )}
                      {p.status === 'EM_REVISAO' && podeRevisarCompra && <>
                        <button type="button" className="ob-btn-ghost cp-devolver" disabled={ocup} onClick={() => { setDevolvendo(p); setMotivo(''); }}>Devolver</button>
                        <button type="button" className="ob-acao is-conferir" disabled={ocup} onClick={() => void agir(p, 'revisar', `${p.numero} revisado. Agora vai para aprovação.`)}>Revisado ✓</button>
                      </>}
                      {p.status === 'AGUARDANDO_APROVACAO' && podeAprovarCompra && <>
                        <button type="button" className="ob-btn-ghost cp-devolver" disabled={ocup} onClick={() => { setDevolvendo(p); setMotivo(''); }}>Devolver</button>
                        <button type="button" className="ob-acao is-aprovar" disabled={ocup || revisouEste} title={revisouEste ? 'Quem revisou não aprova o mesmo pedido' : undefined}
                          onClick={() => void agir(p, 'aprovar', `${p.numero} aprovado.`)}>Aprovar</button>
                      </>}
                      {p.status === 'APROVADO' && podeLancar && (
                        <button type="button" className="ob-acao is-baixa" disabled={ocup} onClick={() => void agir(p, 'enviar_fornecedor', `${p.numero} enviado ao fornecedor.`)}>Enviar ao fornecedor</button>
                      )}
                      {(p.status === 'SENT' || p.status === 'PARTIAL') && (
                        <Link to={`/t/${entityId}/compras`} className="ob-btn-ghost cp-link">Registrar entrega</Link>
                      )}
                    </div>
                  </div>

                  {expandido && (
                    <div className="cp-itens">
                      <table>
                        <thead><tr><th>Item</th><th>Qtd.</th><th>Unid.</th><th>Valor unit.</th><th>Total</th><th>Entregue</th></tr></thead>
                        <tbody>
                          {p.itens.map(i => (
                            <tr key={i.id}>
                              <td>{i.descricao}</td>
                              <td>{Number(i.quantidadeTotal).toLocaleString('pt-BR')}</td>
                              <td>{i.unidadeMedida}</td>
                              <td>{real(i.valorUnitario)}</td>
                              <td><b>{real(i.valorTotal)}</b></td>
                              <td>{Number(i.quantidadeRecebida).toLocaleString('pt-BR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {devolvendo && (
        <Dialogo
          titulo={`Devolver ${devolvendo.numero}`}
          subtitulo="O pedido volta para quem lançou, com o motivo abaixo, para corrigir e enviar de novo."
          onFechar={() => setDevolvendo(null)}
          acoes={<>
            <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setDevolvendo(null)}>Cancelar</button>
            <button type="button" className="ob-acao is-conferir" disabled={motivo.trim().length < 5}
              onClick={() => { const p = devolvendo; setDevolvendo(null); void agir(p, 'devolver', `${p.numero} devolvido para correção.`, motivo.trim()); }}>Devolver pedido</button>
          </>}
        >
          <div className="cm-motivos">
            {MOTIVOS.map(m => <button key={m} type="button" className={`ob-chip${motivo === m ? ' is-ativo' : ''}`} onClick={() => setMotivo(m)}>{m}</button>)}
          </div>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Explique o que precisa ser corrigido…" maxLength={1000} />
        </Dialogo>
      )}
    </div>
  );
}
