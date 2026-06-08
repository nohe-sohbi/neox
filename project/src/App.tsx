import { useCallback, useState } from 'react';
import { Navbar, type View } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { DetailModal } from './components/media/DetailModal';
import { HomeView } from './views/HomeView';
import { DiscoverView } from './views/DiscoverView';
import { SearchView } from './views/SearchView';
import { WatchlistView } from './views/WatchlistView';
import { useWatchlist } from './hooks/useWatchlist';
import type { MediaItem, MediaType } from './lib/types';

function App() {
  const [view, setView] = useState<View>('home');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<{ id: number; mediaType: MediaType } | null>(null);

  const watchlist = useWatchlist();
  const searching = query.trim().length > 0;

  const isSaved = useCallback(
    (item: Pick<MediaItem, 'id' | 'mediaType'>) => watchlist.isSaved(item),
    [watchlist],
  );

  const openDetail = useCallback((item: MediaItem) => {
    setTarget({ id: item.id, mediaType: item.mediaType });
  }, []);

  const navigate = useCallback((next: View) => {
    setQuery('');
    setView(next);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-aurora" />

      <Navbar
        view={view}
        searching={searching}
        onNavigate={navigate}
        query={query}
        onQueryChange={setQuery}
        watchlistCount={watchlist.count}
      />

      <main className="relative flex-1">
        {searching ? (
          <SearchView
            query={query}
            onOpen={openDetail}
            isSaved={isSaved}
            onToggleSave={watchlist.toggle}
          />
        ) : view === 'home' ? (
          <HomeView onOpen={openDetail} isSaved={isSaved} onToggleSave={watchlist.toggle} />
        ) : view === 'movies' ? (
          <DiscoverView
            mediaType="movie"
            onOpen={openDetail}
            isSaved={isSaved}
            onToggleSave={watchlist.toggle}
          />
        ) : view === 'tv' ? (
          <DiscoverView
            mediaType="tv"
            onOpen={openDetail}
            isSaved={isSaved}
            onToggleSave={watchlist.toggle}
          />
        ) : (
          <WatchlistView
            items={watchlist.items}
            onOpen={openDetail}
            isSaved={isSaved}
            onToggleSave={watchlist.toggle}
            onClear={watchlist.clear}
            onBrowse={() => navigate('movies')}
          />
        )}
      </main>

      <Footer />

      <DetailModal
        target={target}
        onClose={() => setTarget(null)}
        onOpen={openDetail}
        isSaved={isSaved}
        onToggleSave={watchlist.toggle}
      />
    </div>
  );
}

export default App;
