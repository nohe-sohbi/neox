import { getLocale } from '../api';
import {
  createTranslator,
  langFromLocale,
  makeFormatNumber,
  type Lang,
  type Translator,
} from './core';

export type { Lang, Translator } from './core';
export { SUPPORTED_LANGS, langFromLocale, interpolate } from './core';

// The UI language is derived from the active catalogue locale. Switching locale
// triggers a full reload (see LocaleMenu), so resolving once at module load is
// both correct and cheap: no context plumbing required.
const lang: Lang = langFromLocale(getLocale().language);

/** Translate a key, optionally interpolating `{var}` placeholders. */
export const t: Translator = createTranslator(lang);

/** Locale-aware number formatter for the active language. */
export const formatNumber: (n: number) => string = makeFormatNumber(lang);

/** The active UI language code. */
export const activeLang: Lang = lang;

/** Picks the singular or plural form of a pluralized key by count. */
export function tn(baseKey: string, count: number, vars?: Record<string, string | number>): string {
  const suffix = count === 1 ? '_one' : '_other';
  return t(`${baseKey}${suffix}`, { count, ...vars });
}

/**
 * Ergonomic hook mirror of the module singletons. The language never changes
 * without a reload, so this simply exposes the resolved helpers to components.
 */
export function useT() {
  return { t, tn, formatNumber, lang: activeLang };
}
