import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tenantApi } from '../../lib/api-client';
import { Card } from '../../components/ui/Card';
import { useTenant, useTenantPermission } from '../TenantContext';
import { TenantPageHeader } from '../components/TenantPageHeader';
import { formatTodayPtBr } from '../utils/format';

interface StatCardProps {
  label: string;
  value: number | string;
  hint: string;
  accent?: boolean;
}

/** Dashboard metric card */
function StatCard({ label, value, hint, accent = false }: StatCardProps) {
  return (
    <Card className={`p-5 ${accent ? 'border-[var(--color-accent)]/20 bg-white' : 'bg-white'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {label}
      </p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-ink)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{hint}</p>
    </Card>
  );
}

/** Tenant dashboard with operational overview */
export function TenantDashboardPage() {
  const { entityId, session } = useTenant();
  const canManageUsers = useTenantPermission('users.manage');
  const [data, setData] = useState<Awaited<ReturnType<typeof tenantApi.dashboard>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    tenantApi
      .dashboard(entityId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }, [entityId]);

  if (error) {
    return (
      <Card className="border-[var(--color-error)]/30 bg-white">
        <p className="text-[var(--color-error)]">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--color-surface-soft)]" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)]"
            />
          ))}
        </div>
      </div>
    );
  }

  const inactiveUsers = Math.max(data.stats.usersTotal - data.stats.usersActive, 0);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-surface-dark)] to-[var(--color-accent)] p-6 text-white lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
              Painel operacional
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight lg:text-3xl">
              Bem-vindo(a), {session.name.split(' ')[0]}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Visão consolidada da entidade{' '}
              <strong className="font-semibold text-white">{data.entity.name}</strong>. Utilize o
              menu lateral para administrar usuários e acompanhar a operação.
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-white/15 bg-white/10 px-4 py-3 text-sm capitalize text-white/80">
            {formatTodayPtBr()}
          </div>
        </div>
      </section>

      <TenantPageHeader
        title="Indicadores"
        description="Resumo inicial do tenant. Módulos de obras, contratos e medições serão integrados nas próximas etapas."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Usuários ativos"
          value={data.stats.usersActive}
          hint="Contas habilitadas para acesso"
          accent
        />
        <StatCard
          label="Total de usuários"
          value={data.stats.usersTotal}
          hint="Cadastrados nesta entidade"
        />
        <StatCard
          label="Usuários inativos"
          value={inactiveUsers}
          hint="Contas desabilitadas"
        />
        <StatCard
          label="Status da entidade"
          value={data.entity.status === 'ACTIVE' ? 'Ativa' : 'Suspensa'}
          hint="Situação operacional do tenant"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="bg-white xl:col-span-2">
          <h3 className="text-base font-semibold text-[var(--color-ink)]">Próximos módulos</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Roadmap funcional previsto para o sistema de gestão de obras públicas.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              'Cadastro de obras',
              'Contratos e aditivos',
              'Medições e fiscalização',
              'Relatórios financeiros',
            ].map((module) => (
              <li
                key={module}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-body)]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-brand-ochre)]" />
                {module}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="bg-white">
          <h3 className="text-base font-semibold text-[var(--color-ink)]">Acesso rápido</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Atalhos para tarefas administrativas frequentes.
          </p>
          <div className="mt-6 space-y-3">
            {canManageUsers ? (
              <Link
                to={`/t/${entityId}/users/new`}
                className="flex min-h-11 items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-hairline)] px-4 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
              >
                Cadastrar usuário
                <span aria-hidden>→</span>
              </Link>
            ) : null}
            <Link
              to={`/t/${entityId}/users`}
              className="flex min-h-11 items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-hairline)] px-4 text-sm font-medium text-[var(--color-ink)] transition hover:bg-[var(--color-surface-soft)]"
            >
              Ver usuários
              <span aria-hidden>→</span>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
