/**
 * Analytics via a self-hosted Umami instance: entirely opt-in.
 * Set VITE_UMAMI_WEBSITE_ID to enable; otherwise every call is a no-op and no
 * script is ever loaded. VITE_UMAMI_DOMAINS restricts the tracker to the
 * production host, so a local dev session never pollutes the stats.
 *
 * No event property carries personal data: no email, no free-text search query,
 * no title the user typed. Only counts, media types and feature names.
 */
const WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
const SRC =
  (import.meta.env.VITE_UMAMI_SRC as string) || 'https://analytics.sohbi.dev/script.js';
const DOMAINS = import.meta.env.VITE_UMAMI_DOMAINS as string | undefined;

let loaded = false;

export function initAnalytics() {
  if (!WEBSITE_ID || loaded || typeof document === 'undefined') return;
  loaded = true;
  const script = document.createElement('script');
  script.defer = true;
  script.src = SRC;
  script.dataset.websiteId = WEBSITE_ID;
  // Auto-track hooks the History API, so react-router navigations are counted
  // on their own. Never add a manual pageview call: it would double-count.
  if (DOMAINS) script.dataset.domains = DOMAINS;
  document.head.appendChild(script);
}

type Props = Record<string, string | number | boolean>;

export function track(event: string, props?: Props) {
  if (!WEBSITE_ID || typeof window === 'undefined') return;
  // Optional chaining is load-bearing: an ad-blocker can drop the script while
  // WEBSITE_ID is set, so `window.umami` may never appear.
  const umami = (window as unknown as { umami?: { track: (e: string, d?: Props) => void } })
    .umami;
  umami?.track(event, props);
}
