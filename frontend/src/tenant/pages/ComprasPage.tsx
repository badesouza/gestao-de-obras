import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Layers3,
  PackageCheck,
  PackageSearch,
  Send,
  ShoppingCart,
  Target,
  TrendingUp,
  Trash2,
  Truck,
} from 'lucide-react';
import { tenantApi, type CompraSolicitacao, type PedidoCompra } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { dinheiro, formatarData, getServico } from '../components/compras-data';
import { ConfirmModal } from '../components/ConfirmModal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

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

function pct(recebido: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((recebido / total) * 100));
}

function mesCurto(iso: string | null | undefined): string {
  const data = iso ? new Date(iso) : new Date();
  return data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

function diasEntre(inicio: string | null | undefined, fim: string | null | undefined): number | null {
  if (!inicio || !fim) return null;
  const start = new Date(inicio).getTime();
  const end = new Date(fim).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.max(0, Math.round((end - start) / 86400000));
}

function AnaliseCompras({
  solicitacoes,
  pedidos,
}: {
  solicitacoes: CompraSolicitacao[];
  pedidos: PedidoCompra[];
}) {
  const analytics = useMemo(() => {
    const totalPedidos = pedidos.reduce((sum, pedido) => sum + num(pedido.valorTotal), 0);
    const totalRecebido = pedidos.reduce(
      (sum, pedido) => sum + pedido.itens.reduce(
        (itemSum, item) => itemSum + num(item.quantidadeRecebida) * num(item.valorUnitario),
        0,
      ),
      0,
    );
    const totalPendente = pedidos.reduce(
      (sum, pedido) => sum + pedido.itens.reduce(
        (itemSum, item) => itemSum + num(item.quantidadePendente) * num(item.valorUnitario),
        0,
      ),
      0,
    );
    const statusCount = pedidos.reduce<Record<string, number>>((acc, pedido) => {
      acc[pedido.status] = (acc[pedido.status] ?? 0) + 1;
      return acc;
    }, {});
    const servicos = new Map<string, {
      slug: string;
      nome: string;
      valorPedido: number;
      valorRecebido: number;
      valorPendente: number;
      itens: number;
      pedidos: Set<string>;
    }>();
    const categorias = new Map<string, {
      nome: string;
      valorPedido: number;
      valorRecebido: number;
      valorPendente: number;
      itens: number;
    }>();
    const periodos = new Map<string, {
      label: string;
      sortKey: string;
      valorPedido: number;
      valorRecebido: number;
      valorPendente: number;
      pedidos: number;
    }>();
    const licitacoes = new Map<string, {
      nome: string;
      objeto: string;
      valorPedido: number;
      valorRecebido: number;
      pedidos: Set<string>;
    }>();
    const ciclosRecebimento: number[] = [];

    pedidos.forEach((pedido) => {
      const dataBase = pedido.sentAt ?? pedido.createdAt;
      const periodoKey = dataBase.slice(0, 7);
      const periodo = periodos.get(periodoKey) ?? {
        label: mesCurto(dataBase),
        sortKey: periodoKey,
        valorPedido: 0,
        valorRecebido: 0,
        valorPendente: 0,
        pedidos: 0,
      };
      periodo.valorPedido += num(pedido.valorTotal);
      periodo.pedidos += 1;
      periodos.set(periodoKey, periodo);

      pedido.itens.forEach((item) => {
        const quantidadeTotal = num(item.quantidadeTotal);
        const quantidadeRecebida = num(item.quantidadeRecebida);
        const valorRecebidoItem = quantidadeRecebida * num(item.valorUnitario);
        const valorPendenteItem = num(item.quantidadePendente) * num(item.valorUnitario);
        periodo.valorRecebido += valorRecebidoItem;
        periodo.valorPendente += valorPendenteItem;

        const categoriaNome = item.categoria || 'Sem categoria';
        const categoria = categorias.get(categoriaNome) ?? {
          nome: categoriaNome,
          valorPedido: 0,
          valorRecebido: 0,
          valorPendente: 0,
          itens: 0,
        };
        categoria.valorPedido += num(item.valorTotal);
        categoria.valorRecebido += valorRecebidoItem;
        categoria.valorPendente += valorPendenteItem;
        categoria.itens += 1;
        categorias.set(categoriaNome, categoria);

        const licitacaoNome = item.licitacao?.identificacao ?? 'Licitacao nao informada';
        const licitacao = licitacoes.get(licitacaoNome) ?? {
          nome: licitacaoNome,
          objeto: item.licitacao?.objeto ?? '',
          valorPedido: 0,
          valorRecebido: 0,
          pedidos: new Set<string>(),
        };
        licitacao.valorPedido += num(item.valorTotal);
        licitacao.valorRecebido += valorRecebidoItem;
        licitacao.pedidos.add(pedido.id);
        licitacoes.set(licitacaoNome, licitacao);

        item.recebimentos.forEach((recebimento) => {
          const dias = diasEntre(dataBase, recebimento.recebidoEm);
          if (dias !== null) ciclosRecebimento.push(dias);
        });

        item.origens.forEach((origem) => {
          const atual = servicos.get(origem.servicoSlug) ?? {
            slug: origem.servicoSlug,
            nome: origem.servicoNome,
            valorPedido: 0,
            valorRecebido: 0,
            valorPendente: 0,
            itens: 0,
            pedidos: new Set<string>(),
          };
          const proporcao = quantidadeTotal > 0 ? num(origem.quantidade) / quantidadeTotal : 0;
          const valorPedido = num(origem.valorTotal) || num(origem.quantidade) * num(item.valorUnitario);
          const valorRecebido = quantidadeRecebida * proporcao * num(item.valorUnitario);
          atual.valorPedido += valorPedido;
          atual.valorRecebido += valorRecebido;
          atual.valorPendente += Math.max(valorPedido - valorRecebido, 0);
          atual.itens += 1;
          atual.pedidos.add(pedido.id);
          servicos.set(origem.servicoSlug, atual);
        });
      });
    });

    solicitacoes.forEach((solicitacao) => {
      if (servicos.has(solicitacao.servicoSlug)) return;
      servicos.set(solicitacao.servicoSlug, {
        slug: solicitacao.servicoSlug,
        nome: solicitacao.servicoNome,
        valorPedido: 0,
        valorRecebido: 0,
        valorPendente: 0,
        itens: solicitacao.itens.length,
        pedidos: new Set<string>(),
      });
    });

    const servicosLista = Array.from(servicos.values())
      .map((servico) => ({ ...servico, pedidos: servico.pedidos.size }))
      .sort((a, b) => b.valorPendente - a.valorPendente || b.valorPedido - a.valorPedido);
    const servicosExecutados = [...servicosLista].sort((a, b) => b.valorRecebido - a.valorRecebido || b.valorPedido - a.valorPedido);
    const categoriasLista = Array.from(categorias.values()).sort((a, b) => b.valorPedido - a.valorPedido);
    const periodosLista = Array.from(periodos.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(-6);
    const licitacoesLista = Array.from(licitacoes.values())
      .map((licitacao) => ({ ...licitacao, pedidos: licitacao.pedidos.size }))
      .sort((a, b) => b.valorPedido - a.valorPedido)
      .slice(0, 4);
    const curvaAbc = pedidos
      .flatMap((pedido) => pedido.itens.map((item) => ({
        id: item.id,
        descricao: item.descricao,
        categoria: item.categoria || 'Sem categoria',
        valor: num(item.valorTotal),
      })))
      .sort((a, b) => b.valor - a.valor)
      .reduce<Array<{ id: string; descricao: string; categoria: string; valor: number; acumulado: number; classe: 'A' | 'B' | 'C' }>>((acc, item) => {
        const acumuladoAnterior = acc.at(-1)?.acumulado ?? 0;
        const acumulado = totalPedidos > 0 ? acumuladoAnterior + (item.valor / totalPedidos) * 100 : 0;
        acc.push({
          ...item,
          acumulado,
          classe: acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C',
        });
        return acc;
      }, [])
      .slice(0, 5);
    const itensCriticos = pedidos
      .flatMap((pedido) => pedido.itens.map((item) => ({
        id: item.id,
        pedido: pedido.numero,
        descricao: item.descricao,
        unidade: item.unidadeMedida,
        licitacao: licitacaoLabel(item),
        quantidadePendente: num(item.quantidadePendente),
        valorPendente: num(item.quantidadePendente) * num(item.valorUnitario),
      })))
      .filter((item) => item.quantidadePendente > 0)
      .sort((a, b) => b.valorPendente - a.valorPendente)
      .slice(0, 5);
    const ultimosRecebimentos = pedidos
      .flatMap((pedido) => pedido.itens.flatMap((item) => item.recebimentos.map((recebimento) => ({
        id: recebimento.id,
        pedido: pedido.numero,
        descricao: item.descricao,
        quantidade: num(recebimento.quantidade),
        unidade: item.unidadeMedida,
        valor: num(recebimento.quantidade) * num(item.valorUnitario),
        responsavel: recebimento.responsavel,
        recebidoEm: recebimento.recebidoEm,
      }))))
      .sort((a, b) => new Date(b.recebidoEm).getTime() - new Date(a.recebidoEm).getTime())
      .slice(0, 5);

    return {
      totalPedidos,
      totalRecebido,
      totalPendente,
      statusCount,
      servicosLista,
      servicosExecutados,
      categoriasLista,
      periodosLista,
      licitacoesLista,
      curvaAbc,
      itensCriticos,
      ultimosRecebimentos,
      pctRecebido: pct(totalRecebido, totalPedidos),
      ticketMedio: pedidos.length > 0 ? totalPedidos / pedidos.length : 0,
      cicloMedio: ciclosRecebimento.length > 0
        ? Math.round(ciclosRecebimento.reduce((sum, dias) => sum + dias, 0) / ciclosRecebimento.length)
        : 0,
    };
  }, [pedidos, solicitacoes]);

  const maiorServico = analytics.servicosLista[0];
  const maiorCategoria = analytics.categoriasLista[0];
  const maiorPeriodo = analytics.periodosLista.reduce(
    (best, periodo) => (periodo.valorPedido > (best?.valorPedido ?? 0) ? periodo : best),
    analytics.periodosLista[0],
  );

  return (
    <section className="cp-analytics">
      <div className="cp-kpi-grid cp-analysis-kpis">
        <div className="cp-kpi-card tone-blue">
          <TrendingUp size={20} />
          <span>Compras executadas</span>
          <strong>{dinheiro(analytics.totalRecebido)}</strong>
          <small>{analytics.pctRecebido}% liquidado nos pedidos</small>
        </div>
        <div className="cp-kpi-card tone-green">
          <Layers3 size={20} />
          <span>Categoria lider</span>
          <strong>{maiorCategoria ? dinheiro(maiorCategoria.valorPedido) : dinheiro(0)}</strong>
          <small>{maiorCategoria?.nome ?? 'Sem compras categorizadas'}</small>
        </div>
        <div className="cp-kpi-card tone-amber">
          <Target size={20} />
          <span>Servico mais acionado</span>
          <strong>{maiorServico ? dinheiro(maiorServico.valorPedido) : dinheiro(0)}</strong>
          <small>{maiorServico?.nome ?? 'Sem servico no periodo'}</small>
        </div>
        <div className="cp-kpi-card tone-cyan">
          <CalendarDays size={20} />
          <span>Ciclo medio</span>
          <strong>{analytics.cicloMedio} dias</strong>
          <small>Do pedido ao recebimento registrado</small>
        </div>
      </div>

      <section className="tn-panel cp-panel cp-tactical-panel">
        <div className="tn-panel-head">
          <div className="tn-panel-head-left">
            <span>Analise tatica</span>
            <h3>Diretriz de compras</h3>
          </div>
          {maiorPeriodo ? <span className="tn-chip dot-blue-p"><i />Pico: {maiorPeriodo.label}</span> : null}
        </div>
        <div className="cp-tactical-grid">
          <div className="cp-tactical-block cp-evolution-block">
            <div className="cp-block-title">
              <span>Evolucao</span>
              <strong>Compras por periodo</strong>
            </div>
            <div className="cp-evolution-chart">
              {analytics.periodosLista.length === 0 ? (
                <div className="tn-empty cp-empty-state"><strong>Nenhum pedido no historico</strong></div>
              ) : analytics.periodosLista.map((periodo) => {
                const max = Math.max(...analytics.periodosLista.map((item) => item.valorPedido), 1);
                const height = Math.max(12, (periodo.valorPedido / max) * 100);
                return (
                  <div key={periodo.sortKey} className="cp-evolution-bar">
                    <span>{dinheiro(periodo.valorPedido)}</span>
                    <i style={{ height: `${height}%` }}><em style={{ height: `${pct(periodo.valorRecebido, periodo.valorPedido)}%` }} /></i>
                    <b>{periodo.label}</b>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cp-tactical-block">
            <div className="cp-block-title">
              <span>Categorias</span>
              <strong>Valor contratado</strong>
            </div>
            <div className="cp-ranked-list">
              {analytics.categoriasLista.length === 0 ? (
                <div className="tn-empty cp-empty-state"><strong>Nenhuma categoria para analisar</strong></div>
              ) : analytics.categoriasLista.slice(0, 5).map((categoria, index) => (
                <div key={categoria.nome} className="cp-ranked-row">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{categoria.nome}</strong>
                    <small>{categoria.itens} itens - {pct(categoria.valorRecebido, categoria.valorPedido)}% recebido</small>
                  </div>
                  <b>{dinheiro(categoria.valorPedido)}</b>
                  <i><em style={{ width: `${pct(categoria.valorPedido, analytics.totalPedidos)}%` }} /></i>
                </div>
              ))}
            </div>
          </div>

          <div className="cp-tactical-block">
            <div className="cp-block-title">
              <span>Execucao</span>
              <strong>Servicos por valor recebido</strong>
            </div>
            <div className="cp-service-bars cp-compact-bars">
              {analytics.servicosExecutados.length === 0 ? (
                <div className="tn-empty cp-empty-state"><strong>Nenhum valor executado</strong></div>
              ) : analytics.servicosExecutados.slice(0, 5).map((servico) => {
                const config = getServico(servico.slug);
                const width = analytics.totalRecebido > 0 ? Math.max(6, (servico.valorRecebido / analytics.totalRecebido) * 100) : 0;
                return (
                  <div key={servico.slug} className="cp-service-bar" style={{ '--cp-accent': config.cor } as React.CSSProperties}>
                    <div><strong>{servico.nome}</strong><span>{servico.pedidos} pedidos - {pct(servico.valorRecebido, servico.valorPedido)}% executado</span></div>
                    <b>{dinheiro(servico.valorRecebido)}</b>
                    <i><em style={{ width: `${width}%` }} /></i>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cp-tactical-block">
            <div className="cp-block-title">
              <span>Curva ABC</span>
              <strong>Itens que concentram valor</strong>
            </div>
            <div className="cp-abc-list">
              {analytics.curvaAbc.length === 0 ? (
                <div className="tn-empty cp-empty-state"><strong>Nenhum item consolidado</strong></div>
              ) : analytics.curvaAbc.map((item) => (
                <div key={item.id} className={`cp-abc-row class-${item.classe.toLowerCase()}`}>
                  <span>{item.classe}</span>
                  <div><strong>{item.descricao}</strong><small>{item.categoria} - {Math.round(item.acumulado)}% acumulado</small></div>
                  <b>{dinheiro(item.valor)}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="cp-analysis-grid">
        <section className="tn-panel cp-panel cp-analysis-progress">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left">
              <span>Acompanhamento operacional</span>
              <h3>Recebimento dos pedidos</h3>
            </div>
            <span className="tn-chip dot-blue-p"><i />{analytics.pctRecebido}% recebido</span>
          </div>
          <div className="cp-analysis-meter">
            <div><span>Pedido</span><strong>{dinheiro(analytics.totalPedidos)}</strong></div>
            <div><span>Recebido</span><strong className="is-ok">{dinheiro(analytics.totalRecebido)}</strong></div>
            <div><span>Pendente</span><strong className="is-pending">{dinheiro(analytics.totalPendente)}</strong></div>
          </div>
          <div className="cp-analysis-progressbar" aria-label="Progresso financeiro recebido">
            <i style={{ width: `${analytics.pctRecebido}%` }} />
          </div>
          <div className="cp-status-strip">
            {(['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED'] as const).map((status) => (
              <span key={status}><strong>{analytics.statusCount[status] ?? 0}</strong>{statusPedidoLabel(status)}</span>
            ))}
          </div>
        </section>

        <section className="tn-panel cp-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left">
              <span>Saldo operacional</span>
              <h3>Servicos por valor pendente</h3>
            </div>
            {maiorServico ? <span className="tn-chip dot-gray"><i />{maiorServico.nome}</span> : null}
          </div>
          <div className="cp-service-bars">
            {analytics.servicosLista.length === 0 ? (
              <div className="tn-empty cp-empty-state"><strong>Nenhum valor para analisar</strong></div>
            ) : analytics.servicosLista.slice(0, 6).map((servico) => {
              const config = getServico(servico.slug);
              const width = analytics.totalPendente > 0 ? Math.max(6, (servico.valorPendente / analytics.totalPendente) * 100) : 0;
              return (
                <div key={servico.slug} className="cp-service-bar" style={{ '--cp-accent': config.cor } as React.CSSProperties}>
                  <div><strong>{servico.nome}</strong><span>{servico.itens} itens - {servico.pedidos} pedidos</span></div>
                  <b>{dinheiro(servico.valorPendente)}</b>
                  <i><em style={{ width: `${width}%` }} /></i>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="cp-analysis-grid">
        <section className="tn-panel cp-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left"><span>Itens criticos</span><h3>Maiores saldos em aberto</h3></div>
          </div>
          <div className="cp-analysis-table">
            {analytics.itensCriticos.length === 0 ? (
              <div className="tn-empty cp-empty-state"><strong>Nenhum item pendente</strong></div>
            ) : analytics.itensCriticos.map((item) => (
              <div key={item.id} className="cp-analysis-row">
                <div><strong>{item.descricao}</strong><small>{item.pedido} - {item.licitacao}</small></div>
                <span>{item.quantidadePendente.toLocaleString('pt-BR')} {item.unidade}</span>
                <b>{dinheiro(item.valorPendente)}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="tn-panel cp-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left"><span>Contratos e licitacoes</span><h3>Concentracao de compras</h3></div>
          </div>
          <div className="cp-analysis-table">
            {analytics.licitacoesLista.length === 0 ? (
              <div className="tn-empty cp-empty-state"><strong>Nenhuma licitacao vinculada</strong></div>
            ) : analytics.licitacoesLista.map((licitacao) => (
              <div key={licitacao.nome} className="cp-analysis-row">
                <div><strong>{licitacao.nome}</strong><small>{licitacao.objeto || `${licitacao.pedidos} pedidos vinculados`}</small></div>
                <span>{pct(licitacao.valorRecebido, licitacao.valorPedido)}% recebido</span>
                <b>{dinheiro(licitacao.valorPedido)}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="cp-analysis-grid">

        <section className="tn-panel cp-panel">
          <div className="tn-panel-head">
            <div className="tn-panel-head-left"><span>Ultimas baixas</span><h3>Recebimentos registrados</h3></div>
          </div>
          <div className="cp-analysis-table">
            {analytics.ultimosRecebimentos.length === 0 ? (
              <div className="tn-empty cp-empty-state"><strong>Nenhuma baixa registrada</strong></div>
            ) : analytics.ultimosRecebimentos.map((recebimento) => (
              <div key={recebimento.id} className="cp-analysis-row">
                <div><strong>{recebimento.descricao}</strong><small>{recebimento.pedido} - {recebimento.responsavel} - {formatarData(recebimento.recebidoEm)}</small></div>
                <span>{recebimento.quantidade.toLocaleString('pt-BR')} {recebimento.unidade}</span>
                <b className="is-ok">{dinheiro(recebimento.valor)}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Modal de detalhe de pedido
───────────────────────────────────────────────────────────── */
function PedidoDetalheModal({
  pedido,
  onClose,
  onRegistrar,
  saving,
}: {
  pedido: PedidoCompra;
  onClose: () => void;
  onRegistrar: () => void;
  saving: boolean;
}) {
  const [aba, setAba] = useState<'itens' | 'historico'>('itens');

  const temPendente = pedido.itens.some((i) => num(i.quantidadePendente) > 0);

  const historico = pedido.itens
    .flatMap((item) =>
      item.recebimentos.map((r) => ({
        ...r,
        itemDescricao: item.descricao,
        unidadeMedida: item.unidadeMedida,
        valorUnitario: item.valorUnitario,
        itemOrigens: item.origens,
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalRecebidoValor = pedido.itens.reduce(
    (s, i) => s + num(i.quantidadeRecebida) * num(i.valorUnitario), 0
  );
  const pctGeral = num(pedido.quantidadeTotal) > 0
    ? Math.min(100, Math.round((num(pedido.quantidadeRecebida) / num(pedido.quantidadeTotal)) * 100))
    : 0;

  return createPortal(
    <div className="cp-baixa-backdrop" onClick={onClose}>
      <div
        className="cp-baixa-modal cp-pedido-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* cabeçalho */}
        <div className="cp-baixa-head" style={{ flexShrink: 0 }}>
          <div className="cp-baixa-icon"><FileText size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span>Detalhe do pedido</span>
            <h3>{pedido.numero}</h3>
          </div>
          {/* resumo rápido */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <span className={`tn-chip ${pedido.status === 'RECEIVED' ? 'dot-green' : pedido.status === 'PARTIAL' ? 'dot-blue' : pedido.status === 'SENT' ? 'dot-blue' : 'dot-gray'}`}>
              <i />{statusPedidoLabel(pedido.status)}
            </span>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Valor total</span>
              <strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#0f172a' }}>{dinheiro(num(pedido.valorTotal))}</strong>
            </div>
          </div>
          <button type="button" className="sv-modal-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* barra de progresso geral */}
        <div style={{ padding: '10px 20px 0', flexShrink: 0, background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>Progresso geral de recebimento</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: pctGeral === 100 ? '#16a34a' : '#2563eb' }}>{pctGeral}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%', width: `${pctGeral}%`, borderRadius: 99,
              background: pctGeral === 100 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#2563eb,#60a5fa)',
              transition: 'width 0.4s ease',
              boxShadow: pctGeral > 0 ? '0 0 8px rgba(37,99,235,0.3)' : 'none',
            }} />
          </div>

          {/* abas */}
          <div style={{ display: 'flex', gap: 0 }}>
            {([
              { id: 'itens' as const, label: 'Itens', icon: <PackageSearch size={13} />, badge: 0 },
              { id: 'historico' as const, label: 'Recebimentos', icon: <PackageCheck size={13} />, badge: historico.length },
            ]).map((tab) => (
              <button key={tab.id} type="button" onClick={() => setAba(tab.id)} style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                border: 'none', background: 'none', marginBottom: -1,
                borderBottom: `3px solid ${aba === tab.id ? '#2563eb' : 'transparent'}`,
                color: aba === tab.id ? '#2563eb' : '#64748b',
                display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
              }}>
                {tab.icon}{tab.label}
                {tab.badge > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 99, background: aba === tab.id ? '#eff6ff' : '#f1f5f9', color: aba === tab.id ? '#2563eb' : '#64748b', border: `1px solid ${aba === tab.id ? '#bfdbfe' : '#e2e8f0'}` }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* conteúdo */}
        <div className="cp-pedido-modal-body">

          {/* ABA ITENS */}
          {aba === 'itens' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '38%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#fafbfc' }}>
                  {['Item / Serviços', 'Pedido', 'Entregue', 'Pendente', 'Valor unit.', 'Total'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: i >= 1 ? 'center' : 'left', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedido.itens.map((item, idx) => {
                  const pendente = num(item.quantidadePendente);
                  const recebida = num(item.quantidadeRecebida);
                  const total = num(item.quantidadeTotal);
                  const pct = total > 0 ? Math.min(100, Math.round((recebida / total) * 100)) : 0;
                  const concluido = pct === 100;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc', background: idx % 2 === 0 ? '#fff' : '#fafcff' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <strong style={{ fontSize: 13, color: '#0f172a', display: 'block', marginBottom: 4 }}>{item.descricao}</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                          {item.origens.map((o) => {
                            const sv = getServico(o.servicoSlug);
                            return (
                              <span key={o.id} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: `${sv.cor ?? '#2563eb'}12`, color: sv.cor ?? '#2563eb', border: `1px solid ${sv.cor ?? '#2563eb'}25` }}>
                                {o.servicoNome}: {Number(o.quantidade).toLocaleString('pt-BR')}
                              </span>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: concluido ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#2563eb,#60a5fa)', transition: 'width 0.4s ease' }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 800, color: concluido ? '#16a34a' : '#64748b', minWidth: 30 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
                        {Number(item.quantidadeTotal).toLocaleString('pt-BR')}
                        <span style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>{item.unidadeMedida}</span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', color: recebida > 0 ? '#16a34a' : '#94a3b8' }}>
                        {recebida.toLocaleString('pt-BR')}
                        <span style={{ fontSize: 10, color: '#94a3b8', display: 'block' }}>{item.unidadeMedida}</span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 8, fontFamily: 'monospace', background: pendente > 0 ? '#fff7ed' : '#f0fdf4', color: pendente > 0 ? '#ea580c' : '#16a34a', border: `1.5px solid ${pendente > 0 ? '#fed7aa' : '#bbf7d0'}` }}>
                          {pendente.toLocaleString('pt-BR')}
                        </span>
                        <span style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginTop: 2 }}>{item.unidadeMedida}</span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 700, color: '#16a34a', fontFamily: 'monospace' }}>
                        {dinheiro(num(item.valorUnitario))}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                        {dinheiro(num(item.valorTotal))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* ABA RECEBIMENTOS */}
          {aba === 'historico' && (
            historico.length === 0 ? (
              <div className="tn-empty cp-empty-state">
                <PackageCheck size={32} style={{ color: '#cbd5e1', marginBottom: 8 }} />
                <strong>Nenhum recebimento registrado</strong>
                <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Após registrar uma entrega ela aparecerá aqui.</span>
              </div>
            ) : (
              <div style={{ padding: '4px 0' }}>
                {historico.map((rec, idx) => {
                  const valor = num(rec.quantidade) * num(rec.valorUnitario);
                  return (
                    <div key={rec.id}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: idx < historico.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.12s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#16a34a' }}>
                        <Truck size={15} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>{rec.itemDescricao}</strong>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 8px', borderRadius: 99, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontFamily: 'monospace' }}>
                            +{num(rec.quantidade).toLocaleString('pt-BR')} {rec.unidadeMedida}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {new Date(rec.recebidoEm).toLocaleDateString('pt-BR')}
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            {rec.responsavel}
                          </span>
                          {rec.itemOrigens.map((o) => {
                            const sv = getServico(o.servicoSlug);
                            return (
                              <span key={o.id} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: `${sv.cor ?? '#2563eb'}12`, color: sv.cor ?? '#2563eb', border: `1px solid ${sv.cor ?? '#2563eb'}25` }}>
                                {o.servicoNome}
                              </span>
                            );
                          })}
                          {rec.observacoes && <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>"{rec.observacoes}"</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <strong style={{ fontSize: 14, fontFamily: 'monospace', color: '#16a34a', display: 'block' }}>{dinheiro(valor)}</strong>
                        <span style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(rec.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 20px', borderTop: '2px solid #f1f5f9', gap: 12, background: '#fafbfc' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{historico.length} {historico.length === 1 ? 'recebimento' : 'recebimentos'}</span>
                  <div style={{ width: 1, height: 16, background: '#e2e8f0' }} />
                  <strong style={{ fontSize: 15, fontFamily: 'monospace', color: '#16a34a' }}>{dinheiro(totalRecebidoValor)}</strong>
                </div>
              </div>
            )
          )}
        </div>

        {/* rodapé */}
        <div className="cp-pedido-modal-footer">
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', display: 'block' }}>Recebido</span>
              <strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#16a34a' }}>{dinheiro(totalRecebidoValor)}</strong>
            </div>
            <div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', display: 'block' }}>Pendente</span>
              <strong style={{ fontFamily: 'monospace', fontSize: 14, color: '#ea580c' }}>{dinheiro(num(pedido.valorTotal) - totalRecebidoValor)}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="tn-btn-secondary" onClick={onClose}>Fechar</button>
            {temPendente && (
              <button type="button" className="tn-btn-blue" disabled={saving} onClick={() => { onClose(); onRegistrar(); }}>
                <Truck size={13} />
                Registrar entrega
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─────────────────────────────────────────────────────────────
   Painel lista de pedidos
───────────────────────────────────────────────────────────── */
function RecebimentoPanel({
  pedidos,
  onRegistrar,
  onCancel,
  onDelete,
  saving,
}: {
  pedidos: PedidoCompra[];
  onRegistrar: (pedido: PedidoCompra) => void;
  onCancel: (pedido: PedidoCompra) => void;
  onDelete: (pedido: PedidoCompra) => void;
  saving: boolean;
}) {
  const [pedidoDetalhe, setPedidoDetalhe] = useState<PedidoCompra | null>(null);

  const totalRecebidoGeral = pedidos.reduce(
    (s, p) => s + p.itens.reduce((ss, i) => ss + num(i.quantidadeRecebida) * num(i.valorUnitario), 0), 0
  );

  return (
    <section className="tn-panel cp-panel" style={{ marginTop: 0 }}>
      <div className="tn-panel-head">
        <div className="tn-panel-head-left">
          <span>Histórico de pedidos</span>
          <h3>Pedidos de compra</h3>
        </div>
        {totalRecebidoGeral > 0 && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', display: 'block' }}>Total recebido</span>
            <strong style={{ fontFamily: 'monospace', fontSize: 15, color: '#16a34a' }}>{dinheiro(totalRecebidoGeral)}</strong>
          </div>
        )}
      </div>

      {pedidos.length === 0 ? (
        <div className="tn-empty cp-empty-state">
          <PackageSearch size={32} style={{ color: '#cbd5e1', marginBottom: 8 }} />
          <strong>Nenhum pedido gerado ainda</strong>
          <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Selecione solicitações aprovadas e clique em "Gerar pedido".</span>
        </div>
      ) : (
        <div style={{ padding: '4px 0' }}>
          {pedidos.map((pedido, idx) => {
            const totalRec = pedido.itens.reduce((s, i) => s + num(i.quantidadeRecebida) * num(i.valorUnitario), 0);
            const pct = num(pedido.quantidadeTotal) > 0
              ? Math.min(100, Math.round((num(pedido.quantidadeRecebida) / num(pedido.quantidadeTotal)) * 100))
              : 0;
            const temPendente = pedido.itens.some((i) => num(i.quantidadePendente) > 0);
            const totalRecebimentos = pedido.itens.reduce((s, i) => s + i.recebimentos.length, 0);
            const chipClass = pedido.status === 'RECEIVED' ? 'dot-green' : pedido.status === 'PARTIAL' ? 'dot-blue' : pedido.status === 'SENT' ? 'dot-blue' : 'dot-gray';

            return (
              <div
                key={pedido.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
                  borderBottom: idx < pedidos.length - 1 ? '1px solid #f8fafc' : 'none',
                  cursor: 'pointer', transition: 'background 0.12s',
                }}
                onClick={() => setPedidoDetalhe(pedido)}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* ícone status */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: pct === 100 ? '#f0fdf4' : temPendente ? '#fff7ed' : '#eff6ff',
                  border: `1.5px solid ${pct === 100 ? '#bbf7d0' : temPendente ? '#fed7aa' : '#bfdbfe'}`,
                  color: pct === 100 ? '#16a34a' : temPendente ? '#ea580c' : '#2563eb',
                }}>
                  {pct === 100 ? <CheckCircle2 size={20} /> : temPendente ? <Truck size={20} /> : <PackageCheck size={20} />}
                </div>

                {/* info principal */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{pedido.numero}</strong>
                    <span className={`tn-chip ${chipClass}`} style={{ fontSize: 10 }}><i />{statusPedidoLabel(pedido.status)}</span>
                    {totalRecebimentos > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                        {totalRecebimentos} {totalRecebimentos === 1 ? 'entrega' : 'entregas'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      {pedido.sentAt ? formatarData(pedido.sentAt) : formatarData(pedido.createdAt)}
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{pedido.itens.length} {pedido.itens.length === 1 ? 'item' : 'itens'}</span>
                    {totalRec > 0 && (
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, fontFamily: 'monospace' }}>
                        Recebido: {dinheiro(totalRec)}
                      </span>
                    )}
                  </div>
                  {/* barra de progresso */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden', maxWidth: 220 }}>
                      <div style={{
                        height: '100%', width: `${pct}%`, borderRadius: 99,
                        background: pct === 100 ? 'linear-gradient(90deg,#16a34a,#22c55e)' : 'linear-gradient(90deg,#2563eb,#60a5fa)',
                        transition: 'width 0.4s ease',
                        boxShadow: pct > 0 ? '0 0 6px rgba(37,99,235,0.25)' : 'none',
                      }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: pct === 100 ? '#16a34a' : '#64748b' }}>{pct}%</span>
                  </div>
                </div>

                {/* valor + seta */}
                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', display: 'block' }}>Total</span>
                    <strong style={{ fontFamily: 'monospace', fontSize: 15, color: '#0f172a' }}>{dinheiro(num(pedido.valorTotal))}</strong>
                  </div>
                  {pedido.status !== 'CANCELLED' ? (
                    <button
                      type="button"
                      className="tn-btn-secondary"
                      disabled={saving}
                      onClick={(event) => { event.stopPropagation(); onCancel(pedido); }}
                    >
                      Cancelar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="tn-icon-btn sv-btn-excluir"
                    title="Excluir pedido"
                    disabled={saving}
                    onClick={(event) => { event.stopPropagation(); onDelete(pedido); }}
                  >
                    <Trash2 size={13} />
                  </button>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de detalhe */}
      {pedidoDetalhe && (
        <PedidoDetalheModal
          pedido={pedidoDetalhe}
          onClose={() => setPedidoDetalhe(null)}
          onRegistrar={() => { setPedidoDetalhe(null); onRegistrar(pedidoDetalhe); }}
          saving={saving}
        />
      )}
    </section>
  );
}

export function ComprasPage() {
  const { entityId, session } = useTenant();
  const { toasts, showToast, closeToast } = useToast();
  const [solicitacoes, setSolicitacoes] = useState<CompraSolicitacao[]>([]);
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [documentoOpen, setDocumentoOpen] = useState(false);
  const [baixaOpen, setBaixaOpen] = useState(false);
  const [pedidoBaixa, setPedidoBaixa] = useState<PedidoCompra | null>(null);
  const [baixaAba, setBaixaAba] = useState<'total' | string>('total');
  // itemId → qtd recebida (aba Total)
  const [baixaQtd, setBaixaQtd] = useState<Record<string, string>>({});
  // servicoSlug → itemId → qtd distribuída (abas de serviço)
  const [baixaDist, setBaixaDist] = useState<Record<string, Record<string, string>>>({});
  const [baixaResponsavel, setBaixaResponsavel] = useState(session.name);
  const [baixaObservacoes, setBaixaObservacoes] = useState('');
  const [comprasAba, setComprasAba] = useState<'operacao' | 'analise'>('operacao');
  const [confirm, setConfirm] = useState<{ title: string; message?: string; confirmLabel?: string; onConfirm: () => void } | null>(null);

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
  const pedidoParaBaixa = pedidoBaixa ?? pedidoAtual;
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

  const abrirDocumentoPedido = () => {
    if (!pedidoAtual) {
      setError('Gere um pedido antes de emitir o documento.');
      return;
    }
    setDocumentoOpen(true);
  };

  const abrirBaixa = (pedido: PedidoCompra | null = pedidoAtual) => {
    if (!pedido) return;
    setPedidoBaixa(pedido);
    // aba total: preenche com o pendente de cada item
    const qtd: Record<string, string> = {};
    pedido.itens.forEach((item) => {
      qtd[item.id] = num(item.quantidadePendente) > 0
        ? num(item.quantidadePendente).toFixed(2)
        : '0';
    });
    // distribuição por serviço: proporcional ao que cada serviço pediu
    const dist: Record<string, Record<string, string>> = {};
    pedido.itens.forEach((item) => {
      const pendente = num(item.quantidadePendente);
      const totalPedido = num(item.quantidadeTotal);
      item.origens.forEach((origem) => {
        if (!dist[origem.servicoSlug]) dist[origem.servicoSlug] = {};
        const prop = totalPedido > 0 ? num(origem.quantidade) / totalPedido : 1 / item.origens.length;
        dist[origem.servicoSlug][item.id] = (prop * pendente).toFixed(2);
      });
    });
    setBaixaQtd(qtd);
    setBaixaDist(dist);
    setBaixaAba('total');
    setBaixaResponsavel(session.name);
    setBaixaObservacoes('');
    setBaixaOpen(true);
    setError('');
  };

  const confirmarBaixa = async () => {
    if (!pedidoParaBaixa) return;
    const linhas = Object.entries(baixaQtd).filter(([, v]) => num(v) > 0);
    if (linhas.length === 0) {
      setError('Informe ao menos uma quantidade a receber.');
      return;
    }
    for (const [itemId, qtd] of linhas) {
      const item = pedidoParaBaixa.itens.find((i) => i.id === itemId);
      if (item && num(qtd) > num(item.quantidadePendente) + 0.001) {
        setError(`Quantidade de "${item.descricao}" excede o saldo pendente.`);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      for (const [itemId, qtd] of linhas) {
        await tenantApi.compras.createRecebimento(entityId, pedidoParaBaixa.id, {
          pedidoCompraItemId: itemId,
          quantidade: num(qtd).toFixed(4),
          recebidoEm: hoje,
          responsavel: baixaResponsavel,
          observacoes: baixaObservacoes || null,
        });
      }
      setBaixaOpen(false);
      setPedidoBaixa(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar entrega');
    } finally {
      setSaving(false);
    }
  };

  const cancelarPedido = (pedido: PedidoCompra) => {
    setConfirm({
      title: `Cancelar pedido ${pedido.numero}?`,
      message: 'O pedido será marcado como cancelado e não poderá ser reaberto.',
      confirmLabel: 'Cancelar pedido',
      onConfirm: async () => {
        setConfirm(null);
        setSaving(true);
        setError('');
        try {
          await tenantApi.compras.cancelPedido(entityId, pedido.id);
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao cancelar pedido');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const excluirPedido = (pedido: PedidoCompra) => {
    setConfirm({
      title: `Excluir pedido ${pedido.numero}?`,
      message: 'Esta ação é irreversível e removerá também todas as entregas registradas.',
      confirmLabel: 'Excluir definitivamente',
      onConfirm: async () => {
        setConfirm(null);
        setSaving(true);
        setError('');
        try {
          await tenantApi.compras.deletePedido(entityId, pedido.id);
          showToast(`Pedido ${pedido.numero} excluído com sucesso.`);
          await load();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao excluir pedido');
        } finally {
          setSaving(false);
        }
      },
    });
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

      <div className="cp-module-tabs" role="tablist" aria-label="Modulo de compras">
        <button type="button" className={comprasAba === 'operacao' ? 'is-active' : ''} onClick={() => setComprasAba('operacao')}>
          <ShoppingCart size={14} />
          Operacao
        </button>
        <button type="button" className={comprasAba === 'analise' ? 'is-active' : ''} onClick={() => setComprasAba('analise')}>
          <BarChart3 size={14} />
          Analise
        </button>
      </div>

      {comprasAba === 'analise' ? (
        <AnaliseCompras solicitacoes={solicitacoes} pedidos={pedidos} />
      ) : (
        <>
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

      <RecebimentoPanel
        pedidos={pedidos}
        onRegistrar={(pedido) => abrirBaixa(pedido)}
        onCancel={(pedido) => void cancelarPedido(pedido)}
        onDelete={(pedido) => void excluirPedido(pedido)}
        saving={saving}
      />
        </>
      )}

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

      {baixaOpen && pedidoParaBaixa ? (() => {
        const todosItens = pedidoParaBaixa.itens;
        // serviços únicos que originaram o pedido
        const servicosUnicos = Array.from(
          new Map(
            todosItens.flatMap((i) => i.origens.map((o) => [o.servicoSlug, { slug: o.servicoSlug, nome: o.servicoNome }]))
          ).values()
        );

        // totais da aba Total
        const totalValorBaixa = todosItens.reduce((s, item) => {
          return s + num(baixaQtd[item.id] ?? '0') * num(item.valorUnitario);
        }, 0);
        const algumExcede = todosItens.some(
          (item) => num(baixaQtd[item.id] ?? '0') > num(item.quantidadePendente) + 0.001,
        );
        const algumPreenchido = todosItens.some((item) => num(baixaQtd[item.id] ?? '0') > 0);

        // validação das abas de serviço: para cada item, soma da distribuição deve = qtd recebida
        const errosDistribuicao: Record<string, string> = {};
        if (baixaAba !== 'total') {
          todosItens.forEach((item) => {
            const recebido = num(baixaQtd[item.id] ?? '0');
            if (recebido <= 0) return;
            const somaServicos = servicosUnicos.reduce((s, sv) => {
              const temOrigem = item.origens.some((o) => o.servicoSlug === sv.slug);
              if (!temOrigem) return s;
              return s + num(baixaDist[sv.slug]?.[item.id] ?? '0');
            }, 0);
            const diff = Math.abs(somaServicos - recebido);
            if (diff > 0.01) {
              errosDistribuicao[item.id] = `${somaServicos.toFixed(2)} ≠ ${recebido.toFixed(2)}`;
            }
          });
        }
        const distribuicaoOk = Object.keys(errosDistribuicao).length === 0;
        const podeSalvar = algumPreenchido && !algumExcede && distribuicaoOk;

        return createPortal(
          <div className="cp-baixa-backdrop" onClick={() => setBaixaOpen(false)}>
            <div
              className="cp-baixa-modal cp-baixa-modal-large"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Cabeçalho ── */}
              <div className="cp-baixa-head">
                <div className="cp-baixa-icon"><Truck size={20} /></div>
                <div>
                  <span>Baixa de entrega — {pedidoParaBaixa.numero}</span>
                  <h3>Recebimento e distribuição por serviço</h3>
                </div>
                <button type="button" className="sv-modal-close" onClick={() => setBaixaOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* ── Abas ── */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #f1f5f9', padding: '0 20px', background: '#fafbfc', flexShrink: 0 }}>
                {/* aba Total */}
                <button
                  type="button"
                  onClick={() => setBaixaAba('total')}
                  style={{
                    padding: '12px 20px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    border: 'none', background: 'none', borderBottom: `3px solid ${baixaAba === 'total' ? '#2563eb' : 'transparent'}`,
                    color: baixaAba === 'total' ? '#2563eb' : '#64748b',
                    display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s',
                    marginBottom: -2,
                  }}
                >
                  <PackageCheck size={14} />
                  Total recebido
                  {algumPreenchido && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 99, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                      {dinheiro(totalValorBaixa)}
                    </span>
                  )}
                  {algumExcede && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />}
                </button>

                {/* aba por serviço */}
                {servicosUnicos.map((sv) => {
                  const servico = getServico(sv.slug);
                  const isActive = baixaAba === sv.slug;
                  const temErro = !distribuicaoOk && Object.keys(errosDistribuicao).some((itemId) =>
                    todosItens.find((i) => i.id === itemId)?.origens.some((o) => o.servicoSlug === sv.slug)
                  );
                  return (
                    <button
                      key={sv.slug}
                      type="button"
                      onClick={() => setBaixaAba(sv.slug)}
                      style={{
                        padding: '12px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        border: 'none', background: 'none',
                        borderBottom: `3px solid ${isActive ? (servico.cor ?? '#2563eb') : 'transparent'}`,
                        color: isActive ? (servico.cor ?? '#2563eb') : '#64748b',
                        display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.15s',
                        marginBottom: -2,
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{servico.icon}</span>
                      {sv.nome}
                      {temErro && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />}
                    </button>
                  );
                })}
              </div>

              {/* ── Conteúdo das abas ── */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>

                {/* ════ ABA TOTAL ════ */}
                {baixaAba === 'total' && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: '35%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '12%' }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: '#fafbfc', borderBottom: '2px solid #f1f5f9' }}>
                        {['Item', 'Unid.', 'Pedido', 'Entregue', 'Pendente', 'Recebido agora', 'Subtotal'].map((h, i) => (
                          <th key={i} style={{ padding: '9px 10px', textAlign: i >= 1 ? 'center' : 'left', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {todosItens.map((item, idx) => {
                        const qtdStr = baixaQtd[item.id] ?? '0';
                        const qtdVal = num(qtdStr);
                        const pendente = num(item.quantidadePendente);
                        const recebida = num(item.quantidadeRecebida);
                        const excede = qtdVal > pendente + 0.001;
                        const naoTemPendente = pendente <= 0;
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: excede ? '#fef9f9' : naoTemPendente ? '#f8faf8' : idx % 2 === 0 ? '#fff' : '#fafbfc', opacity: naoTemPendente ? 0.5 : 1 }}>
                            <td style={{ padding: '10px 10px' }}>
                              <strong style={{ color: '#0f172a', fontSize: 12, display: 'block' }}>{item.descricao}</strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
                                {item.origens.map((o) => {
                                  const sv = getServico(o.servicoSlug);
                                  return (
                                    <span key={o.id} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, background: `${sv.cor ?? '#2563eb'}12`, color: sv.cor ?? '#2563eb', border: `1px solid ${sv.cor ?? '#2563eb'}25` }}>
                                      {o.servicoNome}: {Number(o.quantidade).toLocaleString('pt-BR')}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', padding: '2px 6px', borderRadius: 99 }}>{item.unidadeMedida}</span>
                            </td>
                            <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, color: '#334155', fontFamily: 'monospace', fontSize: 12 }}>
                              {Number(item.quantidadeTotal).toLocaleString('pt-BR')}
                            </td>
                            <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: recebida > 0 ? '#16a34a' : '#94a3b8' }}>
                              {recebida.toLocaleString('pt-BR')}
                            </td>
                            <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: pendente > 0 ? '#ea580c' : '#16a34a' }}>
                              {pendente.toLocaleString('pt-BR')}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                              {naoTemPendente ? (
                                <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✓ Completo</span>
                              ) : (
                                <>
                                  <input
                                    type="number" min="0" max={pendente} step="0.01"
                                    value={qtdStr === '0' ? '' : qtdStr}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const novo = e.target.value || '0';
                                      setBaixaQtd((prev) => ({ ...prev, [item.id]: novo }));
                                      const novoNum = num(novo);
                                      const totalPedido = num(item.quantidadeTotal);
                                      setBaixaDist((prev) => {
                                        const next = { ...prev };
                                        item.origens.forEach((o) => {
                                          if (!next[o.servicoSlug]) next[o.servicoSlug] = {};
                                          const prop = totalPedido > 0 ? num(o.quantidade) / totalPedido : 1 / item.origens.length;
                                          next[o.servicoSlug] = { ...next[o.servicoSlug], [item.id]: (prop * novoNum).toFixed(2) };
                                        });
                                        return next;
                                      });
                                    }}
                                    style={{ width: '100%', padding: '6px 8px', fontSize: 13, fontWeight: 800, border: `2px solid ${excede ? '#fca5a5' : qtdVal > 0 ? '#86efac' : '#e2e8f0'}`, borderRadius: 7, outline: 'none', background: excede ? '#fff5f5' : '#fff', color: excede ? '#dc2626' : '#0f172a', fontFamily: 'monospace', textAlign: 'center', boxSizing: 'border-box' }}
                                  />
                                  {excede && <span style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>máx {pendente.toLocaleString('pt-BR')}</span>}
                                </>
                              )}
                            </td>
                            <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontFamily: 'monospace', fontSize: 12, color: qtdVal > 0 ? '#16a34a' : '#cbd5e1' }}>
                              {qtdVal > 0 ? dinheiro(qtdVal * num(item.valorUnitario)) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                        <td colSpan={6} style={{ padding: '10px 10px', fontWeight: 800, fontSize: 12, color: '#0f172a', textAlign: 'right' }}>Total desta baixa</td>
                        <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: 14, fontFamily: 'monospace', color: totalValorBaixa > 0 ? '#16a34a' : '#94a3b8' }}>
                          {totalValorBaixa > 0 ? dinheiro(totalValorBaixa) : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}

                {/* ════ ABA DE SERVIÇO ════ */}
                {baixaAba !== 'total' && (() => {
                  const sv = servicosUnicos.find((s) => s.slug === baixaAba);
                  if (!sv) return null;
                  const servico = getServico(sv.slug);
                  const itensDoServico = todosItens.filter((item) => item.origens.some((o) => o.servicoSlug === sv.slug));
                  const totalRecebidoServico = itensDoServico.reduce((s, item) => s + num(baixaDist[sv.slug]?.[item.id] ?? '0') * num(item.valorUnitario), 0);

                  return (
                    <>
                      {/* mini header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: `${servico.cor ?? '#2563eb'}08`, borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 20 }}>{servico.icon}</span>
                        <div>
                          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: servico.cor ?? '#2563eb', margin: 0 }}>Distribuição</p>
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>{sv.nome}</strong>
                        </div>
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Total serviço</span>
                          <strong style={{ fontSize: 15, fontFamily: 'monospace', color: servico.cor ?? '#2563eb' }}>{dinheiro(totalRecebidoServico)}</strong>
                        </div>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '32%' }} />
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '12%' }} />
                          <col style={{ width: '22%' }} />
                          <col style={{ width: '14%' }} />
                        </colgroup>
                        <thead>
                          <tr style={{ background: '#fafbfc', borderBottom: '2px solid #f1f5f9' }}>
                            {['Item', 'Unid.', 'Solicitado', 'Recebido total', 'Qtd. p/ este serviço', 'Subtotal'].map((h, i) => (
                              <th key={i} style={{ padding: '9px 8px', textAlign: i >= 1 ? 'center' : 'left', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94a3b8' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {itensDoServico.map((item, idx) => {
                            const origem = item.origens.find((o) => o.servicoSlug === sv.slug);
                            const qtdSolicitada = num(origem?.quantidade ?? '0');
                            const qtdTotalRecebida = num(baixaQtd[item.id] ?? '0');
                            const qtdDistStr = baixaDist[sv.slug]?.[item.id] ?? '0';
                            const qtdDist = num(qtdDistStr);
                            const somaOutros = servicosUnicos.filter((s) => s.slug !== sv.slug).reduce((s, other) => s + num(baixaDist[other.slug]?.[item.id] ?? '0'), 0);
                            const maxParaEste = Math.max(0, qtdTotalRecebida - somaOutros);
                            const excede = qtdDist > maxParaEste + 0.001;
                            const temErro = !!errosDistribuicao[item.id];
                            return (
                              <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', background: excede ? '#fef9f9' : idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                                <td style={{ padding: '10px 8px' }}>
                                  <strong style={{ color: '#0f172a', fontSize: 12 }}>{item.descricao}</strong>
                                  {temErro && <div style={{ marginTop: 2 }}><span style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '1px 5px', borderRadius: 99 }}>Soma ≠ {errosDistribuicao[item.id]}</span></div>}
                                </td>
                                <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', background: '#f3e8ff', padding: '2px 6px', borderRadius: 99 }}>{item.unidadeMedida}</span>
                                </td>
                                <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace', color: servico.cor ?? '#2563eb' }}>
                                  {qtdSolicitada.toLocaleString('pt-BR')}
                                </td>
                                <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 7, background: qtdTotalRecebida > 0 ? '#f0fdf4' : '#f8fafc', color: qtdTotalRecebida > 0 ? '#16a34a' : '#94a3b8', border: `1.5px solid ${qtdTotalRecebida > 0 ? '#bbf7d0' : '#e2e8f0'}` }}>
                                    {qtdTotalRecebida.toLocaleString('pt-BR')}
                                  </span>
                                </td>
                                <td style={{ padding: '5px 8px' }}>
                                  {qtdTotalRecebida <= 0 ? (
                                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, display: 'block', textAlign: 'center' }}>Sem recebimento</span>
                                  ) : (
                                    <>
                                      <input
                                        type="number" min="0" step="0.01"
                                        value={qtdDistStr === '0' ? '' : qtdDistStr}
                                        placeholder="0"
                                        onChange={(e) => setBaixaDist((prev) => ({ ...prev, [sv.slug]: { ...prev[sv.slug], [item.id]: e.target.value || '0' } }))}
                                        style={{ width: '100%', padding: '6px 8px', fontSize: 13, fontWeight: 800, border: `2px solid ${excede || temErro ? '#fca5a5' : qtdDist > 0 ? `${servico.cor ?? '#2563eb'}60` : '#e2e8f0'}`, borderRadius: 7, outline: 'none', background: excede ? '#fff5f5' : '#fff', color: excede ? '#dc2626' : '#0f172a', fontFamily: 'monospace', textAlign: 'center', boxSizing: 'border-box' }}
                                      />
                                      <div style={{ display: 'flex', gap: 3, marginTop: 3, justifyContent: 'center' }}>
                                        <button type="button" onClick={() => setBaixaDist((prev) => ({ ...prev, [sv.slug]: { ...prev[sv.slug], [item.id]: maxParaEste.toFixed(2) } }))} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, border: `1px solid ${servico.cor ?? '#2563eb'}40`, background: `${servico.cor ?? '#2563eb'}08`, color: servico.cor ?? '#2563eb', cursor: 'pointer' }}>
                                          Max {maxParaEste.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                                        </button>
                                        <button type="button" onClick={() => setBaixaDist((prev) => ({ ...prev, [sv.slug]: { ...prev[sv.slug], [item.id]: '0' } }))} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer' }}>
                                          Zerar
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </td>
                                <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontFamily: 'monospace', fontSize: 12, color: qtdDist > 0 ? '#0f172a' : '#cbd5e1' }}>
                                  {qtdDist > 0 ? dinheiro(qtdDist * num(item.valorUnitario)) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                            <td colSpan={5} style={{ padding: '10px 8px', fontWeight: 800, fontSize: 12, color: '#0f172a', textAlign: 'right' }}>Total para {sv.nome}</td>
                            <td style={{ padding: '10px 6px', textAlign: 'center', fontWeight: 800, fontSize: 14, fontFamily: 'monospace', color: totalRecebidoServico > 0 ? (servico.cor ?? '#16a34a') : '#94a3b8' }}>
                              {totalRecebidoServico > 0 ? dinheiro(totalRecebidoServico) : '—'}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </>
                  );
                })()}
              </div>

              {/* ── Rodapé: campos + validação + ações ── */}
              <div style={{ borderTop: '2px solid #f1f5f9', flexShrink: 0 }}>

                <div className="cp-baixa-form">
                  <label>
                    <span>Responsável pelo recebimento</span>
                    <input type="text" value={baixaResponsavel} onChange={(e) => setBaixaResponsavel(e.target.value)} />
                  </label>
                  <label className="is-wide">
                    <span>Observações (NF, conferente, etc.)</span>
                    <textarea value={baixaObservacoes} onChange={(e) => setBaixaObservacoes(e.target.value)}
                      placeholder="Ex: NF 12345, entrega parcial, conferência do almoxarifado..." />
                  </label>
                </div>

                {algumExcede && (
                  <div className="tn-alert" style={{ margin: '0 20px 10px' }}>
                    Quantidade recebida excede o saldo pendente em um ou mais itens.
                  </div>
                )}
                {algumPreenchido && !distribuicaoOk && (
                  <div className="tn-alert" style={{ margin: '0 20px 10px' }}>
                    A soma da distribuição por serviço não bate com o total recebido. Ajuste nas abas de serviço.
                  </div>
                )}

                <div className="cp-baixa-actions">
                  <button type="button" className="tn-btn-secondary" onClick={() => setBaixaOpen(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="tn-btn-blue"
                    disabled={saving || !podeSalvar}
                    onClick={() => void confirmarBaixa()}
                  >
                    <Truck size={14} />
                    {saving
                      ? 'Registrando...'
                      : podeSalvar
                        ? `Confirmar entrega — ${dinheiro(totalValorBaixa)}`
                        : 'Distribua por serviço para confirmar'
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        );
      })() : null}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel ?? 'Confirmar'}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </div>
  );
}
