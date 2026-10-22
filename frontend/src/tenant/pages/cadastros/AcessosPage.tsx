import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { pessoasApi } from '../../../lib/api-client';
import type { AcessosPessoa, ModeloAcesso } from '../../../lib/api-client';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import {
  BarraAcoes, Cabecalho, Carregando, Cartao, Ic, Pagina, Placar, Selinho, Selo, Sep, msgErro, rotaTenant,
} from '../../components/sisobras/so';

const TRAVAS = [
  'Quem revisou um pedido não pode aprovar o mesmo pedido.',
  'Quem deu a baixa de uma OS não pode conferir a própria baixa.',
  'Devolver, recusar, reabrir ou cancelar sempre pede o motivo.',
  'Quem só atende alguns serviços só vê e age nas OS desses serviços.',
];

/** Tela 4b · Acessos do usuário — caixa por caixa, grupos nascem fechados */
export function AcessosPage() {
  const { entityId, session } = useTenant();
  const souAdmin = !!session.adminGeral;
  const { userId } = useParams<{ userId: string }>();
  const { toasts, showToast, closeToast } = useToast();
  const [dados, setDados] = useState<AcessosPessoa | null>(null);
  const [admin, setAdmin] = useState(false);
  const [marc, setMarc] = useState<Set<string>>(new Set());
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [modelo, setModelo] = useState<ModeloAcesso>('FISCAL');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!userId || !souAdmin) return;
    pessoasApi.acessos(entityId, userId).then(d => {
      setDados(d); setAdmin(d.adminGeral); setMarc(new Set(d.acessos));
      if (d.modelos.some(m => m.code === d.usuario.perfil.code)) setModelo(d.usuario.perfil.code as ModeloAcesso);
    }).catch(e => showToast(msgErro(e, 'Não foi possível abrir os acessos'), 'error'));
  }, [entityId, userId, showToast, souAdmin]);

  const total = useMemo(() => dados?.catalogo.reduce((n, m) => n + m.grupos.reduce((k, g) => k + g.itens.length, 0), 0) ?? 0, [dados]);
  /* a chave é só do administrador geral */
  if (!souAdmin) return <Navigate to={rotaTenant(entityId, 'cadastros/pessoas')} replace />;
  if (!dados || !userId) return <Pagina><Carregando /></Pagina>;

  const marcados = admin ? total : marc.size;
  const mudou = admin !== dados.adminGeral || marc.size !== dados.acessos.length || dados.acessos.some(c => !marc.has(c));

  const alterna = (chaves: string[], ligar: boolean) => setMarc(prev => {
    const n = new Set(prev);
    chaves.forEach(c => (ligar ? n.add(c) : n.delete(c)));
    return n;
  });
  const abrirFechar = (chave: string) => setAbertos(prev => { const n = new Set(prev); if (n.has(chave)) n.delete(chave); else n.add(chave); return n; });

  function aplicarModelo() {
    const m = dados!.modelos.find(x => x.code === modelo);
    if (!m) return;
    setAdmin(m.admin); setMarc(new Set(m.chaves));
    showToast(`Caixas do modelo ${m.nome} marcadas. Ajuste e salve.`, 'success');
  }

  async function salvar() {
    setSalvando(true);
    try {
      const d = await pessoasApi.salvarAcessos(entityId, userId!, { adminGeral: admin, acessos: [...marc] });
      setDados(d); setAdmin(d.adminGeral); setMarc(new Set(d.acessos));
      showToast('Acessos salvos');
    } catch (e) { showToast(msgErro(e), 'error'); }
    finally { setSalvando(false); }
  }

  const u = dados.usuario;
  const sub = [u.email, u.equipe ? `Equipe ${u.equipe}` : null, u.atende === null ? 'vê todos os serviços' : u.atende.length ? `atende ${u.atende.join(', ')}` : 'nenhum serviço'].filter(Boolean).join(' · ');

  return (
    <Pagina>
      <Cabecalho
        rotulo="Acessos do usuário"
        selo={<Selo icone="key" />}
        eyebrow={<><Link to={rotaTenant(entityId, 'cadastros')}>Cadastros</Link> · <Link to={rotaTenant(entityId, 'cadastros/pessoas')}>Pessoas</Link> · Editar usuário</>}
        titulo={u.nome}
        extras={<Selinho tom="amber">{admin ? 'Administrador' : u.perfil.nome}</Selinho>}
        sub={sub}
        direita={<Placar n={marcados} de={`de ${total}`} rotulo="acessos marcados" />}
      />

      <nav className="so-tabs" role="tablist" aria-label="Partes do cadastro do usuário">
        <Link to={`${rotaTenant(entityId, 'cadastros/pessoas')}?editar=${userId}`} role="tab" aria-selected="false" className="so-tab"><Ic n="idcard" />Dados</Link>
        <Link to="#" role="tab" aria-selected="true" className="so-tab on"><Ic n="key" />Acessos <span className="n">{marcados}/{total}</span></Link>
      </nav>

      <Cartao className="so-rise" icone="sliders" titulo="Atalhos" meta="comece de um modelo e ajuste caixa por caixa" ajuda="Ajuda: Atalhos"
        corpoStyle={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 18px' }}>
        <label className="so-field" style={{ flex: '0 1 320px' }}><span className="so-lbl">Começar de um modelo</span>
          <span style={{ display: 'flex', gap: 6 }}>
            <span className="so-ctrl" style={{ flex: 1 }}><select value={modelo} onChange={e => setModelo(e.target.value as ModeloAcesso)}>{dados.modelos.map(m => <option key={m.code} value={m.code}>{m.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
            <button type="button" className="so-btn so-ghost" onClick={aplicarModelo}>Aplicar</button>
          </span>
        </label>
        <p className="so-help" style={{ flex: '1 1 240px', fontSize: 12, paddingBottom: 10 }}>O modelo só marca as caixas mais comuns. Depois você marca ou desmarca uma por uma.</p>
        <label className={`so-toggle danger`} style={{ height: 38 }}>
          <input type="checkbox" className="so-ck coral" checked={admin} onChange={e => setAdmin(e.target.checked)} /> Administrador geral — acesso a tudo
        </label>
      </Cartao>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>
          <span className="so-cnt part">{marcados} de {total}</span>acessos marcados{admin ? ' · administrador geral libera tudo' : ''}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="so-btn so-ghost sm" onClick={() => setAbertos(new Set(dados.catalogo.map(m => m.chave)))}>Expandir todos</button>
          <button type="button" className="so-btn so-ghost sm" onClick={() => setAbertos(new Set())}>Recolher todos</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', gap: 10, alignItems: 'start', opacity: admin ? 0.6 : 1 }}>
        {dados.catalogo.map(m => {
          const chaves = m.grupos.flatMap(g => g.itens.map(i => i.chave));
          const n = admin ? chaves.length : chaves.filter(c => marc.has(c)).length;
          const tudo = n === chaves.length;
          const aberto = abertos.has(m.chave);
          return (
            <section key={m.chave} className={`so-acc${aberto ? ' open' : ''}`} aria-label={m.nome}>
              <button type="button" className="so-acc-h" aria-expanded={aberto} onClick={() => abrirFechar(m.chave)}>
                <span className="chev-t"><Ic n="chevDir" /></span>
                <span className="fold"><Ic n="pasta" />{n > 0 && <span className="mk" />}</span>
                <span className="nm">{m.nome}</span>
                <span className={`so-cnt${n === 0 ? '' : tudo ? ' full' : ' part'}`}>{n}/{chaves.length}</span>
              </button>
              {aberto && (
                <div className="so-acc-b">
                  <div className="so-acc-tools">
                    <label className="so-ckrow" style={{ marginRight: 'auto', fontWeight: 800, color: 'var(--ink)' }}>
                      <input type="checkbox" className="so-ck" disabled={admin} checked={tudo} onChange={() => alterna(chaves, !tudo)} /> Acesso total ao menu
                    </label>
                    <button type="button" className="so-btn so-ghost sm" disabled={admin} onClick={() => alterna(chaves, true)}>Selecionar todos</button>
                    <button type="button" className="so-btn so-ghost sm" disabled={admin} onClick={() => alterna(chaves, false)}>Limpar</button>
                  </div>
                  {m.grupos.map(g => (
                    <div key={g.nome} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div className="so-grp-t">{g.nome}{g.fluxo && <span className="so-badge cyan">cada caixa é um passo do fluxograma</span>}</div>
                      {g.itens.map(i => {
                        const on = admin || marc.has(i.chave);
                        return (
                          <label key={i.chave} className={`so-ckrow${on ? ' on' : ''}`}>
                            <input type="checkbox" className="so-ck" disabled={admin} checked={on} onChange={() => alterna([i.chave], !marc.has(i.chave))} />
                            <span>{i.nome}</span>
                            {i.etapa && <span className="et">{i.etapa}</span>}
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Cartao className="warn so-rise d1" icone="lock" tomIcone="amber" titulo="Travas que valem mesmo com a caixa marcada"
        direita={<Selinho tom="amber">fixas</Selinho>} ajuda="Ajuda: Travas" corpoStyle={{ paddingTop: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '6px 14px' }}>
          {TRAVAS.map((t, i) => (
            <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45 }}>
              <span className="so-cnt part" style={{ height: 20, padding: '0 6px' }}>{i + 1}</span>{t}
            </div>
          ))}
        </div>
      </Cartao>

      <BarraAcoes esquerda={<><b>{u.nome}</b><Sep /><b>{marcados}</b> de {total} acessos marcados{mudou && <><Sep /><span style={{ color: 'var(--amber)', fontWeight: 800 }}>alterações não salvas</span></>}</>}>
        <Link to={`${rotaTenant(entityId, 'cadastros/pessoas')}?editar=${userId}`} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Dados</Link>
        <button type="button" className="so-btn so-primary" disabled={salvando || !mudou} onClick={salvar}><Ic n="check" />Salvar acessos</button>
      </BarraAcoes>
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
