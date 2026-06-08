import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { HomePayload, MediaItem } from '../lib/types';
import { Hero } from '../components/home/Hero';
import { MediaRow } from '../components/media/MediaRow';
import { ErrorState } from '../components/ui/States';

interface HomeViewProps {
  onOpen: (item: MediaItem) => void;
  isSaved: (item: MediaItem) => boolean;
  onToggleSave: (item: MediaItem) => void;
}

export function HomeView({ onOpen, isSaved, onToggleSave }: HomeViewProps) {
  const [data, setData] = useState<HomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .home()
      .then(setData)
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError
            ? err.code === 'TMDB_NOT_CONFIGURED'
              ? 'Le serveur n’a pas de clé TMDB configurée. Ajoute TMDB_API_KEY côté backend.'
              : err.message
            : 'Chargement impossible.',
        ),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (error) {
    return (
      <div className="pt-24">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <>
        <div className="skeleton h-[70vh] min-h-[460px] w-full" />
        <div className="container mx-auto space-y-10 px-6 py-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <MediaRow
              key={i}
              title=""
              items={[]}
              loading
              onOpen={onOpen}
              isSaved={isSaved}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="animate-fade-in">
      <Hero items={data.hero} onOpen={onOpen} isSaved={isSaved} onToggleSave={onToggleSave} />

      <div className="container mx-auto space-y-10 px-6 py-10">
        {data.rows.map((row) => (
          <MediaRow
            key={row.id}
            title={row.title}
            items={row.items}
            onOpen={onOpen}
            isSaved={isSaved}
            onToggleSave={onToggleSave}
          />
        ))}
      </div>
    </div>
  );
}
