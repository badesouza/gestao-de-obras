import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { cadastrosBaseApi } from '../../../lib/api-client';
import type { BairroLugar, MacrozonaLugar } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import {
  AcoesLinha, Aviso, BarraAcoes, CabecalhoPasso, Carregando, Cartao, Ic, Janela, Pagina, Sep, msgErro, rotaTenant, useConfirmarExclusao, useResumoCadastros,
} from '../../components/sisobras/so';

const CENTRO_PADRAO: [number, number] = [-12.5253, -40.3083];

type Painel =
  | { modo: 'novo' }
  | { modo: 'editar'; bairro: BairroLugar }
  | { modo: 'colar' }
  | null;

/** Mapa para clicar no meio do bairro */
function MapaPonto({ ponto, onPonto, centro }: { ponto: [number, number] | null; onPonto: (p: [number, number]) => void; centro: [number, number] }) {
  const el = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marca = useRef<L.CircleMarker | null>(null);
  const cb = useRef(onPonto);
  cb.current = onPonto;

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center: ponto ?? centro, zoom: ponto ? 15 : 13, zoomControl: true, attributionControl: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => cb.current([e.latlng.lat, e.latlng.lng]));
    mapa.current = m;
    setTimeout(() => m.invalidateSize(), 60);
    return () => { m.remove(); mapa.current = null; marca.current = null; };
    // o mapa nasce uma vez por painel aberto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!ponto) { marca.current?.remove(); marca.current = null; return; }
    if (!marca.current) {
      marca.current = L.circleMarker(ponto, { radius: 9, color: '#FFFFFF', weight: 3, fillColor: '#635BFF', fillOpacity: 1 }).addTo(m);
    } else marca.current.setLatLng(ponto);
  }, [ponto]);

  return <div className="so-mapa" role="img" aria-label="Mapa para marcar o centro do bairro"><div ref={el} style={{ position: 'absolute', inset: 0 }} /></div>;
}

/** Tela 3 · Passo 2 — Lugares (macrozonas e bairros) */
export function LugaresPage() {
  const { entityId } = useTenant();
  const { resumo, recarregar } = useResumoCadastros();
  const { toasts, showToast, closeToast } = useToast();
  const [macros, setMacros] = useState<MacrozonaLugar[] | null>(null);
  const [bairros, setBairros] = useState<BairroLugar[]>([]);
  const [filtro, setFiltro] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [painel, setPainel] = useState<Painel>(null);
  const [novaMacro, setNovaMacro] = useState<string | null>(null);
  const [macroEdId, setMacroEdId] = useState<string | null>(null);
  const { confirmar, janelaExclusao } = useConfirmarExclusao();

  // campos do painel
  const [nome, setNome] = useState('');
  const [macroId, setMacroId] = useState('');
  const [ponto, setPonto] = useState<[number, number] | null>(null);
  const [lista, setLista] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroNome, setErroNome] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await cadastrosBaseApi.lugares(entityId);
      setMacros(r.macrozonas); setBairros(r.bairros);
    } catch (e) { showToast(msgErro(e, 'Não foi possível abrir os lugares'), 'error'); setMacros([]); }
  }, [entityId, showToast]);
  useEffect(() => { carregar(); }, [carregar]);

  function abrir(p: Painel) {
    setPainel(p); setErroNome(false);
    if (p?.modo === 'editar') {
      setNome(p.bairro.nome); setMacroId(p.bairro.macrozonaId ?? '');
      setPonto(p.bairro.lat != null && p.bairro.lng != null ? [p.bairro.lat, p.bairro.lng] : null);
    } else {
      setNome(''); setMacroId(filtro !== 'todas' && filtro !== 'sem' ? filtro : macros?.[0]?.id ?? ''); setPonto(null); setLista('');
    }
  }

  const centroMapa = useMemo<[number, number]>(() => {
    const comPonto = bairros.filter(b => b.lat != null && b.lng != null);
    if (!comPonto.length) return CENTRO_PADRAO;
    return [comPonto.reduce((s, b) => s + b.lat!, 0) / comPonto.length, comPonto.reduce((s, b) => s + b.lng!, 0) / comPonto.length];
  }, [bairros]);

  if (!macros) return <Pagina><Carregando /></Pagina>;

  const semMacro = bairros.filter(b => !b.macrozonaId).length;
  const visiveis = bairros.filter(b =>
    (filtro === 'todas' || (filtro === 'sem' ? !b.macrozonaId : b.macrozonaId === filtro)) &&
    (!busca.trim() || b.nome.toLowerCase().includes(busca.trim().toLowerCase())));
  const semPonto = bairros.filter(b => b.lat == null || b.lng == null).length;

  async function salvarBairro() {
    if (!nome.trim()) { setErroNome(true); showToast('Informe o nome do bairro', 'warning'); return; }
    if (!macroId) { showToast('Escolha a macrozona', 'warning'); return; }
    setSalvando(true);
    const dados = { nome, macrozonaId: macroId, lat: ponto?.[0] ?? null, lng: ponto?.[1] ?? null };
    try {
      if (painel?.modo === 'editar') await cadastrosBaseApi.atualizarBairro(entityId, painel.bairro.id, dados);
      else await cadastrosBaseApi.criarBairro(entityId, dados);
      showToast(painel?.modo === 'editar' ? 'Bairro salvo' : 'Bairro cadastrado');
      await carregar(); recarregar();
      setPainel(null);
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  function removerBairro(b: BairroLugar) {
    confirmar({
      oque: 'bairro', nome: b.nome,
      texto: 'Se o bairro já tiver OS, ele não é apagado: fica inativo, some das listas novas e o histórico continua.',
      acao: () => excluirBairro(b),
    });
  }
  async function excluirBairro(b: BairroLugar) {
    try {
      const r = await cadastrosBaseApi.removerBairro(entityId, b.id);
      showToast(r.desativado ? 'O bairro tem OS: ficou inativo e o histórico continua' : 'Bairro removido', r.desativado ? 'warning' : 'success');
      await carregar(); recarregar(); setPainel(null);
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  async function colar() {
    if (!lista.trim()) { showToast('Cole um bairro por linha', 'warning'); return; }
    setSalvando(true);
    try {
      const r = await cadastrosBaseApi.colarBairros(entityId, lista, macroId || null);
      showToast(`${r.criados} bairro(s) cadastrado(s)${r.repetidos.length ? ` · ${r.repetidos.length} já existiam` : ''}`);
      await carregar(); recarregar(); setPainel(null);
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  async function criarMacro() {
    if (!novaMacro?.trim()) { showToast('Informe o nome da macrozona', 'warning'); return; }
    try {
      if (macroEdId) await cadastrosBaseApi.renomearMacrozona(entityId, macroEdId, novaMacro);
      else await cadastrosBaseApi.criarMacrozona(entityId, novaMacro);
      showToast(macroEdId ? 'Macrozona salva' : 'Macrozona criada');
      setNovaMacro(null); setMacroEdId(null); await carregar(); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
  }
  function fecharMacro() { setNovaMacro(null); setMacroEdId(null); }
  function excluirMacro(m: MacrozonaLugar) {
    confirmar({
      oque: 'macrozona', nome: m.nome,
      texto: m.bairros > 0 ? `Os ${m.bairros} bairros dela continuam cadastrados e ficam "sem macrozona".` : 'Ela não tem bairros.',
      acao: async () => {
        try {
          await cadastrosBaseApi.removerMacrozona(entityId, m.id);
          showToast('Macrozona excluída'); setFiltro('todas'); await carregar(); recarregar();
        } catch (e) { showToast(msgErro(e), 'error'); }
      },
    });
  }
  const macroSel = macros.find(m => m.id === filtro) ?? null;

  const tituloPainel = painel?.modo === 'editar' ? 'Editar bairro' : painel?.modo === 'colar' ? 'Colar lista de bairros' : 'Novo bairro';

  return (
    <Pagina>
      <CabecalhoPasso passo={2} resumo={resumo} sub="Macrozonas e bairros. Aparecem ao abrir uma OS, nos filtros do painel e na página do munícipe." />

      <Cartao className="so-rise" icone="map" titulo="Macrozonas" meta="clique numa macrozona para filtrar, editar ou excluir" ajuda="Ajuda: Macrozonas"
        direita={<button type="button" className="so-btn so-dashed sm" onClick={() => setNovaMacro('')}><Ic n="plus" />Nova macrozona</button>}>
        <div className="so-chips">
          <button type="button" className={`so-chip${filtro === 'todas' ? ' on' : ''}`} onClick={() => setFiltro('todas')}>Todas <span className="n">{bairros.length}</span></button>
          {macros.map(m => (
            <button key={m.id} type="button" className={`so-chip${filtro === m.id ? ' on' : ''}`} onClick={() => setFiltro(m.id)}>{m.nome} <span className="n">{m.bairros}</span></button>
          ))}
          {semMacro > 0 && <button type="button" className={`so-chip alert${filtro === 'sem' ? ' on' : ''}`} onClick={() => setFiltro('sem')}>Sem macrozona <span className="n">{semMacro}</span></button>}
          {macroSel && (
            <span className="so-macro-sel">Macrozona <b>{macroSel.nome}</b>
              <AcoesLinha nome={`a macrozona ${macroSel.nome}`} onEditar={() => { setMacroEdId(macroSel.id); setNovaMacro(macroSel.nome); }} onExcluir={() => excluirMacro(macroSel)} />
            </span>
          )}
        </div>
      </Cartao>

      <Cartao className="so-rise d1" icone="pin" titulo="Bairros" meta={<><span className="mono">{bairros.length}</span> no total</>} ajuda="Ajuda: Bairros">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <label className="so-ctrl" style={{ flex: '1 1 220px' }}><Ic n="search" /><input type="search" placeholder="Buscar bairro" aria-label="Buscar bairro" value={busca} onChange={e => setBusca(e.target.value)} /></label>
            <button type="button" className="so-btn so-ghost" onClick={() => abrir({ modo: 'colar' })}>Colar lista</button>
            <button type="button" className="so-btn so-primary" onClick={() => abrir({ modo: 'novo' })}><Ic n="plus" />Novo bairro</button>
          </div>
          <div className="so-tw">
            <table className="so-table">
              <thead>
                <tr><th scope="col">Bairro</th><th scope="col">Macrozona</th><th scope="col">No mapa</th><th scope="col" className="r">OS abertas</th><th scope="col"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ações</span></th></tr>
              </thead>
              <tbody>
                {visiveis.map(b => {
                  const marcado = b.lat != null && b.lng != null;
                  return (
                    <tr key={b.id}>
                      <td data-l="Bairro" className="strong">{b.nome}</td>
                      <td data-l="Macrozona">{b.macrozona ?? <span style={{ color: 'var(--amber)', fontWeight: 700 }}>sem macrozona</span>}</td>
                      <td data-l="No mapa"><span className={`so-badge ${marcado ? 'mint' : 'amber'}`}><span className="dot" />{marcado ? 'Marcado' : 'Sem ponto'}</span></td>
                      <td data-l="OS abertas" className="r mono">{b.osAbertas}</td>
                      <td data-l="" className="acoes"><AcoesLinha nome={b.nome} onEditar={() => abrir({ modo: 'editar', bairro: b })} onExcluir={() => removerBairro(b)} /></td>
                    </tr>
                  );
                })}
                {visiveis.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>Nenhum bairro {busca ? 'com esse nome' : 'aqui'}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Aviso tom="plain">Bairro que já tem OS não é apagado: fica inativo e some das listas novas, mas o histórico continua.</Aviso>
      </Cartao>

      {novaMacro !== null && (
        <Janela icone={macroEdId ? 'editar' : 'map'} eyebrow="Lugares · macrozona" titulo={macroEdId ? 'Editar macrozona' : 'Nova macrozona'} sub="Uma região da cidade que agrupa bairros. Ex.: Norte, Sede, Zona rural."
          largura={460} onFechar={fecharMacro} ajuda="Ajuda: Macrozonas"
          rodape={<>
            {macroEdId && macroSel && <button type="button" className="so-btn so-danger esq" onClick={() => { fecharMacro(); excluirMacro(macroSel); }}><Ic n="lixeira" />Excluir</button>}
            <button type="button" className="so-btn so-ghost" onClick={fecharMacro}>Cancelar</button>
            <button type="button" className="so-btn so-primary" onClick={criarMacro}><Ic n="check" />{macroEdId ? 'Salvar macrozona' : 'Criar macrozona'}</button>
          </>}>
          <label className="so-field"><span className="so-lbl">Nome da macrozona <span className="req">*</span></span>
            <span className="so-ctrl"><input type="text" placeholder="Ex.: Norte" value={novaMacro} onChange={e => setNovaMacro(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') criarMacro(); }} /></span>
          </label>
        </Janela>
      )}

      {painel && (
        <Janela key={painel.modo === 'editar' ? painel.bairro.id : painel.modo}
          icone={painel.modo === 'editar' ? 'editar' : painel.modo === 'colar' ? 'list' : 'pin'}
          eyebrow={painel.modo === 'editar' ? `Lugares · ${painel.bairro.macrozona ?? 'sem macrozona'}` : 'Lugares · bairros'}
          titulo={painel.modo === 'editar' ? `Editar ${painel.bairro.nome}` : tituloPainel}
          sub={painel.modo === 'colar' ? 'Cole um bairro por linha. Os que já existem são pulados.' : 'O bairro aparece ao abrir uma OS, nos filtros do painel e na página do munícipe.'}
          largura={painel.modo === 'colar' ? 520 : 620} onFechar={() => setPainel(null)} ajuda={`Ajuda: ${tituloPainel}`}
          rodape={painel.modo === 'colar' ? <>
            <button type="button" className="so-btn so-ghost" onClick={() => setPainel(null)}>Cancelar</button>
            <button type="button" className="so-btn so-primary" disabled={salvando} onClick={colar}><Ic n="check" />Cadastrar todos</button>
          </> : <>
            {painel.modo === 'editar' && <button type="button" className="so-btn so-danger esq" onClick={() => removerBairro(painel.bairro)}><Ic n="lixeira" />Excluir</button>}
            <button type="button" className="so-btn so-ghost" onClick={() => setPainel(null)}>Cancelar</button>
            <button type="button" className="so-btn so-primary" disabled={salvando} onClick={salvarBairro}><Ic n="check" />Salvar bairro</button>
          </>}>
          {painel.modo === 'colar' ? (
            <>
              <label className="so-field"><span className="so-lbl">Bairros <span className="opt">um por linha</span></span>
                <textarea value={lista} onChange={e => setLista(e.target.value)} rows={9} placeholder={'Centro\nSão João\nBarro Vermelho'}
                  style={{ width: '100%', border: '1px solid var(--line-2)', borderRadius: 10, padding: '9px 11px', font: '600 13px var(--font-ui)', color: 'var(--ink)', resize: 'vertical', outline: 'none' }} />
              </label>
              <label className="so-field"><span className="so-lbl">Macrozona de todos</span>
                <span className="so-ctrl"><select value={macroId} onChange={e => setMacroId(e.target.value)}><option value="">Escolher depois</option>{macros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
              </label>
            </>
          ) : (
            <>
              <div className="so-row2">
                <label className="so-field"><span className="so-lbl">Nome do bairro <span className="req">*</span></span>
                  <span className={`so-ctrl${erroNome ? ' invalid' : ''}`}><input type="text" value={nome} onChange={e => { setNome(e.target.value); if (e.target.value.trim()) setErroNome(false); }} onKeyDown={e => { if (e.key === 'Enter') salvarBairro(); }} /></span>
                </label>
                <label className="so-field"><span className="so-lbl">Macrozona <span className="req">*</span></span>
                  <span className="so-ctrl"><select value={macroId} onChange={e => setMacroId(e.target.value)}><option value="" disabled>Escolha…</option>{macros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
                  {macros.length === 0 && <span className="so-help">Crie uma macrozona primeiro (botão "Nova macrozona").</span>}
                </label>
              </div>
              <div className="so-field">
                <span className="so-lbl">Ponto no mapa <span className="opt">opcional</span></span>
                <MapaPonto ponto={ponto} onPonto={setPonto} centro={centroMapa} />
                <p className="so-help">
                  Clique no mapa no meio do bairro. Serve para o painel mostrar onde estão as OS.
                  {ponto && <> <span className="mono" style={{ color: 'var(--brand-ink)' }}>{ponto[0].toFixed(4)} · {ponto[1].toFixed(4)}</span> · <a href="#" onClick={e => { e.preventDefault(); setPonto(null); }}>tirar o ponto</a></>}
                </p>
              </div>
            </>
          )}
        </Janela>
      )}
      <BarraAcoes esquerda={<><b>{macros.length}</b> macrozonas<Sep /><b>{bairros.length}</b> bairros{semPonto > 0 && <><Sep />{semPonto} sem ponto no mapa</>}<Sep />passo 2 de 6</>}>
        <Link to={rotaTenant(entityId, 'cadastros/orgao')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Órgão</Link>
        <Link to={rotaTenant(entityId, 'cadastros/pessoas')} className="so-btn so-primary">Continuar: Pessoas<Ic n="seta" className="arrow" /></Link>
      </BarraAcoes>
      {janelaExclusao}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
