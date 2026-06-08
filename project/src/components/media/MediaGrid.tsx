import type { MediaItem } from '../../lib/types';
import { MediaCard, MediaCardSkeleton } from './MediaCard';

interface MediaGridProps {
  items: MediaItem[];
  loading?: boolean;
  skeletonCount?: number;
  onOpen: (item: MediaItem) => void;
  isSaved: (item: MediaItem) => boolean;
  onToggleSave: (item: MediaItem) => void;
}

export function MediaGrid({
  items,
  loading,
  skeletonCount = 12,
  onOpen,
  isSaved,
  onToggleSave,
}: MediaGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) => <MediaCardSkeleton key={i} />)
        : items.map((item) => (
            <MediaCard
              key={`${item.mediaType}-${item.id}`}
              item={item}
              onOpen={onOpen}
              saved={isSaved(item)}
              onToggleSave={onToggleSave}
            />
          ))}
    </div>
  );
}
