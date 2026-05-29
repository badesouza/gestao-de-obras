import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';

/** 403 page for platform area */
export function ForbiddenPage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="text-center">
        <h2 className="text-xl font-semibold text-[var(--color-ink)]">Acesso negado</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Você não tem permissão para acessar este recurso.
        </p>
        <Link to="/platform/login" className="mt-4 inline-block underline">
          Fazer login
        </Link>
      </Card>
    </div>
  );
}
