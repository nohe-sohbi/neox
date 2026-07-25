import type { CSSProperties } from 'react';
import { Bookmark, Check, Film, Tv } from 'lucide-react';
import type { MediaItem } from '../../lib/types';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { useOpenDetail } from '../../hooks/useDetailRoute';
import { posterImg } from '../../lib/img';
import { useFilmColor } from '../../hooks/useFilmColor';
import { RatingBadge } from '../ui/RatingBadge';
import { useT } from '../../lib/i18n';

export function MediaCard({ item }: { item: MediaItem }) {
  const { t } = useT();
  const openDetail = useOpenDetail();
  const { isSaved, statusOf, toggle } = useLibrary();
  const toast = useToast();
  const saved = isSaved(item);
  const watched = statusOf(item) === 'watched';
  const poster = item.poster ? posterImg(item.poster) : null;
  // The card borrows the artwork's hue. Null until it resolves, and null
  // forever for a title with no poster: the neutral card is the default.
  const film = useFilmColor(item.poster);

  return (
    <article
      className="group relative w-full cursor-pointer"
      style={film ? ({ '--film': film.light } as CSSProperties) : undefined}
      onClick={() => openDetail(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail(item);
        }
      }}
    >
      {/* The light the poster casts behind itself, like a backlit frame in a
          foyer. It sits under the artwork and only appears on hover or focus. */}
      {film && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[8%] top-[10%] bottom-[18%] rounded-2xl bg-[var(--film)] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-50 group-focus-visible:opacity-50"
        />
      )}

      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-ink-800 shadow-card ring-1 ring-white/5 transition-all duration-300 group-hover:ring-[color-mix(in_srgb,var(--film,#ffffff)_55%,transparent)] group-focus-visible:ring-[color-mix(in_srgb,var(--film,#ffffff)_55%,transparent)]">
        {poster ? (
          <img
            src={poster.src}
            srcSet={poster.srcSet}
            sizes={poster.sizes}
            alt={item.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ink-700 text-white/30">
            {item.mediaType === 'tv' ? <Tv className="h-10 w-10" /> : <Film className="h-10 w-10" />}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <RatingBadge rating={item.rating} />
        </div>

        {watched ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
            <Check className="h-3 w-3" /> {t('filter.watched')}
          </span>
        ) : (
          <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/80 backdrop-blur-sm">
            {item.mediaType === 'tv' ? t('hero.series') : t('hero.movie')}
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            const added = toggle(item);
            toast.success(added ? t('toast.added') : t('toast.removed'));
          }}
          aria-label={saved ? t('card.remove') : t('card.add')}
          className={`absolute bottom-2 right-2 flex h-9 w-9 translate-y-2 items-center justify-center rounded-full backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 ${
            saved
              ? 'bg-[var(--film,theme(colors.white))] text-ink-950'
              : 'bg-black/60 text-white/80 hover:bg-black/80'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-semibold text-white/90 transition-colors group-hover:text-white">
          {item.title}
        </h3>
        <p className="text-xs text-white/55 transition-colors duration-300 group-hover:text-[var(--film,theme(colors.white))]">
          {item.year || '—'}
        </p>
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
