import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { servicosFichaApi } from '../../../lib/api-client';
import type { CampoServico, FichaServico, MomentoCampo, TipoCampo, TipoServico } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import { Aviso, BarraAcoes, Cabecalho, Carregando, Cartao, Ic, Janela, Pagina, Selo, Sep, msgErro, rotaTenant } from '../../components/sisobras/so';
import { CAMPOS_FIXOS, CORES, padroesDoServico } from './servico-padroes';

interface Form {
  nome: string; ativo: boolean; tipoServico: TipoServico; cor: string; prazoDias: string; subtipos: string[];
  municipePode: boolean; nomeMunicipe: string; centroDeCustoId: string; licitacaoIds: string[]; campos: CampoServico[];
}

const TIPO_CAMPO: Record<TipoCampo, string> = { TEXTO: 'Texto curto', LISTA: 'Lista', NUMERO: 'Número', SIM_NAO: 'Sim / Não' };

function paraForm(f: FichaServico): Form {
  const p = padroesDoServico(f.id);
  const salva = !!f.fichaSalvaEm;
  return {
    nome: f.nome, ativo: f.ativo, tipoServico: f.tipoServico ?? p.tipoServico, cor: f.cor ?? p.cor,
    prazoDias: f.prazoDias ? String(f.prazoDias) : '',
    subtipos: salva ? f.subtipos : p.subtipos,
    municipePode: salva ? f.municipePode !== false : p.municipePode,
    nomeMunicipe: (salva ? f.nomeMunicipe : p.nomeMunicipe) ?? '',
    centroDeCustoId: f.centroDeCustoId ?? '',
    licitacaoIds: f.licitacoes.filter(l => l.ligada).map(l => l.id),
    campos: salva ? f.campos.map(c => ({ ...c, detalhe: c.detalhe ?? null })) : p.campos,
  };
}

function iniciais(nome: string) {
  const p = nome.replace(/[[\]]/g, '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

/** Tela 10 · Passo 6 — Ficha do serviço */
export function FichaServicoPage() {
  const { entityId } = useTenant();
  const { servicoId } = useParams<{ servicoId: string }>();
  const { toasts, showToast, closeToast } = useToast();
  const [ficha, setFicha] = useState<FichaServico | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [novoSub, setNovoSub] = useState('');
  /* janela de um campo: i = posição na lista (null = campo novo); c = rascunho */
  const [campoJ, setCampoJ] = useState<{ i: number | null; c: CampoServico } | null>(null);
  const [vincular, setVincular] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!servicoId) return;
    try { const f = await servicosFichaApi.obter(entityId, servicoId); setFicha(f); setForm(paraForm(f)); }
    catch (e) { showToast(msgErro(e, 'Não foi possível abrir a ficha'), 'error'); }
  }, [entityId, servicoId, showToast]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!ficha || !form) return <Pagina><Carregando /></Pagina>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  const setCampo = (i: number, c: Partial<CampoServico>) => set('campos', form.campos.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const centro = ficha.centros.find(c => c.id === form.centroDeCustoId);
  const ligadas = ficha.licitacoes.filter(l => form.licitacaoIds.includes(l.id));
  const livres = ficha.licitacoes.filter(l => !form.licitacaoIds.includes(l.id));
  const salva = !!ficha.fichaSalvaEm;

  function addSub() {
    const v = novoSub.trim();
    if (!v) return;
    if (form!.subtipos.some(s => s.toLowerCase() === v.toLowerCase())) { showToast('Esse subtipo já está na lista', 'warning'); return; }
    set('subtipos', [...form!.subtipos, v]); setNovoSub('');
  }

  async function salvar(ativo = form!.ativo) {
    const f = form!;
    if (f.nome.trim().length < 2) { showToast('Informe o nome do serviço', 'warning'); return; }
    const prazo = f.prazoDias ? Number(f.prazoDias) : null;
    if (prazo !== null && (!Number.isInteger(prazo) || prazo < 1)) { showToast('O prazo precisa ser um número de dias', 'warning'); return; }
    setSalvando(true);
    try {
      const r = await servicosFichaApi.salvar(entityId, ficha!.id, {
        nome: f.nome, ativo, tipoServico: f.tipoServico, cor: f.cor, prazoDias: prazo, subtipos: f.subtipos,
        municipePode: f.municipePode, nomeMunicipe: f.nomeMunicipe || null, centroDeCustoId: f.centroDeCustoId || null,
        licitacaoIds: f.licitacaoIds, campos: f.campos.map(c => ({ ...c, opcoes: c.tipo === 'LISTA' ? c.opcoes : [] })),
      });
      setFicha(r); setForm(paraForm(r)); setCampoJ(null);
      showToast(ativo ? 'Ficha salva' : 'Serviço desativado');
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  const partes: [string, string, string][] = [
    ['identificacao', 'Identificação', 'nome, cor, prazo'],
    ['centro', 'Centro de custo', centro?.codigo ?? 'sem centro'],
    ['contratos', 'Contratos', `${ligadas.length} vinculados`],
    ['quem', 'Quem atende', `${ficha.atendem.length} pessoas`],
    ['formulario', 'O que o fiscal preenche', `${form.campos.length} campos`],
  ];

  return (
    <Pagina>
      <Cabecalho
        rotulo="Ficha do serviço"
        selo={<Selo icone="clipboard" />}
        eyebrow={<><Link to={rotaTenant(entityId, 'cadastros')}>Cadastros</Link> · <Link to={rotaTenant(entityId, 'cadastros/servicos')}>Serviços</Link> · Ficha</>}
        antesTitulo={<span className="so-dotc" style={{ background: form.cor }} />}
        titulo={form.nome || 'Serviço'}
        sub={<>{form.tipoServico === 'CONSTRUCAO' ? 'Construção' : 'Manutenção'} · {centro ? <><span className="mono" style={{ color: 'var(--brand-ink)', fontWeight: 700 }}>{centro.codigo}</span> {centro.nome}</> : 'sem centro de custo'} · {ligadas.length} contratos · {ficha.atendem.length} pessoas atendem</>}
        direita={<label className={`so-toggle${form.ativo ? ' on' : ''}`} style={{ height: 36 }}><input type="checkbox" role="switch" className="so-switch" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} /> {form.ativo ? 'Ativo' : 'Inativo'}</label>}
      >
        <ol className="so-regua c5" aria-label="Partes da ficha">
          {partes.map(([id, nome, sub], i) => (
            <li key={id} className="so-sg"><a href={`#${id}`}><span className="sg-ic n">{i + 1}</span><span className="sg-tx"><b>{nome}</b><small><span>0{i + 1}</span>{sub}</small></span></a></li>
          ))}
        </ol>
      </Cabecalho>

      {!salva && (
        <Aviso tom="amber">Esta ficha <strong>ainda não foi salva</strong>: os valores abaixo são os que o sistema usa hoje para este serviço. Confira e salve para a ficha passar a valer.</Aviso>
      )}

      <Cartao id="identificacao" className="so-rise" icone={<span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>1</span>} titulo="Identificação" ajuda="Ajuda: Identificação" corpoStyle={{ scrollMarginTop: 16 }}>
        <div className="so-fgrid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
          <label className="so-field"><span className="so-lbl">Nome do serviço <span className="req">*</span></span>
            <span className="so-ctrl"><input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} /></span>
          </label>
          <fieldset className="so-field" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="so-lbl" style={{ marginBottom: 5 }}>Tipo</legend>
            <div className="so-seg full">
              <label className={form.tipoServico === 'MANUTENCAO' ? 'on' : ''}><input type="radio" name="tipo" checked={form.tipoServico === 'MANUTENCAO'} onChange={() => set('tipoServico', 'MANUTENCAO')} /> Manutenção</label>
              <label className={form.tipoServico === 'CONSTRUCAO' ? 'on' : ''}><input type="radio" name="tipo" checked={form.tipoServico === 'CONSTRUCAO'} onChange={() => set('tipoServico', 'CONSTRUCAO')} /> Construção</label>
            </div>
          </fieldset>
          <fieldset className="so-field" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="so-lbl" style={{ marginBottom: 5 }}>Cor no mapa e no painel</legend>
            <div className="so-sws">
              {CORES.map(([nome, cor]) => <button key={cor} type="button" className={`so-sw${form.cor.toLowerCase() === cor ? ' on' : ''}`} aria-label={nome} aria-pressed={form.cor.toLowerCase() === cor} style={{ background: cor }} onClick={() => set('cor', cor)} />)}
            </div>
          </fieldset>
          <label className="so-field"><span className="so-lbl">Prazo de atendimento <span className="opt">o padrão geral é {ficha.metaDiasGeral} dias</span></span>
            <span className="so-ctrl num"><input type="number" min={1} placeholder={String(ficha.metaDiasGeral)} aria-label="Prazo em dias" value={form.prazoDias} onChange={e => set('prazoDias', e.target.value)} /><span className="suf">dias</span></span>
          </label>
        </div>

        <div className="so-field" style={{ gap: 7 }}>
          <span className="so-lbl">Subtipos <span className="opt">o fiscal escolhe um ao abrir a OS</span></span>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {form.subtipos.map(s => (
              <span key={s} className="so-subt">{s}<button type="button" aria-label={`Tirar ${s}`} onClick={() => set('subtipos', form.subtipos.filter(x => x !== s))}><Ic n="x" /></button></span>
            ))}
            <input type="text" className="so-subt-add" placeholder="+ adicionar subtipo" aria-label="Novo subtipo" value={novoSub} onChange={e => setNovoSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }} onBlur={addSub} />
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '10px 20px', padding: '12px 14px', borderRadius: 12, background: 'var(--surface-2)', border: '1px dashed var(--line-2)' }}>
          <label className={`so-ckrow${form.municipePode ? ' on' : ''}`} style={{ flex: 'none' }}><input type="checkbox" className="so-ck" checked={form.municipePode} onChange={e => set('municipePode', e.target.checked)} /> <span style={{ fontWeight: 800 }}>O munícipe pode pedir este serviço</span></label>
          <label className="so-field" style={{ flex: '1 1 300px' }}><span className="so-lbl">Como aparece para o munícipe</span>
            <span className={`so-ctrl${!form.municipePode ? ' off' : ''}`}><input type="text" disabled={!form.municipePode} placeholder="Ex.: Lâmpada apagada ou poste com problema" value={form.nomeMunicipe} onChange={e => set('nomeMunicipe', e.target.value)} /></span>
          </label>
        </div>
      </Cartao>

      <Cartao id="centro" className="so-rise d1" icone={<span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>2</span>} titulo="Centro de custo"
        direita={centro ? <span className="so-badge mint"><span className="dot" />definido</span> : <span className="so-badge amber"><span className="dot live" />falta</span>} ajuda="Ajuda: Centro de custo"
        corpoStyle={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 24px' }}>
        <p style={{ flex: '1 1 340px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>Tudo o que for lançado neste serviço — OS e compras — vai para este centro. Se a OS for de uma obra com dinheiro próprio, quem abre pode trocar para o centro da obra.</p>
        <label className="so-field" style={{ flex: '1 1 280px' }}><span className="so-lbl">Centro de custo</span>
          <span className={`so-ctrl${!form.centroDeCustoId ? ' warn' : ''}`}><Ic n="pie" /><select value={form.centroDeCustoId} onChange={e => set('centroDeCustoId', e.target.value)}><option value="">Escolha o centro…</option>{ficha.centros.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
        </label>
      </Cartao>

      <Cartao id="contratos" className="so-rise d2" icone={<span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>3</span>} titulo="Contratos que abastecem este serviço" meta="No orçamento, o fiscal só vê materiais e serviços destes contratos." ajuda="Ajuda: Contratos" corpoStyle={{ gap: 8 }}>
        {ligadas.map(l => {
          const nivel = l.saldoPct == null ? '' : l.saldoPct < 25 ? 'low' : l.saldoPct < 50 ? 'mid' : '';
          return (
            <div key={l.id} className="so-item">
              <span className="so-cic cyan"><Ic n="doc" /></span>
              <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}><span className="mono" style={{ color: 'var(--brand-ink)' }}>{l.identificacao}</span>{l.objeto ? ` · ${l.objeto}` : ''}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {l.contratos.length ? l.contratos.map(c => `Contrato ${c.numero}${c.fornecedor ? ` · ${c.fornecedor}` : ''} · vence ${new Date(`${c.vigenciaAte}T12:00:00`).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}`).join(' · ') : (l.fornecedor ?? 'sem contrato cadastrado')}
                </div>
              </div>
              {l.saldoPct != null && (
                <div className="so-saldo">
                  <div className="t"><span>Saldo</span><b>{l.saldoPct}%</b></div>
                  <div className="bar"><i className={nivel} style={{ width: `${l.saldoPct}%` }} /></div>
                </div>
              )}
              <button type="button" className="so-btn so-ghost sm" onClick={() => set('licitacaoIds', form.licitacaoIds.filter(x => x !== l.id))}>Desvincular</button>
            </div>
          );
        })}
        {!ligadas.length && <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Nenhum contrato vinculado ainda.</p>}
        {livres.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span className="so-ctrl" style={{ flex: '1 1 280px' }}><select value={vincular} onChange={e => setVincular(e.target.value)}><option value="">Escolha a licitação / contrato…</option>{livres.map(l => <option key={l.id} value={l.id}>{l.identificacao}{l.objeto ? ` · ${l.objeto}` : ''}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
            <button type="button" className="so-btn so-dashed" disabled={!vincular} onClick={() => { set('licitacaoIds', [...form.licitacaoIds, vincular]); setVincular(''); }}><Ic n="plus" />Vincular contrato</button>
          </div>
        )}
      </Cartao>

      <Cartao id="quem" className="so-rise d3" icone={<span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>4</span>} titulo="Quem atende" ajuda="Ajuda: Quem atende"
        direita={<>
          <Link to={rotaTenant(entityId, 'cadastros/pessoas')} className="so-btn so-ghost sm">Ajustar em Pessoas</Link>
          <Link to={rotaTenant(entityId, 'cadastros/fluxo')} className="so-btn so-ghost sm">Fluxo e aprovações</Link>
        </>} corpoStyle={{ gap: 10 }}>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>Só para conferir. Quem atende é marcado no cadastro da pessoa; quem aprova e confere, em Fluxo e aprovações.</p>
        <div className="so-people">
          {ficha.atendem.map(a => (
            <span key={a.nome} className="so-person plain"><span className="av">{iniciais(a.nome)}</span><span><b>{a.nome}</b> · {a.perfil.toLowerCase()}{a.equipe ? `, ${a.lider ? 'líder da ' : ''}${a.equipe}` : ''}{a.exclusivo ? '' : ' · atende todos'}</span></span>
          ))}
          {!ficha.atendem.length && <span style={{ fontSize: 12.5, color: 'var(--amber)', fontWeight: 700 }}>Ninguém atende este serviço ainda.</span>}
        </div>
        {ficha.aprovam.length > 0 && <p className="so-help">Aprova e confere: {ficha.aprovam.join(', ')} (e os administradores).</p>}
      </Cartao>

      <Cartao id="formulario" className="so-rise d4" icone={<span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>5</span>} titulo="O que o fiscal preenche" meta="A parte da esquerda vem em toda OS, de qualquer serviço. Você só monta a da direita." ajuda="Ajuda: Campos">
        <div className="so-split">
          <div style={{ flex: '1 1 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div className="so-fs-t">Já vem em toda OS</div>
            <div className="so-fixed">{CAMPOS_FIXOS.map(c => <div key={c}><Ic n="lock" />{c}</div>)}</div>
          </div>
          <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="so-fs-t">Só deste serviço <span className="tag">{form.campos.length} campos</span></div>
            <div className="so-tw">
              <table className="so-table">
                <thead><tr><th scope="col">Campo</th><th scope="col">Tipo</th><th scope="col">Quando</th><th scope="col" className="c">Obrigatório</th><th scope="col"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ações</span></th></tr></thead>
                <tbody>
                  {form.campos.map((c, i) => (
                    <tr key={i}>
                      <td data-l="Campo"><span className="strong">{c.nome || 'Sem nome'}</span><span className="sub">{c.tipo === 'LISTA' && c.opcoes.length ? c.opcoes.filter(Boolean).join(', ') : c.detalhe ?? ''}</span></td>
                      <td data-l="Tipo">{TIPO_CAMPO[c.tipo]}</td>
                      <td data-l="Quando"><span className={`so-badge ${c.momento === 'ABERTURA' ? 'brand' : 'mint'}`}>{c.momento === 'ABERTURA' ? 'Abertura' : 'Baixa'}</span></td>
                      <td data-l="Obrigatório" className="c"><input type="checkbox" className="so-ck" checked={c.obrigatorio} aria-label="Obrigatório" onChange={e => setCampo(i, { obrigatorio: e.target.checked })} /></td>
                      <td data-l="" className="r"><button type="button" className="so-btn so-ghost sm" onClick={() => setCampoJ({ i, c: { ...c, opcoes: [...c.opcoes] } })}>Editar</button></td>
                    </tr>
                  ))}
                  {!form.campos.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 16 }}>Nenhum campo próprio. Só os de toda OS.</td></tr>}
                </tbody>
              </table>
            </div>
            <button type="button" className="so-btn so-dashed" style={{ alignSelf: 'flex-start' }} onClick={() => setCampoJ({ i: null, c: { nome: '', detalhe: null, tipo: 'TEXTO', opcoes: [], momento: 'BAIXA', obrigatorio: false } })}><Ic n="plus" />Adicionar campo</button>
            <p className="so-help" style={{ fontSize: 11.5 }}><strong style={{ color: 'var(--brand-ink)' }}>Abertura</strong> = o fiscal preenche ao registrar a ocorrência. <strong style={{ color: 'var(--mint)' }}>Baixa</strong> = preenche quando termina o serviço, junto com as fotos do depois.</p>
          </div>
        </div>
      </Cartao>

      {campoJ && (() => {
        const c = campoJ.c;
        const muda = (d: Partial<CampoServico>) => setCampoJ({ ...campoJ, c: { ...c, ...d } });
        const guardar = () => {
          if (!c.nome.trim()) { showToast('Dê um nome ao campo', 'warning'); return; }
          if (c.tipo === 'LISTA' && !c.opcoes.some(o => o.trim())) { showToast('Informe as opções da lista', 'warning'); return; }
          const limpo = { ...c, nome: c.nome.trim(), opcoes: c.tipo === 'LISTA' ? c.opcoes.map(o => o.trim()).filter(Boolean) : [] };
          set('campos', campoJ.i === null ? [...form.campos, limpo] : form.campos.map((x, j) => j === campoJ.i ? limpo : x));
          setCampoJ(null);
        };
        return (
          <Janela icone={campoJ.i === null ? 'plus' : 'editar'} eyebrow={`Ficha · ${form.nome}`}
            titulo={campoJ.i === null ? 'Novo campo' : `Editar ${form.campos[campoJ.i]?.nome || 'campo'}`}
            sub="Um campo só deste serviço, que o fiscal preenche na abertura ou na baixa da OS."
            largura={600} onFechar={() => setCampoJ(null)} ajuda="Ajuda: O que o fiscal preenche"
            rodape={<>
              {campoJ.i !== null && <button type="button" className="so-btn so-danger esq" onClick={() => { set('campos', form.campos.filter((_, j) => j !== campoJ.i)); setCampoJ(null); }}>Tirar campo</button>}
              <button type="button" className="so-btn so-ghost" onClick={() => setCampoJ(null)}>Cancelar</button>
              <button type="button" className="so-btn so-primary" onClick={guardar}><Ic n="check" />{campoJ.i === null ? 'Adicionar campo' : 'Guardar campo'}</button>
            </>}>
            <div className="so-row2">
              <label className="so-field"><span className="so-lbl">Nome <span className="req">*</span></span><span className="so-ctrl"><input value={c.nome} placeholder="Ex.: Tipo de luminária" onChange={e => muda({ nome: e.target.value })} /></span></label>
              <label className="so-field"><span className="so-lbl">Explicação <span className="opt">opcional</span></span><span className="so-ctrl"><input value={c.detalhe ?? ''} onChange={e => muda({ detalhe: e.target.value || null })} /></span></label>
            </div>
            <div className="so-row2">
              <label className="so-field"><span className="so-lbl">Tipo</span><span className="so-ctrl"><select value={c.tipo} onChange={e => muda({ tipo: e.target.value as TipoCampo })}>{(Object.keys(TIPO_CAMPO) as TipoCampo[]).map(t => <option key={t} value={t}>{TIPO_CAMPO[t]}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span></label>
              <label className="so-field"><span className="so-lbl">Quando</span><span className="so-ctrl"><select value={c.momento} onChange={e => muda({ momento: e.target.value as MomentoCampo })}><option value="ABERTURA">Abertura</option><option value="BAIXA">Baixa</option></select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span></label>
            </div>
            {c.tipo === 'LISTA' && (
              <label className="so-field"><span className="so-lbl">Opções <span className="opt">separe com vírgula</span></span><span className="so-ctrl"><input value={c.opcoes.join(', ')} placeholder="LED, Sódio, Mista" onChange={e => muda({ opcoes: e.target.value.split(',').map(x => x.trimStart()) })} /></span></label>
            )}
            <label className={`so-ckrow${c.obrigatorio ? ' on' : ''}`}><input type="checkbox" className="so-ck" checked={c.obrigatorio} onChange={e => muda({ obrigatorio: e.target.checked })} /> Obrigatório</label>
            <p className="so-help"><strong style={{ color: 'var(--brand-ink)' }}>Abertura</strong> = o fiscal preenche ao registrar a ocorrência. <strong style={{ color: 'var(--mint)' }}>Baixa</strong> = preenche quando termina o serviço, junto com as fotos do depois.</p>
          </Janela>
        );
      })()}

      <BarraAcoes esquerda={<><span className="so-dotc" style={{ background: form.cor, width: 10, height: 10 }} /><b>{form.nome}</b><Sep />{form.campos.length} campos próprios<Sep />{ligadas.length} contratos</>}>
        <Link to={rotaTenant(entityId, 'cadastros/servicos')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar à lista</Link>
        {ficha.ativo && <button type="button" className="so-btn so-danger" disabled={salvando} onClick={() => { if (window.confirm(`Desativar "${ficha.nome}"? Ele some das listas novas; o histórico continua.`)) void salvar(false); }}>Desativar serviço</button>}
        <button type="button" className="so-btn so-primary" disabled={salvando} onClick={() => salvar()}><Ic n="check" />Salvar ficha</button>
      </BarraAcoes>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
