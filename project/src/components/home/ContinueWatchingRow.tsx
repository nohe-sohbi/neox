import { useEffect, useState } from 'react';
import { Check, PlayCircle } from 'lucide-react';
import { api, getLocale } from '../../lib/api';
import { DEFAULT_TTL, queryCache } from '../../lib/query';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { isModifiedClick, useOpenDetail } from '../../hooks/useDetailRoute';
import { detailPath } from '../../lib/routes';
import { formatEpisodeCode, nextUnseenEpisode, seriesProgress } from '../../lib/seasons';
import { posterImg } from '../../lib/img';
import type { LibraryEntry, MediaDetails } from '../../lib/types';
import { useT } from '../../lib/i18n';

/** How many shows the rail follows. Beyond that it stops being a shortlist. */
const MAX_SHOWS = 6;

interface Resumable {
  entry: LibraryEntry;
  details: MediaDetails;
  next: { seasonNumber: number; episodeNumber: number };
  progress: { seen: number; total: number };
}

/**
 * "Pick your series back up": for every show you're in the middle of, the next
 * episode you haven't ticked — and a button to tick it.
 *
 * The library knows which episodes you've seen but not how many a season has,
 * so the season index comes from each show's fiche. Those reads go through the
 * shared query cache, which the fiche fills too: opening a show and coming
 * back to Home costs no extra request.
 */
export function ContinueWatchingRow() {
  const { t } = useT();
  const { entries, toggleEpisode } = useLibrary();
  const openDetail = useOpenDetail();
  const toast = useToast();
  const [resumable, setResumable] = useState<Resumable[]>([]);

  // Shows in progress, most recently touched first. Only entries with at least
  // one ticked episode: an untouched "watching" show has nothing to resume,
  // and its fiche is one click away on the card anyway.
  const watching = entries
    .filter((e) => e.mediaType === 'tv' && e.status === 'watching' && (e.seenEpisodes?.length ?? 0) > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SHOWS);

  // Signature of the shows *and* their progress: ticking an episode from the
  // rail must move the rail on to the next one.
  const signature = watching
    .map((e) => `${e.id}:${(e.seenEpisodes ?? []).length}`)
    .join(',');

  useEffect(() => {
    if (watching.length === 0) {
      setResumable([]);
      return;
    }
    let cancelled = false;
    const locale = getLocale();

    Promise.all(
      watching.map(async (entry) => {
        const key = `details:tv:${entry.id}:${locale.region}:${locale.language}`;
        try {
          const cached = queryCache.getFresh<MediaDetails>(key, DEFAULT_TTL);
          const details = cached ?? (await queryCache.fetch(key, () => api.details('tv', entry.id)));
          const seen = entry.seenEpisodes ?? [];
          const next = nextUnseenEpisode(details.seasons, seen);
          if (!next) return null; // fully watched: nothing to resume
          return { entry, details, next, progress: seriesProgress(details.seasons, seen) };
        } catch {
          // A show whose fiche won't load simply doesn't appear in the rail.
          return null;
        }
      }),
    ).then((rows) => {
      if (!cancelled) setResumable(rows.filter((r): r is Resumable => r !== null));
    });

    return () => {
      cancelled = true;
    };
    // `signature` is the real input: it captures both the show set and their
    // progress, while `watching` is a fresh array on every library change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (resumable.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 px-1 text-lg font-bold tracking-tight text-white sm:text-xl">
        <PlayCircle className="h-5 w-5 text-white/50" />
        {t('home.continue')}
      </h2>

      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {resumable.map(({ entry, details, next, progress }) => {
          const poster = entry.poster ? posterImg(entry.poster, '160px') : null;
          const code = formatEpisodeCode(next.seasonNumber, next.episodeNumber);
          const pct = progress.total ? Math.round((progress.seen / progress.total) * 100) : 0;
          return (
            <article
              key={`${entry.mediaType}-${entry.id}`}
              className="flex w-72 shrink-0 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <a
                href={detailPath('tv', entry.id)}
                onClick={(e) => {
                  if (isModifiedClick(e)) return;
                  e.preventDefault();
                  openDetail(details);
                }}
                className="w-16 shrink-0"
                tabIndex={-1}
                aria-hidden={poster ? undefined : true}
              >
                {poster && (
                  <img
                    src={poster.src}
                    srcSet={poster.srcSet}
                    sizes={poster.sizes}
                    width={poster.width}
                    height={poster.height}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-white/10"
                  />
                )}
              </a>

              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="truncate text-sm font-semibold text-white/90">
                  <a
                    href={detailPath('tv', entry.id)}
                    onClick={(e) => {
                      if (isModifiedClick(e)) return;
                      e.preventDefault();
                      openDetail(details);
                    }}
                    className="outline-none transition-colors hover:text-white"
                  >
                    {entry.title}
                  </a>
                </h3>
                <p className="mt-0.5 text-xs text-white/60">
                  {t('home.continue_next', { code })}
                </p>

                <div
                  className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                  aria-valuenow={progress.seen}
                  aria-label={t('season.series_progress', {
                    seen: progress.seen,
                    total: progress.total,
                  })}
                >
                  <div className="h-full rounded-full bg-white/70" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-white/40">
                  {t('season.series_progress', { seen: progress.seen, total: progress.total })}
                </p>

                <button
                  onClick={() => {
                    toggleEpisode(details, next.seasonNumber, next.episodeNumber);
                    toast.success(t('toast.episode_marked', { code }));
                  }}
                  className="mt-2 inline-flex items-center justify-center gap-1.5 self-start rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t('home.continue_mark', { code })}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
