import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { Footer } from './components/layout/Footer';
import { DetailModal } from './components/media/DetailModal';
import { PersonModal } from './components/media/PersonModal';
import { AuthModal } from './components/auth/AuthModal';
import { CommandPalette } from './components/command/CommandPalette';
import { ToastViewport } from './components/ui/ToastViewport';
import { HomeView } from './views/HomeView';
import { DiscoverView } from './views/DiscoverView';
import { SearchView } from './views/SearchView';
import { LibraryView } from './views/LibraryView';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { initAnalytics } from './lib/analytics';
import { useT } from './lib/i18n';

function App() {
  const { t } = useT();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-white pb-16 md:pb-0">
      {/* Keyboard / screen-reader users can jump straight to the content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-gradient focus:px-4 focus:py-2 focus:font-semibold focus:text-white focus:shadow-glow"
      >
        {t('a11y.skip')}
      </a>

      <div className="pointer-events-none fixed inset-0 bg-aurora" />

      <Navbar onOpenAuth={() => setAuthOpen(true)} />

      <main id="main-content" tabIndex={-1} className="relative flex-1 outline-none">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomeView />} />
            {/* Keyed so a Movies↔Séries switch remounts the view with fresh
                filter state, instead of firing one request with the previous
                tab's filters (e.g. a movie genre id on /tv) before the reset. */}
            <Route path="/movies" element={<DiscoverView key="movie" mediaType="movie" />} />
            <Route path="/tv" element={<DiscoverView key="tv" mediaType="tv" />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/library" element={<LibraryView onOpenAuth={() => setAuthOpen(true)} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <Footer />

      {/* Touch-device primary navigation (the top navbar links are md-only) */}
      <MobileNav />

      {/* Global overlays — deep-link driven detail, person, auth, and ⌘K palette */}
      <DetailModal />
      <PersonModal />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <CommandPalette />

      {/* Global, accessible action feedback */}
      <ToastViewport />
    </div>
  );
}

export default App;
