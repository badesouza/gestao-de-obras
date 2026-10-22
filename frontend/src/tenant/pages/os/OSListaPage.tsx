import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { osApi, type Etapa, type FiltrosOS, type OrigemOS, type PainelOS } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { Aviso, BarraAcoes, Cabecalho, Cartao, Carregando, Ic, Pagina, Placar, Selo, Sep, msgErro, rotaTenant } from '../../components/sisobras/so';
import { haQuanto } from '../../components/obras/util';
import { Anel, Avatares, BarraPrazo, EtapaPill, MarcaServico, Spark, corAvatar, siglaDe } from './os-ui';
import { NovaOSJanela } from './NovaOSJanela';

const ABAS: { chave: string; nome: string; aviso?: (p: PainelOS) => string }[] = [
  { chave: 'TODAS', nome: 'Todas' },
  { chave: 'AGUARDANDO_APROVACAO', nome: 'Aguardando aprovação', aviso: p => p.poderes.podeAprovar && p.contagem.AGUARDANDO_APROVACAO ? 'aprovar' : '' },
  { chave: 'REGISTRADA', nome: 'Registradas' },
  { chave: 'EXECUTADA', nome: 'Executadas', aviso: p => p.poderes.podeConferir && p.contagem.EXECUTADA ? 'conferir' : '' },
  { chave: 'FINALIZADA', nome: 'Finalizadas' },
  { chave: 'CANCELADA', nome: 'Canceladas' },
];
const ORIGEM: Record<OrigemOS, string> = { ESCRITORIO: 'escritório', CAMPO: 'campo', MUNICIPE: 'munícipe' };
const quandoCurto = (iso: string) => {
  const d = new Date(iso), hoje = new Date();
  const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoje.toDateString()) return `hoje ${h}`;
  const ontem = new Date(hoje.getTime() - 86_400_000);
  if (d.toDateString() === ontem.toDateString()) return `ontem ${h}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${h}`;
};

/** Tela 11 · Ordens de Serviço — indicadores, onde estão, carga das equipes e a lista */
export function OSListaPage() {
  const { entityId } = useTenant();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { toasts, showToast, closeToast } = useToast();
  const [dados, setDados] = useState<PainelOS | null>(null);
  const [erro, setErro] = useState('');
  const [nova, setNova] = useState(params.get('nova') === '1');
  const [busca, setBusca] = useState('');
  const [f, setF] = useState<FiltrosOS>({ etapa: params.get('etapa') ?? 'TODAS' });
  const buscaRef = useRef<number>(0);

  const carregar = useCallback((filtros: FiltrosOS) => {
    osApi.painel(entityId, filtros).then(d => { setDados(d); setErro(''); }).catch(e => setErro(msgErro(e, 'Não foi possível carregar as OS')));
  }, [entityId]);
  useEffect(() => { carregar(f); }, [carregar, f]);
  /* "ao vivo": atualiza a cada minuto */
  useEffect(() => { const t = window.setInterval(() => carregar(f), 60_000); return () => window.clearInterval(t); }, [carregar, f]);
  useEffect(() => {
    window.clearTimeout(buscaRef.current);
    buscaRef.current = window.setTimeout(() => setF(x => (x.busca ?? '') === busca.trim() ? x : { ...x, busca: busca.trim() || undefined }), 350);
  }, [busca]);
  const muda = (p: Partial<FiltrosOS>) => setF(x => ({ ...x, ...p }));
  const escolherAba = (etapa: string) => { muda({ etapa }); setParams(etapa === 'TODAS' ? {} : { etapa }, { replace: true }); };

  if (!dados) return <Pagina>{erro ? <Aviso tom="amber">{erro}</Aviso> : <Carregando />}</Pagina>;
  const k = dados.kpis;
  const esperando = k.aprovar + k.conferir;
  const delta = k.feitasSemanaAnt ? Math.round((k.feitasSemana - k.feitasSemanaAnt) / k.feitasSemanaAnt * 100) : null;
  const maxBairro = Math.max(1, ...dados.bairros.map(b => b.n));
  const acaoDa = (etapa: Etapa, minhaBaixa: boolean) =>
    etapa === 'AGUARDANDO_APROVACAO' && dados.poderes.podeAprovar ? 'Aprovar'
      : etapa === 'EXECUTADA' && dados.poderes.podeConferir && !minhaBaixa ? 'Conferir'
        : etapa === 'REGISTRADA' && dados.poderes.podeBaixa ? 'Abrir' : 'Ver';

  return (
    <Pagina>
      <Cabecalho rotulo="Ordens de Serviço" selo={<Selo icone="osCheck" />}
        eyebrow="Gestão de Obras · Ordens de Serviço" titulo="Ordens de Serviço"
        extras={<span className="os-pill cyan"><i />ao vivo</span>}
        sub="Toda OS tem número oficial, serviço e equipe. Você vê só as OS dos serviços que atende e das suas equipes."
        direita={<Placar n={esperando} de="OS" rotulo="esperando você" />}>
        {dados.eventos.length > 0 && (
          <div className="os-ticker" aria-label="Chegando do campo">
            <span className="lb"><span className="os-pill cyan" style={{ height: 18, padding: '0 7px', fontSize: 9 }}><i />agora</span>chegando do campo</span>
            <div className="vp"><div className="tr">
              {[0, 1].map(volta => dados.eventos.map(ev => (
                <span key={`${volta}-${ev.id}-${ev.tipo}`}><span className="mono">{ev.numeroOS ?? 'OS'}</span> {ev.texto} · {haQuanto(ev.quando)}</span>
              )))}
            </div></div>
          </div>
        )}
      </Cabecalho>

      <section className="os-kpis" aria-label="Indicadores">
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#635BFF,#8B85FF)', '--ks': 'rgba(99,91,255,.8)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg></span>Abertas agora</div>
          <div className="v"><span className="os-num" key={k.abertas}>{k.abertas}</span><span className="os-delta neutro">+{k.abertasHoje} hoje</span></div>
          <Spark valores={k.serieAbertas} />
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#E5534B,#F59088)', '--ks': 'rgba(229,83,75,.8)', '--kg': 'rgba(229,83,75,.14)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>Atrasadas</div>
          <div className="v"><span className="os-num" key={k.atrasadas} style={{ color: k.atrasadas ? 'var(--coral)' : undefined }}>{k.atrasadas}</span>
            {k.atrasadas > 0 && <button type="button" className="os-delta ruim" style={{ border: 0, cursor: 'pointer' }} onClick={() => muda({ atrasadas: true, etapa: 'TODAS' })}>ver quais</button>}</div>
          <small>passaram do prazo do serviço e ainda não tiveram baixa</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#F2B44C,#E8962A)', '--ks': 'rgba(232,150,42,.8)', '--kg': 'rgba(242,180,76,.18)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg></span>Esperando você</div>
          <div className="v"><span className="os-num" key={esperando}>{esperando}</span>{esperando > 0 && <span className="os-pill amber" style={{ height: 20, fontSize: 10.5 }}><i />agora</span>}</div>
          <small>{dados.poderes.podeAprovar || dados.poderes.podeConferir ? `${k.aprovar} para aprovar · ${k.conferir} baixa${k.conferir === 1 ? '' : 's'} para conferir` : 'você não aprova nem confere'}</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#19B88A,#10C6D4)', '--ks': 'rgba(25,184,138,.8)', '--kg': 'rgba(25,184,138,.16)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg></span>Feitas na semana</div>
          <div className="v"><span className="os-num" key={k.feitasSemana}>{k.feitasSemana}</span>
            {delta != null && <span className={`os-delta ${delta > 0 ? 'bom' : delta < 0 ? 'ruim' : 'neutro'}`}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {Math.abs(delta)}% sobre a anterior</span>}</div>
          <Spark valores={k.serieFeitas} cor="#19B88A" area="rgba(25,184,138,.14)" />
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#10C6D4,#635BFF)', '--ks': 'rgba(16,198,212,.8)', '--kg': 'rgba(16,198,212,.16)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-6" /></svg></span>No prazo · 30 dias</div>
          <div className="os-ringwrap">
            <Anel pct={k.noPrazoPct ?? 0} id="osRingLista" />
            <div><div className="v"><span className="os-num sm">{k.noPrazoPct ?? '—'}</span>{k.noPrazoPct != null && <span className="os-u">%</span>}</div>
              <small>{k.tempoMedioDias != null ? `tempo médio ${k.tempoMedioDias.toLocaleString('pt-BR')} dias` : 'nenhuma baixa nos últimos 30 dias'}</small></div>
          </div>
        </article>
      </section>

      <div className="so-split">
        <Cartao icone="pin" titulo="Onde estão as abertas" meta={`por bairro · ${k.abertas} OS`} ajuda="Ajuda: Bairros" className="grow os-lift">
          {dados.bairros.length ? (
            <div className="os-bars">
              {dados.bairros.map(b => (
                <div key={b.nome} className="os-bar">
                  <span title={b.nome} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nome}</span>
                  <span className="tk"><span style={{ width: `${Math.max(6, b.n / maxBairro * 100)}%`, ...(b.atrasadas ? { background: 'repeating-linear-gradient(-45deg,#E5534B 0 6px,#F38C84 6px 12px)' } : {}) }} /></span>
                  <span className="n">{b.n}</span>
                </div>
              ))}
            </div>
          ) : <p className="so-help">Nenhuma OS aberta agora.</p>}
        </Cartao>
        <Cartao icone="users" tomIcone="mint" titulo="Carga das equipes" ajuda="Ajuda: Equipes" className="side os-lift" corpoStyle={{ gap: 2 }}>
          {dados.equipes.length ? dados.equipes.slice(0, 6).map(e => {
            const pct = e.noPrazoPct;
            const cor = pct == null ? 'var(--surface-3)' : pct >= 85 ? 'var(--grad-mint)' : pct >= 60 ? 'linear-gradient(90deg,#F2B44C,#E8962A)' : 'linear-gradient(90deg,#E5534B,#F59088)';
            return (
              <button key={e.id} type="button" className="os-team" onClick={() => muda({ equipeId: f.equipeId === e.id ? undefined : e.id })}
                style={{ border: 0, background: f.equipeId === e.id ? 'var(--brand-soft)' : undefined, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                <span><b>{e.nome}</b><small>{e.abertas} {e.abertas === 1 ? 'aberta' : 'abertas'}</small></span>
                {e.pessoas.length ? <Avatares pessoas={e.pessoas} /> : <span />}
                <span className="tk"><span style={{ width: `${pct ?? 0}%`, background: cor }} /></span>
                <span className="pc" style={{ color: pct == null ? 'var(--muted)' : pct >= 85 ? 'var(--mint)' : pct >= 60 ? 'var(--amber)' : 'var(--coral)' }}>{pct == null ? '—' : `${pct}%`}</span>
              </button>
            );
          }) : <p className="so-help">Nenhuma equipe.</p>}
          <p className="so-help" style={{ padding: '6px 10px 0' }}>% = OS com baixa no prazo nos últimos 30 dias. Toque numa equipe para filtrar.</p>
        </Cartao>
      </div>

      <nav className="so-tabs" aria-label="Etapas da OS">
        {ABAS.map(a => {
          const aviso = a.aviso?.(dados) ?? '';
          return (
            <button key={a.chave} type="button" className={`so-tab${f.etapa === a.chave ? ' on' : ''}`} onClick={() => escolherAba(a.chave)}>
              {a.nome} <span className="n">{dados.contagem[a.chave] ?? 0}</span>{aviso && f.etapa !== a.chave && <span className="w">{aviso}</span>}
            </button>
          );
        })}
      </nav>

      <Cartao icone="list" titulo={ABAS.find(a => a.chave === f.etapa)?.nome === 'Todas' ? 'Todas as OS' : ABAS.find(a => a.chave === f.etapa)?.nome ?? 'OS'}
        meta={`mostrando ${Math.min(dados.total, dados.linhas.length)}${dados.total > dados.linhas.length ? ` de ${dados.total}` : ''}${f.atrasadas ? ' atrasadas' : ''} · mais recentes primeiro`}
        ajuda="Ajuda: Lista de OS"
        direita={dados.poderes.podeAbrir && <button type="button" className="so-btn so-primary sm os-shine" onClick={() => setNova(true)}><Ic n="plus" />Nova OS</button>}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <label className="so-field" style={{ flex: '2 1 240px' }}><span className="so-sr">Buscar</span>
            <span className="so-ctrl"><Ic n="search" /><input type="search" placeholder="Nº da OS, rua, bairro ou tipo" value={busca} onChange={e => setBusca(e.target.value)} /></span>
          </label>
          <label className="so-field" style={{ flex: '1 1 160px' }}><span className="so-sr">Serviço</span>
            <span className="so-ctrl"><select value={f.servicoId ?? ''} onChange={e => muda({ servicoId: e.target.value || undefined })}><option value="">Todos os meus serviços</option>{dados.servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></span>
          </label>
          <label className="so-field" style={{ flex: '1 1 150px' }}><span className="so-sr">Equipe</span>
            <span className="so-ctrl"><select value={f.equipeId ?? ''} onChange={e => muda({ equipeId: e.target.value || undefined })}><option value="">Todas as equipes</option>{dados.equipes.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></span>
          </label>
          <label className="so-field" style={{ flex: '1 1 140px' }}><span className="so-sr">Origem</span>
            <span className="so-ctrl"><select value={f.origem ?? ''} onChange={e => muda({ origem: (e.target.value || undefined) as OrigemOS | undefined })}><option value="">Toda origem</option><option value="MUNICIPE">Munícipe</option><option value="ESCRITORIO">Escritório</option><option value="CAMPO">Campo</option></select></span>
          </label>
          <button type="button" className={`so-chip alert${f.atrasadas ? ' on' : ''}`} onClick={() => muda({ atrasadas: !f.atrasadas })}>Só atrasadas <span className="n">{k.atrasadas}</span></button>
        </div>

        <div className="so-tw">
          <table className="so-table os-rows">
            <thead><tr><th scope="col">Nº da OS</th><th scope="col">Serviço</th><th scope="col">Onde</th><th scope="col">Equipe</th><th scope="col">Etapa</th><th scope="col">Prazo</th><th scope="col"><span className="so-sr">Abrir</span></th></tr></thead>
            <tbody>
              {dados.linhas.map(l => {
                const acao = acaoDa(l.etapa, l.executadoPorMim);
                const destaque = acao === 'Aprovar' || acao === 'Conferir';
                return (
                  <tr key={l.id} onClick={() => nav(rotaTenant(entityId, `os/${l.id}`))} style={{ cursor: 'pointer' }}>
                    <td data-l="Nº da OS"><span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{l.numeroOS ?? '—'}</span><span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{quandoCurto(l.criadoEm)} · {ORIGEM[l.origem]}</span></td>
                    <td data-l="Serviço"><MarcaServico nome={l.servico.nome} cor={l.servico.cor} sub={l.tipo || undefined} /></td>
                    <td data-l="Onde">{l.logradouro || '—'}<span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{l.bairro}</span></td>
                    <td data-l="Equipe">{l.equipe ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="os-av" style={{ '--a': corAvatar(l.equipe.nome) } as React.CSSProperties}>{siglaDe(l.equipe.nome)}</span><span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{l.equipe.nome}</span></span> : <span className="so-help">sem equipe</span>}</td>
                    <td data-l="Etapa"><EtapaPill etapa={l.etapa} devolvida={l.devolvida} /></td>
                    <td data-l="Prazo"><BarraPrazo l={l} /></td>
                    <td data-l="" className="r">
                      <Link to={rotaTenant(entityId, `os/${l.id}`)} className={`so-btn sm ${destaque ? 'so-primary' : 'so-ghost'}`} onClick={e => e.stopPropagation()}>{acao}</Link>
                    </td>
                  </tr>
                );
              })}
              {!dados.linhas.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 22 }}>Nenhuma OS aqui{f.atrasadas ? ' atrasada' : ''}.</td></tr>}
            </tbody>
          </table>
        </div>
      </Cartao>

      <BarraAcoes esquerda={<><b>{k.abertas} OS abertas</b><Sep />{k.atrasadas} atrasadas<Sep />{k.noPrazoPct != null ? `${k.noPrazoPct}% no prazo` : 'sem baixas no mês'}<Sep />{dados.servicos.length} serviços</>}>
        <Link to={rotaTenant(entityId, 'minhas-os')} className="so-btn so-ghost"><Ic n="list" />Ver no celular</Link>
        {dados.poderes.podeAbrir && <button type="button" className="so-btn so-primary os-shine" onClick={() => setNova(true)}>Nova OS<Ic n="seta" className="arrow" /></button>}
      </BarraAcoes>

      {nova && (
        <NovaOSJanela onFechar={() => { setNova(false); if (params.get('nova')) setParams({}, { replace: true }); }}
          onCriada={r => { setNova(false); showToast(`${r.numeroOS} aberta · aguardando aprovação`); carregar(f); }} />
      )}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
