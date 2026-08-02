import { Link } from 'react-router-dom';
import { useT } from '../../lib/i18n';

// The indexable sections, with the same labels the navbar uses. The footer is
// on every page, so these are the links that carry internal weight to the two
// section pages; /library and /search are left out on purpose, being served
// noindex there would be weight spent on nothing.
const LINKS = [
  { to: '/', key: 'nav.home' },
  { to: '/movies', key: 'nav.movies' },
  { to: '/tv', key: 'nav.tv' },
];

export function Footer() {
  const { t } = useT();
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="container mx-auto flex flex-col items-center gap-3 px-6 py-8 text-center text-sm text-white/55 sm:flex-row sm:justify-between sm:text-left">
        <p>
          <span className="font-bold text-white">NEOX</span>, {t('footer.tagline')}
        </p>
        <nav aria-label={t('footer.sections')} className="flex items-center gap-4">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-white/60 underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <p>
          {t('footer.data_by')}{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 underline-offset-2 hover:text-white hover:underline"
          >
            TMDB
          </a>{' '}
          {t('footer.data_suffix')}
        </p>
      </div>
    </footer>
  );
}
