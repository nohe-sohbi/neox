import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Clock,
  CornerDownLeft,
  Film,
  Home,
  Search,
  Tv,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { track } from '../../lib/analytics';
import type { MediaItem } from '../../lib/types';
import { useDebounce } from '../../hooks/useDebounce';
import { useOpenDetail } from '../../hooks/useDetailRoute';
import { useModal } from '../../hooks/useModal';
import { useT } from '../../lib/i18n';
import {
  clearSearches,
  readSearches,
  rememberSearch,
} from '../../lib/recent-searches';
import { readRecent, toMediaItem, type RecentItem } from '../../lib/recently-viewed';

/** Custom event other components can dispatch to open the palette. */
export const OPEN_COMMAND_EVENT = 'neox:open-command';

type Command =
  | { kind: 'nav'; id: string; label: string; to: string; icon: typeof Home }
  | { kind: 'search'; query: string }
  | { kind: 'recent'; query: string }
  | { kind: 'result'; item: MediaItem };

export function CommandPalette() {
  const { t } = useT();
  const navigate = useNavigate();
  const openDetail = useOpenDetail();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [viewed, setViewed] = useState<RecentItem[]>([]);
  const [active, setActive] = useState(0);

  const debounced = useDebounce(query.trim(), 250);

  const navItems = useMemo(
    () => [
      { kind: 'nav' as const, id: 'home', label: t('nav.home'), to: '/', icon: Home },
      { kind: 'nav' as const, id: 'movies', label: t('nav.movies'), to: '/movies', icon: Film },
      { kind: 'nav' as const, id: 'tv', label: t('nav.tv'), to: '/tv', icon: Tv },
      {
        kind: 'nav' as const,
        id: 'library',
        label: t('nav.library'),
        to: '/library',
        icon: Bookmark,
      },
    ],
    [t],
  );

  const show = useCallback((via: 'shortcut' | 'button' = 'button') => {
    setRecent(readSearches());
    setViewed(readRecent());
    setQuery('');
    setResults([]);
    setActive(0);
    setOpen(true);
    track('Palette Open', { via });
  }, []);

  const hide = useCallback(() => setOpen(false), []);

  // Global ⌘K / Ctrl+K toggle + custom open event. The shortcut goes through
  // show()/hide() rather than duplicating the reset: a ref carries the current
  // state because calling track() inside a state updater would double-count in
  // StrictMode, which invokes the updater twice.
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (openRef.current) hide();
        else show('shortcut');
      }
    };
    const onOpen = () => show('button');
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_COMMAND_EVENT, onOpen);
    };
  }, [show, hide]);

  // Scroll lock, Escape, focus trap + restore, and focus the input on open
  // (it's the first focusable element inside the dialog).
  const dialogRef = useModal<HTMLDivElement>(open, hide);

  // Fetch search results as the user types.
  useEffect(() => {
    if (!open || !debounced) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .search(debounced)
      .then((page) => {
        if (!cancelled) setResults(page.results.slice(0, 7));
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, debounced]);

  // Flat command list, rebuilt whenever inputs change. Keyboard nav indexes this.
  const commands: Command[] = useMemo(() => {
    if (query.trim()) {
      return [
        { kind: 'search', query: query.trim() },
        ...results.map((item) => ({ kind: 'result' as const, item })),
      ];
    }
    return [
      ...navItems,
      ...viewed.map((v) => ({ kind: 'result' as const, item: toMediaItem(v) })),
      ...recent.map((q) => ({ kind: 'recent' as const, query: q })),
    ];
  }, [query, results, navItems, viewed, recent]);

  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  const goSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      rememberSearch(trimmed);
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
      hide();
    },
    [navigate, hide],
  );

  const run = useCallback(
    (cmd: Command | undefined) => {
      if (!cmd) return;
      switch (cmd.kind) {
        case 'nav':
          navigate(cmd.to);
          hide();
          break;
        case 'search':
        case 'recent':
          goSearch(cmd.query);
          break;
        case 'result':
          openDetail(cmd.item);
          hide();
          break;
      }
    },
    [navigate, hide, goSearch, openDetail],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (commands.length ? (i + 1) % commands.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (commands.length ? (i - 1 + commands.length) % commands.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(commands[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hide();
    }
  };

  if (!open) return null;

  const showNavHeading = !query.trim();
  let cursor = -1; // running index aligned with `commands`

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={hide}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('cmd.placeholder')}
        className="card-surface w-full max-w-xl animate-scale-in overflow-hidden p-0 outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search className="h-5 w-5 shrink-0 text-white/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t('cmd.placeholder')}
            className="w-full bg-transparent py-4 text-base text-white placeholder-white/40 outline-none"
          />
          <button
            onClick={hide}
            aria-label={t('cmd.hint_close')}
            className="shrink-0 text-white/40 transition-colors hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {/* Query mode: "search for X" + live results */}
          {query.trim() ? (
            <>
              {(() => {
                cursor += 1;
                const idx = cursor;
                return (
                  <CommandItem
                    active={active === idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => run({ kind: 'search', query: query.trim() })}
                    icon={<Search className="h-4 w-4" />}
                    title={`${t('search.results_for')} ${t('search.quoted', { term: query.trim() })}`}
                  />
                );
              })()}

              <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-white/55">
                {loading ? t('cmd.searching') : t('cmd.results')}
              </p>

              {!loading && results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-white/40">
                  {t('cmd.no_results', { query: query.trim() })}
                </p>
              ) : (
                results.map((item) => {
                  cursor += 1;
                  const idx = cursor;
                  return (
                    <CommandItem
                      key={`${item.mediaType}-${item.id}`}
                      active={active === idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => run({ kind: 'result', item })}
                      icon={
                        item.poster ? (
                          <img
                            src={item.poster}
                            alt=""
                            className="h-10 w-7 rounded object-cover"
                          />
                        ) : item.mediaType === 'tv' ? (
                          <Tv className="h-4 w-4" />
                        ) : (
                          <Film className="h-4 w-4" />
                        )
                      }
                      title={item.title}
                      meta={`${item.mediaType === 'tv' ? t('hero.series') : t('hero.movie')}${
                        item.year ? ` · ${item.year}` : ''
                      }`}
                    />
                  );
                })
              )}
            </>
          ) : (
            <>
              {showNavHeading && (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-white/55">
                  {t('cmd.nav')}
                </p>
              )}
              {navItems.map((item) => {
                cursor += 1;
                const idx = cursor;
                return (
                  <CommandItem
                    key={item.id}
                    active={active === idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => run(item)}
                    icon={<item.icon className="h-4 w-4" />}
                    title={item.label}
                  />
                );
              })}

              {viewed.length > 0 && (
                <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-white/55">
                  {t('cmd.recent_viewed')}
                </p>
              )}
              {viewed.map((v) => {
                cursor += 1;
                const idx = cursor;
                return (
                  <CommandItem
                    key={`viewed-${v.mediaType}-${v.id}`}
                    active={active === idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => run({ kind: 'result', item: toMediaItem(v) })}
                    icon={
                      v.poster ? (
                        <img src={v.poster} alt="" className="h-10 w-7 rounded object-cover" />
                      ) : v.mediaType === 'tv' ? (
                        <Tv className="h-4 w-4" />
                      ) : (
                        <Film className="h-4 w-4" />
                      )
                    }
                    title={v.title}
                    meta={`${v.mediaType === 'tv' ? t('hero.series') : t('hero.movie')}${
                      v.year ? ` · ${v.year}` : ''
                    }`}
                  />
                );
              })}

              {recent.length > 0 && (
                <div className="mt-1 flex items-center justify-between px-3 pb-1 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/55">
                    {t('cmd.recent')}
                  </p>
                  <button
                    onClick={() => {
                      clearSearches();
                      setRecent([]);
                    }}
                    className="text-xs text-white/40 transition-colors hover:text-white"
                  >
                    {t('cmd.clear_recent')}
                  </button>
                </div>
              )}
              {recent.map((q) => {
                cursor += 1;
                const idx = cursor;
                return (
                  <CommandItem
                    key={q}
                    active={active === idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => run({ kind: 'recent', query: q })}
                    icon={<Clock className="h-4 w-4" />}
                    title={q}
                  />
                );
              })}
            </>
          )}
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2.5 text-[11px] text-white/40">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            {t('cmd.hint_nav')}
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>
              <CornerDownLeft className="h-3 w-3" />
            </Kbd>
            {t('cmd.hint_select')}
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Kbd>Esc</Kbd>
            {t('cmd.hint_close')}
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-white/15 bg-white/5 px-1 font-sans text-[10px] text-white/60">
      {children}
    </kbd>
  );
}

interface CommandItemProps {
  active: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  icon: React.ReactNode;
  title: string;
  meta?: string;
}

function CommandItem({ active, onClick, onMouseEnter, icon, title, meta }: CommandItemProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5'
      }`}
    >
      <span className="flex h-10 w-7 shrink-0 items-center justify-center text-white/50">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {meta && <span className="block truncate text-xs text-white/40">{meta}</span>}
      </span>
    </button>
  );
}
