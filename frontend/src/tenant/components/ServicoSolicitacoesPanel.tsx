import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tenantApi, centrosDeCustoApi, type CentroDeCusto, type Licitacao, type LicitacaoItem } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { CENTRO_IDS, type ServicoConfig } from '../pages/servico-config';
import { dinheiro, formatarData } from './compras-data';
import type { CompraSolicitacao, SolicitacaoServicoStatus } from '../../lib/api-client';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { AcoesLinha, Aviso, Cartao, Carregando, Ic, Janela, useConfirmarExclusao } from './sisobras/so';

interface ServicoSolicitacoesPanelProps {
  config: ServicoConfig;
}

const STATUS: Record<SolicitacaoServicoStatus, { rotulo: string; tom: string }> = {
  DRAFT: { rotulo: 'Rascunho', tom: 'ghost' },
  SUBMITTED: { rotulo: 'Enviada', tom: 'amber' },
  APPROVED: { rotulo: 'Aprovada', tom: 'mint' },
  REJECTED: { rotulo: 'Rejeitada', tom: 'coral' },
  CANCELLED: { rotulo: 'Cancelada', tom: 'ghost' },
  CONSOLIDATED: { rotulo: 'Consolidada', tom: 'brand' },
};

interface DraftSolicitacaoItem {
  licitacaoItemId: string;
  descricao: string;
  unidadeMedida: string;
  valorUnitario: string | null;
  quantidade: string;
  controleSaldo: boolean;
  quantidadeDisponivel: string | null;
}

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}
const qtd = (v: string | number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR');

/** Busca do item da licitação (lista aberta por cima, sem ser cortada pela janela) */
function ItemSearchSelect({ items, value, onChange, disabled }: { items: LicitacaoItem[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [listStyle, setListStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = items.find(item => item.id === value);
  const filtered = search.trim() ? items.filter(item => item.descricao.toLowerCase().includes(search.toLowerCase())) : items;

  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    setListStyle({ position: 'fixed', top: r.bottom + 4, left: r.left, width: r.width, zIndex: 10050 });
  }, [open]);
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (wrapperRef.current?.contains(alvo) || listRef.current?.contains(alvo)) return;
      setOpen(false); setSearch('');
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);
  const escolher = (id: string) => { onChange(id); setOpen(false); setSearch(''); };

  const lista = open && !disabled ? createPortal(
    <div className="so" ref={listRef} style={{ ...listStyle, maxHeight: 280, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 4, fontFamily: 'var(--font-ui)' }}>
      {filtered.length === 0 ? <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--muted)' }}>Nenhum item encontrado</div> : filtered.map(item => (
        <button key={item.id} type="button" onMouseDown={() => escolher(item.id)}
          style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer', padding: '8px 10px', borderRadius: 9, background: item.id === value ? 'var(--brand-soft)' : 'transparent', color: 'var(--ink)', font: 'inherit' }}>
          <b style={{ display: 'block', fontSize: 12.5 }}>{item.descricao}</b>
          <small style={{ fontSize: 11, color: 'var(--muted)' }}>
            {item.saldo.controleSaldo
              ? `Disponível ${qtd(item.saldo.quantidadeDisponivel)} ${item.unidadeMedida} · reservado ${qtd(item.saldo.quantidadeReservada)}`
              : 'Sem controle de saldo por quantidade'}
          </small>
        </button>
      ))}
    </div>, document.body) : null;

  return (
    <div ref={wrapperRef}>
      <span className={`so-ctrl${disabled ? ' off' : ''}`} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        onClick={() => { if (!disabled) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); } }}>
        <Ic n="search" />
        {open
          ? <input ref={inputRef} placeholder="Buscar item…" value={search} onChange={e => setSearch(e.target.value)} />
          : <input readOnly value={selected ? selected.descricao : ''} placeholder={disabled ? 'Nenhum item disponível' : 'Escolha um item…'} style={{ cursor: 'inherit' }} />}
      </span>
      {lista}
    </div>
  );
}

/** Janela "Nova solicitação de material" do serviço */
function NovaSolicitacaoJanela({ config, onFechar, onSaved }: { config: ServicoConfig; onFechar: () => void; onSaved: (enviada: boolean) => void }) {
  const { entityId } = useTenant();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [items, setItems] = useState<LicitacaoItem[]>([]);
  const [licitacaoId, setLicitacaoId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [draftItems, setDraftItems] = useState<DraftSolicitacaoItem[]>([]);
  const [prioridade, setPrioridade] = useState<'Alta' | 'Media' | 'Baixa'>('Media');
  const [justificativa, setJustificativa] = useState(`Reposição de materiais para executar o serviço de ${config.nome}.`);
  const [centrosCusto, setCentrosCusto] = useState<CentroDeCusto[]>([]);
  const [centroDeCustoId, setCentroDeCustoId] = useState<string | null>(null);
  const [loadingLic, setLoadingLic] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { centrosDeCustoApi.listar(entityId).then(r => setCentrosCusto(r.itens.filter(c => c.ativo))).catch(() => {}); }, [entityId]);
  const centroPadrao = centrosCusto.find(c => c.servicos.some(sv => sv.id === CENTRO_IDS[config.slug]));
  const centroSelecionado = centroDeCustoId ?? centroPadrao?.id ?? '';

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingLic(true); setError('');
      try {
        const result = await tenantApi.licitacoes.list(entityId, new URLSearchParams({ status: 'ACTIVE', pageSize: '100' }));
        if (!alive) return;
        setLicitacoes(result.items); setLicitacaoId(result.items[0]?.id ?? '');
      } catch (err) { if (alive) setError(err instanceof Error ? err.message : 'Erro ao carregar licitações'); }
      finally { if (alive) setLoadingLic(false); }
    })();
    return () => { alive = false; };
  }, [entityId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!licitacaoId) { setItems([]); setItemId(''); return; }
      setLoadingItems(true); setError('');
      try {
        const result = await tenantApi.licitacoes.listItems(entityId, licitacaoId, new URLSearchParams({ pageSize: '100' }));
        if (!alive) return;
        setItems(result.items); setItemId(result.items[0]?.id ?? '');
      } catch (err) { if (alive) setError(err instanceof Error ? err.message : 'Erro ao carregar os itens da licitação'); }
      finally { if (alive) setLoadingItems(false); }
    })();
    return () => { alive = false; };
  }, [entityId, licitacaoId]);
  useEffect(() => { setDraftItems([]); }, [licitacaoId]);

  const selectedItem = items.find(item => item.id === itemId);
  const quantidadeNum = Math.max(0, toNumber(quantidade));
  const valorUnitario = toNumber(selectedItem?.valorUnitario);
  const valorTotal = quantidadeNum * valorUnitario;
  const jaNoRascunho = draftItems.filter(i => i.licitacaoItemId === selectedItem?.id).reduce((s, i) => s + toNumber(i.quantidade), 0);
  const disponivel = selectedItem?.saldo.controleSaldo ? toNumber(selectedItem.saldo.quantidadeDisponivel) : null;
  const excede = disponivel !== null && jaNoRascunho + quantidadeNum > disponivel + 0.0001;
  const draftTotal = draftItems.reduce((s, i) => s + toNumber(i.quantidade) * toNumber(i.valorUnitario), 0);

  const adicionar = () => {
    if (!selectedItem || quantidadeNum <= 0) { setError('Escolha um item e uma quantidade maior que zero.'); return; }
    if (excede) { setError(`A quantidade passa do saldo da licitação. Disponível: ${disponivel?.toLocaleString('pt-BR')} ${selectedItem.unidadeMedida}.`); return; }
    setDraftItems(atual => {
      const existe = atual.find(i => i.licitacaoItemId === selectedItem.id);
      if (existe) return atual.map(i => i.licitacaoItemId !== selectedItem.id ? i : { ...i, quantidade: String(toNumber(i.quantidade) + quantidadeNum) });
      return [...atual, {
        licitacaoItemId: selectedItem.id, descricao: selectedItem.descricao, unidadeMedida: selectedItem.unidadeMedida,
        valorUnitario: selectedItem.valorUnitario, quantidade, controleSaldo: selectedItem.saldo.controleSaldo, quantidadeDisponivel: selectedItem.saldo.quantidadeDisponivel,
      }];
    });
    setError('');
  };

  const salvar = async (submit: boolean) => {
    if (!licitacaoId || draftItems.length === 0) { setError('Adicione pelo menos um item antes de salvar.'); return; }
    const excedido = draftItems.find(i => i.controleSaldo && i.quantidadeDisponivel !== null && toNumber(i.quantidade) > toNumber(i.quantidadeDisponivel) + 0.0001);
    if (excedido) { setError(`O item "${excedido.descricao}" passa do saldo da licitação.`); return; }
    setSaving(submit ? 'submit' : 'draft'); setError('');
    try {
      await tenantApi.compras.createSolicitacao(entityId, {
        servicoSlug: config.slug, servicoNome: config.nome, licitacaoId, prioridade, justificativa, submit,
        centroDeCustoId: centroSelecionado || null,
        itens: draftItems.map(i => ({ licitacaoItemId: i.licitacaoItemId, quantidade: i.quantidade })),
      });
      onSaved(submit);
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao salvar a solicitação'); }
    finally { setSaving(null); }
  };

  return (
    <Janela icone="carrinho" eyebrow={`Solicitações · ${config.nome}`} titulo="Nova solicitação de material" largura={780}
      sub="Itens da licitação para este serviço. O custo fica separado até a consolidação em compras." onFechar={onFechar}
      rodape={<>
        <button type="button" className="so-btn so-ghost" disabled={saving !== null} onClick={onFechar}>Cancelar</button>
        <button type="button" className="so-btn so-ghost" disabled={saving !== null} onClick={() => void salvar(false)}><Ic n="doc" />{saving === 'draft' ? 'Salvando…' : 'Salvar rascunho'}</button>
        <button type="button" className="so-btn so-primary os-shine" disabled={saving !== null} onClick={() => void salvar(true)}>{saving === 'submit' ? 'Enviando…' : <>Enviar<Ic n="seta" className="arrow" /></>}</button>
      </>}>
      <div className="so-row2">
        <label className="so-field"><span className="so-lbl">Licitação <span className="req">*</span></span>
          <span className="so-ctrl"><select value={licitacaoId} onChange={e => setLicitacaoId(e.target.value)} disabled={loadingLic || licitacoes.length === 0}>
            {loadingLic && <option>Carregando licitações…</option>}
            {!loadingLic && licitacoes.length === 0 && <option>Nenhuma licitação ativa cadastrada</option>}
            {licitacoes.map(l => <option key={l.id} value={l.id}>{l.identificacao}</option>)}
          </select></span>
        </label>
        <div className="so-field"><span className="so-lbl">Prioridade</span>
          <div className="so-seg full">
            {(['Alta', 'Media', 'Baixa'] as const).map(p => (
              <label key={p} className={prioridade === p ? 'on' : ''}><input type="radio" name="prioridade" checked={prioridade === p} onChange={() => setPrioridade(p)} />{p === 'Media' ? 'Média' : p}</label>
            ))}
          </div>
        </div>
      </div>

      <div className="so-fs-t">Itens <span className="tag">da licitação</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(90px, 1fr) minmax(110px, 1fr) auto', gap: 10, alignItems: 'end' }}>
        <div className="so-field"><span className="so-lbl">Item</span>
          {loadingItems ? <Carregando texto="Carregando itens…" /> : <ItemSearchSelect items={items} value={itemId} onChange={setItemId} disabled={items.length === 0} />}
        </div>
        <label className="so-field"><span className="so-lbl">Quantidade</span>
          <span className={`so-ctrl mono${excede ? ' invalid' : ''}`}><input type="number" min="0" step="0.01" max={disponivel ?? undefined} value={quantidade} onChange={e => setQuantidade(e.target.value)} /></span>
        </label>
        <div className="so-field"><span className="so-lbl">Total</span>
          <span className="so-ctrl off mono"><input readOnly value={dinheiro(valorTotal)} /></span>
        </div>
        <button type="button" className="so-btn so-primary" style={{ height: 38 }} disabled={loadingItems || !selectedItem || quantidadeNum <= 0 || excede} onClick={adicionar}><Ic n="plus" />Adicionar</button>
      </div>
      {selectedItem && (
        <p className="so-help" style={{ marginTop: -6, color: excede ? 'var(--coral)' : undefined }}>
          {selectedItem.saldo.controleSaldo
            ? `Licitado ${qtd(selectedItem.saldo.quantidadeLicitada)} ${selectedItem.unidadeMedida} · reservado ${qtd(selectedItem.saldo.quantidadeReservada)} · disponível ${qtd(selectedItem.saldo.quantidadeDisponivel)}${excede ? ' — a quantidade passa do saldo' : ''}`
            : `${selectedItem.unidadeMedida} × ${dinheiro(valorUnitario)} · item sem controle de saldo por quantidade`}
        </p>
      )}

      {draftItems.length > 0 && (
        <div className="so-tw">
          <table className="so-table">
            <thead><tr><th scope="col">Item</th><th scope="col">Quantidade</th><th scope="col" style={{ textAlign: 'right' }}>Total</th><th scope="col"><span className="so-sr">Tirar</span></th></tr></thead>
            <tbody>
              {draftItems.map(i => (
                <tr key={i.licitacaoItemId}>
                  <td data-l="Item"><b style={{ color: 'var(--ink)' }}>{i.descricao}</b></td>
                  <td data-l="Quantidade" className="mono">{qtd(i.quantidade)} {i.unidadeMedida} × {dinheiro(toNumber(i.valorUnitario))}</td>
                  <td data-l="Total" className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>{dinheiro(toNumber(i.quantidade) * toNumber(i.valorUnitario))}</td>
                  <td data-l="" className="r"><AcoesLinha nome={i.descricao} onExcluir={() => setDraftItems(a => a.filter(x => x.licitacaoItemId !== i.licitacaoItemId))} /></td>
                </tr>
              ))}
              <tr><td colSpan={2} style={{ fontWeight: 800, color: 'var(--ink)' }}>Total da solicitação</td><td className="mono" style={{ textAlign: 'right', fontWeight: 800, fontSize: 14, color: 'var(--brand-ink)' }}>{dinheiro(draftTotal)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="so-fgrid">
        {centrosCusto.length > 0 && (
          <label className="so-field all"><span className="so-lbl">Centro de custo {centroPadrao && centroSelecionado === centroPadrao.id && <span className="opt">padrão do serviço</span>}</span>
            <span className="so-ctrl"><select value={centroSelecionado} onChange={e => setCentroDeCustoId(e.target.value)}>
              <option value="">Sem centro de custo</option>
              {centrosCusto.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
            </select></span>
          </label>
        )}
        <label className="so-field all"><span className="so-lbl">Justificativa</span>
          <span className="so-ctrl" style={{ height: 'auto' }}><textarea rows={2} value={justificativa} onChange={e => setJustificativa(e.target.value)}
            style={{ width: '100%', border: 0, background: 'transparent', padding: '9px 11px', font: 'inherit', resize: 'vertical' }} /></span>
        </label>
      </div>
      {error && <Aviso tom="amber">{error}</Aviso>}
    </Janela>
  );
}

/** Aba Solicitações: materiais pedidos pelo serviço (itens de licitação) */
export function ServicoSolicitacoesPanel({ config }: ServicoSolicitacoesPanelProps) {
  const { entityId } = useTenant();
  const { toasts, showToast, closeToast } = useToast();
  const { confirmar, janelaExclusao } = useConfirmarExclusao();
  const [nova, setNova] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<CompraSolicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const result = await tenantApi.compras.listSolicitacoes(entityId, new URLSearchParams({ servicoSlug: config.slug, pageSize: '100' }));
      setSolicitacoes(result.items);
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao carregar as solicitações'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [entityId, config.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const aprovadas = solicitacoes.filter(s => s.status === 'APPROVED').length;
  const enviadas = solicitacoes.filter(s => s.status === 'SUBMITTED').length;
  const total = solicitacoes.reduce((sum, s) => sum + Number(s.valorTotal), 0);
  const itens = solicitacoes.reduce((sum, s) => sum + s.itens.length, 0);

  const mudar = async (id: string, action: 'submit' | 'approve' | 'reject' | 'cancel') => {
    try {
      await tenantApi.compras.changeSolicitacaoStatus(entityId, id, action);
      await load(true);
      showToast(action === 'submit' ? 'Solicitação enviada.' : action === 'approve' ? 'Solicitação aprovada.' : 'Solicitação cancelada.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao atualizar a solicitação'); }
  };
  const excluir = (s: CompraSolicitacao) => confirmar({
    oque: 'solicitação', nome: s.numero,
    texto: 'A solicitação e os itens dela saem do sistema.',
    acao: async () => {
      try { await tenantApi.compras.deleteSolicitacao(entityId, s.id); await load(true); showToast('Solicitação excluída.'); }
      catch (err) { setError(err instanceof Error ? err.message : 'Erro ao excluir a solicitação'); }
    },
  });

  return (
    <>
      <section className="os-kpis" aria-label="Resumo das solicitações">
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#635BFF,#8B85FF)', '--ks': 'rgba(99,91,255,.8)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 1.9-1.6L21 8H5.1" /></svg></span>Solicitações</div>
          <div className="v"><span className="os-num" key={solicitacoes.length}>{solicitacoes.length}</span>{enviadas > 0 && <span className="os-pill amber" style={{ height: 20, fontSize: 10.5 }}><i />{enviadas} enviadas</span>}</div>
          <small>pedidas por {config.nome}</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#19B88A,#10C6D4)', '--ks': 'rgba(25,184,138,.8)', '--kg': 'rgba(25,184,138,.16)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></span>Aprovadas</div>
          <div className="v"><span className="os-num" key={aprovadas}>{aprovadas}</span></div>
          <small>prontas para virar compra</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#10C6D4,#635BFF)', '--ks': 'rgba(16,198,212,.8)', '--kg': 'rgba(16,198,212,.16)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg></span>Itens</div>
          <div className="v"><span className="os-num" key={itens}>{itens}</span></div>
          <small>somando todas as solicitações</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#E8962A,#F2B44C)', '--ks': 'rgba(232,150,42,.8)', '--kg': 'rgba(242,180,76,.18)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></span>Custo previsto</div>
          <div className="v"><span className="os-num sm" key={total}>{dinheiro(total)}</span></div>
          <small>antes da consolidação em compras</small>
        </article>
      </section>

      <Cartao icone="carrinho" titulo={`Materiais de ${config.nome}`} meta="itens da licitação pedidos no contexto do serviço" ajuda="Ajuda: Solicitações"
        direita={<button type="button" className="so-btn so-primary sm os-shine" onClick={() => setNova(true)}><Ic n="plus" />Nova solicitação</button>}>
        {error && <Aviso tom="amber">{error}</Aviso>}
        {loading ? <Carregando /> : solicitacoes.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 12px', textAlign: 'center' }}>
            <b style={{ color: 'var(--ink)' }}>Nenhuma solicitação para este serviço</b>
            <span className="so-help">Peça os materiais da licitação que a equipe vai usar.</span>
            <button type="button" className="so-btn so-primary os-shine" onClick={() => setNova(true)}><Ic n="plus" />Criar a primeira solicitação</button>
          </div>
        ) : (
          <div className="so-tw">
            <table className="so-table os-rows">
              <thead><tr><th scope="col">Solicitação</th><th scope="col">Itens</th><th scope="col">Prioridade</th><th scope="col">Situação</th><th scope="col" style={{ textAlign: 'right' }}>Total</th><th scope="col"><span className="so-sr">Ações</span></th></tr></thead>
              <tbody>
                {solicitacoes.map(s => {
                  const st = STATUS[s.status];
                  return (
                    <tr key={s.id}>
                      <td data-l="Solicitação">
                        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{s.numero}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{s.licitacao.identificacao}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{formatarData(s.createdAt)} · {s.createdBy.name}</span>
                      </td>
                      <td data-l="Itens">
                        {s.itens.slice(0, 2).map(i => <span key={i.id} style={{ display: 'block', fontSize: 12 }}><b className="mono" style={{ color: 'var(--ink)' }}>{qtd(i.quantidade)} {i.unidadeMedida}</b> · {i.descricao}</span>)}
                        {s.itens.length > 2 && <small style={{ color: 'var(--muted)' }}>+{s.itens.length - 2} {s.itens.length - 2 === 1 ? 'item' : 'itens'}</small>}
                      </td>
                      <td data-l="Prioridade"><span className={`os-pill ${s.prioridade === 'Alta' ? 'coral' : s.prioridade === 'Baixa' ? 'ghost' : 'brand'}`} style={{ height: 22, fontSize: 10.5 }}><i />{s.prioridade === 'Media' ? 'Média' : s.prioridade}</span></td>
                      <td data-l="Situação"><span className={`os-pill ${st.tom}`}><i />{st.rotulo}</span></td>
                      <td data-l="Total" className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>{dinheiro(Number(s.valorTotal))}</td>
                      <td data-l="" className="r">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {s.status === 'DRAFT' && <button type="button" className="so-btn so-ghost sm" onClick={() => void mudar(s.id, 'submit')}>Enviar</button>}
                          {s.status !== 'CANCELLED' && s.status !== 'APPROVED' && s.status !== 'CONSOLIDATED' && <button type="button" className="so-btn so-primary sm" onClick={() => void mudar(s.id, 'approve')}><Ic n="check" />Aprovar</button>}
                          {s.status !== 'CANCELLED' && s.status !== 'CONSOLIDATED' && <button type="button" className="so-btn so-danger sm" onClick={() => void mudar(s.id, 'cancel')}>Cancelar</button>}
                          <AcoesLinha nome={s.numero} onExcluir={() => excluir(s)} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {nova && <NovaSolicitacaoJanela config={config} onFechar={() => setNova(false)} onSaved={enviada => { setNova(false); showToast(enviada ? 'Solicitação enviada.' : 'Rascunho salvo.'); void load(); }} />}
      {janelaExclusao}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </>
  );
}
