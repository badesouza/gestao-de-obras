import type { HTMLAttributes } from 'react';

/** Cream card container following DESIGN.md */
export function Card({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-surface-card)] p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
