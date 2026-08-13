import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';
import { useT } from '../../lib/i18n';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getOnline = () => navigator.onLine;

/**
 * Slim banner shown while the browser reports no connectivity. The PWA shell
 * and cached images keep working offline; without this, that just looks like
 * an app silently showing stale data. `role="status"` announces the
 * transition to screen readers as well.
 */
export function OfflineBanner() {
  const { t } = useT();
  const online = useSyncExternalStore(subscribe, getOnline, () => true);
  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-xs font-semibold text-ink-950"
    >
      <WifiOff className="h-3.5 w-3.5" />
      {t('offline.banner')}
    </div>
  );
}
