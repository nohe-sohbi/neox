import { useEffect, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { MediaItem } from '../lib/types';
import { useDebounce } from '../hooks/useDebounce';
import { MediaGrid } from '../components/media/MediaGrid';
import { EmptyState, ErrorState } from '../components/ui/States';

interface SearchViewProps {
  query: string;
  onOpen: (item: MediaItem) => void;
  isSaved: (item: MediaItem) => boolean;
  onToggleSave: (item: MediaItem) => void;
}

export function SearchView({ query, onOpen, isSaved, onToggleSave }: SearchViewProps) {
  const debounced = useDebounce(query.trim(), 350);
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
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Recherche impossible.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="container mx-auto px-6 pb-16 pt-28">
      <h1 className="mb-1 text-2xl font-extrabold sm:text-3xl">
        {debounced ? (
          <>
            Résultats pour <span className="text-gradient">«&nbsp;{debounced}&nbsp;»</span>
          </>
        ) : (
          'Recherche'
        )}
      </h1>
      {debounced && !loading && !error && (
        <p className="mb-6 text-sm text-white/50">
          {total.toLocaleString('fr-FR')} résultat{total > 1 ? 's' : ''}
        </p>
      )}

      {error ? (
        <ErrorState message={error} />
      ) : !debounced ? (
        <EmptyState
          icon={<Sparkles className="h-12 w-12" />}
          title="Qu’as-tu envie de regarder ce soir ?"
          description="Tape le titre d’un film ou d’une série, on te dit instantanément où le voir légalement."
        />
      ) : loading ? (
        <MediaGrid items={[]} loading onOpen={onOpen} isSaved={isSaved} onToggleSave={onToggleSave} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search className="h-12 w-12" />}
          title="Aucun résultat"
          description={`Rien trouvé pour «${debounced}». Vérifie l’orthographe ou essaie un autre titre.`}
        />
      ) : (
        <div className="animate-fade-in">
          <MediaGrid
            items={results}
            onOpen={onOpen}
            isSaved={isSaved}
            onToggleSave={onToggleSave}
          />
        </div>
      )}
    </div>
  );
}
