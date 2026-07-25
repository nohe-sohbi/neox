import { useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Star } from 'lucide-react';
import { api, ApiError, getLocale } from '../lib/api';
import { STATIC_TTL, queryCache } from '../lib/query';
import type { Genre, MediaItem, MediaType, Provider } from '../lib/types';
import { useMyPlatforms } from '../hooks/useMyPlatforms';
import { MediaGrid } from '../components/media/MediaGrid';
import { EmptyState, ErrorState, Spinner } from '../components/ui/States';
import { useT } from '../lib/i18n';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const MOVIE_SORTS = [
  { id: 'popularity.desc', key: 'sort.popularity' },
  { id: 'vote_average.desc', key: 'sort.vote_movie' },
  { id: 'primary_release_date.desc', key: 'sort.release_movie' },
  { id: 'revenue.desc', key: 'sort.revenue' },
];

const TV_SORTS = [
  { id: 'popularity.desc', key: 'sort.popularity' },
  { id: 'vote_average.desc', key: 'sort.vote_tv' },
  { id: 'first_air_date.desc', key: 'sort.release_tv' },
];

// Minimum-rating presets (0 = no floor). Kept coarse on purpose: fine-grained
// sliders add friction without improving discovery.
const RATING_OPTIONS = [0, 6, 7, 8, 9];

const CURRENT_YEAR = new Date().getFullYear();
// Exact release years, newest first, back to 1950: matches TMDB's
// primary_release_year / first_air_date_year filter.
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1950 + 1 }, (_, i) => CURRENT_YEAR - i);

export function DiscoverView({ mediaType }: { mediaType: MediaType }) {
  const { t } = useT();
  const platforms = useMyPlatforms();

  const [genres, setGenres] = useState<Genre[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeGenre, setActiveGenre] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState('popularity.desc');
  const [year, setYear] = useState<number | undefined>(undefined);
  const [minRating, setMinRating] = useState(0);
  const [showPlatforms, setShowPlatforms] = useState(false);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorts = mediaType === 'tv' ? TV_SORTS : MOVIE_SORTS;

  useDocumentMeta({
    title: mediaType === 'tv' ? t('discover.tv_title') : t('discover.movies_title'),
    description: mediaType === 'tv' ? t('discover.tv_sub') : t('discover.movies_sub'),
    path: mediaType === 'tv' ? '/tv' : '/movies',
  });

  // Genres + providers for this media type. These barely change, so they're
  // cached: switching tabs (or coming back) reuses the data instead of refetching.
  useEffect(() => {
    let cancelled = false;
    const locale = getLocale();
    const suffix = `${mediaType}:${locale.region}:${locale.language}`;
    const genresKey = `genres:${suffix}`;
    const providersKey = `providers:${suffix}`;

    const cachedGenres = queryCache.getFresh<{ genres: Genre[] }>(genresKey, STATIC_TTL);
    const cachedProviders = queryCache.getFresh<{ providers: Provider[] }>(providersKey, STATIC_TTL);
    if (cachedGenres && cachedProviders) {
      setGenres(cachedGenres.genres);
      setProviders(cachedProviders.providers);
      return;
    }

    Promise.all([
      queryCache.fetch(genresKey, () => api.genres(mediaType)),
      queryCache.fetch(providersKey, () => api.providers(mediaType)),
    ])
      .then(([g, p]) => {
        if (cancelled) return;
        setGenres(g.genres);
        setProviders(p.providers);
      })
      .catch(() => {
        if (cancelled) return;
        setGenres([]);
        setProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  const platformIds = platforms.ids.join(',');

  const fetchPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await api.discover(mediaType, {
          genre: activeGenre,
          sort,
          year,
          minRating: minRating || undefined,
          page: targetPage,
          providers: platformIds ? platformIds.split(',').map(Number) : undefined,
        });
        setTotalPages(res.totalPages);
        setPage(res.page);
        setItems((prev) => (replace ? res.results : [...prev, ...res.results]));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('common.load_error'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [mediaType, activeGenre, sort, year, minRating, platformIds, t],
  );

  useEffect(() => {
    void fetchPage(1, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchPage]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && page < totalPages) {
          void fetchPage(page + 1, false);
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchPage, loading, loadingMore, page, totalPages]);

  const platformsActive = platforms.ids.length > 0;

  return (
    <div className="container mx-auto px-6 pb-16 pt-28">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        {mediaType === 'tv' ? t('discover.tv_title') : t('discover.movies_title')}
      </h1>
      <p className="mt-1 text-white/50">
        {mediaType === 'tv' ? t('discover.tv_sub') : t('discover.movies_sub')}
      </p>

      {/* Sort + platform toggle */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {sorts.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              sort === s.id
                ? 'bg-brand-gradient text-white shadow-glow'
                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {t(s.key)}
          </button>
        ))}
        <button
          onClick={() => setShowPlatforms((s) => !s)}
          className={`ml-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
            platformsActive
              ? 'bg-brand-gradient text-white shadow-glow'
              : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {t('discover.my_platforms')}
          {platformsActive && (
            <span className="rounded-full bg-white/25 px-1.5 text-xs">{platforms.ids.length}</span>
          )}
        </button>
      </div>

      {/* Platform picker */}
      {showPlatforms && providers.length > 0 && (
        <div className="mt-4 animate-slide-up rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-white/70">
              {t('discover.platforms_hint')}
            </p>
            {platformsActive && (
              <button
                onClick={platforms.clear}
                className="text-xs text-white/50 transition-colors hover:text-white"
              >
                {t('discover.reset')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => {
              const on = platforms.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => platforms.toggle(p.id)}
                  className={`flex items-center gap-2 rounded-lg border p-1.5 pr-3 transition-all ${
                    on
                      ? 'border-brand-violet/60 bg-brand-violet/15 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {p.logo && <img src={p.logo} alt="" className="h-6 w-6 rounded-md" />}
                  <span className="text-sm font-medium">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Genres */}
      {genres.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveGenre(undefined)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-all ${
              activeGenre === undefined ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            {t('discover.all_genres')}
          </button>
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGenre(g.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-all ${
                activeGenre === g.id ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Advanced filters: release year + minimum rating */}
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-white/60">
          <span>{t('discover.year')}</span>
          <select
            value={year ?? ''}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 outline-none transition-colors hover:bg-white/10 focus:border-brand-violet/60"
          >
            <option value="">{t('discover.all_years')}</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y} className="bg-ink-900">
                {y}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60">{t('discover.min_rating')}</span>
          <div className="flex flex-wrap gap-1.5">
            {RATING_OPTIONS.map((r) => {
              const on = minRating === r;
              return (
                <button
                  key={r}
                  onClick={() => setMinRating(r)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                    on
                      ? 'bg-brand-gradient text-white shadow-glow'
                      : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {r === 0 ? (
                    t('discover.any_rating')
                  ) : (
                    <>
                      <Star className={`h-3.5 w-3.5 ${on ? 'fill-current' : 'fill-amber-400 text-amber-400'}`} />
                      {r}+
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-8">
        {error ? (
          <ErrorState message={error} onRetry={() => fetchPage(1, true)} />
        ) : !loading && items.length === 0 ? (
          <EmptyState
            title={t('discover.empty_title')}
            description={
              platformsActive ? t('discover.empty_platforms') : t('discover.empty_default')
            }
          />
        ) : (
          <>
            <MediaGrid items={items} loading={loading} />
            <div ref={sentinelRef} className="flex justify-center py-10">
              {loadingMore && <Spinner className="h-6 w-6 text-brand-cyan" />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
