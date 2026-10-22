import { Link } from 'react-router-dom';
import { Ic } from '../../tenant/components/sisobras/so';
import { TelaAviso } from '../components/TelaAviso';

/** Plataforma — acesso negado */
export function ForbiddenPage() {
  return (
    <TelaAviso
      icone="lock"
      tom="coral"
      codigo="Acesso negado · 403"
      titulo="Esta área não está liberada para você"
      texto="Seu login não tem permissão para abrir esta tela. Se precisa dela, peça a liberação a quem administra a plataforma."
    >
      <Link to="/platform/entities" className="so-btn so-primary">
        Ir para Entidades <Ic n="seta" className="arrow" />
      </Link>
      <Link to="/platform/login" className="so-btn so-ghost">
        <Ic n="key" /> Entrar com outro login
      </Link>
    </TelaAviso>
  );
}
