import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { centralApi, type Etapa } from '../../lib/api-client';
import {
  centralSolicitacoesApi, type DadosCentral, type OrigemSolicitacao, type SituacaoSolicitacao,
  type SolicitacaoInterna, type SolicitacaoMunicipe,
} from '../../lib/central-solicitacoes-api';
import { useTenant } from '../TenantContext';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import { Ajuda, Aviso, BarraAcoes, Cabecalho, Carregando, Ic, Janela, Pagina, Placar, Selinho, Sep, msgErro } from '../components/sisobras/so';
import { MapaPonto, PainelQr } from '../components/central/PainelQr';
import { SERVICOS_CONFIG, CENTRO_IDS } from './servico-config';
import { haQuanto, horaDe, nomeCurto, slugDoCentro, useContador, useFotoUrl } from '../components/obras/util';
import { centroDaCategoria, corDaCategoria, iconeDaCategoria } from '../components/obras/categorias';
import '../styles/central-solicitacoes.css';

/* ═══════════════════════ Central de Solicitações ═══════════════════════
   Tudo o que chega — do munícipe (link/QR), do escritório e do campo
   (fiscal ou coordenador pelo celular) — passa pelo crivo do responsável
   aqui antes de ir para a equipe. Abas por origem; dentro, abas por situação. */

type Aba = 'TODAS' | OrigemSolicitacao;
type Filtro = SituacaoSolicitacao | 'TODOS';

interface Item {
  chave: string;
  origem: OrigemSolicitacao;
  situacao: SituacaoSolicitacao;
  codigo: string;
  servico: string;
  cor: string;
  icone: string;
  local: string;
  descricao: string | null;
  autor: string;
  papel: string;
  createdAt: string;
  analisadoEm: string | null;
  analisadoPor: string | null;
  motivoRecusa: string | null;
  fotos: string[];
  fotoOrigem: 'central' | 'registro';
  lat: number | null;
  lng: number | null;
  /** etapa da OS depois que virou OS (para a régua) */
  etapaOS: Etapa | null;
  registroId: string | null;
  centroId: string | null;
  m?: SolicitacaoMunicipe;
  i?: SolicitacaoInterna;
}

const ICONE_OUTRO = 'M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01';
const PRAZO_H = 24;
const MOTIVOS_MUNICIPE = ['Fora da área atendida pela Prefeitura', 'Pedido repetido — já existe uma OS para este local', 'Não é responsabilidade da Secretaria de Obras', 'Foto não mostra o problema'];
const MOTIVOS_INTERNO = ['OS repetida — já existe uma para este local', 'Falta informação — refazer com foto e endereço', 'Não é deste serviço', 'Não é prioridade agora'];

const PAPEL: Record<string, string> = { ADMIN: 'Administrador', COORDENADOR: 'Coordenador', FISCAL: 'Fiscal', ENGINEER: 'Engenheiro', OPERATOR: 'Operador' };

const ORIGEM: Record<OrigemSolicitacao, { rotulo: string; tom: 'cyan' | 'brand' | 'mint'; d: string; dica: string }> = {
  MUNICIPE: { rotulo: 'Munícipe', tom: 'cyan', d: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', dica: 'pelo link ou QR Code' },
  ESCRITORIO: { rotulo: 'Escritório', tom: 'brand', d: 'M2 4h20v12H2zM8 20h8M12 16v4', dica: 'aberta no computador' },
  CAMPO: { rotulo: 'Campo', tom: 'mint', d: 'M5 2h14a1 1 0 011 1v18a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1zM11 18h2', dica: 'fiscal ou coordenador pelo celular' },
};

const SITUACAO: Record<SituacaoSolicitacao, { rotulo: string; tom: 'amber' | 'mint' | 'coral' }> = {
  AGUARDANDO: { rotulo: 'Aguardando análise', tom: 'amber' },
  OS: { rotulo: 'Virou OS', tom: 'mint' },
  RECUSADO: { rotulo: 'Recusado', tom: 'coral' },
};

const FILTROS: { id: Filtro; rotulo: string; cor: string }[] = [
  { id: 'AGUARDANDO', rotulo: 'Aguardando', cor: '#F2B44C' },
  { id: 'OS', rotulo: 'Viraram OS', cor: '#19B88A' },
  { id: 'RECUSADO', rotulo: 'Recusados', cor: '#E5534B' },
  { id: 'TODOS', rotulo: 'Todos', cor: '#635BFF' },
];

/** Passos do pedido (régua): recebido → análise → OS → executada → finalizada */
const PASSOS_PEDIDO = ['Recebido', 'Análise', 'Virou OS', 'Executada', 'Finalizada'] as const;
/** Quantos passos já estão prontos */
function feitosDoItem(it: Item): number {
  if (it.situacao !== 'OS') return 1;
  if (it.etapaOS === 'FINALIZADA') return 5;
  if (it.etapaOS === 'EXECUTADA') return 4;
  return 3;
}
/** Situação de cada passo: ok = pronto · cur = esperando agora · nao = recusado aqui */
function estadoPasso(n: number, feitos: number, situacao: SituacaoSolicitacao): '' | 'ok' | 'cur' | 'nao' {
  if (n <= feitos) return 'ok';
  if (n === 2 && situacao === 'AGUARDANDO') return 'cur';
  if (n === 2 && situacao === 'RECUSADO') return 'nao';
  return '';
}

const foneBonito = (d: string) => d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d;
const cpfMascarado = (c: string) => c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : c;
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const horasDesde = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3600_000;
const iniciais = (n: string) => n.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
function duracao(h: number) {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 24) return `${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return d === 1 ? '1 dia' : `${d} dias`;
}

/* ── montagem da lista única ── */
function doMunicipe(m: SolicitacaoMunicipe): Item {
  return {
    chave: `m-${m.id}`, origem: 'MUNICIPE',
    situacao: m.status === 'NOVA' ? 'AGUARDANDO' : m.status === 'CONVERTIDA' ? 'OS' : 'RECUSADO',
    codigo: m.protocolo, servico: m.categoriaNome, cor: corDaCategoria(m.categoria), icone: iconeDaCategoria(m.categoria),
    local: [m.bairro, m.logradouro].filter(Boolean).join(' · '), descricao: m.descricao,
    autor: m.nome, papel: 'Munícipe', createdAt: m.createdAt,
    analisadoEm: m.analisadoEm, analisadoPor: m.analisadoPor, motivoRecusa: m.motivoRecusa,
    fotos: m.fotos, fotoOrigem: 'central', lat: m.lat, lng: m.lng,
    etapaOS: m.osEtapa, registroId: m.registroDiarioId, centroId: m.centroCustoId, m,
  };
}
function doInterno(i: SolicitacaoInterna): Item {
  const cfg = SERVICOS_CONFIG[slugDoCentro(i.centroCustoId) ?? ''];
  return {
    chave: `i-${i.id}`, origem: i.origem, situacao: i.situacao,
    codigo: i.numeroOS ?? 'OS sem número', servico: i.servicoNome, cor: cfg?.cor ?? '#64748b', icone: cfg?.iconPath ?? ICONE_OUTRO,
    local: [i.bairro, i.logradouro].filter(Boolean).join(' · ') || 'Local não informado', descricao: i.descricao ?? i.tipoServico,
    autor: i.autor, papel: PAPEL[i.autorPapel] ?? i.autorPerfil, createdAt: i.createdAt,
    analisadoEm: i.analisadoEm, analisadoPor: i.analisadoPor, motivoRecusa: i.motivoRecusa,
    fotos: i.fotos, fotoOrigem: 'registro', lat: i.lat, lng: i.lng,
    etapaOS: i.situacao === 'OS' ? i.etapa : null, registroId: i.id, centroId: i.centroCustoId, i,
  };
}

/* ═══════════════════════ peças ═══════════════════════ */

function Tr({ d, className, style }: { d: string; className?: string; style?: CSSProperties }) {
  return <svg className={`i${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" style={style}><path d={d} /></svg>;
}

/** Selo da página com o ícone da central (bandeja de entrada) */
function SeloCentral() {
  return (
    <div className="so-selo" aria-hidden="true">
      <span className="cm tl" /><span className="cm tr" /><span className="cm br" /><span className="cm bl" />
      <span className="so-gsh" />
      <span className="so-sic amber"><Tr d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></span>
    </div>
  );
}

function Numero({ v, decimais = 0 }: { v: number; decimais?: number }) {
  const n = useContador(v);
  return <>{n.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais })}</>;
}

function Kpi({ i, tom, rotulo, valor, decimais, unidade, nota, alerta, children, icone }: {
  i: number; tom: 'amber' | 'mint' | 'coral' | 'cyan' | 'brand'; rotulo: string; valor: number | null; decimais?: number; unidade?: string;
  nota: ReactNode; alerta?: boolean; children?: ReactNode; icone: string;
}) {
  return (
    <article className={`cs-kpi ${tom}${alerta ? ' alerta' : ''}`} style={{ '--i': i } as CSSProperties}>
      <header><span className="cs-kpi-ic"><Tr d={icone} /></span><span>{rotulo}</span>{alerta && <span className="cs-pulso" aria-hidden="true" />}</header>
      <div className="cs-kpi-v">
        <b className="mono">{valor == null ? '—' : <Numero v={valor} decimais={decimais} />}</b>
        {unidade && valor != null && <small>{unidade}</small>}
      </div>
      <p>{nota}</p>
      {children}
    </article>
  );
}

function Miniatura({ entityId, it }: { entityId: string; it: Item }) {
  const url = useFotoUrl(entityId, it.fotos[0], it.fotoOrigem);
  return (
    <span className="cs-thumb" style={{ '--c': it.cor } as CSSProperties}>
      {url ? <img src={url} alt="" /> : it.fotos[0] ? <span className="cs-skel" /> : <span className="cs-thumb-vazio"><Tr d={it.icone} /><small>sem foto</small></span>}
      {url && <span className="cs-thumb-h mono">{horaDe(it.createdAt)}</span>}
      {it.fotos.length > 1 && <span className="cs-thumb-n mono">{it.fotos.length}</span>}
    </span>
  );
}

function FotoGrande({ entityId, id, origem, onAbrir }: { entityId: string; id: string; origem: 'central' | 'registro'; onAbrir: (u: string) => void }) {
  const url = useFotoUrl(entityId, id, origem);
  return url
    ? <button type="button" className="cs-foto" onClick={() => onAbrir(url)} aria-label="Ver foto inteira"><img src={url} alt="Foto do pedido" /></button>
    : <span className="cs-foto"><span className="cs-skel" /></span>;
}

/** Mini régua do pedido: os passos formam a barra */
function ReguaMini({ it }: { it: Item }) {
  const feitos = feitosDoItem(it);
  const rotulo = it.situacao === 'RECUSADO' ? 'recusado na análise' : it.situacao === 'AGUARDANDO' ? 'esperando análise' : PASSOS_PEDIDO[feitos - 1];
  return (
    <ol className={`cs-mini${it.situacao === 'RECUSADO' ? ' recusado' : ''}`} aria-label={`Andamento: ${rotulo}`} title={rotulo}>
      {PASSOS_PEDIDO.map((nome, k) => <li key={nome} className={estadoPasso(k + 1, feitos, it.situacao)} />)}
    </ol>
  );
}

/* ═══════════════════════ janela "Analisar" ═══════════════════════ */

function JanelaAnalise({ entityId, it, poderes, onFechar, onFeito }: {
  entityId: string; it: Item; poderes: DadosCentral['poderes']; onFechar: () => void; onFeito: (msg: string, situacao: SituacaoSolicitacao) => void;
}) {
  const municipe = it.origem === 'MUNICIPE';
  const pode = municipe ? poderes.podeTriar : poderes.podeAprovar;
  const [centroId, setCentroId] = useState(municipe && it.m ? centroDaCategoria(it.m.categoria) ?? '' : '');
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [criada, setCriada] = useState<{ registroId: string; centroId: string } | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const aguardando = it.situacao === 'AGUARDANDO' && !criada;
  const feitos = criada ? 3 : feitosDoItem(it);
  const situacaoAgora: SituacaoSolicitacao = criada ? 'OS' : it.situacao;

  const linkOS = (registroId: string, centro: string) => {
    const slug = slugDoCentro(centro);
    return slug ? `/t/${entityId}/servicos/${slug}?os=${registroId}` : `/t/${entityId}/servicos`;
  };

  async function aprovar() {
    setOcupado(true); setErro('');
    try {
      if (municipe) {
        if (!centroId) { setErro('Escolha o serviço que vai atender'); return; }
        const r = await centralApi.converter(entityId, it.m!.id, centroId);
        setCriada({ registroId: r.registroId, centroId });
        onFeito('', 'OS');
      } else {
        await centralSolicitacoesApi.aprovar(entityId, it.registroId!);
        onFeito(`${it.codigo} aprovada e liberada para a equipe`, 'OS');
        onFechar();
      }
    } catch (e) { setErro(msgErro(e, 'Não foi possível concluir')); }
    finally { setOcupado(false); }
  }
  async function recusar() {
    if (motivo.trim().length < 5) { setErro(municipe ? 'Explique o motivo para o munícipe' : 'Explique o motivo para quem abriu'); return; }
    setOcupado(true); setErro('');
    try {
      if (municipe) await centralApi.recusar(entityId, it.m!.id, motivo.trim());
      else await centralSolicitacoesApi.recusar(entityId, it.registroId!, motivo.trim());
      onFeito(`${it.codigo} recusado — o motivo ficou registrado`, 'RECUSADO');
      onFechar();
    } catch (e) { setErro(msgErro(e, 'Não foi possível recusar')); }
    finally { setOcupado(false); }
  }

  const rodape = aguardando && pode ? (
    !recusando ? (
      <>
        {erro && <span className="so-help esq cs-erro">{erro}</span>}
        <button type="button" className="so-btn so-ghost cs-btn-recusar" disabled={ocupado} onClick={() => { setRecusando(true); setErro(''); }}><Ic n="x" />Recusar</button>
        <button type="button" className="so-btn so-mintbtn" disabled={ocupado} onClick={aprovar}>
          <Ic n="check" />{ocupado ? 'Salvando…' : municipe ? 'Gerar ordem de serviço' : 'Aprovar e liberar para a equipe'}
        </button>
      </>
    ) : (
      <>
        {erro && <span className="so-help esq cs-erro">{erro}</span>}
        <button type="button" className="so-btn so-ghost" disabled={ocupado} onClick={() => { setRecusando(false); setErro(''); }}><Ic n="voltar" className="back" />Voltar</button>
        <button type="button" className="so-btn so-excluir" disabled={ocupado} onClick={recusar}><Ic n="x" />{ocupado ? 'Salvando…' : 'Confirmar recusa'}</button>
      </>
    )
  ) : (
    <button type="button" className="so-btn so-ghost" onClick={onFechar}>Fechar</button>
  );

  return (
    <>
      <Janela icone="clipboard" tom={aguardando ? 'amber' : it.situacao === 'RECUSADO' ? 'coral' : 'mint'} largura={760} onFechar={onFechar}
        eyebrow={<>Central de Solicitações · {ORIGEM[it.origem].rotulo}{it.origem === 'CAMPO' ? ` · ${it.papel}` : ''} · <span className="mono">{it.codigo}</span></>}
        titulo={it.servico}
        sub={<>{it.local} · {municipe ? 'enviado' : 'aberta'} {haQuanto(it.createdAt)}</>}
        ajuda={municipe ? 'Gerar OS manda o pedido para a equipe do serviço escolhido. Recusar avisa o munícipe com o motivo.' : 'Aprovar libera a OS para a equipe. Recusar cancela a OS com o motivo registrado.'}
        rotulo={`Analisar ${it.codigo}`} rodape={rodape}>

        <div className="so-trail cs-trail" aria-label="Andamento do pedido">
          {PASSOS_PEDIDO.map((nome, k) => {
            const e = estadoPasso(k + 1, feitos, situacaoAgora);
            const cls = { ok: ' feito', cur: ' agora', nao: ' nao', '': '' }[e];
            return <span key={nome} className={`st${cls}`}><i>{e === 'nao' ? '✕' : e === 'ok' ? '✓' : String(k + 1).padStart(2, '0')}</i><span>{e === 'nao' ? 'Recusado' : nome}</span></span>;
          })}
        </div>

        {it.fotos.length > 0 && (
          <div className={`cs-fotos q${Math.min(it.fotos.length, 3)}`}>
            {it.fotos.slice(0, 6).map(f => <FotoGrande key={f} entityId={entityId} id={f} origem={it.fotoOrigem} onAbrir={setZoom} />)}
          </div>
        )}

        <div className="cs-dlg-grid">
          <section className="cs-bloco">
            <h3><Ic n="doc" />{municipe ? 'O que o munícipe disse' : 'O que foi pedido'}</h3>
            {it.descricao ? <p className="cs-citacao">“{it.descricao}”</p> : <p className="so-help">Sem descrição.</p>}
            {it.i?.tipoServico && <p className="so-help">Tipo: <b>{it.i.tipoServico}</b></p>}
            <span className="so-help">{municipe ? 'Enviado' : 'Aberta'} em {dataHora(it.createdAt)}</span>
          </section>

          <section className="cs-bloco">
            <h3><Ic n="user" />Quem pediu</h3>
            <div className="cs-pessoa">
              <span className="av" style={{ background: `linear-gradient(135deg, ${it.cor}, color-mix(in srgb, ${it.cor} 55%, #17213C))` }}>{iniciais(it.autor)}</span>
              <div>
                <b>{it.autor}</b>
                <span>
                  {municipe && it.m
                    ? <>{foneBonito(it.m.telefone)}{it.m.cpf ? ` · CPF ${cpfMascarado(it.m.cpf)}` : ''}{it.m.email ? ` · ${it.m.email}` : ''}</>
                    : <>{it.papel} · {ORIGEM[it.origem].rotulo.toLowerCase()} ({ORIGEM[it.origem].dica})</>}
                </span>
              </div>
            </div>
            {municipe && it.m && (
              <div className="cs-contato">
                <a className="so-btn so-ghost sm" href={`https://wa.me/55${it.m.telefone}`} target="_blank" rel="noreferrer"><Ic n="chat" />WhatsApp</a>
                <a className="so-btn so-ghost sm" href={`tel:+55${it.m.telefone}`}>Ligar</a>
              </div>
            )}
          </section>
        </div>

        <section className="cs-bloco">
          <h3><Ic n="pin" />Onde</h3>
          <b className="cs-endereco">{it.local}</b>
          {it.m?.referencia && <span className="so-help">Referência: {it.m.referencia}</span>}
          {it.lat != null && it.lng != null ? (
            <>
              <MapaPonto lat={it.lat} lng={it.lng} cor={it.cor} className="so-mapa" />
              <span className="so-help">
                GPS {municipe ? 'da foto' : 'do celular'}{it.m?.precisaoM != null ? ` · precisão de ${Math.round(it.m.precisaoM)} m` : ''} ·{' '}
                <a href={`https://www.google.com/maps?q=${it.lat},${it.lng}`} target="_blank" rel="noreferrer">abrir no Google Maps</a>
              </span>
            </>
          ) : <span className="so-help">Sem GPS — confira o endereço.</span>}
        </section>

        {criada && (
          <div className="cs-resultado ok cs-sucesso">
            <span className="cs-check"><Ic n="check" /></span>
            <b>Ordem de serviço criada e já aprovada</b>
            <span>Foi com as fotos, o GPS e os dados do pedido. O munícipe já vê "Encaminhado para a equipe" no acompanhamento.</span>
            <Link to={linkOS(criada.registroId, criada.centroId)} className="so-btn so-primary sm">Abrir a ordem de serviço<Ic n="seta" className="arrow" /></Link>
          </div>
        )}

        {!aguardando && !criada && (
          <div className={`cs-resultado ${it.situacao === 'OS' ? 'ok' : 'nao'}`}>
            <b>{it.situacao === 'OS' ? (municipe ? 'Virou ordem de serviço' : 'Aprovada e liberada para a equipe') : 'Recusado na análise'}</b>
            <span>{it.analisadoPor ? `por ${it.analisadoPor}` : ''}{it.analisadoEm ? ` em ${dataHora(it.analisadoEm)}` : ''}</span>
            {it.motivoRecusa && <span>Motivo: {it.motivoRecusa}</span>}
            {it.situacao === 'OS' && it.registroId && it.centroId && <Link to={linkOS(it.registroId, it.centroId)} className="so-btn so-ghost sm">Abrir a ordem de serviço<Ic n="seta" className="arrow" /></Link>}
          </div>
        )}

        {aguardando && !pode && (
          <Aviso tom="amber">Quem decide aqui é quem tem o passo <b>{municipe ? 'Triar pedido do munícipe' : 'Aprovar abertura de OS'}</b> em Fluxo e aprovações. Você pode ver, mas não aprovar nem recusar.</Aviso>
        )}

        {aguardando && pode && !recusando && municipe && (
          <label className="so-field cs-encaminhar">
            <span className="so-lbl">Encaminhar para o serviço <span className="req">*</span></span>
            <span className="so-ctrl">
              <select value={centroId} onChange={e => setCentroId(e.target.value)}>
                <option value="">Escolha o serviço…</option>
                {Object.values(SERVICOS_CONFIG).map(s => <option key={s.slug} value={CENTRO_IDS[s.slug]}>{s.nome}</option>)}
              </select>
            </span>
          </label>
        )}

        {aguardando && pode && recusando && (
          <div className="cs-recusa">
            <span className="so-lbl">Por que não será atendido? {municipe ? 'O munícipe vai ver esta resposta.' : 'Fica registrado na OS para quem abriu.'}</span>
            <div className="so-chips">
              {(municipe ? MOTIVOS_MUNICIPE : MOTIVOS_INTERNO).map(m => (
                <button key={m} type="button" className={`so-chip${motivo === m ? ' on' : ''}`} onClick={() => setMotivo(m)}>{m}</button>
              ))}
            </div>
            <span className="so-ctrl cs-textarea"><textarea rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Escreva o motivo…" maxLength={1000} aria-label="Motivo da recusa" /></span>
          </div>
        )}
      </Janela>
      {zoom && createPortal(
        <div className="so cs-zoom" onClick={() => setZoom(null)} role="presentation"><img src={zoom} alt="Foto do pedido" /></div>,
        document.body,
      )}
    </>
  );
}

/* ═══════════════════════ página ═══════════════════════ */

export function CentralSolicitacoesPage() {
  const { entityId, session } = useTenant();
  const { toasts, showToast, closeToast } = useToast();
  const [dados, setDados] = useState<DadosCentral | null>(null);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('TODAS');
  const [filtro, setFiltro] = useState<Filtro>('AGUARDANDO');
  const [servico, setServico] = useState('');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const [qrAberto, setQrAberto] = useState(false);
  const [brasao, setBrasao] = useState<string | null>(null);

  const carregar = useCallback(() => centralSolicitacoesApi.listar(entityId)
    .then(d => { setDados(d); setErro(''); })
    .catch(e => setErro(msgErro(e, 'Não foi possível carregar a central'))), [entityId]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const t = setInterval(() => { if (navigator.onLine) void carregar(); }, 60000);
    return () => clearInterval(t);
  }, [carregar]);
  useEffect(() => { fetch(`/api/public/v1/tenants/${entityId}`).then(r => r.json()).then(t => setBrasao(t.coatOfArmsUrl ?? null)).catch(() => {}); }, [entityId]);

  const link = `${window.location.origin}/s/${entityId}`;
  const municipio = session.entity.municipalityName ? `Prefeitura de ${session.entity.municipalityName}` : session.entity.name;

  const todos = useMemo<Item[]>(() => dados
    ? [...dados.municipe.map(doMunicipe), ...dados.internas.map(doInterno)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [], [dados]);

  const daAba = useMemo(() => aba === 'TODAS' ? todos : todos.filter(t => t.origem === aba), [todos, aba]);
  const conta = (lista: Item[], s: SituacaoSolicitacao) => lista.filter(t => t.situacao === s).length;
  const pendTotal = conta(todos, 'AGUARDANDO');
  const pendOrigem = (o: OrigemSolicitacao) => todos.filter(t => t.origem === o && t.situacao === 'AGUARDANDO').length;

  /* números da aba atual */
  const aguardando = daAba.filter(t => t.situacao === 'AGUARDANDO');
  const nOS = conta(daAba, 'OS');
  const nRec = conta(daAba, 'RECUSADO');
  const atrasados = aguardando.filter(t => horasDesde(t.createdAt) > PRAZO_H).length;
  const maisAntigo = aguardando.reduce<Item | null>((a, t) => !a || t.createdAt < a.createdAt ? t : a, null);
  const analisados = daAba.filter(t => t.analisadoEm);
  const tempoMedioH = analisados.length
    ? analisados.reduce((s, t) => s + (new Date(t.analisadoEm!).getTime() - new Date(t.createdAt).getTime()), 0) / analisados.length / 3600_000
    : null;
  const taxa = nOS + nRec ? Math.round(nOS / (nOS + nRec) * 100) : null;
  const executadas = daAba.filter(t => t.etapaOS === 'EXECUTADA' || t.etapaOS === 'FINALIZADA').length;
  const finalizadas = daAba.filter(t => t.etapaOS === 'FINALIZADA').length;

  const servicos = useMemo(() => [...new Set(daAba.map(t => t.servico))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [daAba]);
  const termo = busca.trim().toLowerCase();
  const visiveis = daAba
    .filter(t => (filtro === 'TODOS' || t.situacao === filtro) && (!servico || t.servico === servico))
    .filter(t => !termo || [t.codigo, t.autor, t.local, t.servico, t.descricao ?? '', t.m?.telefone ?? ''].some(x => x.toLowerCase().includes(termo)));
  /* aguardando: o mais antigo primeiro (fila); o resto, o mais novo primeiro */
  if (filtro === 'AGUARDANDO') visiveis.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const itemAberto = aberto ? todos.find(t => t.chave === aberto) ?? null : null;

  /* resposta na hora: o pedido muda de aba já no clique; a lista do servidor confirma em seguida */
  const marcar = (chave: string, situacao: SituacaoSolicitacao) => setDados(d => d && {
    ...d,
    internas: d.internas.map(i => `i-${i.id}` === chave ? { ...i, situacao, etapa: situacao === 'OS' ? 'REGISTRADA' : 'CANCELADA', analisadoEm: new Date().toISOString() } : i),
    municipe: d.municipe.map(m => `m-${m.id}` === chave ? { ...m, status: situacao === 'OS' ? 'CONVERTIDA' : 'RECUSADA', analisadoEm: new Date().toISOString() } : m),
  });

  const ABAS: { id: Aba; rotulo: string; d: string; total: number; pend: number }[] = [
    { id: 'TODAS', rotulo: 'Todas', d: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', total: todos.length, pend: pendTotal },
    ...(['MUNICIPE', 'ESCRITORIO', 'CAMPO'] as OrigemSolicitacao[]).map(o => ({
      id: o as Aba, rotulo: ORIGEM[o].rotulo, d: ORIGEM[o].d, total: todos.filter(t => t.origem === o).length, pend: pendOrigem(o),
    })),
  ];

  /* régua do atendimento no cabeçalho: os passos formam a barra */
  const regua: { nome: string; n: number; txt: string; cls: string; ic: string; alvo: Filtro }[] = [
    { nome: 'Recebidos', n: daAba.length, txt: 'pedidos', cls: 'ok', ic: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z', alvo: 'TODOS' },
    { nome: 'Análise', n: aguardando.length, txt: aguardando.length ? 'esperando' : 'nada parado', cls: `cur ${aguardando.length ? 'warn' : 'ok'}`, ic: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', alvo: 'AGUARDANDO' },
    { nome: 'Viraram OS', n: nOS, txt: 'com a equipe', cls: nOS ? 'ok' : 'opt', ic: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z', alvo: 'OS' },
    { nome: 'Executadas', n: executadas, txt: 'baixa com foto', cls: executadas ? 'ok' : 'opt', ic: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z', alvo: 'OS' },
    { nome: 'Finalizadas', n: finalizadas, txt: 'conferidas', cls: finalizadas ? 'ok' : 'opt', ic: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4', alvo: 'OS' },
  ];

  if (!dados && !erro) return <Pagina><Carregando texto="Abrindo a Central de Solicitações…" /></Pagina>;

  return (
    <Pagina>
      <Cabecalho
        rotulo="Central de Solicitações"
        selo={<SeloCentral />}
        eyebrow={<>Gestão de Obras · Atendimento</>}
        titulo="Central de Solicitações"
        sub={<>Tudo o que chega — do <b>munícipe</b>, do <b>escritório</b> e do <b>campo</b> — passa por aqui. Nada vai para a equipe sem o crivo do responsável.</>}
        direita={
          <div className="so-head-r">
            <a href={link} target="_blank" rel="noreferrer" className="so-btn so-ghost"><Ic n="link" />Página do cidadão</a>
            <button type="button" className="so-btn so-primary" onClick={() => setQrAberto(true)}>
              <Tr d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4" />QR Code e cartaz
            </button>
            <Placar n={<Numero v={pendTotal} />} de={pendTotal === 1 ? 'pedido' : 'pedidos'} rotulo="esperando análise" />
          </div>
        }
      >
        <ol className="so-regua c5 cs-regua" aria-label="Como o pedido anda">
          {regua.map((r, k) => (
            <li key={r.nome} className={`so-sg ${r.cls}`}>
              <a href="#cs-lista" onClick={e => { e.preventDefault(); setFiltro(r.alvo); document.getElementById('cs-lista')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                <span className="sg-ic"><Tr d={r.ic} /></span>
                <span className="sg-tx"><b>{r.nome}</b><small><span>{String(k + 1).padStart(2, '0')}</span><span className="mono cs-rn">{r.n}</span> {r.txt}</small></span>
              </a>
            </li>
          ))}
        </ol>
      </Cabecalho>

      {erro && <Aviso tom="amber">{erro}</Aviso>}

      <nav className="so-tabs cs-tabs so-rise" aria-label="De onde veio">
        {ABAS.map(a => (
          <button key={a.id} type="button" className={`so-tab${aba === a.id ? ' on' : ''}`} aria-pressed={aba === a.id}
            title={a.id === 'TODAS' ? 'Tudo o que chegou' : `${a.rotulo}: ${ORIGEM[a.id as OrigemSolicitacao].dica}`}
            onClick={() => { setAba(a.id); setServico(''); }}>
            <Tr d={a.d} />{a.rotulo}
            <span className={`n${a.pend ? ' pend' : ''}`} aria-label={a.pend ? `${a.pend} aguardando` : `${a.total} no total`}>{a.pend || a.total}</span>
          </button>
        ))}
      </nav>

      <section className="cs-kpis" aria-label="Resumo">
        <Kpi i={0} tom="amber" rotulo="Aguardando análise" valor={aguardando.length} alerta={aguardando.length > 0}
          icone="M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2"
          nota={maisAntigo ? <>o mais antigo espera há <b>{duracao(horasDesde(maisAntigo.createdAt))}</b></> : 'nada parado — tudo respondido'}>
          {aba === 'TODAS' && aguardando.length > 0 && (
            <div className="cs-pilha" aria-label="Aguardando por origem">
              {(['MUNICIPE', 'ESCRITORIO', 'CAMPO'] as OrigemSolicitacao[]).map(o => {
                const n = pendOrigem(o);
                return n ? <span key={o} className={`cs-pilha-${o.toLowerCase()}`} style={{ flexGrow: n }} title={`${ORIGEM[o].rotulo}: ${n}`}><i>{ORIGEM[o].rotulo} {n}</i></span> : null;
              })}
            </div>
          )}
        </Kpi>
        <Kpi i={1} tom="mint" rotulo="Viraram OS" valor={nOS} icone="M20 6 9 17l-5-5"
          nota={taxa == null ? 'nenhum analisado ainda' : <><b>{taxa}%</b> dos analisados foram aprovados</>}>
          {taxa != null && <div className="cs-barra"><i style={{ width: `${taxa}%` }} /></div>}
        </Kpi>
        <Kpi i={2} tom="coral" rotulo="Recusados" valor={nRec} icone="M18 6 6 18M6 6l12 12" nota="sempre com motivo registrado" />
        <Kpi i={3} tom="cyan" rotulo="Tempo até responder" icone="M13 2 3 14h9l-1 8 10-12h-9l1-8z"
          valor={tempoMedioH == null ? null : tempoMedioH < 24 ? Math.round(tempoMedioH * 10) / 10 : Math.round(tempoMedioH / 24 * 10) / 10}
          decimais={1} unidade={tempoMedioH != null && tempoMedioH < 24 ? 'horas' : 'dias'}
          nota={tempoMedioH == null ? 'aparece depois da 1ª análise' : 'média entre chegar e ser analisado'} />
        <Kpi i={4} tom={atrasados ? 'coral' : 'brand'} rotulo={`Parados há +${PRAZO_H} h`} valor={atrasados} alerta={atrasados > 0}
          icone="M10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"
          nota={atrasados ? 'responda estes primeiro' : 'dentro do prazo'} />
      </section>

      <section id="cs-lista" className="so-card cs-lista-card so-rise d2" aria-label="Pedidos">
        <header className="so-chead">
          <span className="so-cic amber"><Ic n="list" /></span>
          <h2>{aba === 'TODAS' ? 'Todos os pedidos' : `Pedidos · ${ORIGEM[aba].rotulo}`}</h2>
          <span className="meta">{aba === 'TODAS' ? 'munícipe, escritório e campo' : ORIGEM[aba].dica}</span>
          <div className="right"><Ajuda texto="Aguardando = esperando o crivo do responsável. Abra o pedido em Analisar para aprovar (vira OS da equipe) ou recusar com motivo." /></div>
        </header>
        <div className="so-cbody">
          <div className="cs-filtros">
            <div className="so-chips" role="group" aria-label="Situação">
              {FILTROS.map(f => {
                const n = f.id === 'TODOS' ? daAba.length : conta(daAba, f.id);
                return (
                  <button key={f.id} type="button" className={`so-chip cs-chip${filtro === f.id ? ' on' : ''}${f.id === 'AGUARDANDO' && n > 0 && filtro !== f.id ? ' alert' : ''}`}
                    aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
                    <i className="cs-dot" style={{ background: f.cor }} />{f.rotulo}<span className="n">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="cs-busca">
              {servicos.length > 1 && (
                <span className="so-ctrl cs-sel">
                  <select value={servico} onChange={e => setServico(e.target.value)} aria-label="Serviço">
                    <option value="">Todos os serviços</option>
                    {servicos.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </span>
              )}
              <label className="so-ctrl cs-q">
                <Ic n="search" />
                <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Protocolo, nº da OS, nome, bairro, rua…" aria-label="Buscar" />
              </label>
            </div>
          </div>

          {todos.length === 0 && dados ? (
            <div className="cs-vazio">
              <SeloCentral />
              <b>Nenhum pedido ainda</b>
              <span>Os pedidos do munícipe (link e QR Code) e as OS abertas no escritório e em campo aparecem aqui, esperando a sua análise.</span>
              <button type="button" className="so-btn so-primary" onClick={() => setQrAberto(true)}>Gerar QR Code</button>
            </div>
          ) : visiveis.length === 0 ? (
            <div className="cs-vazio pequeno">
              <span className="cs-vazio-ic"><Ic n={filtro === 'AGUARDANDO' && !termo && !servico ? 'check' : 'search'} /></span>
              <b>{filtro === 'AGUARDANDO' && !termo && !servico ? 'Nada esperando análise. Tudo respondido!' : 'Nenhum pedido com esse filtro.'}</b>
            </div>
          ) : (
            <div className="cs-itens">
              {visiveis.map((t, idx) => {
                const st = SITUACAO[t.situacao];
                const late = t.situacao === 'AGUARDANDO' && horasDesde(t.createdAt) > PRAZO_H;
                const og = ORIGEM[t.origem];
                return (
                  <article key={t.chave} className={`cs-item ${t.situacao.toLowerCase()}${late ? ' atrasado' : ''}`} style={{ '--i': Math.min(idx, 14), '--c': t.cor } as CSSProperties}>
                    <button type="button" className="cs-item-abrir" onClick={() => setAberto(t.chave)} aria-label={`Abrir ${t.codigo}`}>
                      <Miniatura entityId={entityId} it={t} />
                      <span className="cs-item-info">
                        <span className="cs-item-topo">
                          <span className="mono cs-cod">{t.codigo}</span>
                          <span className="cs-serv"><Tr d={t.icone} />{t.servico}</span>
                          <span className={`so-badge ${og.tom} cs-og`}><Tr d={og.d} />{og.rotulo}{t.origem === 'CAMPO' ? ` · ${t.papel}` : ''}</span>
                          <Selinho tom={st.tom} ponto vivo={t.situacao === 'AGUARDANDO'}>{st.rotulo}</Selinho>
                          {late && <Selinho tom="coral"><Ic n="alerta" />parado há {duracao(horasDesde(t.createdAt))}</Selinho>}
                        </span>
                        <b className="cs-local">{t.local}</b>
                        {t.descricao && <span className="cs-desc">“{t.descricao}”</span>}
                        <span className="cs-meta">
                          <span className="cs-av" aria-hidden="true">{iniciais(t.autor)}</span>
                          {nomeCurto(t.autor)}{t.origem !== 'MUNICIPE' ? ` · ${t.papel}` : ''} · {haQuanto(t.createdAt)}
                          {t.lat != null && <span className="cs-tag ok">GPS</span>}
                          {t.fotos.length > 0 && <span className="cs-tag">{t.fotos.length} {t.fotos.length === 1 ? 'foto' : 'fotos'}</span>}
                          {t.situacao !== 'AGUARDANDO' && t.analisadoPor && <span className="cs-quem">· {t.situacao === 'OS' ? 'aprovado' : 'recusado'} por {nomeCurto(t.analisadoPor)}</span>}
                        </span>
                      </span>
                    </button>
                    <div className="cs-item-dir">
                      <ReguaMini it={t} />
                      <button type="button" className={`so-btn ${t.situacao === 'AGUARDANDO' ? 'so-primary cs-analisar' : 'so-ghost'} sm`} onClick={() => setAberto(t.chave)}>
                        {t.situacao === 'AGUARDANDO' ? 'Analisar' : 'Ver'}<Ic n="seta" className="arrow" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <BarraAcoes esquerda={<>
        <b>{pendTotal}</b> aguardando análise
        {maisAntigo && aba === 'TODAS' && <><Sep />mais antigo há {duracao(horasDesde(maisAntigo.createdAt))}</>}
        <span className="cs-so-desk"><Sep />atualiza sozinho a cada minuto</span>
      </>}>
        <button type="button" className="so-btn so-ghost" onClick={() => void carregar()}><Tr d="M21 12a9 9 0 11-3-6.7L21 8M21 3v5h-5" />Atualizar</button>
        {pendTotal > 0 && filtro !== 'AGUARDANDO' && <button type="button" className="so-btn so-primary" onClick={() => { setAba('TODAS'); setFiltro('AGUARDANDO'); }}>Ver o que falta analisar<Ic n="seta" className="arrow" /></button>}
      </BarraAcoes>

      {itemAberto && dados && (
        <JanelaAnalise key={itemAberto.chave} entityId={entityId} it={itemAberto} poderes={dados.poderes}
          onFechar={() => setAberto(null)}
          onFeito={(msg, situacao) => { marcar(itemAberto.chave, situacao); if (msg) showToast(msg); void carregar(); }} />
      )}
      {qrAberto && <PainelQr link={link} municipio={municipio} brasao={brasao} onFechar={() => setQrAberto(false)} />}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
