import { api, ApiError, getLocale } from '../lib/api';
import type { HomePayload } from '../lib/types';
import { Hero } from '../components/home/Hero';
import { ForYouRow } from '../components/home/ForYouRow';
import { RecentlyViewedRow } from '../components/home/RecentlyViewedRow';
import { MediaRow } from '../components/media/MediaRow';
import { ErrorState } from '../components/ui/States';
import { useT } from '../lib/i18n';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { routeMeta } from '../lib/routes';
import { buildHomeGraph } from '../lib/structured-data';
import { useQuery } from '../hooks/useQuery';

export function HomeView() {
  const { t, lang } = useT();
  useDocumentMeta(routeMeta('home', lang), buildHomeGraph(lang));

  // Cached + stale-while-revalidate: returning to Home repaints instantly
  // instead of flashing skeletons. Keyed by locale so a region/language switch
  // doesn't serve the wrong catalogue.
  const locale = getLocale();
  const { data, loading, error, refetch } = useQuery<HomePayload>(
    `home:${locale.region}:${locale.language}`,
    api.home,
  );

  let body;

  if (error && !data) {
    const message =
      error instanceof ApiError
        ? error.code === 'TMDB_NOT_CONFIGURED'
          ? t('home.error_no_key')
          : error.message
        : t('common.load_error');
    body = (
      <div className="pt-24">
        <ErrorState message={message} onRetry={refetch} />
      </div>
    );
  } else if (loading || !data) {
    body = (
      <>
        <div className="skeleton h-[70vh] min-h-[460px] w-full" />
        <div className="container mx-auto space-y-10 px-6 py-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <MediaRow key={i} title="" items={[]} loading />
          ))}
        </div>
      </>
    );
  } else {
    body = (
      <div className="animate-fade-in">
        <Hero items={data.hero} />
        <div className="container mx-auto space-y-10 px-6 py-10">
          <RecentlyViewedRow />
          <ForYouRow />
          {data.rows.map((row) => (
            <MediaRow key={row.id} title={t(`home.row.${row.id}`)} items={row.items} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* The page's own heading. The hero's biggest line is a carousel slide: it
          names a film, it changes every seven seconds, and it describes the page
          to neither a crawler nor someone navigating by headings. Off-screen
          because the design has no room for a site title above the artwork — but
          it is the real h1, and it says what this page is. */}
      <h1 className="sr-only">{t('home.heading')}</h1>
      {body}
    </>
  );
}
