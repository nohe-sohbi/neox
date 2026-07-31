import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { LibraryProvider } from './context/LibraryContext';
import { ToastProvider } from './context/ToastContext';
import { activeLang } from './lib/i18n';
import { localeTag } from './lib/i18n/core';
// Self-hosted variable faces: no third-party request at runtime, one woff2 per
// family instead of nine static weights, and the axes stay available.
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/instrument-sans';
import './index.css';

// Advertise the active UI language on the document. The prerendered shells ship
// `lang="fr"` and `og:locale="fr_FR"`, but the UI language is resolved from the
// stored locale at load and a locale switch hard-reloads, so correcting them
// once here keeps the document honest for screen readers and crawlers.
document.documentElement.lang = activeLang;
// Updated in place, not appended: the shell already carries an og:locale, and a
// second one would leave unfurlers picking whichever they read first.
let ogLocale = document.head.querySelector<HTMLMetaElement>('meta[property="og:locale"]');
if (!ogLocale) {
  ogLocale = document.createElement('meta');
  ogLocale.setAttribute('property', 'og:locale');
  document.head.appendChild(ogLocale);
}
ogLocale.setAttribute('content', localeTag(activeLang).replace('-', '_'));

// Auto-update the service worker in the background.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <LibraryProvider>
            <App />
          </LibraryProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
