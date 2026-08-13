import { useState } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';
import type { LibraryEntry } from '../../lib/types';
import { computeStats } from '../../lib/library-stats';
import { useT } from '../../lib/i18n';

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-surface flex flex-col justify-center px-4 py-3">
      <span className="text-2xl font-extrabold tabular-nums text-white">{value}</span>
      <span className="mt-0.5 text-xs font-medium text-white/50">{label}</span>
      {sub && <span className="text-[11px] text-white/35">{sub}</span>}
    </div>
  );
}

/**
 * Collapsible "your taste in numbers" panel. Reads nothing the app doesn't
 * already store; all the maths live in the pure, tested `computeStats`.
 */
export function LibraryStats({ entries }: { entries: LibraryEntry[] }) {
  const { t, formatNumber } = useT();
  const [open, setOpen] = useState(false);
  const stats = computeStats(entries);

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const maxBar = Math.max(1, ...stats.ratingDistribution);

  return (
    <section className="mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-left text-sm font-semibold text-white/80 transition-colors hover:bg-white/10"
      >
        <BarChart3 className="h-4 w-4 text-white/50" />
        {open ? t('stats.hide') : t('stats.show')}
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="animate-fade-in mt-3 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Tile label={t('stats.total')} value={formatNumber(stats.total)} />
            <Tile
              label={t('stats.watched')}
              value={formatNumber(stats.watched)}
              sub={t('stats.completion', { pct: pct(stats.completionRate) })}
            />
            <Tile label={t('stats.watching')} value={formatNumber(stats.watching)} />
            <Tile label={t('stats.want')} value={formatNumber(stats.want)} />
            <Tile
              label={t('stats.split')}
              value={`${formatNumber(stats.movies)} / ${formatNumber(stats.tv)}`}
              sub={`${t('stats.movies')} / ${t('stats.tv')}`}
            />
            <Tile
              label={t('stats.avg_rating')}
              value={stats.avgPersonalRating != null ? stats.avgPersonalRating.toFixed(1) : '—'}
              sub={
                stats.ratedCount > 0
                  ? t('stats.rated_count', { count: formatNumber(stats.ratedCount) })
                  : undefined
              }
            />
            {/* Computed since day one, displayed never — until now. The delta
                says whether you rate above or below the TMDB crowd. */}
            <Tile
              label={t('stats.avg_tmdb')}
              value={stats.avgTmdbRating != null ? stats.avgTmdbRating.toFixed(1) : '—'}
              sub={
                stats.personalVsTmdb != null
                  ? t('stats.vs_tmdb', {
                      delta: `${stats.personalVsTmdb > 0 ? '+' : ''}${stats.personalVsTmdb.toFixed(1)}`,
                    })
                  : undefined
              }
            />
          </div>

          {stats.ratedCount > 0 && (
            <div className="card-surface px-4 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">
                {t('stats.rating_distribution')}
              </h3>
              <div className="flex items-end gap-1.5" aria-hidden="true">
                {stats.ratingDistribution.map((count, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t bg-white/80 transition-all"
                        style={{ height: `${(count / maxBar) * 100}%` }}
                        title={`${i + 1}: ${count}`}
                      />
                    </div>
                    <span className="text-[10px] text-white/40">{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.topDecades.length > 0 && (
            <div className="card-surface px-4 py-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/50">
                {t('stats.top_decades')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.topDecades.slice(0, 8).map((d) => (
                  <span key={d.decade} className="chip">
                    {t('stats.decade', { decade: d.decade })}
                    <span className="text-white/40">{formatNumber(d.count)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
