import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { linkAcessoApi, setTenantToken } from '../lib/api-client';
import type { LinkPublico } from '../lib/api-client';
import { Aviso, Ic, Selo, msgErro } from '../tenant/components/sisobras/so';

function Cabeca({ link }: { link: LinkPublico | null }) {
  const e = link?.entidade;
  return (
    <header className="so-ph-head">
      {e?.brasaoUrl
        ? <div className="so-selo" role="img" aria-label="Brasão do município"><span className="cm tl" /><span className="cm tr" /><span className="cm br" /><span className="cm bl" /><img src={e.brasaoUrl} alt="" style={{ position: 'absolute', inset: 12, width: 'calc(100% - 24px)', height: 'calc(100% - 24px)', objectFit: 'contain', zIndex: 2 }} /></div>
        : <Selo icone="shield" rotulo="Brasão do município" />}
      <div className="so-ph-org">Prefeitura Municipal de {e?.municipio ?? '…'}</div>
      <div className="so-ph-app">Gestão de Obras</div>
    </header>
  );
}

/** Página pública do link: criar a senha (ou aviso de link vencido) */
export function LinkAcessoPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [link, setLink] = useState<LinkPublico | null>(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [senha, setSenha] = useState('');
  const [repete, setRepete] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!token) return;
    linkAcessoApi.consultar(token).then(setLink).catch(() => setErroCarga(true));
  }, [token]);

  const min6 = senha.length >= 6;
  const iguais = senha.length > 0 && senha === repete;

  async function criar() {
    if (!token || !min6 || !iguais) return;
    setEnviando(true); setErro('');
    try {
      const r = await linkAcessoApi.criarSenha(token, senha);
      setTenantToken(r.entityId, r.token);
      navigate(`/t/${r.entityId}`, { replace: true });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 410) setLink(l => (l ? { ...l, valido: false } : l));
      else setErro(msgErro(e, 'Não foi possível criar a senha'));
    } finally { setEnviando(false); }
  }

  const tela = (conteudo: React.ReactNode) => (
    <div className="so" style={{ minHeight: '100dvh', display: 'flex', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="so-phone" style={{ width: 'min(100%, 440px)', minHeight: '100dvh' }}>
        <Cabeca link={link} />
        {conteudo}
      </div>
    </div>
  );

  if (!link && !erroCarga) return tela(<div className="so-ph-body"><p className="lead">Abrindo…</p></div>);

  if (erroCarga || !link?.valido) {
    return tela(
      <div className="so-ph-body" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 34 }}>
        <div className="so-ph-alert" aria-hidden="true"><b><Ic n="relogio" /></b></div>
        <span className="so-badge amber"><span className="dot live" />link vencido</span>
        <div>
          <h1>Este link não vale mais</h1>
          <p className="lead">Ele venceu ou já foi usado. Peça um novo link para quem cadastrou você no sistema.</p>
        </div>
        <Aviso tom="plain" className="so-note-esq">Já criou sua senha antes? Então é só entrar normalmente com seu e-mail e senha.</Aviso>
        <a href={link?.entidade ? `/t/${link.entidade.id}/login` : '/'} className="so-btn so-primary lg block" style={{ marginTop: 'auto' }}>Ir para o login<Ic n="seta" className="arrow" /></a>
      </div>,
    );
  }

  const primeiro = (link.nome ?? '').split(' ')[0];
  const ate = link.expiraEm ? new Date(link.expiraEm) : null;
  return tela(
    <form className="so-ph-body" onSubmit={e => { e.preventDefault(); void criar(); }}>
      <div>
        <h1>Olá, {primeiro}!</h1>
        <p className="lead">Crie sua senha. Depois disso você já entra no sistema.</p>
      </div>
      <div className="so-login">
        <span className="so-cic"><Ic n="mail" /></span>
        <div style={{ minWidth: 0 }}><small>Seu login</small><b style={{ overflowWrap: 'anywhere' }}>{link.email}</b></div>
      </div>
      <label className="so-field"><span className="so-lbl">Nova senha</span>
        <span className="so-ctrl lg"><input type={ver ? 'text' : 'password'} autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} aria-label="Nova senha" />
          <button type="button" className="eye" aria-label={ver ? 'Esconder a senha' : 'Mostrar a senha'} onClick={() => setVer(v => !v)}><Ic n="eye" /></button></span>
      </label>
      <label className="so-field"><span className="so-lbl">Repita a senha</span>
        <span className="so-ctrl lg"><input type={ver ? 'text' : 'password'} autoComplete="new-password" value={repete} onChange={e => setRepete(e.target.value)} aria-label="Repita a senha" /></span>
      </label>
      <div className="so-checks">
        <div style={{ color: min6 ? 'var(--mint)' : 'var(--muted)' }}><span style={min6 ? undefined : { background: 'var(--surface-3)', color: 'var(--faint)' }}><Ic n="check" /></span>Pelo menos 6 caracteres</div>
        <div style={{ color: iguais ? 'var(--mint)' : 'var(--muted)' }}><span style={iguais ? undefined : { background: 'var(--surface-3)', color: 'var(--faint)' }}><Ic n="check" /></span>As duas senhas são iguais</div>
      </div>
      {erro && <p className="so-erro">{erro}</p>}
      <button type="submit" className="so-btn so-primary lg block" disabled={!min6 || !iguais || enviando} style={{ marginTop: 4 }}>
        {enviando ? 'Entrando…' : 'Criar senha e entrar'}<Ic n="seta" className="arrow" />
      </button>
      {ate && <p className="so-ph-foot">Este link vale até <b>{ate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {ate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b> e só pode ser usado uma vez.</p>}
    </form>,
  );
}
