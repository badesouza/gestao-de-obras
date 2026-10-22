import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { pessoasApi } from '../../../lib/api-client';
import type { LinkGerado, ListaPessoas, ModeloAcesso, Pessoa, SituacaoPessoa } from '../../../lib/api-client';
import { formatPhone } from '../../../lib/masks';
import { useTenant } from '../../TenantContext';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../../components/Toast';
import { LinkGeradoDialog } from '../../components/sisobras/LinkGeradoDialog';
import {
  AcoesLinha, Aviso, BarraAcoes, CabecalhoPasso, Carregando, Cartao, Ic, Janela, Pagina, Sep, msgErro, rotaTenant, useConfirmarExclusao, useResumoCadastros,
} from '../../components/sisobras/so';

const SITUACAO: Record<SituacaoPessoa, { texto: string; tom: string; link: string }> = {
  ATIVO: { texto: 'Ativo', tom: 'mint', link: 'Novo link de senha' },
  LINK_ENVIADO: { texto: 'Link enviado', tom: 'cyan', link: 'Reenviar o link' },
  LINK_VENCIDO: { texto: 'Link vencido', tom: 'amber', link: 'Gerar novo link' },
  INATIVO: { texto: 'Inativo', tom: '', link: '' },
};
const TOM_PERFIL: Record<string, string> = { ADMIN: 'ink', SECRETARIO: 'ink', COORDENADOR: 'brand', ENGINEER: 'mint', FISCAL: 'amber', COMPRAS: 'cyan', CONSULTA: '' };

interface Form {
  nome: string; email: string; celular: string; modelo: ModeloAcesso;
  equipeIds: string[]; liderEquipeId: string; servicoIds: string[];
}
const VAZIO: Form = { nome: '', email: '', celular: '', modelo: 'FISCAL', equipeIds: [], liderEquipeId: '', servicoIds: [] };

function paraForm(p: Pessoa): Form {
  return {
    nome: p.nome, email: p.email, celular: p.celular ? formatPhone(p.celular) : '', modelo: p.perfil.code as ModeloAcesso,
    equipeIds: p.equipes.map(e => e.id), liderEquipeId: p.liderDe ?? '', servicoIds: p.atende?.map(s => s.id) ?? [],
  };
}

/** Tela 4 · Passo 3 — Pessoas (usuários) */
export function PessoasPage() {
  const { entityId, session } = useTenant();
  const { resumo, recarregar } = useResumoCadastros();
  const { toasts, showToast, closeToast } = useToast();
  const [busca, setBusca] = useState('');
  const [params, setParams] = useSearchParams();
  const [dados, setDados] = useState<ListaPessoas | null>(null);
  const [filtro, setFiltro] = useState('todos');
  const [editando, setEditando] = useState<Pessoa | null | 'novo'>(null);
  const [form, setForm] = useState<Form>(VAZIO);
  const [erros, setErros] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState(false);
  const [link, setLink] = useState<{ dados: LinkGerado; novo: boolean } | null>(null);
  const { confirmar, janelaExclusao } = useConfirmarExclusao();

  const carregar = useCallback(async () => {
    try { setDados(await pessoasApi.listar(entityId)); }
    catch (e) { showToast(msgErro(e, 'Não foi possível abrir as pessoas'), 'error'); }
  }, [entityId, showToast]);
  useEffect(() => { carregar(); }, [carregar]);

  // ?editar=<id> abre a pessoa no painel
  useEffect(() => {
    const id = params.get('editar');
    if (!id || !dados) return;
    const p = dados.usuarios.find(u => u.id === id);
    if (p) { setEditando(p); setForm(paraForm(p)); }
  }, [params, dados]);

  if (!dados) return <Pagina><Carregando /></Pagina>;

  const avisoEquipes = resumo?.passos.find(p => p.n === 3)?.aviso ?? null;
  const visiveis = dados.usuarios.filter(u =>
    (filtro === 'todos' || u.perfil.code === filtro) &&
    (!busca.trim() || `${u.nome} ${u.email}`.toLowerCase().includes(busca.trim().toLowerCase())));
  const modelo = dados.modelos.find(m => m.code === form.modelo);
  const pessoaEditada = editando && editando !== 'novo' ? editando : null;
  /* ver todos os serviços é caixa dos Acessos; o modelo Administrador já vem com ela */
  const veTodos = pessoaEditada && form.modelo === pessoaEditada.perfil.code ? pessoaEditada.atende === null : form.modelo === 'ADMIN';
  /* toda pessoa tem 1+ equipes, menos Administrador, Secretário(a) e Coordenador */
  const precisaEquipe = !modelo?.semEquipe;

  function fechar() {
    setEditando(null); setErros({});
    if (params.get('editar')) { params.delete('editar'); setParams(params, { replace: true }); }
  }
  function abrirNovo() { fechar(); setEditando('novo'); setForm(VAZIO); }
  function abrir(p: Pessoa) {
    setEditando(p); setForm(paraForm(p)); setErros({});
    setParams({ editar: p.id }, { replace: true });
  }
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  async function salvar() {
    const e: Record<string, boolean> = {};
    if (form.nome.trim().length < 2) e.nome = true;
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = true;
    if (precisaEquipe && !form.equipeIds.length) e.equipes = true;
    setErros(e);
    if (e.equipes && Object.keys(e).length === 1) { showToast('Escolha pelo menos uma equipe', 'warning'); return; }
    if (Object.keys(e).length) { showToast('Confira os campos em vermelho', 'warning'); return; }
    setSalvando(true);
    const d = {
      nome: form.nome, email: form.email, celular: form.celular || null, modelo: form.modelo,
      equipeIds: form.equipeIds, liderEquipeId: form.equipeIds.includes(form.liderEquipeId) ? form.liderEquipeId : null, servicoIds: form.servicoIds,
    };
    try {
      if (pessoaEditada) {
        await pessoasApi.atualizar(entityId, pessoaEditada.id, d);
        showToast('Pessoa salva');
      } else {
        const r = await pessoasApi.criar(entityId, d);
        setLink({ dados: r, novo: true });
        setForm(VAZIO);
      }
      fechar();
      await carregar(); recarregar();
    } catch (err) { showToast(msgErro(err), 'error'); }
    finally { setSalvando(false); }
  }

  async function novoLink(p: Pessoa) {
    try { setLink({ dados: await pessoasApi.gerarLink(entityId, p.id), novo: false }); await carregar(); }
    catch (err) { showToast(msgErro(err), 'error'); }
  }

  async function mudarSituacao(p: Pessoa, ativar: boolean) {
    try {
      await pessoasApi.situacao(entityId, p.id, ativar);
      showToast(ativar ? 'Pessoa ativada' : 'Pessoa desativada');
      await carregar(); recarregar(); fechar();
    } catch (err) { showToast(msgErro(err), 'error'); }
  }
  function alternarSituacao(p: Pessoa) {
    if (p.situacao === 'INATIVO') { void mudarSituacao(p, true); return; }
    confirmar({ oque: 'acesso', nome: p.nome, rotuloBotao: 'Desativar', texto: 'A pessoa não consegue mais entrar. O cadastro e o histórico continuam; dá para ativar de novo depois.', acao: () => mudarSituacao(p, false) });
  }
  function excluir(p: Pessoa) {
    confirmar({
      oque: 'usuário', nome: p.nome,
      texto: 'Se a pessoa nunca entrou no sistema, o cadastro é apagado. Se já entrou, fica desativada e o histórico do que ela fez continua.',
      acao: async () => {
        try {
          const r = await pessoasApi.excluir(entityId, p.id);
          showToast(r.desativado ? 'Já tinha entrado no sistema: ficou desativada e o histórico continua' : 'Usuário excluído', r.desativado ? 'warning' : 'success');
          await carregar(); recarregar(); fechar();
        } catch (err) { showToast(msgErro(err), 'error'); }
      },
    });
  }

  const tituloPainel = pessoaEditada ? 'Editar usuário' : 'Novo usuário';

  return (
    <Pagina>
      <CabecalhoPasso passo={3} resumo={resumo} sub="Quem entra no sistema (usuários) e quem vai a campo (equipes)." />

      <nav className="so-tabs" role="tablist" aria-label="Partes do passo Pessoas">
        <Link to={rotaTenant(entityId, 'cadastros/pessoas')} role="tab" aria-selected="true" className="so-tab on"><Ic n="user" />Usuários <span className="n">{dados.usuarios.length}</span></Link>
        <Link to={rotaTenant(entityId, 'cadastros/equipes')} role="tab" aria-selected="false" className="so-tab"><Ic n="hardhat" />Equipes <span className="n">{dados.equipes.length}</span>{avisoEquipes && <span className="w">{avisoEquipes.replace(/ equipes?/, '')}</span>}</Link>
      </nav>

      <Cartao className="so-rise" icone="users" titulo="Usuários" meta={<><span className="mono">{dados.usuarios.filter(u => u.situacao !== 'INATIVO').length}</span> ativos</>} ajuda="Ajuda: Usuários">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <label className="so-ctrl" style={{ flex: '1 1 200px' }}><Ic n="search" /><input type="search" placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuário" value={busca} onChange={e => setBusca(e.target.value)} /></label>
            <button type="button" className="so-btn so-primary" onClick={abrirNovo}><Ic n="plus" />Novo usuário</button>
          </div>
          <div className="so-chips">
            <button type="button" className={`so-chip${filtro === 'todos' ? ' on' : ''}`} onClick={() => setFiltro('todos')}>Todos <span className="n">{dados.usuarios.length}</span></button>
            {dados.filtros.map(f => (
              <button key={f.code} type="button" className={`so-chip${filtro === f.code ? ' on' : ''}`} onClick={() => setFiltro(f.code)}>{f.nome} <span className="n">{f.qtd}</span></button>
            ))}
          </div>
          <div className="so-tw">
            <table className="so-table">
              <thead><tr><th scope="col">Nome</th><th scope="col">Perfil</th><th scope="col">Equipe · atende</th><th scope="col">Acesso</th><th scope="col" className="r">Link de senha</th><th scope="col"><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Ações</span></th></tr></thead>
              <tbody>
                {visiveis.map(u => {
                  const sit = SITUACAO[u.situacao];
                  return (
                    <tr key={u.id} className={pessoaEditada?.id === u.id ? 'sel' : ''}>
                      <td data-l="Nome"><button type="button" className="so-link-nome" onClick={() => abrir(u)}>{u.nome}</button>{u.id === session.id && <span className="so-badge" style={{ marginLeft: 6 }}>você</span>}<span className="sub">{u.email}</span></td>
                      <td data-l="Perfil"><span className={`so-badge ${TOM_PERFIL[u.perfil.code] ?? ''}`}>{u.adminGeral ? 'Administrador' : u.perfil.nome}</span></td>
                      <td data-l="Equipe · atende"><span style={{ fontWeight: 700, color: 'var(--ink-2)' }}>{u.equipes.length ? u.equipes.map(q => `${q.nome}${u.liderDe === q.id ? ' (líder)' : ''}`).join(', ') : '—'}</span><span className="sub">{u.atende === null ? 'vê todos os serviços' : u.atende.length ? `atende ${u.atende.map(s => s.nome).join(', ')}` : 'nenhum serviço'}</span></td>
                      <td data-l="Acesso"><span className={`so-badge ${sit.tom}`}><span className="dot" />{sit.texto}</span></td>
                      <td data-l="Link de senha" className="r">{sit.link && <button type="button" className="so-btn so-ghost sm" onClick={() => novoLink(u)}>{sit.link}</button>}</td>
                      <td data-l="" className="acoes"><AcoesLinha nome={u.nome} onEditar={() => abrir(u)} onExcluir={u.id !== session.id ? () => excluir(u) : undefined} /></td>
                    </tr>
                  );
                })}
                {!visiveis.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>Ninguém encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
      </Cartao>

      {editando && (
        <Janela key={pessoaEditada?.id ?? 'novo'} icone={pessoaEditada ? 'editar' : 'userPlus'}
          eyebrow={pessoaEditada ? `Pessoas · ${pessoaEditada.email}` : 'Pessoas · usuários'}
          titulo={pessoaEditada ? `Editar ${pessoaEditada.nome}` : tituloPainel}
          sub={pessoaEditada ? 'Dados, modelo de acesso, equipe e serviços que a pessoa atende.' : 'Quem entra no sistema. Ao cadastrar, sai um link para a pessoa criar a própria senha.'}
          largura={760} onFechar={fechar} ajuda={`Ajuda: ${tituloPainel}`}
          rodape={<>
            {pessoaEditada && pessoaEditada.id !== session.id && (
              <button type="button" className="so-btn so-danger esq" onClick={() => alternarSituacao(pessoaEditada)}>
                {pessoaEditada.situacao === 'INATIVO' ? 'Ativar' : 'Desativar'}
              </button>
            )}
            <button type="button" className="so-btn so-ghost" onClick={fechar}>Cancelar</button>
            <button type="button" className="so-btn so-primary" disabled={salvando} onClick={salvar}>
              {pessoaEditada ? <><Ic n="check" />Salvar</> : <>Cadastrar e gerar link<Ic n="seta" className="arrow" /></>}
            </button>
          </>}>
          <div className="so-row2">
            <label className="so-field"><span className="so-lbl">Nome completo <span className="req">*</span></span>
              <span className={`so-ctrl${erros.nome ? ' invalid' : ''}`}><input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} /></span>
            </label>
            <label className="so-field"><span className="so-lbl">E-mail <span className="req">*</span> <span className="opt">é o login</span></span>
              <span className={`so-ctrl${erros.email ? ' invalid' : ''}`}><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></span>
            </label>
          </div>
          <div className="so-row2">
            <label className="so-field"><span className="so-lbl">Celular (WhatsApp)</span>
              <span className="so-ctrl mono"><input type="tel" placeholder="(75) 90000-0000" value={form.celular} onChange={e => set('celular', formatPhone(e.target.value))} /></span>
            </label>
            <label className="so-field"><span className="so-lbl">Líder de <span className="opt">uma das equipes dela</span></span>
              <span className="so-ctrl"><select value={form.equipeIds.includes(form.liderEquipeId) ? form.liderEquipeId : ''} disabled={!form.equipeIds.length} onChange={e => set('liderEquipeId', e.target.value)}><option value="">Não é líder</option>{dados.equipes.filter(q => form.equipeIds.includes(q.id)).map(q => <option key={q.id} value={q.id}>{q.nome}</option>)}</select><svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></span>
            </label>
          </div>

          <fieldset className="so-field" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="so-lbl" style={{ marginBottom: 6 }}>Modelo de acesso <span className="opt">marca as caixas; você ajusta na aba Acessos</span></legend>
            <div className="so-opts c2">
              {dados.modelos.filter(m => m.existe).map(m => (
                <label key={m.code} className={`so-opt${form.modelo === m.code ? ' on' : ''}`}>
                  <input type="radio" name="modelo" checked={form.modelo === m.code} onChange={() => set('modelo', m.code)} />
                  <span className="mt"><Ic n="shieldCheck" /></span>
                  <span className="tx"><b>{m.nome}</b><small>{m.descricao}</small></span>
                  <span className="mc"><Ic n="check" /></span>
                </label>
              ))}
            </div>
            {pessoaEditada ? (
              <Link to={rotaTenant(entityId, `cadastros/pessoas/${pessoaEditada.id}/acessos`)} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>
                Ver e ajustar os acessos <span className="so-cnt part">{pessoaEditada.marcados} de {pessoaEditada.total} marcados</span><Ic n="seta" style={{ width: 14, height: 14 }} />
              </Link>
            ) : (
              <span className="so-help" style={{ marginTop: 6 }}>O modelo {modelo?.nome} marca {modelo?.marcados ?? 0} de {dados.totalCaixas} caixas. Depois de cadastrar, você ajusta uma por uma na aba Acessos.</span>
            )}
            {pessoaEditada && form.modelo !== pessoaEditada.perfil.code && <span className="so-help" style={{ color: 'var(--amber)', fontWeight: 700 }}>Trocar o modelo marca de novo as caixas dele ao salvar.</span>}
          </fieldset>


          <fieldset className="so-field" style={{ border: 0, margin: 0, padding: 0, gap: 8 }}>
            <legend className="so-lbl" style={{ marginBottom: 6 }}>Equipes {precisaEquipe ? <span className="req">*</span> : <span className="opt">opcional para {modelo?.nome}</span>}</legend>
            <div className="so-tags">
              {dados.equipes.map(q => {
                const on = form.equipeIds.includes(q.id);
                return (
                  <button key={q.id} type="button" className={`so-tag btn${on ? ' on' : ''}`} aria-pressed={on}
                    onClick={() => { set('equipeIds', on ? form.equipeIds.filter(x => x !== q.id) : [...form.equipeIds, q.id]); setErros(er => ({ ...er, equipes: false })); }}>
                    {on && <Ic n="check" />}{q.nome}
                  </button>
                );
              })}
            </div>
            {erros.equipes
              ? <p className="so-help" style={{ color: 'var(--rose, #e11d48)', fontWeight: 700 }}>Escolha pelo menos uma equipe. Só Administrador, Secretário(a) e Coordenador ficam sem equipe.</p>
              : <p className="so-help">A pessoa só vê as OS das equipes marcadas, dentro dos serviços que atende.</p>}
          </fieldset>

          <fieldset className="so-field" style={{ border: 0, margin: 0, padding: 0, gap: 8 }}>
            <legend className="so-lbl" style={{ marginBottom: 6 }}>Serviços que atende</legend>
            <div className="so-tags">
              {dados.servicos.map(s => {
                const on = form.servicoIds.includes(s.id);
                return (
                  <button key={s.id} type="button" className={`so-tag btn${on ? ' on' : ''}`} aria-pressed={on}
                    onClick={() => set('servicoIds', on ? form.servicoIds.filter(x => x !== s.id) : [...form.servicoIds, s.id])}>
                    {on && <Ic n="check" />}{s.nome}
                  </button>
                );
              })}
            </div>
            {veTodos
              ? <p className="so-help">Tem a caixa <b>Ver todos os serviços</b> nos Acessos: vê e abre OS de todos.</p>
              : form.servicoIds.length
                ? <p className="so-help">Só vê e abre OS dos serviços marcados. Para ver todos, marque a caixa <b>Ver todos os serviços</b> nos Acessos.</p>
                : <p className="so-help" style={{ color: 'var(--amber)', fontWeight: 700 }}>Nenhum serviço marcado: a pessoa não vê OS de serviço nenhum.</p>}
          </fieldset>

          {!pessoaEditada && (
            <Aviso icone="link">Não tem campo de senha: ao cadastrar, o sistema gera um <strong>link</strong> para a pessoa criar a própria senha. Você envia por WhatsApp ou e-mail.</Aviso>
          )}
        </Janela>
      )}
      <BarraAcoes esquerda={<><b>{dados.usuarios.length}</b> usuários<Sep /><b>{dados.equipes.length}</b> equipes<Sep />passo 3 de 7</>}>
        <Link to={rotaTenant(entityId, 'cadastros/lugares')} className="so-btn so-ghost"><Ic n="voltar" className="back" />Voltar: Lugares</Link>
        <Link to={rotaTenant(entityId, 'cadastros/equipes')} className="so-btn so-primary">Continuar: Equipes<Ic n="seta" className="arrow" /></Link>
      </BarraAcoes>
      {janelaExclusao}
      {link && <LinkGeradoDialog dados={link.dados} novo={link.novo} onFechar={() => setLink(null)} />}
      <ToastContainer toasts={toasts} onClose={closeToast} />
    </Pagina>
  );
}
