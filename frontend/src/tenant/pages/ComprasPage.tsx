import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  PackageCheck,
  PackageSearch,
  Send,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { tenantApi, type CompraSolicitacao, type PedidoCompra } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { dinheiro, formatarData, getServico } from '../components/compras-data';

function statusPedidoLabel(status: string): string {
  if (status === 'PARTIAL') return 'Parcialmente atendido';
  if (status === 'RECEIVED') return 'Atendido';
  if (status === 'SENT') return 'Enviado';
  if (status === 'DRAFT') return 'Rascunho';
  return status;
}

function num(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function licitacaoLabel(item: PedidoCompra['itens'][number]): string {
  return item.licitacao?.identificacao ?? 'Licitação não informada';
}

function consolidarPreview(solicitacoes: CompraSolicitacao[]) {
  const mapa = new Map<string, {
    licitacaoItemId: string;
    descricao: string;
    unidadeMedida: string;
    quantidadeTotal: number;
    valorUnitario: number;
    valorTotal: number;
    origens: Array<{ servicoSlug: string; servicoNome: string; numero: string; quantidade: number }>;
  }>();

  solicitacoes.forEach((solicitacao) => {
    solicitacao.itens.forEach((item) => {
      const atual = mapa.get(item.licitacaoItemId);
      if (!atual) {
        mapa.set(item.licitacaoItemId, {
          licitacaoItemId: item.licitacaoItemId,
          descricao: item.descricao,
          unidadeMedida: item.unidadeMedida,
          quantidadeTotal: num(item.quantidade),
          valorUnitario: num(item.valorUnitario),
          valorTotal: num(item.valorTotal),
          origens: [{
            servicoSlug: solicitacao.servicoSlug,
            servicoNome: solicitacao.servicoNome,
            numero: solicitacao.numero,
            quantidade: num(item.quantidade),
          }],
        });
        return;
      }
      atual.quantidadeTotal += num(item.quantidade);
      atual.valorTotal += num(item.valorTotal);
      atual.origens.push({
        servicoSlug: solicitacao.servicoSlug,
        servicoNome: solicitacao.servicoNome,
        numero: solicitacao.numero,
        quantidade: num(item.quantidade),
      });
    });
  });

  return Array.from(mapa.values());
}

export function ComprasPage() {
  const { entityId, session } = useTenant();
  const [solicitacoes, setSolicitacoes] = useState<CompraSolicitacao[]>([]);
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [documentoOpen, setDocumentoOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [solResult, pedidoResult] = await Promise.all([
        tenantApi.compras.listSolicitacoes(entityId, new URLSearchParams({ status: 'APPROVED', pageSize: '100' })),
        tenantApi.compras.listPedidos(entityId, new URLSearchParams({ pageSize: '20' })),
      ]);
      setSolicitacoes(solResult.items);
      setPedidos(pedidoResult.items);
      setSelecionadas((current) => {
        const valid = new Set(solResult.items.map((item) => item.id));
        const kept = current.filter((id) => valid.has(id));
        return kept.length > 0 ? kept : solResult.items.map((item) => item.id);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar compras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [entityId]);

  const selecionadasDetalhe = solicitacoes.filter((solicitacao) => selecionadas.includes(solicitacao.id));
  const preview = useMemo(() => consolidarPreview(selecionadasDetalhe), [selecionadasDetalhe]);
  const pedidoAtual = pedidos[0] ?? null;
  const itensExibidos = pedidoAtual?.itens ?? [];
  const valorSelecionado = selecionadasDetalhe.reduce((sum, solicitacao) => sum + num(solicitacao.valorTotal), 0);
  const totalRecebido = pedidoAtual ? pedidoAtual.itens.reduce(
    (sum, item) => sum + num(item.quantidadeRecebida) * num(item.valorUnitario),
    0,
  ) : 0;

  const toggleSelecionada = (id: string) => {
    setSelecionadas((atual) => (
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
    ));
  };

  const gerarPedido = async () => {
    if (selecionadas.length === 0) {
      setError('Selecione ao menos uma solicitação aprovada.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await tenantApi.compras.createPedidoFromSolicitacoes(entityId, { solicitacaoIds: selecionadas, send: true });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar pedido');
    } finally {
      setSaving(false);
    }
  };

  const registrarEntrega = async () => {
    if (!pedidoAtual) return;
    const item = pedidoAtual.itens.find((pedidoItem) => num(pedidoItem.quantidadePendente) > 0);
    if (!item) {
      setError('Este pedido não possui item pendente.');
      return;
    }
    const quantidade = window.prompt(`Quantidade entregue para ${item.descricao}`, item.quantidadePendente);
    if (!quantidade) return;
    const responsavel = window.prompt('Responsável pelo recebimento', session.name) ?? session.name;
    setSaving(true);
    setError('');
    try {
      await tenantApi.compras.createRecebimento(entityId, pedidoAtual.id, {
        pedidoCompraItemId: item.id,
        quantidade,
        recebidoEm: new Date().toISOString().slice(0, 10),
        responsavel,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar entrega');
    } finally {
      setSaving(false);
    }
  };

  const abrirDocumentoPedido = () => {
    if (!pedidoAtual) {
      setError('Gere um pedido antes de emitir o documento.');
      return;
    }
    setDocumentoOpen(true);
  };

  const baixarCsvPedido = () => {
    if (!pedidoAtual) {
      setError('Gere um pedido antes de exportar.');
      return;
    }
    const header = ['Pedido', 'Licitacao', 'Item', 'Unidade', 'Quantidade', 'Valor unitario', 'Valor total', 'Origem interna'];
    const rows = pedidoAtual.itens.map((item) => [
      pedidoAtual.numero,
      licitacaoLabel(item),
      item.descricao,
      item.unidadeMedida,
      item.quantidadeTotal,
      item.valorUnitario,
      item.valorTotal,
      item.origens.map((origem) => `${origem.servicoNome}: ${origem.quantidade}`).join(' | '),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pedidoAtual.numero}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const imprimirDocumentoPedido = () => {
    if (!pedidoAtual) return;
    const linhas = pedidoAtual.itens.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>
          <em>${escapeHtml(licitacaoLabel(item))}</em>
          <strong>${escapeHtml(item.descricao)}</strong>
          <small>${escapeHtml(item.origens.map((origem) => `${origem.servicoNome}: ${Number(origem.quantidade).toLocaleString('pt-BR')}`).join(' | '))}</small>
        </td>
        <td>${escapeHtml(item.unidadeMedida)}</td>
        <td>${Number(item.quantidadeTotal).toLocaleString('pt-BR')}</td>
        <td>${dinheiro(num(item.valorUnitario))}</td>
        <td>${dinheiro(num(item.valorTotal))}</td>
      </tr>
    `).join('');

    const html = `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(pedidoAtual.numero)} - Pedido de Compras</title>
          <style>
            * { box-sizing: border-box; }
            @page { size: A4; margin: 14mm; }
            body { margin: 0; color: #111827; font-family: Arial, sans-serif; background: #fff; }
            .doc { width: 100%; padding: 0; background: #fff; }
            .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #111827; padding-bottom: 18px; }
            .brand h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
            .brand p { margin: 5px 0 0; color: #4b5563; font-size: 12px; }
            .box { border: 1px solid #d1d5db; padding: 10px 12px; min-width: 210px; text-align: right; }
            .box strong { display: block; font-size: 18px; }
            .box span { color: #6b7280; font-size: 11px; text-transform: uppercase; }
            h2 { margin: 26px 0 8px; font-size: 18px; text-transform: uppercase; }
            .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 18px 0; }
            .meta div { border: 1px solid #e5e7eb; padding: 9px; }
            .meta span { display: block; color: #6b7280; font-size: 10px; text-transform: uppercase; }
            .meta strong { display: block; margin-top: 3px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; }
            th { background: #111827; color: #fff; font-size: 10px; text-transform: uppercase; padding: 9px; text-align: left; }
            td { border: 1px solid #e5e7eb; padding: 9px; font-size: 12px; vertical-align: top; }
            td small { display: block; color: #6b7280; margin-top: 4px; line-height: 1.35; }
            td em { display: block; color: #1d4ed8; font-style: normal; font-weight: 700; margin-bottom: 3px; }
            td:nth-child(1), td:nth-child(3), td:nth-child(4), td:nth-child(5), td:nth-child(6) { text-align: right; white-space: nowrap; }
            .total { margin-top: 14px; display: flex; justify-content: flex-end; }
            .total div { min-width: 260px; border: 2px solid #111827; padding: 12px; text-align: right; }
            .total span { display: block; color: #6b7280; font-size: 10px; text-transform: uppercase; }
            .total strong { display: block; margin-top: 4px; font-size: 20px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; margin-top: 70px; }
            .sig { border-top: 1px solid #111827; text-align: center; padding-top: 8px; font-size: 12px; }
          </style>
        </head>
        <body>
          <main class="doc">
            <section class="top">
              <div class="brand">
                <h1>${escapeHtml(session.entity.name)}</h1>
                <p>Secretaria de Obras - Pedido formal para o setor de compras</p>
              </div>
              <div class="box">
                <span>Pedido de compras</span>
                <strong>${escapeHtml(pedidoAtual.numero)}</strong>
                <p>${pedidoAtual.sentAt ? formatarData(pedidoAtual.sentAt) : formatarData(pedidoAtual.createdAt)}</p>
              </div>
            </section>
            <h2>Itens consolidados</h2>
            <div class="meta">
              <div><span>Status</span><strong>${escapeHtml(statusPedidoLabel(pedidoAtual.status))}</strong></div>
              <div><span>Total de itens</span><strong>${pedidoAtual.itens.length}</strong></div>
              <div><span>Emitido por</span><strong>${escapeHtml(session.name)}</strong></div>
              <div><span>Data de emissão</span><strong>${new Date().toLocaleDateString('pt-BR')}</strong></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Descrição / origem interna</th>
                  <th>Unid.</th>
                  <th>Qtd.</th>
                  <th>Valor unit.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>${linhas}</tbody>
            </table>
            <div class="total">
              <div>
                <span>Valor estimado total</span>
                <strong>${dinheiro(num(pedidoAtual.valorTotal))}</strong>
              </div>
            </div>
            <section class="signatures">
              <div class="sig">Secretaria de Obras</div>
              <div class="sig">Setor de Compras</div>
            </section>
          </main>
        </body>
      </html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      iframe.remove();
      setError('Não foi possível preparar o documento para impressão.');
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1000);
    };
  };

  return (
    <div className="tn-page cp-page">
      <section className="cp-hero">
        <div className="cp-hero-grid" />
        <div className="cp-hero-left">
          <div className="cp-eyebrow">
            <ShoppingCart size={15} />
            Central de compras
          </div>
          <h2>Solicitacoes por servico, pedido unico para compras.</h2>
          <p>
            Cada frente de trabalho mantem seu custo interno; a secretaria consolida os itens iguais e acompanha entrega parcial sem perder a origem.
          </p>
          <div className="cp-hero-badges">
            <span><CheckCircle2 size={13} /> {solicitacoes.length} aprovadas</span>
            <span><Boxes size={13} /> {pedidoAtual ? itensExibidos.length : preview.length} itens consolidados</span>
            <span><Truck size={13} /> {pedidoAtual ? statusPedidoLabel(pedidoAtual.status) : 'aguardando pedido'}</span>
          </div>
        </div>
        <div className="cp-flow-board">
          {['Servico', 'Aprovacao', 'Consolidacao', 'Pedido', 'Baixa'].map((label, index) => (
            <div key={label} className="cp-flow-step" style={{ '--step-delay': `${index * 0.08}s` } as React.CSSProperties}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
              {index < 4 ? <ArrowRight size={14} /> : null}
            </div>
          ))}
        </div>
      </section>

      {error ? <div className="tn-alert">{error}</div> : null}

      <div className="cp-kpi-grid">
        <div className="cp-kpi-card tone-blue">
          <FileText size={20} />
          <span>Solicitacoes aprovadas</span>
          <strong>{loading ? '...' : solicitacoes.length}</strong>
          <small>Prontas para consolidar</small>
        </div>
        <div className="cp-kpi-card tone-green">
          <FileSpreadsheet size={20} />
          <span>Valor selecionado</span>
          <strong>{dinheiro(valorSelecionado)}</strong>
          <small>Estimativa antes do envio</small>
        </div>
        <div className="cp-kpi-card tone-cyan">
          <PackageSearch size={20} />
          <span>Pedidos gerados</span>
          <strong>{pedidos.length}</strong>
          <small>Histórico recente</small>
        </div>
        <div className="cp-kpi-card tone-amber">
          <PackageCheck size={20} />
          <span>Recebido</span>
          <strong>{dinheiro(totalRecebido)}</strong>
          <small>Baixas registradas</small>
        </div>
      </div>

      <div className="cp-workspace">
        <section className="tn-panel cp-panel cp-requests-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left">
              <span>Solicitacoes dos servicos</span>
              <h3>Selecione para consolidar</h3>
            </div>
            <button type="button" className="tn-btn-secondary" onClick={() => setSelecionadas(solicitacoes.map((item) => item.id))}>
              <ClipboardCheck size={14} />
              Todas
            </button>
          </div>
          <div className="cp-request-list">
            {loading ? <div className="tn-skeleton-row" /> : null}
            {!loading && solicitacoes.length === 0 ? (
              <div className="tn-empty cp-empty-state">
                <strong>Nenhuma solicitação aprovada</strong>
              </div>
            ) : null}
            {solicitacoes.map((solicitacao) => {
              const servico = getServico(solicitacao.servicoSlug);
              const checked = selecionadas.includes(solicitacao.id);
              return (
                <button
                  type="button"
                  key={solicitacao.id}
                  className={`cp-select-row${checked ? ' is-selected' : ''}`}
                  style={{ '--cp-accent': servico.cor } as React.CSSProperties}
                  onClick={() => toggleSelecionada(solicitacao.id)}
                >
                  <span className="cp-select-check">{checked ? <CheckCircle2 size={15} /> : null}</span>
                  <span className="cp-select-icon">{servico.icon}</span>
                  <span className="cp-select-main">
                    <strong>{solicitacao.numero}</strong>
                    <small>{solicitacao.servicoNome} - {solicitacao.licitacao.identificacao}</small>
                  </span>
                  <span className="cp-select-cost">{dinheiro(num(solicitacao.valorTotal))}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="tn-panel cp-panel cp-consolidated-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left">
              <span>Pedido de compras</span>
              <h3>{pedidoAtual ? pedidoAtual.numero : 'Previa consolidada'}</h3>
            </div>
            <div className="cp-panel-actions">
              <button type="button" className="tn-btn-secondary" onClick={abrirDocumentoPedido} disabled={!pedidoAtual}>
                <FileText size={14} />
                Documento
              </button>
              <button type="button" className="tn-btn-secondary" onClick={baixarCsvPedido} disabled={!pedidoAtual}>
                <Download size={14} />
                Excel
              </button>
              <button type="button" className="tn-btn-blue" onClick={() => void gerarPedido()} disabled={saving || selecionadas.length === 0}>
                <Send size={14} />
                {saving ? 'Processando...' : 'Gerar pedido'}
              </button>
            </div>
          </div>

          {pedidoAtual ? (
            <div className="cp-pedido-ribbon">
              <span className="tn-chip dot-blue-p"><i />{statusPedidoLabel(pedidoAtual.status)}</span>
              <span>{pedidoAtual.sentAt ? `Enviado em ${formatarData(pedidoAtual.sentAt)}` : 'Ainda nao enviado'}</span>
              <strong>{dinheiro(num(pedidoAtual.valorTotal))}</strong>
            </div>
          ) : null}

          <div className="cp-consolidated-table">
            <div className="cp-table-head">
              <span>Item</span>
              <span>Pedido</span>
              <span>Recebido</span>
              <span>Pendente</span>
              <span>Total</span>
            </div>
            {pedidoAtual ? itensExibidos.map((item) => (
              <div key={item.id} className="cp-table-row">
                <div>
                  <strong>{item.descricao}</strong>
                  <small>{licitacaoLabel(item)}</small>
                  <small>{item.origens.map((origem) => `${origem.servicoNome}: ${Number(origem.quantidade).toLocaleString('pt-BR')}`).join(' | ')}</small>
                </div>
                <span>{Number(item.quantidadeTotal).toLocaleString('pt-BR')} {item.unidadeMedida}</span>
                <span className={num(item.quantidadeRecebida) > 0 ? 'is-ok' : ''}>{Number(item.quantidadeRecebida).toLocaleString('pt-BR')} {item.unidadeMedida}</span>
                <span className={num(item.quantidadePendente) > 0 ? 'is-pending' : ''}>{Number(item.quantidadePendente).toLocaleString('pt-BR')} {item.unidadeMedida}</span>
                <strong>{dinheiro(num(item.valorTotal))}</strong>
              </div>
            )) : preview.map((item) => (
              <div key={item.licitacaoItemId} className="cp-table-row">
                <div>
                  <strong>{item.descricao}</strong>
                  <small>{item.origens.map((origem) => `${origem.servicoNome}: ${origem.quantidade.toLocaleString('pt-BR')}`).join(' | ')}</small>
                </div>
                <span>{item.quantidadeTotal.toLocaleString('pt-BR')} {item.unidadeMedida}</span>
                <span>0 {item.unidadeMedida}</span>
                <span className="is-pending">{item.quantidadeTotal.toLocaleString('pt-BR')} {item.unidadeMedida}</span>
                <strong>{dinheiro(item.valorTotal)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="tn-panel cp-panel cp-receipt-panel">
        <div className="tn-panel-head">
          <div className="tn-panel-head-left">
            <span>Baixa de entrega</span>
            <h3>Recebimento parcial com origem por servico</h3>
          </div>
          <button type="button" className="tn-btn-blue" onClick={() => void registrarEntrega()} disabled={!pedidoAtual || saving}>
            <Truck size={14} />
            Registrar entrega
          </button>
        </div>
        <div className="cp-receipt-grid">
          {(pedidoAtual?.itens ?? []).slice(0, 3).map((item) => {
            const percentual = num(item.quantidadeTotal) ? Math.min(100, Math.round((num(item.quantidadeRecebida) / num(item.quantidadeTotal)) * 100)) : 0;
            return (
              <article key={item.id} className="cp-receipt-card">
                <div className="cp-receipt-card-head">
                  <PackageCheck size={18} />
                  <span>{percentual}% recebido</span>
                </div>
                <strong>{item.descricao}</strong>
                <div className="cp-progress">
                  <i style={{ width: `${percentual}%` }} />
                </div>
                <div className="cp-receipt-numbers">
                  <span>Pedido: {Number(item.quantidadeTotal).toLocaleString('pt-BR')}</span>
                  <span>Entregue: {Number(item.quantidadeRecebida).toLocaleString('pt-BR')}</span>
                  <span>Pendente: {Number(item.quantidadePendente).toLocaleString('pt-BR')}</span>
                </div>
                <div className="cp-origin-stack">
                  {item.origens.map((origem) => (
                    <span key={origem.id}>
                      {origem.servicoNome}
                      <strong>{Number(origem.quantidade).toLocaleString('pt-BR')}</strong>
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
          {!pedidoAtual ? (
            <div className="tn-empty cp-empty-state">
              <strong>Gere um pedido para registrar entregas</strong>
            </div>
          ) : null}
        </div>
      </section>

      {documentoOpen && pedidoAtual ? (
        <div className="cp-doc-backdrop">
          <div className="cp-doc-shell">
            <div className="cp-doc-actions">
              <button type="button" className="tn-btn-secondary" onClick={() => setDocumentoOpen(false)}>
                Fechar
              </button>
              <button type="button" className="tn-btn-blue" onClick={imprimirDocumentoPedido}>
                Imprimir / salvar PDF
              </button>
            </div>
            <main className="cp-doc-print">
              <section className="cp-doc-top">
                <div>
                  <h1>{session.entity.name}</h1>
                  <p>Secretaria de Obras - Pedido formal para o setor de compras</p>
                </div>
                <div className="cp-doc-number">
                  <span>Pedido de compras</span>
                  <strong>{pedidoAtual.numero}</strong>
                  <p>{pedidoAtual.sentAt ? formatarData(pedidoAtual.sentAt) : formatarData(pedidoAtual.createdAt)}</p>
                </div>
              </section>
              <h2>Itens consolidados</h2>
              <div className="cp-doc-meta">
                <div><span>Status</span><strong>{statusPedidoLabel(pedidoAtual.status)}</strong></div>
                <div><span>Total de itens</span><strong>{pedidoAtual.itens.length}</strong></div>
                <div><span>Emitido por</span><strong>{session.name}</strong></div>
                <div><span>Data de emissão</span><strong>{new Date().toLocaleDateString('pt-BR')}</strong></div>
              </div>
              <table className="cp-doc-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Descrição / origem interna</th>
                    <th>Unid.</th>
                    <th>Qtd.</th>
                    <th>Valor unit.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidoAtual.itens.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <em className="cp-doc-lic">{licitacaoLabel(item)}</em>
                        <strong>{item.descricao}</strong>
                        <small>{item.origens.map((origem) => `${origem.servicoNome}: ${Number(origem.quantidade).toLocaleString('pt-BR')}`).join(' | ')}</small>
                      </td>
                      <td>{item.unidadeMedida}</td>
                      <td>{Number(item.quantidadeTotal).toLocaleString('pt-BR')}</td>
                      <td>{dinheiro(num(item.valorUnitario))}</td>
                      <td>{dinheiro(num(item.valorTotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="cp-doc-total">
                <div>
                  <span>Valor estimado total</span>
                  <strong>{dinheiro(num(pedidoAtual.valorTotal))}</strong>
                </div>
              </div>
              <section className="cp-doc-signatures">
                <div>Secretaria de Obras</div>
                <div>Setor de Compras</div>
              </section>
            </main>
          </div>
        </div>
      ) : null}
    </div>
  );
}
