import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { MediaRow } from '../media/MediaRow';
import {
  RECENT_VIEWED_EVENT,
  readRecent,
  toMediaItem,
  type RecentItem,
} from '../../lib/recently-viewed';
import { useT } from '../../lib/i18n';

/**
 * "Pick up where you left off" — the titles the user recently opened. Renders
 * nothing until there's history, and refreshes live when a new title is viewed.
 */
export function RecentlyViewedRow() {
  const { t } = useT();
  const [items, setItems] = useState<RecentItem[]>(() => readRecent());

  useEffect(() => {
    const refresh = () => setItems(readRecent());
    window.addEventListener(RECENT_VIEWED_EVENT, refresh);
    return () => window.removeEventListener(RECENT_VIEWED_EVENT, refresh);
  }, []);

  if (items.length === 0) return null;

  return (
    <MediaRow
      title={t('home.recent')}
      items={items.map(toMediaItem)}
      icon={<Clock className="h-5 w-5 text-brand-cyan" />}
    />
  );
}
