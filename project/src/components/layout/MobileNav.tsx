import { NavLink } from 'react-router-dom';
import { Bookmark, Film, Home, Tv } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { useT } from '../../lib/i18n';

const ITEMS = [
  { to: '/', key: 'nav.home', icon: Home, end: true },
  { to: '/movies', key: 'nav.movies', icon: Film, end: false },
  { to: '/tv', key: 'nav.tv', icon: Tv, end: false },
  { to: '/library', key: 'nav.library', icon: Bookmark, end: false },
];

/**
 * Bottom tab bar for touch devices. The top navbar's primary links are
 * `hidden md:flex`, so on phones this is the only way to reach Movies / TV.
 * Hidden from `md` up, where the inline navbar takes over.
 */
export function MobileNav() {
  const { t } = useT();
  const { count } = useLibrary();

  return (
    <nav
      aria-label={t('nav.primary')}
      className="fixed bottom-0 left-0 z-40 w-full border-t border-white/10 bg-ink-950/90 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <item.icon className="h-5 w-5" />
                  {item.to === '/library' && count > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-ink-950">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
                {t(item.key)}
                {isActive && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-white" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
