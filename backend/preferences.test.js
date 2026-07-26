import { describe, expect, it } from 'vitest';
const { sanitizePreferences, DEFAULT_PREFERENCES, MAX_PLATFORMS } = require('./preferences');

describe('sanitizePreferences', () => {
  it('falls back to the defaults on a junk payload', () => {
    expect(sanitizePreferences(null)).toMatchObject({
      platforms: [],
      region: DEFAULT_PREFERENCES.region,
      librarySort: 'added_desc',
    });
  });

  it('keeps valid values and drops unknown fields', () => {
    const out = sanitizePreferences({
      platforms: [8, 119],
      region: 'be',
      language: 'fr-BE',
      libraryFilter: 'watched',
      librarySort: 'title_asc',
      isAdmin: true,
    });

    expect(out).toMatchObject({
      platforms: [8, 119],
      region: 'BE',
      language: 'fr-BE',
      libraryFilter: 'watched',
      librarySort: 'title_asc',
    });
    expect(out.isAdmin).toBeUndefined();
  });

  it('folds a partial payload onto the stored preferences', () => {
    const stored = { ...DEFAULT_PREFERENCES, platforms: [8], region: 'CA', librarySort: 'year_desc' };

    const out = sanitizePreferences({ libraryFilter: 'want' }, stored);

    expect(out).toMatchObject({
      platforms: [8],
      region: 'CA',
      librarySort: 'year_desc',
      libraryFilter: 'want',
    });
  });

  it('keeps the previous value when a field is invalid, instead of resetting it', () => {
    const stored = { ...DEFAULT_PREFERENCES, region: 'DE', librarySort: 'title_asc' };

    const out = sanitizePreferences({ region: 'Deutschland', librarySort: 'by_vibes' }, stored);

    expect(out.region).toBe('DE');
    expect(out.librarySort).toBe('title_asc');
  });

  it('rejects non-integer platform ids, dedupes and caps the list', () => {
    const out = sanitizePreferences({
      platforms: ['8', 8, -3, 'netflix', ...Array.from({ length: 60 }, (_, i) => i + 100)],
    });

    expect(out.platforms).toHaveLength(MAX_PLATFORMS);
    expect(out.platforms.slice(0, 2)).toEqual([8, 100]);
  });

  it('stamps updatedAt server-side, ignoring the client value', () => {
    const out = sanitizePreferences({ updatedAt: 4102444800000 });

    expect(out.updatedAt).toBeLessThanOrEqual(Date.now());
  });
});
