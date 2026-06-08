import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Bookmark, LogOut, Search, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { Logo } from './Logo';

const NAV_ITEMS = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/movies', label: 'Films', end: false },
  { to: '/tv', label: 'Séries', end: false },
];

export function Navbar({ onOpenAuth }: { onOpenAuth: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { user, logout } = useAuth();
  const { count } = useLibrary();

  const urlQuery = params.get('q') ?? '';
  const [q, setQ] = useState(urlQuery);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(urlQuery), [urlQuery]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const onSearchChange = (value: string) => {
    setQ(value);
    const onSearchPage = location.pathname === '/search';
    if (value.trim()) {
      navigate(`/search?q=${encodeURIComponent(value)}`, { replace: onSearchPage });
    } else if (onSearchPage) {
      navigate('/search', { replace: true });
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'
    }`;

  return (
    <header
      className={`fixed top-0 z-40 w-full transition-all duration-300 ${
        scrolled ? 'border-b border-white/10 bg-ink-950/85 backdrop-blur-xl' : 'bg-gradient-to-b from-black/70 to-transparent'
      }`}
    >
      <div className="container mx-auto flex items-center gap-4 px-6 py-3">
        <Logo onClick={() => navigate('/')} />

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={q}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher…"
              className="w-40 rounded-full border border-white/15 bg-white/5 py-2 pl-9 pr-8 text-sm text-white placeholder-white/40 outline-none transition-all focus:w-56 focus:border-brand-violet/50 focus:bg-white/10 focus:ring-2 focus:ring-brand-violet/30 sm:w-52 sm:focus:w-72"
            />
            {q && (
              <button
                onClick={() => onSearchChange('')}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <NavLink
            to="/library"
            aria-label="Ma liste"
            className={({ isActive }) =>
              `relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Bookmark className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gradient px-1 text-[10px] font-bold text-white">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </NavLink>

          {user ? (
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Mon compte"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold uppercase text-white shadow-glow"
              >
                {user.email.slice(0, 1)}
              </button>
              {menuOpen && (
                <div className="card-surface absolute right-0 top-12 w-56 animate-scale-in p-2">
                  <div className="border-b border-white/10 px-3 py-2">
                    <p className="text-xs text-white/40">Connecté en tant que</p>
                    <p className="truncate text-sm font-medium text-white">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Connexion</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
