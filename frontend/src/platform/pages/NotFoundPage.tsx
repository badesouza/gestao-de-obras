import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';

/** 404 page for platform area */
export function NotFoundPage() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="text-center">
        <h2 className="text-xl font-semibold text-[var(--color-ink)]">Página não encontrada</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          O recurso solicitado não existe.
        </p>
        <Link to="/platform/entities" className="mt-4 inline-block underline">
          Ir para entidades
        </Link>
      </Card>
    </div>
  );
}
