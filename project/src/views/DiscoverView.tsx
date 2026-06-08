import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Genre, MediaItem, MediaType } from '../lib/types';
import { MediaGrid } from '../components/media/MediaGrid';
import { EmptyState, ErrorState, Spinner } from '../components/ui/States';

interface DiscoverViewProps {
  mediaType: MediaType;
  onOpen: (item: MediaItem) => void;
  isSaved: (item: MediaItem) => boolean;
  onToggleSave: (item: MediaItem) => void;
}

const SORTS: { id: string; label: string }[] = [
  { id: 'popularity.desc', label: 'Populaires' },
  { id: 'vote_average.desc', label: 'Les mieux notés' },
  { id: 'primary_release_date.desc', label: 'Récents' },
  { id: 'revenue.desc', label: 'Box-office' },
];

const TV_SORTS: { id: string; label: string }[] = [
  { id: 'popularity.desc', label: 'Populaires' },
  { id: 'vote_average.desc', label: 'Les mieux notées' },
  { id: 'first_air_date.desc', label: 'Récentes' },
];

export function DiscoverView({ mediaType, onOpen, isSaved, onToggleSave }: DiscoverViewProps) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [activeGenre, setActiveGenre] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState('popularity.desc');

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorts = mediaType === 'tv' ? TV_SORTS : SORTS;

  // Reset when switching media type.
  useEffect(() => {
    setActiveGenre(undefined);
    setSort('popularity.desc');
  }, [mediaType]);

  // Load genres for the current media type.
  useEffect(() => {
    let cancelled = false;
    api
      .genres(mediaType)
      .then((res) => {
        if (!cancelled) setGenres(res.genres);
      })
      .catch(() => {
        if (!cancelled) setGenres([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaType]);

  const fetchPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await api.discover(mediaType, { genre: activeGenre, sort, page: targetPage });
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
    [mediaType, activeGenre, sort],
  );

  // Reload first page whenever filters change.
  useEffect(() => {
    void fetchPage(1, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchPage]);

  // Infinite scroll sentinel.
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

      {/* Sort */}
      <div className="mt-6 flex flex-wrap gap-2">
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
      </div>

      {/* Genres */}
      {genres.length > 0 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveGenre(undefined)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-all ${
              activeGenre === undefined
                ? 'bg-white/15 text-white'
                : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            Tous
          </button>
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGenre(g.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-all ${
                activeGenre === g.id
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-white/60 hover:text-white'
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
          <EmptyState title="Rien à afficher" description="Essaie un autre filtre." />
        ) : (
          <>
            <MediaGrid
              items={items}
              loading={loading}
              onOpen={onOpen}
              isSaved={isSaved}
              onToggleSave={onToggleSave}
            />
            <div ref={sentinelRef} className="flex justify-center py-10">
              {loadingMore && <Spinner className="h-6 w-6 text-brand-cyan" />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
