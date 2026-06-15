import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { MediaItem } from '../lib/types';
import { useDebounce } from '../hooks/useDebounce';
import { MediaGrid } from '../components/media/MediaGrid';
import { EmptyState, ErrorState } from '../components/ui/States';
import { useT } from '../lib/i18n';
import { rememberSearch } from '../lib/recent-searches';

export function SearchView() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const debounced = useDebounce(query.trim(), 350);
  const { t, tn, formatNumber } = useT();

  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setTotal(0);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .search(debounced)
      .then((page) => {
        if (cancelled) return;
        setResults(page.results);
        setTotal(page.totalResults);
        if (page.results.length > 0) rememberSearch(debounced);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : t('common.load_error'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, t]);

  return (
    <div className="container mx-auto px-6 pb-16 pt-28">
      <h1 className="mb-1 text-2xl font-extrabold sm:text-3xl">
        {debounced ? (
          <>
            {t('search.results_for')}{' '}
            <span className="text-gradient">«&nbsp;{debounced}&nbsp;»</span>
          </>
        ) : (
          t('search.title')
        )}
      </h1>
      {debounced && !loading && !error && (
        <p className="mb-6 text-sm text-white/50">
          {tn('search.count', total, { count: formatNumber(total) })}
        </p>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : !debounced ? (
        <EmptyState
          icon={<Sparkles className="h-12 w-12" />}
          title={t('search.empty_title')}
          description={t('search.empty_desc')}
        />
      ) : loading ? (
        <MediaGrid items={[]} loading />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search className="h-12 w-12" />}
          title={t('search.none_title')}
          description={t('search.none_desc', { query: debounced })}
        />
      ) : (
        <div className="animate-fade-in">
          <MediaGrid items={results} />
        </div>
      )}
    </div>
  );
}
