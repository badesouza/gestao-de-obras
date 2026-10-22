import { Navigate } from 'react-router-dom';

/** O cadastro de entidade abre em janela na lista (endereço antigo continua funcionando) */
export function EntityCreatePage() {
  return <Navigate to="/platform/entities?nova=1" replace />;
}
