import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { ApiError, platformApi, setPlatformToken } from '../../lib/api-client';
import {
  LoginCabecalho, LoginFormulario, LoginRodape, LoginSaudacao, LoginSelo, LoginVitrine,
} from '../../components/login/LoginVitrine';
import { AberturaSisObras } from '../../components/marca/SimboloSisObras';
import { tempoAbertura } from '../../components/marca/abertura';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@plataforma.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [entrando, setEntrando] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await platformApi.login(email, password);
      setPlatformToken(result.token);
      setEntrando(result.operator.name);
      window.setTimeout(() => navigate('/platform/entities'), tempoAbertura());
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

  return (
    <>
    {entrando !== null && <AberturaSisObras nome={entrando} destino="Abrindo o painel da plataforma" />}
    <LoginVitrine orgao="Painel da plataforma">
      <LoginSaudacao />
      <LoginCabecalho
        selo={<LoginSelo><Building2 /></LoginSelo>}
        eyebrow="Acesso restrito"
        titulo="Área da Plataforma"
        sub="Entidades · Operadores · Configurações"
      />
      <div className="lg-sep" />
      <LoginFormulario
        idPrefixo="pl"
        email={email} setEmail={setEmail}
        senha={password} setSenha={setPassword}
        placeholderEmail="operador@plataforma.com"
        erro={error}
        carregando={loading}
        textoBotao="Acessar plataforma"
        onSubmit={handleSubmit}
      />
      <LoginRodape />
    </LoginVitrine>
    </>
  );
}
