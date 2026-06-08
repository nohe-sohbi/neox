import { useEffect, useState } from 'react';
import { Bookmark, Info, Star } from 'lucide-react';
import type { MediaItem } from '../../lib/types';

interface HeroProps {
  items: MediaItem[];
  onOpen: (item: MediaItem) => void;
  isSaved: (item: MediaItem) => boolean;
  onToggleSave: (item: MediaItem) => void;
}

export function Hero({ items, onOpen, isSaved, onToggleSave }: HeroProps) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[active];
  const saved = isSaved(current);

  return (
    <section className="relative h-[70vh] min-h-[460px] w-full overflow-hidden">
      {/* Backdrops cross-fade */}
      {items.map((item, i) => (
        <div
          key={item.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === active ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {item.backdrop && (
            <img
              src={item.backdrop}
              alt=""
              className="h-full w-full object-cover object-top"
            />
          )}
        </div>
      ))}

      {/* Scrims */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/60 to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex h-full items-end pb-16">
        <div className="container mx-auto px-6">
          <div key={current.id} className="max-w-2xl animate-slide-up">
            <div className="mb-4 flex items-center gap-3 text-sm font-medium text-white/70">
              <span className="rounded-md bg-brand-gradient px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                {current.mediaType === 'tv' ? 'Série' : 'Film'}
              </span>
              {current.rating ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {current.rating.toFixed(1)}
                </span>
              ) : null}
              {current.year && <span>{current.year}</span>}
            </div>

            <h1 className="text-4xl font-extrabold leading-tight text-white text-shadow-glow sm:text-6xl">
              {current.title}
            </h1>

            <p className="mt-4 line-clamp-3 max-w-xl text-base text-white/70 sm:text-lg">
              {current.overview || 'Synopsis bientôt disponible.'}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={() => onOpen(current)} className="btn-primary">
                <Info className="h-5 w-5" />
                Voir les détails
              </button>
              <button onClick={() => onToggleSave(current)} className="btn-ghost">
                <Bookmark className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} />
                {saved ? 'Dans ma liste' : 'Ma liste'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
      {items.length > 1 && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setActive(i)}
              aria-label={`Aller à la diapositive ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? 'w-8 bg-brand-gradient' : 'w-2 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
