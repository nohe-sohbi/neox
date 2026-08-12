import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { api, getLocale } from '../../lib/api';
import { DEFAULT_TTL, queryCache } from '../../lib/query';
import type { MediaItem, Paginated } from '../../lib/types';
import { MediaRow } from '../media/MediaRow';
import { useT } from '../../lib/i18n';

type TrendWindow = 'day' | 'week';

const WINDOWS: { id: TrendWindow; key: string }[] = [
  { id: 'day', key: 'trending.day' },
  { id: 'week', key: 'trending.week' },
];

/**
 * "Trending now" rail with a today / this-week toggle — the first consumer of
 * the backend's /api/trending endpoint. Each window is cached separately, so
 * flipping back and forth doesn't refetch, and a failing fetch just hides the
 * rail like every other home row.
 */
export function TrendingRow() {
  const { t } = useT();
  const [period, setPeriod] = useState<TrendWindow>('week');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const locale = getLocale();
    const key = `trending:all:${period}:${locale.region}:${locale.language}`;
    const cached = queryCache.getFresh<Paginated<MediaItem>>(key, DEFAULT_TTL);
    if (cached) {
      setItems(cached.results);
      setLoading(false);
      return;
    }
    setLoading(true);
    queryCache
      .fetch(key, () => api.trending('all', period))
      .then((res) => {
        if (!cancelled) setItems(res.results);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <MediaRow
      title={t('home.trending_title')}
      icon={<Flame className="h-5 w-5 text-white/60" />}
      items={items}
      loading={loading}
      actions={
        <div className="flex gap-1.5" role="group" aria-label={t('home.trending_title')}>
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              onClick={() => setPeriod(w.id)}
              aria-pressed={period === w.id}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                period === w.id
                  ? 'bg-white text-ink-950'
                  : 'border border-white/10 bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              {t(w.key)}
            </button>
          ))}
        </div>
      }
    />
  );
}
