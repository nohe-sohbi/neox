import { useEffect, useState } from 'react';
import { Bookmark, Info, Star } from 'lucide-react';
import type { MediaItem } from '../../lib/types';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { useOpenDetail } from '../../hooks/useDetailRoute';
import { backdropImg } from '../../lib/img';
import { useT } from '../../lib/i18n';

export function Hero({ items }: { items: MediaItem[] }) {
  const { t } = useT();
  const openDetail = useOpenDetail();
  const { isSaved, toggle } = useLibrary();
  const toast = useToast();
  const [active, setActive] = useState(0);

  // Auto-advance.
  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(id);
  }, [items.length]);

  // Preload the next backdrop for a seamless cross-fade.
  useEffect(() => {
    if (items.length <= 1) return;
    const next = items[(active + 1) % items.length];
    if (next?.backdrop) {
      const img = new Image();
      img.src = next.backdrop;
    }
  }, [active, items]);

  if (items.length === 0) return null;
  const current = items[active];
  const saved = isSaved(current);

  return (
    <section className="relative h-[70vh] min-h-[460px] w-full overflow-hidden">
      {items.map((item, i) => {
        const bd = item.backdrop ? backdropImg(item.backdrop) : null;
        return (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              i === active ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {bd && (
              <img
                src={bd.src}
                srcSet={bd.srcSet}
                sizes={bd.sizes}
                alt=""
                decoding="async"
                className="h-full w-full object-cover object-top"
              />
            )}
          </div>
        );
      })}

      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/60 to-transparent" />

      <div className="relative z-10 flex h-full items-end pb-16">
        <div className="container mx-auto px-6">
          <div key={current.id} className="max-w-2xl animate-slide-up">
            <div className="mb-4 flex items-center gap-3 text-sm font-medium text-white/70">
              <span className="rounded-md bg-brand-gradient px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                {current.mediaType === 'tv' ? t('hero.series') : t('hero.movie')}
              </span>
              {current.rating ? (
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {current.rating.toFixed(1)}
                </span>
              ) : null}
              {current.year && <span>{current.year}</span>}
            </div>

            <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-balance text-white text-shadow-glow sm:text-6xl">
              {current.title}
            </h1>

            <p className="mt-4 line-clamp-3 max-w-xl text-base text-white/70 sm:text-lg">
              {current.overview || t('hero.no_synopsis')}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={() => openDetail(current)} className="btn-primary">
                <Info className="h-5 w-5" />
                {t('hero.details')}
              </button>
              <button
                onClick={() => {
                  const added = toggle(current);
                  toast.success(added ? t('toast.added') : t('toast.removed'));
                }}
                className="btn-ghost"
              >
                <Bookmark className={`h-5 w-5 ${saved ? 'fill-current' : ''}`} />
                {saved ? t('hero.in_list') : t('hero.add_list')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1">
          {items.map((item, i) => (
            // The bar stays 6px tall, but the button carries vertical padding so the
            // hit area clears the 24x24 floor of WCAG 2.5.8 on a touch screen.
            <button
              key={item.id}
              onClick={() => setActive(i)}
              aria-label={t('hero.goto_slide', { n: i + 1 })}
              aria-current={i === active}
              className="group flex h-6 items-center px-1"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === active
                    ? 'w-8 bg-brand-gradient'
                    : 'w-2 bg-white/40 group-hover:bg-white/70'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
