import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const ICONS = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
};

const COLORS = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '#22c55e' },
  error:   { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: '#ef4444' },
  warning: { bg: '#fff7ed', border: '#fed7aa', color: '#c2410c', icon: '#f97316' },
};

function ToastItem({ toast, onClose }: ToastItemProps) {
  const { message, variant = 'success', duration = 3500 } = toast;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onClose(toast.id), duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id, duration, onClose]);

  const c = COLORS[variant];

  return (
    <div
      className="tn-toast-item"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
    >
      <span style={{ color: c.icon, flexShrink: 0 }}>{ICONS[variant]}</span>
      <span className="tn-toast-msg">{message}</span>
      <button
        className="tn-toast-close"
        onClick={() => onClose(toast.id)}
        style={{ color: c.color }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="tn-toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={onClose} />
      ))}
    </div>,
    document.body,
  );
}
