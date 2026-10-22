import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, Landmark, SearchX } from 'lucide-react';
import {
  ApiError,
  publicApi,
  setTenantToken,
  tenantApi,
} from '../../lib/api-client';
import {
  LoginCabecalho, LoginFormulario, LoginRodape, LoginSelo, LoginVitrine,
} from '../../components/login/LoginVitrine';
import { LoginCidade } from '../../components/login/LoginCidade';
import { AberturaSisObras } from '../../components/marca/SimboloSisObras';
import { tempoAbertura } from '../../components/marca/abertura';

export function TenantLoginPage() {
  const { id: entityId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entityName, setEntityName] = useState('');
  const [entityStatus, setEntityStatus] = useState<string | null>(null);
  const [coatOfArmsUrl, setCoatOfArmsUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [entrando, setEntrando] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) return;
    publicApi
      .getTenant(entityId)
      .then((tenant) => {
        setEntityName(tenant.name);
        setEntityStatus(tenant.status);
        setCoatOfArmsUrl(tenant.coatOfArmsUrl);
      })
      .catch(() => setNotFound(true));
  }, [entityId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entityId) return;
    setError('');
    setLoading(true);
    try {
      const result = await tenantApi.login(entityId, email, password);
      setTenantToken(entityId, result.token);
      setEntrando(result.user.name);
      window.setTimeout(() => navigate(`/t/${entityId}`), tempoAbertura());
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível autenticar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Not found ── */
  if (notFound) {
    return (
      <LoginVitrine>
        <div className="lg-estado">
          <LoginSelo tom="coral"><SearchX /></LoginSelo>
          <h2>Entidade não encontrada</h2>
          <p>Verifique o link de acesso<br />com o administrador.</p>
        </div>
      </LoginVitrine>
    );
  }

  /* ── Inactive ── */
  if (entityStatus === 'INACTIVE') {
    return (
      <LoginVitrine orgao={entityName}>
        <div className="lg-estado">
          <LoginSelo tom="ambar"><Ban /></LoginSelo>
          <h2>{entityName}</h2>
          <p>Esta entidade está suspensa.<br />Contate o administrador da plataforma.</p>
        </div>
      </LoginVitrine>
    );
  }

  /* ── Login ── */
  return (
    <>
    {entrando !== null && <AberturaSisObras nome={entrando} />}
    <LoginCidade entityId={entityId} orgao={entityName || undefined}>
      <LoginCabecalho
        selo={<LoginSelo brasao={coatOfArmsUrl}><Landmark /></LoginSelo>}
        eyebrow="Acesso da entidade"
        titulo={entityName || <span style={{ opacity: 0.3 }}>Carregando…</span>}
        sub="Entre com o e-mail e a senha do seu cadastro."
      />
      <div className="lg-sep" />
      <LoginFormulario
        idPrefixo="tl"
        email={email} setEmail={setEmail}
        senha={password} setSenha={setPassword}
        placeholderEmail="usuario@empresa.com"
        erro={error}
        carregando={loading}
        textoBotao="Entrar no sistema"
        onSubmit={handleSubmit}
      />
      <LoginRodape />
    </LoginCidade>
    </>
  );
}
