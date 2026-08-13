import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { MediaItem, SearchPerson } from '../lib/types';
import { useDebounce } from '../hooks/useDebounce';
import { isModifiedClick, useOpenPerson } from '../hooks/useDetailRoute';
import { MediaGrid } from '../components/media/MediaGrid';
import { EmptyState, ErrorState, Spinner } from '../components/ui/States';
import { useT } from '../lib/i18n';
import { departmentLabel } from '../lib/person';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { personPath, routeMeta } from '../lib/routes';
import { rememberSearch } from '../lib/recent-searches';

export function SearchView() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const debounced = useDebounce(query.trim(), 350);
  const { t, tn, formatNumber, lang } = useT();

  // The manifest carries the route's baseline (description, and the
  // `noindex, follow` the build already prerendered); the query only refines
  // the title and the canonical it points at.
  useDocumentMeta({
    ...routeMeta('search', lang),
    ...(debounced && {
      title: `${t('search.results_for')} ${t('search.quoted', { term: debounced })}`,
      path: `/search?q=${encodeURIComponent(debounced)}`,
    }),
  });

  const openPerson = useOpenPerson();
  const [results, setResults] = useState<MediaItem[]>([]);
  const [people, setPeople] = useState<SearchPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Monotonic request id: a slow response for a previous query (or an earlier
  // page) must never clobber the state of the current one.
  const requestRef = useRef(0);

  const fetchPage = useCallback(
    (query: string, targetPage: number) => {
      const id = ++requestRef.current;
      if (targetPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      api
        .search(query, targetPage)
        .then((res) => {
          if (requestRef.current !== id) return;
          setResults((prev) => (targetPage === 1 ? res.results : [...prev, ...res.results]));
          if (targetPage === 1) setPeople(res.people ?? []);
          setTotal(res.totalResults);
          setTotalPages(res.totalPages);
          setPage(res.page);
          if (targetPage === 1 && (res.results.length > 0 || (res.people ?? []).length > 0)) {
            rememberSearch(query);
          }
        })
        .catch((err: unknown) => {
          if (requestRef.current !== id) return;
          setError(err instanceof ApiError ? err.message : t('common.load_error'));
        })
        .finally(() => {
          if (requestRef.current !== id) return;
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [t],
  );

  useEffect(() => {
    if (!debounced) {
      requestRef.current += 1; // invalidate anything in flight
      setResults([]);
      setPeople([]);
      setTotal(0);
      setError(null);
      setPage(1);
      setTotalPages(1);
      return;
    }
    fetchPage(debounced, 1);
  }, [debounced, fetchPage]);

  // The count used to promise "1 234 results" while only ever showing the
  // first 20; the sentinel pulls the next pages in as you scroll, like the
  // Discover view does.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && debounced && !loading && !loadingMore && page < totalPages) {
          fetchPage(debounced, page + 1);
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchPage, debounced, loading, loadingMore, page, totalPages]);

  return (
    <div className="container mx-auto px-6 pb-16 pt-28">
      <h1 className="mb-1 font-display text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">
        {debounced ? (
          <>
            {t('search.results_for')}{' '}
            <span className="text-white">{t('search.quoted', { term: debounced })}</span>
          </>
        ) : (
          t('search.title')
        )}
      </h1>
      {debounced && !loading && !error && results.length > 0 && (
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
      ) : results.length === 0 && people.length === 0 ? (
        <EmptyState
          icon={<Search className="h-12 w-12" />}
          title={t('search.none_title')}
          description={t('search.none_desc', { query: debounced })}
        />
      ) : (
        <div className="animate-fade-in">
          {/* People matched by name (actors, directors…), previously dropped
              server-side; each opens the person overlay like a cast credit. */}
          {people.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
                {t('search.people')}
              </h2>
              <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
                {people.map((p) => (
                  <a
                    key={p.id}
                    href={personPath(p.id)}
                    onClick={(e) => {
                      if (isModifiedClick(e)) return;
                      e.preventDefault();
                      openPerson(p.id);
                    }}
                    className="group w-20 shrink-0 text-center"
                  >
                    {p.photo ? (
                      <img
                        src={p.photo}
                        alt={p.name}
                        width={80}
                        height={80}
                        loading="lazy"
                        className="mb-1.5 h-20 w-20 rounded-full object-cover ring-1 ring-white/10 transition-all group-hover:ring-white/40"
                      />
                    ) : (
                      <div className="mb-1.5 flex h-20 w-20 items-center justify-center rounded-full bg-ink-700 text-lg font-bold text-white/40">
                        {p.name.slice(0, 1)}
                      </div>
                    )}
                    <p className="truncate text-xs font-medium text-white/90 group-hover:text-white">
                      {p.name}
                    </p>
                    {p.knownFor && (
                      <p className="truncate text-[11px] text-white/40">
                        {departmentLabel(t, p.knownFor)}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}
          <MediaGrid items={results} />
          <div ref={sentinelRef} className="flex justify-center py-10">
            {loadingMore && <Spinner className="h-6 w-6 text-white/70" />}
          </div>
        </div>
      )}
    </div>
  );
}
