import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  FileText,
  PackagePlus,
  Plus,
  Send,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { tenantApi, type Licitacao, type LicitacaoItem } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import type { ServicoConfig } from '../pages/servico-config';
import { dinheiro, formatarData } from './compras-data';
import type { CompraSolicitacao, SolicitacaoServicoStatus } from '../../lib/api-client';
import { ConfirmModal } from './ConfirmModal';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

interface ServicoSolicitacoesPanelProps {
  config: ServicoConfig;
}

const STATUS_LABEL: Record<SolicitacaoServicoStatus, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Enviada',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
  CONSOLIDATED: 'Consolidada',
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

function statusClass(status: SolicitacaoServicoStatus): string {
  if (status === 'APPROVED') return 'dot-green';
  if (status === 'SUBMITTED') return 'dot-blue';
  if (status === 'CONSOLIDATED') return 'dot-blue-p';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'dot-red';
  return 'dot-gray';
}

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function ItemSearchSelect({
  items,
  value,
  onChange,
  disabled,
}: {
  items: LicitacaoItem[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [listStyle, setListStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = items.find((item) => item.id === value);

  const filtered = search.trim()
    ? items.filter((item) => item.descricao.toLowerCase().includes(search.toLowerCase()))
    : items;

  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setListStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, [open]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  const list = open && !disabled
    ? createPortal(
        <div className="cp-item-search-list" style={listStyle}>
          {filtered.length === 0 ? (
            <div className="cp-item-search-empty">Nenhum item encontrado</div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className={`cp-item-search-option${item.id === value ? ' is-selected' : ''}`}
                onMouseDown={() => handleSelect(item.id)}
              >
                <strong>{item.descricao}</strong>
                <small>
                  {item.saldo.controleSaldo
                    ? `Disponivel ${Number(item.saldo.quantidadeDisponivel ?? 0).toLocaleString('pt-BR')} ${item.unidadeMedida} - reservado ${Number(item.saldo.quantidadeReservada).toLocaleString('pt-BR')}`
                    : 'Sem controle de saldo por quantidade'}
                </small>
              </div>
            ))
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={wrapperRef} className="cp-item-search-wrap">
      <div
        className={`cp-item-search-trigger${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
        onClick={() => { if (!disabled) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); } }}
      >
        {open ? (
          <input
            ref={inputRef}
            className="cp-item-search-input"
            placeholder="Buscar item..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />
        ) : (
          <span className={selected ? '' : 'cp-item-placeholder'}>
            {selected ? selected.descricao : (disabled ? 'Nenhum item disponível' : 'Selecione um item...')}
          </span>
        )}
        <svg className="cp-item-search-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {list}
    </div>
  );
}

function NovaSolicitacaoPreview({ config, onSaved }: { config: ServicoConfig; onSaved: () => void }) {
  const { entityId } = useTenant();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [items, setItems] = useState<LicitacaoItem[]>([]);
  const [licitacaoId, setLicitacaoId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [draftItems, setDraftItems] = useState<DraftSolicitacaoItem[]>([]);
  const [prioridade, setPrioridade] = useState<'Alta' | 'Media' | 'Baixa'>('Media');
  const [justificativa, setJustificativa] = useState(`Reposicao de materiais para execucao do servico de ${config.nome}.`);
  const [loadingLic, setLoadingLic] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoadingLic(true);
      setError('');
      try {
        const params = new URLSearchParams({ status: 'ACTIVE', pageSize: '100' });
        const result = await tenantApi.licitacoes.list(entityId, params);
        if (!alive) return;
        setLicitacoes(result.items);
        setLicitacaoId(result.items[0]?.id ?? '');
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Erro ao carregar licitacoes');
      } finally {
        if (alive) setLoadingLic(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [entityId]);

  useEffect(() => {
    let alive = true;
    const loadItems = async () => {
      if (!licitacaoId) {
        setItems([]);
        setItemId('');
        return;
      }
      setLoadingItems(true);
      setError('');
      try {
        const params = new URLSearchParams({ pageSize: '100' });
        const result = await tenantApi.licitacoes.listItems(entityId, licitacaoId, params);
        if (!alive) return;
        setItems(result.items);
        setItemId(result.items[0]?.id ?? '');
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Erro ao carregar itens da licitacao');
      } finally {
        if (alive) setLoadingItems(false);
      }
    };
    void loadItems();
    return () => { alive = false; };
  }, [entityId, licitacaoId]);

  useEffect(() => {
    setDraftItems([]);
  }, [licitacaoId]);

  const selectedItem = items.find((item) => item.id === itemId);
  const quantidadeNum = Math.max(0, toNumber(quantidade));
  const valorUnitario = toNumber(selectedItem?.valorUnitario);
  const valorTotal = quantidadeNum * valorUnitario;
  const quantidadeJaNoRascunho = draftItems
    .filter((item) => item.licitacaoItemId === selectedItem?.id)
    .reduce((sum, item) => sum + toNumber(item.quantidade), 0);
  const disponivelSelecionado = selectedItem?.saldo.controleSaldo
    ? toNumber(selectedItem.saldo.quantidadeDisponivel)
    : null;
  const excedeSaldoSelecionado = disponivelSelecionado !== null
    && quantidadeJaNoRascunho + quantidadeNum > disponivelSelecionado + 0.0001;
  const draftTotal = draftItems.reduce(
    (sum, item) => sum + toNumber(item.quantidade) * toNumber(item.valorUnitario),
    0,
  );

  const handleAddItem = () => {
    if (!selectedItem || quantidadeNum <= 0) {
      setError('Selecione um item e uma quantidade maior que zero.');
      return;
    }
    if (excedeSaldoSelecionado) {
      setError(`Quantidade excede o saldo disponivel da licitacao. Disponivel: ${disponivelSelecionado?.toLocaleString('pt-BR')} ${selectedItem.unidadeMedida}.`);
      return;
    }

    setDraftItems((current) => {
      const existing = current.find((item) => item.licitacaoItemId === selectedItem.id);
      if (existing) {
        return current.map((item) => {
          if (item.licitacaoItemId !== selectedItem.id) return item;
          const nextQuantidade = toNumber(item.quantidade) + quantidadeNum;
          return { ...item, quantidade: String(nextQuantidade) };
        });
      }
      return [
        ...current,
        {
          licitacaoItemId: selectedItem.id,
          descricao: selectedItem.descricao,
          unidadeMedida: selectedItem.unidadeMedida,
          valorUnitario: selectedItem.valorUnitario,
          quantidade,
          controleSaldo: selectedItem.saldo.controleSaldo,
          quantidadeDisponivel: selectedItem.saldo.quantidadeDisponivel,
        },
      ];
    });
    setError('');
  };

  const handleSave = async (submit: boolean) => {
    if (!licitacaoId || draftItems.length === 0) {
      setError('Adicione pelo menos um item antes de salvar a solicitacao.');
      return;
    }
    const itemExcedido = draftItems.find((item) => (
      item.controleSaldo
      && item.quantidadeDisponivel !== null
      && toNumber(item.quantidade) > toNumber(item.quantidadeDisponivel) + 0.0001
    ));
    if (itemExcedido) {
      setError(`O item "${itemExcedido.descricao}" excede o saldo disponivel da licitacao.`);
      return;
    }
    setSaving(submit ? 'submit' : 'draft');
    setError('');
    try {
      await tenantApi.compras.createSolicitacao(entityId, {
        servicoSlug: config.slug,
        servicoNome: config.nome,
        licitacaoId,
        prioridade,
        justificativa,
        submit,
        itens: draftItems.map((item) => ({
          licitacaoItemId: item.licitacaoItemId,
          quantidade: item.quantidade,
        })),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar solicitacao');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="cp-service-draft" style={{ '--cp-accent': config.cor } as React.CSSProperties}>
      <div className="cp-service-draft-top">
        <div className="cp-service-draft-icon">
          <PackagePlus size={18} />
        </div>
        <div>
          <span>Nova solicitacao</span>
          <strong>{config.nome}</strong>
        </div>
      </div>
      <div className="cp-form-grid">
        <label>
          <span>Licitacao</span>
          <select
            value={licitacaoId}
            onChange={(event) => setLicitacaoId(event.target.value)}
            disabled={loadingLic || licitacoes.length === 0}
          >
            {loadingLic ? <option>Carregando licitacoes...</option> : null}
            {!loadingLic && licitacoes.length === 0 ? <option>Nenhuma licitacao ativa cadastrada</option> : null}
            {licitacoes.map((licitacao) => (
              <option key={licitacao.id} value={licitacao.id}>
                {licitacao.identificacao}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Prioridade</span>
          <select value={prioridade} onChange={(event) => setPrioridade(event.target.value as 'Alta' | 'Media' | 'Baixa')}>
            <option>Alta</option>
            <option>Media</option>
            <option>Baixa</option>
          </select>
        </label>
      </div>
      {error ? <div className="tn-alert cp-draft-alert">{error}</div> : null}
      <div className="cp-item-builder">
        <div>
          <span>Item da licitacao</span>
          {loadingItems ? (
            <div className="cp-item-search-loading">Carregando itens...</div>
          ) : (
            <ItemSearchSelect
              items={items}
              value={itemId}
              onChange={setItemId}
              disabled={items.length === 0}
            />
          )}
          {selectedItem ? (
            <small>
              {selectedItem.saldo.controleSaldo
                ? `Licitado ${Number(selectedItem.saldo.quantidadeLicitada ?? 0).toLocaleString('pt-BR')} ${selectedItem.unidadeMedida} - reservado ${Number(selectedItem.saldo.quantidadeReservada).toLocaleString('pt-BR')} - disponivel ${Number(selectedItem.saldo.quantidadeDisponivel ?? 0).toLocaleString('pt-BR')}`
                : 'Item sem controle de saldo por quantidade na licitacao'}
            </small>
          ) : null}
        </div>
        <div>
          <span>Qtd.</span>
          <input
            className="cp-qty-input"
            type="number"
            min="0"
            max={disponivelSelecionado ?? undefined}
            step="0.01"
            value={quantidade}
            onChange={(event) => setQuantidade(event.target.value)}
          />
          {excedeSaldoSelecionado ? <small style={{ color: '#b45309' }}>Excede o saldo disponivel</small> : null}
        </div>
        <div>
          <span>Total</span>
          <strong>{dinheiro(valorTotal)}</strong>
          {selectedItem ? <small>{selectedItem.unidadeMedida} x {dinheiro(valorUnitario)}</small> : null}
        </div>
        <button
          type="button"
          className="cp-btn-add-item"
          title="Adicionar item"
          disabled={loadingItems || !selectedItem || quantidadeNum <= 0 || excedeSaldoSelecionado}
          onClick={handleAddItem}
        >
          <Plus size={16} />
          Adicionar
        </button>
      </div>
      {draftItems.length > 0 ? (
        <div className="cp-draft-items">
          {draftItems.map((item) => {
            const itemTotal = toNumber(item.quantidade) * toNumber(item.valorUnitario);
            return (
              <div key={item.licitacaoItemId} className="cp-draft-item">
                <div>
                  <strong>{item.descricao}</strong>
                  <span>{Number(item.quantidade).toLocaleString('pt-BR')} {item.unidadeMedida} x {dinheiro(toNumber(item.valorUnitario))}</span>
                </div>
                <strong>{dinheiro(itemTotal)}</strong>
                <button
                  type="button"
                  className="tn-icon-btn sv-btn-excluir"
                  title="Remover item"
                  onClick={() => setDraftItems((current) => current.filter((draftItem) => draftItem.licitacaoItemId !== item.licitacaoItemId))}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
          <div className="cp-draft-total">
            <span>Total da solicitacao</span>
            <strong>{dinheiro(draftTotal)}</strong>
          </div>
        </div>
      ) : null}
      <div className="cp-form-grid cp-justificativa-grid">
        <label className="is-wide">
          <span>Justificativa</span>
          <textarea value={justificativa} onChange={(event) => setJustificativa(event.target.value)} />
        </label>
      </div>
      <div className="cp-service-draft-actions">
        <button type="button" className="tn-btn-secondary" disabled={saving !== null} onClick={() => void handleSave(false)}>
          <FileText size={14} />
          {saving === 'draft' ? 'Salvando...' : 'Salvar rascunho'}
        </button>
        <button type="button" className="tn-btn-blue" disabled={saving !== null} onClick={() => void handleSave(true)}>
          <Send size={14} />
          {saving === 'submit' ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

function SolicitacaoCard({ solicitacao, config, onAction }: {
  solicitacao: CompraSolicitacao;
  config: ServicoConfig;
  onAction: (id: string, action: 'submit' | 'approve' | 'reject' | 'cancel' | 'delete') => void;
}) {
  return (
    <article className="cp-request-card" style={{ '--cp-accent': config.cor } as React.CSSProperties}>
      <div className="cp-request-card-head">
        <div className="cp-request-service">
          <span className="cp-request-service-icon">{config.icon}</span>
          <div>
            <strong>{solicitacao.numero}</strong>
            <span>{solicitacao.licitacao.identificacao}</span>
          </div>
        </div>
        <span className={`tn-chip ${statusClass(solicitacao.status)}`}>
          <i />
          {STATUS_LABEL[solicitacao.status]}
        </span>
      </div>
      <p>{solicitacao.justificativa}</p>
      <div className="cp-request-meta">
        <span>{formatarData(solicitacao.createdAt)}</span>
        <span>{solicitacao.createdBy.name}</span>
        <span>{solicitacao.prioridade}</span>
      </div>
      <div className="cp-request-items">
        {solicitacao.itens.map((item) => (
          <div key={item.id} className="cp-request-item">
            <span>{item.descricao}</span>
            <strong>{Number(item.quantidade).toLocaleString('pt-BR')} {item.unidadeMedida}</strong>
          </div>
        ))}
      </div>
      <div className="cp-request-foot">
        <span>Total estimado</span>
        <strong>{dinheiro(Number(solicitacao.valorTotal))}</strong>
      </div>
      <div className="cp-service-draft-actions">
        {solicitacao.status !== 'CANCELLED' ? (
          <>
            {solicitacao.status === 'DRAFT' ? (
              <button type="button" className="tn-btn-secondary" onClick={() => onAction(solicitacao.id, 'submit')}>Enviar</button>
            ) : null}
            {solicitacao.status !== 'APPROVED' && solicitacao.status !== 'CONSOLIDATED' ? (
              <button type="button" className="tn-btn-blue" onClick={() => onAction(solicitacao.id, 'approve')}>Aprovar</button>
            ) : null}
            {solicitacao.status !== 'CONSOLIDATED' ? (
              <button type="button" className="tn-btn-secondary" onClick={() => onAction(solicitacao.id, 'cancel')}>Cancelar</button>
            ) : null}
          </>
        ) : null}
        <button type="button" className="tn-btn-secondary" onClick={() => onAction(solicitacao.id, 'delete')}>
          <Trash2 size={13} />
          Excluir
        </button>
      </div>
    </article>
  );
}

export function ServicoSolicitacoesPanel({ config }: ServicoSolicitacoesPanelProps) {
  const { entityId } = useTenant();
  const { toasts, showToast, closeToast } = useToast();
  const [modo, setModo] = useState<'lista' | 'nova'>('lista');
  const [solicitacoes, setSolicitacoes] = useState<CompraSolicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; message?: string; onConfirm: () => void } | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ servicoSlug: config.slug, pageSize: '100' });
      const result = await tenantApi.compras.listSolicitacoes(entityId, params);
      setSolicitacoes(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar solicitacoes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [entityId, config.slug]);

  const aprovadas = solicitacoes.filter((solicitacao) => solicitacao.status === 'APPROVED').length;
  const total = solicitacoes.reduce((sum, solicitacao) => sum + Number(solicitacao.valorTotal), 0);
  const itens = solicitacoes.reduce((sum, solicitacao) => sum + solicitacao.itens.length, 0);

  const handleAction = (id: string, action: 'submit' | 'approve' | 'reject' | 'cancel' | 'delete') => {
    if (action === 'delete') {
      setConfirm({
        title: 'Excluir solicitação?',
        message: 'Esta ação removerá a solicitação e tudo que estiver ligado a ela.',
        onConfirm: async () => {
          setConfirm(null);
          try {
            await tenantApi.compras.deleteSolicitacao(entityId, id);
            await load(true);
            showToast('Solicitação excluída com sucesso.');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao excluir solicitação');
          }
        },
      });
      return;
    }
    void (async () => {
      try {
        await tenantApi.compras.changeSolicitacaoStatus(entityId, id, action);
        await load(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar solicitação');
      }
    })();
  };

  return (
    <>
    <section className="cp-service-panel" style={{ '--cp-accent': config.cor } as React.CSSProperties}>
      <div className="cp-service-hero">
        <div className="cp-service-hero-pulse" />
        <div>
          <div className="cp-eyebrow">
            <ShoppingCart size={14} />
            Solicitacoes do servico
          </div>
          <h3>Materiais controlados por {config.nome}</h3>
          <p>
            Solicite itens da licitacao no contexto do servico e mantenha o custo interno separado antes da consolidacao para compras.
          </p>
        </div>
        <button type="button" className="tn-btn-blue cp-hero-action" onClick={() => setModo('nova')}>
          <PackagePlus size={15} />
          Nova solicitacao
        </button>
      </div>

      <div className="cp-mini-stats">
        <div>
          <Boxes size={18} />
          <span>Solicitacoes</span>
          <strong>{solicitacoes.length}</strong>
        </div>
        <div>
          <CheckCircle2 size={18} />
          <span>Aprovadas</span>
          <strong>{aprovadas}</strong>
        </div>
        <div>
          <FileText size={18} />
          <span>Itens</span>
          <strong>{itens}</strong>
        </div>
        <div>
          <AlertCircle size={18} />
          <span>Custo previsto</span>
          <strong>{dinheiro(total)}</strong>
        </div>
      </div>

      <div className="sv-abas cp-local-tabs">
        <button type="button" className={`sv-aba${modo === 'lista' ? ' is-active' : ''}`} onClick={() => setModo('lista')}>
          <FileText size={13} />
          Historico
        </button>
        <button type="button" className={`sv-aba${modo === 'nova' ? ' is-active' : ''}`} onClick={() => setModo('nova')}>
          <Plus size={13} />
          Criar
        </button>
      </div>

      {error ? <div className="tn-alert">{error}</div> : null}

      {modo === 'nova' ? (
        <NovaSolicitacaoPreview config={config} onSaved={() => { setModo('lista'); void load(); }} />
      ) : loading ? (
        <div className="tn-skeleton">{[1,2,3].map(n => <div key={n} className="tn-skeleton-row" />)}</div>
      ) : solicitacoes.length > 0 ? (
        <div className="cp-request-grid">
          {solicitacoes.map((solicitacao) => (
            <SolicitacaoCard key={solicitacao.id} solicitacao={solicitacao} config={config} onAction={(id, action) => void handleAction(id, action)} />
          ))}
        </div>
      ) : (
        <div className="tn-empty cp-empty-state">
          <div className="tn-empty-icon">
            <PackagePlus size={34} />
          </div>
          <strong>Nenhuma solicitacao criada para este servico</strong>
          <button type="button" className="tn-btn-blue" onClick={() => setModo('nova')}>
            <Plus size={14} />
            Criar primeira solicitacao
          </button>
        </div>
      )}
    </section>
    {confirm && (
      <ConfirmModal
        title={confirm.title}
        message={confirm.message}
        confirmLabel="Excluir"
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    )}
    <ToastContainer toasts={toasts} onClose={closeToast} />
    </>
  );
}
