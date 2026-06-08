import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Cloud, Loader2, Trash2 } from 'lucide-react';
import type { LibraryEntry, LibraryStatus, MediaItem } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import { MediaGrid } from '../components/media/MediaGrid';
import { EmptyState } from '../components/ui/States';

type Filter = 'all' | LibraryStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'want', label: 'À voir' },
  { id: 'watched', label: 'Vu' },
];

// LibraryEntry carries everything MediaCard needs; pad the rest for the type.
function toMediaItem(entry: LibraryEntry): MediaItem {
  return {
    id: entry.id,
    mediaType: entry.mediaType,
    title: entry.title,
    originalTitle: '',
    overview: '',
    poster: entry.poster,
    backdrop: null,
    year: entry.year,
    rating: entry.rating,
    voteCount: 0,
    popularity: 0,
  };
}

export function LibraryView({ onOpenAuth }: { onOpenAuth: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entries, clear, syncing } = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = {
    all: entries.length,
    want: entries.filter((e) => e.status === 'want').length,
    watched: entries.filter((e) => e.status === 'watched').length,
  };

  const filtered = entries
    .filter((e) => filter === 'all' || e.status === filter)
    .sort((a, b) => b.addedAt - a.addedAt)
    .map(toMediaItem);

  return (
    <div className="container mx-auto px-6 pb-16 pt-28">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold sm:text-4xl">
            Ma liste
            {syncing && <Loader2 className="h-5 w-5 animate-spin text-brand-cyan" />}
          </h1>
          <p className="mt-1 text-white/50">
            {entries.length > 0
              ? `${entries.length} titre${entries.length > 1 ? 's' : ''} dans ta collection.`
              : 'Ta sélection perso, sauvegardée et synchronisée.'}
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={clear}
            className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            Tout effacer
          </button>
        )}
      </div>

      {/* Sync banner for logged-out users */}
      {!user && entries.length > 0 && (
        <button
          onClick={onOpenAuth}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-brand-violet/30 bg-brand-violet/10 p-4 text-left transition-colors hover:bg-brand-violet/15"
        >
          <Cloud className="h-6 w-6 shrink-0 text-brand-cyan" />
          <div>
            <p className="font-semibold text-white">Sauvegarde ta liste dans le cloud</p>
            <p className="text-sm text-white/60">
              Crée un compte gratuit pour retrouver ta collection sur tous tes appareils.
            </p>
          </div>
        </button>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-12 w-12" />}
          title="Ta liste est vide"
          description="Repère un film ou une série qui te tente et clique sur le marque-page. On garde tout au chaud ici."
          action={
            <button onClick={() => navigate('/movies')} className="btn-primary">
              Explorer le catalogue
            </button>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                  filter === f.id
                    ? 'bg-brand-gradient text-white shadow-glow'
                    : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {f.label}
                <span className="ml-1.5 text-white/50">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={filter === 'want' ? 'Rien à voir ici… encore' : 'Aucun titre vu'}
              description={
                filter === 'want'
                  ? 'Ajoute des titres à voir depuis leur fiche.'
                  : 'Marque des titres comme « vus » pour les retrouver ici.'
              }
            />
          ) : (
            <div className="animate-fade-in">
              <MediaGrid items={filtered} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
