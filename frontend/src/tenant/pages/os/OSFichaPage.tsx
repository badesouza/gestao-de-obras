import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ordensApi, osApi, type AcaoOS, type DetalheOS } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { Aviso, BarraAcoes, Cabecalho, Cartao, Carregando, Ic, Janela, Pagina, Placar, Selo, Sep, msgErro, rotaTenant } from '../../components/sisobras/so';
import { useFotoUrl } from '../../components/obras/util';
import { Avatares, BarraPrazo, EtapaPill, IconeServico, corAvatar, corServico, siglaDe, textoResposta } from './os-ui';

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const dia = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
const COR_HIST: Record<string, string> = {
  OS_ABERTA: '#E8962A', REGISTRO_DIARIO_CREATED: '#E8962A', OS_APROVAR: '#635BFF', OS_RECUSAR: '#E5534B', OS_EXECUTAR: '#10C6D4',
  OS_FINALIZAR: '#19B88A', OS_REABRIR: '#E5534B', OS_CANCELAR: '#68728A',
};

type Pedido = { acao: AcaoOS; titulo: string; botao: string; tom: 'amber' | 'coral'; texto: string };

function FotoGrande({ entityId, fotoId }: { entityId: string; fotoId: string | null }) {
  const url = useFotoUrl(entityId, fotoId);
  if (!fotoId) return <div className="vazio">sem foto</div>;
  return url ? <img src={url} alt="" /> : <div className="vazio">carregando…</div>;
}
function Miniatura({ entityId, fotoId, on, onClick, rotulo }: { entityId: string; fotoId: string; on: boolean; onClick: () => void; rotulo: string }) {
  const url = useFotoUrl(entityId, fotoId);
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={rotulo} title={rotulo}
      style={{ width: 64, height: 48, borderRadius: 9, overflow: 'hidden', padding: 0, cursor: 'pointer', border: on ? '2px solid var(--brand)' : '1px solid var(--line)', background: 'var(--surface-3)', boxShadow: on ? 'var(--ring)' : undefined }}>
      {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
    </button>
  );
}

/** Tela 12 · Ficha da OS — antes e depois, pedido × feito, linha do tempo e as ações de quem pode */
export function OSFichaPage() {
  const { entityId } = useTenant();
  const { osId = '' } = useParams<{ osId: string }>();
  const nav = useNavigate();
  const { toasts, showToast, closeToast } = useToast();
  const [d, setD] = useState<DetalheOS | null>(null);
  const [erro, setErro] = useState('');
  const [pos, setPos] = useState(50);
  const [antesId, setAntesId] = useState<string | null>(null);
  const [depoisId, setDepoisId] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [festa, setFesta] = useState(false);

  const carregar = useCallback(() => {
    osApi.detalhe(entityId, osId).then(x => {
      setD(x); setErro('');
      setAntesId(x.fotos.find(f => f.momento === 'ABERTURA')?.id ?? null);
      setDepoisId([...x.fotos].reverse().find(f => f.momento === 'BAIXA')?.id ?? null);
    }).catch(e => setErro(msgErro(e, 'Não foi possível abrir a OS')));
  }, [entityId, osId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function executar(acao: AcaoOS, observacao?: string) {
    setOcupado(true);
    try {
      const r = await ordensApi.acao(entityId, osId, acao, observacao);
      setPedido(null); setMotivo('');
      if (r.etapa === 'FINALIZADA' && acao === 'finalizar') setFesta(true);
      showToast(acao === 'aprovar' ? 'OS aprovada · foi para a equipe' : acao === 'finalizar' ? 'OS conferida e finalizada' : acao === 'reabrir' ? 'Devolvida para a equipe' : acao === 'recusar' ? 'Abertura recusada' : 'OS cancelada');
      carregar();
    } catch (e) { showToast(msgErro(e, 'Não foi possível fazer isso agora'), 'error'); }
    finally { setOcupado(false); }
  }

  if (!d) return <Pagina>{erro ? <Aviso tom="amber">{erro}</Aviso> : <Carregando />}</Pagina>;
  const antes = d.fotos.filter(f => f.momento === 'ABERTURA');
  const depois = d.fotos.filter(f => f.momento === 'BAIXA');
  const p = d.poderes;
  const medicao = d.baixa.find(b => typeof b.valor === 'number');
  const devolvida = !!d.devolvidoEm && d.etapa === 'REGISTRADA';
  const sg = (ok: boolean, cur: boolean, warn = false) => `so-sg ${ok ? 'ok' : warn ? 'warn' : cur ? 'ok' : 'opt'}${cur ? ' cur' : ''}`;
  const etapa = d.etapa;
  const placar = d.prazo.diasUsados;

  return (
    <Pagina>
      {festa && etapa === 'FINALIZADA' && (
        <div className="os-win" role="status">
          <span className="bdg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b>{d.numeroOS} finalizada{d.prazo.noPrazo ? ` · ${Math.max(0, Math.round((d.prazo.prazoDias - d.prazo.diasUsados) * 10) / 10).toLocaleString('pt-BR')} dias antes do prazo` : ''}</b>
            <p>Entrou no painel e nos relatórios.</p>
          </div>
          {d.prazo.noPrazo && <span className="os-pill glass"><i />+1 no prazo</span>}
        </div>
      )}

      <Cabecalho rotulo={d.numeroOS ?? 'OS'} selo={<Selo icone="osCheck" />}
        eyebrow={<>Gestão de Obras · <Link to={rotaTenant(entityId, 'os')}>Ordens de Serviço</Link></>}
        titulo={<><span className="mono">{d.numeroOS ?? 'OS'}</span>{d.tipo ? ` · ${d.tipo}` : ''}</>}
        extras={<EtapaPill etapa={etapa} devolvida={devolvida} />}
        sub={<span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span className="os-svc"><span className="m" style={{ '--c': corServico(d.servico.cor), width: 24, height: 24, borderRadius: 7 } as React.CSSProperties}><IconeServico nome={d.servico.nome} /></span><b>{d.servico.nome}</b></span>
          · {[d.local.logradouro, d.local.bairro].filter(Boolean).join(' · ')}
          {d.equipe && <> · <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{d.equipe.pessoas.length > 0 && <Avatares pessoas={d.equipe.pessoas} />}<b style={{ color: 'var(--ink)' }}>{d.equipe.nome}</b></span></>}
        </span>}
        direita={<Placar n={placar.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} de={placar === 1 ? 'dia' : 'dias'} rotulo={d.executadoEm ? 'da abertura à baixa' : 'desde a abertura'} />}>
        {etapa === 'CANCELADA' ? (
          <div style={{ marginTop: 12 }}><Aviso tom="amber">{d.recusadoEm ? <>Abertura recusada por <b>{d.recusadoPor}</b>: {d.motivoRecusa}</> : 'OS cancelada. O motivo está na linha do tempo.'}</Aviso></div>
        ) : (
          <ol className="so-regua c4" aria-label="Etapas da OS">
            <li className={sg(true, false)}><a><span className="sg-ic"><Ic n="plus" /></span><span className="sg-tx"><b>Aberta</b><small><span>{dia(d.criadoEm)}</span>{d.abertoPor.split(' ')[0]} · {d.origem === 'CAMPO' ? 'em campo' : d.origem === 'MUNICIPE' ? 'munícipe' : 'escritório'}</small></span></a></li>
            <li className={sg(!!d.aprovadoEm, etapa === 'AGUARDANDO_APROVACAO', etapa === 'AGUARDANDO_APROVACAO')}><a><span className="sg-ic"><Ic n="shieldCheck" /></span><span className="sg-tx"><b>Aprovada</b><small><span>{dia(d.aprovadoEm) || '02'}</span>{d.aprovadoEm ? (d.aprovadoPor ?? '').split(' ')[0] : 'falta aprovar'}</small></span></a></li>
            <li className={sg(!!d.executadoEm, etapa === 'REGISTRADA', devolvida)}><a><span className="sg-ic"><Ic n="image" /></span><span className="sg-tx"><b>Executada</b><small><span>{dia(d.executadoEm) || '03'}</span>{d.executadoEm ? `baixa de ${(d.executadoPor ?? '').split(' ')[0]}` : devolvida ? 'devolvida para refazer' : 'falta a baixa'}</small></span></a></li>
            <li className={sg(!!d.finalizadoEm, etapa === 'EXECUTADA')}><a><span className="sg-ic"><Ic n="check" /></span><span className="sg-tx"><b>Finalizada</b><small><span>{dia(d.finalizadoEm) || '04'}</span>{d.finalizadoEm ? `conferida por ${(d.finalizadoPor ?? '').split(' ')[0]}` : 'falta conferir'}</small></span></a></li>
          </ol>
        )}
      </Cabecalho>

      {devolvida && <Aviso tom="amber" icone="voltar"><b>Devolvida para refazer:</b> {d.motivoDevolucao}</Aviso>}

      <section className="os-kpis" aria-label="Números da OS">
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#635BFF,#10C6D4)', '--ks': 'rgba(99,91,255,.8)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></span>Prazo do serviço</div>
          <div className="v"><span className="os-num sm">{d.prazo.diasUsados.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span><span className="os-u">de {d.prazo.prazoDias} dias</span></div>
          <BarraPrazo l={{ etapa, prazoDias: d.prazo.prazoDias, diasUsados: d.prazo.diasUsados, atrasada: d.prazo.atrasada, noPrazo: d.prazo.noPrazo, executadoEm: d.executadoEm }} />
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#E8962A,#F2B44C)', '--ks': 'rgba(232,150,42,.8)', '--kg': 'rgba(242,180,76,.18)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg></span>Fotos</div>
          <div className="v"><span className="os-num sm">{d.fotos.length}</span>{d.fotos.length > 0 && <span className="os-delta bom">com carimbo</span>}</div>
          <small>{antes.length} antes · {depois.length} depois</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#8B5CF6,#635BFF)', '--ks': 'rgba(139,92,246,.8)', '--kg': 'rgba(139,92,246,.16)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-6" /></svg></span>{medicao ? medicao.nome : 'Medição'}</div>
          <div className="v"><span className="os-num sm">{medicao ? textoResposta(medicao.valor) : '—'}</span></div>
          <small>{medicao ? d.baixa.filter(b => b !== medicao && typeof b.valor === 'number').map(b => `${b.nome}: ${textoResposta(b.valor)}`).join(' · ') || 'informado na baixa' : 'aparece depois da baixa'}</small>
        </article>
        <article className="os-kpi" style={{ '--k': 'linear-gradient(135deg,#19B88A,#10C6D4)', '--ks': 'rgba(25,184,138,.8)', '--kg': 'rgba(25,184,138,.16)' } as React.CSSProperties}>
          <div className="t"><span className="os-ic"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></svg></span>{d.trabalharam.length ? 'Quem trabalhou' : 'Equipe'}</div>
          <div className="v"><span className="os-num sm">{d.trabalharam.length || d.equipe?.pessoas.length || 0}</span><span className="os-u">{(d.trabalharam.length || d.equipe?.pessoas.length) === 1 ? 'pessoa' : 'pessoas'}</span></div>
          {(d.trabalharam.length ? d.trabalharam.map(n => ({ nome: n, sigla: siglaDe(n) })) : d.equipe?.pessoas ?? []).length > 0
            ? <Avatares pessoas={d.trabalharam.length ? d.trabalharam.map(n => ({ nome: n, sigla: siglaDe(n) })) : d.equipe!.pessoas} max={5} />
            : <small>{d.equipe?.nome ?? 'sem equipe'}</small>}
        </article>
      </section>

      <Cartao icone="image" titulo="Antes e depois" meta={antes.length && depois.length ? 'arraste para comparar · fotos com carimbo de data, hora e GPS' : 'fotos com carimbo de data, hora e GPS'} ajuda="Ajuda: Fotos"
        direita={antes.length > 0 && depois.length > 0 ? <span className="so-badge cyan"><span className="dot live" />{pos}% depois</span> : undefined}>
        {d.fotos.length === 0 ? <p className="so-help">Nenhuma foto ainda.</p> : (
          <>
            <div className="os-cmp">
              <div className="ph"><FotoGrande entityId={entityId} fotoId={antesId ?? depoisId} /></div>
              {antesId && depoisId && <div className="ph" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}><FotoGrande entityId={entityId} fotoId={depoisId} /></div>}
              <span className="lab" style={{ left: 12 }}>{antesId ? `Antes · ${dia(antes.find(f => f.id === antesId)?.quando ?? null)}` : `Depois · ${dia(depois.find(f => f.id === depoisId)?.quando ?? null)}`}</span>
              {antesId && depoisId && <span className="lab" style={{ right: 12 }}>Depois · {dia(depois.find(f => f.id === depoisId)?.quando ?? null)}</span>}
              {antesId && depoisId && (
                <>
                  <span className="div" style={{ left: `${pos}%` }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18-6-6 6-6M15 6l6 6-6 6" /></svg></span>
                  <input type="range" min={0} max={100} value={pos} onChange={e => setPos(Number(e.target.value))} aria-label="Comparar antes e depois" />
                </>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {antes.length > 0 && <span className="so-help" style={{ marginRight: 2 }}>antes</span>}
              {antes.map((f, i) => <Miniatura key={f.id} entityId={entityId} fotoId={f.id} on={f.id === antesId} onClick={() => setAntesId(f.id)} rotulo={`Antes ${i + 1}`} />)}
              {depois.length > 0 && <span className="so-help" style={{ margin: '0 2px 0 10px' }}>depois</span>}
              {depois.map((f, i) => <Miniatura key={f.id} entityId={entityId} fotoId={f.id} on={f.id === depoisId} onClick={() => setDepoisId(f.id)} rotulo={`Depois ${i + 1}`} />)}
            </div>
          </>
        )}
      </Cartao>

      <Cartao icone="doc" titulo="O que foi pedido · o que foi feito" meta={`campos da ficha de ${d.servico.nome}`} ajuda="Ajuda: Pedido e baixa">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <div className="os-lift" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <div className="so-fs-t">Na abertura <span className="tag">{dataHora(d.criadoEm)}</span></div>
            <div className="so-tw"><table className="so-table"><tbody>
              {d.tipo && <tr><td style={{ width: '44%', color: 'var(--muted)' }}>Tipo de serviço</td><td style={{ fontWeight: 800, color: 'var(--ink)' }}>{d.tipo}</td></tr>}
              {d.abertura.map(a => <tr key={a.nome}><td style={{ color: 'var(--muted)' }}>{a.nome}</td><td style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{textoResposta(a.valor)}</td></tr>)}
              {d.origemDemanda && <tr><td style={{ color: 'var(--muted)' }}>Origem da demanda</td><td>{d.origemDemanda}</td></tr>}
              <tr><td style={{ color: 'var(--muted)' }}>Aberta por</td><td>{d.abertoPor}</td></tr>
              {d.observacoes && <tr><td style={{ color: 'var(--muted)' }}>Observações</td><td>{d.observacoes}</td></tr>}
            </tbody></table></div>
          </div>
          <div className="os-lift" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
            <div className="so-fs-t">Na baixa {d.executadoEm && <span className="tag">{dataHora(d.executadoEm)}</span>}</div>
            {d.executadoEm || d.baixa.length ? (
              <div className="so-tw"><table className="so-table"><tbody>
                {d.baixa.map(b => <tr key={b.nome}><td style={{ width: '44%', color: 'var(--muted)' }}>{b.nome}</td><td><span className={typeof b.valor === 'number' ? 'mono' : ''} style={{ fontWeight: 700, color: 'var(--ink)', fontSize: typeof b.valor === 'number' ? 15 : undefined }}>{textoResposta(b.valor)}</span></td></tr>)}
                {d.trabalharam.length > 0 && <tr><td style={{ color: 'var(--muted)' }}>Quem trabalhou</td><td><Avatares pessoas={d.trabalharam.map(n => ({ nome: n, sigla: siglaDe(n) }))} max={6} grande /></td></tr>}
                {d.executadoPor && <tr><td style={{ color: 'var(--muted)' }}>Baixa dada por</td><td>{d.executadoPor}</td></tr>}
                {d.obsBaixa && <tr><td style={{ color: 'var(--muted)' }}>Observação da baixa</td><td>{d.obsBaixa}</td></tr>}
              </tbody></table></div>
            ) : <p className="so-help">Ainda sem baixa. O fiscal preenche {d.camposBaixa.length ? d.camposBaixa.map(c => c.nome).join(', ') : 'os campos de baixa'} e tira a foto do depois.</p>}
          </div>
        </div>
      </Cartao>

      <Cartao icone="relogio" titulo="Linha do tempo" meta="quem fez cada passo, com data e hora" ajuda="Ajuda: Histórico">
        <div className="os-tl">
          {d.historico.map((h, i) => (
            <div key={i} className="it" style={{ '--d': COR_HIST[h.acao] ?? '#635BFF' } as React.CSSProperties}>
              <span className="q">{dataHora(h.quando)}</span>
              <span className="os-av" style={{ '--a': corAvatar(h.quem), margin: 0 } as React.CSSProperties}>{siglaDe(h.quem)}</span>
              <span className="tx"><b>{h.texto}</b> · {h.quem}</span>
              {h.etapa && <EtapaPill etapa={h.etapa} curto />}
              {h.observacao && <span className="obs">“{h.observacao}”</span>}
            </div>
          ))}
        </div>
      </Cartao>

      <BarraAcoes esquerda={<>
        <b>{etapa === 'AGUARDANDO_APROVACAO' ? 'Aguardando aprovação' : etapa === 'REGISTRADA' ? (devolvida ? 'Devolvida · a equipe refaz a baixa' : 'Com a equipe · falta a baixa') : etapa === 'EXECUTADA' ? 'Executada · aguardando conferência' : etapa === 'FINALIZADA' ? 'Finalizada · entra no painel e nos relatórios' : 'Cancelada'}</b>
        {p.conferirBloqueado && <><Sep />você deu esta baixa: outra pessoa confere</>}
      </>}>
        <button type="button" className="so-btn so-ghost" onClick={() => nav(rotaTenant(entityId, 'os'))}><Ic n="voltar" className="back" />Lista</button>
        {p.cancelar && <button type="button" className="so-btn so-danger" disabled={ocupado} onClick={() => setPedido({ acao: 'cancelar', titulo: 'Cancelar esta OS?', botao: 'Cancelar a OS', tom: 'coral', texto: 'A OS sai da fila da equipe. O motivo fica na linha do tempo.' })}>Cancelar OS</button>}
        {p.reabrir && <button type="button" className="so-btn so-ghost" disabled={ocupado} onClick={() => setPedido({ acao: 'reabrir', titulo: 'Reabrir esta OS?', botao: 'Reabrir', tom: 'amber', texto: 'Ela volta para a equipe como Registrada.' })}>Reabrir</button>}
        {p.aprovar && <>
          <button type="button" className="so-btn so-amberbtn" disabled={ocupado} onClick={() => setPedido({ acao: 'recusar', titulo: 'Recusar a abertura?', botao: 'Recusar', tom: 'coral', texto: 'Quem abriu vê o motivo. A OS fica como cancelada.' })}>Recusar</button>
          <button type="button" className="so-btn so-primary os-shine" disabled={ocupado} onClick={() => executar('aprovar')}><Ic n="shieldCheck" />Aprovar e mandar para a equipe</button>
        </>}
        {p.darBaixa && <Link to={rotaTenant(entityId, `os/${d.id}/baixa`)} className="so-btn so-mintbtn os-shine"><Ic n="image" />{devolvida ? 'Refazer a baixa' : 'Dar baixa com foto'}</Link>}
        {p.conferir && <>
          <button type="button" className="so-btn so-amberbtn" disabled={ocupado} onClick={() => setPedido({ acao: 'reabrir', titulo: 'Devolver para refazer?', botao: `Devolver para a ${d.equipe?.nome ?? 'equipe'}`, tom: 'amber', texto: 'O fiscal vê o motivo no celular e precisa tirar foto nova.' })}>Devolver para refazer</button>
          <button type="button" className="so-btn so-mintbtn os-shine" disabled={ocupado} onClick={() => executar('finalizar')}><Ic n="check" />Conferir e finalizar</button>
        </>}
      </BarraAcoes>

      {pedido && (
        <Janela icone={pedido.acao === 'reabrir' ? 'voltar' : 'alerta'} tom={pedido.tom} titulo={pedido.titulo} largura={480}
          eyebrow={d.numeroOS ?? 'OS'} sub={pedido.texto} onFechar={() => { if (!ocupado) { setPedido(null); setMotivo(''); } }}
          rodape={<>
            <button type="button" className="so-btn so-ghost" disabled={ocupado} onClick={() => { setPedido(null); setMotivo(''); }}>Voltar</button>
            <button type="button" className={`so-btn ${pedido.tom === 'coral' ? 'so-excluir' : 'so-amberbtn'}`} disabled={ocupado || motivo.trim().length < 5} onClick={() => executar(pedido.acao, motivo.trim())}>{ocupado ? 'Salvando…' : pedido.botao}</button>
          </>}>
          <label className="so-field"><span className="so-lbl">Motivo <span className="req">*</span><span className="opt">fica na linha do tempo</span></span>
            <span className="so-ctrl" style={{ height: 'auto' }}><textarea rows={3} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder={pedido.acao === 'reabrir' ? 'Ex.: a foto do depois não mostra o remendo inteiro' : 'Explique em poucas palavras'}
              style={{ width: '100%', border: 0, background: 'transparent', padding: '9px 11px', font: 'inherit', resize: 'vertical' }} /></span>
          </label>
        </Janela>
      )}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
