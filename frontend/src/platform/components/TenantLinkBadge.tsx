interface TenantLinkBadgeProps {
  entityId: string;
  tenantAccessUrl: string;
}

/** Displays and copies tenant login URL */
export function TenantLinkBadge({ entityId, tenantAccessUrl }: TenantLinkBadgeProps) {
  const fullUrl = `${window.location.origin}${tenantAccessUrl}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullUrl);
  };

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-4">
      <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">
        Link de acesso tenant
      </p>
      <p className="mt-1 font-mono text-sm text-[var(--color-ink)]">{fullUrl}</p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">ID: {entityId}</p>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 text-sm font-semibold text-[var(--color-ink)] underline"
      >
        Copiar link
      </button>
    </div>
  );
}
