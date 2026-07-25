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
          <LibraryProvider>
            <App />
          </LibraryProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
