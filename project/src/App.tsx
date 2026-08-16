import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { Footer } from './components/layout/Footer';
import { DetailModal } from './components/media/DetailModal';
import { PersonModal } from './components/media/PersonModal';
import { AuthModal } from './components/auth/AuthModal';
import { AccountModal } from './components/auth/AccountModal';
import { CommandPalette } from './components/command/CommandPalette';
import { ToastViewport } from './components/ui/ToastViewport';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { HomeView } from './views/HomeView';
import { DiscoverView } from './views/DiscoverView';
import { SearchView } from './views/SearchView';
import { LibraryView } from './views/LibraryView';
import { NotFoundView } from './views/NotFoundView';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { initAnalytics } from './lib/analytics';
import { useT } from './lib/i18n';

function App() {
  const { t } = useT();
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-white pb-16 md:pb-0">
      {/* Keyboard / screen-reader users can jump straight to the content. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-ink-950"
      >
        {t('a11y.skip')}
      </a>

      <div aria-hidden className="pointer-events-none fixed inset-0 bg-aurora opacity-20 transition-colors duration-700" />

      <Navbar onOpenAuth={() => setAuthOpen(true)} onOpenAccount={() => setAccountOpen(true)} />

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
            {/* Not a redirect to `/`: that answered 200 with the home page's
                content, which made every dead link a duplicate of the home
                page and a soft 404. nginx serves this shell with a 404. */}
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <Footer />

      {/* Touch-device primary navigation (the top navbar links are md-only) */}
      <MobileNav />

      {/* Global overlays: deep-link driven detail, person, auth, and ⌘K palette */}
      <DetailModal />
      <PersonModal />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <CommandPalette />

      {/* Global, accessible action feedback */}
      <ToastViewport />

      {/* Connectivity notice: the PWA keeps serving from cache when offline */}
      <OfflineBanner />
    </div>
  );
}

export default App;
