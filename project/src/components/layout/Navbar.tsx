import { useEffect, useState } from 'react';
import { Bookmark, Film, Home, Search, Tv, X } from 'lucide-react';
import { Logo } from './Logo';

export type View = 'home' | 'movies' | 'tv' | 'watchlist';

interface NavbarProps {
  view: View;
  searching: boolean;
  onNavigate: (view: View) => void;
  query: string;
  onQueryChange: (q: string) => void;
  watchlistCount: number;
}

const NAV_ITEMS: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'movies', label: 'Films', icon: Film },
  { id: 'tv', label: 'Séries', icon: Tv },
];

export function Navbar({
  view,
  searching,
  onNavigate,
  query,
  onQueryChange,
  watchlistCount,
}: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 z-40 w-full transition-all duration-300 ${
        scrolled || searching
          ? 'border-b border-white/10 bg-ink-950/85 backdrop-blur-xl'
          : 'bg-gradient-to-b from-black/70 to-transparent'
      }`}
    >
      <div className="container mx-auto flex items-center gap-4 px-6 py-3">
        <Logo onClick={() => onNavigate('home')} />

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = !searching && view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Rechercher…"
              className="w-40 rounded-full border border-white/15 bg-white/5 py-2 pl-9 pr-8 text-sm text-white placeholder-white/40 outline-none transition-all focus:w-56 focus:border-brand-violet/50 focus:bg-white/10 focus:ring-2 focus:ring-brand-violet/30 sm:w-52 sm:focus:w-72"
            />
            {query && (
              <button
                onClick={() => onQueryChange('')}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Watchlist */}
          <button
            onClick={() => onNavigate('watchlist')}
            aria-label="Ma liste"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              !searching && view === 'watchlist'
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Bookmark className="h-5 w-5" />
            {watchlistCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold text-white">
                {watchlistCount > 99 ? '99+' : watchlistCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
