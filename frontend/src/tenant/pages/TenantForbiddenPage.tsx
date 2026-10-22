import { Link, useParams } from 'react-router-dom';
import { Ic } from '../components/sisobras/so';
import { TelaAviso } from '../../platform/components/TelaAviso';

/** Prefeitura — acesso negado (fora da casca do sistema) */
export function TenantForbiddenPage() {
  const { id: entityId } = useParams<{ id: string }>();

  return (
    <TelaAviso
      cheia
      icone="lock"
      tom="coral"
      codigo="Acesso negado · 403"
      titulo="Esta área não está liberada para você"
      texto="Seu login não tem permissão para abrir esta tela. Se precisa dela, peça ao administrador para marcar a caixa no seu cadastro de acessos."
    >
      {entityId && (
        <Link to={`/t/${entityId}`} className="so-btn so-primary">
          Ir para o início <Ic n="seta" className="arrow" />
        </Link>
      )}
      {entityId && (
        <Link to={`/t/${entityId}/login`} className="so-btn so-ghost">
          <Ic n="key" /> Entrar com outro login
        </Link>
      )}
    </TelaAviso>
  );
}
