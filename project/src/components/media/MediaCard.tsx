import { Bookmark, Film, Tv } from 'lucide-react';
import type { MediaItem } from '../../lib/types';
import { RatingBadge } from '../ui/RatingBadge';

interface MediaCardProps {
  item: MediaItem;
  onOpen: (item: MediaItem) => void;
  saved?: boolean;
  onToggleSave?: (item: MediaItem) => void;
}

export function MediaCard({ item, onOpen, saved, onToggleSave }: MediaCardProps) {
  return (
    <article
      className="group relative w-full cursor-pointer"
      onClick={() => onOpen(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-ink-800 shadow-card ring-1 ring-white/5 transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-glow group-hover:ring-brand-violet/40">
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ink-700 text-white/30">
            {item.mediaType === 'tv' ? (
              <Tv className="h-10 w-10" />
            ) : (
              <Film className="h-10 w-10" />
            )}
          </div>
        )}

        {/* Hover gradient + overlay meta */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <RatingBadge rating={item.rating} />
        </div>

        <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80 backdrop-blur-sm">
          {item.mediaType === 'tv' ? 'Série' : 'Film'}
        </span>

        {onToggleSave && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(item);
            }}
            aria-label={saved ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
            className={`absolute bottom-2 right-2 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 ${
              saved
                ? 'bg-brand-gradient text-white shadow-glow'
                : 'bg-black/60 text-white/80 hover:bg-black/80'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-semibold text-white/90 transition-colors group-hover:text-white">
          {item.title}
        </h3>
        <p className="text-xs text-white/40">{item.year || '—'}</p>
      </div>
    </article>
  );
}

export function MediaCardSkeleton() {
  return (
    <div className="w-full">
      <div className="skeleton aspect-[2/3] rounded-xl" />
      <div className="skeleton mt-2.5 h-3.5 w-3/4 rounded" />
      <div className="skeleton mt-2 h-3 w-1/3 rounded" />
    </div>
  );
}
