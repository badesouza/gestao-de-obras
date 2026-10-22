import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, Clock3, Eye, EyeOff, KeyRound, LockKeyhole, LogIn, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import { linkAcessoApi, setTenantToken } from '../lib/api-client';
import type { LinkPublico } from '../lib/api-client';
import { msgErro } from '../tenant/components/sisobras/so';
import { LoginCabecalho, LoginRodape, LoginSelo } from '../components/login/LoginVitrine';
import { LoginCidade } from '../components/login/LoginCidade';
import { AberturaSisObras } from '../components/marca/SimboloSisObras';
import { tempoAbertura } from '../components/marca/abertura';

/** "VINICIUS LARCHER" → "Vinicius" */
function primeiroNome(nome?: string) {
  const p = (nome ?? '').trim().split(/\s+/)[0] ?? '';
  return p ? p[0].toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR') : '';
}

/** força da senha de 0 a 4 (só para orientar; o mínimo continua 6 caracteres) */
function forca(s: string) {
  if (!s) return 0;
  let f = s.length >= 6 ? 1 : 0;
  if (s.length >= 10) f++;
  if (/[a-z]/i.test(s) && /\d/.test(s)) f++;
  if (/[^a-z0-9]/i.test(s) || (/[a-z]/.test(s) && /[A-Z]/.test(s))) f++;
  return Math.min(4, f);
}
const FORCA = ['', 'fraca', 'razoável', 'boa', 'forte'];

/** e-mail longo quebra depois do @, nunca no meio do domínio */
function emailQuebravel(email?: string) {
  const i = (email ?? '').indexOf('@');
  return i < 0 ? email : <>{email!.slice(0, i)}<wbr />{email!.slice(i)}</>;
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
  const [caps, setCaps] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    linkAcessoApi.consultar(token).then(setLink).catch(() => setErroCarga(true));
  }, [token]);

  const min6 = senha.length >= 6;
  const iguais = senha.length > 0 && senha === repete;
  const nivel = forca(senha);
  const checaCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);

  async function criar() {
    if (!token || !min6 || !iguais) return;
    setEnviando(true); setErro('');
    try {
      const r = await linkAcessoApi.criarSenha(token, senha);
      setTenantToken(r.entityId, r.token);
      setEntrando(link?.nome ?? '');
      window.setTimeout(() => navigate(`/t/${r.entityId}`, { replace: true }), tempoAbertura());
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 410) setLink(l => (l ? { ...l, valido: false } : l));
      else setErro(msgErro(e, 'Não foi possível criar a senha'));
    } finally { setEnviando(false); }
  }

  const ent = link?.entidade ?? null;
  const selo = (icone: React.ReactNode, tom?: 'coral' | 'ambar') => <LoginSelo brasao={tom ? null : ent?.brasaoUrl} tom={tom}>{icone}</LoginSelo>;
  const cena = (conteudo: React.ReactNode) => (
    <>
      {entrando !== null && <AberturaSisObras nome={entrando} />}
      <LoginCidade entityId={ent?.id} orgao={ent?.nome || undefined} semNumeros>
        {conteudo}
        <LoginRodape />
      </LoginCidade>
    </>
  );

  /* ── Abrindo ── */
  if (!link && !erroCarga) {
    return cena(
      <LoginCabecalho selo={selo(<KeyRound />)} eyebrow="Primeiro acesso" titulo={<span style={{ opacity: 0.3 }}>Abrindo…</span>} />,
    );
  }

  /* ── Link vencido ou já usado ── */
  if (erroCarga || !link?.valido) {
    return cena(
      <div className="lg-estado">
        {selo(<Clock3 />, 'ambar')}
        <h2>Este link não vale mais</h2>
        <p>Ele venceu ou já foi usado.<br />Peça um novo link para quem cadastrou você no sistema.</p>
        <p className="lg-ac-dica">Já criou sua senha antes? Então é só entrar com seu e-mail e senha.</p>
        <a href={ent ? `/t/${ent.id}/login` : '/'} className="lg-btn lg-ac-link">Ir para o login<LogIn /></a>
      </div>,
    );
  }

  const ate = link.expiraEm ? new Date(link.expiraEm) : null;
  return cena(
    <>
      <LoginCabecalho
        selo={selo(<KeyRound />)}
        eyebrow="Primeiro acesso"
        titulo={`Olá, ${primeiroNome(link.nome)}!`}
        sub="Crie sua senha. Depois disso você já entra no sistema."
      />
      <div className="lg-sep" />

      <form className="lg-form" onSubmit={e => { e.preventDefault(); void criar(); }}>
        <div className="lg-ac-conta">
          <span className="ic"><Mail /></span>
          <span className="tx"><small>Seu login</small><b>{emailQuebravel(link.email)}</b></span>
          <span className="ok" title="Confirmado pelo cadastro"><ShieldCheck /></span>
        </div>
        {/* o navegador guarda a senha junto com o e-mail certo */}
        <input type="email" autoComplete="username" value={link.email ?? ''} readOnly hidden />

        <div className="lg-campo">
          <label htmlFor="ac-senha">Nova senha</label>
          <div className="lg-ctrl">
            <LockKeyhole aria-hidden="true" />
            <input
              id="ac-senha" type={ver ? 'text' : 'password'} autoComplete="new-password" autoFocus
              value={senha} onChange={e => setSenha(e.target.value)}
              onKeyUp={checaCaps} onKeyDown={checaCaps} onBlur={() => setCaps(false)}
              placeholder="Pelo menos 6 caracteres"
            />
            <button type="button" className="lg-olho" onClick={() => setVer(v => !v)} aria-label={ver ? 'Esconder a senha' : 'Mostrar a senha'} title={ver ? 'Esconder a senha' : 'Mostrar a senha'}>
              {ver ? <EyeOff /> : <Eye />}
            </button>
          </div>
          <div className={`lg-ac-forca n${nivel}`} aria-live="polite">
            <span className="barras" aria-hidden="true"><i /><i /><i /><i /></span>
            <span className="rot">{senha ? <>Senha <b>{FORCA[nivel] || 'curta demais'}</b></> : 'Letras e números deixam mais forte'}</span>
          </div>
          {caps && <span className="lg-caps"><TriangleAlert />Caps Lock ligado</span>}
        </div>

        <div className="lg-campo">
          <label htmlFor="ac-repete">Repita a senha</label>
          <div className="lg-ctrl">
            <LockKeyhole aria-hidden="true" />
            <input
              id="ac-repete" type={ver ? 'text' : 'password'} autoComplete="new-password"
              value={repete} onChange={e => setRepete(e.target.value)}
              onKeyUp={checaCaps} onKeyDown={checaCaps} onBlur={() => setCaps(false)}
              placeholder="Digite de novo"
            />
          </div>
        </div>

        <ul className="lg-ac-regras">
          <li className={min6 ? 'ok' : ''}><span><Check /></span>Pelo menos 6 caracteres</li>
          <li className={iguais ? 'ok' : ''}><span><Check /></span>As duas senhas são iguais</li>
        </ul>

        {erro && (
          <div className="lg-erro" role="alert" key={erro}>
            <TriangleAlert /><span>{erro}</span>
          </div>
        )}

        <button type="submit" className={`lg-btn${!min6 || !iguais ? ' lg-ac-espera' : ''}`} disabled={!min6 || !iguais || enviando}>
          {enviando ? <><span className="lg-spin" />Criando sua senha…</> : <>Criar senha e entrar<ArrowRight /></>}
        </button>

        {ate && (
          <p className="lg-ac-validade">
            <Clock3 />
            <span>Este link vale até <b>{ate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {ate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b> e só pode ser usado uma vez.</span>
          </p>
        )}
      </form>
    </>,
  );
}
