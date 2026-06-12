import { useState, useCallback } from 'react';
import type { ToastMessage, ToastVariant } from '../components/Toast';

let counter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success', duration?: number) => {
    const id = String(++counter);
    setToasts((prev) => [...prev, { id, message, variant, duration }]);
  }, []);

  const closeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, closeToast };
}
