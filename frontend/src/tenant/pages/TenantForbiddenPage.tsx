import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';

/** Tenant forbidden page */
export function TenantForbiddenPage() {
  const { id: entityId } = useParams<{ id: string }>();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] px-4">
      <Card className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-[var(--color-ink)]">Acesso negado</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Você não tem permissão para acessar este recurso.
        </p>
        {entityId ? (
          <Link to={`/t/${entityId}/dashboard`} className="mt-4 inline-block underline">
            Voltar ao dashboard
          </Link>
        ) : null}
      </Card>
    </div>
  );
}
