import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { LibraryProvider } from './context/LibraryContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { ToastProvider } from './context/ToastContext';
import { activeLang } from './lib/i18n';
import { localeTag } from './lib/i18n/core';
// Self-hosted variable faces: no third-party request at runtime, one woff2 per
// family instead of nine static weights, and the axes stay available.
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/instrument-sans';
import './index.css';

// Advertise the active UI language on the document. index.html ships a static
// `lang="fr"`, but the UI language is resolved from the stored locale at load
// and a locale switch hard-reloads, so setting these once here keeps the
// document's language honest for screen readers and crawlers (plus og:locale
// for link unfurlers).
document.documentElement.lang = activeLang;
const ogLocale = document.createElement('meta');
ogLocale.setAttribute('property', 'og:locale');
ogLocale.setAttribute('content', localeTag(activeLang).replace('-', '_'));
document.head.appendChild(ogLocale);

// Auto-update the service worker in the background.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          {/* Preferences sit between auth and library: both react to the user
              switching, and the library view reads its default sort from here. */}
          <PreferencesProvider>
            <LibraryProvider>
              <App />
            </LibraryProvider>
          </PreferencesProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
