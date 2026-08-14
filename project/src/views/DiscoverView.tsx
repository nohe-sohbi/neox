import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shuffle, SlidersHorizontal, Star, X } from 'lucide-react';
import { api, ApiError, getLocale } from '../lib/api';
import { STATIC_TTL, queryCache } from '../lib/query';
import type { Genre, MediaItem, MediaType, Provider } from '../lib/types';
import { useMyPlatforms } from '../hooks/useMyPlatforms';
import { useOpenDetail } from '../hooks/useDetailRoute';
import { MediaGrid } from '../components/media/MediaGrid';
import { EmptyState, ErrorState } from '../components/ui/States';
import { LoadMore } from '../components/ui/LoadMore';
import { useT } from '../lib/i18n';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { routeMeta } from '../lib/routes';

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
  const { t, tn, formatNumber, lang } = useT();
  const platforms = useMyPlatforms();

  const [genres, setGenres] = useState<Genre[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showPlatforms, setShowPlatforms] = useState(false);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorts = mediaType === 'tv' ? TV_SORTS : MOVIE_SORTS;

  // Filters live in the URL (?genre=&sort=&year=&rating=), not in local state:
  // a filtered view can be shared, bookmarked, and comes back intact on
  // back-navigation. Malformed values just degrade to the defaults. Platforms
  // stay out of it: they're a personal, cross-view setting (localStorage), and
  // a shared link shouldn't impose the sender's subscriptions.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawGenre = Number(searchParams.get('genre'));
  const activeGenre = Number.isInteger(rawGenre) && rawGenre > 0 ? rawGenre : undefined;
  const sortParam = searchParams.get('sort') || '';
  const sort = sorts.some((s) => s.id === sortParam) ? sortParam : 'popularity.desc';
  const rawYear = Number(searchParams.get('year'));
  const year =
    Number.isInteger(rawYear) && rawYear >= 1950 && rawYear <= CURRENT_YEAR ? rawYear : undefined;
  const rawRating = Number(searchParams.get('rating'));
  const minRating = RATING_OPTIONS.includes(rawRating) ? rawRating : 0;

  // Patches the URL params, dropping cleared keys; `replace` so chip-clicking
  // doesn't stack a history entry per filter. Unrelated params (e.g. ?watch=)
  // are preserved.
  const setFilters = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '') next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // From the manifest the build prerendered this route's shell from, so the
  // head React applies is the one the crawler was already served.
  useDocumentMeta(routeMeta(mediaType === 'tv' ? 'tv' : 'movies', lang));

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
  const openDetail = useOpenDetail();
  const [surprising, setSurprising] = useState(false);

  // A dice roll that honors the current filters: pick a random page of the
  // same discover query, then a random title on it. TMDB caps discover at
  // 500 pages, and the deep pages of any sort are noise anyway — 20 is scope
  // enough for a surprise.
  const surpriseMe = useCallback(async () => {
    if (surprising) return;
    setSurprising(true);
    try {
      const opts = {
        genre: activeGenre,
        sort,
        year,
        minRating: minRating || undefined,
        providers: platformIds ? platformIds.split(',').map(Number) : undefined,
      };
      const first = await api.discover(mediaType, { ...opts, page: 1 });
      const pool = Math.max(1, Math.min(first.totalPages, 20));
      const page = 1 + Math.floor(Math.random() * pool);
      const res = page === 1 ? first : await api.discover(mediaType, { ...opts, page });
      const items = res.results.length ? res.results : first.results;
      if (items.length === 0) return;
      openDetail(items[Math.floor(Math.random() * items.length)]);
    } catch {
      /* a failed dice roll is no error worth an alert */
    } finally {
      setSurprising(false);
    }
  }, [surprising, mediaType, activeGenre, sort, year, minRating, platformIds, openDetail]);

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
        setTotalResults(res.totalResults);
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

  const hasMore = page < totalPages;
  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void fetchPage(page + 1, false);
  }, [fetchPage, loading, loadingMore, hasMore, page]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  const platformsActive = platforms.ids.length > 0;

  // What is actually narrowing the results, as removable chips. Four controls
  // live in three different places on this page (sort row, genre rail, year
  // select, rating buttons, platform sheet): with a genre scrolled out of
  // view and a rating set two rows down, an empty grid reads as "nothing
  // exists" rather than "you asked for a very specific thing".
  const activeFilters: { id: string; label: string; clear: () => void }[] = [];
  if (activeGenre !== undefined) {
    const genre = genres.find((g) => g.id === activeGenre);
    activeFilters.push({
      id: 'genre',
      label: genre ? genre.name : t('discover.genre_filter'),
      clear: () => setFilters({ genre: undefined }),
    });
  }
  if (year !== undefined) {
    activeFilters.push({
      id: 'year',
      label: String(year),
      clear: () => setFilters({ year: undefined }),
    });
  }
  if (minRating > 0) {
    activeFilters.push({
      id: 'rating',
      label: `${minRating}+`,
      clear: () => setFilters({ rating: undefined }),
    });
  }
  if (sort !== 'popularity.desc') {
    const active = sorts.find((s) => s.id === sort);
    if (active) {
      activeFilters.push({
        id: 'sort',
        label: t(active.key),
        clear: () => setFilters({ sort: undefined }),
      });
    }
  }
  if (platformsActive) {
    activeFilters.push({
      id: 'platforms',
      label: tn('discover.platforms_count', platforms.ids.length),
      clear: platforms.clear,
    });
  }

  const resetAll = () => {
    setFilters({ genre: undefined, year: undefined, rating: undefined, sort: undefined });
    platforms.clear();
  };

  return (
    <div className="container mx-auto px-6 pb-16 pt-28">
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
        {mediaType === 'tv' ? t('discover.tv_title') : t('discover.movies_title')}
      </h1>
      <p className="mt-1 text-white/50">
        {mediaType === 'tv' ? t('discover.tv_sub') : t('discover.movies_sub')}
      </p>
      {/* What the current filters actually yield; totalResults used to be
          fetched then thrown away. */}
      {!error && !loading && totalResults > 0 && (
        <p className="mt-1 text-sm text-white/45">
          {tn('discover.count', totalResults, { count: formatNumber(totalResults) })}
        </p>
      )}

      {/* Sort + platform toggle */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {sorts.map((s) => (
          <button
            key={s.id}
            onClick={() => setFilters({ sort: s.id === 'popularity.desc' ? undefined : s.id })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              sort === s.id
                ? 'bg-white text-ink-950'
                : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {t(s.key)}
          </button>
        ))}
        <button
          onClick={() => void surpriseMe()}
          disabled={surprising}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 transition-all hover:bg-white/10 disabled:opacity-60"
        >
          <Shuffle className={`h-4 w-4 ${surprising ? 'animate-spin' : ''}`} />
          {t('discover.surprise')}
        </button>
        <button
          onClick={() => setShowPlatforms((s) => !s)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
            platformsActive
              ? 'bg-white text-ink-950'
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
                      ? 'border-white/40 bg-white/12 text-white'
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
            onClick={() => setFilters({ genre: undefined })}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-all ${
              activeGenre === undefined ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            {t('discover.all_genres')}
          </button>
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => setFilters({ genre: g.id })}
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
            onChange={(e) => setFilters({ year: e.target.value || undefined })}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 outline-none transition-colors hover:bg-white/10 focus:border-white/40"
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
                  onClick={() => setFilters({ rating: r || undefined })}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${
                    on
                      ? 'bg-white text-ink-950'
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

      {/* Active filters, each removable, plus one control that clears the lot. */}
      {activeFilters.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-white/50">{t('discover.active_filters')}</span>
          {activeFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={filter.clear}
              aria-label={t('discover.remove_filter', { filter: filter.label })}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-white/90 transition-colors hover:bg-white/20"
            >
              {filter.label}
              <X className="h-3.5 w-3.5 text-white/60" />
            </button>
          ))}
          <button
            onClick={resetAll}
            className="text-sm text-white/50 underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            {t('discover.reset_all')}
          </button>
        </div>
      )}

      <div className="mt-8">
        {error ? (
          <ErrorState message={error} onRetry={() => fetchPage(1, true)} />
        ) : !loading && items.length === 0 ? (
          <EmptyState
            title={t('discover.empty_title')}
            description={
              platformsActive ? t('discover.empty_platforms') : t('discover.empty_default')
            }
            action={
              activeFilters.length > 0 ? (
                <button onClick={resetAll} className="btn-ghost">
                  {t('discover.reset_all')}
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <MediaGrid items={items} loading={loading} />
            <LoadMore
              sentinelRef={sentinelRef}
              hasMore={hasMore}
              loading={loadingMore}
              loaded={items.length}
              total={totalResults}
              onLoadMore={loadMore}
            />
          </>
        )}
      </div>
    </div>
  );
}
