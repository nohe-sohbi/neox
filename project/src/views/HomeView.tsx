import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { HomePayload } from '../lib/types';
import { Hero } from '../components/home/Hero';
import { ForYouRow } from '../components/home/ForYouRow';
import { MediaRow } from '../components/media/MediaRow';
import { ErrorState } from '../components/ui/States';
import { useT } from '../lib/i18n';

export function HomeView() {
  const { t } = useT();
  const [data, setData] = useState<HomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .home()
      .then(setData)
      .catch((err: unknown) =>
        setError(
          err instanceof ApiError
            ? err.code === 'TMDB_NOT_CONFIGURED'
              ? t('home.error_no_key')
              : err.message
            : t('common.load_error'),
        ),
      )
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="pt-24">
        <ErrorState message={error} onRetry={load} />
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
        <ForYouRow />
        {data.rows.map((row) => (
          <MediaRow key={row.id} title={t(`home.row.${row.id}`)} items={row.items} />
        ))}
      </div>
    </div>
  );
}
