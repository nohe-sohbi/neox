import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, OFFERED_LOCALES, detectLocale } from './locales';

describe('detectLocale', () => {
  it('prefers an exact tag match, wherever it sits in the list', () => {
    expect(detectLocale(['fr-CA'])).toEqual({ region: 'CA', language: 'fr-CA' });
    expect(detectLocale(['en-GB'])).toEqual({ region: 'GB', language: 'en-GB' });
    expect(detectLocale(['de-DE'])).toEqual({ region: 'DE', language: 'de-DE' });
  });

  it('is case-insensitive on the tag', () => {
    expect(detectLocale(['EN-us'])).toEqual({ region: 'US', language: 'en-US' });
  });

  it('falls back to a language-prefix match for unoffered regions', () => {
    expect(detectLocale(['es-MX'])).toEqual({ region: 'ES', language: 'es-ES' });
    expect(detectLocale(['de'])).toEqual({ region: 'DE', language: 'de-DE' });
    expect(detectLocale(['en-AU'])).toEqual({ region: 'US', language: 'en-US' });
  });

  it('honors preference order: an exact match beats an earlier prefix-only match', () => {
    // it-CH has no exact pair; fr-FR does. Exact wins across positions.
    expect(detectLocale(['it-CH', 'fr-FR'])).toEqual({ region: 'FR', language: 'fr-FR' });
    // Nothing exact anywhere: first prefix match wins.
    expect(detectLocale(['it-CH', 'en-AU'])).toEqual({ region: 'IT', language: 'it-IT' });
  });

  it('defaults to France when nothing matches or the list is empty', () => {
    expect(detectLocale(['ja-JP', 'ko'])).toEqual(DEFAULT_LOCALE);
    expect(detectLocale([])).toEqual(DEFAULT_LOCALE);
    expect(detectLocale([undefined])).toEqual(DEFAULT_LOCALE);
  });

  it('every offered pair detects itself', () => {
    for (const l of OFFERED_LOCALES) {
      expect(detectLocale([l.language])).toEqual({ region: l.region, language: l.language });
    }
  });
});
