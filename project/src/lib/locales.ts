import type { Locale } from './types';

/**
 * The region ↔ language pairs the product offers. Single source shared by the
 * locale menu (labels + flags) and first-visit detection, so the two can never
 * drift apart.
 */
export const OFFERED_LOCALES = [
  { region: 'FR', language: 'fr-FR', label: 'France', flag: '🇫🇷' },
  { region: 'BE', language: 'fr-BE', label: 'Belgique', flag: '🇧🇪' },
  { region: 'CA', language: 'fr-CA', label: 'Canada', flag: '🇨🇦' },
  { region: 'CH', language: 'fr-CH', label: 'Suisse', flag: '🇨🇭' },
  { region: 'US', language: 'en-US', label: 'United States', flag: '🇺🇸' },
  { region: 'GB', language: 'en-GB', label: 'United Kingdom', flag: '🇬🇧' },
  { region: 'ES', language: 'es-ES', label: 'España', flag: '🇪🇸' },
  { region: 'DE', language: 'de-DE', label: 'Deutschland', flag: '🇩🇪' },
  { region: 'IT', language: 'it-IT', label: 'Italia', flag: '🇮🇹' },
] as const;

export const DEFAULT_LOCALE: Locale = { region: 'FR', language: 'fr-FR' };

/**
 * Picks the offered pair closest to the browser's language preferences,
 * in order: first an exact tag match anywhere in the list (fr-CA → Canada),
 * then a language-prefix match ("de", "es-MX" → Deutschland, España). Falls
 * back to the product default when nothing matches.
 */
export function detectLocale(candidates: readonly (string | undefined)[]): Locale {
  const tags = candidates.filter((c): c is string => Boolean(c)).map((c) => c.toLowerCase());

  for (const tag of tags) {
    const exact = OFFERED_LOCALES.find((l) => l.language.toLowerCase() === tag);
    if (exact) return { region: exact.region, language: exact.language };
  }
  for (const tag of tags) {
    const prefix = tag.slice(0, 2);
    const match = OFFERED_LOCALES.find((l) => l.language.slice(0, 2) === prefix);
    if (match) return { region: match.region, language: match.language };
  }
  return DEFAULT_LOCALE;
}
