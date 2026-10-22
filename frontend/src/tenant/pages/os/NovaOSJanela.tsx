import { useEffect, useMemo, useRef, useState } from 'react';
import { mapaApi, osApi, type FormOS, type ValorCampoOS } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { CameraCarimbo, type LocalFoto } from '../../components/camera/CameraCarimbo';
import { bairroMaisProximoLocal, enderecoDoGps } from '../../components/camera/carimbo';
import { Aviso, Carregando, Ic, Janela, msgErro } from '../../components/sisobras/so';
import { Avatares, CampoFicha, IconeServico, corServico, fichaDoServico, paraResposta, respostaVazia } from './os-ui';

interface Foto { id: string; file: File; url: string }

/** Janela "Nova OS": segue a ficha do serviço; equipe obrigatória; vai para aprovação */
export function NovaOSJanela({ onFechar, onCriada }: { onFechar: () => void; onCriada: (r: { id: string; numeroOS: string }) => void }) {
  const { entityId, session } = useTenant();
  const [form, setForm] = useState<FormOS | null>(null);
  const [erroCarga, setErroCarga] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [tipo, setTipo] = useState('');
  const [equipeId, setEquipeId] = useState('');
  const [bairro, setBairro] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number; precisao?: number } | null>(null);
  const [origemDemanda, setOrigemDemanda] = useState('');
  const [obs, setObs] = useState('');
  const [valores, setValores] = useState<Record<string, ValorCampoOS>>({});
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [camera, setCamera] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [ruaDoGps, setRuaDoGps] = useState<'buscando' | 'achou' | ''>('');
  const consultaRef = useRef(0);
  /* o que a pessoa digitou o GPS não troca; a foto vale mais que a localização da abertura */
  const bairroTocado = useRef(false);
  const ruaTocada = useRef(false);
  const origemLocal = useRef<'auto' | 'botao' | 'foto' | null>(null);

  useEffect(() => {
    osApi.form(entityId).then(f => {
      setForm(f);
      if (f.servicos.length === 1) setServicoId(f.servicos[0].id);
      const menor = [...f.equipes].sort((a, b) => a.abertas - b.abertas)[0];
      if (f.equipes.length === 1) setEquipeId(f.equipes[0].id);
      else if (menor && f.equipes.length <= 3) setEquipeId(menor.id);
      if (f.origens.length) setOrigemDemanda(f.origens.includes('Secretaria') ? 'Secretaria' : f.origens[0]);
    }).catch(e => setErroCarga(msgErro(e, 'Não foi possível abrir o formulário')));
  }, [entityId]);
  useEffect(() => () => fotos.forEach(f => URL.revokeObjectURL(f.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const servico = form?.servicos.find(s => s.id === servicoId) ?? null;
  const ficha = useMemo(() => servico ? fichaDoServico(servico) : { subtipos: [], campos: [] }, [servico]);
  const camposAbertura = ficha.campos.filter(c => (c.momento ?? 'ABERTURA') === 'ABERTURA');
  const camposBaixa = ficha.campos.filter(c => c.momento === 'BAIXA');
  const equipe = form?.equipes.find(e => e.id === equipeId) ?? null;
  /* a sugerida: a equipe mais livre agora (uma só) */
  const sugerida = form && form.equipes.length > 1 ? [...form.equipes].sort((a, b) => a.abertas - b.abertas || a.nome.localeCompare(b.nome))[0].id : null;
  const bairrosCoords = useMemo(() => (form?.bairros ?? []).map(b => ({ id: b.nome, nome: b.nome, lat: b.lat, lng: b.lng })), [form]);

  function escolherServico(id: string) {
    setServicoId(id); setTipo(''); setValores({}); setErro('');
  }
  function usarLocal(l: { lat: number; lng: number; precisao?: number }, origem: 'auto' | 'botao' | 'foto') {
    setCoords(l);
    origemLocal.current = origem;
    if (!bairroTocado.current) {
      const p = bairroMaisProximoLocal(l.lat, l.lng, bairrosCoords);
      if (p) setBairro(p);
    }
    /* rua e bairro pelo GPS, igual à página do munícipe */
    if (ruaTocada.current) return;
    const n = ++consultaRef.current;
    setRuaDoGps('buscando');
    mapaApi.reverse(entityId, l.lat, l.lng).then(r => {
      if (n !== consultaRef.current || ruaTocada.current) return;
      const achado = enderecoDoGps(r, form?.bairros ?? []);
      if (achado.rua) { setLogradouro(achado.rua); setRuaDoGps('achou'); } else setRuaDoGps('');
      if (achado.bairro && !bairroTocado.current) setBairro(achado.bairro);
    }).catch(() => { if (n === consultaRef.current) setRuaDoGps(''); });
  }
  function pegarGps(auto = false) {
    if (!navigator.geolocation) { if (!auto) setErro('Este aparelho não tem GPS'); return; }
    setBuscandoGps(true);
    navigator.geolocation.getCurrentPosition(
      p => {
        setBuscandoGps(false);
        /* a foto chegou antes: ela manda */
        if (auto && origemLocal.current === 'foto') return;
        usarLocal({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }, auto ? 'auto' : 'botao');
      },
      () => { setBuscandoGps(false); if (!auto) setErro('Não consegui pegar a localização. Confira se o GPS está ligado.'); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }
  /* no celular a localização vem sozinha ao abrir; no computador do escritório fica no botão */
  const celular = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  useEffect(() => {
    if (form && celular && !origemLocal.current) pegarGps(true);
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps
  function fotosDaCamera(files: File[], local: LocalFoto | null) {
    setCamera(false);
    setFotos(prev => [...prev, ...files.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
    if (local && origemLocal.current !== 'foto') usarLocal(local, 'foto');
  }
  function anexar(files: FileList | null) {
    if (!files) return;
    /* copia agora: o campo de arquivo é limpo logo depois */
    const novas = Array.from(files).filter(f => f.type.startsWith('image/')).map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    setFotos(prev => [...prev, ...novas]);
  }

  const faltando = [
    !servico && 'serviço',
    servico && ficha.subtipos.length > 0 && !tipo && 'tipo de serviço',
    !equipe && 'equipe',
    !bairro && 'bairro',
    !logradouro.trim() && 'rua ou referência',
    ...camposAbertura.filter(c => c.obrigatorio && respostaVazia(valores[c.id] ?? null)).map(c => c.nome),
  ].filter(Boolean) as string[];
  const passos = [
    { n: 1, nome: 'Serviço', ok: !!servico && (!ficha.subtipos.length || !!tipo) },
    { n: 2, nome: 'Equipe', ok: !!equipe },
    { n: 3, nome: 'Onde', ok: !!bairro && !!logradouro.trim() },
    { n: 4, nome: 'Pedido', ok: !!servico && camposAbertura.every(c => !c.obrigatorio || !respostaVazia(valores[c.id] ?? null)) },
    { n: 5, nome: 'Fotos', ok: fotos.length > 0 },
  ];

  async function salvar() {
    if (faltando.length) { setErro(`Falta: ${faltando.join(', ')}`); return; }
    setSalvando(true); setErro('');
    try {
      const r = await osApi.abrir(entityId, {
        servicoId, equipeId, tipo: tipo || null, bairro, logradouro: logradouro.trim(),
        lat: coords?.lat ?? null, lng: coords?.lng ?? null, origemDemanda: origemDemanda || null, observacoes: obs.trim() || null,
        campos: camposAbertura.filter(c => !respostaVazia(valores[c.id] ?? null)).map(c => paraResposta(c, valores[c.id] ?? null)),
      });
      for (const f of fotos) {
        try { await mapaApi.uploadMidia(entityId, r.id, f.file, 'ABERTURA'); } catch { /* a OS já existe; a foto pode ser mandada de novo pela ficha */ }
      }
      onCriada({ id: r.id, numeroOS: r.numeroOS });
    } catch (e) { setErro(msgErro(e, 'Não foi possível abrir a OS')); }
    finally { setSalvando(false); }
  }

  return (
    <Janela icone="plus" eyebrow="Ordens de Serviço · nova" titulo="Nova OS" largura={820} onFechar={onFechar}
      sub="Os campos seguem a ficha do serviço escolhido. A OS passa pela aprovação antes de ir para a equipe."
      ajuda="Ajuda: Nova OS"
      rodape={<>
        <button type="button" className="so-btn so-ghost" onClick={onFechar} disabled={salvando}>Cancelar</button>
        <button type="button" className="so-btn so-primary os-shine" onClick={salvar} disabled={salvando || !form}>
          {salvando ? 'Abrindo…' : <>Abrir OS<Ic n="seta" className="arrow" /></>}
        </button>
      </>}>
      {!form ? (erroCarga ? <Aviso tom="amber">{erroCarga}</Aviso> : <Carregando />) : !form.servicos.length ? (
        <Aviso tom="amber">Você não tem serviço marcado no seu cadastro. Peça ao administrador para marcar os serviços que você atende.</Aviso>
      ) : !form.equipes.length ? (
        <Aviso tom="amber">Você não faz parte de nenhuma equipe. Toda OS precisa de equipe: peça ao administrador para ligar o seu cadastro a uma equipe.</Aviso>
      ) : (
        <>
          <div className="os-steps" aria-label="Passos da OS">
            {passos.map(p => (
              <span key={p.n} className={`os-step${p.ok ? ' ok' : ''}`} style={p.ok ? undefined : { color: 'var(--muted)' }}>
                <i style={p.ok ? undefined : { background: 'var(--surface-3)', color: 'var(--muted)', boxShadow: 'none' }}>{p.ok ? <Ic n="check" style={{ width: 11, height: 11, strokeWidth: 3 }} /> : p.n}</i>{p.nome}
              </span>
            ))}
          </div>

          <div className="so-fs-t">1 · Serviço <span className="tag">só os que você atende</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {form.servicos.map(s => (
              <label key={s.id} className={`os-sc${s.id === servicoId ? ' on' : ''}`} style={{ '--c': corServico(s.cor) } as React.CSSProperties}>
                <input type="radio" name="servico" checked={s.id === servicoId} onChange={() => escolherServico(s.id)} />
                <span className="top"><span className="m"><IconeServico nome={s.nome} /></span><span style={{ minWidth: 0 }}><b>{s.nome}</b></span></span>
                <span className="ft"><span>{s.abertas} abertas</span><span>prazo {s.prazoDias} dias</span></span>
                <span className="ck"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>
              </label>
            ))}
          </div>
          {servico && ficha.subtipos.length > 0 && (
            <div className="so-field">
              <span className="so-lbl">Tipo de serviço <span className="req">*</span><span className="opt">vem da ficha de {servico.nome}</span></span>
              <div className="so-seg">
                {ficha.subtipos.map(t => (
                  <label key={t} className={tipo === t ? 'on' : ''}><input type="radio" name="tipo" checked={tipo === t} onChange={() => setTipo(t)} />{t}</label>
                ))}
              </div>
            </div>
          )}

          <div className="so-fs-t">2 · Equipe <span className="tag">obrigatória</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {form.equipes.map(e => {
              const carga = Math.min(100, Math.round(e.abertas / 8 * 100));
              const cor = e.abertas >= 6 ? 'linear-gradient(90deg,#F2B44C,#E5534B)' : e.abertas >= 4 ? 'linear-gradient(90deg,#635BFF,#F2B44C)' : 'linear-gradient(90deg,#19B88A,#10C6D4)';
              return (
                <label key={e.id} className={`os-eq${e.id === equipeId ? ' on' : ''}`}>
                  <input type="radio" name="equipe" checked={e.id === equipeId} onChange={() => setEquipeId(e.id)} />
                  <span className="hd"><b>{e.nome}</b>{e.id === sugerida && <span className="os-sug os-shine">sugerida</span>}</span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {e.pessoas.length ? <Avatares pessoas={e.pessoas} /> : <small>sem pessoas cadastradas</small>}
                    <small>{e.qtdPessoas} {e.qtdPessoas === 1 ? 'pessoa' : 'pessoas'}</small>
                  </span>
                  <span className="tk"><span style={{ width: `${Math.max(carga, 4)}%`, background: cor }} /></span>
                  <small>{e.abertas} OS abertas agora</small>
                </label>
              );
            })}
          </div>
          <p className="so-help" style={{ marginTop: -4 }}>Aparecem as equipes das quais você faz parte. Demanda interna da Secretaria vai para <b>Escritório</b>. A sugerida é a mais livre agora.</p>

          <div className="so-fs-t">3 · Onde</div>
          <div className="so-fgrid">
            <label className="so-field"><span className="so-lbl">Bairro <span className="req">*</span></span>
              <span className="so-ctrl"><select value={bairro} onChange={e => { setBairro(e.target.value); bairroTocado.current = true; }}><option value="">Escolha…</option>{form.bairros.map(b => <option key={b.nome}>{b.nome}</option>)}</select></span>
            </label>
            <label className="so-field" style={{ gridColumn: 'span 2' }}><span className="so-lbl">Rua / referência <span className="req">*</span></span>
              <span className="so-ctrl"><Ic n="pin" /><input type="text" value={logradouro} maxLength={300} placeholder={ruaDoGps === 'buscando' ? 'Procurando a rua pelo GPS…' : 'Ex.: Rua Rui Barbosa, em frente ao 210'} onChange={e => { setLogradouro(e.target.value); ruaTocada.current = true; setRuaDoGps(''); }} /></span>
              {ruaDoGps === 'achou' && <span className="so-help" style={{ color: 'var(--mint-ink, #0E8A5F)' }}>Rua encontrada pelo GPS. Confira o número.</span>}
            </label>
            <div className="so-field all">
              <span className="so-lbl">Ponto no mapa <span className="opt">vem sozinho pelo GPS no celular</span></span>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                {coords
                  ? <span className="os-pill mint"><i /><span className="mono" style={{ fontSize: 11 }}>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>{coords.precisao != null && <span style={{ fontWeight: 600 }}>±{Math.round(coords.precisao)} m</span>}</span>
                  : <span className="so-help">{buscandoGps ? 'Pegando a localização…' : 'Sem ponto marcado'}</span>}
                <button type="button" className="so-btn so-ghost sm" onClick={() => pegarGps()} disabled={buscandoGps}><Ic n="pin" />{buscandoGps ? 'Buscando…' : coords ? 'Pegar de novo' : 'Usar minha localização'}</button>
                {coords && <button type="button" className="so-btn so-ghost sm" onClick={() => { setCoords(null); origemLocal.current = null; }}>Tirar</button>}
              </div>
            </div>
          </div>

          <div className="so-fs-t">4 · O que foi pedido <span className="tag">campos de abertura da ficha</span></div>
          <div className="so-fgrid">
            {form.origens.length > 0 && (
              <label className="so-field"><span className="so-lbl">Origem da demanda</span>
                <span className="so-ctrl"><select value={origemDemanda} onChange={e => setOrigemDemanda(e.target.value)}><option value="">—</option>{form.origens.map(o => <option key={o}>{o}</option>)}</select></span>
              </label>
            )}
            {camposAbertura.map(c => (
              <div key={c.id} style={{ gridColumn: c.tipo === 'LISTA' || c.tipo === 'VARIAS' ? 'span 2' : undefined, minWidth: 0 }}>
                <CampoFicha c={c} valor={valores[c.id] ?? null} onChange={v => setValores(p => ({ ...p, [c.id]: v }))} />
              </div>
            ))}
            <label className="so-field all"><span className="so-lbl">Observações</span>
              <span className="so-ctrl" style={{ height: 'auto' }}><textarea rows={2} maxLength={2000} value={obs} onChange={e => setObs(e.target.value)}
                style={{ width: '100%', border: 0, background: 'transparent', padding: '9px 11px', font: 'inherit', resize: 'vertical' }} /></span>
            </label>
          </div>
          {camposBaixa.length > 0 && <p className="so-help" style={{ marginTop: -4 }}>Os campos de <b>baixa</b> da ficha ({camposBaixa.map(c => c.nome).join(', ')}) ficam para o fiscal preencher quando terminar.</p>}

          <div className="so-fs-t">5 · Fotos do antes <span className="tag">carimbo com data, hora e GPS</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            {fotos.map(f => (
              <span key={f.id} className="os-photo" style={{ display: 'block' }}>
                <img src={f.url} alt="Foto do antes" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" className="so-x" aria-label="Tirar esta foto" onClick={() => setFotos(p => p.filter(x => x.id !== f.id))}
                  style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24 }}><Ic n="x" /></button>
              </span>
            ))}
            <button type="button" className="so-btn so-ghost" style={{ height: 78, borderStyle: 'dashed', padding: '0 18px' }} onClick={() => setCamera(true)}><Ic n="image" />Tirar foto</button>
            <label className="so-btn so-ghost" style={{ height: 78, borderStyle: 'dashed', padding: '0 18px', cursor: 'pointer' }}>
              <Ic n="plus" />Escolher do aparelho
              <input type="file" accept="image/*" multiple hidden onChange={e => { anexar(e.target.files); e.target.value = ''; }} />
            </label>
          </div>

          {servico && (
            <div className="os-prev" aria-label="Prévia da OS">
              <div>
                <span className="n">OS {new Date().getFullYear()}/····</span>
                <span className="os-svc"><span className="m" style={{ '--c': corServico(servico.cor) } as React.CSSProperties}><IconeServico nome={servico.nome} /></span>
                  <span><b>{servico.nome}{tipo ? ` · ${tipo}` : ''}</b><small>{[logradouro.trim(), bairro, equipe?.nome].filter(Boolean).join(' · ') || 'preencha onde e a equipe'}</small></span></span>
                <span className="os-pill amber" style={{ marginLeft: 'auto' }}><i />vai para aprovação</span>
              </div>
            </div>
          )}
          {erro && <Aviso tom="amber">{erro}</Aviso>}
        </>
      )}
      {camera && servico && (
        <CameraCarimbo entityId={entityId}
          assinatura={{ nome: session.name, entidade: session.entity.name, usuarioId: session.id }}
          servico={servico.nome} cor={corServico(servico.cor)} bairro={bairro} logradouro={logradouro}
          bairrosCoords={bairrosCoords} onConcluir={fotosDaCamera} onFechar={() => setCamera(false)} />
      )}
      {camera && !servico && <Aviso tom="amber">Escolha o serviço antes de tirar a foto (ele sai no carimbo).</Aviso>}
    </Janela>
  );
}
