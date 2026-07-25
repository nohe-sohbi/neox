import { describe, expect, it } from 'vitest';
import {
  SUPPORTED_LANGS,
  createTranslator,
  interpolate,
  langFromLocale,
  makeFormatNumber,
} from './core';
import { translations } from './translations';

describe('langFromLocale', () => {
  it('maps catalogue locales to a supported UI language', () => {
    expect(langFromLocale('fr-FR')).toBe('fr');
    expect(langFromLocale('fr-BE')).toBe('fr');
    expect(langFromLocale('en-US')).toBe('en');
    expect(langFromLocale('es-ES')).toBe('es');
    expect(langFromLocale('de-DE')).toBe('de');
    expect(langFromLocale('it-IT')).toBe('it');
  });

  it('falls back to English for unknown or empty locales', () => {
    expect(langFromLocale('pt-BR')).toBe('en');
    expect(langFromLocale('')).toBe('en');
    expect(langFromLocale(undefined)).toBe('en');
  });
});

describe('interpolate', () => {
  it('replaces named placeholders', () => {
    expect(interpolate('{count} results', { count: 3 })).toBe('3 results');
    expect(interpolate('Hi {name}!', { name: 'Neo' })).toBe('Hi Neo!');
  });

  it('leaves unknown placeholders untouched and is a no-op without vars', () => {
    expect(interpolate('Hi {name}', {})).toBe('Hi {name}');
    expect(interpolate('plain')).toBe('plain');
  });
});

describe('createTranslator', () => {
  it('translates known keys per language', () => {
    expect(createTranslator('fr')('nav.home')).toBe('Accueil');
    expect(createTranslator('en')('nav.home')).toBe('Home');
    expect(createTranslator('de')('nav.movies')).toBe('Filme');
  });

  it('interpolates variables', () => {
    expect(createTranslator('en')('search.count_other', { count: 12 })).toBe('12 results');
  });

  it('falls back to English then to the raw key for missing entries', () => {
    const t = createTranslator('it');
    expect(t('totally.unknown.key')).toBe('totally.unknown.key');
  });
});

describe('makeFormatNumber', () => {
  it('formats numbers per locale', () => {
    expect(makeFormatNumber('en')(12345)).toBe('12,345');
    // Non-breaking/thin space grouping in fr: just assert it is not the en form.
    expect(makeFormatNumber('fr')(12345)).not.toBe('12,345');
  });
});

describe('translation catalogs', () => {
  it('every language defines the same keys as the English base', () => {
    const baseKeys = Object.keys(translations.en).sort();
    for (const lang of SUPPORTED_LANGS) {
      const keys = Object.keys(translations[lang]).sort();
      expect(keys, `missing/extra keys in "${lang}"`).toEqual(baseKeys);
    }
  });
});
