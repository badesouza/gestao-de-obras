import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, XCircle } from 'lucide-react';

type Variant = 'danger' | 'warning' | 'info';

interface ConfirmModalProps {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_ICON: Record<Variant, ReactNode> = {
  danger: <Trash2 size={22} />,
  warning: <AlertTriangle size={22} />,
  info: <XCircle size={22} />,
};

const VARIANT_COLOR: Record<Variant, string> = {
  danger: '#dc2626',
  warning: '#f97316',
  info: '#60a5fa',
};

const VARIANT_BG: Record<Variant, string> = {
  danger: 'rgba(239,68,68,0.1)',
  warning: 'rgba(249,115,22,0.1)',
  info: 'rgba(96,165,250,0.1)',
};

const VARIANT_BORDER: Record<Variant, string> = {
  danger: 'rgba(239,68,68,0.2)',
  warning: 'rgba(249,115,22,0.2)',
  info: 'rgba(96,165,250,0.2)',
};

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  const color = VARIANT_COLOR[variant];

  return createPortal(
    <div className="sv-modal-backdrop" onClick={onCancel}>
      <div className="sv-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div
          className="sv-confirm-icon"
          style={{
            background: VARIANT_BG[variant],
            border: `1px solid ${VARIANT_BORDER[variant]}`,
            color,
          }}
        >
          {VARIANT_ICON[variant]}
        </div>
        <h3>{title}</h3>
        {message && <p>{message}</p>}
        <div className="sv-confirm-actions">
          <button
            className="tn-btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className="sv-btn-danger"
            style={variant !== 'danger' ? { background: color } : undefined}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Aguarde...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

