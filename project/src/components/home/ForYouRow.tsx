import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import type { MediaItem } from '../../lib/types';
import { useLibrary } from '../../context/LibraryContext';
import { MediaRow } from '../media/MediaRow';
import { useT } from '../../lib/i18n';

/**
 * Personalized recommendations seeded from the user's library. Renders nothing
 * until there's at least one seed and at least one result.
 */
export function ForYouRow() {
  const { t } = useT();
  const { entries } = useLibrary();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Stable signature of the seed set so we refetch only when it changes.
  const seedKey = entries
    .map((e) => `${e.mediaType}-${e.id}`)
    .sort()
    .join(',');

  useEffect(() => {
    if (entries.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .recommendations(entries.map((e) => ({ id: e.id, mediaType: e.mediaType })))
      .then((res) => {
        if (cancelled) return;
        // Exclude anything already in the library.
        const inLib = new Set(entries.map((e) => `${e.mediaType}:${e.id}`));
        setItems(res.results.filter((r) => !inLib.has(`${r.mediaType}:${r.id}`)));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  if (entries.length === 0) return null;
  if (!loading && items.length === 0) return null;

  return (
    <MediaRow
      title={t('home.for_you')}
      items={items}
      loading={loading}
      icon={<Sparkles className="h-5 w-5 text-brand-cyan" />}
    />
  );
}
