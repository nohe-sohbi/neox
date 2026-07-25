import { useCallback, useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { SeasonDetail, SeasonSummary } from '../../lib/types';
import { formatEpisodeCode, orderedSeasons } from '../../lib/seasons';
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
export function SeasonBrowser({ tvId, seasons }: { tvId: number; seasons: SeasonSummary[] }) {
  const { t, tn } = useT();
  const ordered = orderedSeasons(seasons);
  const [selected, setSelected] = useState(ordered[0]?.seasonNumber ?? 0);
  const [detail, setDetail] = useState<SeasonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<number, SeasonDetail>>(new Map());
  // Monotonic request id so a slow response for a season the user already
  // switched away from is ignored instead of clobbering the current one.
  const reqId = useRef(0);

  const load = useCallback(
    async (seasonNumber: number) => {
      const myReq = (reqId.current += 1);
      const cached = cache.current.get(seasonNumber);
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
        const data = await api.season(tvId, seasonNumber);
        cache.current.set(seasonNumber, data);
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

  return (
    <div>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/50">
        {t('detail.episodes')}
      </h3>

      {/* Season selector */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {ordered.map((season) => {
          const isActive = season.seasonNumber === selected;
          return (
            <button
              key={season.seasonNumber}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelected(season.seasonNumber)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-brand-gradient text-white shadow-glow'
                  : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {seasonLabel(season, t)}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-8 text-sm text-white/50">
          <Spinner className="h-4 w-4 text-brand-cyan" />
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
          {detail.episodes.length === 0 ? (
            <p className="py-6 text-sm text-white/50">{t('season.empty')}</p>
          ) : (
            <ol className="space-y-3">
              {detail.episodes.map((ep) => {
                const still = ep.still ? stillImg(ep.still) : null;
                const air = airDateLabel(ep.airDate);
                const runtime = runtimeLabel(ep.runtime);
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
                          <span className="text-white/40">
                            {formatEpisodeCode(detail.seasonNumber, ep.episodeNumber)}
                          </span>{' '}
                          {ep.name}
                        </h4>
                        {ep.rating != null && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-white/70">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {ep.rating.toFixed(1)}
                          </span>
                        )}
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

      {/* Screen-reader friendly episode count for the active season. */}
      {detail && !loading && !error && detail.episodes.length > 0 && (
        <p className="mt-3 text-xs text-white/55">
          {tn('season.episodes', detail.episodes.length)}
        </p>
      )}
    </div>
  );
}
