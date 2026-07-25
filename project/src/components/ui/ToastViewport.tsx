import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useT } from '../../lib/i18n';
import type { ToastKind } from '../../lib/toast';

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const ACCENT: Record<ToastKind, string> = {
  success: 'border-emerald-500/30 text-emerald-300',
  error: 'border-red-500/30 text-red-300',
  info: 'border-white/25 text-white',
};

/**
 * Stacked, auto-dismissing notifications anchored bottom-right. The live region
 * is always mounted so screen readers announce new toasts; errors use
 * `role="alert"` (assertive), the rest `role="status"` (polite). Animations
 * inherit the global `prefers-reduced-motion` reset.
 */
export function ToastViewport() {
  const { toasts, dismiss } = useToast();
  const { t } = useT();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[120] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            className={`animate-fade-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-ink-800/95 px-4 py-3 shadow-card backdrop-blur-xl ${ACCENT[toast.kind]}`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <p className="flex-1 text-sm font-medium text-white/90">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              aria-label={t('common.close')}
              className="shrink-0 rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
