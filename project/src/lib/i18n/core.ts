import { translations, type Dict } from './translations';

export type Lang = 'fr' | 'en' | 'es' | 'de' | 'it';

export const SUPPORTED_LANGS: Lang[] = ['fr', 'en', 'es', 'de', 'it'];

const FALLBACK_LANG: Lang = 'en';

/** BCP-47-ish tags used for Intl number/date formatting per language. */
const LOCALE_TAG: Record<Lang, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
};

/** Maps a catalogue language (e.g. "fr-BE", "en-US") to a supported UI language. */
export function langFromLocale(language: string | undefined): Lang {
  const prefix = (language || '').slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGS as string[]).includes(prefix) ? (prefix as Lang) : FALLBACK_LANG;
}

/** Replaces `{name}` placeholders with values from `vars`. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}

export type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Builds a translator for `lang`. Missing keys fall back to English, then to
 * the raw key, so the UI never renders blank.
 */
export function createTranslator(lang: Lang): Translator {
  const dict: Dict = translations[lang] || translations[FALLBACK_LANG];
  const fallback: Dict = translations[FALLBACK_LANG];
  return (key, vars) => {
    const raw = dict[key] ?? fallback[key] ?? key;
    return interpolate(raw, vars);
  };
}

/** Locale-aware number formatter (e.g. 12 345 in fr, 12,345 in en). */
export function makeFormatNumber(lang: Lang): (n: number) => string {
  const tag = LOCALE_TAG[lang];
  return (n) => n.toLocaleString(tag);
}

export function localeTag(lang: Lang): string {
  return LOCALE_TAG[lang];
}
