import { api, ApiError, getLocale } from '../lib/api';
import type { HomePayload } from '../lib/types';
import { Hero } from '../components/home/Hero';
import { ForYouRow } from '../components/home/ForYouRow';
import { RecentlyViewedRow } from '../components/home/RecentlyViewedRow';
import { MediaRow } from '../components/media/MediaRow';
import { ErrorState } from '../components/ui/States';
import { useT } from '../lib/i18n';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { buildWebSite } from '../lib/structured-data';
import { useQuery } from '../hooks/useQuery';

export function HomeView() {
  const { t } = useT();
  useDocumentMeta({ path: '/' }, buildWebSite());

  // Cached + stale-while-revalidate: returning to Home repaints instantly
  // instead of flashing skeletons. Keyed by locale so a region/language switch
  // doesn't serve the wrong catalogue.
  const locale = getLocale();
  const { data, loading, error, refetch } = useQuery<HomePayload>(
    `home:${locale.region}:${locale.language}`,
    api.home,
  );

  if (error && !data) {
    const message =
      error instanceof ApiError
        ? error.code === 'TMDB_NOT_CONFIGURED'
          ? t('home.error_no_key')
          : error.message
        : t('common.load_error');
    return (
      <div className="pt-24">
        <ErrorState message={message} onRetry={refetch} />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <>
        <div className="skeleton h-[70vh] min-h-[460px] w-full" />
        <div className="container mx-auto space-y-10 px-6 py-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <MediaRow key={i} title="" items={[]} loading />
          ))}
        </div>
      </>
    );
  }

  return (
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
