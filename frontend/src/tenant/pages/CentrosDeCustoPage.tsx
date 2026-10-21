import { useEffect, useMemo, useState } from 'react';
import { ApiError, centrosDeCustoApi, type CentroDeCusto, type TipoCentroDeCusto } from '../../lib/api-client';
import { useTenant, useTenantPermission } from '../TenantContext';
import { Dialogo, Kpi, KpiCarregando } from '../components/obras/ui';
import { CENTRO_IDS, SERVICOS_CONFIG } from './servico-config';
import { Link } from 'react-router-dom';
import '../styles/compras-ui.css';

/* ── Centros de custo: onde cada despesa e cada serviço é apropriado ── */

const TIPOS: { id: TipoCentroDeCusto; rotulo: string; cor: string }[] = [
  { id: 'SECRETARIA', rotulo: 'Secretaria', cor: '#7C3AED' },
  { id: 'SETOR', rotulo: 'Setor', cor: '#2563EB' },
  { id: 'PROGRAMA', rotulo: 'Programa', cor: '#0891B2' },
  { id: 'OBRA', rotulo: 'Obra', cor: '#D97706' },
  { id: 'OUTRO', rotulo: 'Outro', cor: '#78716C' },
];
const tipo = (t: TipoCentroDeCusto) => TIPOS.find(x => x.id === t)!;
const real = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const SERVICOS = Object.values(SERVICOS_CONFIG).map(s => ({ id: CENTRO_IDS[s.slug], nome: s.nome, cor: s.cor, icon: s.icon }));

type Form = { id?: string; codigo: string; nome: string; tipo: TipoCentroDeCusto; responsavel: string; descricao: string; paiId: string; ativo: boolean; servicos: string[] };
const vazio: Form = { codigo: '', nome: '', tipo: 'SETOR', responsavel: '', descricao: '', paiId: '', ativo: true, servicos: [] };

export function CentrosDeCustoPage() {
  const { entityId } = useTenant();
  const podeGerir = useTenantPermission('centros_custo.manage');
  const [dados, setDados] = useState<Awaited<ReturnType<typeof centrosDeCustoApi.listar>> | null>(null);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = () => centrosDeCustoApi.listar(entityId).then(d => { setDados(d); setErro(''); }).catch(e => setErro(e instanceof Error ? e.message : 'Erro ao carregar'));
  useEffect(() => { void carregar(); }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 6000); return () => clearTimeout(t); }, [aviso]);

  const centros = useMemo(() => dados?.itens ?? [], [dados]);
  const ativos = centros.filter(c => c.ativo);
  const totalComprometido = centros.reduce((s, c) => s + Number(c.valorComprometido), 0);
  const semCentro = Number(dados?.valorSemCentro ?? 0);
  const servicosSemCentro = SERVICOS.filter(s => !centros.some(c => c.servicos.some(x => x.id === s.id)));
  const maior = Math.max(1, ...centros.map(c => Number(c.valorComprometido)));
  const termo = busca.trim().toLowerCase();
  const visiveis = centros.filter(c => !termo || `${c.codigo} ${c.nome} ${c.responsavel ?? ''}`.toLowerCase().includes(termo));

  const abrir = (c?: CentroDeCusto) => {
    setErroForm('');
    setForm(c ? {
      id: c.id, codigo: c.codigo, nome: c.nome, tipo: c.tipo, responsavel: c.responsavel ?? '', descricao: c.descricao ?? '',
      paiId: c.paiId ?? '', ativo: c.ativo, servicos: c.servicos.map(s => s.id),
    } : { ...vazio });
  };

  const salvar = async () => {
    if (!form) return;
    setSalvando(true); setErroForm('');
    try {
      const corpo = { codigo: form.codigo.trim(), nome: form.nome.trim(), tipo: form.tipo, responsavel: form.responsavel.trim() || null, descricao: form.descricao.trim() || null, paiId: form.paiId || null, ativo: form.ativo };
      const c = form.id ? await centrosDeCustoApi.atualizar(entityId, form.id, corpo) : await centrosDeCustoApi.criar(entityId, corpo);
      setForm(null); setAviso(`Centro de custo ${c.codigo} salvo.`);
      await carregar();
    } catch (e) {
      setErroForm(e instanceof ApiError ? e.body.message : 'Não foi possível salvar');
    } finally { setSalvando(false); }
  };

  const remover = async () => {
    if (!form?.id) return;
    setSalvando(true);
    try {
      const r = await centrosDeCustoApi.remover(entityId, form.id);
      setForm(null); setAviso(r.removido ? 'Centro de custo excluído.' : 'Este centro já tem lançamentos: foi desativado para preservar o histórico.');
      await carregar();
    } catch (e) { setErroForm(e instanceof ApiError ? e.body.message : 'Não foi possível excluir'); }
    finally { setSalvando(false); }
  };

  return (
    <div className="ob-page ob-claro" style={{ '--serv-cor': '#7C3AED' } as React.CSSProperties}>
      <header className="ob-head ob-reveal" style={{ '--i': 0 } as React.CSSProperties}>
        <div className="ob-serv-titulo">
          <span className="ob-serv-icone">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>
          </span>
          <div className="ob-head-texto">
            <span className="ob-eyebrow ob-eyebrow-serv">Gestão</span>
            <h1 className="ob-h1">Centros de custo</h1>
            <p className="ob-sub">Onde cada despesa é apropriada. Cada serviço tem um centro padrão, que pode ser trocado em cada ocorrência e em cada item de compra.</p>
          </div>
        </div>
        {podeGerir && <div className="ob-head-acoes"><button type="button" className="ob-btn" onClick={() => abrir()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo centro de custo
        </button></div>}
      </header>

      <section className="ob-kpis" aria-label="Resumo">
        {!dados ? [1, 2, 3, 4].map(n => <KpiCarregando key={n} />) : (
          <>
            <Kpi i={1} rotulo="Centros ativos" valor={ativos.length} cor="#7C3AED" nota={centros.length - ativos.length ? `${centros.length - ativos.length} desativados` : 'todos ativos'} tom="neutro" grafico={null} />
            <div className="ob-kpi ob-reveal" style={{ '--i': 2, '--kpi-cor': 'var(--ob-blue)' } as React.CSSProperties}>
              <span className="ob-kpi-rotulo">Comprometido em compras</span>
              <div className="ob-kpi-linha"><span className="ob-kpi-valor cp-kpi-dinheiro">{real(totalComprometido)}</span></div>
              <div className="ob-kpi-rodape"><span className={`ob-kpi-nota ${semCentro ? 'tom-alerta' : 'tom-ok'}`}>{semCentro ? `${real(semCentro)} ainda sem centro` : 'tudo apropriado'}</span></div>
            </div>
            <Kpi i={3} rotulo="Ocorrências no mês" valor={centros.reduce((s, c) => s + c.ocorrenciasMes, 0)} cor="var(--ob-green)" nota="apropriadas a algum centro" tom="neutro" grafico={null} />
            <Kpi i={4} rotulo="Serviços sem centro padrão" valor={servicosSemCentro.length} cor={servicosSemCentro.length ? 'var(--ob-amber)' : 'var(--ob-green)'}
              nota={servicosSemCentro.length ? servicosSemCentro.slice(0, 2).map(s => s.nome).join(', ') + (servicosSemCentro.length > 2 ? '…' : '') : 'todos vinculados'}
              tom={servicosSemCentro.length ? 'alerta' : 'ok'} grafico={null} />
            {servicosSemCentro.length > 0 && <Link to={`/t/${entityId}/servicos`} className="sc-link-servicos">Definir nos Serviços Urbanos →</Link>}
          </>
        )}
      </section>

      {aviso && <div className="cp-aviso" role="status">{aviso}</div>}

      <section className="ob-card ob-reveal" style={{ '--i': 5 } as React.CSSProperties} aria-label="Centros de custo">
        <div className="ob-filtros">
          <span className="cf-rotulo" style={{ paddingLeft: 4 }}>{centros.length} {centros.length === 1 ? 'centro' : 'centros'}</span>
          <label className="ob-busca">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.5" y2="16.5"/></svg>
            <span className="ob-sr">Buscar</span>
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Código, nome ou responsável" />
          </label>
        </div>
        {erro && <div className="ob-erro" style={{ margin: '0 16px 12px' }}>{erro}</div>}
        {!dados && !erro && <div className="ob-lista">{[1, 2, 3].map(n => <span key={n} className="ob-skeleton" style={{ height: 90 }} />)}</div>}
        {dados && centros.length === 0 && (
          <div className="ob-vazio-grande">
            <span className="ob-serv-icone ob-serv-icone-grande"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg></span>
            <strong>Nenhum centro de custo cadastrado</strong>
            <span>Cadastre os centros (ex.: 02.01 Secretaria de Obras, 02.01.03 Manutenção Viária) e vincule cada serviço ao seu centro padrão.</span>
            {podeGerir && <button type="button" className="ob-btn" onClick={() => abrir()}>Cadastrar o primeiro</button>}
          </div>
        )}
        <div className="cc-grade">
          {visiveis.map((c, i) => {
            const t = tipo(c.tipo);
            const pai = centros.find(x => x.id === c.paiId);
            return (
              <button key={c.id} type="button" className={`cc-cartao ob-reveal${c.ativo ? '' : ' is-inativo'}`} style={{ '--i': Math.min(i, 12), '--tipo-cor': t.cor } as React.CSSProperties}
                onClick={() => podeGerir && abrir(c)} disabled={!podeGerir}>
                <span className="cc-topo">
                  <span className="cc-codigo">{c.codigo}</span>
                  <span className="cc-tipo">{t.rotulo}</span>
                  {!c.ativo && <span className="ob-badge is-cancelada"><i />desativado</span>}
                </span>
                <strong className="cc-nome">{c.nome}</strong>
                {(pai || c.responsavel) && <span className="cc-sub">{pai ? `dentro de ${pai.codigo} · ` : ''}{c.responsavel ? `resp. ${c.responsavel}` : ''}</span>}
                <span className="cc-valor"><b>{real(Number(c.valorComprometido))}</b> comprometido</span>
                <span className="cc-barra"><span style={{ width: `${(Number(c.valorComprometido) / maior) * 100}%` }} /></span>
                <span className="cc-numeros">{c.ocorrenciasMes} ocorrências no mês · {c.ocorrencias} no total</span>
                {c.servicos.length > 0 && (
                  <span className="cc-servicos">
                    {c.servicos.map(s => {
                      const cfg = SERVICOS.find(x => x.id === s.id);
                      return <span key={s.id} style={{ '--serv-cor': cfg?.cor ?? '#78716C' } as React.CSSProperties}>{cfg?.icon}{cfg?.nome ?? s.nome}</span>;
                    })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {form && (
        <Dialogo
          titulo={form.id ? `Editar ${form.codigo}` : 'Novo centro de custo'}
          onFechar={() => setForm(null)}
          acoes={<>
            {form.id && <button type="button" className="ob-btn-ghost ob-btn-alto ob-btn-perigo-suave" onClick={() => void remover()} disabled={salvando}>Excluir</button>}
            <button type="button" className="ob-btn-ghost ob-btn-alto" onClick={() => setForm(null)}>Cancelar</button>
            <button type="button" className="ob-acao is-aprovar" onClick={() => void salvar()} disabled={salvando || !form.codigo.trim() || form.nome.trim().length < 2}>{salvando ? 'Salvando…' : 'Salvar'}</button>
          </>}
        >
          <div className="cc-form">
            <label className="cc-campo cc-curto"><span>Código</span><input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="02.01.03" maxLength={20} /></label>
            <label className="cc-campo"><span>Nome</span><input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Manutenção viária" maxLength={200} /></label>
            <div className="cc-campo cc-largo"><span>Tipo</span>
              <div className="cc-tipos">
                {TIPOS.map(t => <button key={t.id} type="button" className={`ob-chip${form.tipo === t.id ? ' is-ativo' : ''}`} onClick={() => setForm({ ...form, tipo: t.id })}><i style={{ background: t.cor }} />{t.rotulo}</button>)}
              </div>
            </div>
            <label className="cc-campo"><span>Responsável <em>opcional</em></span><input value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} maxLength={160} /></label>
            <label className="cc-campo"><span>Dentro de <em>opcional</em></span>
              <select value={form.paiId} onChange={e => setForm({ ...form, paiId: e.target.value })}>
                <option value="">— nenhum —</option>
                {centros.filter(c => c.id !== form.id).map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
              </select>
            </label>
            <div className="cc-campo cc-largo"><span>Serviços que lançam neste centro</span>
              <p className="sc-nota" style={{ margin: 0 }}>
                {form.servicos.length
                  ? SERVICOS.filter(s => form.servicos.includes(s.id)).map(s => s.nome).join(', ')
                  : 'Nenhum serviço ainda.'}{' '}
                A escolha é feita em cada serviço, em <Link to={`/t/${entityId}/servicos`}>Serviços Urbanos</Link>.
              </p>
            </div>
            {form.id && <label className="cc-ativo"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} /> Ativo (desmarque para não aparecer em novos lançamentos)</label>}
          </div>
          {erroForm && <div className="ob-erro">{erroForm}</div>}
        </Dialogo>
      )}
    </div>
  );
}
