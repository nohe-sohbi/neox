import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Cloud, Download, Loader2, Trash2, Upload } from 'lucide-react';
import type { LibraryEntry, LibraryStatus, MediaItem } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useLibrary } from '../context/LibraryContext';
import {
  SORT_MODES,
  backupFilename,
  parseLibrary,
  serializeLibrary,
  sortEntries,
  type SortMode,
} from '../lib/library-io';
import { MediaGrid } from '../components/media/MediaGrid';
import { LibraryStats } from '../components/library/LibraryStats';
import { EmptyState } from '../components/ui/States';
import { useToast } from '../context/ToastContext';
import { useT } from '../lib/i18n';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

type Filter = 'all' | LibraryStatus;

const FILTERS: { id: Filter; key: string }[] = [
  { id: 'all', key: 'filter.all' },
  { id: 'want', key: 'filter.want' },
  { id: 'watched', key: 'filter.watched' },
];

// LibraryEntry carries everything MediaCard needs; pad the rest for the type.
function toMediaItem(entry: LibraryEntry): MediaItem {
  return {
    id: entry.id,
    mediaType: entry.mediaType,
    title: entry.title,
    originalTitle: '',
    overview: '',
    poster: entry.poster,
    backdrop: null,
    year: entry.year,
    rating: entry.rating,
    voteCount: 0,
    popularity: 0,
  };
}

export function LibraryView({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { t, tn } = useT();
  useDocumentMeta({ title: t('library.title'), path: '/library' });
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { entries, clear, syncing, importEntries } = useLibrary();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortMode>('added_desc');
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = {
    all: entries.length,
    want: entries.filter((e) => e.status === 'want').length,
    watched: entries.filter((e) => e.status === 'watched').length,
  };

  const filtered = sortEntries(
    entries.filter((e) => filter === 'all' || e.status === filter),
    sort,
  ).map(toMediaItem);

  const handleExport = () => {
    const blob = new Blob([serializeLibrary(entries)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('toast.exported'));
  };

  const handleClear = () => {
    if (!window.confirm(t('library.clear_confirm'))) return;
    clear();
    toast.success(t('toast.cleared'));
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const incoming = parseLibrary(text);
      const added = importEntries(incoming);
      toast.success(t('library.import_ok', { count: added }));
    } catch {
      toast.error(t('library.import_error'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="container mx-auto px-6 pb-16 pt-28">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-extrabold sm:text-4xl">
            {t('library.title')}
            {syncing && <Loader2 className="h-5 w-5 animate-spin text-brand-cyan" />}
          </h1>
          <p className="mt-1 text-white/50">
            {entries.length > 0
              ? tn('library.count', entries.length)
              : t('library.subtitle_empty')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* Backup / restore — works logged-out too (data ownership). */}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
          >
            <Upload className="h-4 w-4" />
            {t('library.import')}
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
            >
              <Download className="h-4 w-4" />
              {t('library.export')}
            </button>
          )}
          {entries.length > 0 && (
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              {t('library.clear_all')}
            </button>
          )}
        </div>
      </div>

      {/* Your taste in numbers — collapsible, computed locally. */}
      {entries.length > 0 && <LibraryStats entries={entries} />}

      {/* Sync banner for logged-out users */}
      {!user && entries.length > 0 && (
        <button
          onClick={onOpenAuth}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-brand-violet/30 bg-brand-violet/10 p-4 text-left transition-colors hover:bg-brand-violet/15"
        >
          <Cloud className="h-6 w-6 shrink-0 text-brand-cyan" />
          <div>
            <p className="font-semibold text-white">{t('library.sync_cta_title')}</p>
            <p className="text-sm text-white/60">{t('library.sync_cta_desc')}</p>
          </div>
        </button>
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-12 w-12" />}
          title={t('library.empty_title')}
          description={t('library.empty_desc')}
          action={
            <button onClick={() => navigate('/movies')} className="btn-primary">
              {t('library.explore')}
            </button>
          }
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    filter === f.id
                      ? 'bg-brand-gradient text-white shadow-glow'
                      : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {t(f.key)}
                  <span className="ml-1.5 text-white/50">{counts[f.id]}</span>
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-white/50">
              {t('library.sort_by')}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none transition-colors hover:bg-white/10 focus:border-brand-violet/50"
              >
                {SORT_MODES.map((m) => (
                  <option key={m.id} value={m.id} className="bg-ink-900">
                    {t(m.key)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title={
                filter === 'want'
                  ? t('library.want_empty_title')
                  : t('library.watched_empty_title')
              }
              description={
                filter === 'want'
                  ? t('library.want_empty_desc')
                  : t('library.watched_empty_desc')
              }
            />
          ) : (
            <div className="animate-fade-in">
              <MediaGrid items={filtered} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
