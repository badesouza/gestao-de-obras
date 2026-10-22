import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mapaApi, osApi, type DetalheOS, type ValorCampoOS } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { CameraCarimbo } from '../../components/camera/CameraCarimbo';
import { Aviso, Carregando, Ic, Pagina, msgErro, rotaTenant } from '../../components/sisobras/so';
import { useFotoUrl } from '../../components/obras/util';
import { CampoFicha, MarcaServico, corAvatar, corServico, paraResposta, respostaVazia, siglaDe } from './os-ui';
import { padroesDoServico } from '../cadastros/servico-padroes';
import type { CampoFichaOS } from '../../../lib/api-client';

function Mini({ entityId, fotoId }: { entityId: string; fotoId: string }) {
  const url = useFotoUrl(entityId, fotoId);
  return (
    <span className="os-thumb" style={{ overflow: 'hidden' }}>
      {url && <img src={url} alt="Foto do depois" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 9 }} />}
      <span className="ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>
    </span>
  );
}

/** Celular · Dar baixa com foto: foto do depois, campos de baixa da ficha e quem trabalhou */
export function BaixaOSPage() {
  const { entityId, session } = useTenant();
  const { osId = '' } = useParams<{ osId: string }>();
  const [d, setD] = useState<DetalheOS | null>(null);
  const [erro, setErro] = useState('');
  const [valores, setValores] = useState<Record<string, ValorCampoOS>>({});
  const [quem, setQuem] = useState<string[]>([]);
  const [obs, setObs] = useState('');
  const [camera, setCamera] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [feito, setFeito] = useState<{ etapa: string } | null>(null);

  const carregar = useCallback(() => osApi.detalhe(entityId, osId).then(x => {
    setD(x);
    setQuem(q => q.length ? q : x.equipe?.pessoas.filter(p => p.nome === session.name).map(p => p.nome) ?? []);
  }).catch(e => setErro(msgErro(e, 'Não foi possível abrir a OS'))), [entityId, osId, session.name]);
  useEffect(() => { carregar(); }, [carregar]);

  /* campos de baixa: os da ficha salva; senão, os padrões do serviço */
  const campos: CampoFichaOS[] = useMemo(() => {
    if (!d) return [];
    if (d.camposBaixa.length) return d.camposBaixa;
    return padroesDoServico(d.servico.id).campos.filter(c => c.momento === 'BAIXA')
      .map((c, i) => ({ id: `padrao-${i}`, nome: c.nome, detalhe: c.detalhe, tipo: c.tipo, opcoes: c.opcoes, momento: 'BAIXA', obrigatorio: c.obrigatorio }));
  }, [d]);

  if (!d) return <Pagina semMira>{erro ? <Aviso tom="amber">{erro}</Aviso> : <Carregando />}</Pagina>;
  /* fotos do depois desta baixa (depois de uma devolução, só as novas valem) */
  const fotos = d.fotos.filter(f => f.momento === 'BAIXA' && (!d.devolvidoEm || f.quando > d.devolvidoEm));
  const pessoas = d.equipe?.pessoas.length ? d.equipe.pessoas : [{ nome: session.name, sigla: siglaDe(session.name) }];
  const prontos = [fotos.length > 0, campos.filter(c => c.obrigatorio).every(c => !respostaVazia(valores[c.id] ?? null)), quem.length > 0];
  const nProntos = prontos.filter(Boolean).length;
  const podeDar = d.poderes.darBaixa;

  async function fotosDaCamera(files: File[]) {
    setCamera(false);
    setEnviandoFoto(n => n + files.length); setAviso('');
    for (const f of files) {
      try { await mapaApi.uploadMidia(entityId, osId, f, 'BAIXA'); }
      catch { setAviso('Uma foto não subiu. Confira o sinal e tente de novo.'); }
      finally { setEnviandoFoto(n => n - 1); }
    }
    carregar();
  }
  async function anexar(list: FileList | null) {
    if (!list) return;
    await fotosDaCamera(Array.from(list).filter(f => f.type.startsWith('image/')));
  }
  async function darBaixa() {
    const falta = [
      !fotos.length && 'a foto do depois',
      ...campos.filter(c => c.obrigatorio && respostaVazia(valores[c.id] ?? null)).map(c => c.nome),
      !quem.length && 'quem trabalhou',
    ].filter(Boolean);
    if (falta.length) { setAviso(`Falta: ${falta.join(', ')}`); return; }
    setSalvando(true); setAviso('');
    try {
      const r = await osApi.baixa(entityId, osId, {
        campos: campos.filter(c => !respostaVazia(valores[c.id] ?? null)).map(c => paraResposta(c, valores[c.id] ?? null)),
        trabalharam: quem, observacao: obs.trim() || null,
      });
      setFeito(r);
    } catch (e) { setAviso(msgErro(e, 'Não foi possível dar a baixa')); }
    finally { setSalvando(false); }
  }

  return (
    <Pagina semMira>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <header className="so-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to={rotaTenant(entityId, 'minhas-os')} className="so-btn so-ghost sm"><Ic n="voltar" className="back" />Minhas OS</Link>
            <Link to={rotaTenant(entityId, `os/${osId}`)} className="so-btn so-ghost sm" style={{ marginLeft: 'auto' }}>Ver a OS</Link>
          </div>
          <MarcaServico nome={feito ? 'Baixa dada' : d.devolvidoEm && d.etapa === 'REGISTRADA' ? 'Refazer a baixa' : 'Dar baixa'} iconeDe={d.servico.nome} cor={d.servico.cor}
            sub={<><span className="mono">{d.numeroOS}</span> · {d.tipo || d.servico.nome} · {[d.local.logradouro, d.local.bairro].filter(Boolean).join(' · ')}</>} />
          {!feito && podeDar && (
            <div className="os-prog"><span>{nProntos} de 3 prontos</span><span className="tk"><span style={{ width: `${nProntos / 3 * 100}%` }} /></span></div>
          )}
        </header>

        {feito ? (
          <section className="so-card" style={{ position: 'relative', overflow: 'hidden', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
            <div className="os-done">
              <b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></b>
              {[['#635BFF', -90, -80], ['#10C6D4', 95, -70], ['#F2B44C', -70, 80], ['#19B88A', 85, 75], ['#E5534B', 0, -110], ['#8B85FF', -110, 10]].map(([c, x, y], i) => (
                <span key={i} className="os-conf" style={{ left: '50%', top: '50%', background: c as string, '--dx': `${x}px`, '--dy': `${y}px`, animationDelay: `${i * 0.04}s` } as React.CSSProperties} />
              ))}
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Baixa dada!</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.5 }}>
              {feito.etapa === 'FINALIZADA' ? <>A <b>{d.numeroOS}</b> já está finalizada.</> : <>A <b>{d.numeroOS}</b> agora espera a <b>conferência</b> do coordenador.</>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
              <span className="os-pill mint"><i />{fotos.length} {fotos.length === 1 ? 'foto' : 'fotos'} com carimbo</span>
              <span className="os-pill brand"><i />{quem.length} {quem.length === 1 ? 'pessoa' : 'pessoas'}</span>
            </div>
            <Link to={rotaTenant(entityId, 'minhas-os')} className="so-btn so-primary os-shine" style={{ height: 50, width: '100%', justifyContent: 'center', marginTop: 8 }}>Voltar para Minhas OS</Link>
          </section>
        ) : !podeDar ? (
          <Aviso tom="amber">
            {d.etapa === 'AGUARDANDO_APROVACAO' ? 'Esta OS ainda espera a aprovação. A baixa fica liberada depois.'
              : d.etapa === 'EXECUTADA' ? 'A baixa já foi dada e espera a conferência.'
                : d.etapa === 'FINALIZADA' ? 'Esta OS já foi finalizada.'
                  : d.etapa === 'CANCELADA' ? 'Esta OS foi cancelada.' : 'Você não tem acesso para dar baixa.'}
          </Aviso>
        ) : (
          <section className="so-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {d.devolvidoEm && <div className="so-note amber"><Ic n="voltar" /><span><b>Devolvida:</b> {d.motivoDevolucao}</span></div>}

            <div className="so-fs-t">Fotos do depois <span className="tag">obrigatório</span></div>
            <button type="button" className="os-vf" onClick={() => setCamera(true)} aria-label="Abrir a câmera" style={{ border: 0, padding: 0, cursor: 'pointer', width: '100%' }}>
              <span className="c tl" /><span className="c tr" /><span className="c bl" /><span className="c br" />
              <span className="laser" />
              <span className="stamp" style={{ textAlign: 'left' }}>{new Date().toLocaleString('pt-BR')} · {d.local.bairro || '—'}<br />{session.name}</span>
              <span className="os-shut" aria-hidden="true" />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="os-thumbs">{fotos.map(f => <Mini key={f.id} entityId={entityId} fotoId={f.id} />)}</div>
              <span className="so-help">{enviandoFoto ? 'Enviando foto…' : fotos.length === 0 ? 'Toque no visor para abrir a câmera' : fotos.length === 1 ? '1 foto · tire mais uma de longe' : `${fotos.length} fotos · ótimo`}</span>
              <label className="so-btn so-ghost sm" style={{ cursor: 'pointer', marginLeft: 'auto' }}>Da galeria<input type="file" accept="image/*" multiple hidden onChange={e => { anexar(e.target.files); e.target.value = ''; }} /></label>
            </div>

            {campos.length > 0 && <div className="so-fs-t">Medição e dados <span className="tag">da ficha de {d.servico.nome}</span></div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {campos.map(c => (
                <div key={c.id} style={{ gridColumn: c.tipo === 'NUMERO' ? undefined : '1 / -1', minWidth: 0 }}>
                  <CampoFicha c={c} valor={valores[c.id] ?? null} onChange={v => setValores(p => ({ ...p, [c.id]: v }))} grande />
                </div>
              ))}
            </div>

            <div className="so-fs-t">Quem trabalhou <span className="tag">toque para marcar</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 6 }}>
              {pessoas.map(p => {
                const on = quem.includes(p.nome);
                return (
                  <button key={p.nome} type="button" className={`os-who${on ? ' on' : ''}`} aria-pressed={on}
                    onClick={() => setQuem(q => on ? q.filter(x => x !== p.nome) : [...q, p.nome])}>
                    <span className="os-av" style={{ '--a': corAvatar(p.nome) } as React.CSSProperties}>{p.sigla}</span>
                    <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            <label className="so-field"><span className="so-lbl">Observação</span>
              <span className="so-ctrl"><input type="text" value={obs} maxLength={1000} placeholder="Ex.: usado CBUQ do contrato" onChange={e => setObs(e.target.value)} /></span>
            </label>

            {aviso && <Aviso tom="amber">{aviso}</Aviso>}
            <button type="button" className="so-btn so-mintbtn os-shine" style={{ height: 52, fontSize: 15, borderRadius: 13, justifyContent: 'center' }} disabled={salvando || enviandoFoto > 0} onClick={darBaixa}>
              <Ic n="check" />{salvando ? 'Salvando…' : 'Dar baixa'}
            </button>
          </section>
        )}
      </div>
      {camera && (
        <CameraCarimbo entityId={entityId}
          assinatura={{ nome: session.name, entidade: session.entity.name, usuarioId: session.id }}
          servico={d.servico.nome} cor={corServico(d.servico.cor)} bairro={d.local.bairro} logradouro={d.local.logradouro}
          bairrosCoords={[]} onConcluir={files => fotosDaCamera(files)} onFechar={() => setCamera(false)} />
      )}
    </Pagina>
  );
}
