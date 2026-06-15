import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MediaItem } from '../../lib/types';
import { MediaCard, MediaCardSkeleton } from './MediaCard';
import { useT } from '../../lib/i18n';

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  loading?: boolean;
  icon?: ReactNode;
}

export function MediaRow({ title, items, loading, icon }: MediaRowProps) {
  const { t } = useT();
  const railRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: dir * rail.clientWidth * 0.85, behavior: 'smooth' });
  };

  if (!loading && items.length === 0) return null;

  return (
    <section className="group/row relative">
      <div className="mb-3 flex items-end justify-between px-1">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white sm:text-xl">
          {icon}
          {title}
        </h2>
        <div className="hidden gap-2 sm:flex">
          <button
            onClick={() => scrollBy(-1)}
            aria-label={t('row.prev')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy(1)}
            aria-label={t('row.next')}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="no-scrollbar mask-fade-r flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-[42vw] shrink-0 snap-start sm:w-44 md:w-48">
                <MediaCardSkeleton />
              </div>
            ))
          : items.map((item) => (
              <div
                key={`${item.mediaType}-${item.id}`}
                className="w-[42vw] shrink-0 snap-start sm:w-44 md:w-48"
              >
                <MediaCard item={item} />
              </div>
            ))}
      </div>
    </section>
  );
}
