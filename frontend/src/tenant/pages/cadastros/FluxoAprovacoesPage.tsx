import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fluxoApi } from '../../../lib/api-client';
import type { ConfigFluxo, DadosFluxo, OrigemOS, PassoFluxo, PessoaFluxo } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import { Ajuda, BarraAcoes, Cabecalho, Carregando, Ic, Janela, Pagina, Placar, Selo, Sep, msgErro, rotaTenant } from '../../components/sisobras/so';

/** Caixas de cada passo (as mesmas da tela Acessos) */
const CHAVES: Record<PassoFluxo, string[]> = {
  'os.triar': ['os.triar'],
  'os.aprovar': ['os.aprovar'],
  'os.conferir': ['os.conferir'],
  'os.cancelar': ['os.cancelar', 'os.reabrir'],
  'compras.pedir': ['compras.orcar', 'compras.lancar'],
  'compras.revisar': ['compras.revisar'],
  'compras.aprovar': ['compras.aprovar'],
  'compras.enviar': ['compras.enviar'],
  'compras.receber': ['compras.receber'],
};

type ChaveLiga = 'exigeAprovacaoOS' | 'exigeConferencia' | 'exigeRevisaoCompra' | 'exigeAprovacaoCompra';
type ChaveOpcao = 'conferenciaPropriaBloqueada' | 'pedidoSoDeOrcamento' | `origem:${OrigemOS}` | 'trava';

interface DefPasso {
  n: number; nome: string; desc: string;
  passo?: PassoFluxo; liga?: ChaveLiga; info?: boolean;
  opcoes?: { chave: ChaveOpcao; texto: string; travado?: boolean }[];
}

const FLUXO_OS: DefPasso[] = [
  { n: 1, passo: 'os.triar', nome: 'Triar pedido do munícipe', desc: 'Na Central de Solicitações, olha o que chegou pelo link ou QR Code e transforma em OS (já sai aprovada) ou recusa com motivo.' },
  { n: 2, passo: 'os.aprovar', nome: 'Aprovar a abertura da OS', desc: 'Toda OS aberta no escritório ou em campo (fiscal ou coordenador) entra na Central de Solicitações e só vai para a equipe depois que o responsável aprova. Pode recusar com motivo.' },
  { n: 3, info: true, nome: 'Executar e dar baixa', desc: 'Vai a campo, faz o serviço e dá baixa com as fotos do depois e quem trabalhou.' },
  { n: 4, passo: 'os.conferir', liga: 'exigeConferencia', nome: 'Conferir a baixa', desc: 'Alguém olha as fotos e finaliza a OS, ou reabre com motivo.',
    opcoes: [{ chave: 'conferenciaPropriaBloqueada', texto: 'Quem deu a baixa não pode conferir a própria baixa' }] },
  { n: 5, passo: 'os.cancelar', nome: 'Cancelar ou reabrir OS', desc: 'Sempre com motivo, que fica registrado na OS.' },
];

const FLUXO_PEDIDO: DefPasso[] = [
  { n: 1, passo: 'compras.pedir', nome: 'Fazer orçamento e lançar pedido', desc: 'Vai ao local, tira as fotos, escolhe os materiais do contrato e as quantidades por serviço.',
    opcoes: [{ chave: 'pedidoSoDeOrcamento', texto: 'O pedido só pode nascer de um orçamento' }] },
  { n: 2, passo: 'compras.revisar', liga: 'exigeRevisaoCompra', nome: 'Revisar o pedido', desc: 'Confere quantidades e saldo do contrato. Pode devolver com motivo.' },
  { n: 3, passo: 'compras.aprovar', liga: 'exigeAprovacaoCompra', nome: 'Aprovar o pedido', desc: 'Última palavra antes de ir ao fornecedor. Pode devolver com motivo.',
    opcoes: [{ chave: 'trava', texto: 'Quem revisou não pode aprovar o mesmo pedido', travado: true }] },
  { n: 4, passo: 'compras.enviar', nome: 'Enviar ao fornecedor', desc: 'Gera o PDF do pedido e marca como enviado.' },
  { n: 5, passo: 'compras.receber', nome: 'Registrar recebimento', desc: 'Lança o que chegou, parcial ou total. Baixa o saldo do contrato.' },
];

const NOME_PASSO: Record<PassoFluxo, string> = {
  'os.triar': 'Triar pedido do munícipe', 'os.aprovar': 'Aprovar a abertura', 'os.conferir': 'Conferir a baixa', 'os.cancelar': 'Cancelar ou reabrir',
  'compras.pedir': 'Orçamento e pedido', 'compras.revisar': 'Revisar pedido', 'compras.aprovar': 'Aprovar pedido',
  'compras.enviar': 'Enviar ao fornecedor', 'compras.receber': 'Registrar recebimento',
};

type Membros = Record<PassoFluxo, string[]>;

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
const atendeTxt = (p: PessoaFluxo) => p.atende === null ? 'todos os serviços' : p.atende ? `só ${p.atende}` : 'nenhum serviço';

function membrosDe(pessoas: PessoaFluxo[]): Membros {
  const m = {} as Membros;
  (Object.keys(CHAVES) as PassoFluxo[]).forEach(k => {
    m[k] = pessoas.filter(p => CHAVES[k].some(c => p.acessos.includes(c))).map(p => p.id);
  });
  return m;
}

/** Depois da base · Fluxo e aprovações (substitui a antiga tela Regras) */
export function FluxoAprovacoesPage() {
  const { entityId, session } = useTenant();
  const { toasts, showToast, closeToast } = useToast();
  const podeEditar = session.adminGeral || (session.acessos ?? []).includes('cad.regras');
  const [dados, setDados] = useState<DadosFluxo | null>(null);
  const [cfg, setCfg] = useState<ConfigFluxo | null>(null);
  const [membros, setMembros] = useState<Membros | null>(null);
  const [janela, setJanela] = useState<{ passo: PassoFluxo; sel: string[]; busca: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const aplicar = useCallback((d: DadosFluxo) => { setDados(d); setCfg(d.config); setMembros(membrosDe(d.pessoas)); }, []);
  useEffect(() => {
    fluxoApi.obter(entityId).then(aplicar).catch(e => showToast(msgErro(e, 'Não foi possível abrir o fluxo'), 'error'));
  }, [entityId, aplicar, showToast]);

  const original = useMemo(() => dados ? JSON.stringify({ c: dados.config, m: membrosDe(dados.pessoas) }) : '', [dados]);
  const sujo = !!cfg && !!membros && JSON.stringify({ c: cfg, m: membros }) !== original;

  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [sujo]);

  if (!dados || !cfg || !membros) return <Pagina><Carregando /><ToastContainer toasts={toasts} onClose={closeToast} /></Pagina>;

  const porId = new Map(dados.pessoas.map(p => [p.id, p]));
  const ligado = (d: DefPasso) => !d.liga || cfg[d.liga];
  const semNinguem = (d: DefPasso) => !!d.passo && ligado(d) && membros[d.passo].length === 0;
  const qtdSem = [...FLUXO_OS, ...FLUXO_PEDIDO].filter(semNinguem).length;

  function opcaoLigada(c: ChaveOpcao) {
    if (c === 'trava') return true;
    if (c.startsWith('origem:')) return cfg!.aprovacaoOrigens.includes(c.slice(7) as OrigemOS);
    return cfg![c as 'conferenciaPropriaBloqueada' | 'pedidoSoDeOrcamento'];
  }
  function trocarOpcao(c: ChaveOpcao) {
    if (c === 'trava') return;
    if (c.startsWith('origem:')) {
      const o = c.slice(7) as OrigemOS;
      const l = cfg!.aprovacaoOrigens;
      setCfg({ ...cfg!, aprovacaoOrigens: l.includes(o) ? l.filter(x => x !== o) : [...l, o] });
      return;
    }
    const k = c as 'conferenciaPropriaBloqueada' | 'pedidoSoDeOrcamento';
    setCfg({ ...cfg!, [k]: !cfg![k] });
  }
  function desvincular(passo: PassoFluxo, id: string) {
    setMembros({ ...membros!, [passo]: membros![passo].filter(x => x !== id) });
  }

  async function salvar() {
    if (!(cfg!.metaDias >= 1 && cfg!.metaDias <= 90)) { showToast('O prazo vai de 1 a 90 dias', 'warning'); return; }
    setSalvando(true);
    try {
      aplicar(await fluxoApi.salvar(entityId, cfg!, membros!));
      setJanela(null);
      showToast('Fluxo e aprovações salvos');
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  /* aviso de cada candidato na janela "Vincular login" */
  function avisoCandidato(passo: PassoFluxo, p: PessoaFluxo) {
    const tem = (k: PassoFluxo) => membros![k].includes(p.id);
    if (passo === 'compras.aprovar' && tem('compras.revisar')) return 'Também revisa pedidos: não aprova os que revisou.';
    if (passo === 'compras.revisar' && tem('compras.aprovar')) return 'Também aprova pedidos: não aprova os que revisou.';
    if (passo === 'os.conferir' && cfg!.conferenciaPropriaBloqueada && p.acessos.includes('os.baixa')) return 'Também dá baixa: não confere a própria baixa.';
    return '';
  }

  function Fluxo({ nome, desenho, trilha, passos }: { nome: string; desenho: string; trilha: { nome: string; liga?: ChaveLiga }[]; passos: DefPasso[] }) {
    const etapas = trilha.filter(t => !t.liga || cfg![t.liga]);
    const opcionais = passos.filter(p => p.liga).length;
    const janelaAqui = janela && passos.some(p => p.passo === janela.passo) ? janela : null;
    return (
      <section className="so-card so-rise" aria-label={nome}>
        <header className="so-chead">
          <span className="so-cic"><Ic n="fluxo" /></span>
          <h2>{nome}</h2>
          <span className="meta">{passos.length} passos · {opcionais} você liga ou desliga</span>
          <div className="right">
            <Link to={rotaTenant(entityId, desenho)} className="so-btn so-ghost sm">Ver o fluxograma<Ic n="seta" className="arrow" /></Link>
            <Ajuda texto={`Ajuda: ${nome}`} />
          </div>
        </header>
        <div className="so-cbody">
          <div className="so-trail" aria-label="Etapas">
            {etapas.map((t, i) => <span key={t.nome} className="st"><i>{String(i + 1).padStart(2, '0')}</i><span>{t.nome}</span></span>)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {passos.map(d => {
              const on = ligado(d);
              const sem = semNinguem(d);
              const destaque = !!janelaAqui && !!d.passo && janelaAqui.passo === d.passo;
              return (
                <article key={d.n} className={`so-card${sem ? ' warn' : destaque ? ' so-panel' : ''}`} style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }}>
                    <span className="so-cic n">{d.n}</span>
                    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)', margin: 0 }}>{d.nome}</h3>
                      <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.45 }}>{d.desc}</p>
                    </div>
                    {d.liga
                      ? <label className={`so-toggle${on ? ' on' : ''}`}><input type="checkbox" role="switch" className="so-switch" checked={on} disabled={!podeEditar} onChange={() => setCfg({ ...cfg!, [d.liga!]: !on })} /> {on ? 'Ligado' : 'Desligado'}</label>
                      : <span className="so-badge">Sempre ligado</span>}
                  </div>
                  {d.passo && (
                    <div className="so-people so-recuo">
                      <span className="so-k">Quem faz</span>
                      {membros![d.passo].map(id => {
                        const p = porId.get(id);
                        if (!p) return null;
                        return (
                          <span key={id} className="so-person"><span className="av">{iniciais(p.nome)}</span><span><b>{p.nome}</b> · {atendeTxt(p)}</span>
                            {podeEditar && <button type="button" className="rm" aria-label={`Desvincular ${p.nome}`} onClick={() => desvincular(d.passo!, id)}><Ic n="x" /></button>}
                          </span>
                        );
                      })}
                      {podeEditar && <button type="button" className="so-btn so-dashed sm" style={{ borderRadius: 999 }} onClick={() => setJanela({ passo: d.passo!, sel: [...membros![d.passo!]], busca: '' })}><Ic n="plus" />Vincular login</button>}
                    </div>
                  )}
                  {d.info && (
                    <div className="so-note plain so-recuo-m"><Ic n="info" /><span>Quem faz: os fiscais e equipes de cada serviço ({dados!.qtdBaixa} {dados!.qtdBaixa === 1 ? 'pessoa' : 'pessoas'}), conforme os serviços que cada um atende. <Link to={rotaTenant(entityId, 'cadastros/pessoas')} style={{ fontWeight: 800 }}>ver em Pessoas</Link></span></div>
                  )}
                  {sem && (
                    <div className="so-warnline so-recuo-m"><Ic n="alerta" />Ninguém vinculado. O que chegar neste passo vai ficar parado{dados!.admins > 0 ? ' (só o administrador geral consegue fazer)' : ''}.</div>
                  )}
                  {d.opcoes && on && (
                    <div className="so-recuo o" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {d.opcoes.map(o => {
                        const marcado = opcaoLigada(o.chave);
                        return (
                          <label key={o.chave} className={`so-ckrow${marcado ? ' on' : ''}`}>
                            <input type="checkbox" className="so-ck" checked={marcado} disabled={o.travado || !podeEditar} onChange={() => trocarOpcao(o.chave)} /> <span>{o.texto}</span>
                            {o.travado && <span className="so-badge" style={{ marginLeft: 'auto' }}>trava fixa</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  function JanelaVincular() {
    const j = janela!;
    const termo = j.busca.trim().toLowerCase();
    const lista = dados!.pessoas.filter(p => !termo || p.nome.toLowerCase().includes(termo) || p.perfil.toLowerCase().includes(termo));
    const osPasso = j.passo.startsWith('os.');
    const trocar = (id: string) => setJanela({ ...j, sel: j.sel.includes(id) ? j.sel.filter(x => x !== id) : [...j.sel, id] });
    return (
      <Janela icone="link" eyebrow={`Fluxo e aprovações · ${osPasso ? 'Ordem de Serviço' : 'Pedido de compra'}`}
        titulo={`Vincular login · ${NOME_PASSO[j.passo]}`}
        sub="Marque quem faz este passo. Vincular marca a caixa do passo nos acessos da pessoa."
        largura={620} onFechar={() => setJanela(null)} rotulo="Vincular login"
        rodape={<>
          <span className="so-help esq">{j.sel.length} {j.sel.length === 1 ? 'pessoa marcada' : 'pessoas marcadas'}</span>
          <button type="button" className="so-btn so-ghost" onClick={() => setJanela(null)}>Cancelar</button>
          <button type="button" className="so-btn so-primary" onClick={() => { setMembros({ ...membros!, [j.passo]: j.sel }); setJanela(null); }}><Ic n="check" />Vincular</button>
        </>}>
        <label className="so-ctrl"><Ic n="search" /><input type="search" placeholder="Buscar pessoa" aria-label="Buscar pessoa" value={j.busca} onChange={e => setJanela({ ...j, busca: e.target.value })} /></label>
        <div className="so-opts c2">
          {lista.map(p => {
            const on = j.sel.includes(p.id);
            const aviso = avisoCandidato(j.passo, p);
            return (
              <label key={p.id} className={`so-opt${on ? ' on' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => trocar(p.id)} />
                <span className="mt" style={{ borderRadius: '50%', fontSize: 10.5, fontWeight: 800 }}>{iniciais(p.nome)}</span>
                <span className="tx"><b>{p.nome}</b><small>{p.perfil} · {p.atende ? `só ${p.atende}` : 'atende todos'}</small>
                  {aviso && <small style={{ color: 'var(--amber)', fontWeight: 700, marginTop: 2 }}>{aviso}</small>}
                </span>
                <span className="mc"><Ic n="check" /></span>
              </label>
            );
          })}
          {!lista.length && <p className="so-help">Ninguém encontrado.</p>}
        </div>
        <p className="so-help">
          {osPasso ? 'A pessoa faz este passo só nas OS dos serviços que ela atende (cadastro em Pessoas). ' : ''}
          Ainda não tem login? <Link to={rotaTenant(entityId, 'cadastros/pessoas')}>Cadastrar pessoa</Link>
        </p>
      </Janela>
    );
  }

  return (
    <Pagina>
      <Cabecalho
        rotulo="Fluxo e aprovações"
        selo={<Selo icone="fluxo" />}
        eyebrow={<><Link to={rotaTenant(entityId, 'cadastros')}>Cadastros</Link> · Depois da base</>}
        titulo="Fluxo e aprovações"
        sub="Os passos já vêm montados. Você liga o que quiser usar e vincula o login de quem faz cada passo. Vincular aqui marca a caixa nos acessos da pessoa — é a mesma coisa vista pelo outro lado."
        direita={<Placar n={2} de="fluxos" rotulo="já montados" />}
      />

      {Fluxo({
        nome: 'Ordem de Serviço', desenho: 'cadastros/fluxo/os', passos: FLUXO_OS,
        trilha: [{ nome: 'Triagem' }, { nome: 'Aprovação' }, { nome: 'Execução' }, { nome: 'Conferência', liga: 'exigeConferencia' }, { nome: 'Finalizada' }],
      })}
      {Fluxo({
        nome: 'Pedido de compra', desenho: 'cadastros/fluxo/pedido', passos: FLUXO_PEDIDO,
        trilha: [{ nome: 'Orçamento' }, { nome: 'Pedido' }, { nome: 'Revisão', liga: 'exigeRevisaoCompra' }, { nome: 'Aprovação', liga: 'exigeAprovacaoCompra' }, { nome: 'Fornecedor' }, { nome: 'Recebido' }],
      })}

      <section className="so-card so-rise d1" aria-label="Prazo">
        <header className="so-chead">
          <span className="so-cic cyan"><Ic n="relogio" /></span>
          <h2>Prazo padrão de atendimento</h2>
          <div className="right"><Ajuda texto="Ajuda: Prazo" /></div>
        </header>
        <div className="so-cbody" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '12px 24px' }}>
          <p style={{ flex: '1 1 300px', margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>Depois desse prazo a OS aparece como atrasada no painel. Cada serviço pode ter o seu prazo (passo 7).</p>
          <label className="so-ctrl num"><input type="number" min={1} max={90} value={cfg.metaDias} disabled={!podeEditar} aria-label="Prazo em dias" onChange={e => setCfg({ ...cfg, metaDias: Number(e.target.value) })} /><span className="suf">dias</span></label>
        </div>
      </section>

      {janela && JanelaVincular()}

      <BarraAcoes esquerda={<>
        <b>2</b> fluxos<Sep />
        {qtdSem > 0
          ? <span style={{ color: 'var(--amber)', fontWeight: 800 }}>{qtdSem} {qtdSem === 1 ? 'passo sem ninguém' : 'passos sem ninguém'}</span>
          : <span>todo passo ligado tem alguém</span>}
        {sujo && <><Sep /><span style={{ color: 'var(--brand-ink)', fontWeight: 800 }}>alterações não salvas</span></>}
      </>}>
        <Link to={rotaTenant(entityId, 'cadastros')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar aos Cadastros</Link>
        {podeEditar && <button type="button" className="so-btn so-primary" disabled={!sujo || salvando} onClick={salvar}><Ic n="check" />{salvando ? 'Salvando…' : 'Salvar'}</button>}
      </BarraAcoes>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
