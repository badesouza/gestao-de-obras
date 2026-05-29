import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/** Text input with label following DESIGN.md */
export function Input({ label, error, id, className = '', ...props }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={inputId} className="text-sm font-semibold text-[var(--color-ink)]">
        {label}
      </label>
      <input
        id={inputId}
        className={`h-11 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-ink)] ${className}`}
        {...props}
      />
      {error ? <span className="text-xs text-[var(--color-error)]">{error}</span> : null}
    </div>
  );
}
