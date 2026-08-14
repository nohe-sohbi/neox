import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Star, Undo2 } from 'lucide-react';
import { api, ApiError, getLocale } from '../../lib/api';
import { DEFAULT_TTL, queryCache } from '../../lib/query';
import type { MediaItem, SeasonDetail, SeasonSummary } from '../../lib/types';
import { formatEpisodeCode, orderedSeasons, seriesProgress } from '../../lib/seasons';
import { episodeCode } from '../../lib/library-utils';
import { useLibrary } from '../../context/LibraryContext';
import { stillImg } from '../../lib/img';
import { useT, activeLang } from '../../lib/i18n';
import { localeTag } from '../../lib/i18n/core';
import { Spinner } from '../ui/States';

function seasonLabel(
  season: SeasonSummary,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  if (season.name) return season.name;
  return season.seasonNumber === 0 ? t('season.specials') : t('season.number', { n: season.seasonNumber });
}

function airDateLabel(airDate: string): string {
  if (!airDate) return '';
  const date = new Date(airDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(localeTag(activeLang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function runtimeLabel(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`;
}

/**
 * Per-season episode browser for TV shows. Seasons load lazily (only when a tab
 * is selected) and are cached in-component, so switching back and forth never
 * refetches or flashes a spinner.
 */
/**
 * @remarks Mount this with a `key` tied to the show id so switching titles gets
 * a fresh instance (empty cache, first season selected) rather than reconciled
 * state from the previous show.
 */
export function SeasonBrowser({
  tvId,
  seasons,
  item,
}: {
  tvId: number;
  seasons: SeasonSummary[];
  item: MediaItem;
}) {
  const { t, tn } = useT();
  const { seenEpisodesOf, toggleEpisode, setSeasonSeen } = useLibrary();
  const seenCodes = seenEpisodesOf(item);
  const seen = new Set(seenCodes);
  // Progress across the whole show, not just the season on screen: "12/62"
  // is the number someone tracking a series actually wants.
  const overall = seriesProgress(seasons, seenCodes);
  const seenInSeason = (seasonNumber: number) => {
    let count = 0;
    for (const code of seen) if (code.startsWith(`${seasonNumber}:`)) count += 1;
    return count;
  };
  const ordered = orderedSeasons(seasons);
  const [selected, setSelected] = useState(ordered[0]?.seasonNumber ?? 0);
  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic request id so a slow response for a season the user already
  // switched away from is ignored instead of clobbering the current one.
  const reqId = useRef(0);

  // Roving tabindex: one tab stop for the whole tablist, arrows move between
  // seasons (wrapping), Home/End jump to the edges — the keyboard contract
  // role="tablist" promises.
  const tabRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const moveTo = (seasonNumber: number) => {
    setSelected(seasonNumber);
    tabRefs.current.get(seasonNumber)?.focus();
  };
  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const idx = ordered.findIndex((s) => s.seasonNumber === selected);
    if (idx === -1) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveTo(ordered[(idx + 1) % ordered.length].seasonNumber);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveTo(ordered[(idx - 1 + ordered.length) % ordered.length].seasonNumber);
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveTo(ordered[0].seasonNumber);
    } else if (e.key === 'End') {
      e.preventDefault();
      moveTo(ordered[ordered.length - 1].seasonNumber);
    }
  };

  // Seasons live in the shared query cache (keyed per show + season + locale)
  // rather than a per-mount Map, so closing and reopening the fiche keeps
  // them warm too.
  const load = useCallback(
    async (seasonNumber: number) => {
      const myReq = (reqId.current += 1);
      const locale = getLocale();
      const key = `season:${tvId}:${seasonNumber}:${locale.region}:${locale.language}`;
      const cached = queryCache.getFresh<SeasonDetail>(key, DEFAULT_TTL);
      if (cached) {
        setDetail(cached);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      setDetail(null);
      try {
        const data = await queryCache.fetch(key, () => api.season(tvId, seasonNumber));
        if (myReq === reqId.current) setDetail(data);
      } catch (err) {
        if (myReq === reqId.current) {
          setError(err instanceof ApiError ? err.message : t('common.load_error'));
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    },
    [tvId, t],
  );

  useEffect(() => {
    void load(selected);
  }, [selected, load]);

  if (ordered.length === 0) return null;

  const shownEpisodes = detail?.episodes.map((ep) => ep.episodeNumber) ?? [];
  const seenHere = detail ? seenInSeason(detail.seasonNumber) : 0;
  const wholeSeasonSeen = shownEpisodes.length > 0 && seenHere >= shownEpisodes.length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">
          {t('detail.episodes')}
        </h3>
        {overall.seen > 0 && (
          <p className="text-xs text-white/55">
            {t('season.series_progress', { seen: overall.seen, total: overall.total })}
          </p>
        )}
      </div>

      {/* Season selector */}
      <div
        className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label={t('detail.episodes')}
        onKeyDown={onTabKeyDown}
      >
        {ordered.map((season) => {
          const isActive = season.seasonNumber === selected;
          const seenCount = seenInSeason(season.seasonNumber);
          return (
            <button
              key={season.seasonNumber}
              ref={(el) => {
                if (el) tabRefs.current.set(season.seasonNumber, el);
                else tabRefs.current.delete(season.seasonNumber);
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setSelected(season.seasonNumber)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-white text-ink-950'
                  : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {seasonLabel(season, t)}
              {seenCount > 0 && (
                <span className={`ml-1.5 text-xs ${isActive ? 'text-ink-950/60' : 'text-white/40'}`}>
                  {seenCount}/{season.episodeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-white/50">
          <Spinner className="h-4 w-4 text-white/70" />
          {t('season.loading')}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-3 py-6 text-sm text-white/60">
          <span>{error}</span>
          <button onClick={() => load(selected)} className="btn-ghost px-3 py-1 text-xs">
            {t('error.retry')}
          </button>
        </div>
      )}

      {detail && !loading && !error && (
        <>
          {/* Ticking eight boxes to say "I watched season 1" is eight clicks
              for one fact. The same button unticks, because a mis-click on it
              costs exactly as much as the clicks it saved. */}
          {detail.episodes.length > 0 && (
            <div className="mb-3 flex justify-end">
              <button
                onClick={() =>
                  setSeasonSeen(item, detail.seasonNumber, shownEpisodes, !wholeSeasonSeen)
                }
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                {wholeSeasonSeen ? (
                  <>
                    <Undo2 className="h-3.5 w-3.5" />
                    {t('season.unmark_all')}
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-3.5 w-3.5" />
                    {t('season.mark_all')}
                  </>
                )}
              </button>
            </div>
          )}

          {detail.episodes.length === 0 ? (
            <p className="py-6 text-sm text-white/50">{t('season.empty')}</p>
          ) : (
            <ol className="space-y-3">
              {detail.episodes.map((ep) => {
                const still = ep.still ? stillImg(ep.still) : null;
                const air = airDateLabel(ep.airDate);
                const runtime = runtimeLabel(ep.runtime);
                const code = formatEpisodeCode(detail.seasonNumber, ep.episodeNumber);
                const isSeen = seen.has(episodeCode(detail.seasonNumber, ep.episodeNumber));
                return (
                  <li
                    key={ep.episodeNumber}
                    className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 sm:gap-4"
                  >
                    <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-ink-700 sm:w-40">
                      {still ? (
                        <img
                          src={still.src}
                          srcSet={still.srcSet}
                          sizes={still.sizes}
                          width={still.width}
                          height={still.height}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/30">
                          {formatEpisodeCode(detail.seasonNumber, ep.episodeNumber)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="truncate text-sm font-semibold text-white/90">
                          <span className="text-white/40">{code}</span> {ep.name}
                        </h4>
                        <span className="flex shrink-0 items-center gap-2">
                          {ep.rating != null && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/70">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {ep.rating.toFixed(1)}
                            </span>
                          )}
                          {/* Tick an episode off; the show lands in the library
                              as "watching" the first time. */}
                          <button
                            onClick={() =>
                              toggleEpisode(item, detail.seasonNumber, ep.episodeNumber)
                            }
                            aria-pressed={isSeen}
                            aria-label={
                              isSeen
                                ? t('episode.seen', { code })
                                : t('episode.mark_seen', { code })
                            }
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                              isSeen
                                ? 'bg-white text-ink-950'
                                : 'border border-white/15 bg-white/5 text-white/40 hover:border-white/40 hover:text-white'
                            }`}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-white/40">
                        {air && <span>{air}</span>}
                        {runtime && <span>{runtime}</span>}
                      </div>
                      {ep.overview && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/60">
                          {ep.overview}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}

      {/* Episode count + watched progress for the active season. */}
      {detail && !loading && !error && detail.episodes.length > 0 && (
        <p className="mt-3 text-xs text-white/55">
          {tn('season.episodes', detail.episodes.length)}
          {seenInSeason(detail.seasonNumber) > 0 &&
            ` · ${t('season.progress', {
              seen: seenInSeason(detail.seasonNumber),
              total: detail.episodes.length,
            })}`}
        </p>
      )}
    </div>
  );
}
