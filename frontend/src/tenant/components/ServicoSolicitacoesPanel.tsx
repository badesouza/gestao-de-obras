import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  FileText,
  PackagePlus,
  Plus,
  Send,
  ShoppingCart,
} from 'lucide-react';
import { tenantApi, type Licitacao, type LicitacaoItem } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import type { ServicoConfig } from '../pages/servico-config';
import { dinheiro, formatarData } from './compras-data';
import type { CompraSolicitacao, SolicitacaoServicoStatus } from '../../lib/api-client';

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

function NovaSolicitacaoPreview({ config, onSaved }: { config: ServicoConfig; onSaved: () => void }) {
  const { entityId } = useTenant();
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [items, setItems] = useState<LicitacaoItem[]>([]);
  const [licitacaoId, setLicitacaoId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantidade, setQuantidade] = useState('1');
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

  const selectedItem = items.find((item) => item.id === itemId);
  const quantidadeNum = Math.max(0, toNumber(quantidade));
  const valorUnitario = toNumber(selectedItem?.valorUnitario);
  const valorTotal = quantidadeNum * valorUnitario;

  const handleSave = async (submit: boolean) => {
    if (!licitacaoId || !itemId || quantidadeNum <= 0) {
      setError('Selecione licitacao, item e uma quantidade maior que zero.');
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
        itens: [{ licitacaoItemId: itemId, quantidade }],
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
        <label className="is-wide">
          <span>Justificativa</span>
          <textarea value={justificativa} onChange={(event) => setJustificativa(event.target.value)} />
        </label>
      </div>
      {error ? <div className="tn-alert cp-draft-alert">{error}</div> : null}
      <div className="cp-item-builder">
        <div>
          <span>Item da licitacao</span>
          <select
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
            disabled={loadingItems || items.length === 0}
            className="cp-item-select"
          >
            {loadingItems ? <option>Carregando itens...</option> : null}
            {!loadingItems && items.length === 0 ? <option>Nenhum item ativo nesta licitacao</option> : null}
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.descricao}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span>Qtd.</span>
          <input
            className="cp-qty-input"
            type="number"
            min="0"
            step="0.01"
            value={quantidade}
            onChange={(event) => setQuantidade(event.target.value)}
          />
        </div>
        <div>
          <span>Total</span>
          <strong>{dinheiro(valorTotal)}</strong>
          {selectedItem ? <small>{selectedItem.unidadeMedida} x {dinheiro(valorUnitario)}</small> : null}
        </div>
        <button type="button" className="tn-icon-btn" title="Adicionar item">
          <Plus size={14} />
        </button>
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
  onAction: (id: string, action: 'submit' | 'approve' | 'reject' | 'cancel') => void;
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
      {solicitacao.status !== 'CONSOLIDATED' && solicitacao.status !== 'CANCELLED' ? (
        <div className="cp-service-draft-actions">
          {solicitacao.status === 'DRAFT' ? (
            <button type="button" className="tn-btn-secondary" onClick={() => onAction(solicitacao.id, 'submit')}>Enviar</button>
          ) : null}
          {solicitacao.status !== 'APPROVED' ? (
            <button type="button" className="tn-btn-blue" onClick={() => onAction(solicitacao.id, 'approve')}>Aprovar</button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ServicoSolicitacoesPanel({ config }: ServicoSolicitacoesPanelProps) {
  const { entityId } = useTenant();
  const [modo, setModo] = useState<'lista' | 'nova'>('lista');
  const [solicitacoes, setSolicitacoes] = useState<CompraSolicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
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

  const handleAction = async (id: string, action: 'submit' | 'approve' | 'reject' | 'cancel') => {
    try {
      await tenantApi.compras.changeSolicitacaoStatus(entityId, id, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar solicitacao');
    }
  };

  return (
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
  );
}
