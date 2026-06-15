import { AlertTriangle, Loader2, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../../lib/i18n';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function FullSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-white/60">
      <Spinner className="h-8 w-8 text-brand-cyan" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <div className="text-white/40">{icon ?? <SearchX className="h-12 w-12" />}</div>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      {description && <p className="max-w-md text-sm text-white/50">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <AlertTriangle className="h-12 w-12 text-orange-400" />
      <div>
        <h3 className="text-xl font-semibold text-white">{t('error.title')}</h3>
        <p className="mt-1 max-w-md text-sm text-white/50">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost">
          {t('error.retry')}
        </button>
      )}
    </div>
  );
}
