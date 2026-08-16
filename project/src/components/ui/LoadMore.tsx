import type { RefObject } from 'react';
import { Spinner } from './States';
import { useT } from '../../lib/i18n';

interface LoadMoreProps {
  /** Sentinel the caller observes to auto-load on scroll. */
  sentinelRef: RefObject<HTMLDivElement>;
  hasMore: boolean;
  loading: boolean;
  /** Items currently in the grid, and how many the query has in total. */
  loaded: number;
  total: number;
  onLoadMore: () => void;
}

/**
 * The bottom of an infinitely scrolling grid, made operable and audible.
 *
 * Infinite scroll on its own is a mouse-and-eyes feature: there is nothing to
 * activate from a keyboard, and nothing announces that twenty more titles just
 * appeared below. So the sentinel keeps auto-loading, a real button does the
 * same job for anyone not scrolling with a wheel, and a polite live region
 * states the count after each page lands — the one place the change is
 * reported to someone who cannot see it happen.
 */
export function LoadMore({
  sentinelRef,
  hasMore,
  loading,
  loaded,
  total,
  onLoadMore,
}: LoadMoreProps) {
  const { t, formatNumber } = useT();

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {loading
          ? t('grid.loading_more')
          : loaded > 0
            ? t('grid.loaded', { loaded: formatNumber(loaded), total: formatNumber(total) })
            : ''}
      </div>

      <div ref={sentinelRef} className="flex flex-col items-center gap-3 py-10">
        {loading && <Spinner className="h-6 w-6 text-white/70" />}
        {hasMore && !loading && (
          <button
            onClick={onLoadMore}
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t('grid.load_more')}
          </button>
        )}
        {!hasMore && loaded > 0 && (
          <p className="text-sm text-white/40">{t('grid.end')}</p>
        )}
      </div>
    </>
  );
}
