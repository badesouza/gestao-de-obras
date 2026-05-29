interface TenantPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

/** Standard page header for tenant admin pages */
export function TenantPageHeader({
  title,
  description,
  actions,
}: TenantPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-hairline)] pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}
