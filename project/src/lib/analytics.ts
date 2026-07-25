/**
 * Privacy-friendly analytics via Plausible: entirely opt-in.
 * Set VITE_PLAUSIBLE_DOMAIN to enable; otherwise every call is a no-op and no
 * script is ever loaded.
 */
const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const SRC = (import.meta.env.VITE_PLAUSIBLE_SRC as string) || 'https://plausible.io/js/script.js';

let loaded = false;

export function initAnalytics() {
  if (!DOMAIN || loaded || typeof document === 'undefined') return;
  loaded = true;
  const script = document.createElement('script');
  script.defer = true;
  script.dataset.domain = DOMAIN;
  script.src = SRC;
  document.head.appendChild(script);
}

type Props = Record<string, string | number | boolean>;

export function track(event: string, props?: Props) {
  if (!DOMAIN || typeof window === 'undefined') return;
  const plausible = (window as unknown as { plausible?: (e: string, o?: { props: Props }) => void })
    .plausible;
  plausible?.(event, props ? { props } : undefined);
}
