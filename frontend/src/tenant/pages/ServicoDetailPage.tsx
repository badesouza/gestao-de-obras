import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { tenantApi, ordensApi, type AcaoOS, type CentroCustoDetail, type Etapa, type PropriedadeConfig, type RegistroDiarioRow } from '../../lib/api-client';
import { useTenant } from '../TenantContext';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { SERVICOS_CONFIG, CENTRO_IDS, type ServicoConfig } from './servico-config';
import { ServicoInstrucoesDrawer } from '../components/ServicoInstrucoesDrawer';
import { NovaOcorrenciaModal } from '../components/NovaOcorrenciaModal';
import { OrdemServicoModal } from '../components/OrdemServicoModal';
import { ServicoAnalytics } from '../components/ServicoAnalytics';
import { PlanejamentoAnual } from '../components/PlanejamentoAnual';
import { ServicoSolicitacoesPanel } from '../components/ServicoSolicitacoesPanel';
import { DIAS_ATRASO, dataBr, diasDesde, etapaAberta, etapaDe, nomeCurto, numeroDaOS, useFotoUrl } from '../components/obras/util';
import { AcoesLinha, Aviso, BarraAcoes, Cabecalho, Cartao, Carregando, Ic, Janela, Pagina, Placar, Sep, rotaTenant, useConfirmarExclusao } from '../components/sisobras/so';
import { Anel, BarraPrazo, EtapaPill, IconeServico, SeloServico, Spark, corAvatar, siglaDe } from './os/os-ui';

type Filtro = 'todas' | 'atrasadas' | Etapa;
type Aba = 'registros' | 'analises' | 'planejamento' | 'solicitacoes';

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

/** Miniatura da foto da ocorrência (ou o ícone do serviço quando não tem foto) */
function Miniatura({ entityId, fotoId, cor, nome, fotos }: { entityId: string; fotoId: string | null | undefined; cor: string; nome: string; fotos?: number }) {
  const url = useFotoUrl(entityId, fotoId);
  return (
    <span style={{ position: 'relative', width: 52, height: 52, borderRadius: 12, overflow: 'hidden', flex: 'none', display: 'grid', placeItems: 'center',
      background: url ? 'var(--surface-3)' : `color-mix(in srgb, ${cor} 14%, var(--surface))`, color: cor, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--line)' }}>
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="os-svc" style={{ gap: 0 }}><span className="m" style={{ '--c': cor, width: 30, height: 30 } as React.CSSProperties}><IconeServico nome={nome} /></span></span>}
      {(fotos ?? 0) > 1 && <span className="mono" style={{ position: 'absolute', right: 3, bottom: 3, padding: '0 5px', borderRadius: 6, fontSize: 9.5, fontWeight: 700, color: '#fff', background: 'rgba(10,12,25,.72)' }}>{fotos}</span>}
    </span>
  );
}

/* ── componente principal ─────────────────────────────────────────── */
export function ServicoDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { entityId, session } = useTenant();
  const nav = useNavigate();

  const config: ServicoConfig | undefined = SERVICOS_CONFIG[slug ?? ''];
  const centroId = CENTRO_IDS[slug ?? ''];

  const { toasts, showToast, closeToast } = useToast();
  const { confirmar, janelaExclusao } = useConfirmarExclusao();
  const [centro, setCentro] = useState<CentroCustoDetail | null>(null);
  const [rows, setRows] = useState<RegistroDiarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [{ year, month }, setPeriodo] = useState(hoje);
  const [searchParams] = useSearchParams();

  /* atalhos antigos: ?os=<id> abre a ficha da OS; ?nova=1 abre a Nova OS (módulo de OS) */
  useEffect(() => {
    const os = searchParams.get('os');
    if (os) nav(rotaTenant(entityId, `os/${os}`), { replace: true });
    else if (searchParams.get('nova') === '1') nav(rotaTenant(entityId, 'os?nova=1'), { replace: true });
  }, [searchParams, entityId, nav]);

  const [editRow, setEditRow] = useState<RegistroDiarioRow | null>(null);
  const [ajudaOpen, setAjudaOpen] = useState(false);
  const [rowImprimir, setRowImprimir] = useState<RegistroDiarioRow | null>(null);
  const [rowReabrir, setRowReabrir] = useState<RegistroDiarioRow | null>(null);
  const [motivo, setMotivo] = useState('');
  const [aba, setAba] = useState<Aba>('registros');
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

  /* aprovar, reabrir… */
  const acaoOS = async (row: RegistroDiarioRow, acao: AcaoOS, observacao?: string, mensagem?: string) => {
    setSaving(row.id);
    try {
      await ordensApi.acao(entityId, row.id, acao, observacao);
      if (mensagem) showToast(mensagem);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível concluir a ação', 'error');
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
    return <Pagina><Aviso tom="amber">Serviço não encontrado.</Aviso></Pagina>;
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
  const abertasAgora = itens.filter(i => etapaAberta(i.etapa) || i.etapa === 'EXECUTADA').length;
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

  const FILTROS: { id: Filtro; rotulo: string; esconderSeVazio?: boolean; alerta?: boolean }[] = [
    { id: 'todas', rotulo: 'Todas' },
    { id: 'atrasadas', rotulo: 'Atrasadas', esconderSeVazio: true, alerta: true },
    { id: 'AGUARDANDO_APROVACAO', rotulo: 'Aguardando aprovação', esconderSeVazio: !session.obras.exigeAprovacaoOS },
    { id: 'REGISTRADA', rotulo: 'Registradas' },
    { id: 'EXECUTADA', rotulo: 'A conferir', esconderSeVazio: !session.obras.exigeConferencia },
    { id: 'FINALIZADA', rotulo: 'Finalizadas' },
    { id: 'CANCELADA', rotulo: 'Canceladas', esconderSeVazio: true },
  ];

  const ABAS: { id: Aba; rotulo: string; icone: React.ReactNode }[] = [
    { id: 'registros', rotulo: 'Ocorrências', icone: <Ic n="doc" /> },
    { id: 'analises', rotulo: 'Análises', icone: <Ic n="sliders" /> },
    { id: 'planejamento', rotulo: 'Planejamento', icone: <Ic n="relogio" /> },
    { id: 'solicitacoes', rotulo: 'Solicitações', icone: <Ic n="carrinho" /> },
  ];

  /* toda OS nova passa pela Nova OS: segue a ficha do serviço e exige equipe */
  const novaOcorrencia = () => nav(rotaTenant(entityId, 'os?nova=1'));
  const fichaOS = (row: RegistroDiarioRow) => nav(rotaTenant(entityId, `os/${row.id}`));
  const excluir = (row: RegistroDiarioRow) => confirmar({
    oque: 'ocorrência', nome: numeroDaOS(row),
    texto: 'A ocorrência, as fotos e os valores lançados saem do sistema. Não dá para desfazer.',
    acao: async () => {
      setSaving(row.id);
      try { await tenantApi.centrosCusto.deleteRegistro(entityId, centroId, row.id); showToast('Ocorrência excluída.'); await load(); }
      catch (e) { showToast(e instanceof Error ? e.message : 'Erro ao excluir', 'error'); }
      finally { setSaving(null); }
    },
  });
  const mesTexto = nomeMes(month, year).replace(/^./, c => c.toUpperCase());

  return (
    <Pagina>
      <Cabecalho rotulo={config.nome} selo={<SeloServico nome={config.nome} cor={config.cor} />}
        eyebrow={<>Gestão de Obras · <Link to={rotaTenant(entityId, 'servicos')}>Serviços Urbanos</Link></>}
        titulo={config.nome}
        extras={<span className="os-pill brand"><i />{total} no mês</span>}
        sub={config.descricao}
        direita={<div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div className="so-seg" role="group" aria-label="Mês de referência" style={{ alignItems: 'center' }}>
            <button type="button" className="so-btn so-ghost sm" style={{ border: 0, background: 'transparent' }} onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Ic n="voltar" /></button>
            <span style={{ padding: '0 6px', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', minWidth: 132, textAlign: 'center' }}>{mesTexto}</span>
            <button type="button" className="so-btn so-ghost sm" style={{ border: 0, background: 'transparent' }} onClick={() => mudarMes(1)} aria-label="Próximo mês"><Ic n="seta" /></button>
          </div>
          <Placar n={abertasAgora} de="OS" rotulo="abertas agora" />
        </div>} />

      <section className="os-kpis" aria-label="Resumo do mês">
        {loading && rows.length === 0 ? <Carregando /> : (
          <>
            <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#635BFF,#8B85FF)', '--ks': 'rgba(99,91,255,.8)' } as React.CSSProperties}>
              <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg></span>Abertas agora</div>
              <div className="v"><span className="os-num" key={abertasAgora}>{abertasAgora}</span><span className="os-delta neutro">{total} no mês</span></div>
              <Spark valores={serieAteHoje.length ? serieAteHoje : [0]} />
            </article>
            <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#E5534B,#F59088)', '--ks': 'rgba(229,83,75,.8)', '--kg': 'rgba(229,83,75,.14)' } as React.CSSProperties}>
              <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>Atrasadas</div>
              <div className="v"><span className="os-num" key={atrasadas} style={{ color: atrasadas ? 'var(--coral)' : undefined }}>{atrasadas}</span>{atrasadas > 0 && <button type="button" className="os-delta ruim" style={{ border: 0, cursor: 'pointer' }} onClick={() => { setAba('registros'); setFiltro('atrasadas'); }}>ver quais</button>}</div>
              <small>abertas há mais de {DIAS_ATRASO} dias</small>
            </article>
            <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#F2B44C,#E8962A)', '--ks': 'rgba(232,150,42,.8)', '--kg': 'rgba(242,180,76,.18)' } as React.CSSProperties}>
              <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg></span>A conferir</div>
              <div className="v"><span className="os-num" key={aConferir}>{aConferir}</span>{aConferir > 0 && podeConferir && <span className="os-pill amber" style={{ height: 20, fontSize: 10.5 }}><i />esperando você</span>}</div>
              <small>{!session.obras.exigeConferencia ? 'conferência desligada' : aConferir ? (podeConferir ? 'baixas esperando a sua conferência' : 'aguardando o coordenador') : 'nenhuma baixa pendente'}</small>
            </article>
            <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#19B88A,#10C6D4)', '--ks': 'rgba(25,184,138,.8)', '--kg': 'rgba(25,184,138,.16)' } as React.CSSProperties}>
              <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></span>Finalizadas</div>
              <div className="os-ringwrap">
                <Anel pct={total ? finalizadas / total * 100 : 0} id="osRingFinal" />
                <div><div className="v"><span className="os-num sm">{finalizadas}</span></div><small>{total ? `${Math.round(finalizadas / total * 100)}% do mês` : 'sem registros'}</small></div>
              </div>
            </article>
            <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#E8962A,#F2B44C)', '--ks': 'rgba(232,150,42,.8)', '--kg': 'rgba(242,180,76,.18)' } as React.CSSProperties}>
              <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg></span>Com foto</div>
              <div className="os-ringwrap">
                <Anel pct={total ? comFoto / total * 100 : 0} id="osRingFoto" />
                <div><div className="v"><span className="os-num sm">{total ? Math.round(comFoto / total * 100) : '—'}</span>{total > 0 && <span className="os-u">%</span>}</div><small>{total === 0 ? 'sem registros' : total - comFoto > 0 ? `${total - comFoto} sem foto` : 'todas com prova'}</small></div>
              </div>
            </article>
          </>
        )}
      </section>

      <nav className="so-tabs" aria-label="Seções do serviço">
        {ABAS.map(a => (
          <button key={a.id} type="button" className={`so-tab${aba === a.id ? ' on' : ''}`} onClick={() => setAba(a.id)} aria-pressed={aba === a.id}>
            {a.icone}{a.rotulo}{a.id === 'registros' && total > 0 && <span className="n">{total}</span>}
          </button>
        ))}
      </nav>

      {aba === 'analises' && (
        <ServicoAnalytics entityId={entityId} centroId={centroId} config={config} year={year} month={month} />
      )}

      {aba === 'planejamento' && (
        <PlanejamentoAnual entityId={entityId} centroId={centroId} config={config} year={year} />
      )}

      {aba === 'solicitacoes' && (
        <ServicoSolicitacoesPanel config={config} />
      )}

      {aba === 'registros' && (
        <Cartao icone="doc" titulo={`Ocorrências de ${nomeMes(month, year)}`} meta={`mostrando ${visiveis.length} de ${total}`} ajuda="Ajuda: Ocorrências"
          direita={<button type="button" className="so-btn so-primary sm os-shine" onClick={novaOcorrencia}><Ic n="plus" />Nova OS</button>}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div className="so-chips" role="group" aria-label="Filtrar por etapa" style={{ flex: '999 1 420px' }}>
              {FILTROS.map(f => {
                const n = conta(f.id);
                if (f.esconderSeVazio && n === 0) return null;
                return (
                  <button key={f.id} type="button" className={`so-chip${f.alerta ? ' alert' : ''}${filtro === f.id ? ' on' : ''}`}
                    onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}>{f.rotulo}<span className="n">{n}</span></button>
                );
              })}
            </div>
            <label className="so-field" style={{ flex: '1 1 260px' }}><span className="so-sr">Buscar</span>
              <span className="so-ctrl"><Ic n="search" /><input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Bairro, rua, equipe, fiscal ou nº da OS" /></span>
            </label>
          </div>

          {error && <Aviso tom="amber">{error}</Aviso>}
          {loading && rows.length === 0 && <Carregando />}

          {!loading && total === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 12px', textAlign: 'center' }}>
              <SeloServico nome={config.nome} cor={config.cor} />
              <b style={{ fontSize: 15, color: 'var(--ink)' }}>Nenhuma ocorrência em {nomeMes(month, year)}</b>
              <span className="so-help">Registre o primeiro serviço do mês. A foto com carimbo e o GPS entram sozinhos.</span>
              <button type="button" className="so-btn so-primary os-shine" onClick={novaOcorrencia}><Ic n="plus" />Nova OS</button>
            </div>
          )}

          {total > 0 && visiveis.length === 0 && <p className="so-help" style={{ textAlign: 'center', padding: 14 }}>Nenhuma ocorrência com esse filtro.</p>}

          {visiveis.length > 0 && (
            <div className="so-tw">
              <table className="so-table os-rows">
                <thead><tr><th scope="col">Ocorrência</th><th scope="col">Onde · o que</th><th scope="col">Equipe</th><th scope="col">Etapa</th><th scope="col">Prazo</th><th scope="col"><span className="so-sr">Ações</span></th></tr></thead>
                <tbody>
                  {visiveis.map(i => {
                    const { row } = i;
                    const ocupado = saving === row.id;
                    const principal = i.etapa === 'AGUARDANDO_APROVACAO' && podeAprovar ? 'aprovar'
                      : i.etapa === 'REGISTRADA' ? 'baixa' : i.etapa === 'EXECUTADA' && podeConferir ? 'conferir' : null;
                    return (
                      <tr key={row.id} onClick={() => fichaOS(row)} style={{ cursor: 'pointer' }}>
                        <td data-l="Ocorrência">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Miniatura entityId={entityId} fotoId={row.fotoId} cor={config.cor} nome={config.nome} fotos={row.fotos} />
                            <span style={{ minWidth: 0 }}>
                              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{numeroDaOS(row)}</span>
                              <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{dataBr(row.data)}{row.fiscal ? ` · ${nomeCurto(row.fiscal)}` : ''}</span>
                              <span style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                                {row.lat != null && <span className="so-tag" style={{ height: 18, fontSize: 9.5, color: 'var(--mint)' }}>GPS</span>}
                                {row.centroDeCusto && <span className="so-tag" style={{ height: 18, fontSize: 9.5 }} title={row.centroDeCusto.nome}>CC {row.centroDeCusto.codigo}</span>}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td data-l="Onde · o que"><b style={{ color: 'var(--ink)', fontWeight: 800 }}>{i.bairro || 'Sem bairro informado'}</b><span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{[i.logradouro, ...i.detalhes].filter(Boolean).join(' · ') || '—'}</span></td>
                        <td data-l="Equipe">{i.equipe ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="os-av" style={{ '--a': corAvatar(i.equipe), margin: 0 } as React.CSSProperties}>{siglaDe(i.equipe)}</span><span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{i.equipe}</span></span> : <span className="so-help">sem equipe</span>}</td>
                        <td data-l="Etapa">
                          <EtapaPill etapa={i.etapa} />
                          {i.etapa === 'EXECUTADA' && row.executadoPor && <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>baixa por {nomeCurto(row.executadoPor)}</span>}
                        </td>
                        <td data-l="Prazo"><BarraPrazo l={{ etapa: i.etapa, prazoDias: DIAS_ATRASO, diasUsados: i.dias, atrasada: i.atrasada, noPrazo: !!row.executadoEm && i.dias <= DIAS_ATRASO, executadoEm: row.executadoEm ?? null }} /></td>
                        <td data-l="" className="r" onClick={e => e.stopPropagation()}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {principal === 'aprovar' && <button type="button" className="so-btn so-primary sm" disabled={ocupado} onClick={() => void acaoOS(row, 'aprovar', undefined, `${numeroDaOS(row)} aprovada.`)}><Ic n="check" />Aprovar</button>}
                            {principal === 'baixa' && <Link to={rotaTenant(entityId, `os/${row.id}/baixa`)} className="so-btn so-mintbtn sm"><Ic n="image" />Dar baixa</Link>}
                            {principal === 'conferir' && <Link to={rotaTenant(entityId, `os/${row.id}`)} className="so-btn so-primary sm"><Ic n="shieldCheck" />Conferir</Link>}
                            <button type="button" className="so-acao edit" title={`Imprimir ${numeroDaOS(row)}`} aria-label={`Imprimir ${numeroDaOS(row)}`} onClick={() => setRowImprimir(row)}><Ic n="doc" /></button>
                            {(i.etapa === 'FINALIZADA' || i.etapa === 'CANCELADA') && podeConferir && (
                              <button type="button" className="so-acao edit" title="Reabrir" aria-label={`Reabrir ${numeroDaOS(row)}`} disabled={ocupado} onClick={() => { setRowReabrir(row); setMotivo(''); }}><Ic n="voltar" /></button>
                            )}
                            <AcoesLinha nome={numeroDaOS(row)} onEditar={() => setEditRow(row)} onExcluir={() => excluir(row)} />
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
      )}

      <BarraAcoes esquerda={<><b>{config.nome}</b><Sep />{mesTexto}<Sep />{total} no mês<Sep />{atrasadas} atrasadas</>}>
        <button type="button" className="so-btn so-ghost" onClick={() => setAjudaOpen(true)}><Ic n="info" />Como usar</button>
        <Link to={rotaTenant(entityId, 'os')} className="so-btn so-ghost"><Ic n="list" />Todas as OS</Link>
        <button type="button" className="so-btn so-primary os-shine" onClick={novaOcorrencia}>Nova OS<Ic n="seta" className="arrow" /></button>
      </BarraAcoes>

      {/* reabrir com motivo (fica na linha do tempo da OS) */}
      {rowReabrir && (
        <Janela icone="voltar" tom="amber" eyebrow={numeroDaOS(rowReabrir)} titulo="Reabrir esta OS?" largura={480}
          sub="Ela volta para a equipe como Registrada. O motivo fica na linha do tempo."
          onFechar={() => setRowReabrir(null)}
          rodape={<>
            <button type="button" className="so-btn so-ghost" onClick={() => setRowReabrir(null)}>Voltar</button>
            <button type="button" className="so-btn so-amberbtn" disabled={motivo.trim().length < 5 || saving === rowReabrir.id}
              onClick={() => { const r = rowReabrir; setRowReabrir(null); void acaoOS(r, 'reabrir', motivo.trim(), `${numeroDaOS(r)} reaberta.`); }}>Reabrir</button>
          </>}>
          <label className="so-field"><span className="so-lbl">Motivo <span className="req">*</span></span>
            <span className="so-ctrl" style={{ height: 'auto' }}><textarea rows={3} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Explique em poucas palavras"
              style={{ width: '100%', border: 0, background: 'transparent', padding: '9px 11px', font: 'inherit', resize: 'vertical' }} /></span>
          </label>
        </Janela>
      )}

      {/* editar ocorrência */}
      {editRow && centro && (
        <NovaOcorrenciaModal
          config={config}
          centro={centro}
          propMap={propMap.current}
          editRow={editRow}
          entityId={entityId}
          municipalityName={session.entity.municipalityName}
          uf={session.entity.uf}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); void load(); }}
        />
      )}

      {/* OS para imprimir */}
      {rowImprimir && (
        <OrdemServicoModal row={rowImprimir} config={config} propConfigs={propConfigs.current} onClose={() => setRowImprimir(null)} />
      )}

      <ServicoInstrucoesDrawer slug={ajudaOpen ? (slug ?? null) : null} nomeServico={config.nome} corServico={config.cor} onClose={() => setAjudaOpen(false)} />
      {janelaExclusao}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
