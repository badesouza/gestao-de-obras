import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { tenantApi, mapaApi, ordensApi, type AcaoOS, type CentroCustoDetail, type Etapa, type PropriedadeConfig, type RegistroDiarioRow } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { SERVICOS_CONFIG, CENTRO_IDS, type ServicoConfig } from './servico-config';
import { ServicoInstrucoesDrawer } from '../components/ServicoInstrucoesDrawer';
import { NovaOcorrenciaModal } from '../components/NovaOcorrenciaModal';
import { ModalConclusao, type DadosConclusao } from '../components/ModalConclusao';
import { OrdemServicoModal } from '../components/OrdemServicoModal';
import { ServicoAnalytics } from '../components/ServicoAnalytics';
import { PlanejamentoAnual } from '../components/PlanejamentoAnual';
import { ServicoSolicitacoesPanel } from '../components/ServicoSolicitacoesPanel';
import { Anel, Dialogo, EtapaBadge, FotoThumb, Kpi, KpiCarregando, Sparkline } from '../components/obras/ui';
import { DIAS_ATRASO, dataBr, diasDesde, etapaAberta, etapaDe, nomeCurto, numeroDaOS } from '../components/obras/util';

type Filtro = 'todas' | 'atrasadas' | Etapa;

/* ── helpers ─────────────────────────────────────────────────────── */
function hoje(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatDataBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function nomeMes(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function getCellText(row: RegistroDiarioRow, propId: string): string {
  const v = row.values[propId];
  if (!v) return '—';
  if (v.text !== undefined) return v.text || '—';
  if (v.decimal !== undefined) return v.decimal;
  if (v.boolean !== undefined) return v.boolean ? 'Sim' : 'Não';
  if (v.date !== undefined) return formatDataBr(v.date);
  return '—';
}

/* ── componente principal ─────────────────────────────────────────── */
export function ServicoDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { entityId, session } = useTenant();

  const config: ServicoConfig | undefined = SERVICOS_CONFIG[slug ?? ''];
  const centroId = CENTRO_IDS[slug ?? ''];

  const { toasts, showToast, closeToast } = useToast();
  const [centro, setCentro] = useState<CentroCustoDetail | null>(null);
  const [rows, setRows] = useState<RegistroDiarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [{ year, month }, setPeriodo] = useState(hoje);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();


  /* atalhos vindos da Sala de Situação: ?os=<id> abre a OS, ?nova=1 abre o formulário */
  const paramOS = searchParams.get('os');
  const paramNova = searchParams.get('nova') === '1';
  const limparParam = (chave: string) => {
    const p = new URLSearchParams(searchParams);
    p.delete(chave);
    setSearchParams(p, { replace: true });
  };
  const [editRow, setEditRow] = useState<RegistroDiarioRow | null>(null);
  const [ajudaOpen, setAjudaOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [rowConcluindo, setRowConcluindo] = useState<RegistroDiarioRow | null>(null);
  const [rowConferindo, setRowConferindo] = useState<RegistroDiarioRow | null>(null);
  const [obsConferencia, setObsConferencia] = useState('');
  const [rowOS, setRowOS] = useState<RegistroDiarioRow | null>(null);
  const rowOSAtiva = rowOS ?? (paramOS ? rows.find(r => r.id === paramOS) ?? null : null);
  const formularioAberto = modalOpen || paramNova;
  const fecharFormulario = () => { setModalOpen(false); setEditRow(null); if (paramNova) limparParam('nova'); };
  const [aba, setAba] = useState<'registros' | 'analises' | 'planejamento' | 'solicitacoes'>('registros');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busca, setBusca] = useState('');

  /* mapa nome→id das propriedades */
  const propMap = useRef<Record<string, string>>({});
  const propConfigs = useRef<PropriedadeConfig[]>([]);

  const load = useCallback(async () => {
    if (!centroId) return;
    setLoading(true);
    setError('');
    try {
      const [det, reg] = await Promise.all([
        tenantApi.centrosCusto.get(entityId, centroId),
        tenantApi.centrosCusto.listRegistros(entityId, centroId, year, month),
      ]);
      setCentro(det);
      propConfigs.current = det.propriedadesConfig;
      propMap.current = {};
      det.propriedadesConfig.forEach((pc) => {
        propMap.current[pc.propriedade.nome] = pc.propriedadeId;
      });
      setRows(reg.rows.sort((a, b) => b.data.localeCompare(a.data)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [entityId, centroId, year, month]);

  useEffect(() => { void load(); }, [load]);

  /* baixa do fiscal: registra a vistoria e leva a OS para "Executada" */
  const handleConfirmarConclusao = async (dados: DadosConclusao) => {
    if (!rowConcluindo) return;
    const pidObs = propMap.current['Observações'];
    const pidFiscal = propMap.current['Fiscal Responsável'];
    const obsTexto = [
      dados.observacoesFiscal,
      `Vistoria: ${dados.dataVistoria} | Fiscal: ${dados.nomeFiscal} | Qualidade: ${dados.qualidade} | Resultado: ${dados.statusFinal}`,
    ].filter(Boolean).join('\n');

    const novosValues: Record<string, { text?: string }> = { ...rowConcluindo.values };
    if (pidObs) novosValues[pidObs] = { text: obsTexto };
    if (pidFiscal) novosValues[pidFiscal] = { text: dados.nomeFiscal };

    await tenantApi.centrosCusto.updateRegistro(entityId, centroId, rowConcluindo.id, { data: rowConcluindo.data, values: novosValues });
    if (dados.lat != null && dados.lng != null) {
      await mapaApi.salvarCoords(entityId, rowConcluindo.id, dados.lat, dados.lng, dados.enderecoConfirmado);
    }
    /* "Não executado" fica registrado na vistoria, mas a OS continua aberta */
    if (dados.statusFinal !== 'Não Executado') {
      await ordensApi.acao(entityId, rowConcluindo.id, 'executar');
      showToast(session.obras.exigeConferencia ? 'Baixa registrada. Aguardando a conferência do coordenador.' : 'Baixa registrada. OS finalizada.');
    } else {
      showToast('Vistoria registrada. A OS continua aberta.');
    }
    setRowConcluindo(null);
    await load();
  };

  /* aprovar, conferir, reabrir… */
  const acaoOS = async (row: RegistroDiarioRow, acao: AcaoOS, observacao?: string, mensagem?: string) => {
    setSaving(row.id);
    try {
      await ordensApi.acao(entityId, row.id, acao, observacao);
      if (mensagem) showToast(mensagem);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir a ação');
    } finally {
      setSaving(null);
    }
  };
  const handleReabrir = (row: RegistroDiarioRow) => {
    const motivo = window.prompt('Por que reabrir esta OS? (fica registrado)')?.trim();
    if (!motivo) return;
    if (motivo.length < 5) { window.alert('Explique o motivo com pelo menos 5 letras.'); return; }
    return acaoOS(row, 'reabrir', motivo, 'OS reaberta.');
  };

  /* excluir */
  const handleDelete = async (id: string) => {
    setSaving(id);
    try {
      await tenantApi.centrosCusto.deleteRegistro(entityId, centroId, id);
      setConfirmDelete(null);
      showToast('Ocorrência excluída com sucesso.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setSaving(null);
    }
  };

  /* mês anterior / próximo */
  const mudarMes = (delta: number) => {
    setPeriodo(({ year: y, month: m }) => {
      let nm = m + delta;
      let ny = y;
      if (nm < 1) { nm = 12; ny--; }
      if (nm > 12) { nm = 1; ny++; }
      return { year: ny, month: nm };
    });
  };

  if (!config || !centroId) {
    return (
      <div className="tn-page">
        <div className="tn-alert">Serviço não encontrado.</div>
      </div>
    );
  }

  /* ── dados da lista ── */
  const pidStatus = propMap.current['Status'];
  const texto = (row: RegistroDiarioRow, nome: string) => {
    const pid = propMap.current[nome];
    const v = pid ? getCellText(row, pid) : '—';
    return v === '—' ? '' : v;
  };
  const { podeAprovar, podeConferir } = session.obras;
  const itens = rows.map(row => {
    const status = pidStatus ? (row.values[pidStatus]?.text ?? '') : '';
    const etapa = etapaDe(row, status);
    const dias = diasDesde(row.data);
    const atrasada = etapaAberta(etapa) && dias > DIAS_ATRASO;
    const detalhes = config.camposPrincipais
      .filter(n => n !== 'Bairro / Localidade' && n !== 'Status')
      .map(n => {
        const v = texto(row, n);
        if (!v) return '';
        const campo = config.campos.find(c => c.nome === n);
        const unidade = n.match(/\(([^)]+)\)/)?.[1];
        return campo?.tipo === 'numero' && unidade ? `${v} ${unidade}` : v;
      })
      .filter(Boolean);
    return {
      row, etapa, dias, atrasada, detalhes,
      bairro: texto(row, 'Bairro / Localidade'),
      logradouro: texto(row, 'Logradouro / Referência'),
      equipe: texto(row, 'Equipe / Turma'),
    };
  });

  const total = itens.length;
  const conta = (f: Filtro) => f === 'todas' ? total : f === 'atrasadas' ? itens.filter(i => i.atrasada).length : itens.filter(i => i.etapa === f).length;
  const abertasAgora = itens.filter(i => etapaAberta(i.etapa)).length;
  const atrasadas = conta('atrasadas');
  const aConferir = conta('EXECUTADA');
  const finalizadas = conta('FINALIZADA');
  const comFoto = itens.filter(i => (i.row.fotos ?? 0) > 0).length;
  const diasNoMes = new Date(year, month, 0).getDate();
  const porDia = Array.from({ length: diasNoMes }, (_, d) => itens.filter(i => Number(i.row.data.slice(8, 10)) === d + 1).length);
  const ehMesAtual = year === hoje().year && month === hoje().month;
  const serieAteHoje = ehMesAtual ? porDia.slice(0, new Date().getDate()) : porDia;

  const termo = busca.trim().toLowerCase();
  const visiveis = itens.filter(i =>
    (filtro === 'todas' || (filtro === 'atrasadas' ? i.atrasada : i.etapa === filtro)) &&
    (!termo || [i.bairro, i.logradouro, i.equipe, i.row.fiscal ?? '', numeroDaOS(i.row), ...i.detalhes]
      .some(t => t.toLowerCase().includes(termo))),
  );

  const FILTROS: { id: Filtro; rotulo: string; cor: string; esconderSeVazio?: boolean }[] = [
    { id: 'todas', rotulo: 'Todas', cor: 'var(--ob-faint)' },
    { id: 'atrasadas', rotulo: 'Atrasadas', cor: 'var(--ob-rose)', esconderSeVazio: true },
    { id: 'AGUARDANDO_APROVACAO', rotulo: 'Aguardando aprovação', cor: 'var(--ob-violeta)', esconderSeVazio: !session.obras.exigeAprovacaoOS },
    { id: 'REGISTRADA', rotulo: 'Registradas', cor: 'var(--ob-blue)' },
    { id: 'EXECUTADA', rotulo: 'A conferir', cor: 'var(--ob-amber)', esconderSeVazio: !session.obras.exigeConferencia },
    { id: 'FINALIZADA', rotulo: 'Finalizadas', cor: 'var(--ob-green)' },
    { id: 'CANCELADA', rotulo: 'Canceladas', cor: 'var(--ob-faint)', esconderSeVazio: true },
  ];

  const ABAS: { id: typeof aba; rotulo: string; icone: React.ReactNode }[] = [
    { id: 'registros', rotulo: 'Ocorrências', icone: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { id: 'analises', rotulo: 'Análises', icone: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { id: 'planejamento', rotulo: 'Planejamento', icone: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { id: 'solicitacoes', rotulo: 'Solicitações', icone: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 002 1.58h8.77a2 2 0 001.95-1.57L21 8H5.12"/></svg> },
  ];

  const novaOcorrencia = () => { setEditRow(null); setModalOpen(true); };

  return (
    <div className="ob-page ob-claro" style={{ '--serv-cor': config.cor } as React.CSSProperties}>

      <Link to={`/t/${entityId}/servicos`} className="ob-voltar ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="15 18 9 12 15 6"/></svg>
        Serviços
      </Link>

      <header className="ob-head ob-reveal" style={{ '--i': 1 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone">{config.icon}</span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv">Serviço urbano</span>
            <h1 className="ob-h1">{config.nome}</h1>
            <p className="ob-sub">{config.descricao}</p>
          </div>
        </div>
        <div className="ob-head-acoes">
          <div className="ob-mes" role="group" aria-label="Mês de referência">
            <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span>{nomeMes(month, year).replace(/^./, c => c.toUpperCase())}</span>
            <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setAjudaOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Como usar
          </button>
          <button type="button" className="ob-btn" onClick={novaOcorrencia}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova ocorrência
          </button>
        </div>
      </header>

      <section className="ob-kpis" aria-label="Resumo do mês">
        {loading && rows.length === 0 ? [1, 2, 3, 4].map(n => <KpiCarregando key={n} />) : (
          <>
            <Kpi i={2} rotulo="Abertas agora" valor={abertasAgora} cor="var(--ob-blue)"
              nota={atrasadas > 0 ? `${atrasadas} ${atrasadas === 1 ? 'passou' : 'passaram'} de ${DIAS_ATRASO} dias` : `${total} ${total === 1 ? 'registrada' : 'registradas'} no mês`}
              tom={atrasadas > 0 ? 'ruim' : 'neutro'} grafico={<Sparkline valores={serieAteHoje} cor="var(--ob-blue)" />} />
            <Kpi i={3} rotulo="A conferir" valor={aConferir} cor="var(--ob-amber)"
              nota={!session.obras.exigeConferencia ? 'conferência desligada' : aConferir ? (podeConferir ? 'baixas esperando você' : 'aguardando o coordenador') : 'nenhuma baixa pendente'}
              tom={aConferir ? 'alerta' : 'ok'} grafico={null} />
            <Kpi i={4} rotulo="Finalizadas" valor={finalizadas} cor="var(--ob-green)"
              nota={total ? `${Math.round(finalizadas / total * 100)}% do mês` : 'sem registros'}
              tom={total > 0 && finalizadas === total ? 'ok' : 'neutro'} grafico={<Anel pct={total ? finalizadas / total * 100 : null} cor="var(--ob-green)" />} />
            <Kpi i={5} rotulo="Com foto" valor={total ? Math.round(comFoto / total * 100) : null} unidade="%" cor="var(--ob-amber)"
              nota={total === 0 ? 'sem registros' : total - comFoto > 0 ? `${total - comFoto} sem foto` : 'todas com prova'}
              tom={total === 0 ? 'neutro' : total - comFoto > 0 ? 'alerta' : 'ok'} grafico={<Anel pct={total ? comFoto / total * 100 : null} cor="var(--ob-amber)" />} />
          </>
        )}
      </section>

      <nav className="ob-abas ob-reveal" style={{ '--i': 6 } as React.CSSProperties} aria-label="Seções do serviço">
        {ABAS.map(a => (
          <button key={a.id} type="button" className={aba === a.id ? 'is-ativa' : undefined} onClick={() => setAba(a.id)} aria-pressed={aba === a.id}>
            {a.icone}{a.rotulo}
            {a.id === 'registros' && total > 0 && <span className="ob-abas-num">{total}</span>}
          </button>
        ))}
      </nav>

      {aba === 'analises' && (
        <div className="ob-card ob-card-conteudo">
          <ServicoAnalytics entityId={entityId} centroId={centroId} config={config} year={year} month={month} />
        </div>
      )}

      {aba === 'planejamento' && (
        <PlanejamentoAnual entityId={entityId} centroId={centroId} config={config} year={year} />
      )}

      {aba === 'solicitacoes' && (
        <ServicoSolicitacoesPanel config={config} />
      )}

      {aba === 'registros' && (
        <section className="ob-card ob-reveal" style={{ '--i': 7 } as React.CSSProperties} aria-label="Ocorrências do mês">
          <div className="ob-filtros">
            <div className="ob-chips" role="group" aria-label="Filtrar por etapa">
              {FILTROS.map(f => {
                const n = conta(f.id);
                if (f.esconderSeVazio && n === 0) return null;
                return (
                  <button key={f.id} type="button" className={`ob-chip${filtro === f.id ? ' is-ativo' : ''}${f.id === 'atrasadas' ? ' is-alerta' : ''}`}
                    onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}>
                    <i style={{ background: f.cor }} />{f.rotulo}<span>{n}</span>
                  </button>
                );
              })}
            </div>
            <label className="ob-busca">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>
              <span className="ob-sr">Buscar</span>
              <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Bairro, rua, equipe, fiscal ou nº da OS" />
            </label>
          </div>

          {error && <div className="ob-erro" style={{ margin: '0 16px 12px' }}>{error}</div>}

          {loading && rows.length === 0 && (
            <div className="ob-lista">{[1, 2, 3, 4].map(n => <div key={n} className="ob-oc"><span className="ob-skeleton" style={{ height: 88 }} /></div>)}</div>
          )}

          {!loading && total === 0 && (
            <div className="ob-vazio-grande">
              <span className="ob-serv-icone ob-serv-icone-grande">{config.icon}</span>
              <strong>Nenhuma ocorrência em {nomeMes(month, year)}</strong>
              <span>Registre o primeiro serviço do mês. A foto com carimbo e o GPS entram sozinhos.</span>
              <button type="button" className="ob-btn" onClick={novaOcorrencia}>Registrar ocorrência</button>
            </div>
          )}

          {total > 0 && visiveis.length === 0 && (
            <p className="ob-vazio" style={{ padding: '8px 20px 24px' }}>Nenhuma ocorrência com esse filtro.</p>
          )}

          {visiveis.length > 0 && (
            <div className="ob-lista">
              {visiveis.map((i, idx) => {
                const { row } = i;
                const ocupado = saving === row.id;
                return (
                  <article key={row.id} className={`ob-oc ob-reveal${i.atrasada ? ' is-atrasada' : ''}${i.etapa === 'FINALIZADA' ? ' is-concluida' : ''}`}
                    style={{ '--i': Math.min(idx, 12) } as React.CSSProperties}>
                    <button type="button" className="ob-oc-abrir" onClick={() => setRowOS(row)} aria-label={`Abrir ${numeroDaOS(row)}`}>
                      <FotoThumb entityId={entityId} fotoId={row.fotoId} quando={row.criadoEm} cor={config.cor} icone={config.icon} tamanho={88} contagem={row.fotos} />
                      <span className="ob-oc-info">
                        <span className="ob-oc-topo">
                          <span className="ob-oc-os">{numeroDaOS(row)}</span>
                          <EtapaBadge etapa={i.etapa} />
                          {i.atrasada && <span className="ob-badge is-atrasada"><i />há {i.dias} dias</span>}
                        </span>
                        <strong className="ob-oc-local">{i.bairro || 'Sem bairro informado'}</strong>
                        <span className="ob-oc-detalhe">{[i.logradouro, ...i.detalhes].filter(Boolean).join(' · ') || '—'}</span>
                        <span className="ob-oc-meta">
                          {dataBr(row.data)}
                          {row.fiscal && <> · {nomeCurto(row.fiscal)}</>}
                          {i.equipe && <> · {i.equipe}</>}
                          {row.centroDeCusto && <span className="ob-tag" title={row.centroDeCusto.nome}>CC {row.centroDeCusto.codigo}</span>}
                          {i.etapa === 'EXECUTADA' && row.executadoPor && <> · baixa por {nomeCurto(row.executadoPor)}</>}
                          {row.lat != null && <span className="ob-tag tom-ok">GPS</span>}
                        </span>
                      </span>
                    </button>
                    <div className="ob-oc-acoes">
                      {i.etapa === 'AGUARDANDO_APROVACAO' && podeAprovar && (
                        <button type="button" className="ob-acao is-aprovar" disabled={ocupado} onClick={() => void acaoOS(row, 'aprovar', undefined, `${numeroDaOS(row)} aprovada.`)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><polyline points="20 6 9 17 4 12"/></svg>
                          Aprovar
                        </button>
                      )}
                      {i.etapa === 'REGISTRADA' && (
                        <button type="button" className="ob-acao is-baixa" disabled={ocupado} onClick={() => setRowConcluindo(row)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><polyline points="20 6 9 17 4 12"/></svg>
                          Dar baixa
                        </button>
                      )}
                      {i.etapa === 'EXECUTADA' && podeConferir && (
                        <button type="button" className="ob-acao is-conferir" disabled={ocupado} onClick={() => { setRowConferindo(row); setObsConferencia(''); }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                          Conferir
                        </button>
                      )}
                      <button type="button" className="ob-icone-btn" data-dica="Ordem de serviço" aria-label="Ordem de serviço" onClick={() => setRowOS(row)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                      </button>
                      <button type="button" className="ob-icone-btn" data-dica="Editar" aria-label="Editar" disabled={ocupado} onClick={() => { setEditRow(row); setModalOpen(true); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {(i.etapa === 'FINALIZADA' || i.etapa === 'CANCELADA') && podeConferir && (
                        <button type="button" className="ob-icone-btn" data-dica="Reabrir" aria-label="Reabrir" disabled={ocupado} onClick={() => void handleReabrir(row)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                        </button>
                      )}
                      <button type="button" className="ob-icone-btn is-perigo" data-dica="Excluir" aria-label="Excluir" disabled={ocupado} onClick={() => setConfirmDelete(row.id)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* conferência do coordenador */}
      {rowConferindo && (
        <Dialogo
          titulo={`Conferir ${numeroDaOS(rowConferindo)}`}
          subtitulo="Veja as fotos da baixa na OS. Se estiver tudo certo, finalize. Se faltar algo, devolva ao fiscal com uma observação."
          onFechar={() => setRowConferindo(null)}
          acoes={<>
            <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => { const r = rowConferindo; setRowConferindo(null); setRowOS(r); }}>Ver OS e fotos</button>
            <button type="button" className="ob-btn-ghost ob-btn-alto ob-btn-perigo-suave" disabled={saving === rowConferindo.id}
              onClick={() => { const r = rowConferindo; setRowConferindo(null); void acaoOS(r, 'reabrir', obsConferencia || 'Devolvida na conferência', `${numeroDaOS(r)} devolvida ao fiscal.`); }}>
              Devolver ao fiscal
            </button>
            <button type="button" className="ob-acao is-baixa" disabled={saving === rowConferindo.id}
              onClick={() => { const r = rowConferindo; setRowConferindo(null); void acaoOS(r, 'finalizar', obsConferencia || undefined, `${numeroDaOS(r)} finalizada.`); }}>
              Conferido — finalizar
            </button>
          </>}
        >
          <dl>
            <dt>Baixa por</dt><dd>{rowConferindo.executadoPor ?? '—'}</dd>
            <dt>Em</dt><dd>{rowConferindo.executadoEm ? new Date(rowConferindo.executadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</dd>
            <dt>Fotos</dt><dd>{rowConferindo.fotos ?? 0}</dd>
          </dl>
          <textarea value={obsConferencia} onChange={e => setObsConferencia(e.target.value)} placeholder="Observação (opcional) — ex.: faltou foto do depois" maxLength={1000} />
        </Dialogo>
      )}

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div className="sv-modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="sv-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="sv-confirm-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h3>Excluir ocorrência?</h3>
            <p>Esta ação não pode ser desfeita.</p>
            <div className="sv-confirm-actions">
              <button type="button" className="tn-btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button
                type="button"
                className="sv-btn-danger"
                onClick={() => handleDelete(confirmDelete)}
                disabled={saving === confirmDelete}
              >
                {saving === confirmDelete ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova / editar ocorrência */}
      {formularioAberto && centro && (
        <NovaOcorrenciaModal
          config={config}
          centro={centro}
          propMap={propMap.current}
          editRow={editRow}
          entityId={entityId}
          municipalityName={session.entity.municipalityName}
          uf={session.entity.uf}
          onClose={fecharFormulario}
          onSaved={() => { fecharFormulario(); void load(); }}
        />
      )}

      {/* Modal de OS — visualizar/imprimir */}
      {rowOSAtiva && (
        <OrdemServicoModal
          row={rowOSAtiva}
          config={config}
          propConfigs={propConfigs.current}
          onClose={() => { setRowOS(null); if (paramOS) limparParam('os'); }}
        />
      )}

      {/* Modal de conclusão / baixa */}
      {rowConcluindo && (
        <ModalConclusao
          registroId={rowConcluindo.id}
          centroCustoNome={config.nome}
          cor={config.cor}
          data={rowConcluindo.data}
          bairro={(() => { const pid = propMap.current['Bairro / Localidade']; return pid ? rowConcluindo.values[pid]?.text ?? '' : ''; })()}
          logradouro={(() => { const pid = propMap.current['Logradouro / Referência']; return pid ? rowConcluindo.values[pid]?.text ?? '' : ''; })()}
          lat={rowConcluindo.lat}
          lng={rowConcluindo.lng}
          onClose={() => setRowConcluindo(null)}
          onConfirm={handleConfirmarConclusao}
        />
      )}

      {/* Drawer de instruções */}
      <ServicoInstrucoesDrawer
        slug={ajudaOpen ? (slug ?? null) : null}
        nomeServico={config.nome}
        corServico={config.cor}
        onClose={() => setAjudaOpen(false)}
      />

      <ToastContainer toasts={toasts} onClose={closeToast} />
    </div>
  );
}
