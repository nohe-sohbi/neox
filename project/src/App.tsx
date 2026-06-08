import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { DetailModal } from './components/media/DetailModal';
import { AuthModal } from './components/auth/AuthModal';
import { HomeView } from './views/HomeView';
import { DiscoverView } from './views/DiscoverView';
import { SearchView } from './views/SearchView';
import { LibraryView } from './views/LibraryView';

function App() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-aurora" />

      <Navbar onOpenAuth={() => setAuthOpen(true)} />

      <main className="relative flex-1">
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/movies" element={<DiscoverView mediaType="movie" />} />
          <Route path="/tv" element={<DiscoverView mediaType="tv" />} />
          <Route path="/search" element={<SearchView />} />
          <Route path="/library" element={<LibraryView onOpenAuth={() => setAuthOpen(true)} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />

      {/* Global overlays — deep-link driven detail + auth */}
      <DetailModal />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export default App;
