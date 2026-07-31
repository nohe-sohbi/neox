import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { routeMeta } from '../lib/routes';

/**
 * What an unknown URL gets. It used to get a silent redirect to the home page,
 * which is worse than it sounds: the URL answered 200 with the home page's
 * content, so every typo and every dead inbound link became a duplicate of `/`
 * — a soft 404 in Search Console, and crawl budget spent on nothing.
 *
 * Now it says so, `noindex` (never index a mistake) but `follow`, and offers
 * the way back. nginx serves this shell with a real 404 status.
 */
export function NotFoundView() {
  const { t, lang } = useT();
  useDocumentMeta(routeMeta('notFound', lang));

  return (
    <div className="container mx-auto flex min-h-[70vh] flex-col items-center justify-center px-6 py-24 text-center">
      <p aria-hidden className="font-display text-7xl font-extrabold tracking-tight text-white/12">
        404
      </p>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {t('notfound.title')}
      </h1>
      <p className="mt-3 max-w-md text-balance text-white/55">{t('notfound.desc')}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/" className="btn-primary">
          {t('notfound.cta')}
        </Link>
        <Link to="/movies" className="btn-ghost">
          {t('nav.movies')}
        </Link>
        <Link to="/tv" className="btn-ghost">
          {t('nav.tv')}
        </Link>
      </div>
    </div>
  );
}
