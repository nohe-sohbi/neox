import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { addToast, dismissToast, type Toast, type ToastKind } from '../lib/toast';

/** How long a toast stays on screen before auto-dismissing. */
const DEFAULT_DURATION = 4000;

interface ToastContextValue {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind, duration?: number) => number;
  success: (message: string, duration?: number) => number;
  error: (message: string, duration?: number) => number;
  info: (message: string, duration?: number) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => dismissToast(list, id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = 'info', duration = DEFAULT_DURATION) => {
      const id = (nextId.current += 1);
      setToasts((list) => addToast(list, { id, kind, message }));
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const success = useCallback((m: string, d?: number) => push(m, 'success', d), [push]);
  const error = useCallback((m: string, d?: number) => push(m, 'error', d), [push]);
  const info = useCallback((m: string, d?: number) => push(m, 'info', d), [push]);

  // Clear any pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, push, success, error, info, dismiss }),
    [toasts, push, success, error, info, dismiss],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
