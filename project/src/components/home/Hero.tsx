import { useEffect, useState } from 'react';
import { Bookmark, Info, Pause, Play, Star } from 'lucide-react';
import type { MediaItem } from '../../lib/types';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { useOpenDetail } from '../../hooks/useDetailRoute';
import { backdropImg } from '../../lib/img';
import { useFilmColor } from '../../hooks/useFilmColor';
import type { CSSProperties } from 'react';
import { useT } from '../../lib/i18n';

export function Hero({ items }: { items: MediaItem[] }) {
  const { t } = useT();
  const openDetail = useOpenDetail();
  const { isSaved, toggle } = useLibrary();
  const toast = useToast();
  const [active, setActive] = useState(0);
  // WCAG 2.2.2: anything that auto-advances must be stoppable by the user.
  const [paused, setPaused] = useState(false);
  // Highest slide reached so far. Every slide used to be mounted from the
  // start: `opacity-0` hides an image, it does not stop the browser
  // downloading it, so the hero pulled five full-width backdrops before the
  // first one had finished — in front of the LCP element, which is one of them.
  const [reached, setReached] = useState(0);
  useEffect(() => setReached((max) => Math.max(max, active)), [active]);

  // Auto-advance, unless the user asked it to hold still.
  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const id = setInterval(() => setActive((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(id);
  }, [items.length, paused]);

  // Preload the next backdrop for a seamless cross-fade. Through the same
  // srcset the slide will render with, so the browser warms the variant it is
  // actually going to use instead of a second, wider one.
  useEffect(() => {
    if (items.length <= 1) return;
    const next = items[(active + 1) % items.length];
    if (!next?.backdrop) return;
    const bd = backdropImg(next.backdrop);
    const img = new Image();
    if (bd.srcSet) img.srcset = bd.srcSet;
    if (bd.sizes) img.sizes = bd.sizes;
    img.src = bd.src;
  }, [active, items]);

  // Every hook runs before the empty-list guard: an early return above a hook
  // changes the hook order the moment the payload arrives, which React treats
  // as a different component.
  const current = items[active];
  const film = useFilmColor(current?.poster);

  if (items.length === 0 || !current) return null;
  const saved = isSaved(current);

  return (
    <section
      className="relative h-[70vh] min-h-[460px] w-full overflow-hidden"
      style={film ? ({ '--film': film.light } as CSSProperties) : undefined}
    >
      {items.map((item, i) => {
        // Not yet shown, and the next one is warmed by the effect above, so
        // there is nothing to render and nothing to fetch.
        if (i > reached) return null;
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
                width={bd.width}
                height={bd.height}
                alt=""
                // The first slide is the largest thing above the fold, so it is
                // the LCP element on the home page: it goes to the front of the
                // queue instead of competing with the bundle.
                fetchPriority={i === 0 ? 'high' : 'auto'}
                decoding={i === 0 ? 'sync' : 'async'}
                className="h-full w-full object-cover object-top"
              />
            )}
          </div>
        );
      })}

      {/* The veil that lifts the title off the artwork. Neutral by default; once
          the poster's hue is known it takes that temperature, so the whole hero
          changes colour as the carousel advances. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent"
        style={film ? ({ '--tw-gradient-via': `${film.veil}99` } as CSSProperties) : undefined}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/60 to-transparent" />
      {film && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background: `radial-gradient(90% 120% at 10% 92%, ${film.veil} 0%, transparent 62%)`,
          }}
        />
      )}

      <div className="relative z-10 flex h-full items-end pb-16">
        <div className="container mx-auto px-6">
          <div key={current.id} className="max-w-2xl animate-slide-up">
            <div className="mb-4 flex items-center gap-3 text-sm font-medium text-white/70">
              <span className="rounded-md bg-[var(--film,theme(colors.white))] px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-ink-950">
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

            {/* h2, not h1: this is one slide of a rotating carousel, and the
                page's heading is the site's own (see HomeView). */}
            <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-balance text-white text-shadow-glow sm:text-6xl">
              {current.title}
            </h2>

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
          <button
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? t('hero.play') : t('hero.pause')}
            aria-pressed={paused}
            className="mr-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:text-white"
          >
            {paused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3 fill-current" />}
          </button>
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
                    ? 'w-8 bg-[var(--film,theme(colors.white))]'
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
