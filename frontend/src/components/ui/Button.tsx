import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

/** Primary/secondary button following DESIGN.md */
export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] px-5 text-sm font-semibold transition disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
      : 'border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]';

  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
