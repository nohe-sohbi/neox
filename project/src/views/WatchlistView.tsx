import { Bookmark, Trash2 } from 'lucide-react';
import type { MediaItem } from '../lib/types';
import { MediaGrid } from '../components/media/MediaGrid';
import { EmptyState } from '../components/ui/States';

interface WatchlistViewProps {
  items: MediaItem[];
  onOpen: (item: MediaItem) => void;
  isSaved: (item: MediaItem) => boolean;
  onToggleSave: (item: MediaItem) => void;
  onClear: () => void;
  onBrowse: () => void;
}

export function WatchlistView({
  items,
  onOpen,
  isSaved,
  onToggleSave,
  onClear,
  onBrowse,
}: WatchlistViewProps) {
  return (
    <div className="container mx-auto px-6 pb-16 pt-28">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Ma liste</h1>
          <p className="mt-1 text-white/50">
            {items.length > 0
              ? `${items.length} titre${items.length > 1 ? 's' : ''} à ne pas oublier.`
              : 'Ta sélection perso, sauvegardée sur cet appareil.'}
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            Tout effacer
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-12 w-12" />}
          title="Ta liste est vide"
          description="Repère un film ou une série qui te tente et clique sur le marque-page. On garde tout au chaud ici."
          action={
            <button onClick={onBrowse} className="btn-primary">
              Explorer le catalogue
            </button>
          }
        />
      ) : (
        <div className="animate-fade-in">
          <MediaGrid
            items={items}
            onOpen={onOpen}
            isSaved={isSaved}
            onToggleSave={onToggleSave}
          />
        </div>
      )}
    </div>
  );
}
