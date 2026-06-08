import { useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { Genre, MediaItem, MediaType, Provider } from '../lib/types';
import { useMyPlatforms } from '../hooks/useMyPlatforms';
import { MediaGrid } from '../components/media/MediaGrid';
import { EmptyState, ErrorState, Spinner } from '../components/ui/States';

const MOVIE_SORTS = [
  { id: 'popularity.desc', label: 'Populaires' },
  { id: 'vote_average.desc', label: 'Les mieux notés' },
  { id: 'primary_release_date.desc', label: 'Récents' },
  { id: 'revenue.desc', label: 'Box-office' },
];

const TV_SORTS = [
  { id: 'popularity.desc', label: 'Populaires' },
  { id: 'vote_average.desc', label: 'Les mieux notées' },
  { id: 'first_air_date.desc', label: 'Récentes' },
];

export function DiscoverView({ mediaType }: { mediaType: MediaType }) {
  const platforms = useMyPlatforms();

  const [genres, setGenres] = useState<Genre[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeGenre, setActiveGenre] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState('popularity.desc');
  const [showPlatforms, setShowPlatforms] = useState(false);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorts = mediaType === 'tv' ? TV_SORTS : MOVIE_SORTS;

  useEffect(() => {
    setActiveGenre(undefined);
    setSort('popularity.desc');
  }, [mediaType]);

  // Genres + providers for this media type.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.genres(mediaType), api.providers(mediaType)])
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
          page: targetPage,
          providers: platformIds ? platformIds.split(',').map(Number) : undefined,
        });
        setTotalPages(res.totalPages);
        setPage(res.page);
        setItems((prev) => (replace ? res.results : [...prev, ...res.results]));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Chargement impossible.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [mediaType, activeGenre, sort, platformIds],
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
      <h1 className="text-3xl font-extrabold sm:text-4xl">
        {mediaType === 'tv' ? 'Séries' : 'Films'}
      </h1>
      <p className="mt-1 text-white/50">
        {mediaType === 'tv'
          ? 'Des pépites à binge-watcher, triées sur le volet.'
          : 'Du blockbuster au film culte — explore, filtre, trouve ta prochaine séance.'}
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
            {s.label}
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
          Mes plateformes
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
              Affiche uniquement ce qui est dispo sur tes services
            </p>
            {platformsActive && (
              <button
                onClick={platforms.clear}
                className="text-xs text-white/50 transition-colors hover:text-white"
              >
                Réinitialiser
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
            Tous
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

      <div className="mt-8">
        {error ? (
          <ErrorState message={error} onRetry={() => fetchPage(1, true)} />
        ) : !loading && items.length === 0 ? (
          <EmptyState
            title="Rien à afficher"
            description={
              platformsActive
                ? 'Aucun titre ne correspond à tes plateformes avec ce filtre. Élargis ta sélection.'
                : 'Essaie un autre filtre.'
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
