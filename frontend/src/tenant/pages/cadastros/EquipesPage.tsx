import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { equipesCampoApi } from '../../../lib/api-client';
import type { EquipeCampo, ListaEquipes } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import {
  Ajuda, BarraAcoes, CabecalhoPasso, Carregando, Cartao, Ic, Pagina, Sep, msgErro, rotaTenant, useResumoCadastros,
} from '../../components/sisobras/so';

function iniciais(nome: string) {
  const p = nome.replace(/[[\]]/g, '').trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

/** Tela 5 · Passo 3 — Pessoas (equipes): 1 líder com login + membros sem login */
export function EquipesPage() {
  const { entityId } = useTenant();
  const { resumo, recarregar } = useResumoCadastros();
  const { toasts, showToast, closeToast } = useToast();
  const [dados, setDados] = useState<ListaEquipes | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [lider, setLider] = useState('');
  const [veiculo, setVeiculo] = useState('');
  const [mNome, setMNome] = useState('');
  const [mFuncao, setMFuncao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [nova, setNova] = useState<string | null>(null);
  const [totalUsuarios, setTotalUsuarios] = useState<number | null>(null);

  const carregar = useCallback(async (manter?: string | null) => {
    try {
      const d = await equipesCampoApi.listar(entityId);
      setDados(d); setTotalUsuarios(d.lideres.length);
      const alvo = d.equipes.find(e => e.id === (manter ?? selId)) ?? d.equipes.find(e => !e.lider) ?? d.equipes[0] ?? null;
      if (alvo) escolher(alvo);
      else setSelId(null);
    } catch (e) { showToast(msgErro(e, 'Não foi possível abrir as equipes'), 'error'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, showToast]);
  useEffect(() => { carregar(); }, [carregar]);

  function escolher(e: EquipeCampo) {
    setSelId(e.id); setNome(e.nome); setLider(e.lider?.id ?? ''); setVeiculo(e.veiculo?.id ?? ''); setMNome(''); setMFuncao('');
  }

  if (!dados) return <Pagina><Carregando /></Pagina>;
  const sel = dados.equipes.find(e => e.id === selId) ?? null;
  const semLider = dados.equipes.filter(e => !e.lider).length;

  async function salvar() {
    if (!sel) return;
    if (!nome.trim()) { showToast('Informe o nome da equipe', 'warning'); return; }
    setSalvando(true);
    try {
      await equipesCampoApi.salvar(entityId, sel.id, { nome, liderUserId: lider || null, veiculoId: veiculo || null });
      showToast('Equipe salva'); await carregar(sel.id); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  async function criar() {
    if (!nova?.trim()) return;
    try {
      const r = await equipesCampoApi.criar(entityId, nova);
      setNova(null); showToast('Equipe criada'); await carregar(r.id); recarregar();
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  async function addMembro() {
    if (!sel || !mNome.trim()) { showToast('Informe o nome do membro', 'warning'); return; }
    try {
      await equipesCampoApi.adicionarMembro(entityId, sel.id, { nome: mNome, funcao: mFuncao });
      setMNome(''); setMFuncao(''); await carregar(sel.id);
    } catch (e) { showToast(msgErro(e), 'error'); }
  }

  async function tirarMembro(id: string) {
    if (!sel) return;
    try { await equipesCampoApi.removerMembro(entityId, id); await carregar(sel.id); }
    catch (e) { showToast(msgErro(e), 'error'); }
  }

  async function removerEquipe() {
    if (!sel || !window.confirm(`Tirar a equipe "${sel.nome}" da lista? As OS antigas continuam com o nome dela.`)) return;
    try { await equipesCampoApi.remover(entityId, sel.id); showToast('Equipe removida'); setSelId(null); await carregar(null); recarregar(); }
    catch (e) { showToast(msgErro(e), 'error'); }
  }

  return (
    <Pagina>
      <CabecalhoPasso passo={3} resumo={resumo} sub="Quem entra no sistema (usuários) e quem vai a campo (equipes)." />

      <nav className="so-tabs" role="tablist" aria-label="Partes do passo Pessoas">
        <Link to={rotaTenant(entityId, 'cadastros/pessoas')} role="tab" aria-selected="false" className="so-tab"><Ic n="user" />Usuários {totalUsuarios != null && <span className="n">{totalUsuarios}</span>}</Link>
        <Link to="#" role="tab" aria-selected="true" className="so-tab on"><Ic n="hardhat" />Equipes <span className="n">{dados.equipes.length}</span>{semLider > 0 && <span className="w">{semLider} sem líder</span>}</Link>
      </nav>

      <div className="so-split">
        <Cartao className="grow so-rise" icone="hardhat" titulo="Equipes"
          meta={<><span className="mono">{dados.equipes.length}</span> equipes{semLider > 0 && <> · <span style={{ color: 'var(--amber)', fontWeight: 800 }}>{semLider} sem líder</span></>}</>}
          direita={<button type="button" className="so-btn so-primary sm" onClick={() => setNova('')}><Ic n="plus" />Nova equipe</button>} ajuda="Ajuda: Equipes">
          <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>Cada equipe tem <strong style={{ color: 'var(--ink)' }}>um líder</strong> (usuário do sistema) e seus <strong style={{ color: 'var(--ink)' }}>membros</strong>, que não precisam de login.</p>
          {nova !== null && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span className="so-ctrl" style={{ flex: '1 1 220px', maxWidth: 360 }}><input autoFocus placeholder="Nome da equipe (ex.: Iluminação 2)" value={nova} onChange={e => setNova(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') criar(); if (e.key === 'Escape') setNova(null); }} /></span>
              <button type="button" className="so-btn so-primary" onClick={criar}><Ic n="check" />Criar</button>
              <button type="button" className="so-btn so-ghost" onClick={() => setNova(null)}>Cancelar</button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))', gap: 10 }}>
            {dados.equipes.map(e => (
              <article key={e.id} className={`so-card${!e.lider ? ' warn' : ''}${e.id === selId ? ' so-panel' : ''}`} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`so-cic ${e.lider ? 'mint' : 'amber'}`}><Ic n="hardhat" /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{e.nome}</h3>
                    <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{e.membros.length} membros</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span className="so-k">Líder</span>
                  {e.lider
                    ? <span className="so-person plain" style={{ alignSelf: 'flex-start' }}><span className="av">{iniciais(e.lider.nome)}</span><b>{e.lider.nome}</b></span>
                    : <div className="so-warnline"><Ic n="alerta" />Sem líder — escolha um</div>}
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>{e.membros.length ? e.membros.map(m => m.funcao ? `${m.nome} (${m.funcao.toLowerCase()})` : m.nome).join(', ') : 'Nenhum membro ainda.'}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
                  <span className="so-tag"><Ic n="truck" style={{ width: 13, height: 13 }} />{e.veiculo?.nome ?? 'Sem veículo'}</span>
                  <button type="button" className="so-btn so-ghost sm" onClick={() => escolher(e)}>Editar</button>
                </div>
              </article>
            ))}
            {!dados.equipes.length && <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Nenhuma equipe ainda. Crie a primeira no botão "Nova equipe".</p>}
          </div>
        </Cartao>

        {sel && (
          <section className="so-panel side" aria-label="Editar equipe" key={sel.id}>
            <header className="so-chead">
              <span className="so-cic"><Ic n="editar" /></span>
              <h2>Editar equipe</h2>
              <div className="right"><Ajuda texto="Ajuda: Editar equipe" /><button type="button" className="so-x" aria-label="Fechar" onClick={() => setSelId(null)}><Ic n="x" /></button></div>
            </header>
            <div className="so-cbody">
              <label className="so-field"><span className="so-lbl">Nome da equipe <span className="req">*</span></span>
                <span className="so-ctrl"><input type="text" value={nome} onChange={e => setNome(e.target.value)} /></span>
              </label>
              <label className="so-field"><span className="so-lbl">Líder <span className="opt">um fiscal ou coordenador</span></span>
                <span className={`so-ctrl${!lider ? ' warn' : ''}`}><select value={lider} onChange={e => setLider(e.target.value)}><option value="">Escolha o líder…</option>{dados.lideres.map(l => <option key={l.id} value={l.id}>{l.nome} ({l.perfil})</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
              </label>

              <div className="so-field" style={{ gap: 6 }}>
                <span className="so-lbl">Membros <span className="opt">não entram no sistema</span></span>
                {sel.membros.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 6px 6px 8px', border: '1px solid var(--line)', borderRadius: 11, background: 'var(--surface-2)' }}>
                    <span className="so-person plain" style={{ border: 0, background: 'transparent', padding: 0, height: 'auto' }}><span className="av" style={{ width: 26, height: 26 }}>{iniciais(m.nome)}</span></span>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{m.nome}</div>{m.funcao && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.funcao}</div>}</div>
                    <button type="button" className="so-x" aria-label={`Tirar ${m.nome} da equipe`} style={{ width: 26, height: 26 }} onClick={() => tirarMembro(m.id)}><Ic n="x" /></button>
                  </div>
                ))}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span className="so-ctrl" style={{ flex: '1 1 110px' }}><input type="text" placeholder="Nome" aria-label="Nome do novo membro" value={mNome} onChange={e => setMNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addMembro(); }} /></span>
                  <span className="so-ctrl" style={{ flex: '1 1 90px' }}><input type="text" placeholder="Função" aria-label="Função do novo membro" value={mFuncao} onChange={e => setMFuncao(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addMembro(); }} /></span>
                  <button type="button" className="so-btn so-dashed" onClick={addMembro}><Ic n="plus" />Adicionar</button>
                </div>
                <p className="so-help">Na baixa da OS, o fiscal marca quem da equipe trabalhou.</p>
              </div>

              <label className="so-field"><span className="so-lbl">Veículo da equipe <span className="opt">opcional · vem do passo 4</span></span>
                <span className="so-ctrl"><select value={veiculo} onChange={e => setVeiculo(e.target.value)}><option value="">Nenhum</option>{dados.veiculos.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
              </label>

              <div className="so-pfoot">
                <button type="button" className="so-btn so-danger" style={{ marginRight: 'auto' }} onClick={removerEquipe}>Remover</button>
                <button type="button" className="so-btn so-ghost" onClick={() => escolher(sel)}>Cancelar</button>
                <button type="button" className="so-btn so-primary" disabled={salvando} onClick={salvar}><Ic n="check" />Salvar equipe</button>
              </div>
            </div>
          </section>
        )}
      </div>

      <BarraAcoes esquerda={<><b>{dados.equipes.length}</b> equipes{semLider > 0 && <><Sep /><span style={{ color: 'var(--amber)', fontWeight: 800 }}>{semLider} sem líder</span></>}<Sep />passo 3 de 6</>}>
        <Link to={rotaTenant(entityId, 'cadastros/pessoas')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Usuários</Link>
        <Link to={rotaTenant(entityId, 'cadastros-auxiliares')} className="so-btn so-primary">Continuar: Veículos e equipamentos<Ic n="seta" className="arrow" /></Link>
      </BarraAcoes>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
