import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Ic } from '../../tenant/components/sisobras/so';
import { TelaAviso } from '../components/TelaAviso';

/** Endereço que não existe (vale para o sistema todo) */
export function NotFoundPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const entidade = pathname.match(/^\/t\/([^/]+)/)?.[1];
  const inicio = entidade
    ? { to: `/t/${entidade}`, texto: 'Ir para o início' }
    : { to: '/platform/entities', texto: 'Ir para a plataforma' };

  return (
    <TelaAviso
      cheia
      icone="map"
      tom="amber"
      codigo="Página não encontrada · 404"
      titulo="Este endereço está fora da planta"
      texto="A página que você procurou não existe ou mudou de lugar. Confira o link ou volte para uma tela conhecida."
      ponto={pathname}
    >
      <Link to={inicio.to} className="so-btn so-primary">
        {inicio.texto} <Ic n="seta" className="arrow" />
      </Link>
      <button type="button" className="so-btn so-ghost" onClick={() => navigate(-1)}>
        <Ic n="voltar" className="back" /> Voltar
      </button>
    </TelaAviso>
  );
}
